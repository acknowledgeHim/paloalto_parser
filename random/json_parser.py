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

Uses streaming JSON parsing (ijson) so the 1 GB file is never fully loaded.
"""

import re
import os
import sys
import argparse
from collections import defaultdict
from datetime import datetime

try:
    import ijson
except ImportError:
    sys.exit("ERROR: ijson is required.  Run:  pip install ijson")

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


# ── Aggregation ───────────────────────────────────────────────────────────────

def aggregate(input_path: str) -> tuple[dict, dict, list]:
    """
    Stream-parse the JSON file and return three data structures:

    tab1  : dict  (client, start_date, software) → occurrence count
    tab2  : dict  software → occurrence count
              (each (client, software) pair counted once regardless of
               how many start_dates that client has)
    tab3  : list  of (client, software, installed_date) — only rows that
              have an installed_on date
    """
    # Tab 1: (client, start_date, software) → int
    tab1: dict[tuple[str, str, str], int] = defaultdict(int)

    # Tab 2: software → int  (deduplicated per client)
    tab2: dict[str, int] = defaultdict(int)
    # Track (client, software) pairs already counted for tab2
    tab2_seen: set[tuple[str, str]] = set()

    # Tab 3: rows with an installation date
    tab3: list[tuple[str, str, str]] = []

    record_count = 0

    with open(input_path, "rb") as fh:
        # ijson.items streams one top-level array element at a time
        # Works whether the file is [{...}, {...}] or a single {...}
        try:
            items = ijson.items(fh, "item")
            _process_stream(items, tab1, tab2, tab2_seen, tab3)
        except ijson.JSONError:
            # Fallback: maybe it's a single object, not an array
            fh.seek(0)
            import json
            record = json.load(fh)
            _process_stream([record], tab1, tab2, tab2_seen, tab3)

    return tab1, tab2, tab3


def _process_stream(items, tab1, tab2, tab2_seen, tab3):
    for record in items:
        client     = str(record.get("client", "")).strip()
        start_date = str(record.get("start_date", "")).strip()
        output     = str(record.get("output", ""))

        # Split on both real newlines and literal \n sequences
        lines = re.split(r'\\n|\n', output)

        for raw in lines:
            name, installed = parse_line(raw)
            if not name:
                continue

            # ── Tab 1 ──────────────────────────────────────────────────────
            tab1[(client, start_date, name)] += 1

            # ── Tab 2 ──────────────────────────────────────────────────────
            # Count software once per client (deduplicate across start_dates)
            pair = (client, name)
            if pair not in tab2_seen:
                tab2_seen.add(pair)
                tab2[name] += 1

            # ── Tab 3 ──────────────────────────────────────────────────────
            if installed:
                tab3.append((client, name, installed))


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
        description="Convert software inventory JSON to Excel (streaming, low-memory)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Example:
  python software_inventory_parser.py inventory.json
  python software_inventory_parser.py inventory.json -o report.xlsx
""")
    ap.add_argument("input",  help="Input JSON file")
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
