#!/usr/bin/env python3
"""
Software Inventory JSON → Excel Parser

Reads a (potentially large) JSON file where each record has:
    client     : string  — client/tenant name
    output     : string  — software list separated by \\n, entries may
                           include "[installed on <date>]" suffix
    start_date : string  — audit/scan date for this record

Produces a 3-tab Excel report:
    Tab 1 — Software by Client & Date  : name, client, occurrences, start_date
    Tab 2 — Software Totals            : name, total occurrences (one count per
                                         client regardless of how many start_dates
                                         that client has)
    Tab 3 — Installation Dates         : client, software, installed_on

Uses a streaming bracket-counter parser so the 1 GB file is never fully loaded.
Handles: JSON arrays, NDJSON, MySQL INTO OUTFILE (raw newlines inside strings),
multi-line objects, and concatenated objects.
"""

import re
import os
import sys
import json
import argparse
from collections import defaultdict

try:
    import openpyxl
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    sys.exit("ERROR: openpyxl is required.  Run:  pip install openpyxl")


# ── regex to find "[installed on ...]" anywhere in a software line ────────────
_INSTALLED_RE = re.compile(r'\[installed on ([^\]]+)\]', re.I)


def parse_line(raw: str) -> tuple[str, str]:
    """Return (software_name, installed_date).  installed_date may be empty."""
    raw = raw.strip()
    m = _INSTALLED_RE.search(raw)
    installed = m.group(1).strip() if m else ""
    name = _INSTALLED_RE.sub("", raw).strip()
    return name, installed


# ── JSON streaming ────────────────────────────────────────────────────────────
#
# MySQL INTO OUTFILE writes raw control bytes (newline 0x0A, tab 0x09, etc.)
# inside string field values without JSON-escaping them.  Standard parsers
# (ijson, json.loads) reject this as invalid JSON.
#
# _iter_records() uses a bracket-counter that:
#   1. Reads the file in 64 KB chunks — memory is bounded to one object at a time
#   2. Tracks string/escape state character-by-character
#   3. Replaces any bare control character inside a JSON string with its
#      two-char JSON escape sequence  (\n  \t  etc.)
#   4. Emits each complete {…} object to json.loads once the closing } is found
#
# This handles: JSON arrays, NDJSON, MySQL OUTFILE, multi-line objects,
# and concatenated objects — without needing ijson.

_CTRL = {'\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f'}

# Excel hard row limit (row 1 is header; max data rows = 1_048_575)
EXCEL_MAX_ROWS = 1_048_575


def _try_parse(s: str) -> dict | None:
    """Try json.loads, then retry after undoing MySQL OUTFILE backslash-doubling."""
    try:
        obj = json.loads(s)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass
    # MySQL INTO OUTFILE doubles every backslash (\ → \\), which turns JSON's
    # \" (escaped quote) into \\" (escaped backslash + raw quote = end-of-string).
    # Halving all backslash-pairs restores the original JSON text.
    try:
        obj = json.loads(s.replace('\\\\', '\\'))
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError as e:
        print(f"  [!] Skipping object: {e}", file=sys.stderr)
        return None


def _iter_records(file_path: str):
    """Yield one dict per JSON object from any supported format."""
    CHUNK = 65_536  # 64 KB per read
    buf: list[str] = []
    depth = 0
    in_str = False
    esc_next = False
    parsed = skipped = 0

    with open(file_path, "r", encoding="utf-8", errors="replace", newline="") as fh:
        while True:
            chunk = fh.read(CHUNK)
            if not chunk:
                break
            for ch in chunk:
                if esc_next:
                    if depth:
                        buf.append(ch)
                    esc_next = False
                    continue
                if ch == "\\" and in_str:
                    if depth:
                        buf.append(ch)
                    esc_next = True
                    continue
                if ch == '"':
                    in_str = not in_str
                    if depth:
                        buf.append(ch)
                    continue
                if in_str:
                    if depth:
                        if ord(ch) < 0x20:
                            # Sanitize bare control chars MySQL OUTFILE leaves unescaped
                            buf.append(_CTRL.get(ch, f"\\u{ord(ch):04x}"))
                        else:
                            buf.append(ch)
                    continue
                # Outside strings
                if ch == "{":
                    depth += 1
                    buf.append(ch)
                elif ch == "}":
                    if depth:
                        buf.append(ch)
                        depth -= 1
                        if depth == 0:
                            s = "".join(buf)
                            buf.clear()
                            obj = _try_parse(s)
                            if obj is not None:
                                yield obj
                                parsed += 1
                            else:
                                skipped += 1
                elif depth:
                    buf.append(ch)

    print(f"[*] Parsed {parsed:,} records ({skipped:,} skipped)", file=sys.stderr)


# ── CSV parser ────────────────────────────────────────────────────────────────

def _iter_csv_records(file_path: str):
    """
    Yield dicts with keys client/output/start_date from a CSV file.
    The output column may contain newlines (quoted field) or literal \\n sequences.
    Column order is detected from the header row; column names are case-insensitive.
    """
    import csv
    parsed = 0
    with open(file_path, "r", encoding="utf-8-sig", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh)
        # Normalise header names to lowercase for flexible matching
        if reader.fieldnames is None:
            print("[!] CSV has no header row", file=sys.stderr)
            return
        norm = {f.strip().lower(): f for f in reader.fieldnames}
        client_col     = norm.get("client")
        output_col     = norm.get("output")
        start_date_col = norm.get("start_date") or norm.get("startdate") or norm.get("start date")
        if not all([client_col, output_col, start_date_col]):
            print(f"[!] CSV missing required columns. Found: {list(reader.fieldnames)}", file=sys.stderr)
            return
        for row in reader:
            yield {
                "client":     (row.get(client_col)     or "").strip(),
                "output":     (row.get(output_col)     or ""),
                "start_date": (row.get(start_date_col) or "").strip(),
            }
            parsed += 1
    print(f"[*] CSV: read {parsed:,} rows", file=sys.stderr)


# ── Aggregation ───────────────────────────────────────────────────────────────

def _accumulate(records, tab1, tab2, tab2_seen, tab3):
    for record in records:
        client     = str(record.get("client",     "")).strip()
        start_date = str(record.get("start_date", "")).strip()
        output     = str(record.get("output",     ""))
        for raw in re.split(r'\\n|\n', output):
            name, installed = parse_line(raw)
            if not name:
                continue
            tab1[(client, start_date, name)] += 1
            pair = (client, name)
            if pair not in tab2_seen:
                tab2_seen.add(pair)
                tab2[name] += 1
            if installed:
                tab3.append((client, name, installed))


def aggregate(input_path: str) -> tuple[dict, dict, list]:
    tab1: dict[tuple[str, str, str], int] = defaultdict(int)
    tab2: dict[str, int] = defaultdict(int)
    tab2_seen: set[tuple[str, str]] = set()
    tab3: list[tuple[str, str, str]] = []

    ext = os.path.splitext(input_path)[1].lower()
    if ext == ".csv":
        print(f"[*] Format: CSV", file=sys.stderr)
        _accumulate(_iter_csv_records(input_path), tab1, tab2, tab2_seen, tab3)
    else:
        with open(input_path, "rb") as fh:
            probe = fh.read(256).decode("utf-8", errors="replace")
        print(f"[*] File probe: {probe[:120]!r}", file=sys.stderr)
        _accumulate(_iter_records(input_path), tab1, tab2, tab2_seen, tab3)

    return tab1, tab2, tab3


# ── Styling helpers ───────────────────────────────────────────────────────────

HDR_BG   = "1B3A5C"
HDR_FG   = "FFFFFF"
ALT_ROW  = "F5F5F5"

_thin    = Side(style="thin", color="CCCCCC")
THIN     = Border(left=_thin, right=_thin, top=_thin, bottom=_thin)


def _fill(hex_color: str) -> PatternFill:
    return PatternFill("solid", fgColor=hex_color)

def _font(bold=False, color="000000", size=10) -> Font:
    return Font(name="Calibri", bold=bold, color=color, size=size)

def _align(h="left") -> Alignment:
    return Alignment(horizontal=h, vertical="center", wrap_text=False)

def _hdr_row(ws, headers: list[str], row: int = 1):
    for col, h in enumerate(headers, 1):
        c = ws.cell(row=row, column=col, value=h)
        c.font      = _font(bold=True, color=HDR_FG)
        c.fill      = _fill(HDR_BG)
        c.alignment = _align("center")
        c.border    = THIN
    ws.row_dimensions[row].height = 20

def _set_widths(ws, widths: list[int]):
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


# ── Excel builder ─────────────────────────────────────────────────────────────

def build_excel(tab1: dict, tab2: dict, tab3: list, out_path: str):

    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # ── Tab 1: Software by Client & Date ──────────────────────────────────────
    ws1 = wb.create_sheet("By Client & Date")
    ws1.sheet_view.showGridLines = False
    headers1 = ["Software Name", "Client", "Occurrences", "Start Date"]
    _hdr_row(ws1, headers1)
    ws1.freeze_panes = "A2"
    ws1.auto_filter.ref = f"A1:{get_column_letter(len(headers1))}1"

    # Sort by start_date, client, software for readability
    rows1 = sorted(
        ((k[0], k[1], k[2], v) for k, v in tab1.items()),
        key=lambda x: (x[1], x[0], x[3])   # client, start_date, software
    )
    if len(rows1) > EXCEL_MAX_ROWS:
        print(f"[!] Tab1: {len(rows1):,} rows exceeds Excel limit; truncating to {EXCEL_MAX_ROWS:,}", file=sys.stderr)
        rows1 = rows1[:EXCEL_MAX_ROWS]

    for i, (client, start_date, name, count) in enumerate(rows1, 2):
        rb = ALT_ROW if i % 2 == 0 else None
        for col, val in enumerate([name, client, count, start_date], 1):
            c = ws1.cell(row=i, column=col, value=val)
            c.font      = _font()
            c.alignment = _align("center" if col == 3 else "left")
            c.border    = THIN
            if rb:
                c.fill = _fill(rb)

    _set_widths(ws1, [55, 30, 14, 18])

    # ── Tab 2: Software Totals ────────────────────────────────────────────────
    ws2 = wb.create_sheet("Software Totals")
    ws2.sheet_view.showGridLines = False
    headers2 = ["Software Name", "Occurrences"]
    _hdr_row(ws2, headers2)
    ws2.freeze_panes = "A2"
    ws2.auto_filter.ref = f"A1:{get_column_letter(len(headers2))}1"

    # Sort by count descending, then name
    rows2 = sorted(tab2.items(), key=lambda x: (-x[1], x[0]))
    if len(rows2) > EXCEL_MAX_ROWS:
        print(f"[!] Tab2: {len(rows2):,} rows exceeds Excel limit; truncating to {EXCEL_MAX_ROWS:,}", file=sys.stderr)
        rows2 = rows2[:EXCEL_MAX_ROWS]

    for i, (name, count) in enumerate(rows2, 2):
        rb = ALT_ROW if i % 2 == 0 else None
        for col, val in enumerate([name, count], 1):
            c = ws2.cell(row=i, column=col, value=val)
            c.font      = _font()
            c.alignment = _align("center" if col == 2 else "left")
            c.border    = THIN
            if rb:
                c.fill = _fill(rb)

    _set_widths(ws2, [55, 14])

    # ── Tab 3: Installation Dates ─────────────────────────────────────────────
    ws3 = wb.create_sheet("Installation Dates")
    ws3.sheet_view.showGridLines = False
    headers3 = ["Client", "Software Name", "Installed On"]
    _hdr_row(ws3, headers3)
    ws3.freeze_panes = "A2"
    ws3.auto_filter.ref = f"A1:{get_column_letter(len(headers3))}1"

    # Sort by client, software name
    rows3 = sorted(tab3, key=lambda x: (x[0], x[1]))
    if len(rows3) > EXCEL_MAX_ROWS:
        print(f"[!] Tab3: {len(rows3):,} rows exceeds Excel limit; truncating to {EXCEL_MAX_ROWS:,}", file=sys.stderr)
        rows3 = rows3[:EXCEL_MAX_ROWS]

    for i, (client, name, installed) in enumerate(rows3, 2):
        rb = ALT_ROW if i % 2 == 0 else None
        for col, val in enumerate([client, name, installed], 1):
            c = ws3.cell(row=i, column=col, value=val)
            c.font      = _font()
            c.alignment = _align()
            c.border    = THIN
            if rb:
                c.fill = _fill(rb)

    _set_widths(ws3, [30, 55, 22])

    wb.save(out_path)


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="Convert software inventory JSON or CSV to Excel (streaming, low-memory)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python json_parser.py inventory.json
  python json_parser.py inventory.csv
  python json_parser.py inventory.json -o report.xlsx

CSV format: header row with columns  client, output, start_date
JSON format: array or NDJSON with keys  client, output, start_date
  (MySQL INTO OUTFILE output is handled automatically)
""")
    ap.add_argument("input",  help="Input JSON or CSV file")
    ap.add_argument("-o", "--output", default=None,
                    help="Output Excel file (default: <input-stem>_report.xlsx)")
    args = ap.parse_args()

    if not os.path.isfile(args.input):
        sys.exit(f"File not found: {args.input}")

    if not args.output:
        stem = os.path.splitext(os.path.basename(args.input))[0]
        args.output = f"{stem}_report.xlsx"

    print(f"[*] Streaming: {args.input}")
    tab1, tab2, tab3 = aggregate(args.input)

    print(f"[*] Aggregated:")
    print(f"      Tab 1 rows (client+date+software) : {len(tab1):,}")
    print(f"      Tab 2 unique software names        : {len(tab2):,}")
    print(f"      Tab 3 installation date rows       : {len(tab3):,}")

    print(f"[*] Writing Excel...")
    build_excel(tab1, tab2, tab3, args.output)
    print(f"[+] Saved: {args.output}")


if __name__ == "__main__":
    main()
