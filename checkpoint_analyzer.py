#!/usr/bin/env python3
"""
Check Point Firewall Configuration Analyzer
Parses a Check Point Gaia OS configuration — a 'show configuration' (clish)
CLI text capture from the gateway or management server — checks it against
the CIS Check Point Firewall Benchmark L1/L2 using the actual Tenable Nessus
.audit files for that benchmark (bundled in audits.tar.gz, same as the other
analyzers in this repo), and exports findings + rulebase inventory to Excel.
A SmartConsole Rule Base "Export to CSV" can supply the Security Rulebase,
since Gaia's own 'show configuration' only covers gateway/OS-level settings
(password policy, SNMP, NTP, DNS, session timeouts, ...) — the access
rulebase itself lives on the Management Server, not in the Gaia config.

Usage:
    python checkpoint_analyzer.py "show configuration.txt"
    python checkpoint_analyzer.py "show configuration.txt" --rules-csv rulebase.csv
    python checkpoint_analyzer.py "show configuration.txt" -o audit.xlsx
    python checkpoint_analyzer.py rulebase.csv                    # rules-only mode
"""

import re
import os
import sys
import csv as _csv
import tarfile
import argparse
from collections import defaultdict
from datetime import datetime

try:
    import openpyxl
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    print("ERROR: openpyxl is required.  Run:  pip install openpyxl")
    sys.exit(1)


# ── Colour palette (matches the other analyzers in this repo) ───────────────
C = {
    "hdr_bg":   "1F3864", "hdr_fg":   "FFFFFF",
    "critical": "C00000", "critical_l": "FFB3B3",
    "high":     "FF0000", "high_l":     "FFD9B3",
    "medium":   "FF8C00", "medium_l":   "FFF2CC",
    "low":      "0070C0", "low_l":      "BDD7EE",
    "info":     "595959", "info_l":     "F2F2F2",
    "allow":    "375623", "allow_l":    "E2EFDA",
    "deny":     "C00000", "deny_l":     "FFB3B3",
    "disabled": "A6A6A6",
    "alt_row":  "F5F5F5",
}
_thin_side = Side(style="thin", color="CCCCCC")
THIN = Border(left=_thin_side, right=_thin_side, top=_thin_side, bottom=_thin_side)


def _fill(hex_color: str) -> PatternFill:
    return PatternFill(start_color=hex_color, end_color=hex_color, fill_type="solid")


def _font(bold=False, color="000000", size=10, italic=False) -> Font:
    return Font(name="Calibri", bold=bold, color=color, size=size, italic=italic)


def _align(h="left", wrap=True) -> Alignment:
    return Alignment(horizontal=h, vertical="center", wrap_text=wrap)


# ── vulns.txt (shared vendor-agnostic vulnerability taxonomy) ───────────────
def _load_vulns(path: str) -> dict[int, str]:
    vulns: dict[int, str] = {}
    try:
        with open(path, encoding="utf-8") as fh:
            for vuln_id, line in enumerate(fh, 1):
                text = line.strip()
                if text:
                    vulns[vuln_id] = text
        return vulns
    except FileNotFoundError:
        return vulns


def _find_vulns_file() -> dict[int, str]:
    candidates = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "vulns.txt"),
        os.path.join(os.getcwd(), "vulns.txt"),
    ]
    for path in candidates:
        vulns = _load_vulns(path)
        if vulns:
            return vulns
    print("[!] Warning: vulns.txt not found — Vuln column will be empty. "
          "Place vulns.txt alongside checkpoint_analyzer.py.")
    return {}


# Maps native (non-benchmark-catalog) finding categories to a vulns.txt line ID.
# Benchmark-catalog-driven findings (the CIS Check Point items) don't use this —
# their evidence/mapping comes straight from the .audit file's own reference data.
CATEGORY_VULN_ID: dict[str, int] = {
    "Disabled Rulebase Rule":              2,
    "Missing Rule Comment":                5,
    "Rule Allows Any Source":              9,
    "Rule Allows Any Destination":         9,
    "Rule Allows Any Service":             9,
    "Allow Rule Not Logging":              28,
    "No Hit Count Data":                   25,
}


# ── audits.tar.gz locate (same search strategy as the other analyzers) ──────
_TAR_SEARCH_SKIP_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", ".tox", "dist", "build"}


def _find_audits_tar() -> "str | None":
    roots = list(dict.fromkeys([os.path.dirname(os.path.abspath(__file__)), os.getcwd()]))
    for base in roots:
        direct = os.path.join(base, "audits.tar.gz")
        if os.path.isfile(direct):
            return direct
    for base in roots:
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in _TAR_SEARCH_SKIP_DIRS and not d.startswith(".")]
            if "audits.tar.gz" in files:
                return os.path.join(root, "audits.tar.gz")
    return None


# ── CIS Controls v7 descriptions ─────────────────────────────────────────────
# The CIS Check Point Firewall Benchmark's .audit reference data cites CIS
# Controls v7 (CSCv7), not v8 — this table only covers the sub-controls that
# actually appear there.
CIS_CTRL_DESC: dict[str, str] = {
    "5.1":  "Establish Secure Configurations",
    "5.2":  "Maintain Secure Images",
    "5.3":  "Securely Store Master Images",
    "5.5":  "Implement Automated Configuration Monitoring Systems",
    "6.2":  "Activate Audit Logging",
    "6.4":  "Ensure Adequate Storage for Logs",
    "6.7":  "Regularly Review Logs",
    "9.2":  "Ensure Only Approved Ports, Protocols and Services Are Running",
    "11.1": "Maintain Standard Security Configurations for Network Devices",
    "11.2": "Document Traffic Configuration Rules",
    "11.3": "Use Automated Tools to Verify Standard Device Configurations and Detect Changes",
    "11.7": "Manage Network Infrastructure Through a Dedicated Network",
    "12.1": "Maintain an Inventory of Network Boundaries",
    "12.2": "Scan for Unauthorized Connections Across Trusted Network Boundaries",
    "12.3": "Deny Communications with Known Malicious or Unused Internet IP Addresses",
    "12.4": "Deny Communication over Unauthorized Ports",
}

# ── PCI DSS v4.0 descriptions ────────────────────────────────────────────────
# Same approach: only the requirement IDs that actually appear in the
# benchmark's reference data.
PCI_DSS_DESC: dict[str, str] = {
    "1.2.1":  "Configuration standards for NSC rulesets are defined, implemented, and maintained",
    "1.3.1":  "Inbound traffic to the CDE is restricted",
    "1.4.1":  "Network security controls are implemented between trusted and untrusted networks",
    "1.4.2":  "Inbound traffic from untrusted networks to trusted networks is restricted",
    "1.4.3":  "Anti-spoofing measures are implemented to detect and block forged source IP addresses",
    "2.2.3":  "Primary functions requiring different security levels are managed to prevent security issues",
    "2.2.4":  "Only necessary services, protocols, daemons, and functions are enabled",
    "8.2.8":  "If a session is idle for more than 15 minutes, the user is required to re-authenticate",
    "10.2.2": "Audit logs capture all actions taken by individuals with administrative access",
    "10.6":   "Time-synchronization mechanisms support consistent time settings across all systems",
    "10.6.1": "System clocks and time are synchronized using time-synchronization technology",
    "10.6.2": "Systems are configured to correct time settings from a designated authoritative source",
    "10.6.3": "Time synchronization settings and data are protected from unauthorized changes",
}


def _cis_label(ids: list[str]) -> str:
    return " · ".join(f"CIS {c}" for c in ids)


def _cis_benchmark_label(ids: list[str]) -> str:
    return " · ".join(ids)


def _pci_label(ids: list[str]) -> str:
    return " · ".join(f"PCI DSS {c}" for c in ids)


def _refs_from_reference(reference: str) -> tuple[list[str], list[str]]:
    """Pull CIS Controls v7 (CSCv7|x.x) and PCI DSS v4.0 (PCI-DSSv4.0|x.x) IDs
    out of a .audit 'reference' field."""
    cis_ids = sorted(set(re.findall(r'CSCv7\|([\d.]+)', reference)),
                      key=lambda s: [int(p) for p in s.split(".")])
    pci_ids = sorted(set(re.findall(r'PCI-DSSv4\.0\|([\d.]+)', reference)),
                      key=lambda s: [int(p) for p in s.split(".")])
    return cis_ids, pci_ids


# ── Gaia 'show configuration' (clish) text loading ───────────────────────────
_ANSI_CSI_RE  = re.compile(r'\x1b\[[0-9;?]*[A-Za-z]')
_ANSI_MISC_RE = re.compile(r'\x1b[=>]')


def _load_gaia_config(filename: str) -> list[tuple[int, str]]:
    """Return [(line_no, text), ...] for every 'set'/'add'/'delete' clish
    statement in a captured Gaia 'show configuration' (or 'show configuration
    all') session. Strips ANSI escapes/PuTTY artifacts and comment/blank/
    prompt lines."""
    try:
        with open(filename, "r", encoding="utf-8", errors="replace") as fh:
            raw = fh.read()
    except FileNotFoundError:
        sys.exit(f"File not found: {filename}")

    raw = _ANSI_CSI_RE.sub("", raw)
    raw = _ANSI_MISC_RE.sub("", raw)

    out: list[tuple[int, str]] = []
    for lineno, line in enumerate(raw.splitlines(), 1):
        text = line.rstrip()
        stripped = text.strip()
        if not stripped or stripped.startswith("#"):
            continue
        # Gaia clish statements of interest all start with one of these verbs.
        if re.match(r'^(set|add|delete)\s+\S', stripped):
            out.append((lineno, stripped))
    return out


# ── Check Point CIS Benchmark .audit parser ──────────────────────────────────
def _extract_quoted(field: str, block: str) -> "str | None":
    """Extract a 'field : "..."' value from a .audit block, honoring \\" escapes."""
    m = re.search(rf'(?m)^\s*{field}\s*:\s*"((?:[^"\\]|\\.)*)"', block)
    return m.group(1).replace('\\"', '"') if m else None


def _first_para(text: str) -> str:
    for marker in ("\nRationale:", "\n\nRationale:", "\nImpact:", "\n\nImpact:"):
        if marker in text:
            text = text[:text.index(marker)]
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    return re.sub(r'\s+', ' ', paras[0]) if paras else re.sub(r'\s+', ' ', text.strip())


_ID_RE = re.compile(r'^(\d+(?:\.\d+)*)\s+(.*)$')


def _split_id(desc: str) -> tuple[str, str]:
    """'2.2.3 Ensure SNMP traps is enabled - lowDiskSpace' ->
    ('2.2.3', 'Ensure SNMP traps is enabled - lowDiskSpace')"""
    m = _ID_RE.match(desc.strip())
    return (m.group(1), m.group(2)) if m else ("", desc.strip())


def _parse_checkpoint_audit(content: str, level: str) -> list[dict]:
    """Parse a CIS_Check_Point_Firewall_*.audit file into a flat list of
    catalog items — both automated CONFIG_CHECK entries (have regex+expect)
    and non-automated <report> entries (manual review / conditionally
    evaluated by Nessus). Each item carries the raw benchmark ID it belongs
    to so callers can group multi-part checks (e.g. '1.4 ... - history-length'
    and '1.4 ... - history-checking') under one finding."""
    items: list[dict] = []

    for block in re.findall(r'<custom_item>(.*?)</custom_item>', content, re.DOTALL):
        if 'CONFIG_CHECK' not in block:
            continue
        desc = _extract_quoted("description", block) or ""
        base_id, title = _split_id(desc)
        if not base_id:
            continue  # internal AND-condition helper item, not a real benchmark control
        items.append({
            "level": level, "id": base_id, "title": title, "kind": "custom_item",
            "info": _first_para(_extract_quoted("info", block) or ""),
            "solution": (_extract_quoted("solution", block) or "").strip(),
            "reference": _extract_quoted("reference", block) or "",
            "regex": _extract_quoted("regex", block),
            "expect": _extract_quoted("expect", block),
            "not_expect": _extract_quoted("not_expect", block),
        })

    for block in re.findall(r'<report[^>]*>(.*?)</report>', content, re.DOTALL):
        desc = _extract_quoted("description", block) or ""
        base_id, title = _split_id(desc)
        if not base_id:
            continue
        items.append({
            "level": level, "id": base_id, "title": title, "kind": "report",
            "info": _first_para(_extract_quoted("info", block) or ""),
            "solution": (_extract_quoted("solution", block) or "").strip(),
            "reference": _extract_quoted("reference", block) or "",
            "regex": None, "expect": None, "not_expect": None,
        })

    return items


# Manual, best-judgment severities per benchmark ID — the .audit file itself
# specifies a 'severity' field on only 2 of the 68 catalog items, so every
# other severity here is assigned the same way the other analyzers in this
# repo assign theirs: by what the control actually protects against.
SEVERITY_OVERRIDE: dict[str, str] = {
    "1.1": "HIGH", "1.2": "MEDIUM", "1.3": "HIGH", "1.4": "MEDIUM", "1.5": "MEDIUM",
    "1.6": "LOW", "1.7": "LOW", "1.8": "MEDIUM", "1.9": "LOW", "1.10": "MEDIUM",
    "1.11": "HIGH", "1.12": "HIGH", "1.13": "MEDIUM",
    "2.1.1": "LOW", "2.1.2": "LOW", "2.1.3": "LOW", "2.1.4": "LOW",
    "2.1.5": "MEDIUM", "2.1.6": "MEDIUM", "2.1.7": "LOW", "2.1.8": "LOW",
    "2.1.9": "HIGH", "2.1.10": "LOW",
    "2.2.1": "HIGH", "2.2.2": "MEDIUM", "2.2.3": "LOW", "2.2.4": "LOW",
    "2.3.1": "MEDIUM", "2.3.2": "LOW",
    "2.4.1": "LOW", "2.4.2": "LOW", "2.4.3": "LOW",
    "2.5.1": "MEDIUM", "2.5.2": "MEDIUM", "2.5.3": "MEDIUM", "2.5.4": "MEDIUM", "2.5.5": "HIGH",
    "2.6.1": "MEDIUM", "2.6.2": "MEDIUM", "2.6.3": "MEDIUM",
    "3.1": "HIGH", "3.2": "HIGH", "3.3": "INFO", "3.4": "LOW",
    "3.5": "HIGH", "3.6": "HIGH", "3.7": "HIGH", "3.8": "MEDIUM", "3.9": "LOW",
    "3.10": "MEDIUM", "3.11": "MEDIUM", "3.12": "HIGH", "3.13": "LOW",
    "3.14": "MEDIUM", "3.15": "MEDIUM", "3.16": "LOW", "3.17": "LOW",
    "3.18": "LOW", "3.19": "LOW", "3.20": "MEDIUM",
}


def _severity_for(base_id: str) -> str:
    return SEVERITY_OVERRIDE.get(base_id, "MEDIUM")


_VAR_RE = re.compile(r'@[A-Z_]+@')


def _compile_pattern(pattern: str) -> tuple[re.Pattern, bool]:
    """A .audit expect/regex value may embed a Nessus policy variable like
    @DNS_PRIMARY@ or @TIMEZONE@ — a site-specific value this script has no
    way to know. Those are relaxed to 'any non-space token' so the check
    still verifies the *feature* is configured, and the finding text says
    to confirm the value by hand."""
    had_vars = bool(_VAR_RE.search(pattern))
    relaxed = _VAR_RE.sub(r'\\S+', pattern)
    return re.compile(relaxed), had_vars


def _eval_config_check(check: dict, gaia_lines: list[tuple[int, str]]) -> dict:
    """Evaluate one automated CONFIG_CHECK item against the parsed Gaia
    config lines. Returns {'status': 'PASS'|'FAIL', 'line': int, 'text': str,
    'had_vars': bool}."""
    regex_pat = re.compile(check["regex"])
    matches = [(ln, txt) for ln, txt in gaia_lines if regex_pat.search(txt)]

    if check["expect"] is None and check["not_expect"] is not None:
        # e.g. DHCP: absent entirely, or present-but-not-matching-not_expect, both PASS.
        nexp_pat, had_vars = _compile_pattern(check["not_expect"])
        bad = next(((ln, txt) for ln, txt in matches if nexp_pat.search(txt)), None)
        if bad:
            return {"status": "FAIL", "line": bad[0], "text": bad[1], "had_vars": had_vars}
        last = matches[-1] if matches else (0, "")
        return {"status": "PASS", "line": last[0], "text": last[1], "had_vars": had_vars}

    exp_pat, had_vars = _compile_pattern(check["expect"] or "")
    good = next(((ln, txt) for ln, txt in matches if exp_pat.search(txt)), None)
    if good:
        return {"status": "PASS", "line": good[0], "text": good[1], "had_vars": had_vars}
    if matches:
        ln, txt = matches[0]
        return {"status": "FAIL", "line": ln, "text": txt, "had_vars": had_vars}
    return {"status": "FAIL", "line": 0, "text": "", "had_vars": had_vars}


# ── SmartConsole Rule Base CSV export ────────────────────────────────────────
_RULE_HDR_ALIASES: dict[str, list[str]] = {
    "num":         ["no.", "no", "rule number", "#"],
    "name":        ["name", "rule name"],
    "source":      ["source"],
    "destination": ["destination"],
    "vpn":         ["vpn"],
    "services":    ["services & applications", "service", "services", "application"],
    "action":      ["action"],
    "track":       ["track", "log"],
    "install_on":  ["install on"],
    "time":        ["time"],
    "comments":    ["comments", "comment"],
    "enabled":     ["enabled", "rule enabled", "hits enabled"],
    "hits":        ["hits", "hit count"],
}


def _csv_cell(v: str) -> str:
    v = (v or "").strip()
    return "" if v in ("-", "--", "n/a", "N/A") else v


def _parse_rulebase_csv(path: str) -> list[dict]:
    try:
        fh = open(path, "r", encoding="utf-8-sig", newline="")
    except FileNotFoundError:
        sys.exit(f"Rules CSV not found: {path}")

    with fh:
        reader = _csv.DictReader(fh)
        if reader.fieldnames is None:
            sys.exit(f"Rules CSV has no header row: {path}")
        lower_hdr = {(h or "").strip().lower(): h for h in reader.fieldnames}

        def col(key: str) -> "str | None":
            for alias in _RULE_HDR_ALIASES[key]:
                if alias in lower_hdr:
                    return lower_hdr[alias]
            return None

        cols = {k: col(k) for k in _RULE_HDR_ALIASES}
        rules: list[dict] = []
        for rule_num, raw_row in enumerate(reader, 1):
            row = {k: _csv_cell(v) for k, v in raw_row.items()}
            name = row.get(cols["name"], "") if cols["name"] else ""
            action = row.get(cols["action"], "") if cols["action"] else ""
            if not name and not action:
                continue  # section-header / blank row in the export
            enabled_raw = (row.get(cols["enabled"], "") if cols["enabled"] else "").strip().lower()
            rules.append({
                "num": rule_num,
                "name": name or f"Rule {rule_num}",
                "source":      row.get(cols["source"], "") if cols["source"] else "",
                "destination": row.get(cols["destination"], "") if cols["destination"] else "",
                "vpn":         row.get(cols["vpn"], "") if cols["vpn"] else "",
                "services":    row.get(cols["services"], "") if cols["services"] else "",
                "action":      action,
                "track":       row.get(cols["track"], "") if cols["track"] else "",
                "install_on":  row.get(cols["install_on"], "") if cols["install_on"] else "",
                "time":        row.get(cols["time"], "") if cols["time"] else "",
                "comments":    row.get(cols["comments"], "") if cols["comments"] else "",
                "enabled":     enabled_raw not in ("no", "false", "disabled", "0"),
                "hits":        row.get(cols["hits"], "") if cols["hits"] else "",
            })
    print(f"[+] Loaded {len(rules)} rulebase row(s) from CSV: {path}")
    return rules


def _has_any(field: str) -> bool:
    return any(tok.strip().lower() == "any" for tok in re.split(r'[;,]', field or ""))


def _is_allow(action: str) -> bool:
    return (action or "").strip().lower() in ("accept", "allow")


def _is_drop(action: str) -> bool:
    return (action or "").strip().lower() in ("drop", "reject", "deny")


# ══════════════════════════════════════════════════════════════════════════
class CheckpointParser:
    def __init__(self, config_file: "str | None", rules_csv: "str | None" = None):
        self.config_file = config_file
        self.rules_csv = rules_csv
        self.source_label = os.path.basename(config_file) if config_file else \
            (os.path.basename(rules_csv) if rules_csv else "(none)")

        self.gaia_lines: list[tuple[int, str]] = []
        self.security_rules: list[dict] = []
        self.system: dict[str, tuple[str, int]] = {}   # label -> (value, line#)
        self.issues: list[dict] = []
        self._seen_issues: set[tuple[str, str]] = set()
        self._native_ids: set[str] = set()   # benchmark IDs a native rulebase check already covered

        self.audits_tar_path = ""
        self.cis_l1_audit_used = ""
        self.cis_l2_audit_used = ""
        self.catalog: list[dict] = []   # every parsed CIS Check Point Firewall Benchmark item

    # ── Parse entry point ────────────────────────────────────────────────────
    def parse(self):
        if self.config_file is not None:
            self.gaia_lines = _load_gaia_config(self.config_file)
            print(f"[+] Loaded {len(self.gaia_lines)} configuration statement(s) from "
                  f"{os.path.basename(self.config_file)}")
            self._parse_system_settings()
        if self.rules_csv:
            self.security_rules = _parse_rulebase_csv(self.rules_csv)
        if not self.config_file and not self.rules_csv:
            sys.exit("No Gaia config and no --rules-csv given — nothing to analyze.")

        if self.security_rules:
            self._run_rulebase_checks()
        if self.gaia_lines:
            self._run_cis_checks()

    # ── System settings (for the Gaia Configuration sheet) ──────────────────
    def _sys_set(self, label: str, regex: str, group: int = 0):
        pat = re.compile(regex)
        for ln, txt in self.gaia_lines:
            m = pat.search(txt)
            if m:
                self.system[label] = (m.group(group) if group else txt, ln)

    def _parse_system_settings(self):
        self._sys_set("Hostname",              r'^set hostname (\S+)', 1)
        self._sys_set("Timezone",               r'^set timezone (.+)$', 1)
        self._sys_set("IPv6 State",             r'^set ipv6-state (\S+)', 1)
        self._sys_set("DNS Primary",            r'^set dns primary (\S+)', 1)
        self._sys_set("DNS Secondary",          r'^set dns secondary (\S+)', 1)
        self._sys_set("NTP Active",             r'^set ntp active (\S+)', 1)
        self._sys_set("Telnet",                 r'^set net-access telnet (\S+)', 1)
        self._sys_set("DHCP Server",            r'^set dhcp server')
        self._sys_set("SNMP Agent",             r'^set snmp agent (\S+)$', 1)
        self._sys_set("SNMP Version",           r'^set snmp agent-version (\S+)', 1)
        self._sys_set("Core Dump",              r'^set core-dump enable')
        self._sys_set("CLI Inactivity Timeout", r'^set inactivity-timeout (\S+)', 1)
        self._sys_set("Web Session Timeout",    r'^set web session-timeout (\S+)', 1)
        self._sys_set("Login Banner",           r'^set message banner on')
        self._sys_set("MOTD Banner",            r'^set message motd on')
        self._sys_set("Password Min Length",    r'^set password-controls min-password-length (\S+)', 1)
        self._sys_set("Password Complexity",    r'^set password-controls complexity (\S+)', 1)
        self._sys_set("Mgmt Audit Logs",        r'^set syslog mgmtauditlogs (\S+)', 1)
        self._sys_set("Audit Log Retention",    r'^set syslog auditlog (\S+)', 1)
        self._sys_set("RADIUS/TACACS+ State",   r'^set aaa tacacs-servers state (\S+)', 1)

    # ── Findings ──────────────────────────────────────────────────────────
    def _issue(self, severity, category, item_id, name, description, recommendation,
               details="", line="", cis_ids=None, pci_ids=None):
        key = (category, name)
        if key in self._seen_issues:
            return
        self._seen_issues.add(key)
        cis_ids = cis_ids or []
        pci_ids = pci_ids or []
        self.issues.append({
            "severity": severity, "category": category, "item_id": item_id, "rule_name": name,
            "line": str(line) if line else "", "description": description,
            "recommendation": recommendation, "details": details,
            "cis_controls": _cis_label(cis_ids), "cis_ids": cis_ids,
            "cis_benchmark": item_id, "pci_dss": _pci_label(pci_ids), "pci_ids": pci_ids,
        })

    # ── Native rulebase checks (need --rules-csv) ────────────────────────────
    def _catalog_text(self, item_id: str) -> tuple[str, str]:
        """(description, solution) for a benchmark ID, if the catalog has been
        loaded yet — falls back to empty strings when checked before _run_cis_checks."""
        for it in self.catalog:
            if it["id"] == item_id:
                return it["info"], it["solution"]
        return "", ""

    def _run_rulebase_checks(self):
        active = [r for r in self.security_rules if r["enabled"]]
        allow_active = [r for r in active if _is_allow(r["action"])]

        for r in self.security_rules:
            if not r["enabled"]:
                self._issue("LOW", "Disabled Rulebase Rule", "", r["name"],
                             f"Rule '{r['name']}' is disabled but still present in the rulebase.",
                             "Remove rules that are no longer needed instead of leaving them "
                             "disabled indefinitely — disabled rules accumulate and obscure intent.",
                             line=r["num"])
        for r in active:
            if not r["comments"].strip():
                self._issue("LOW", "Missing Rule Comment", "", r["name"],
                             f"Rule '{r['name']}' has no comment describing its business purpose.",
                             "Add a comment to every rule explaining why it exists and who owns it.",
                             line=r["num"])

        for r in allow_active:
            if _has_any(r["source"]):
                self._issue("HIGH", "Rule Allows Any Source", "3.6", r["name"],
                             f"Allow rule '{r['name']}' permits traffic from Any source.",
                             "Restrict the source to the specific networks/hosts that require access.",
                             details=f"Source: {r['source']}", line=r["num"])
            if _has_any(r["destination"]):
                self._issue("HIGH", "Rule Allows Any Destination", "3.5", r["name"],
                             f"Allow rule '{r['name']}' permits traffic to Any destination.",
                             "Restrict the destination to the specific networks/hosts/services required.",
                             details=f"Destination: {r['destination']}", line=r["num"])
            if _has_any(r["services"]):
                self._issue("HIGH", "Rule Allows Any Service", "3.7", r["name"],
                             f"Allow rule '{r['name']}' permits Any service/application.",
                             "Restrict the rule to the specific services/applications required.",
                             details=f"Services: {r['services']}", line=r["num"])
            track = r["track"].strip().lower()
            if track in ("", "none", "log disabled", "no log"):
                self._issue("MEDIUM", "Allow Rule Not Logging", "3.8", r["name"],
                             f"Allow rule '{r['name']}' does not have logging (Track) enabled.",
                             "Set Track to Log (or Detailed/Extended Log) on every allow rule.",
                             details=f"Track: {r['track'] or '(blank)'}", line=r["num"])
        self._native_ids |= {"3.5", "3.6", "3.7", "3.8"}

        # 3.2 — a default drop/cleanup rule should be the last rule in the base.
        if active:
            last = active[-1]
            is_cleanup = (_is_drop(last["action"]) and _has_any(last["source"])
                          and _has_any(last["destination"]) and _has_any(last["services"]))
            if not is_cleanup:
                desc, sol = self._catalog_text("3.2")
                self._issue("HIGH", "No Default Drop/Cleanup Rule", "3.2", "(rulebase)",
                             desc or "The last rule in the rulebase does not explicitly drop all "
                             "traffic not matched by an earlier rule.",
                             sol or "Add an explicit Any/Any/Any Drop rule (with logging) as the "
                             "final rule in the rulebase.",
                             details=f"Last rule: '{last['name']}' — action={last['action']}, "
                             f"source={last['source']}, destination={last['destination']}, "
                             f"services={last['services']}")
        self._native_ids.add("3.2")

        # 3.4 — Hit Count column present and populated for at least one rule.
        has_hits = any(r["hits"].strip() for r in active)
        if not has_hits:
            desc, sol = self._catalog_text("3.4")
            self._issue("LOW", "No Hit Count Data", "3.4", "(rulebase)",
                         desc or "No rule in the exported rulebase shows Hit Count data.",
                         sol or "Enable Hit Count under SmartConsole > Global Properties, and "
                         "review it periodically to find and remove unused rules.")
        self._native_ids.add("3.4")

    # ── CIS Check Point Firewall Benchmark checks (need the Gaia config) ────
    def _run_cis_checks(self):
        tar_path = _find_audits_tar()
        if not tar_path:
            print("[!] audits.tar.gz not found — skipping CIS Check Point Firewall Benchmark checks.")
            return
        self.audits_tar_path = tar_path

        members = {
            "L1": "portal_audits/CheckPoint_Compliance/CIS_Check_Point_Firewall_Level_1_v1.1.0.audit",
            "L2": "portal_audits/CheckPoint_Compliance/CIS_Check_Point_Firewall_Level_2_v1.1.0.audit",
        }
        raw_items: list[dict] = []
        with tarfile.open(tar_path, "r:*") as tf:
            for level, member in members.items():
                try:
                    f = tf.extractfile(member)
                except KeyError:
                    f = None
                if f is None:
                    print(f"[!] {member} not found inside {tar_path} — skipping {level} checks.")
                    continue
                content = f.read().decode("utf-8", errors="replace")
                raw_items.extend(_parse_checkpoint_audit(content, level))
                if level == "L1":
                    self.cis_l1_audit_used = os.path.basename(member)
                else:
                    self.cis_l2_audit_used = os.path.basename(member)

        self.catalog = raw_items

        groups: dict[str, list[dict]] = defaultdict(list)
        for it in raw_items:
            groups[it["id"]].append(it)

        def _sort_key(k):
            return [int(p) for p in k.split(".")]

        for base_id in sorted(groups.keys(), key=_sort_key):
            if base_id in self._native_ids:
                continue  # already given a definitive, evidence-based verdict from the rulebase CSV
            subitems = groups[base_id]
            title = subitems[0]["title"]
            # Multi-part checks share one title with a ' - <sub-label>' suffix
            # that differs per sub-item (e.g. '... - history-checking' /
            # '... - history-length') — the umbrella title is the shared prefix.
            umbrella_title = title.split(" - ", 1)[0] if len(subitems) > 1 else title
            level = subitems[0]["level"]
            info = subitems[0]["info"]
            solution = subitems[0]["solution"]
            cis_ids, pci_ids = _refs_from_reference(subitems[0]["reference"])
            severity = _severity_for(base_id)

            automated = [s for s in subitems
                         if s["kind"] == "custom_item" and s["regex"]
                         and s["expect"] != "Manual Review Required"]

            if not automated:
                # Manual-review / conditionally-evaluated item — the benchmark
                # (or Nessus itself) can't determine this from a static config
                # capture alone.
                self._issue(severity,
                             f"CIS {base_id} — Manual Review Required", base_id,
                             f"[{level}] {umbrella_title}",
                             info or "This control requires manual review — it isn't derivable "
                             "from a static Gaia configuration capture (it lives in the SmartConsole "
                             "database / Global Properties, or needs judgment calls Nessus itself "
                             "doesn't automate either).",
                             solution or "Review the Check Point CIS Benchmark control by hand in "
                             "SmartConsole.",
                             cis_ids=cis_ids, pci_ids=pci_ids)
                continue

            failures = []
            var_note = False
            for s in automated:
                result = _eval_config_check(s, self.gaia_lines)
                if result["had_vars"]:
                    var_note = True
                if result["status"] == "FAIL":
                    sub_label = s["title"].split(" - ", 1)[-1] if " - " in s["title"] else ""
                    ev = f"'{result['text']}' (line {result['line']})" if result["text"] else "not configured"
                    failures.append(f"{sub_label + ': ' if sub_label else ''}{ev}")

            if failures:
                desc = info or f"{umbrella_title} — one or more required settings are not configured correctly."
                details = "; ".join(failures)
                if var_note:
                    details += "  [expected value depends on your environment — verify against your DNS/NTP/AAA/SNMP/timezone/banner text]"
                self._issue(severity, f"CIS {base_id} — {umbrella_title}", base_id,
                             f"[{level}] {umbrella_title}", desc,
                             solution or "See the CIS Check Point Firewall Benchmark for remediation steps.",
                             details=details, cis_ids=cis_ids, pci_ids=pci_ids)
            elif var_note:
                # Passed, but the expected value was a site-specific variable —
                # surface an informational note so it gets a human look.
                self._issue("INFO", f"CIS {base_id} — Verify Environment-Specific Value", base_id,
                             f"[{level}] {umbrella_title}",
                             f"{umbrella_title} is configured — confirm the configured value "
                             "(DNS/NTP/AAA server, timezone, or banner text) is actually correct "
                             "for your environment.",
                             "No action needed if the value shown is correct.",
                             cis_ids=cis_ids, pci_ids=pci_ids)


# ══════════════════════════════════════════════════════════════════════════
class ExcelReporter:
    SEV_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
    SEV_COLORS = {
        "CRITICAL": (C["critical"], C["critical_l"]),
        "HIGH":     (C["high"],     C["high_l"]),
        "MEDIUM":   (C["medium"],   C["medium_l"]),
        "LOW":      (C["low"],      C["low_l"]),
        "INFO":     (C["info"],     C["info_l"]),
    }

    def __init__(self, parser: CheckpointParser, output_file: str):
        self.p = parser
        self.out = output_file
        self.wb = openpyxl.Workbook()
        self.wb.remove(self.wb.active)
        self._vulns = _find_vulns_file()

    # ── Sheet helpers ────────────────────────────────────────────────────────
    def _hdr(self, ws, headers, row=1):
        for col, h in enumerate(headers, 1):
            c = ws.cell(row=row, column=col, value=h)
            c.fill = _fill(C["hdr_bg"])
            c.font = _font(bold=True, color=C["hdr_fg"])
            c.alignment = _align("center", wrap=False)
            c.border = THIN
        ws.row_dimensions[row].height = 28

    def _row_fill(self, row_idx, disabled=False):
        if disabled:
            return C["info_l"]
        return C["alt_row"] if row_idx % 2 == 0 else None

    def _set_widths(self, ws, widths):
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w

    # ── Summary ───────────────────────────────────────────────────────────────
    def _sheet_summary(self):
        ws = self.wb.create_sheet("Summary", 0)
        ws.sheet_view.showGridLines = False

        ws.merge_cells("A1:F1")
        c = ws["A1"]
        c.value = "Check Point Firewall — Configuration Security Report"
        c.font = Font(name="Calibri", bold=True, size=16, color="FFFFFF")
        c.fill = _fill(C["hdr_bg"])
        c.alignment = _align("center", wrap=False)
        ws.row_dimensions[1].height = 42

        ws.merge_cells("A2:F2")
        c = ws["A2"]
        c.value = (f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}    "
                   f"Source: {self.p.source_label}")
        c.font = _font(italic=True, color="595959", size=9)
        c.fill = _fill("F2F2F2")
        c.alignment = _align("center", wrap=False)
        ws.row_dimensions[2].height = 18

        row = 4
        p = self.p

        def section_header(label):
            nonlocal row
            ws.cell(row=row, column=1).value = label
            ws.cell(row=row, column=1).font = _font(bold=True, color=C["hdr_bg"], size=12)
            row += 1

        def kv(label, value):
            nonlocal row
            c1 = ws.cell(row=row, column=1, value=label)
            c1.font = _font()
            c1.alignment = _align()
            c2 = ws.cell(row=row, column=2, value=value)
            c2.font = _font(bold=True)
            c2.alignment = _align("center")
            if row % 2 == 0:
                c1.fill = c2.fill = _fill(C["alt_row"])
            row += 1

        section_header("CONFIGURATION OVERVIEW")
        kv("Gaia config supplied", "yes" if p.config_file else "no")
        if p.config_file:
            kv("Gaia config statements parsed", len(p.gaia_lines))
            kv("audits.tar.gz used", p.audits_tar_path or "not found")
            kv("CIS Benchmark — L1 .audit", p.cis_l1_audit_used or "n/a")
            kv("CIS Benchmark — L2 .audit", p.cis_l2_audit_used or "n/a")
        else:
            kv("CIS Benchmark checks", "skipped — no Gaia config supplied")
        kv("Rules CSV supplied", "yes" if p.rules_csv else "no")
        if p.rules_csv:
            kv("Rulebase rows", len(p.security_rules))
            kv("  Active", sum(1 for r in p.security_rules if r["enabled"]))
            kv("  Disabled", sum(1 for r in p.security_rules if not r["enabled"]))
            kv("  Allow", sum(1 for r in p.security_rules if _is_allow(r["action"])))
        row += 1

        section_header("SECURITY FINDINGS BY SEVERITY")
        self._hdr(ws, ["Severity", "Count"], row=row)
        row += 1
        total = 0
        for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"):
            cnt = sum(1 for i in p.issues if i["severity"] == sev)
            total += cnt
            fg, bg = self.SEV_COLORS[sev]
            c1 = ws.cell(row=row, column=1, value=sev)
            c1.fill = _fill(bg); c1.font = _font(bold=True, color=fg)
            c1.alignment = _align("center"); c1.border = THIN
            c2 = ws.cell(row=row, column=2, value=cnt)
            c2.fill = _fill(bg); c2.font = _font(bold=True, color=fg)
            c2.alignment = _align("center"); c2.border = THIN
            row += 1
        c1 = ws.cell(row=row, column=1, value="TOTAL")
        c1.font = _font(bold=True); c1.border = THIN
        c2 = ws.cell(row=row, column=2, value=total)
        c2.font = _font(bold=True); c2.border = THIN
        c2.alignment = _align("center")
        row += 2

        section_header("FINDINGS BY CATEGORY")
        self._hdr(ws, ["Category", "Count"], row=row)
        row += 1
        cat_counts: dict[str, int] = defaultdict(int)
        for iss in p.issues:
            cat_counts[iss["category"]] += 1
        for cat, cnt in sorted(cat_counts.items(), key=lambda x: -x[1]):
            ws.cell(row=row, column=1, value=cat).font = _font()
            c2 = ws.cell(row=row, column=2, value=cnt)
            c2.font = _font(bold=True)
            c2.alignment = _align("center")
            if row % 2 == 0:
                ws.cell(row=row, column=1).fill = _fill(C["alt_row"])
                c2.fill = _fill(C["alt_row"])
            row += 1

        self._set_widths(ws, [46, 15, 15, 15, 15, 15])

    # ── Gaia Configuration ───────────────────────────────────────────────────
    def _sheet_gaia_config(self):
        ws = self.wb.create_sheet("Gaia Configuration")
        ws.sheet_view.showGridLines = False
        if not self.p.config_file:
            ws["A1"] = "No Gaia 'show configuration' capture was supplied."
            ws["A1"].font = _font(italic=True, color=C["info"])
            return
        headers = ["Setting", "Value / Config Line", "Line #"]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        row = 2
        for label, (value, ln) in self.p.system.items():
            row_bg = self._row_fill(row)
            for col, val in enumerate([label, value, ln or ""], 1):
                c = ws.cell(row=row, column=col, value=val)
                c.border = THIN
                c.font = _font(bold=(col == 1))
                c.alignment = _align("center" if col == 3 else "left")
                if row_bg:
                    c.fill = _fill(row_bg)
            row += 1
        self._set_widths(ws, [28, 60, 10])

    # ── Security rules ────────────────────────────────────────────────────────
    def _sheet_security_rules(self):
        ws = self.wb.create_sheet("Security Rules")
        ws.sheet_view.showGridLines = False
        if not self.p.rules_csv:
            ws["A1"] = ("No rulebase CSV was supplied — export the Rule Base from SmartConsole "
                        "(right-click the rule base > Export to CSV) and pass it via --rules-csv "
                        "to populate this sheet and the rulebase-shaped CIS Benchmark checks "
                        "(3.2, 3.4–3.8).")
            ws["A1"].font = _font(italic=True, color=C["info"])
            ws.column_dimensions["A"].width = 110
            return
        headers = ["#", "Name", "Status", "Source", "Destination", "VPN", "Services & Applications",
                   "Action", "Track", "Install On", "Time", "Hits", "Comments"]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"

        for i, r in enumerate(self.p.security_rules, 1):
            row = i + 1
            disabled = not r["enabled"]
            row_bg = self._row_fill(row, disabled)
            action = (r["action"] or "").strip().lower()
            action_bg = C["allow_l"] if _is_allow(action) else (C["deny_l"] if _is_drop(action) else row_bg)
            action_fg = C["allow"] if _is_allow(action) else (C["deny"] if _is_drop(action) else "000000")

            values = [r["num"], r["name"], "Disabled" if disabled else "Active",
                      r["source"], r["destination"], r["vpn"], r["services"],
                      r["action"].upper(), r["track"], r["install_on"], r["time"], r["hits"], r["comments"]]
            for col, val in enumerate(values, 1):
                c = ws.cell(row=row, column=col, value=val)
                c.border = THIN
                if col == 8:
                    c.fill = _fill(action_bg)
                    c.font = _font(bold=True, color=action_fg)
                    c.alignment = _align("center")
                elif col in (1, 3):
                    c.font = _font(bold=(col == 1))
                    c.alignment = _align("center")
                    if row_bg:
                        c.fill = _fill(row_bg)
                else:
                    c.font = _font()
                    c.alignment = _align()
                    if row_bg:
                        c.fill = _fill(row_bg)
            ws.row_dimensions[row].height = 30
        self._set_widths(ws, [5, 24, 10, 26, 26, 12, 30, 10, 12, 16, 12, 10, 34])

    # ── Security Issues ──────────────────────────────────────────────────────
    def _sheet_issues(self):
        ws = self.wb.create_sheet("Security Issues")
        ws.sheet_view.showGridLines = False
        headers = ["#", "Validated", "Severity", "Category", "Rule / Object", "Config Line(s)",
                   "CIS Controls v7", "CIS Benchmark ID", "PCI DSS",
                   "Description", "Recommendation", "Details", "Vuln", "Source"]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"

        source = self.p.source_label
        sorted_issues = sorted(self.p.issues, key=lambda x: self.SEV_ORDER.get(x["severity"], 9))
        for idx, iss in enumerate(sorted_issues, 1):
            row = idx + 1
            sev = iss["severity"]
            fg, bg = self.SEV_COLORS[sev]
            row_bg = self._row_fill(row)
            vuln_id = CATEGORY_VULN_ID.get(iss["category"])
            vuln = self._vulns.get(vuln_id, "") if vuln_id else ""

            values = [idx, "Y", sev, iss["category"], iss["rule_name"], iss.get("line", ""),
                      iss.get("cis_controls", ""), iss.get("cis_benchmark", ""), iss.get("pci_dss", ""),
                      iss["description"], iss["recommendation"], iss.get("details", ""), vuln, source]
            for col, val in enumerate(values, 1):
                c = ws.cell(row=row, column=col, value=val)
                c.border = THIN
                if col == 3:
                    c.fill = _fill(bg); c.font = _font(bold=True, color=fg); c.alignment = _align("center")
                elif col in (1, 6, 8):
                    c.font = _font(bold=(col == 1)); c.alignment = _align("center")
                    if row_bg:
                        c.fill = _fill(row_bg)
                elif col == 7:
                    c.font = _font(bold=True, color="17375E", size=9); c.alignment = _align("center")
                    if row_bg:
                        c.fill = _fill(row_bg)
                elif col == 9:
                    c.font = _font(bold=True, color="7B2D8B", size=9); c.alignment = _align("center")
                    if row_bg:
                        c.fill = _fill(row_bg)
                elif col == 2:
                    c.font = _font(bold=True); c.alignment = _align("center")
                    if row_bg:
                        c.fill = _fill(row_bg)
                else:
                    c.font = _font(); c.alignment = _align()
                    if row_bg:
                        c.fill = _fill(row_bg)
            ws.row_dimensions[row].height = 40
        self._set_widths(ws, [4, 10, 12, 40, 24, 12, 18, 16, 16, 55, 55, 50, 44, 26])

    # ── Ticketing Export ──────────────────────────────────────────────────────
    def _sheet_export(self):
        ws = self.wb.create_sheet("Export")
        ws.sheet_view.showGridLines = False
        headers = ["Hostname", "line#", "protocol", "port", "output"]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        hostname = self.p.system.get("Hostname", ("", 0))[0]
        sorted_issues = sorted(self.p.issues, key=lambda x: self.SEV_ORDER.get(x["severity"], 9))
        for idx, iss in enumerate(sorted_issues, 1):
            row = idx + 1
            output_text = f"{iss['rule_name']}\n{iss['description']}\n{iss['recommendation']}"
            values = [hostname, iss.get("line", ""), "tcp", 0, output_text]
            row_bg = self._row_fill(row)
            for col, val in enumerate(values, 1):
                c = ws.cell(row=row, column=col, value=val)
                c.border = THIN
                c.font = _font()
                c.alignment = _align("left" if col == 5 else "center", wrap=(col == 5))
                if row_bg:
                    c.fill = _fill(row_bg)
            ws.row_dimensions[row].height = 60
        self._set_widths(ws, [24, 10, 10, 8, 80])

    # ── CIS Controls v7 Mapping ──────────────────────────────────────────────
    def _sheet_cis_mapping(self):
        ws = self.wb.create_sheet("CIS Controls Mapping")
        ws.sheet_view.showGridLines = False
        ws.merge_cells("A1:F1")
        t = ws["A1"]
        t.value = "CIS Controls v7 — Finding Cross-Reference"
        t.font = Font(name="Calibri", bold=True, size=14, color="FFFFFF")
        t.fill = _fill(C["hdr_bg"])
        t.alignment = _align("center", wrap=False)
        ws.row_dimensions[1].height = 36
        ws.merge_cells("A2:F2")
        s = ws["A2"]
        s.value = ("Each CIS Control lists all findings from this config that map to it "
                   "(per the CIS Check Point Firewall Benchmark's own reference data).")
        s.font = _font(italic=True, color=C["info"], size=9)
        s.fill = _fill("F2F2F2")
        s.alignment = _align("center", wrap=False)
        ws.row_dimensions[2].height = 16

        ctrl_issues: dict[str, list[dict]] = defaultdict(list)
        for iss in self.p.issues:
            for cid in iss.get("cis_ids", []):
                ctrl_issues[cid].append(iss)

        def _sort_key(k):
            parts = k.split(".")
            return (int(parts[0]), float("0." + parts[1]) if len(parts) > 1 else 0)

        row = 4
        for ctrl_id in sorted(CIS_CTRL_DESC.keys(), key=_sort_key):
            ctrl_desc = CIS_CTRL_DESC[ctrl_id]
            issues_for_ctrl = sorted(ctrl_issues.get(ctrl_id, []),
                                      key=lambda x: self.SEV_ORDER.get(x["severity"], 9))
            ws.merge_cells(f"A{row}:F{row}")
            hc = ws.cell(row=row, column=1, value=f"CIS {ctrl_id} — {ctrl_desc}")
            hc.font = Font(name="Calibri", bold=True, size=11, color="FFFFFF")
            hc.fill = _fill("17375E")
            hc.alignment = _align("left", wrap=False)
            hc.border = THIN
            ws.row_dimensions[row].height = 22
            row += 1
            row = self._mapping_rows(ws, row, issues_for_ctrl)
            row += 1
        self._set_widths(ws, [12, 40, 24, 14, 55, 55])

    # ── PCI DSS v4.0 Mapping ─────────────────────────────────────────────────
    def _sheet_pci_mapping(self):
        ws = self.wb.create_sheet("PCI DSS Mapping")
        ws.sheet_view.showGridLines = False
        PCI_HDR = "5C1A8C"
        ws.merge_cells("A1:F1")
        t = ws["A1"]
        t.value = "PCI DSS v4.0 — Finding Cross-Reference"
        t.font = Font(name="Calibri", bold=True, size=14, color="FFFFFF")
        t.fill = _fill(PCI_HDR)
        t.alignment = _align("center", wrap=False)
        ws.row_dimensions[1].height = 36
        ws.merge_cells("A2:F2")
        s = ws["A2"]
        s.value = "Each PCI DSS v4.0 requirement lists all findings from this config that map to it."
        s.font = _font(italic=True, color=C["info"], size=9)
        s.fill = _fill("F2F2F2")
        s.alignment = _align("center", wrap=False)
        ws.row_dimensions[2].height = 16

        req_issues: dict[str, list[dict]] = defaultdict(list)
        for iss in self.p.issues:
            for pid in iss.get("pci_ids", []):
                req_issues[pid].append(iss)

        row = 4
        for req_id in sorted(PCI_DSS_DESC.keys(), key=lambda x: [int(p) for p in x.split(".")]):
            desc = PCI_DSS_DESC[req_id]
            issues_for_req = sorted(req_issues.get(req_id, []),
                                     key=lambda x: self.SEV_ORDER.get(x["severity"], 9))
            count = len(issues_for_req)
            ws.merge_cells(f"A{row}:F{row}")
            hc = ws.cell(row=row, column=1,
                         value=f"PCI DSS {req_id}  [{count} finding{'s' if count != 1 else ''}]  {desc}")
            hc.font = Font(name="Calibri", bold=True, size=11, color="FFFFFF")
            hc.fill = _fill(PCI_HDR)
            hc.alignment = _align("left", wrap=False)
            hc.border = THIN
            ws.row_dimensions[row].height = 28
            row += 1
            row = self._mapping_rows(ws, row, issues_for_req)
            row += 1
        self._set_widths(ws, [12, 40, 24, 14, 55, 55])

    def _mapping_rows(self, ws, row, issues_for):
        if not issues_for:
            ws.merge_cells(f"A{row}:F{row}")
            nc = ws.cell(row=row, column=1, value="No findings for this control/requirement")
            nc.font = _font(italic=True, color=C["info"])
            nc.fill = _fill("F9F9F9")
            nc.alignment = _align()
            nc.border = THIN
            return row + 1

        sub_hdrs = ["Severity", "Category", "Rule / Object", "Config Line(s)", "Description", "Recommendation"]
        for col, h in enumerate(sub_hdrs, 1):
            c = ws.cell(row=row, column=col, value=h)
            c.font = _font(bold=True, color="FFFFFF")
            c.fill = _fill("2E4057")
            c.alignment = _align("center", wrap=False)
            c.border = THIN
        ws.row_dimensions[row].height = 20
        row += 1
        for iss in issues_for:
            sev = iss["severity"]
            fg, bg = self.SEV_COLORS[sev]
            rb = C["alt_row"] if row % 2 == 0 else None
            vals = [sev, iss["category"], iss["rule_name"], iss.get("line", ""),
                    iss["description"], iss["recommendation"]]
            for col, val in enumerate(vals, 1):
                c = ws.cell(row=row, column=col, value=val)
                c.border = THIN
                if col == 1:
                    c.fill = _fill(bg); c.font = _font(bold=True, color=fg); c.alignment = _align("center")
                elif col == 4:
                    c.font = _font(color=C["info"], size=9); c.alignment = _align("center")
                    if rb:
                        c.fill = _fill(rb)
                else:
                    c.font = _font(); c.alignment = _align()
                    if rb:
                        c.fill = _fill(rb)
            ws.row_dimensions[row].height = 36
            row += 1
        return row

    # ── Save ──────────────────────────────────────────────────────────────────
    def save(self):
        self._sheet_summary()
        self._sheet_gaia_config()
        self._sheet_security_rules()
        self._sheet_issues()
        self._sheet_export()
        self._sheet_cis_mapping()
        self._sheet_pci_mapping()
        self.wb.save(self.out)


# ── CLI entry point ───────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(
        description="Check Point Firewall Config Analyzer — outputs Excel report",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python checkpoint_analyzer.py "show configuration.txt"
  python checkpoint_analyzer.py "show configuration.txt" --rules-csv rulebase.csv
  python checkpoint_analyzer.py "show configuration.txt" -o audit-$(date +%%Y%%m%%d).xlsx
  python checkpoint_analyzer.py rulebase.csv
""",
    )
    ap.add_argument("config",
                     help="Gaia 'show configuration' (or 'show configuration all') clish CLI "
                          "text capture — e.g. a PuTTY/SecureCRT session log from the gateway "
                          "or management server. On its own, with no rulebase CSV, only the "
                          "CIS Check Point Firewall Benchmark (Gaia OS-level) checks run — the "
                          "access rulebase lives on the Management Server, not in Gaia's config. "
                          "A '.csv' file passed here is routed to --rules-csv automatically and "
                          "runs rulebase checks only.")
    ap.add_argument("-o", "--output", default=None,
                     help="Output Excel file (default: <config-stem>_analysis.xlsx)")
    ap.add_argument("--rules-csv", default=None,
                     help="SmartConsole Rule Base 'Export to CSV' (No., Name, Source, "
                          "Destination, VPN, Services & Applications, Action, Track, Install On, "
                          "Time, Comments, ...). Populates the Security Rules sheet and the "
                          "rulebase-shaped CIS Benchmark checks (3.2, 3.4–3.8).")
    args = ap.parse_args()

    config_file = args.config
    rules_csv = args.rules_csv
    if config_file.lower().endswith(".csv"):
        if rules_csv and os.path.abspath(rules_csv) != os.path.abspath(config_file):
            sys.exit("Both a .csv positional and --rules-csv were given — pass the Gaia config "
                      "as the positional and the CSV via --rules-csv.")
        rules_csv, config_file = config_file, None

    if not args.output:
        stem = os.path.splitext(os.path.basename(args.config))[0]
        args.output = f"{stem}_analysis.xlsx"

    print(f"[*] Parsing: {args.config}")
    parser = CheckpointParser(config_file, rules_csv=rules_csv)
    parser.parse()

    sev_counts: dict[str, int] = defaultdict(int)
    for iss in parser.issues:
        sev_counts[iss["severity"]] += 1

    print("[*] Parsed:")
    print(f"      Gaia config statements: {len(parser.gaia_lines)}")
    print(f"      Rulebase rows         : {len(parser.security_rules)}")
    print(f"[*] Security findings: {len(parser.issues)}")
    for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"):
        if sev_counts[sev]:
            print(f"      {sev:<10}: {sev_counts[sev]}")

    print("[*] Writing Excel report...")
    reporter = ExcelReporter(parser, args.output)
    reporter.save()
    print(f"[+] Saved: {args.output}")


if __name__ == "__main__":
    main()
