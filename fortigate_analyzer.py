#!/usr/bin/env python3
"""
FortiGate Firewall Configuration Analyzer
Parses a FortiOS configuration (a System > Configuration > Backup file, or a
'show' / 'show full-configuration' CLI capture) from FortiOS 7.x — written and
tested for 7.6 — checks it against the CIS FortiGate Benchmark L1/L2 plus
the repo's own vendor-neutral checks (vulns.txt), maps every finding to
CIS Controls v8.1, PCI DSS v4.0.1 and SCF, and exports findings + an
inventory of the config to Excel (same layout as pa_analyzer.py /
checkpoint_analyzer.py).

CIS benchmark: the newest CIS FortiGate benchmark is 7.4.x v1.0.1 (no 7.6.x
benchmark has been published yet). Its titles, rationale, remediation and
reference data come from the Tenable .audit files bundled in audits.tar.gz
(portal_audits/Fortigate/CIS_FortiGate_7.4.x_v1.0.1_L1/L2.audit). The checks
themselves are evaluated natively here, not by replaying the .audit regexes:
a FortiOS backup / 'show' only lists settings that differ from the factory
default, so a regex that demands e.g. 'set strong-crypto enable' false-FAILs
on every box that simply kept the (secure) default. Each check below knows
the FortiOS 7.6 default for the settings it reads (FORTIOS_DEFAULTS).

Usage:
    python fortigate_analyzer.py FGT01.conf
    python fortigate_analyzer.py FGT01.conf -o audit.xlsx
    python fortigate_analyzer.py FGT01.conf --wan-intf port1 --wan-intf port9
    python fortigate_analyzer.py ./configs/                 # batch mode
"""

import json
import re
import os
import sys
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


_VULNS: "dict[int, str] | None" = None


def _find_vulns_file() -> dict[int, str]:
    global _VULNS
    if _VULNS is not None:
        return _VULNS
    for path in (os.path.join(os.path.dirname(os.path.abspath(__file__)), "vulns.txt"),
                 os.path.join(os.getcwd(), "vulns.txt")):
        vulns = _load_vulns(path)
        if vulns:
            _VULNS = vulns
            return vulns
    print("[!] Warning: vulns.txt not found — Vuln column will be empty. "
          "Place vulns.txt alongside fortigate_analyzer.py.")
    _VULNS = {}
    return _VULNS


# ── vuln_controls.json (canonical framework controls per vulns.txt entry) ───
_VULN_CONTROLS: "dict[int, dict] | None" = None


def _vuln_controls() -> "dict[int, dict]":
    """vulns.txt line ID → {"cis_v8", "pci_dss", "scf"} from vuln_controls.json,
    so a finding mapped to a vuln reports the same CIS Controls / PCI DSS /
    SCF IDs as the Palo Alto and Check Point analyzers do. Entries whose
    "vuln" text no longer matches vulns.txt are skipped."""
    global _VULN_CONTROLS
    if _VULN_CONTROLS is not None:
        return _VULN_CONTROLS
    _VULN_CONTROLS = {}
    vulns = _find_vulns_file()
    for path in (os.path.join(os.path.dirname(os.path.abspath(__file__)), "vuln_controls.json"),
                 os.path.join(os.getcwd(), "vuln_controls.json")):
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
        except (FileNotFoundError, ValueError):
            continue
        stale = []
        for key, entry in data.get("vulns", {}).items():
            vid = int(key)
            if vulns.get(vid, "").casefold() != entry.get("vuln", "").casefold():
                stale.append(vid)
                continue
            _VULN_CONTROLS[vid] = entry
        if stale:
            print(f"[!] Warning: vuln_controls.json entries {stale} don't match vulns.txt — "
                  "those findings use their per-check framework mappings.")
        for cid, desc in data.get("cis_v8_desc", {}).items():
            CIS_CTRL_DESC.setdefault(cid, desc)
        for pid, desc in data.get("pci_dss_desc", {}).items():
            PCI_DSS_DESC.setdefault(pid, desc)
        return _VULN_CONTROLS
    print("[!] Warning: vuln_controls.json not found — framework columns use "
          "per-check mappings. Place vuln_controls.json alongside fortigate_analyzer.py.")
    return _VULN_CONTROLS


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


CIS_AUDIT_MEMBERS = {
    "L1": "portal_audits/Fortigate/CIS_FortiGate_7.4.x_v1.0.1_L1.audit",
    "L2": "portal_audits/Fortigate/CIS_FortiGate_7.4.x_v1.0.1_L2.audit",
}
CIS_BENCHMARK_NAME = "CIS FortiGate 7.4.x Benchmark v1.0.1"


# ── CIS FortiGate 7.4.x v1.0.1 — built-in catalog ────────────────────────────
# ID → (level, title). The .audit files supply rationale/remediation/refs
# when audits.tar.gz is present; this table keeps the analyzer usable (and
# every check titled) without it. 7.3.3 is a duplicate of 7.3.2 in the
# Tenable .audit; here 7.3.2 covers 'syslogd' and 7.3.3 the additional
# syslog servers (syslogd2–4).
CIS_CATALOG: dict[str, tuple[str, str]] = {
    "1.1":     ("L1", "Ensure DNS server is configured"),
    "1.2":     ("L1", "Ensure intra-zone traffic is not always allowed"),
    "1.3":     ("L1", "Disable all management related services on WAN port"),
    "2.1.1":   ("L1", "Ensure 'Pre-Login Banner' is set"),
    "2.1.2":   ("L1", "Ensure 'Post-Login-Banner' is set"),
    "2.1.3":   ("L1", "Ensure timezone is properly configured"),
    "2.1.4":   ("L1", "Ensure correct system time is configured through NTP"),
    "2.1.5":   ("L1", "Ensure hostname is set"),
    "2.1.6":   ("L2", "Ensure the latest firmware is installed"),
    "2.1.7":   ("L2", "Disable USB Firmware and configuration installation"),
    "2.1.8":   ("L2", "Disable static keys for TLS"),
    "2.1.9":   ("L2", "Enable Global Strong Encryption"),
    "2.1.10":  ("L1", "Ensure management GUI listens on secure TLS version"),
    "2.1.11":  ("L2", "Ensure CDN is enabled for improved GUI performance"),
    "2.1.12":  ("L1", "Ensure single CPU core overloaded event is logged"),
    "2.1.13":  ("L2", "Ensure Hostname is Not Displayed On Login GUI"),
    "2.2.1":   ("L1", "Ensure 'Password Policy' is enabled"),
    "2.2.2":   ("L1", "Ensure administrator password retries and lockout time are configured"),
    "2.3.1":   ("L1", "Ensure only SNMPv3 is enabled"),
    "2.3.2":   ("L2", "Allow only trusted hosts in SNMPv3"),
    "2.3.3":   ("L2", "Disable SNMPv3 Query Per User"),
    "2.3.4":   ("L1", "Enabling SNMP trap for memory usage"),
    "2.4.1":   ("L1", "Remove default admin user and create one with other name"),
    "2.4.2":   ("L1", "Ensure all the login accounts having specific trusted hosts enabled"),
    "2.4.3":   ("L1", "Ensure admin accounts with different privileges have their correct profiles assigned"),
    "2.4.4":   ("L1", "Ensure Admin idle timeout time is configured"),
    "2.4.5":   ("L1", "Ensure only encrypted access channels are enabled"),
    "2.4.6":   ("L1", "Apply Local-in Policies"),
    "2.4.7":   ("L1", "Ensure default Admin ports are changed"),
    "2.4.8":   ("L1", "Virtual patching on the local-in management interface"),
    "2.5.1":   ("L2", "Ensure High Availability configuration is enabled"),
    "2.5.2":   ("L1", "Ensure \"Monitor Interfaces\" for High Availability devices is enabled"),
    "2.5.3":   ("L1", "Ensure HA Reserved Management Interface is configured"),
    "2.5.4":   ("L2", "Ensure High Availability Group-ID is configured"),
    "3.1":     ("L2", "Ensure that unused policies are reviewed regularly"),
    "3.2":     ("L1", "Ensure that policies do not use \"ALL\" as Service"),
    "3.3":     ("L1", "Ensure firewall policy denying all traffic to/from Tor, malicious server, or scanner IP addresses using ISDB"),
    "3.4":     ("L1", "Ensure logging is enabled on all firewall policies"),
    "4.1.1":   ("L2", "Detect Botnet connections"),
    "4.1.2":   ("L1", "Apply IPS Security Profile to Policies"),
    "4.2.1":   ("L2", "Ensure Antivirus Definition Push Updates are Configured"),
    "4.2.2":   ("L2", "Apply Antivirus Security Profile to Policies"),
    "4.2.3":   ("L2", "Enable Outbreak Prevention Database"),
    "4.2.4":   ("L2", "Enable AI /heuristic based malware detection"),
    "4.2.5":   ("L2", "Enable grayware detection on antivirus"),
    "4.2.6":   ("L1", "Ensure inline scanning with FortiGuard AI-Based Sandbox Service is enabled"),
    "4.2.7":   ("L2", "Enable CDR for proxy mode on XLSB, OpenOffice, and RTF files"),
    "4.3.1":   ("L2", "Enable Botnet C&C Domain Blocking DNS Filter"),
    "4.3.2":   ("L1", "Ensure DNS Filter logs all DNS queries and responses"),
    "4.3.3":   ("L1", "Apply DNS Filter Security Profile to Policies"),
    "4.4.1":   ("L1", "Create a Web Filtering Profile"),
    "4.5.1":   ("L1", "Block high risk categories on Application Control"),
    "4.5.2":   ("L2", "Block applications running on non-default ports"),
    "4.5.3":   ("L1", "Ensure all Application Control related traffic is logged"),
    "4.5.4":   ("L1", "Apply Application Control Security Profile to Policies"),
    "5.1.1":   ("L1", "Enable Compromised Host Quarantine"),
    "5.2.1.1": ("L2", "Ensure Security Fabric is Configured"),
    "6.1.1":   ("L2", "Apply a Trusted Signed Certificate for VPN Portal"),
    "6.1.2":   ("L2", "Enable Limited TLS Versions for SSL VPN"),
    "7.1.1":   ("L2", "Enable Event Logging"),
    "7.2.1":   ("L2", "Centralized Logging and Reporting"),
    "7.3.1":   ("L1", "Encrypt Log Transmission to FortiAnalyzer / FortiManager"),
    "7.3.2":   ("L1", "Encrypt Log Transmission to Syslog"),
    "7.3.3":   ("L1", "Encrypt Log Transmission to Syslog (additional syslog servers)"),
}


def _id_key(k: str) -> list[int]:
    return [int(p) for p in k.split(".") if p.isdigit()]


# Best-judgment severity per CIS ID (the .audit gives almost none) — by what
# the control actually protects against, same approach as the other analyzers.
SEVERITY_BY_CIS_ID: dict[str, str] = {
    "1.1": "LOW", "1.2": "MEDIUM", "1.3": "HIGH",
    "2.1.1": "LOW", "2.1.2": "LOW", "2.1.3": "LOW", "2.1.4": "MEDIUM", "2.1.5": "LOW",
    "2.1.6": "HIGH", "2.1.7": "MEDIUM", "2.1.8": "MEDIUM", "2.1.9": "HIGH", "2.1.10": "MEDIUM",
    "2.1.11": "INFO", "2.1.12": "LOW", "2.1.13": "LOW",
    "2.2.1": "MEDIUM", "2.2.2": "MEDIUM",
    "2.3.1": "HIGH", "2.3.2": "MEDIUM", "2.3.3": "LOW", "2.3.4": "LOW",
    "2.4.1": "MEDIUM", "2.4.2": "HIGH", "2.4.3": "MEDIUM", "2.4.4": "MEDIUM", "2.4.5": "HIGH",
    "2.4.6": "MEDIUM", "2.4.7": "LOW", "2.4.8": "MEDIUM",
    "2.5.1": "LOW", "2.5.2": "LOW", "2.5.3": "LOW", "2.5.4": "LOW",
    "3.1": "LOW", "3.2": "HIGH", "3.3": "MEDIUM", "3.4": "MEDIUM",
    "4.1.1": "MEDIUM", "4.1.2": "HIGH", "4.2.1": "MEDIUM", "4.2.2": "HIGH", "4.2.3": "LOW",
    "4.2.4": "MEDIUM", "4.2.5": "LOW", "4.2.6": "LOW", "4.2.7": "LOW",
    "4.3.1": "MEDIUM", "4.3.2": "LOW", "4.3.3": "MEDIUM", "4.4.1": "MEDIUM",
    "4.5.1": "MEDIUM", "4.5.2": "LOW", "4.5.3": "LOW", "4.5.4": "MEDIUM",
    "5.1.1": "LOW", "5.2.1.1": "LOW", "6.1.1": "MEDIUM", "6.1.2": "MEDIUM",
    "7.1.1": "MEDIUM", "7.2.1": "HIGH", "7.3.1": "MEDIUM", "7.3.2": "MEDIUM", "7.3.3": "MEDIUM",
}

# CIS benchmark ID → vulns.txt line ID. Direct associations only: a CIS
# item gets a vuln only when its failure IS that vulns.txt entry (same
# conventions as pa_analyzer.py, e.g. "profile not applied" → 31 Missing
# Security Profile, weak TLS/cipher → 33). Items with no exact counterpart
# in vulns.txt (trusted hosts, local-in policies, default admin ports, HA
# group-id/monitor, ISDB deny policies, app-category blocking, host
# quarantine, Security Fabric, GUI CDN/hostname, SNMP memory traps) have
# no entry and leave the Vuln column blank rather than borrow a near one.
# This is the vuln for the item's primary failure; where one CIS item can
# fail for different reasons, the check picks the vuln per failure (see
# CIS_ALT_VULNS), and a PASS-but-verify result never carries a vuln.
VULN_BY_CIS_ID: dict[str, int] = {
    "1.1": 55, "1.2": 44, "1.3": 52,
    "2.1.1": 48, "2.1.2": 46, "2.1.3": 57, "2.1.4": 56, "2.1.5": 4, "2.1.6": 3, "2.1.7": 54,
    "2.1.8": 33, "2.1.9": 33, "2.1.10": 33, "2.1.12": 32,
    "2.2.1": 28, "2.2.2": 27,
    "2.3.1": 53, "2.3.3": 47,
    "2.4.1": 6, "2.4.4": 23, "2.4.5": 40,
    "2.5.1": 49, "2.5.3": 16,
    "3.1": 5, "3.2": 26, "3.4": 32,
    "4.1.1": 22, "4.1.2": 31, "4.2.1": 8, "4.2.2": 31, "4.2.3": 22, "4.2.4": 22, "4.2.5": 22,
    "4.2.6": 22, "4.2.7": 22, "4.3.1": 19, "4.3.2": 32, "4.3.3": 31, "4.4.1": 20,
    "4.5.2": 51, "4.5.3": 32, "4.5.4": 31,
    "6.1.1": 9, "6.1.2": 33,
    "7.1.1": 32, "7.2.1": 24, "7.3.1": 50, "7.3.2": 50, "7.3.3": 50,
}

# Other vulns a CIS item reports for a specific failure reason (documented
# here so the mapping workbook lists every association the code can make):
#   1.1    no secondary DNS only                  → none ("DNS Not Configured" is false)
#   2.1.4  only one NTP server                    → 1  Secondary Ntp Server Not Configured
#   2.1.10 TLS 1.2 still allowed (no 1.0/1.1)     → none (not a weak protocol)
#   2.2.1  only minimum-length < 14               → 15 Minimum password length
#   2.2.2  lockout duration out of range          → 10 Account Lockout Duration Not Configured Or Insufficient
#   2.3.1  SNMP on with no v3 user, no v1/v2c     → none
#   4.1.1  no IPS sensor applied at all           → 31 Missing Security Profile
#   4.3.1  no DNS filter profile applied at all   → 31 Missing Security Profile
#   6.1.2  only ssl-max-proto-ver below tls1-3    → none
#   7.3.1  only 'reliable' disabled (still enc.)  → none
#   7.3.x  encryption 'low'                       → 33 Weak Cipher Suite
CIS_ALT_VULNS: dict[str, list[int]] = {
    "2.1.4": [1], "2.2.1": [15], "2.2.2": [10], "4.1.1": [31], "4.3.1": [31],
    "7.3.1": [33], "7.3.2": [33], "7.3.3": [33],
}
NO_VULN = 0   # explicit "no vulns.txt entry fits this failure" (blank Vuln column)

# ── CIS Controls v8.1 ────────────────────────────────────────────────────────
# Safeguard IDs come from each benchmark item's own CSCv8 reference data in
# the .audit when present; CIS_V8_BY_CIS_ID is the fallback (and covers the
# items the .audit leaves without a CSCv8 reference).
CIS_CTRL_DESC: dict[str, str] = {
    "3.3":   "Configure Data Access Control Lists",
    "3.10":  "Encrypt Sensitive Data in Transit",
    "3.13":  "Deploy a Data Loss Prevention Solution",
    "4.1":   "Establish and Maintain a Secure Configuration Process",
    "4.2":   "Establish and Maintain a Secure Configuration Process for Network Infrastructure",
    "4.3":   "Configure Automatic Session Locking on Enterprise Assets",
    "4.7":   "Manage Default Accounts on Enterprise Assets and Software",
    "4.8":   "Uninstall or Disable Unnecessary Services on Enterprise Assets and Software",
    "4.9":   "Configure Trusted DNS Servers on Enterprise Assets",
    "5.2":   "Use Unique Passwords",
    "5.4":   "Restrict Administrator Privileges to Dedicated Administrator Accounts",
    "6.5":   "Require MFA for Administrative Access",
    "6.7":   "Centralize Access Control",
    "6.8":   "Define and Maintain Role-Based Access Control",
    "7.3":   "Perform Automated Operating System Patch Management",
    "7.4":   "Perform Automated Application Patch Management",
    "7.5":   "Perform Automated Vulnerability Scans of Internal Enterprise Assets",
    "8.1":   "Establish and Maintain an Audit Log Management Process",
    "8.2":   "Collect Audit Logs",
    "8.4":   "Standardize Time Synchronization",
    "8.5":   "Collect Detailed Audit Logs",
    "8.6":   "Collect DNS Query Audit Logs",
    "8.9":   "Centralize Audit Logs",
    "9.2":   "Use DNS Filtering Services",
    "9.3":   "Maintain and Enforce Network-Based URL Filters",
    "10.1":  "Deploy and Maintain Anti-Malware Software",
    "10.2":  "Configure Automatic Anti-Malware Signature Updates",
    "10.6":  "Centrally Manage Anti-Malware Software",
    "10.7":  "Use Behavior-Based Anti-Malware Software",
    "12.2":  "Establish and Maintain a Secure Network Architecture",
    "12.3":  "Securely Manage Network Infrastructure",
    "12.4":  "Establish and Maintain Architecture Diagram(s)",
    "12.6":  "Use of Secure Network Management and Communication Protocols",
    "12.7":  "Ensure Remote Devices Utilize a VPN and are Connecting to an Enterprise's AAA Infrastructure",
    "12.8":  "Establish and Maintain Dedicated Computing Resources for All Administrative Work",
    "13.1":  "Centralize Security Event Alerting",
    "13.3":  "Deploy a Network Intrusion Detection Solution",
    "13.4":  "Perform Traffic Filtering Between Network Segments",
    "13.5":  "Manage Access Control for Remote Assets",
    "13.6":  "Collect Network Traffic Flow Logs",
    "13.7":  "Deploy a Host-Based Intrusion Prevention Solution",
    "13.8":  "Deploy a Network Intrusion Prevention Solution",
    "13.9":  "Deploy Port-Level Access Control",
    "13.10": "Perform Application Layer Filtering",
}

CIS_V8_BY_CIS_ID: dict[str, list[str]] = {
    "1.1": ["4.9"], "1.2": ["13.4"], "1.3": ["4.8"],
    "2.1.1": ["4.1"], "2.1.2": ["4.1"], "2.1.3": ["8.4"], "2.1.4": ["8.4"], "2.1.5": ["4.2"],
    "2.1.6": ["7.3"], "2.1.7": ["4.8"], "2.1.8": ["4.8"], "2.1.9": ["3.10"], "2.1.10": ["3.10"],
    "2.1.11": ["4.2"], "2.1.12": ["8.5"], "2.1.13": ["4.8"],
    "2.2.1": ["5.2"], "2.2.2": ["5.4"],
    "2.3.1": ["12.3"], "2.3.2": ["12.3"], "2.3.3": ["12.6"], "2.3.4": ["8.2"],
    "2.4.1": ["4.7"], "2.4.2": ["5.4", "12.8"], "2.4.3": ["5.4"], "2.4.4": ["5.4"],
    "2.4.5": ["3.10"], "2.4.6": ["3.3", "12.2"], "2.4.7": ["3.3", "12.2"], "2.4.8": ["7.4"],
    "2.5.1": ["12.2"], "2.5.2": ["12.2"], "2.5.3": ["12.3"], "2.5.4": ["12.2"],
    "3.1": ["4.8"], "3.2": ["3.3"], "3.3": ["12.2"], "3.4": ["8.1", "13.6"],
    "4.1.1": ["13.7", "13.8"], "4.1.2": ["7.5"], "4.2.1": ["10.2"], "4.2.2": ["10.1", "10.6"],
    "4.2.3": ["10.1", "10.6"], "4.2.4": ["10.7"], "4.2.5": ["10.1", "10.6"], "4.2.6": ["10.7"],
    "4.2.7": ["10.1"], "4.3.1": ["9.2"], "4.3.2": ["8.6"], "4.3.3": ["9.2"], "4.4.1": ["9.3"],
    "4.5.1": ["13.10"], "4.5.2": ["13.10"], "4.5.3": ["13.6"], "4.5.4": ["3.3"],
    "5.1.1": ["13.5", "13.9"], "5.2.1.1": ["13.1"], "6.1.1": ["12.7"], "6.1.2": ["12.7"],
    "7.1.1": ["8.2", "8.5", "8.9"], "7.2.1": ["8.1", "8.9"],
    "7.3.1": ["3.10"], "7.3.2": ["3.10"], "7.3.3": ["3.10"],
}

# ── PCI DSS v4.0.1 ───────────────────────────────────────────────────────────
# v4.0.1 (June 2024) is the current standard; it kept v4.0's requirement
# numbering, so the .audit's PCI-DSSv4.0 references carry over unchanged.
PCI_DSS_DESC: dict[str, str] = {
    "1.2.1":  "Configuration standards for NSC rulesets are defined, implemented, and maintained",
    "1.2.3":  "An accurate network diagram is maintained",
    "1.2.5":  "All allowed services, protocols, and ports are identified, approved, and have a defined business need",
    "1.2.6":  "Security features are implemented for all insecure services, protocols, and ports in use",
    "1.2.7":  "Configurations of NSCs are reviewed at least once every six months",
    "1.2.8":  "Configuration files for NSCs are secured from unauthorized access and kept consistent",
    "1.3.1":  "Inbound traffic to the CDE is restricted to what is necessary",
    "1.3.2":  "Outbound traffic from the CDE is restricted to what is necessary",
    "1.4.1":  "NSCs are implemented between trusted and untrusted networks",
    "1.4.2":  "Inbound traffic from untrusted networks to trusted networks is restricted",
    "1.4.5":  "The disclosure of internal IP addresses and routing information is limited to only authorized parties",
    "2.2.1":  "Configuration standards are developed, implemented, and maintained",
    "2.2.2":  "Vendor default accounts are managed",
    "2.2.4":  "Only necessary services, protocols, daemons, and functions are enabled",
    "2.2.5":  "If any insecure services, protocols, or daemons are present, business justification is documented and additional security features are implemented",
    "2.2.7":  "All non-console administrative access is encrypted using strong cryptography",
    "4.2.1":  "Strong cryptography and security protocols safeguard PAN during transmission over open, public networks",
    "5.2.1":  "An anti-malware solution is deployed on all system components",
    "5.3.1":  "The anti-malware solution is kept current via automatic updates",
    "6.3":    "Security vulnerabilities are identified and addressed",
    "6.3.1":  "Security vulnerabilities are identified and managed",
    "6.3.3":  "All system components are protected from known vulnerabilities by installing applicable security patches/updates",
    "7.2.1":  "An access control model is defined and includes granting access appropriately",
    "7.2.2":  "Access is assigned to users, including privileged users, based on job classification and function",
    "8.2.8":  "If a user session has been idle for more than 15 minutes, the user is required to re-authenticate",
    "8.3.4":  "Invalid authentication attempts are limited (lock out after not more than 10 attempts, for at least 30 minutes)",
    "8.4.2":  "MFA is implemented for all access into the CDE",
    "10.2.1": "Audit logs are enabled and active for all system components and cardholder data",
    "10.2.2": "Audit logs record all required details for each auditable event",
    "10.3.3": "Audit log files are promptly backed up to a secure, central, internal log server",
    "10.6.1": "System clocks and time are synchronized using time-synchronization technology",
    "10.6.2": "Systems are configured to the correct and consistent time",
    "10.6.3": "Time synchronization settings and data are protected",
    "11.5.1": "Intrusion-detection and/or intrusion-prevention techniques are used to detect and/or prevent intrusions",
}

# Fallback for CIS items whose .audit reference cites no PCI DSS v4.0 ID.
PCI_BY_CIS_ID: dict[str, list[str]] = {
    "1.1": ["2.2.1"], "1.3": ["1.4.2", "2.2.4"],
    "2.1.1": ["2.2.1"], "2.1.2": ["2.2.1"], "2.1.3": ["10.6.2"], "2.1.4": ["10.6.1", "10.6.2"],
    "2.1.5": ["2.2.1"], "2.1.6": ["6.3.3"], "2.1.7": ["2.2.4"], "2.1.8": ["4.2.1"],
    "2.1.9": ["2.2.7", "4.2.1"], "2.1.10": ["2.2.7"], "2.1.11": ["2.2.1"], "2.1.12": ["10.2.1"],
    "2.2.1": ["8.3.6"], "2.3.1": ["2.2.7"], "2.3.2": ["2.2.7"], "2.3.3": ["2.2.7"],
    "2.3.4": ["10.2.1"], "2.4.1": ["2.2.2"], "2.4.5": ["2.2.7"],
    "2.5.1": ["2.2.1"], "2.5.2": ["2.2.1"], "2.5.3": ["2.2.1"], "2.5.4": ["2.2.1"],
    "3.1": ["1.2.7"], "3.4": ["10.2.1"], "4.1.1": ["11.5.1"], "4.2.1": ["5.3.1"],
    "4.2.4": ["5.2.1"], "4.3.1": ["5.2.1"], "4.3.2": ["10.2.1"], "4.3.3": ["5.2.1"],
    "4.4.1": ["1.3.2"], "4.5.3": ["10.2.1"], "5.2.1.1": ["10.2.1"],
    "6.1.1": ["4.2.1"], "6.1.2": ["4.2.1"], "7.1.1": ["10.2.1"], "7.2.1": ["10.3.3"],
}

# ── SCF (Secure Controls Framework) 2026.3 ───────────────────────────────────
# Same SCF release / sub-control granularity as the PA and Check Point
# analyzers. Findings mapped to a vuln use vuln_controls.json's SCF IDs;
# this table covers the rest.
SCF_BY_CIS_ID: dict[str, list[str]] = {
    "1.1": ["NET-13"], "1.2": ["NET-04.1"], "1.3": ["NET-09", "NET-06.1"],
    "2.1.1": ["SEA-28"], "2.1.2": ["SEA-28"], "2.1.3": ["MON-11"], "2.1.4": ["MON-11.1", "SEA-30"],
    "2.1.5": ["AST-03"], "2.1.6": ["VPM-08"], "2.1.7": ["CFG-05.1"], "2.1.8": ["CRY-04"],
    "2.1.9": ["CRY-04", "CRY-05"], "2.1.10": ["CRY-05"], "2.1.11": ["CFG-02"], "2.1.12": ["MON-04"],
    "2.1.13": ["CFG-04"], "2.2.1": ["IAC-15.1"], "2.2.2": ["CFG-04.1"],
    "2.3.1": ["CFG-04.7", "CRY-05"], "2.3.2": ["NET-09"], "2.3.3": ["CFG-04.7"], "2.3.4": ["MON-04"],
    "2.4.1": ["IAC-21"], "2.4.2": ["NET-09", "IAC-21"], "2.4.3": ["IAC-16", "IAC-21"],
    "2.4.4": ["CFG-04.5"], "2.4.5": ["CFG-04.7", "CRY-05"], "2.4.6": ["NET-09", "NET-04.1"],
    "2.4.7": ["CFG-03"], "2.4.8": ["VPM-08"],
    "2.5.1": ["BCD-22"], "2.5.2": ["BCD-22"], "2.5.3": ["NET-09"], "2.5.4": ["BCD-22"],
    "3.1": ["NET-04.2"], "3.2": ["NET-04.1", "CFG-03"], "3.3": ["NET-31", "NET-17"],
    "3.4": ["MON-04", "MON-31"], "4.1.1": ["NET-31"], "4.1.2": ["NET-31"],
    "4.2.1": ["VPM-08.1"], "4.2.2": ["END-04"], "4.2.3": ["END-04"], "4.2.4": ["END-04"],
    "4.2.5": ["END-04"], "4.2.6": ["END-04"], "4.2.7": ["END-04"],
    "4.3.1": ["NET-17", "NET-03.9"], "4.3.2": ["MON-04"], "4.3.3": ["NET-17"], "4.4.1": ["NET-17"],
    "4.5.1": ["NET-04.1"], "4.5.2": ["CFG-03"], "4.5.3": ["MON-04"], "4.5.4": ["NET-04.1"],
    "5.1.1": ["NET-31"], "5.2.1.1": ["MON-02"], "6.1.1": ["CRY-09", "CRY-12"],
    "6.1.2": ["CRY-04", "CRY-05"], "7.1.1": ["MON-04"], "7.2.1": ["MON-05"],
    "7.3.1": ["MON-12.3", "CRY-05"], "7.3.2": ["MON-12.3", "CRY-05"], "7.3.3": ["MON-12.3", "CRY-05"],
}

# Native (non-CIS) checks: category → (vuln ID, CIS v8, PCI DSS, SCF).
# CIS v8 / PCI / SCF here are only the fallback for a vuln missing from
# vuln_controls.json.
NATIVE_CHECKS: dict[str, tuple[int, list[str], list[str], list[str]]] = {
    "Disabled Firewall Policy":                 (36, ["4.2"], ["1.2.7"], ["NET-04.2", "CFG-08"]),
    "Missing Policy Comment":                   (37, ["4.2"], ["1.2.5"], ["NET-04.2"]),
    "Policy Allows Any Source And Destination": (59, ["13.4"], ["1.3.1", "1.3.2"], ["NET-04.1"]),
    "Policy Allows Any Source":                 (25, ["13.4"], ["1.3.1", "1.3.2"], ["NET-04.1"]),
    "Policy Allows Any Destination":            (25, ["13.4"], ["1.3.1", "1.3.2"], ["NET-04.1"]),
    "Policy Permits Insecure Protocol":         (17, ["3.10", "4.8"], ["1.2.6", "4.2.1"], ["CRY-05", "CFG-03"]),
    "Shadowed Firewall Policy":                 (34, ["4.2"], ["1.2.7"], ["NET-04.2"]),
    "Missing Security Profile":                 (31, ["10.1", "13.8"], ["5.2.1", "11.5.1"], ["NET-31", "END-04"]),
    # vulns.txt #18 is about forwarding decrypted traffic for analysis, not
    # whether decryption happens — no direct entry, so no vuln.
    "No Deep SSL Inspection":                   (NO_VULN, ["3.10", "13.3"], ["11.5.1"], ["NET-20.1"]),
    "No Data Loss Prevention Profile":          (21, ["3.13"], ["1.3.2"], ["NET-03.5"]),
    "No User Identity In Policies":             (60, ["6.7"], ["7.2.1"], ["IAC-25"]),
    "Password Policy Disabled (Min Length 8)":  (15, ["5.2"], ["8.3.6"], ["IAC-15.1"]),
    "Password Complexity Not Enforced":         (28, ["5.2"], ["8.3.6"], ["IAC-15.1"]),
    "Password Expiry Not Enforced":             (13, ["5.2"], ["8.3.9"], ["IAC-14.1"]),
    "Password Reuse Allowed":                   (12, ["5.2"], ["8.3.7"], ["IAC-15"]),
    "Admin Lockout Duration Below 30 Minutes":  (11, ["5.2"], ["8.3.4"], ["CFG-04.1"]),
    "NTP Authentication Not Configured":        (7, ["8.4"], ["10.6.3"], ["MON-11.1", "CRY-06"]),
    "Default SNMP Community Name":              (2, ["4.7"], ["2.2.2"], ["IAC-14.4"]),
    "Weak SNMPv3 Authentication":               (39, ["12.6"], ["2.2.7"], ["CFG-04.7"]),
    "Weak SNMPv3 Encryption":                   (33, ["3.10"], ["2.2.7"], ["CRY-05"]),
    "Admin Without MFA":                        (39, ["6.5"], ["8.4.2"], ["IAC-06"]),
    "Weak IPsec Proposal":                      (33, ["3.10"], ["4.2.1"], ["CRY-04", "CRY-05"]),
    "Weak IPsec DH Group":                      (33, ["3.10"], ["4.2.1"], ["CRY-04", "CRY-05"]),
    "IKEv1 Aggressive Mode":                    (39, ["3.10"], ["4.2.1"], ["CRY-05"]),
    "IPsec PFS Disabled":                       (35, ["3.10"], ["4.2.1"], ["CRY-04", "CRY-05"]),
    "Weak SSH Algorithms":                      (33, ["3.10"], ["2.2.7"], ["CRY-05"]),
    "Self-Signed Admin GUI Certificate":        (9, ["3.10"], ["4.2.1"], ["CRY-09", "CRY-12"]),
    "Syslog Over UDP":                          (38, ["3.10"], ["10.3.2"], ["MON-12.3"]),
    "Log Server Certificate Not Verified":      (61, ["12.6"], ["4.2.1"], ["CHG-13"]),
    "LDAP Server Identity Not Verified":        (61, ["12.6"], ["4.2.1"], ["CHG-13"]),
    "LDAP Without TLS":                         (40, ["12.6"], ["2.2.7"], ["CRY-05"]),
    "Interface Missing Description":            (45, ["12.4"], ["1.2.3"], ["AST-17"]),
    "Unused Interface Not Shut Down":           (43, ["4.8"], ["2.2.4"], ["CFG-03"]),
}


def _cis_label(ids: list[str]) -> str:
    return " · ".join(f"CIS {i}" for i in ids)


def _pci_label(ids: list[str]) -> str:
    return " · ".join(f"PCI {i}" for i in ids)


def _scf_label(ids: list[str]) -> str:
    return " · ".join(ids)


def _refs_from_reference(reference: str, tag: str) -> list[str]:
    """IDs for one framework tag (e.g. 'CSCv8', 'PCI-DSSv4.0') from a .audit
    'reference' field, numerically sorted."""
    ids = set(re.findall(rf'(?:^|,){re.escape(tag)}\|([\d.]+)', reference))
    return sorted(ids, key=_id_key)


# ── CIS .audit catalog parser ────────────────────────────────────────────────
def _extract_quoted(field: str, block: str) -> "str | None":
    m = re.search(rf'(?m)^\s*{field}\s*:\s*"((?:[^"\\]|\\.)*)"', block, re.DOTALL)
    if not m:
        return None
    return m.group(1).replace('\\\\\\"', '"').replace('\\"', '"').replace("\\\\", "\\")


def _first_para(text: str) -> str:
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    return re.sub(r'\s+', ' ', paras[0]) if paras else ""


def _parse_fortigate_audit(content: str, level: str) -> dict[str, dict]:
    """ID → {level, title, info, solution, reference} for every numbered
    benchmark item in a CIS_FortiGate_*.audit file (custom_item or report
    blocks). Sub-condition helper items have no numeric ID and are skipped."""
    out: dict[str, dict] = {}
    blocks = re.findall(r'<(custom_item|report)[^>]*>(.*?)</\1>', content, re.DOTALL)
    for _kind, block in blocks:
        desc = _extract_quoted("description", block) or ""
        m = re.match(r'^(\d+(?:\.\d+)*)\s+(.*)$', desc.strip())
        if not m:
            continue
        cid, title = m.group(1), re.sub(r'\s+', ' ', m.group(2)).strip()
        info = _extract_quoted("info", block) or ""
        if cid in out and out[cid]["info"]:
            continue
        solution = (_extract_quoted("solution", block) or "").strip()
        impact = ""
        if "\nImpact:" in solution:
            solution, impact = solution.split("\nImpact:", 1)
        out[cid] = {
            "level": level, "title": title,
            "info": _first_para(info),
            "solution": solution.strip(),
            "impact": impact.strip(),
            "reference": _extract_quoted("reference", block) or "",
        }
    return out


# ══════════════════════════════════════════════════════════════════════════
# FortiOS configuration parser
# ══════════════════════════════════════════════════════════════════════════
class FNode:
    """One 'config <path>' block or one 'edit <name>' entry."""
    __slots__ = ("name", "line", "settings", "configs", "edits", "is_edit")

    def __init__(self, name: str, line: int, is_edit: bool = False):
        self.name = name
        self.line = line
        self.settings: dict[str, tuple[list[str], int]] = {}
        self.configs: dict[str, "FNode"] = {}
        self.edits: dict[str, "FNode"] = {}
        self.is_edit = is_edit

    # value helpers
    def get(self, key: str, default: "str | None" = None) -> "str | None":
        v = self.settings.get(key)
        return " ".join(v[0]) if v else default

    def list(self, key: str) -> list[str]:
        v = self.settings.get(key)
        return list(v[0]) if v else []

    def has(self, key: str) -> bool:
        return key in self.settings

    def ln(self, key: str) -> int:
        v = self.settings.get(key)
        return v[1] if v else self.line

    def sub(self, path: str) -> "FNode | None":
        return self.configs.get(path)


_ANSI_RE = re.compile(r'\x1b\[[0-9;?]*[A-Za-z]|\x1b[=>]')
_PAGER_RE = re.compile(r'--More--\s*(?:\x08+\s*\x08+)?|\r')
_VERBS = {"config", "edit", "next", "end", "set", "unset", "append", "unselect", "select"}


def _tokenize(text: str) -> tuple[list[tuple[int, list[str]]], list[str]]:
    """FortiOS config text → ([(line_no, tokens)], header_comment_lines).
    Handles double-quoted values with \\" / \\\\ escapes, including quoted
    values that span lines (replacement-message buffers, certificates)."""
    stmts: list[tuple[int, list[str]]] = []
    header: list[str] = []
    tokens: list[str] = []
    cur: "list[str] | None" = None
    in_q = False
    start_ln = 0
    for ln, line in enumerate(text.split("\n"), 1):
        if not in_q:
            s = line.strip()
            if not s:
                continue
            if s.startswith("#"):
                header.append(s)
                continue
            if '"' not in s and "\\" not in s:
                stmts.append((ln, s.split()))
                continue
            tokens, cur, start_ln, src = [], None, ln, s
        else:
            src = "\n" + line
        i, n = 0, len(src)
        while i < n:
            ch = src[i]
            if in_q:
                if ch == "\\" and i + 1 < n:
                    cur.append(src[i + 1])
                    i += 2
                    continue
                if ch == '"':
                    in_q = False
                else:
                    cur.append(ch)
                i += 1
                continue
            if ch in " \t":
                if cur is not None:
                    tokens.append("".join(cur))
                    cur = None
            elif ch == '"':
                in_q = True
                if cur is None:
                    cur = []
            elif ch == "\\" and i + 1 < n:
                if cur is None:
                    cur = []
                cur.append(src[i + 1])
                i += 1
            else:
                if cur is None:
                    cur = []
                cur.append(ch)
            i += 1
        if not in_q:
            if cur is not None:
                tokens.append("".join(cur))
                cur = None
            stmts.append((start_ln, tokens))
    if in_q and cur is not None:   # unterminated quote at EOF — keep what we have
        tokens.append("".join(cur))
        stmts.append((start_ln, tokens))
    return stmts, header


def _build_tree(stmts: list[tuple[int, list[str]]]) -> FNode:
    root = FNode("root", 0)
    stack = [root]
    for ln, toks in stmts:
        if not toks:
            continue
        verb = toks[0]
        if verb not in _VERBS:
            continue   # CLI prompt / pager noise in a session capture
        top = stack[-1]
        if verb == "config":
            path = " ".join(toks[1:])
            node = top.configs.get(path)
            if node is None:
                node = FNode(path, ln)
                top.configs[path] = node
            stack.append(node)
        elif verb == "edit":
            name = toks[1] if len(toks) > 1 else ""
            node = top.edits.get(name)
            if node is None:
                node = FNode(name, ln, is_edit=True)
                top.edits[name] = node
            stack.append(node)
        elif verb == "next":
            while len(stack) > 1 and not stack[-1].is_edit:
                stack.pop()
            if len(stack) > 1:
                stack.pop()
        elif verb == "end":
            if len(stack) > 1 and stack[-1].is_edit:
                stack.pop()       # 'end' without a 'next'
            if len(stack) > 1:
                stack.pop()
        elif verb == "set" and len(toks) >= 2:
            top.settings[toks[1]] = (toks[2:], ln)
        elif verb == "append" and len(toks) >= 2:
            old = top.settings.get(toks[1], ([], ln))[0]
            top.settings[toks[1]] = (old + toks[2:], ln)
        elif verb == "unset" and len(toks) >= 2:
            top.settings.pop(toks[1], None)
    return root


def _load_fortios_config(filename: str) -> tuple[FNode, list[str], int]:
    try:
        with open(filename, "r", encoding="utf-8", errors="replace") as fh:
            raw = fh.read()
    except FileNotFoundError:
        sys.exit(f"File not found: {filename}")
    raw = _ANSI_RE.sub("", raw)
    raw = _PAGER_RE.sub("", raw)
    stmts, header = _tokenize(raw)
    if not any(t and t[0] == "config" for _, t in stmts):
        sys.exit(f"{filename}: no FortiOS 'config ... end' blocks found — not a FortiGate configuration?")
    return _build_tree(stmts), header, len(stmts)


# ── FortiOS 7.6 factory defaults for the settings the checks read ───────────
# A backup / 'show' omits any setting left at its default, so every check
# reads through these. (path, key) → default value.
FORTIOS_DEFAULTS: dict[tuple[str, str], str] = {
    ("system global", "admintimeout"): "5",
    ("system global", "admin-lockout-threshold"): "3",
    ("system global", "admin-lockout-duration"): "60",
    ("system global", "pre-login-banner"): "disable",
    ("system global", "post-login-banner"): "disable",
    ("system global", "admin-https-ssl-versions"): "tlsv1-2 tlsv1-3",
    ("system global", "admin-port"): "80",
    ("system global", "admin-sport"): "443",
    ("system global", "admin-ssh-port"): "22",
    ("system global", "admin-https-redirect"): "enable",
    ("system global", "admin-server-cert"): "self-sign",
    ("system global", "gui-cdn-usage"): "enable",
    ("system global", "gui-display-hostname"): "disable",
    ("system global", "log-single-cpu-high"): "disable",
    ("system global", "ssl-static-key-ciphers"): "enable",
    ("system global", "strong-crypto"): "enable",
    ("system password-policy", "status"): "disable",
    ("system password-policy", "apply-to"): "admin-password",
    ("system password-policy", "minimum-length"): "8",
    ("system password-policy", "min-lower-case-letter"): "0",
    ("system password-policy", "min-upper-case-letter"): "0",
    ("system password-policy", "min-non-alphanumeric"): "0",
    ("system password-policy", "min-number"): "0",
    ("system password-policy", "expire-status"): "disable",
    ("system password-policy", "expire-day"): "90",
    ("system password-policy", "reuse-password"): "enable",
    ("system dns", "primary"): "96.45.45.45",
    ("system dns", "secondary"): "96.45.46.46",
    ("system dns", "protocol"): "cleartext",
    ("system ntp", "ntpsync"): "enable",
    ("system ntp", "type"): "fortiguard",
    ("system snmp sysinfo", "status"): "disable",
    ("system ha", "mode"): "standalone",
    ("system ha", "group-id"): "0",
    ("system ha", "ha-mgmt-status"): "disable",
    ("system auto-install", "auto-install-config"): "enable",
    ("system auto-install", "auto-install-image"): "enable",
    ("system autoupdate schedule", "status"): "enable",
    ("system autoupdate schedule", "frequency"): "automatic",
    ("system fortiguard", "sandbox-inline-scan"): "disable",
    ("system csf", "status"): "disable",
    ("antivirus settings", "machine-learning-detection"): "enable",
    ("antivirus settings", "grayware"): "enable",
    ("vpn ssl settings", "status"): "enable",
    ("vpn ssl settings", "servercert"): "Fortinet_Factory",
    ("vpn ssl settings", "ssl-min-proto-ver"): "tls1-2",
    ("vpn ssl settings", "ssl-max-proto-ver"): "tls1-3",
    ("vpn ssl settings", "algorithm"): "high",
    ("log fortianalyzer setting", "status"): "disable",
    ("log fortianalyzer setting", "reliable"): "disable",
    ("log fortianalyzer setting", "enc-algorithm"): "high",
    ("log fortianalyzer setting", "certificate-verification"): "enable",
    ("log fortiguard setting", "status"): "disable",
    ("log eventfilter", "event"): "enable",
}
for _sd in ("syslogd", "syslogd2", "syslogd3", "syslogd4"):
    FORTIOS_DEFAULTS[(f"log {_sd} setting", "status")] = "disable"
    FORTIOS_DEFAULTS[(f"log {_sd} setting", "mode")] = "udp"
    FORTIOS_DEFAULTS[(f"log {_sd} setting", "enc-algorithm")] = "disable"

PROFILE_KEYS = {
    "av":     "av-profile",
    "web":    "webfilter-profile",
    "dns":    "dnsfilter-profile",
    "ips":    "ips-sensor",
    "app":    "application-list",
    "dlp":    "dlp-profile",
    "ssl":    "ssl-ssh-profile",
    "file":   "file-filter-profile",
    "email":  "emailfilter-profile",
    "voip":   "voip-profile",
    "waf":    "waf-profile",
}

ISDB_MALICIOUS_INBOUND = [
    "Tor-Exit.Node", "Tor-Relay.Node", "Censys-Scanner", "Shodan-Scanner", "Botnet-C&C.Server",
    "Phishing-Phishing.Server", "Proxy-Proxy.Server", "Spam-Spamming.Server",
    "VPN-Anonymizing.VPN.Server", "Malicious-Malicious.Server",
]
ISDB_MALICIOUS_OUTBOUND = [
    "Tor-Relay.Node", "Botnet-C&C.Server", "Phishing-Phishing.Server", "Proxy-Proxy.Server",
    "Spam-Spamming.Server", "VPN-Anonymizing.VPN.Server", "Malicious-Malicious.Server",
]

# (protocol, port) → label for cleartext / legacy protocols a policy shouldn't permit.
INSECURE_PORTS: dict[tuple[str, int], str] = {
    ("tcp", 21): "FTP", ("tcp", 23): "Telnet", ("udp", 69): "TFTP", ("tcp", 80): "HTTP",
    ("tcp", 110): "POP3", ("tcp", 119): "NNTP", ("tcp", 143): "IMAP",
    ("udp", 161): "SNMP", ("udp", 162): "SNMP-trap",
    ("tcp", 512): "rexec", ("tcp", 513): "rlogin", ("tcp", 514): "rsh",
}
INSECURE_SERVICE_NAMES = {
    "TELNET": "Telnet", "FTP": "FTP", "FTP_GET": "FTP", "FTP_PUT": "FTP", "HTTP": "HTTP",
    "TFTP": "TFTP", "SNMP": "SNMP", "POP3": "POP3", "IMAP": "IMAP", "NNTP": "NNTP",
    "RLOGIN": "rlogin", "REXEC": "rexec", "RSH": "rsh",
}

WEAK_IPSEC_ALGS = ("des", "3des", "md5", "sha1", "null")
WEAK_DH_GROUPS = {"1", "2", "5", "22", "23", "24"}
WEAK_SSH_ALGS = ("3des", "cbc", "arcfour", "hmac-md5", "hmac-sha1", "diffie-hellman-group1",
                 "diffie-hellman-group14-sha1", "diffie-hellman-group-exchange-sha1")


def _parse_port_ranges(spec: list[str]) -> list[tuple[int, int]]:
    """FortiOS 'tcp-portrange 80 8080-8090 443:1024-65535' → [(lo, hi), ...]
    of destination ports (the part before ':' is the destination)."""
    out = []
    for tok in spec:
        dst = tok.split(":", 1)[0]
        try:
            if "-" in dst:
                lo, hi = dst.split("-", 1)
                out.append((int(lo), int(hi)))
            elif dst:
                out.append((int(dst), int(dst)))
        except ValueError:
            continue
    return out


def _fmt_list(vals: list[str], limit: int = 0) -> str:
    if not vals:
        return ""
    if limit and len(vals) > limit:
        return ", ".join(vals[:limit]) + f", … (+{len(vals) - limit} more)"
    return ", ".join(vals)


# ══════════════════════════════════════════════════════════════════════════
class FortigateParser:
    def __init__(self, config_file: str, wan_intfs: "list[str] | None" = None):
        self.config_file = config_file
        self.source_label = os.path.basename(config_file)
        self.cli_wan = list(wan_intfs or [])

        self.root: "FNode | None" = None
        self.glob: "FNode | None" = None
        self.vdoms: dict[str, FNode] = {}
        self.multi_vdom = False
        self.header: list[str] = []
        self.statement_count = 0

        self.model = self.version = self.build = ""
        self.system: dict[str, tuple[str, int]] = {}
        self.policies: list[dict] = []
        self.interfaces: list[dict] = []
        self.wan_intfs: set[str] = set()
        self.wan_source = ""

        self.issues: list[dict] = []
        self._seen: set[tuple[str, str]] = set()
        self.cis_results: dict[str, dict] = {}   # CIS ID → {status, evidence, ...}

        self.audits_tar_path = ""
        self.cis_l1_audit_used = ""
        self.cis_l2_audit_used = ""
        self.catalog: dict[str, dict] = {}

    # ── Parse entry point ────────────────────────────────────────────────────
    def parse(self):
        self.root, self.header, self.statement_count = _load_fortios_config(self.config_file)
        self._parse_header()
        vdom_node = self.root.sub("vdom")
        global_node = self.root.sub("global")
        if vdom_node is not None and global_node is not None:
            self.multi_vdom = True
            self.glob = global_node
            self.vdoms = {name: n for name, n in vdom_node.edits.items()}
        else:
            self.glob = self.root
            self.vdoms = {"root": self.root}
        print(f"[+] Loaded {self.statement_count} statement(s) from {self.source_label} "
              f"(FortiOS {self.version or '?'} build {self.build or '?'}, "
              f"{'multi-VDOM: ' + ', '.join(self.vdoms) if self.multi_vdom else 'single VDOM'})")
        if self.version and not self.version.startswith("7."):
            print(f"[!] FortiOS {self.version} — checks are written for 7.x (7.6); "
                  "defaults and syntax may differ.")

        self._load_catalog()
        self._collect_interfaces()
        self._detect_wan()
        self._collect_policies()
        self._collect_system_settings()

        self._run_cis_checks()
        self._run_native_checks()

    def _parse_header(self):
        for h in self.header:
            m = re.match(r'#config-version=([^-:]+)-(\d+\.\d+\.\d+)-FW-build(\d+)', h)
            if m:
                self.model, self.version, self.build = m.group(1), m.group(2), m.group(3).lstrip("0")
            m = re.match(r'#buildno=(\d+)', h)
            if m and not self.build:
                self.build = m.group(1).lstrip("0")

    def _load_catalog(self):
        tar_path = _find_audits_tar()
        if not tar_path:
            print("[!] audits.tar.gz not found — using built-in CIS titles only "
                  "(no rationale/remediation text from the benchmark).")
            return
        self.audits_tar_path = tar_path
        with tarfile.open(tar_path, "r:*") as tf:
            for level, member in CIS_AUDIT_MEMBERS.items():
                try:
                    f = tf.extractfile(member)
                except KeyError:
                    f = None
                if f is None:
                    print(f"[!] {member} not found inside {tar_path} — {level} items use built-in titles.")
                    continue
                items = _parse_fortigate_audit(f.read().decode("utf-8", errors="replace"), level)
                for cid, it in items.items():
                    self.catalog.setdefault(cid, it)
                if level == "L1":
                    self.cis_l1_audit_used = os.path.basename(member)
                else:
                    self.cis_l2_audit_used = os.path.basename(member)

    # ── Config access helpers ────────────────────────────────────────────────
    def scopes(self) -> list[tuple[str, FNode]]:
        """[('global', node), (vdom, node), ...] without duplicates (in single-
        VDOM mode global and root are the same node)."""
        out, seen = [], set()
        for label, node in [("global", self.glob)] + list(self.vdoms.items()):
            if node is not None and id(node) not in seen:
                seen.add(id(node))
                out.append((label, node))
        return out

    def gnode(self, path: str) -> "FNode | None":
        """A global-scope config block, falling back to the first VDOM that
        has it (some blocks are per-VDOM in multi-VDOM mode)."""
        for _label, node in self.scopes():
            n = node.sub(path)
            if n is not None:
                return n
        return None

    def all_nodes(self, path: str) -> list[tuple[str, FNode]]:
        return [(label, node.sub(path)) for label, node in self.scopes() if node.sub(path) is not None]

    def eff(self, path: str, key: str, node: "FNode | None" = None) -> tuple[str, int, bool]:
        """Effective (value, line, is_default) of a setting, reading through
        FORTIOS_DEFAULTS when the config doesn't list it."""
        if node is None:
            node = self.gnode(path)
        if node is not None and node.has(key):
            return node.get(key) or "", node.ln(key), False
        return FORTIOS_DEFAULTS.get((path, key), ""), (node.line if node else 0), True

    @staticmethod
    def _show(val: str, is_default: bool) -> str:
        return f"{val or '(empty)'}{' (FortiOS default — not set in config)' if is_default else ''}"

    def _scope_tag(self, label: str) -> str:
        return f"[{label}] " if self.multi_vdom and label != "global" else ""

    # ── Inventory ────────────────────────────────────────────────────────────
    def _collect_interfaces(self):
        node = self.gnode("system interface")
        if node is None:
            return
        for name, e in node.edits.items():
            ip = e.list("ip")
            self.interfaces.append({
                "name": name, "vdom": e.get("vdom", ""), "type": e.get("type", "physical"),
                "ip": " ".join(ip) if ip and ip[0] != "0.0.0.0" else "",
                "allowaccess": [a.lower() for a in e.list("allowaccess")],
                "role": e.get("role", ""), "status": e.get("status", "up"),
                "description": e.get("description", ""), "alias": e.get("alias", ""),
                "parent": e.get("interface", ""), "members": e.list("member"),
                "mode": e.get("mode", "static"), "dedicated": e.get("dedicated-to", ""),
                "line": e.line, "node": e,
            })

    def _detect_wan(self):
        if self.cli_wan:
            self.wan_intfs = set(self.cli_wan)
            self.wan_source = "--wan-intf"
            return
        reasons = []
        for i in self.interfaces:
            if i["role"] == "wan":
                self.wan_intfs.add(i["name"])
                reasons.append(f"{i['name']} (role wan)")
            elif re.match(r'^wan\d*$', i["name"], re.I):
                self.wan_intfs.add(i["name"])
                reasons.append(f"{i['name']} (name)")
        for label, rs in self.all_nodes("router static"):
            for _sid, r in rs.edits.items():
                dst = r.list("dst")
                if (not dst or dst[:2] == ["0.0.0.0", "0.0.0.0"] or dst == ["0.0.0.0/0"]) and r.get("device"):
                    dev = r.get("device")
                    if dev not in self.wan_intfs:
                        self.wan_intfs.add(dev)
                        reasons.append(f"{dev} (default route)")
                if r.get("sdwan-zone") or r.get("sdwan") == "enable":
                    for z in r.list("sdwan-zone") or ["virtual-wan-link"]:
                        self.wan_intfs.add(z)
        for label, sd in self.all_nodes("system sdwan"):
            if sd.get("status") == "enable":
                mem = sd.sub("members")
                for _mid, m in (mem.edits.items() if mem else []):
                    if m.get("interface"):
                        self.wan_intfs.add(m.get("interface"))
                        reasons.append(f"{m.get('interface')} (SD-WAN member)")
                zones = sd.sub("zone")
                for zname in (zones.edits if zones else {}):
                    self.wan_intfs.add(zname)
        self.wan_source = ", ".join(dict.fromkeys(reasons)) or "none detected"

    def _zone_members(self) -> dict[str, list[str]]:
        out = {}
        for _label, zn in self.all_nodes("system zone"):
            for zname, z in zn.edits.items():
                out[zname] = z.list("interface")
        return out

    def _is_wan_intf(self, name: str, zones: dict) -> bool:
        if name in self.wan_intfs:
            return True
        return any(m in self.wan_intfs for m in zones.get(name, []))

    def _profile_set(self, pol: FNode, vdom: FNode) -> dict[str, str]:
        if pol.get("utm-status") == "disable":
            src = None
        elif pol.get("profile-type") == "group" and pol.get("profile-group"):
            grp = vdom.sub("firewall profile-group")
            src = grp.edits.get(pol.get("profile-group")) if grp else None
        else:
            src = pol
        profs = {k: (src.get(v, "") if src is not None else "") for k, v in PROFILE_KEYS.items()}
        if not profs["dlp"] and src is not None:
            profs["dlp"] = src.get("dlp-sensor", "")   # pre-7.2 name
        if not profs["ssl"]:
            profs["ssl"] = pol.get("ssl-ssh-profile", "") or ""
        return profs

    def _collect_policies(self):
        zones = self._zone_members()
        for vname, vnode in self.vdoms.items():
            for kind in ("firewall policy", "firewall security-policy"):
                pn = vnode.sub(kind)
                if pn is None:
                    continue
                for seq, (pid, p) in enumerate(pn.edits.items(), 1):
                    srcintf, dstintf = p.list("srcintf"), p.list("dstintf")
                    action = p.get("action", "deny")
                    self.policies.append({
                        "vdom": vname, "kind": kind, "seq": seq, "id": pid,
                        "name": p.get("name", ""), "status": p.get("status", "enable"),
                        "action": action,
                        "srcintf": srcintf, "dstintf": dstintf,
                        "srcaddr": p.list("srcaddr") + p.list("srcaddr6"),
                        "dstaddr": p.list("dstaddr") + p.list("dstaddr6"),
                        "isdb_src": (p.list("internet-service-src-name") + p.list("internet-service-src-group")
                                     if p.get("internet-service-src") == "enable" else []),
                        "isdb_dst": (p.list("internet-service-name") + p.list("internet-service-group")
                                     if p.get("internet-service") == "enable" else []),
                        "service": p.list("service"),
                        "app": p.list("application") + p.list("app-category") + p.list("app-group"),
                        "schedule": p.get("schedule", ""),
                        "logtraffic": p.get("logtraffic", "utm" if action == "accept" else "disable"),
                        "log_explicit": p.has("logtraffic"),
                        "nat": p.get("nat", "disable"),
                        "users": p.list("users"), "groups": p.list("groups"),
                        "src_negate": p.get("srcaddr-negate") == "enable",
                        "dst_negate": p.get("dstaddr-negate") == "enable",
                        "svc_negate": p.get("service-negate") == "enable",
                        "inspection_mode": p.get("inspection-mode", "flow"),
                        "profiles": self._profile_set(p, vnode),
                        "comments": p.get("comments", ""),
                        "line": p.line, "vnode": vnode,
                        "from_wan": any(self._is_wan_intf(i, zones) for i in srcintf),
                        "to_wan": any(self._is_wan_intf(i, zones) for i in dstintf),
                        "any_intf": "any" in srcintf or "any" in dstintf,
                    })

    def _pol_label(self, p: dict) -> str:
        name = f" \"{p['name']}\"" if p["name"] else ""
        vd = f"[{p['vdom']}] " if self.multi_vdom else ""
        kind = "" if p["kind"] == "firewall policy" else "security-policy "
        return f"{vd}{kind}policy {p['id']}{name}"

    @staticmethod
    def _pol_summary(p: dict) -> str:
        prof = ", ".join(f"{k}={v}" for k, v in p["profiles"].items() if v) or "(none)"
        return "\n".join([
            f"Status: {p['status']}", f"Action: {p['action']}",
            f"Src intf: {_fmt_list(p['srcintf']) or '(none)'}",
            f"Dst intf: {_fmt_list(p['dstintf']) or '(none)'}",
            f"Source: {_fmt_list(p['srcaddr']) or _fmt_list(p['isdb_src']) or '(none)'}"
            + (" (negated)" if p["src_negate"] else ""),
            f"Destination: {_fmt_list(p['dstaddr']) or _fmt_list(p['isdb_dst']) or '(none)'}"
            + (" (negated)" if p["dst_negate"] else ""),
            f"Service: {_fmt_list(p['service']) or '(none)'}" + (" (negated)" if p["svc_negate"] else ""),
            f"Users/Groups: {_fmt_list(p['users'] + p['groups']) or '(none)'}",
            f"Schedule: {p['schedule'] or '(none)'}", f"Log: {p['logtraffic']}", f"NAT: {p['nat']}",
            f"Profiles: {prof}", f"Comments: {p['comments'] or '(none)'}",
        ])

    def _collect_system_settings(self):
        def put(label, path, key, default_ok=True):
            val, ln, dflt = self.eff(path, key)
            if val or not dflt:
                self.system[label] = (val + (" (default)" if dflt and default_ok else ""), ln if not dflt else 0)

        g = self.gnode("system global")
        self.system["Model"] = (self.model or "(unknown)", 0)
        self.system["FortiOS Version"] = (f"{self.version or '?'} build {self.build or '?'}", 0)
        self.system["VDOM Mode"] = ("multi-vdom: " + ", ".join(self.vdoms) if self.multi_vdom else "single VDOM", 0)
        if g is not None and g.has("hostname"):
            self.system["Hostname"] = (g.get("hostname"), g.ln("hostname"))
        if g is not None and g.has("alias"):
            self.system["Alias"] = (g.get("alias"), g.ln("alias"))
        if g is not None and g.has("timezone"):
            self.system["Timezone"] = (g.get("timezone"), g.ln("timezone"))
        put("Admin Idle Timeout (min)", "system global", "admintimeout")
        put("Admin Lockout Threshold", "system global", "admin-lockout-threshold")
        put("Admin Lockout Duration (s)", "system global", "admin-lockout-duration")
        self.system["Admin HTTP / HTTPS Port"] = (
            f"{self.eff('system global', 'admin-port')[0]} / {self.eff('system global', 'admin-sport')[0]}", 0)
        put("Admin SSH Port", "system global", "admin-ssh-port")
        put("Admin GUI TLS Versions", "system global", "admin-https-ssl-versions")
        put("Strong Crypto", "system global", "strong-crypto")
        put("Pre-Login Banner", "system global", "pre-login-banner")
        put("Post-Login Banner", "system global", "post-login-banner")
        put("Password Policy", "system password-policy", "status")
        put("Password Min Length", "system password-policy", "minimum-length")
        put("DNS Primary", "system dns", "primary")
        put("DNS Secondary", "system dns", "secondary")
        put("NTP Sync", "system ntp", "ntpsync")
        put("NTP Type", "system ntp", "type")
        servers = self._ntp_servers()
        if servers:
            self.system["NTP Servers"] = (", ".join(s for s, _, _ in servers), servers[0][1])
        put("SNMP Agent", "system snmp sysinfo", "status")
        put("HA Mode", "system ha", "mode")
        put("FortiAnalyzer Logging", "log fortianalyzer setting", "status")
        for sd in ("syslogd", "syslogd2", "syslogd3", "syslogd4"):
            n = self.gnode(f"log {sd} setting")
            if n is not None and n.get("status") == "enable":
                self.system[f"Syslog ({sd})"] = (
                    f"{n.get('server', '?')} mode={self.eff(f'log {sd} setting', 'mode')[0]} "
                    f"enc={self.eff(f'log {sd} setting', 'enc-algorithm')[0]}", n.line)
        put("Security Fabric", "system csf", "status")
        self.system["WAN Interfaces (detected)"] = (", ".join(sorted(self.wan_intfs)) or "(none)", 0)
        adm = self.gnode("system admin")
        self.system["Admin Accounts"] = (", ".join(adm.edits) if adm else "(none)", adm.line if adm else 0)

    def _ntp_servers(self) -> list[tuple[str, int, bool]]:
        """[(server, line, authenticated)] for 'config system ntp' custom servers."""
        ntp = self.gnode("system ntp")
        out = []
        if ntp is None:
            return out
        ns = ntp.sub("ntpserver")
        for _sid, s in (ns.edits.items() if ns else []):
            if s.get("server"):
                out.append((s.get("server"), s.ln("server"),
                            s.get("authentication") == "enable" or s.get("key-type") in ("SHA1", "SHA256", "MD5")))
        if not out and ntp.get("server"):   # older single-line form
            for srv in ntp.list("server"):
                out.append((srv, ntp.ln("server"), False))
        return out

    # ── Address / service resolution ─────────────────────────────────────────
    def _addr_is_any(self, name: str, vnode: FNode, depth: int = 0) -> bool:
        if name.lower() in ("all", "any", "all6", "any6"):
            return True
        if depth > 10:
            return False
        for path in ("firewall address", "firewall address6"):
            an = vnode.sub(path)
            if an is not None and name in an.edits:
                a = an.edits[name]
                atype = a.get("type", "ipmask")
                if path == "firewall address":
                    sub = a.list("subnet")
                    return atype == "ipmask" and (not sub or sub[:2] == ["0.0.0.0", "0.0.0.0"]
                                                  or sub == ["0.0.0.0/0"])
                return a.get("ip6", "::/0") == "::/0" and atype == "ipprefix"
        for path in ("firewall addrgrp", "firewall addrgrp6"):
            gn = vnode.sub(path)
            if gn is not None and name in gn.edits:
                g = gn.edits[name]
                if g.get("exclude") == "enable":
                    return False
                return any(self._addr_is_any(m, vnode, depth + 1) for m in g.list("member"))
        return False

    def _svc_info(self, name: str, vnode: FNode, depth: int = 0, seen=None) -> tuple[bool, set[str]]:
        """(is_any, {insecure protocol labels}) for one service / service group."""
        seen = seen if seen is not None else set()
        if name in seen or depth > 10:
            return False, set()
        seen.add(name)
        if name.upper() == "ALL":
            return True, set()
        sc = vnode.sub("firewall service custom")
        if sc is not None and name in sc.edits:
            s = sc.edits[name]
            proto = s.get("protocol", "TCP/UDP/UDP-Lite/SCTP")
            if proto == "IP" and s.get("protocol-number", "0") == "0":
                return True, set()
            insecure: set[str] = set()
            wide = False
            for key, pname in (("tcp-portrange", "tcp"), ("udp-portrange", "udp")):
                for lo, hi in _parse_port_ranges(s.list(key)):
                    if hi - lo >= 60000:
                        wide = True
                    for (ip, port), label in INSECURE_PORTS.items():
                        if ip == pname and lo <= port <= hi and hi - lo < 60000:
                            insecure.add(label)
            if not insecure and name.upper() in INSECURE_SERVICE_NAMES and not s.list("tcp-portrange") \
                    and not s.list("udp-portrange"):
                insecure.add(INSECURE_SERVICE_NAMES[name.upper()])
            return wide, insecure
        sg = vnode.sub("firewall service group")
        if sg is not None and name in sg.edits:
            any_, ins = False, set()
            for m in sg.edits[name].list("member"):
                a, i = self._svc_info(m, vnode, depth + 1, seen)
                any_ = any_ or a
                ins |= i
            return any_, ins
        if name.upper() in INSECURE_SERVICE_NAMES:
            return False, {INSECURE_SERVICE_NAMES[name.upper()]}
        return False, set()

    def _pol_any(self, p: dict) -> tuple[bool, bool, bool]:
        v = p["vnode"]
        src_any = (not p["isdb_src"] and not p["src_negate"]
                   and any(self._addr_is_any(a, v) for a in p["srcaddr"]))
        dst_any = (not p["isdb_dst"] and not p["dst_negate"]
                   and any(self._addr_is_any(a, v) for a in p["dstaddr"]))
        svc_any = (not p["svc_negate"] and not p["isdb_dst"]
                   and any(self._svc_info(s, v)[0] for s in p["service"]))
        return src_any, dst_any, svc_any

    # ── Findings ──────────────────────────────────────────────────────────
    def _issue(self, severity, category, cis_id, name, description, recommendation,
               details="", line="", vuln_id=None, validated=True):
        key = (category, name)
        if key in self._seen:
            return
        self._seen.add(key)
        cat = self.catalog.get(cis_id, {}) if cis_id else {}
        if cis_id:
            cis_ids = _refs_from_reference(cat.get("reference", ""), "CSCv8") or CIS_V8_BY_CIS_ID.get(cis_id, [])
            pci_ids = _refs_from_reference(cat.get("reference", ""), "PCI-DSSv4.0") or PCI_BY_CIS_ID.get(cis_id, [])
            scf_ids = SCF_BY_CIS_ID.get(cis_id, [])
            if vuln_id is None:
                vuln_id = VULN_BY_CIS_ID.get(cis_id)
        else:
            nat = NATIVE_CHECKS.get(category)
            cis_ids, pci_ids, scf_ids = (nat[1], nat[2], nat[3]) if nat else ([], [], [])
            if vuln_id is None and nat:
                vuln_id = nat[0]
        vuln_id = vuln_id or None          # NO_VULN (0) → blank
        canon = _vuln_controls().get(vuln_id) if vuln_id else None
        if canon:
            cis_ids, pci_ids, scf_ids = canon["cis_v8"], canon["pci_dss"], canon["scf"]
        self.issues.append({
            "severity": severity, "category": category, "item_id": cis_id or "",
            "rule_name": name, "line": str(line) if line else "",
            "description": description, "recommendation": recommendation, "details": details,
            "cis_controls": _cis_label(cis_ids), "cis_ids": list(cis_ids),
            "cis_benchmark": cis_id or "", "pci_dss": _pci_label(pci_ids), "pci_ids": list(pci_ids),
            "scf": _scf_label(scf_ids), "scf_ids": list(scf_ids),
            "vuln_id": vuln_id, "validated": "Y" if validated else "N",
        })

    def _cis_title(self, cid: str) -> tuple[str, str]:
        lvl, title = CIS_CATALOG.get(cid, ("", cid))
        cat = self.catalog.get(cid)
        if cat:
            lvl = cat["level"] or lvl
        return lvl, title

    # ── CIS FortiGate benchmark ──────────────────────────────────────────────
    def _run_cis_checks(self):
        for cid in sorted(CIS_CATALOG, key=_id_key):
            fn = getattr(self, "_cis_" + cid.replace(".", "_"), None)
            if fn is None:
                continue
            try:
                res = fn()
            except Exception as exc:   # one bad block shouldn't sink the report
                res = {"status": "MANUAL", "evidence": f"Check could not be evaluated automatically: {exc}"}
            self._emit_cis(cid, res)

    def _emit_cis(self, cid: str, res: dict):
        """res = {status: PASS|FAIL|MANUAL|VERIFY|NA, evidence, line, severity?,
        items: [(object_name, evidence, line), ...]} — items emit one finding
        per object (e.g. per policy / per interface) instead of one roll-up."""
        lvl, title = self._cis_title(cid)
        cat = self.catalog.get(cid, {})
        info = cat.get("info") or f"CIS {cid}: {title}."
        solution = cat.get("solution") or "See the CIS FortiGate Benchmark for remediation steps."
        status = res["status"]
        sev = res.get("severity") or SEVERITY_BY_CIS_ID.get(cid, "MEDIUM")
        # items: (object, evidence, line[, vuln]) — a 4th element overrides the vuln for that object.
        items = [tuple(it) + (None,) * (4 - len(it)) for it in (res.get("items") or [])]
        res_vuln = res.get("vuln", VULN_BY_CIS_ID.get(cid, NO_VULN))
        umbrella = f"[{lvl}] {cid} {title}"
        vulns_used: list[int] = []
        if status == "FAIL":
            if items:
                for obj, ev, ln, v in items:
                    v = res_vuln if v is None else v
                    vulns_used.append(v)
                    self._issue(sev, title, cid, obj, info, solution, details=ev, line=ln, vuln_id=v)
            else:
                vulns_used.append(res_vuln)
                self._issue(sev, title, cid, umbrella, info, solution,
                            details=res.get("evidence", ""), line=res.get("line", ""), vuln_id=res_vuln)
        elif status == "MANUAL":
            # The vuln this item tests for, flagged Validated = N until reviewed.
            vulns_used.append(res_vuln)
            self._issue(res.get("severity") or "INFO", f"{title} — Manual Review Required", cid, umbrella,
                        info, solution, details=res.get("evidence", ""), line=res.get("line", ""),
                        validated=False, vuln_id=res_vuln)
        elif status == "VERIFY":
            # Configured (the check passed) — the vuln isn't present, so none is reported.
            self._issue("INFO", f"{title} — Verify Environment-Specific Value", cid, umbrella,
                        f"{title}: configured — confirm the value shown in Details is the one your "
                        "organization's standard requires. " + info,
                        "No action needed if the value shown is correct.",
                        details=res.get("evidence", ""), line=res.get("line", ""), validated=False,
                        vuln_id=NO_VULN)
        self.cis_results[cid] = {
            "level": lvl, "title": title, "status": status, "severity": sev if status == "FAIL" else "",
            "evidence": res.get("evidence", "") or ("; ".join(f"{o}: {e}" for o, e, _l, _v in items[:15])
                                                   + (f" … (+{len(items) - 15} more)" if len(items) > 15 else "")),
            "count": len(items),
            "vulns": [v for v in dict.fromkeys(vulns_used) if v],
        }

    # 1.x — network
    def _cis_1_1(self):
        p, pl, pd = self.eff("system dns", "primary")
        s, sl, sd = self.eff("system dns", "secondary")
        ev = f"primary={self._show(p, pd)}; secondary={self._show(s, sd)}"
        if not p or p == "0.0.0.0":
            return {"status": "FAIL", "evidence": ev + " — no primary DNS server", "line": pl}
        if not s or s == "0.0.0.0":
            return {"status": "FAIL", "evidence": ev + " — no secondary DNS server", "line": pl,
                    "severity": "LOW", "vuln": NO_VULN}
        if pd or sd:
            ev += " — FortiGuard DNS defaults; confirm these are your organization's trusted resolvers"
        return {"status": "VERIFY", "evidence": ev, "line": pl if not pd else ""}

    def _cis_1_2(self):
        items, zones = [], 0
        for label, zn in self.all_nodes("system zone"):
            for zname, z in zn.edits.items():
                zones += 1
                if z.get("intrazone", "deny") == "allow":
                    items.append((f"{self._scope_tag(label)}zone {zname}",
                                  f"set intrazone allow — members: {_fmt_list(z.list('interface')) or '(none)'}",
                                  z.ln("intrazone")))
        if not zones:
            return {"status": "NA", "evidence": "No zones configured."}
        return {"status": "FAIL", "items": items} if items else \
            {"status": "PASS", "evidence": f"All {zones} zone(s) deny intra-zone traffic."}

    def _cis_1_3(self):
        if not self.wan_intfs:
            return {"status": "MANUAL", "severity": "MEDIUM",
                    "evidence": "No WAN interface could be identified (no role wan / default route / SD-WAN "
                                "member). Re-run with --wan-intf <name>, or review allowaccess by hand.\n"
                                + "\n".join(f"{i['name']}: {' '.join(i['allowaccess']) or '(none)'}"
                                            for i in self.interfaces if i["allowaccess"])}
        mgmt = {"http", "https", "ssh", "snmp", "ping", "radius-acct", "telnet"}
        items = []
        for i in self.interfaces:
            if i["name"] in self.wan_intfs:
                bad = [a for a in i["allowaccess"] if a in mgmt]
                if bad:
                    other = [a for a in i["allowaccess"] if a not in mgmt]
                    items.append((f"interface {i['name']}",
                                  f"allowaccess {' '.join(i['allowaccess'])} — management services on WAN: "
                                  f"{', '.join(bad)}" + (f" (also: {', '.join(other)})" if other else ""),
                                  i["node"].ln("allowaccess")))
        return {"status": "FAIL", "items": items} if items else \
            {"status": "PASS", "evidence": f"WAN interface(s) {', '.join(sorted(self.wan_intfs))} "
                                           "allow no management services."}

    # 2.1.x — global settings
    def _banner_check(self, key: str, msg: str):
        val, ln, dflt = self.eff("system global", key)
        if val != "enable":
            return {"status": "FAIL", "evidence": f"{key} {self._show(val, dflt)}", "line": ln if not dflt else ""}
        rm = self.gnode(f"system replacemsg admin {msg}")
        text = rm.get("buffer", "") if rm is not None else ""
        snippet = re.sub(r'\s+', ' ', text)[:200]
        return {"status": "VERIFY", "line": ln,
                "evidence": f"{key} enable; banner text: "
                            + (f"\"{snippet}\"" if snippet else "(FortiOS default disclaimer text — not customised)")}

    def _cis_2_1_1(self):
        return self._banner_check("pre-login-banner", "pre_admin-disclaimer-text")

    def _cis_2_1_2(self):
        return self._banner_check("post-login-banner", "post_admin-disclaimer-text")

    def _cis_2_1_3(self):
        g = self.gnode("system global")
        if g is None or not g.has("timezone"):
            return {"status": "FAIL", "evidence": "timezone not set — still the factory default"}
        return {"status": "VERIFY", "evidence": f"timezone {g.get('timezone')}", "line": g.ln("timezone")}

    def _cis_2_1_4(self):
        sync, ln, sd = self.eff("system ntp", "ntpsync")
        ntype, tl, td = self.eff("system ntp", "type")
        if sync != "enable":
            return {"status": "FAIL", "evidence": f"ntpsync {self._show(sync, sd)} — no time synchronisation",
                    "line": ln, "severity": "HIGH"}
        if ntype == "fortiguard":
            return {"status": "VERIFY", "line": tl if not td else "",
                    "evidence": f"ntpsync enable, type {self._show(ntype, td)} — time comes from FortiGuard NTP, "
                                "not the organization's own NTP servers"}
        servers = self._ntp_servers()
        if not servers:
            return {"status": "FAIL", "evidence": "type custom but no NTP server configured", "line": tl}
        ev = "servers: " + ", ".join(s for s, _, _ in servers)
        if len(servers) < 2:
            return {"status": "FAIL", "severity": "LOW", "line": servers[0][1], "vuln": 1,
                    "evidence": ev + " — CIS expects a primary and a secondary NTP server"}
        return {"status": "VERIFY", "evidence": ev, "line": servers[0][1]}

    _FACTORY_HOSTNAME_RE = re.compile(r'^(FG|FGT|FWF|FGVM|FortiGate)[-_]?[0-9A-Z]{2,}$', re.I)

    def _cis_2_1_5(self):
        g = self.gnode("system global")
        if g is None or not g.get("hostname"):
            return {"status": "FAIL", "evidence": "hostname not set — still the factory default (model/serial)"}
        h = g.get("hostname")
        if self._FACTORY_HOSTNAME_RE.match(h):
            return {"status": "FAIL", "evidence": f"hostname \"{h}\" looks like the factory default (model/serial)",
                    "line": g.ln("hostname")}
        return {"status": "PASS", "evidence": f"hostname \"{h}\"", "line": g.ln("hostname")}

    def _cis_2_1_6(self):
        return {"status": "MANUAL", "severity": "MEDIUM",
                "evidence": f"Running FortiOS {self.version or '?'} build {self.build or '?'} ({self.model or 'model ?'}). "
                            "Compare with the latest recommended 7.6.x release on the Fortinet support site and "
                            "the FortiGuard PSIRT advisories for this version."}

    def _cis_2_1_7(self):
        c, cl, cd = self.eff("system auto-install", "auto-install-config")
        i, il, idf = self.eff("system auto-install", "auto-install-image")
        ev = f"auto-install-config {self._show(c, cd)}; auto-install-image {self._show(i, idf)}"
        if c != "disable" or i != "disable":
            return {"status": "FAIL", "evidence": ev, "line": cl if not cd else (il if not idf else "")}
        return {"status": "PASS", "evidence": ev}

    def _global_flag(self, key: str, want: str):
        val, ln, dflt = self.eff("system global", key)
        ev = f"{key} {self._show(val, dflt)}"
        if val != want:
            return {"status": "FAIL", "evidence": ev + f" (CIS: {want})", "line": ln if not dflt else ""}
        return {"status": "PASS", "evidence": ev}

    def _cis_2_1_8(self):
        return self._global_flag("ssl-static-key-ciphers", "disable")

    def _cis_2_1_9(self):
        return self._global_flag("strong-crypto", "enable")

    def _cis_2_1_10(self):
        val, ln, dflt = self.eff("system global", "admin-https-ssl-versions")
        vers = val.split()
        ev = f"admin-https-ssl-versions {self._show(val, dflt)}"
        weak = [v for v in vers if v in ("tlsv1-0", "tlsv1-1", "sslv3")]
        if weak:
            return {"status": "FAIL", "severity": "HIGH", "evidence": ev + f" — deprecated: {', '.join(weak)}",
                    "line": ln if not dflt else ""}
        if vers != ["tlsv1-3"]:
            return {"status": "FAIL", "severity": "LOW", "evidence": ev + " — CIS: tlsv1-3 only",
                    "line": ln if not dflt else "", "vuln": NO_VULN}
        return {"status": "PASS", "evidence": ev}

    def _cis_2_1_11(self):
        return self._global_flag("gui-cdn-usage", "enable")

    def _cis_2_1_12(self):
        return self._global_flag("log-single-cpu-high", "enable")

    def _cis_2_1_13(self):
        return self._global_flag("gui-display-hostname", "disable")

    # 2.2.x — password policy / lockout
    def _cis_2_2_1(self):
        st, sl, sd = self.eff("system password-policy", "status")
        ap, al, ad = self.eff("system password-policy", "apply-to")
        ml, mll, md = self.eff("system password-policy", "minimum-length")
        ev = (f"status {self._show(st, sd)}; apply-to {self._show(ap, ad)}; "
              f"minimum-length {self._show(ml, md)}")
        if st != "enable":
            # No policy at all = complexity not enforced (28); the resulting
            # 8-character minimum is reported natively as its own vuln (15).
            return {"status": "FAIL", "evidence": ev + " — password policy disabled", "vuln": 28,
                    "line": sl if not sd else "", "severity": "HIGH"}
        items = []
        missing = [x for x in ("admin-password", "ipsec-preshared-key") if x not in ap.split()]
        if missing:
            items.append(("system password-policy apply-to",
                          f"apply-to {self._show(ap, ad)} — policy not enforced for {', '.join(missing)}",
                          al if not ad else "", 28))
        if not ml.isdigit() or int(ml) < 14:
            items.append(("system password-policy minimum-length",
                          f"minimum-length {self._show(ml, md)} — below 14", mll if not md else "", 15))
        if items:
            return {"status": "FAIL", "items": items}
        return {"status": "PASS", "evidence": ev}

    def _cis_2_2_2(self):
        th, tl, td = self.eff("system global", "admin-lockout-threshold")
        du, dl, dd = self.eff("system global", "admin-lockout-duration")
        ev = f"admin-lockout-threshold {self._show(th, td)}; admin-lockout-duration {self._show(du, dd)}s"
        items = []
        if not th.isdigit() or not 1 <= int(th) <= 3:
            items.append(("system global admin-lockout-threshold",
                          f"admin-lockout-threshold {self._show(th, td)} — more than 3 failed attempts allowed",
                          tl if not td else "", 27))
        if not du.isdigit() or not 1 <= int(du) <= 900:
            items.append(("system global admin-lockout-duration",
                          f"admin-lockout-duration {self._show(du, dd)}s — outside the 1–900 s the benchmark "
                          "checks for", dl if not dd else "", 10))
        if items:
            return {"status": "FAIL", "items": items}
        return {"status": "PASS", "evidence": ev}

    # 2.3.x — SNMP
    def _snmp_on(self) -> bool:
        return self.eff("system snmp sysinfo", "status")[0] == "enable"

    def _snmp_communities(self) -> list[tuple[str, FNode]]:
        cn = self.gnode("system snmp community")
        return [(cid, c) for cid, c in (cn.edits.items() if cn else []) if c.get("status", "enable") == "enable"]

    def _snmp_users(self) -> list[tuple[str, FNode]]:
        un = self.gnode("system snmp user")
        return [(uid, u) for uid, u in (un.edits.items() if un else []) if u.get("status", "enable") == "enable"]

    def _cis_2_3_1(self):
        if not self._snmp_on():
            return {"status": "PASS", "evidence": "SNMP agent disabled (system snmp sysinfo status disable)."}
        comms, users = self._snmp_communities(), self._snmp_users()
        items = []
        for cid, c in comms:
            hosts = c.sub("hosts")
            hl = [" ".join(h.list("ip")) or "0.0.0.0 0.0.0.0" for _, h in (hosts.edits.items() if hosts else [])]
            vers = []
            if c.get("query-v1-status", "enable") == "enable" or c.get("trap-v1-status", "enable") == "enable":
                vers.append("v1")
            if c.get("query-v2c-status", "enable") == "enable" or c.get("trap-v2c-status", "enable") == "enable":
                vers.append("v2c")
            items.append((f"SNMP community {c.get('name', cid)}",
                          f"SNMP{'/'.join(vers) or 'v1/v2c'} community enabled; hosts: {_fmt_list(hl) or 'any'}",
                          c.line))
        if items:
            return {"status": "FAIL", "items": items}
        if not users:
            return {"status": "FAIL", "severity": "LOW", "vuln": NO_VULN,
                    "evidence": "SNMP agent enabled but no SNMPv3 user configured."}
        return {"status": "PASS", "evidence": f"SNMPv3 only ({len(users)} user(s))."}

    def _cis_2_3_2(self):
        if not self._snmp_on() or not self._snmp_users():
            return {"status": "NA", "evidence": "No SNMPv3 users (or SNMP disabled)."}
        items = []
        for uid, u in self._snmp_users():
            nh = u.list("notify-hosts") + u.list("notify-hosts6")
            if not nh or any(h.startswith("0.0.0.0") or h in ("::", "::/0") for h in nh):
                items.append((f"SNMPv3 user {uid}", f"notify-hosts {_fmt_list(nh) or '(not set — any host)'}",
                              u.ln("notify-hosts")))
        return {"status": "FAIL", "items": items} if items else {"status": "PASS", "evidence": "All SNMPv3 users restricted."}

    def _cis_2_3_3(self):
        if not self._snmp_on() or not self._snmp_users():
            return {"status": "NA", "evidence": "No SNMPv3 users (or SNMP disabled)."}
        items = [(f"SNMPv3 user {uid}", f"queries {u.get('queries', 'enable (default)')}", u.ln("queries"))
                 for uid, u in self._snmp_users() if u.get("queries", "enable") != "disable"]
        return {"status": "FAIL", "items": items} if items else {"status": "PASS", "evidence": "queries disabled per user."}

    def _cis_2_3_4(self):
        if not self._snmp_on():
            return {"status": "NA", "evidence": "SNMP agent disabled."}
        si = self.gnode("system snmp sysinfo")
        have = [k for k in ("trap-free-memory-threshold", "trap-freeable-memory-threshold") if si.has(k)]
        if len(have) == 2:
            return {"status": "PASS", "evidence": ", ".join(f"{k} {si.get(k)}" for k in have)}
        return {"status": "VERIFY", "evidence": "trap-free-memory-threshold / trap-freeable-memory-threshold left at "
                                                "FortiOS defaults — confirm memory traps are sent to your NMS."}

    # 2.4.x — administrators
    def _admins(self) -> list[tuple[str, FNode]]:
        an = self.gnode("system admin")
        return list(an.edits.items()) if an else []

    @staticmethod
    def _trusthosts(a: FNode) -> list[str]:
        out = []
        for k, (v, _ln) in a.settings.items():
            if re.match(r'^(ip6-)?trusthost\d+$', k):
                val = " ".join(v)
                if val not in ("0.0.0.0 0.0.0.0", "0.0.0.0/0", "::/0", "::"):
                    out.append(val)
        return out

    def _cis_2_4_1(self):
        for name, a in self._admins():
            if name == "admin":
                return {"status": "FAIL", "line": a.line,
                        "evidence": f"Default 'admin' account still present (profile {a.get('accprofile', '?')})."}
        return {"status": "PASS", "evidence": "No account named 'admin'."}

    def _cis_2_4_2(self):
        items = []
        for name, a in self._admins():
            if not self._trusthosts(a):
                items.append((f"admin {name}", f"no trusted hosts — can log in from any address "
                              f"(profile {a.get('accprofile', '?')})", a.line))
        return {"status": "FAIL", "items": items} if items else \
            {"status": "PASS", "evidence": "Every admin account has trusted hosts."}

    def _cis_2_4_3(self):
        rows = []
        for name, a in self._admins():
            auth = "remote" if a.get("remote-auth") == "enable" else "local"
            rows.append(f"{name}: profile={a.get('accprofile', '?')}, auth={auth}, "
                        f"2FA={a.get('two-factor', 'disable')}, vdom={_fmt_list(a.list('vdom')) or '-'}")
        supers = [n for n, a in self._admins() if a.get("accprofile") == "super_admin"]
        ev = "\n".join(rows) + (f"\n{len(supers)} super_admin account(s): {', '.join(supers)}" if supers else "")
        return {"status": "MANUAL", "severity": "LOW", "evidence": ev or "No admin accounts found."}

    def _cis_2_4_4(self):
        val, ln, dflt = self.eff("system global", "admintimeout")
        ev = f"admintimeout {self._show(val, dflt)} min"
        if not val.isdigit() or int(val) > 5:
            return {"status": "FAIL", "evidence": ev + " — CIS: 5 minutes",
                    "severity": "MEDIUM" if val.isdigit() and int(val) > 15 else "LOW", "line": ln}
        return {"status": "PASS", "evidence": ev}

    def _cis_2_4_5(self):
        items = []
        for i in self.interfaces:
            bad = [a for a in i["allowaccess"] if a in ("http", "telnet")]
            if bad:
                items.append((f"interface {i['name']}", f"allowaccess {' '.join(i['allowaccess'])} — cleartext: "
                              f"{', '.join(bad)}", i["node"].ln("allowaccess")))
        return {"status": "FAIL", "items": items} if items else \
            {"status": "PASS", "evidence": "No interface allows HTTP or Telnet administration."}

    def _local_in(self) -> list[tuple[str, str, FNode]]:
        out = []
        for label, ln in self.all_nodes("firewall local-in-policy") + self.all_nodes("firewall local-in-policy6"):
            for pid, p in ln.edits.items():
                out.append((label, pid, p))
        return out

    def _cis_2_4_6(self):
        lip = self._local_in()
        if not lip:
            return {"status": "FAIL", "evidence": "No local-in policies — management access is restricted only by "
                                                  "interface allowaccess and admin trusted hosts."}
        rows = [f"{self._scope_tag(l)}{pid}: intf={_fmt_list(p.list('intf'))} src={_fmt_list(p.list('srcaddr'))} "
                f"svc={_fmt_list(p.list('service'))} action={p.get('action', 'deny')} "
                f"status={p.get('status', 'enable')}" for l, pid, p in lip]
        return {"status": "MANUAL", "severity": "LOW", "evidence": "Review local-in policies:\n" + "\n".join(rows)}

    def _cis_2_4_7(self):
        port, pl, pd = self.eff("system global", "admin-port")
        sport, sl, sd = self.eff("system global", "admin-sport")
        ev = f"admin-port {self._show(port, pd)}; admin-sport {self._show(sport, sd)}"
        if port == "80" or sport == "443":
            return {"status": "FAIL", "evidence": ev, "line": pl if not pd else (sl if not sd else "")}
        return {"status": "PASS", "evidence": ev}

    def _cis_2_4_8(self):
        lip = self._local_in()
        vp = [pid for _l, pid, p in lip if p.get("virtual-patch") == "enable"]
        if vp:
            return {"status": "PASS", "evidence": f"virtual-patch enabled on local-in policy {', '.join(vp)}"}
        return {"status": "FAIL", "evidence": "No local-in policy with 'set virtual-patch enable' "
                                              "(needs the FortiGuard OT/virtual-patching service)."}

    # 2.5.x — HA
    def _ha_mode(self) -> tuple[str, bool]:
        mode, _l, dflt = self.eff("system ha", "mode")
        return mode, dflt

    def _cis_2_5_1(self):
        mode, dflt = self._ha_mode()
        if mode == "standalone":
            return {"status": "FAIL", "evidence": f"system ha mode {self._show(mode, dflt)} — no HA cluster"}
        return {"status": "PASS", "evidence": f"system ha mode {mode}"}

    def _cis_2_5_2(self):
        mode, _ = self._ha_mode()
        if mode == "standalone":
            return {"status": "NA", "evidence": "HA not enabled."}
        ha = self.gnode("system ha")
        mon = ha.list("monitor") if ha else []
        if not mon:
            return {"status": "FAIL", "evidence": "HA enabled but no monitored interfaces ('set monitor')."}
        return {"status": "PASS", "evidence": f"monitor {' '.join(mon)}", "line": ha.ln("monitor")}

    def _cis_2_5_3(self):
        mode, _ = self._ha_mode()
        if mode == "standalone":
            return {"status": "NA", "evidence": "HA not enabled."}
        ha = self.gnode("system ha")
        st = ha.get("ha-mgmt-status", "disable") if ha else "disable"
        mi = ha.sub("ha-mgmt-interfaces") if ha else None
        ifs = [e.get("interface", "?") for _, e in (mi.edits.items() if mi else [])]
        if st != "enable" or not ifs:
            return {"status": "FAIL", "evidence": f"ha-mgmt-status {st}; reserved mgmt interfaces: "
                                                  f"{_fmt_list(ifs) or '(none)'}", "line": ha.line if ha else ""}
        return {"status": "PASS", "evidence": f"reserved mgmt interface(s) {', '.join(ifs)}"}

    def _cis_2_5_4(self):
        mode, _ = self._ha_mode()
        if mode == "standalone":
            return {"status": "NA", "evidence": "HA not enabled."}
        gid, gl, gd = self.eff("system ha", "group-id")
        if gid in ("", "0"):
            return {"status": "FAIL", "evidence": f"group-id {self._show(gid, gd)}"}
        return {"status": "PASS", "evidence": f"group-id {gid}", "line": gl}

    # 3.x — policies
    def _cis_3_1(self):
        enabled = [p for p in self.policies if p["status"] == "enable"]
        return {"status": "MANUAL", "severity": "LOW",
                "evidence": f"{len(enabled)} enabled policy(ies). A configuration file has no hit counts — "
                            "review 'Policy & Objects > Firewall Policy' (Bytes/Hit Count/Last Used) or "
                            "'diagnose firewall iprope show 100004' and remove unused policies."}

    def _active_accept(self) -> list[dict]:
        return [p for p in self.policies if p["status"] == "enable" and p["action"] == "accept"]

    def _cis_3_2(self):
        items = []
        for p in self._active_accept():
            if self._pol_any(p)[2]:
                items.append((self._pol_label(p), f"service {_fmt_list(p['service'])} (any service)\n\n"
                              + self._pol_summary(p), p["line"]))
        if not self._active_accept():
            return {"status": "NA", "evidence": "No enabled accept policies."}
        return {"status": "FAIL", "items": items} if items else \
            {"status": "PASS", "evidence": "No accept policy uses ALL / any service."}

    def _cis_3_3(self):
        deny = [p for p in self.policies if p["status"] == "enable" and p["action"] == "deny"]
        inbound = set().union(*[set(p["isdb_src"]) for p in deny]) if deny else set()
        outbound = set().union(*[set(p["isdb_dst"]) for p in deny]) if deny else set()
        miss_in = [n for n in ISDB_MALICIOUS_INBOUND if n not in inbound]
        miss_out = [n for n in ISDB_MALICIOUS_OUTBOUND if n not in outbound]
        if not miss_in and not miss_out:
            return {"status": "PASS", "evidence": "Deny policies cover the CIS ISDB list inbound and outbound."}
        parts = []
        if miss_in:
            parts.append(f"inbound (internet-service-src-name) deny missing: {', '.join(miss_in)}")
        if miss_out:
            parts.append(f"outbound (internet-service-name) deny missing: {', '.join(miss_out)}")
        return {"status": "FAIL", "evidence": "; ".join(parts)}

    def _cis_3_4(self):
        items = []
        for p in self.policies:
            if p["status"] != "enable":
                continue
            if p["action"] == "accept" and p["logtraffic"] != "all":
                items.append((self._pol_label(p), f"logtraffic {p['logtraffic']}"
                              + (" (default — security events only)" if p["logtraffic"] == "utm" else ""),
                              p["line"]))
            elif p["action"] == "deny" and p["log_explicit"] and p["logtraffic"] == "disable":
                items.append((self._pol_label(p), "deny policy with logtraffic disable", p["line"]))
        if not self.policies:
            return {"status": "NA", "evidence": "No firewall policies."}
        return {"status": "FAIL", "items": items} if items else \
            {"status": "PASS", "evidence": "All enabled policies log all sessions."}

    # 4.x — security profiles
    def _profile_scope(self) -> list[dict]:
        """Accept policies the security-profile checks apply to: traffic to or
        from the WAN (or 'any') when WAN interfaces are known, else all."""
        acc = self._active_accept()
        if not self.wan_intfs:
            return acc
        scoped = [p for p in acc if p["from_wan"] or p["to_wan"] or p["any_intf"]]
        return scoped or acc

    def _apply_check(self, key: str, label: str):
        pols = self._profile_scope()
        if not pols:
            return {"status": "NA", "evidence": "No enabled accept policies."}
        missing = [p for p in pols if not p["profiles"][key]]
        if not missing:
            used = sorted({p["profiles"][key] for p in pols})
            return {"status": "PASS", "evidence": f"{label} applied on all {len(pols)} in-scope policies "
                                                  f"({', '.join(used)})."}
        return {"status": "FAIL", "line": ", ".join(str(p["line"]) for p in missing[:50]),
                "evidence": f"{len(missing)} of {len(pols)} internet-facing accept policies have no {label}: "
                            + _fmt_list([self._pol_label(p) for p in missing], 40)}

    def _used_profiles(self, key: str) -> set[str]:
        return {p["profiles"][key] for p in self._active_accept() if p["profiles"][key]}

    def _profile_nodes(self, path: str, key: str) -> list[tuple[str, str, FNode]]:
        """(vdom, name, node) for the profiles of one type that accept policies use."""
        used = self._used_profiles(key)
        out = []
        for label, pn in self.all_nodes(path):
            for name, n in pn.edits.items():
                if name in used:
                    out.append((label, name, n))
        # Predefined profiles (e.g. 'default') that a backup omits when unchanged.
        found = {n for _, n, _ in out}
        for name in used - found:
            out.append(("", name, FNode(name, 0, is_edit=True)))
        return out

    def _cis_4_1_1(self):
        used = self._used_profiles("ips")
        if not used:
            return {"status": "FAIL", "evidence": "No IPS sensor applied to any accept policy.", "vuln": 31}
        blocking = [name for _l, name, n in self._profile_nodes("ips sensor", "ips")
                    if n.get("scan-botnet-connections", "disable") == "block"]
        if blocking:
            return {"status": "PASS", "evidence": f"scan-botnet-connections block in IPS sensor(s) {', '.join(blocking)}"}
        return {"status": "FAIL", "evidence": f"IPS sensor(s) in use ({', '.join(sorted(used))}) do not set "
                                              "scan-botnet-connections block"}

    def _cis_4_1_2(self):
        return self._apply_check("ips", "IPS sensor")

    def _cis_4_2_1(self):
        st, sl, sd = self.eff("system autoupdate schedule", "status")
        fr, fl, fd = self.eff("system autoupdate schedule", "frequency")
        ev = f"status {self._show(st, sd)}; frequency {self._show(fr, fd)}"
        if st != "enable" or fr != "automatic":
            return {"status": "FAIL", "evidence": ev + " (CIS: enable / automatic)", "line": sl if not sd else ""}
        return {"status": "PASS", "evidence": ev}

    def _cis_4_2_2(self):
        return self._apply_check("av", "antivirus profile")

    _AV_PROTOS = ("http", "ftp", "imap", "pop3", "smtp", "mapi", "nntp", "cifs", "ssh")

    def _cis_4_2_3(self):
        profs = self._profile_nodes("antivirus profile", "av")
        if not profs:
            return {"status": "NA", "evidence": "No antivirus profile in use (see 4.2.2)."}
        items = []
        for label, name, n in profs:
            protos = [p for p in self._AV_PROTOS if n.sub(p) is not None] or ["http", "ftp", "imap", "pop3", "smtp"]
            bad = [p for p in protos if (n.sub(p).get("outbreak-prevention", "disable") if n.sub(p) else "disable")
                   != "block"]
            if bad:
                items.append((f"{self._scope_tag(label)}AV profile {name}",
                              f"outbreak-prevention not 'block' for: {', '.join(bad)}", n.line))
        return {"status": "FAIL", "items": items} if items else \
            {"status": "PASS", "evidence": "Outbreak prevention blocks on all AV profiles in use."}

    def _av_setting(self, key: str, want_ok: tuple[str, ...]):
        val, ln, dflt = self.eff("antivirus settings", key)
        ev = f"antivirus settings {key} {self._show(val, dflt)}"
        if val not in want_ok:
            return {"status": "FAIL", "evidence": ev, "line": ln if not dflt else ""}
        return {"status": "PASS", "evidence": ev}

    def _cis_4_2_4(self):
        return self._av_setting("machine-learning-detection", ("enable",))

    def _cis_4_2_5(self):
        return self._av_setting("grayware", ("enable",))

    def _cis_4_2_6(self):
        inline, il, idf = self.eff("system fortiguard", "sandbox-inline-scan")
        profs = self._profile_nodes("antivirus profile", "av")
        inline_profs = [name for _l, name, n in profs if n.get("fortisandbox-mode") == "inline"]
        ev = (f"system fortiguard sandbox-inline-scan {self._show(inline, idf)}; AV profiles with "
              f"fortisandbox-mode inline: {_fmt_list(inline_profs) or '(none)'}")
        if inline != "enable" or not inline_profs:
            return {"status": "FAIL", "evidence": ev + " (requires the FortiGuard AI-based inline sandbox license)",
                    "line": il if not idf else ""}
        return {"status": "PASS", "evidence": ev}

    def _cis_4_2_7(self):
        profs = self._profile_nodes("antivirus profile", "av")
        if not profs:
            return {"status": "NA", "evidence": "No antivirus profile in use."}
        cdr = []
        for _l, name, n in profs:
            cd = n.sub("content-disarm")
            proxy = n.get("feature-set") == "proxy"
            on = any((n.sub(p).get("content-disarm") == "enable") for p in ("http", "imap", "pop3", "smtp") if n.sub(p))
            if proxy and on and cd is not None:
                cdr.append(name)
        if cdr:
            return {"status": "PASS", "evidence": f"CDR enabled (proxy mode) on AV profile(s) {', '.join(cdr)}"}
        return {"status": "FAIL", "evidence": "No AV profile in use runs proxy-mode feature-set with content-disarm "
                                              f"enabled (profiles in use: {', '.join(n for _, n, _ in profs)})"}

    def _cis_4_3_1(self):
        profs = self._profile_nodes("dnsfilter profile", "dns")
        if not profs:
            return {"status": "FAIL", "evidence": "No DNS filter profile applied to any accept policy.", "vuln": 31}
        bad = [name for _l, name, n in profs if n.get("block-botnet", "disable") != "enable"]
        if bad:
            return {"status": "FAIL", "evidence": f"block-botnet not enabled in DNS filter profile(s) {', '.join(bad)}"}
        return {"status": "PASS", "evidence": "Botnet C&C domain blocking on all DNS filter profiles in use."}

    def _cis_4_3_2(self):
        profs = self._profile_nodes("dnsfilter profile", "dns")
        if not profs:
            return {"status": "NA", "evidence": "No DNS filter profile in use (see 4.3.3)."}
        items = [(f"{self._scope_tag(l)}DNS filter profile {name}",
                  f"log-all-domain {n.get('log-all-domain', 'disable (default)')}", n.line)
                 for l, name, n in profs if n.get("log-all-domain", "disable") != "enable"]
        return {"status": "FAIL", "items": items} if items else {"status": "PASS", "evidence": "log-all-domain enabled."}

    def _cis_4_3_3(self):
        return self._apply_check("dns", "DNS filter profile")

    def _cis_4_4_1(self):
        return self._apply_check("web", "web filter profile")

    def _cis_4_5_1(self):
        profs = self._profile_nodes("application list", "app")
        if not profs:
            return {"status": "FAIL", "evidence": "No application control list applied to any accept policy."}
        ok = []
        for _l, name, n in profs:
            ent = n.sub("entries")
            blocked = set()
            for _eid, e in (ent.edits.items() if ent else []):
                if e.get("action", "block") in ("block", "reset"):
                    blocked |= set(e.list("category"))
            if {"2", "6"} <= blocked:
                ok.append(name)
        if len(ok) == len(profs):
            return {"status": "PASS", "evidence": f"P2P (2) and Proxy (6) blocked in {', '.join(ok)}"}
        bad = [n for _, n, _ in profs if n not in ok]
        return {"status": "FAIL", "evidence": f"Application list(s) {', '.join(bad)} do not block the high-risk "
                                              "categories P2P (2) and Proxy (6)"}

    def _cis_4_5_2(self):
        profs = self._profile_nodes("application list", "app")
        if not profs:
            return {"status": "NA", "evidence": "No application control list in use (see 4.5.4)."}
        items = [(f"{self._scope_tag(l)}application list {name}",
                  f"enforce-default-app-port {n.get('enforce-default-app-port', 'disable (default)')}", n.line)
                 for l, name, n in profs if n.get("enforce-default-app-port", "disable") != "enable"]
        return {"status": "FAIL", "items": items} if items else {"status": "PASS", "evidence": "enforce-default-app-port enabled."}

    def _cis_4_5_3(self):
        profs = self._profile_nodes("application list", "app")
        if not profs:
            return {"status": "NA", "evidence": "No application control list in use (see 4.5.4)."}
        items = []
        for l, name, n in profs:
            probs = []
            if n.get("unknown-application-log", "disable") != "enable":
                probs.append("unknown-application-log disable")
            ent = n.sub("entries")
            nolog = [eid for eid, e in (ent.edits.items() if ent else []) if e.get("log", "enable") == "disable"]
            if nolog:
                probs.append(f"entries without logging: {', '.join(nolog)}")
            if probs:
                items.append((f"{self._scope_tag(l)}application list {name}", "; ".join(probs), n.line))
        return {"status": "FAIL", "items": items} if items else {"status": "PASS", "evidence": "Application control logs all traffic."}

    def _cis_4_5_4(self):
        return self._apply_check("app", "application control list")

    def _cis_5_1_1(self):
        for label, sn in self.all_nodes("system automation-stitch"):
            st = sn.edits.get("Compromised Host Quarantine")
            if st is not None:
                if st.get("status", "enable") == "enable":
                    return {"status": "PASS", "evidence": "automation-stitch 'Compromised Host Quarantine' enabled",
                            "line": st.line}
                return {"status": "FAIL", "evidence": "automation-stitch 'Compromised Host Quarantine' status disable",
                        "line": st.ln("status")}
        return {"status": "FAIL", "evidence": "automation-stitch 'Compromised Host Quarantine' not present / not enabled"}

    def _cis_5_2_1_1(self):
        st, sl, sd = self.eff("system csf", "status")
        if st != "enable":
            return {"status": "FAIL", "evidence": f"system csf status {self._show(st, sd)}", "line": sl if not sd else ""}
        return {"status": "PASS", "evidence": "Security Fabric enabled"}

    # 6.x — SSL VPN
    def _sslvpn(self) -> list[tuple[str, FNode]]:
        out = []
        for label, n in self.all_nodes("vpn ssl settings"):
            if n.list("source-interface") and n.get("status", "enable") == "enable":
                out.append((label, n))
        return out

    def _cis_6_1_1(self):
        vpns = self._sslvpn()
        if not vpns:
            return {"status": "NA", "evidence": "SSL VPN not enabled (no source-interface)."}
        items = []
        for label, n in vpns:
            cert = n.get("servercert", "Fortinet_Factory")
            if cert in ("Fortinet_Factory", "self-sign", "Fortinet_SSL", "Fortinet_GUI_Server") or cert.startswith("Fortinet_"):
                items.append((f"{self._scope_tag(label)}vpn ssl settings",
                              f"servercert {cert}{' (default)' if not n.has('servercert') else ''} — factory/self-signed "
                              "certificate", n.ln("servercert")))
        return {"status": "FAIL", "items": items} if items else \
            {"status": "VERIFY", "evidence": "; ".join(f"servercert {n.get('servercert')}" for _, n in vpns)
                                           + " — confirm it is issued by a trusted CA and unexpired"}

    def _cis_6_1_2(self):
        vpns = self._sslvpn()
        if not vpns:
            return {"status": "NA", "evidence": "SSL VPN not enabled (no source-interface)."}
        items = []
        for label, n in vpns:
            mn, _, mnd = self.eff("vpn ssl settings", "ssl-min-proto-ver", n)
            mx, _, mxd = self.eff("vpn ssl settings", "ssl-max-proto-ver", n)
            al, _, ald = self.eff("vpn ssl settings", "algorithm", n)
            probs, weak = [], False
            if mn != "tls1-2" and mn != "tls1-3":
                probs.append(f"ssl-min-proto-ver {mn}")
                weak = True
            if al != "high":
                probs.append(f"algorithm {al}")
                weak = True
            if mx != "tls1-3":
                probs.append(f"ssl-max-proto-ver {mx}")
            if probs:
                # Weak Cipher Suite only when old TLS / non-high ciphers are actually allowed.
                items.append((f"{self._scope_tag(label)}vpn ssl settings", "; ".join(probs),
                              n.ln("ssl-min-proto-ver"), 33 if weak else NO_VULN))
        return {"status": "FAIL", "items": items} if items else {"status": "PASS", "evidence": "TLS 1.2–1.3, high ciphers."}

    # 7.x — logging
    def _cis_7_1_1(self):
        val, ln, dflt = self.eff("log eventfilter", "event")
        if val != "enable":
            return {"status": "FAIL", "evidence": f"log eventfilter event {self._show(val, dflt)}", "line": ln}
        return {"status": "PASS", "evidence": f"log eventfilter event {self._show(val, dflt)}"}

    def _log_targets(self) -> list[str]:
        out = []
        if self.eff("log fortianalyzer setting", "status")[0] == "enable":
            out.append(f"FortiAnalyzer {self.gnode('log fortianalyzer setting').get('server', '')}".strip())
        for i in ("2", "3"):
            n = self.gnode(f"log fortianalyzer{i} setting")
            if n is not None and n.get("status") == "enable":
                out.append(f"FortiAnalyzer{i} {n.get('server', '')}".strip())
        if self.eff("log fortiguard setting", "status")[0] == "enable":
            out.append("FortiAnalyzer Cloud / FortiCloud")
        for sd in ("syslogd", "syslogd2", "syslogd3", "syslogd4"):
            n = self.gnode(f"log {sd} setting")
            if n is not None and n.get("status") == "enable":
                out.append(f"{sd} {n.get('server', '')}".strip())
        return out

    def _cis_7_2_1(self):
        t = self._log_targets()
        if not t:
            return {"status": "FAIL", "evidence": "No FortiAnalyzer, FortiCloud or syslog log destination enabled."}
        return {"status": "PASS", "evidence": "Log destinations: " + ", ".join(t)}

    def _cis_7_3_1(self):
        if self.eff("log fortianalyzer setting", "status")[0] != "enable":
            return {"status": "NA", "evidence": "FortiAnalyzer logging not enabled."}
        rel, rl, rd = self.eff("log fortianalyzer setting", "reliable")
        enc, el, ed = self.eff("log fortianalyzer setting", "enc-algorithm")
        ev = f"reliable {self._show(rel, rd)}; enc-algorithm {self._show(enc, ed)}"
        if rel != "enable" or enc not in ("high", "high-medium"):
            # Unencrypted Log Traffic only if encryption is actually off; 'low' = weak cipher;
            # reliable disabled alone still sends encrypted logs.
            vuln = 50 if enc == "disable" else (33 if enc == "low" else NO_VULN)
            return {"status": "FAIL", "evidence": ev, "vuln": vuln,
                    "line": self.gnode("log fortianalyzer setting").line}
        return {"status": "PASS", "evidence": ev}

    def _syslog_enc(self, devices: tuple[str, ...]):
        items, enabled = [], 0
        for sd in devices:
            n = self.gnode(f"log {sd} setting")
            if n is None or n.get("status") != "enable":
                continue
            enabled += 1
            mode, _, md = self.eff(f"log {sd} setting", "mode", n)
            enc, _, ed = self.eff(f"log {sd} setting", "enc-algorithm", n)
            if mode != "reliable" or enc not in ("high", "high-medium"):
                # UDP or enc-algorithm disable = cleartext (50); 'low' over TLS = weak cipher (33).
                v = 33 if (mode == "reliable" and enc == "low") else 50
                items.append((f"log {sd} setting (server {n.get('server', '?')})",
                              f"mode {self._show(mode, md)}; enc-algorithm {self._show(enc, ed)}", n.line, v))
        if not enabled:
            return {"status": "NA", "evidence": f"{'/'.join(devices)} not enabled."}
        return {"status": "FAIL", "items": items} if items else {"status": "PASS", "evidence": "Syslog over TLS (reliable, high)."}

    def _cis_7_3_2(self):
        return self._syslog_enc(("syslogd",))

    def _cis_7_3_3(self):
        return self._syslog_enc(("syslogd2", "syslogd3", "syslogd4"))

    # ══ Native checks (vulns.txt taxonomy, beyond the CIS benchmark) ══════════
    def _run_native_checks(self):
        self._native_policies()
        self._native_shadow()
        self._native_profiles()
        self._native_auth()
        self._native_crypto()
        self._native_logging()
        self._native_interfaces()

    def _native_policies(self):
        for p in self.policies:
            label = self._pol_label(p)
            full = self._pol_summary(p)
            if p["status"] == "disable":
                self._issue("LOW", "Disabled Firewall Policy", "", label,
                            f"{label} is disabled but still present in the policy table.",
                            "Delete policies that are no longer needed instead of leaving them disabled.",
                            details=full, line=p["line"])
                continue
            if not p["comments"].strip():
                self._issue("LOW", "Missing Policy Comment", "", label,
                            f"{label} has no comment describing its business purpose / owner.",
                            "Add a comment (set comments) with the business justification, owner and ticket.",
                            details=full, line=p["line"])
            if p["action"] != "accept":
                continue
            src_any, dst_any, svc_any = self._pol_any(p)
            if src_any and dst_any:
                self._issue("HIGH", "Policy Allows Any Source And Destination", "", label,
                            f"Accept policy {label} permits any source to any destination.",
                            "Restrict source and destination to the specific networks/hosts required.",
                            details=full, line=p["line"])
            elif src_any:
                self._issue("HIGH" if p["from_wan"] and svc_any else "MEDIUM", "Policy Allows Any Source", "", label,
                            f"Accept policy {label} permits traffic from any source"
                            + (" on a WAN interface (inbound from the internet)." if p["from_wan"] else "."),
                            "Restrict the source to the networks/hosts that require access (or ISDB/geo objects "
                            "for internet-facing services).", details=full, line=p["line"])
            elif dst_any and not p["to_wan"]:
                self._issue("MEDIUM", "Policy Allows Any Destination", "", label,
                            f"Accept policy {label} permits traffic to any destination on an internal interface.",
                            "Restrict the destination to the specific networks/hosts required.",
                            details=full, line=p["line"])
            insecure = set()
            for s in p["service"]:
                insecure |= self._svc_info(s, p["vnode"])[1]
            if insecure:
                self._issue("HIGH" if {"Telnet", "rlogin", "rsh", "rexec"} & insecure else "MEDIUM",
                            "Policy Permits Insecure Protocol", "", label,
                            f"Accept policy {label} permits cleartext protocol(s): {', '.join(sorted(insecure))}.",
                            "Replace with encrypted equivalents (SSH, SFTP/FTPS, HTTPS, SNMPv3) or document the "
                            "business justification and compensating controls (PCI DSS 1.2.6 / 2.2.5).",
                            details=f"Services: {_fmt_list(p['service'])}\n\n{full}", line=p["line"])

    def _native_shadow(self):
        by_vdom: dict[tuple[str, str], list[dict]] = defaultdict(list)
        for p in self.policies:
            if p["status"] == "enable" and p["kind"] == "firewall policy":
                by_vdom[(p["vdom"], p["kind"])].append(p)
        for _k, pols in by_vdom.items():
            if len(pols) > 4000:
                print(f"[!] {len(pols)} policies in one VDOM — shadow analysis skipped (too many to compare).")
                continue
            cache = {}

            def norm(p):
                if p["id"] not in cache:
                    s_any, d_any, v_any = self._pol_any(p)
                    cache[p["id"]] = (s_any, d_any, v_any)
                return cache[p["id"]]

            for j, b in enumerate(pols):
                if b["isdb_src"] or b["isdb_dst"] or b["src_negate"] or b["dst_negate"] or b["svc_negate"]:
                    continue
                for a in pols[:j]:
                    if a["isdb_src"] or a["isdb_dst"] or a["src_negate"] or a["dst_negate"] or a["svc_negate"]:
                        continue
                    if a["users"] or a["groups"] or a["app"]:
                        continue
                    if a["schedule"] not in ("always", b["schedule"]):
                        continue
                    a_s, a_d, a_v = norm(a)

                    def covers(ax, bx, a_any):
                        return a_any or (bx and set(bx) <= set(ax))
                    if not ("any" in a["srcintf"] or set(b["srcintf"]) <= set(a["srcintf"])):
                        continue
                    if not ("any" in a["dstintf"] or set(b["dstintf"]) <= set(a["dstintf"])):
                        continue
                    if not covers(a["srcaddr"], b["srcaddr"], a_s):
                        continue
                    if not covers(a["dstaddr"], b["dstaddr"], a_d):
                        continue
                    if not covers(a["service"], b["service"], a_v):
                        continue
                    lb = self._pol_label(b)
                    self._issue("MEDIUM", "Shadowed Firewall Policy", "", lb,
                                f"{lb} can never match: earlier {self._pol_label(a)} (action {a['action']}) "
                                "already covers all of its interfaces, addresses, services and schedule.",
                                "Remove the shadowed policy, or move it above the broader one if it is meant "
                                "to take effect.",
                                details=f"Shadowing policy:\n{self._pol_summary(a)}\n\nShadowed policy:\n"
                                        f"{self._pol_summary(b)}", line=f"{a['line']}, {b['line']}")
                    break

    def _native_profiles(self):
        scope = self._profile_scope()
        for p in scope:
            missing = [lbl for key, lbl in (("av", "Antivirus"), ("ips", "IPS"), ("web", "Web Filter"),
                                            ("app", "Application Control"), ("dns", "DNS Filter"))
                       if not p["profiles"][key]]
            if missing:
                label = self._pol_label(p)
                self._issue("HIGH" if len(missing) == 5 else "MEDIUM", "Missing Security Profile", "", label,
                            f"Internet-facing accept policy {label} has no {', '.join(missing)} profile"
                            + (" (no security profiles at all)." if len(missing) == 5 else "."),
                            "Apply AV, IPS, Web Filter, Application Control and DNS Filter profiles "
                            "(or a profile group) to every policy that carries internet traffic.",
                            details=self._pol_summary(p), line=p["line"])
        if scope:
            deep = [p for p in scope if p["profiles"]["ssl"] and p["profiles"]["ssl"] not in
                    ("certificate-inspection", "no-inspection")]
            if not deep:
                used = sorted({p["profiles"]["ssl"] or "(none)" for p in scope})
                self._issue("MEDIUM", "No Deep SSL Inspection", "", "(policy table)",
                            "No internet-facing policy uses a deep-inspection SSL/SSH profile, so AV, IPS, DLP "
                            "and web filtering cannot see inside encrypted (HTTPS) sessions.",
                            "Apply a deep-inspection ssl-ssh-profile (with exemptions for sensitive categories) "
                            "to outbound internet policies.",
                            details=f"SSL/SSH profiles in use: {', '.join(used)}")
            if not any(p["profiles"]["dlp"] for p in scope):
                self._issue("LOW", "No Data Loss Prevention Profile", "", "(policy table)",
                            "No internet-facing policy applies a DLP profile — outbound data is not filtered "
                            "for sensitive content (e.g. card numbers).",
                            "Create a DLP profile for the data types in scope (PAN, PII) and apply it to "
                            "outbound policies, or document the DLP control used instead.")
            if not any(p["users"] or p["groups"] for p in self._active_accept()) \
                    and not self.all_nodes("user fsso") and not self.all_nodes("user fsso-polling"):
                self._issue("LOW", "No User Identity In Policies", "", "(policy table)",
                            "No policy matches on users or groups and no FSSO connector is configured, so "
                            "access is granted per IP address only and logs carry no user names.",
                            "Configure FSSO / RADIUS single sign-on (or an identity-based policy) and use user "
                            "groups in policies for role-based access.")

    def _native_auth(self):
        pp = self.gnode("system password-policy")
        st = self.eff("system password-policy", "status")[0]
        line = pp.line if pp is not None else ""
        if st == "enable":
            # minimum-length < 14 with the policy on is reported by CIS 2.2.1 (vuln 15).
            weak = [k for k in ("min-lower-case-letter", "min-upper-case-letter", "min-non-alphanumeric", "min-number")
                    if self.eff("system password-policy", k)[0] in ("", "0")]
            if weak:
                self._issue("MEDIUM", "Password Complexity Not Enforced", "", "system password-policy",
                            "The password policy does not require every character class.",
                            "Set min-lower-case-letter, min-upper-case-letter, min-number and min-non-alphanumeric "
                            "to at least 1.", details="not required: " + ", ".join(weak), line=line)
            if self.eff("system password-policy", "expire-status")[0] != "enable":
                self._issue("LOW", "Password Expiry Not Enforced", "", "system password-policy",
                            "Administrator passwords never expire.",
                            "set expire-status enable / expire-day 90 (or use MFA, per PCI DSS 8.3.9).",
                            details="expire-status disable", line=line)
            if self.eff("system password-policy", "reuse-password")[0] != "disable":
                self._issue("LOW", "Password Reuse Allowed", "", "system password-policy",
                            "Administrators can reuse previous passwords.",
                            "set reuse-password disable (and reuse-password-limit 4+ where available).",
                            details="reuse-password enable", line=line)
        else:
            # CIS 2.2.1 reports the disabled policy as complexity-not-enforced (28); the
            # length gap that follows from it is its own vuln (15).
            self._issue("MEDIUM", "Password Policy Disabled (Min Length 8)", "", "system password-policy",
                        "No administrator password policy is enforced (FortiOS default minimum is 8).",
                        "Enable config system password-policy with minimum-length 14.",
                        details="password-policy status disable", line=line)
        du = self.eff("system global", "admin-lockout-duration")[0]
        if du.isdigit() and int(du) < 1800:
            self._issue("LOW", "Admin Lockout Duration Below 30 Minutes", "", "system global",
                        f"Admin lockout lasts {du} seconds; PCI DSS 8.3.4 requires at least 30 minutes "
                        "(or until an administrator unlocks the account).",
                        "set admin-lockout-duration 1800 under config system global (note: CIS 2.2.2's audit "
                        "only checks for 1–900 s; PCI DSS is the stricter requirement).",
                        details=f"admin-lockout-duration {du}")
        # NTP
        sync = self.eff("system ntp", "ntpsync")[0]
        ntype = self.eff("system ntp", "type")[0]
        if sync == "enable" and ntype == "custom":
            servers = self._ntp_servers()   # a single server is reported by CIS 2.1.4 (vuln 1)
            unauth = [s for s, _l, auth in servers if not auth]
            if unauth:
                self._issue("LOW", "NTP Authentication Not Configured", "", "system ntp",
                            "NTP servers are used without authentication, so time can be spoofed.",
                            "Enable authentication on each ntpserver (set authentication enable, key-type, key, "
                            "key-id).", details="unauthenticated: " + ", ".join(unauth))
        # SNMP
        if self._snmp_on():
            for cid, c in self._snmp_communities():
                name = c.get("name", "")
                if name.lower() in ("public", "private", "community", "snmp", "fortinet"):
                    self._issue("HIGH", "Default SNMP Community Name", "", f"SNMP community {name}",
                                f"SNMP community '{name}' is a well-known default string.",
                                "Remove v1/v2c communities and use SNMPv3 (authPriv); if v2c is unavoidable, "
                                "use a long random community restricted to NMS hosts.", line=c.line)
            for uid, u in self._snmp_users():
                lvl = u.get("security-level", "no-auth-no-priv")
                ap = u.get("auth-proto", "sha")
                pp_ = u.get("priv-proto", "aes")
                auth_probs = []
                if lvl == "no-auth-no-priv":
                    auth_probs.append("security-level no-auth-no-priv (no authentication)")
                elif ap == "md5":
                    auth_probs.append("auth-proto md5")
                if auth_probs:
                    self._issue("MEDIUM", "Weak SNMPv3 Authentication", "", f"SNMPv3 user {uid}",
                                f"SNMPv3 user {uid} does not use strong authentication.",
                                "set security-level auth-priv and auth-proto sha256 (or higher).",
                                details="; ".join(auth_probs), line=u.line)
                enc_probs = []
                if lvl != "auth-priv":
                    enc_probs.append(f"security-level {lvl} (no encryption)")
                elif pp_ == "des":
                    enc_probs.append("priv-proto des")
                if enc_probs:
                    self._issue("MEDIUM", "Weak SNMPv3 Encryption", "", f"SNMPv3 user {uid}",
                                f"SNMPv3 user {uid} does not encrypt traffic with a strong cipher.",
                                "set security-level auth-priv and priv-proto aes256.",
                                details="; ".join(enc_probs), line=u.line)
        # MFA for local admins
        for name, a in self._admins():
            if a.get("remote-auth") == "enable":
                continue
            if a.get("two-factor", "disable") == "disable":
                self._issue("MEDIUM", "Admin Without MFA", "", f"admin {name}",
                            f"Local administrator '{name}' logs in with a password only.",
                            "Enable two-factor (FortiToken, email or SMS) or move administrators to RADIUS/SAML "
                            "with MFA (PCI DSS 8.4.1, CIS 6.5).",
                            details=f"profile {a.get('accprofile', '?')}, two-factor disable", line=a.line)
        # LDAP
        for label, ln_ in self.all_nodes("user ldap"):
            for sname, s in ln_.edits.items():
                secure = s.get("secure", "disable")
                tag = f"{self._scope_tag(label)}LDAP server {sname}"
                if secure == "disable":
                    self._issue("MEDIUM", "LDAP Without TLS", "", tag,
                                f"{tag} binds over cleartext LDAP — credentials cross the network unencrypted.",
                                "set secure ldaps (or starttls) and a CA certificate.",
                                details=f"server {s.get('server', '?')}, port {s.get('port', '389')}", line=s.line)
                if s.get("server-identity-check", "enable") == "disable":
                    self._issue("MEDIUM", "LDAP Server Identity Not Verified", "", tag,
                                f"{tag} does not verify the server certificate identity.",
                                "set server-identity-check enable.", line=s.ln("server-identity-check"))

    def _native_crypto(self):
        for label, node in self.scopes():
            for path in ("vpn ipsec phase1-interface", "vpn ipsec phase1"):
                pn = node.sub(path)
                for name, p in (pn.edits.items() if pn else []):
                    tag = f"{self._scope_tag(label)}IPsec phase1 {name}"
                    props = p.list("proposal")
                    weak = [x for x in props if any(w in x.split("-") for w in WEAK_IPSEC_ALGS)]
                    if weak:
                        self._issue("HIGH" if any("des" in x.split("-") or "md5" in x.split("-") for x in weak)
                                    else "MEDIUM", "Weak IPsec Proposal", "", tag,
                                    f"{tag} offers weak IKE proposal(s): {', '.join(weak)}.",
                                    "Use AES-GCM/AES-256 with SHA-256 or better (e.g. aes256gcm-prfsha384, "
                                    "aes256-sha256).", details=f"proposal {' '.join(props)}", line=p.ln("proposal"))
                    dh = p.list("dhgrp")
                    weakdh = [g for g in dh if g in WEAK_DH_GROUPS]
                    if weakdh:
                        self._issue("MEDIUM", "Weak IPsec DH Group", "", tag,
                                    f"{tag} allows weak Diffie-Hellman group(s) {', '.join(weakdh)}.",
                                    "Use DH group 19, 20, 21 (ECP) or 15+; never 1, 2 or 5.",
                                    details=f"dhgrp {' '.join(dh)}", line=p.ln("dhgrp"))
                    if p.get("ike-version", "1") == "1" and p.get("mode", "main") == "aggressive":
                        self._issue("HIGH", "IKEv1 Aggressive Mode", "", tag,
                                    f"{tag} uses IKEv1 aggressive mode, which exposes a crackable PSK hash.",
                                    "Move the tunnel to IKEv2 (set ike-version 2), or at least main mode.",
                                    details="ike-version 1, mode aggressive", line=p.ln("mode"))
            for path in ("vpn ipsec phase2-interface", "vpn ipsec phase2"):
                pn = node.sub(path)
                for name, p in (pn.edits.items() if pn else []):
                    tag = f"{self._scope_tag(label)}IPsec phase2 {name}"
                    if p.get("pfs", "enable") == "disable":
                        self._issue("MEDIUM", "IPsec PFS Disabled", "", tag,
                                    f"{tag} has Perfect Forward Secrecy disabled.",
                                    "set pfs enable with a strong dhgrp (19/20/21).",
                                    details=f"phase1 {p.get('phase1name', '?')}", line=p.ln("pfs"))
                    props = p.list("proposal")
                    weak = [x for x in props if any(w in x.split("-") for w in WEAK_IPSEC_ALGS)]
                    if weak:
                        self._issue("MEDIUM", "Weak IPsec Proposal", "", tag,
                                    f"{tag} offers weak ESP proposal(s): {', '.join(weak)}.",
                                    "Use aes256gcm or aes256-sha256.", details=f"proposal {' '.join(props)}",
                                    line=p.ln("proposal"))
        # Weak admin-GUI / SSL VPN TLS versions are CIS 2.1.10 / 6.1.2 findings (vuln 33).
        g = self.gnode("system global")
        if g is not None:
            for key in ("ssh-enc-algo", "ssh-mac-algo", "ssh-kex-algo"):
                vals = g.list(key)
                weak = [v for v in vals if any(w in v.lower() for w in WEAK_SSH_ALGS)]
                if weak:
                    self._issue("MEDIUM", "Weak SSH Algorithms", "", "system global",
                                f"SSH administration allows weak {key}: {', '.join(weak)}.",
                                f"Remove the weak values from {key}.", details=f"{key} {' '.join(vals)}",
                                line=g.ln(key))
        cert, cl, cd = self.eff("system global", "admin-server-cert")
        if cert in ("self-sign", "Fortinet_Factory", "Fortinet_GUI_Server"):
            self._issue("LOW", "Self-Signed Admin GUI Certificate", "", "system global",
                        f"The admin GUI uses the built-in '{cert}' certificate, so administrators cannot "
                        "verify they are connecting to the real device.",
                        "Install a certificate from the organization's CA and set admin-server-cert to it.",
                        details=f"admin-server-cert {self._show(cert, cd)}", line=cl if not cd else "")

    def _native_logging(self):
        for sd in ("syslogd", "syslogd2", "syslogd3", "syslogd4"):
            n = self.gnode(f"log {sd} setting")
            if n is None or n.get("status") != "enable":
                continue
            mode, _, md = self.eff(f"log {sd} setting", "mode", n)
            if mode == "udp":
                self._issue("MEDIUM", "Syslog Over UDP", "", f"log {sd} setting",
                            f"Logs to {n.get('server', '?')} are sent over UDP — unreliable and unencrypted.",
                            "set mode reliable and enc-algorithm high (TLS syslog).",
                            details=f"mode {self._show(mode, md)}", line=n.line)
        for path in ("log fortianalyzer setting", "log fortianalyzer2 setting", "log fortianalyzer3 setting"):
            n = self.gnode(path)
            if n is not None and n.get("status") == "enable" and n.get("certificate-verification", "enable") == "disable":
                self._issue("MEDIUM", "Log Server Certificate Not Verified", "", path,
                            "The FortiGate does not verify the FortiAnalyzer certificate, so logs could be sent "
                            "to an impostor.", "set certificate-verification enable (with serial / certificate "
                            "configured).", line=n.ln("certificate-verification"))

    def _native_interfaces(self):
        used = set()
        for p in self.policies:
            used |= set(p["srcintf"]) | set(p["dstintf"])
        for zm in self._zone_members().values():
            used |= set(zm)
        for i in self.interfaces:
            if i["parent"]:
                used.add(i["parent"])
            used |= set(i["members"])
        ha = self.gnode("system ha")
        if ha is not None:
            used |= {x for x in ha.list("hbdev") if not x.isdigit()}
            used |= set(ha.list("monitor"))
        for label, sw in self.all_nodes("system virtual-switch"):
            for _n, s in sw.edits.items():
                pn = s.sub("port")
                used |= set(pn.edits) if pn else set()
        for i in self.interfaces:
            if i["type"] in ("physical", "aggregate", "vlan", "redundant") and (i["ip"] or i["mode"] == "dhcp") \
                    and not i["description"] and not i["alias"]:
                self._issue("INFO", "Interface Missing Description", "", f"interface {i['name']}",
                            f"Interface {i['name']} has no description or alias.",
                            "Add a description (set description) naming the connected network / circuit.",
                            details=f"ip {i['ip'] or i['mode']}, role {i['role'] or '-'}", line=i["line"])
            if i["type"] == "physical" and not i["ip"] and i["mode"] != "dhcp" and i["status"] != "down" \
                    and i["name"] not in used and not i["dedicated"] and i["name"] not in self.wan_intfs:
                self._issue("LOW", "Unused Interface Not Shut Down", "", f"interface {i['name']}",
                            f"Physical interface {i['name']} has no IP, is not used by any policy/zone/HA and "
                            "is administratively up.", "set status down on unused ports.", line=i["line"])


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
    STATUS_COLORS = {
        "PASS":   ("375623", "E2EFDA"),
        "FAIL":   ("C00000", "FFB3B3"),
        "MANUAL": ("7F6000", "FFF2CC"),
        "VERIFY": ("1F4E79", "DDEBF7"),
        "NA":     ("595959", "F2F2F2"),
    }

    def __init__(self, parser: FortigateParser, output_file: str):
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

    def _table(self, ws, headers, rows, widths, center_cols=(), disabled_col=None, height=None):
        """Generic inventory table. rows: list of value lists."""
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"
        for r_i, vals in enumerate(rows, 2):
            disabled = disabled_col is not None and str(vals[disabled_col]).lower() in ("disable", "disabled", "down")
            bg = self._row_fill(r_i, disabled)
            for c_i, v in enumerate(vals, 1):
                c = ws.cell(row=r_i, column=c_i, value=v)
                c.border = THIN
                c.font = _font(color=C["disabled"] if disabled else "000000")
                c.alignment = _align("center" if c_i in center_cols else "left")
                if bg:
                    c.fill = _fill(bg)
            if height:
                ws.row_dimensions[r_i].height = height
        if not rows:
            ws.cell(row=2, column=1, value="(none configured)").font = _font(italic=True, color=C["info"])
        self._set_widths(ws, widths)

    def _title(self, ws, text, sub, color=None, span="A1:F1"):
        ws.merge_cells(span)
        t = ws[span.split(":")[0]]
        t.value = text
        t.font = Font(name="Calibri", bold=True, size=14, color="FFFFFF")
        t.fill = _fill(color or C["hdr_bg"])
        t.alignment = _align("center", wrap=False)
        ws.row_dimensions[1].height = 36
        span2 = span.replace("1", "2")
        ws.merge_cells(span2)
        s = ws[span2.split(":")[0]]
        s.value = sub
        s.font = _font(italic=True, color=C["info"], size=9)
        s.fill = _fill("F2F2F2")
        s.alignment = _align("center", wrap=False)
        ws.row_dimensions[2].height = 16

    # ── Summary ───────────────────────────────────────────────────────────────
    def _sheet_summary(self):
        ws = self.wb.create_sheet("Summary", 0)
        ws.sheet_view.showGridLines = False
        ws.merge_cells("A1:F1")
        c = ws["A1"]
        c.value = "FortiGate Firewall — Configuration Security Report"
        c.font = Font(name="Calibri", bold=True, size=16, color="FFFFFF")
        c.fill = _fill(C["hdr_bg"])
        c.alignment = _align("center", wrap=False)
        ws.row_dimensions[1].height = 42
        ws.merge_cells("A2:F2")
        c = ws["A2"]
        c.value = (f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}    Source: {self.p.source_label}")
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
            c2.alignment = _align("left")
            ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=6)
            if row % 2 == 0:
                c1.fill = c2.fill = _fill(C["alt_row"])
            row += 1

        section_header("DEVICE")
        kv("Hostname", p.system.get("Hostname", ("(not set)", 0))[0])
        kv("Model", p.model or "(unknown)")
        kv("FortiOS", f"{p.version or '?'} build {p.build or '?'}")
        kv("VDOM mode", "multi-VDOM (" + ", ".join(p.vdoms) + ")" if p.multi_vdom else "single VDOM")
        kv("WAN interfaces", ", ".join(sorted(p.wan_intfs)) or "(none detected — use --wan-intf)")
        kv("WAN detected from", p.wan_source)
        row += 1
        section_header("CONFIGURATION OVERVIEW")
        kv("Config statements parsed", p.statement_count)
        kv("Firewall policies", f"{len(p.policies)} ({sum(1 for x in p.policies if x['status'] == 'enable')} enabled, "
                                f"{sum(1 for x in p.policies if x['status'] == 'enable' and x['action'] == 'accept')} "
                                "enabled accept)")
        kv("Interfaces", len(p.interfaces))
        kv("Admin accounts", len(p._admins()))
        kv("Benchmark", CIS_BENCHMARK_NAME + " (newest CIS FortiGate benchmark; evaluated against FortiOS 7.6 defaults)")
        kv("Frameworks", "CIS Controls v8.1 · PCI DSS v4.0.1 · SCF 2026.3")
        kv("audits.tar.gz used", p.audits_tar_path or "not found — built-in titles only")
        kv("CIS L1 / L2 .audit", f"{p.cis_l1_audit_used or 'n/a'} / {p.cis_l2_audit_used or 'n/a'}")
        row += 1

        section_header("CIS BENCHMARK RESULTS")
        self._hdr(ws, ["Status", "L1", "L2", "Total"], row=row)
        row += 1
        for st, label in (("PASS", "Pass"), ("FAIL", "Fail"), ("MANUAL", "Manual review"),
                          ("VERIFY", "Pass — verify value"), ("NA", "Not applicable")):
            l1 = sum(1 for r in p.cis_results.values() if r["status"] == st and r["level"] == "L1")
            l2 = sum(1 for r in p.cis_results.values() if r["status"] == st and r["level"] == "L2")
            fg, bg = self.STATUS_COLORS[st]
            for col, val in enumerate([label, l1, l2, l1 + l2], 1):
                cc = ws.cell(row=row, column=col, value=val)
                cc.fill = _fill(bg)
                cc.font = _font(bold=True, color=fg)
                cc.alignment = _align("center")
                cc.border = THIN
            row += 1
        scored = [r for r in p.cis_results.values() if r["status"] in ("PASS", "FAIL", "VERIFY")]
        if scored:
            pct = 100 * sum(1 for r in scored if r["status"] != "FAIL") / len(scored)
            kv("Automated pass rate", f"{pct:.0f}% of {len(scored)} automated checks")
        row += 1

        section_header("SECURITY FINDINGS BY SEVERITY")
        self._hdr(ws, ["Severity", "Count"], row=row)
        row += 1
        total = 0
        for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"):
            cnt = sum(1 for i in p.issues if i["severity"] == sev)
            total += cnt
            fg, bg = self.SEV_COLORS[sev]
            for col, val in enumerate([sev, cnt], 1):
                cc = ws.cell(row=row, column=col, value=val)
                cc.fill = _fill(bg)
                cc.font = _font(bold=True, color=fg)
                cc.alignment = _align("center")
                cc.border = THIN
            row += 1
        c1 = ws.cell(row=row, column=1, value="TOTAL")
        c1.font = _font(bold=True)
        c1.border = THIN
        c2 = ws.cell(row=row, column=2, value=total)
        c2.font = _font(bold=True)
        c2.border = THIN
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
        self._set_widths(ws, [52, 15, 15, 15, 15, 30])

    # ── System settings ──────────────────────────────────────────────────────
    def _sheet_system(self):
        ws = self.wb.create_sheet("System Settings")
        ws.sheet_view.showGridLines = False
        rows = [[label, value, ln or ""] for label, (value, ln) in self.p.system.items()]
        self._table(ws, ["Setting", "Value", "Line #"], rows, [32, 80, 10], center_cols=(3,))

    # ── CIS compliance (every benchmark item) ────────────────────────────────
    def _sheet_cis_status(self):
        ws = self.wb.create_sheet("CIS Benchmark")
        ws.sheet_view.showGridLines = False
        headers = ["CIS ID", "Level", "Recommendation", "Status", "Severity", "Evidence", "Objects Failing",
                   "Vuln", "CIS v8", "PCI DSS", "SCF"]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"
        status_label = {"PASS": "PASS", "FAIL": "FAIL", "MANUAL": "MANUAL", "VERIFY": "PASS (verify)", "NA": "N/A"}
        for r_i, cid in enumerate(sorted(self.p.cis_results, key=_id_key), 2):
            r = self.p.cis_results[cid]
            ref = self.p.catalog.get(cid, {}).get("reference", "")
            # The vuln(s) this item's own findings were tagged with (none for PASS / N/A /
            # verify) and those vulns' canonical controls; otherwise the benchmark's refs.
            cis_ids, pci_ids, scf_ids = [], [], []
            for vid in r["vulns"]:
                canon = _vuln_controls().get(vid) or {}
                cis_ids += [x for x in canon.get("cis_v8", []) if x not in cis_ids]
                pci_ids += [x for x in canon.get("pci_dss", []) if x not in pci_ids]
                scf_ids += [x for x in canon.get("scf", []) if x not in scf_ids]
            if not (cis_ids or pci_ids or scf_ids):
                cis_ids = _refs_from_reference(ref, "CSCv8") or CIS_V8_BY_CIS_ID.get(cid, [])
                pci_ids = _refs_from_reference(ref, "PCI-DSSv4.0") or PCI_BY_CIS_ID.get(cid, [])
                scf_ids = SCF_BY_CIS_ID.get(cid, [])
            vuln_txt = "\n".join(f"{v} — {self._vulns.get(v, '?')}" for v in r["vulns"])
            vals = [cid, r["level"], r["title"], status_label[r["status"]], r["severity"], r["evidence"],
                    r["count"] or "", vuln_txt, _cis_label(cis_ids), _pci_label(pci_ids), _scf_label(scf_ids)]
            bg = self._row_fill(r_i)
            for c_i, v in enumerate(vals, 1):
                c = ws.cell(row=r_i, column=c_i, value=v)
                c.border = THIN
                c.alignment = _align("center" if c_i in (1, 2, 4, 5, 7) else "left")
                c.font = _font(bold=c_i == 1)
                if c_i == 4:
                    fg, sbg = self.STATUS_COLORS[r["status"]]
                    c.fill = _fill(sbg)
                    c.font = _font(bold=True, color=fg)
                elif c_i == 5 and r["severity"]:
                    fg, sbg = self.SEV_COLORS[r["severity"]]
                    c.fill = _fill(sbg)
                    c.font = _font(bold=True, color=fg)
                elif bg:
                    c.fill = _fill(bg)
            ws.row_dimensions[r_i].height = 45
        self._set_widths(ws, [9, 7, 50, 13, 11, 70, 9, 34, 16, 18, 18])

    # ── Firewall policies ────────────────────────────────────────────────────
    def _sheet_policies(self):
        ws = self.wb.create_sheet("Firewall Policies")
        ws.sheet_view.showGridLines = False
        headers = ["Seq", "VDOM", "ID", "Name", "Status", "Src Intf", "Dst Intf", "Source", "Destination",
                   "Service", "Users / Groups", "Action", "NAT", "Log", "Schedule", "AV", "IPS", "Web",
                   "App", "DNS", "DLP", "SSL Inspection", "Comments", "Line"]
        self._hdr(ws, headers)
        ws.freeze_panes = "E2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"
        if not self.p.policies:
            ws.cell(row=2, column=1, value="(no firewall policies)").font = _font(italic=True, color=C["info"])
        for r_i, p in enumerate(self.p.policies, 2):
            disabled = p["status"] != "enable"
            bg = self._row_fill(r_i, disabled)
            pr = p["profiles"]
            src = _fmt_list(p["srcaddr"]) or ("ISDB: " + _fmt_list(p["isdb_src"]) if p["isdb_src"] else "")
            dst = _fmt_list(p["dstaddr"]) or ("ISDB: " + _fmt_list(p["isdb_dst"]) if p["isdb_dst"] else "")
            vals = [p["seq"], p["vdom"], p["id"], p["name"], p["status"], _fmt_list(p["srcintf"]),
                    _fmt_list(p["dstintf"]), ("NOT " if p["src_negate"] else "") + src,
                    ("NOT " if p["dst_negate"] else "") + dst,
                    ("NOT " if p["svc_negate"] else "") + _fmt_list(p["service"] + p["app"]),
                    _fmt_list(p["users"] + p["groups"]), p["action"].upper(), p["nat"], p["logtraffic"],
                    p["schedule"], pr["av"], pr["ips"], pr["web"], pr["app"], pr["dns"], pr["dlp"], pr["ssl"],
                    p["comments"], p["line"]]
            for c_i, v in enumerate(vals, 1):
                c = ws.cell(row=r_i, column=c_i, value=v)
                c.border = THIN
                c.alignment = _align("center" if c_i in (1, 3, 5, 12, 13, 14, 24) else "left")
                if c_i == 12 and not disabled:
                    allow = p["action"] == "accept"
                    c.fill = _fill(C["allow_l"] if allow else C["deny_l"])
                    c.font = _font(bold=True, color=C["allow"] if allow else C["deny"])
                else:
                    c.font = _font(color=C["disabled"] if disabled else "000000")
                    if bg:
                        c.fill = _fill(bg)
            ws.row_dimensions[r_i].height = 30
        self._set_widths(ws, [5, 9, 6, 24, 9, 14, 14, 24, 24, 22, 16, 9, 8, 8, 10,
                              12, 12, 12, 12, 12, 10, 18, 34, 7])

    # ── Inventory sheets ─────────────────────────────────────────────────────
    def _sheet_interfaces(self):
        ws = self.wb.create_sheet("Interfaces")
        ws.sheet_view.showGridLines = False
        zones = self.p._zone_members()
        zone_of = {m: z for z, ms in zones.items() for m in ms}
        rows = [[i["name"], i["vdom"], i["type"], i["role"], i["ip"] or (i["mode"] if i["mode"] != "static" else ""),
                 " ".join(i["allowaccess"]), zone_of.get(i["name"], ""), "yes" if i["name"] in self.p.wan_intfs else "",
                 i["status"], i["alias"], i["description"], i["parent"] or _fmt_list(i["members"]), i["line"]]
                for i in self.p.interfaces]
        self._table(ws, ["Name", "VDOM", "Type", "Role", "IP / Mode", "Allow Access", "Zone", "WAN", "Status",
                         "Alias", "Description", "Parent / Members", "Line"], rows,
                    [16, 9, 11, 8, 30, 30, 12, 6, 8, 16, 28, 18, 7], center_cols=(8, 9, 13), disabled_col=8)

    def _iter_edits(self, path):
        for label, node in self.p.scopes():
            n = node.sub(path)
            for name, e in (n.edits.items() if n else []):
                yield (label if self.p.multi_vdom else ""), name, e

    def _sheet_addresses(self):
        ws = self.wb.create_sheet("Address Objects")
        ws.sheet_view.showGridLines = False
        rows = []
        for path in ("firewall address", "firewall address6"):
            for vd, name, e in self._iter_edits(path):
                t = e.get("type", "ipmask" if path == "firewall address" else "ipprefix")
                val = {"ipmask": e.get("subnet", "0.0.0.0 0.0.0.0"), "iprange": f"{e.get('start-ip', '')} - {e.get('end-ip', '')}",
                       "fqdn": e.get("fqdn", ""), "wildcard-fqdn": e.get("wildcard-fqdn", ""),
                       "geography": e.get("country", ""), "ipprefix": e.get("ip6", "::/0"),
                       "dynamic": e.get("sdn", "")}.get(t, e.get("subnet", ""))
                rows.append([vd, name, "IPv6" if path.endswith("6") else "IPv4", t, val,
                             e.get("associated-interface", ""), e.get("comment", ""), e.line])
        self._table(ws, ["VDOM", "Name", "Family", "Type", "Value", "Interface", "Comment", "Line"], rows,
                    [9, 28, 7, 12, 36, 14, 36, 7], center_cols=(3, 8))

    def _sheet_addrgrps(self):
        ws = self.wb.create_sheet("Address Groups")
        ws.sheet_view.showGridLines = False
        rows = [[vd, name, _fmt_list(e.list("member")), "yes" if e.get("exclude") == "enable" else "",
                 e.get("comment", ""), e.line]
                for path in ("firewall addrgrp", "firewall addrgrp6") for vd, name, e in self._iter_edits(path)]
        self._table(ws, ["VDOM", "Name", "Members", "Exclude", "Comment", "Line"], rows,
                    [9, 28, 70, 8, 30, 7], center_cols=(4, 6))

    def _sheet_services(self):
        ws = self.wb.create_sheet("Service Objects")
        ws.sheet_view.showGridLines = False
        rows = []
        for vd, name, e in self._iter_edits("firewall service custom"):
            proto = e.get("protocol", "TCP/UDP/UDP-Lite/SCTP")
            ports = "; ".join(f"{k.split('-')[0].upper()} {' '.join(e.list(k))}"
                              for k in ("tcp-portrange", "udp-portrange", "sctp-portrange") if e.has(k))
            if proto == "IP":
                ports = f"IP protocol {e.get('protocol-number', '0 (any)')}"
            elif proto.startswith("ICMP"):
                ports = f"{proto} type {e.get('icmptype', 'any')}"
            rows.append([vd, name, "custom", proto, ports, e.get("category", ""), e.get("comment", ""), e.line])
        for vd, name, e in self._iter_edits("firewall service group"):
            rows.append([vd, name, "group", "", _fmt_list(e.list("member")), "", e.get("comment", ""), e.line])
        self._table(ws, ["VDOM", "Name", "Kind", "Protocol", "Ports / Members", "Category", "Comment", "Line"],
                    rows, [9, 24, 8, 18, 50, 16, 30, 7], center_cols=(3, 8))

    def _sheet_nat(self):
        ws = self.wb.create_sheet("VIPs & NAT Pools")
        ws.sheet_view.showGridLines = False
        rows = []
        for vd, name, e in self._iter_edits("firewall vip"):
            pf = e.get("portforward") == "enable"
            rows.append([vd, "VIP", name, e.get("extintf", "any"), e.get("extip", ""),
                         _fmt_list(e.list("mappedip")),
                         f"{e.get('protocol', 'tcp')} {e.get('extport', '')}->{e.get('mappedport', '')}" if pf else "all ports",
                         e.get("comment", ""), e.line])
        for vd, name, e in self._iter_edits("firewall ippool"):
            rows.append([vd, "IP pool", name, "", f"{e.get('startip', '')} - {e.get('endip', '')}",
                         e.get("type", "overload"), "", e.get("comments", ""), e.line])
        self._table(ws, ["VDOM", "Kind", "Name", "Ext Intf", "External IP / Range", "Mapped IP / Type", "Ports",
                         "Comment", "Line"], rows, [9, 8, 24, 12, 30, 24, 20, 30, 7], center_cols=(2, 9))

    def _sheet_admins(self):
        ws = self.wb.create_sheet("Admin Accounts")
        ws.sheet_view.showGridLines = False
        rows = []
        for name, a in self.p._admins():
            rows.append([name, a.get("accprofile", ""), "remote" if a.get("remote-auth") == "enable" else "local",
                         a.get("two-factor", "disable"), _fmt_list(self.p._trusthosts(a)) or "ANY",
                         _fmt_list(a.list("vdom")), a.line])
        self._table(ws, ["Name", "Profile", "Auth", "Two-Factor", "Trusted Hosts", "VDOM", "Line"], rows,
                    [20, 18, 9, 12, 60, 14, 7], center_cols=(3, 4, 7))

    def _sheet_vpn(self):
        ws = self.wb.create_sheet("VPN Crypto")
        ws.sheet_view.showGridLines = False
        rows = []
        for path in ("vpn ipsec phase1-interface", "vpn ipsec phase1"):
            for vd, name, e in self._iter_edits(path):
                rows.append([vd, "IPsec phase1", name, e.get("interface", ""), e.get("remote-gw", e.get("type", "")),
                             f"IKEv{e.get('ike-version', '1')}" + (f" {e.get('mode', 'main')}" if e.get('ike-version', '1') == '1' else ""),
                             " ".join(e.list("proposal")), " ".join(e.list("dhgrp")) or "14 5 (default)",
                             e.get("authmethod", "psk"), e.get("keylife", "86400"), e.line])
        for path in ("vpn ipsec phase2-interface", "vpn ipsec phase2"):
            for vd, name, e in self._iter_edits(path):
                rows.append([vd, "IPsec phase2", name, e.get("phase1name", ""),
                             f"{' '.join(e.list('src-subnet')) or e.get('src-name', '')} -> "
                             f"{' '.join(e.list('dst-subnet')) or e.get('dst-name', '')}",
                             f"PFS {e.get('pfs', 'enable')}", " ".join(e.list("proposal")),
                             " ".join(e.list("dhgrp")), "", e.get("keylifeseconds", "43200"), e.line])
        for vd, _n, e in [(l if self.p.multi_vdom else "", "settings", n) for l, n in self.p.all_nodes("vpn ssl settings")]:
            rows.append([vd, "SSL VPN", "vpn ssl settings", _fmt_list(e.list("source-interface")) or "(disabled)",
                         e.get("servercert", "Fortinet_Factory (default)"),
                         f"TLS {e.get('ssl-min-proto-ver', 'tls1-2')} – {e.get('ssl-max-proto-ver', 'tls1-3')}",
                         f"algorithm {e.get('algorithm', 'high')}", "", "", "", e.line])
        self._table(ws, ["VDOM", "Kind", "Name", "Interface / Phase1", "Peer / Selectors / Cert", "Version / PFS",
                         "Proposals", "DH Groups", "Auth", "Key Life (s)", "Line"], rows,
                    [9, 12, 20, 18, 34, 18, 40, 14, 10, 11, 7], center_cols=(11,))

    # ── Security Issues ──────────────────────────────────────────────────────
    def _sorted_issues(self):
        return sorted(self.p.issues, key=lambda x: (self.SEV_ORDER.get(x["severity"], 9),
                                                    _id_key(x["item_id"]) if x["item_id"] else [999]))

    def _sheet_issues(self):
        ws = self.wb.create_sheet("Security Issues")
        ws.sheet_view.showGridLines = False
        headers = ["#", "Validated", "Severity", "Residual Risk", "Residual Risk Note",
                   "Category", "Rule / Object", "Config Line(s)",
                   "CIS v8", "CIS Benchmark", "PCI DSS", "SCF",
                   "Description", "Recommendation", "Details",
                   "Asset", "Target", "Vuln", "Source"]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"
        source = asset = self.p.source_label
        hostname = self.p.system.get("Hostname", ("", 0))[0]
        for idx, iss in enumerate(self._sorted_issues(), 1):
            row = idx + 1
            sev = iss["severity"]
            fg, bg = self.SEV_COLORS[sev]
            row_bg = self._row_fill(row)
            vuln = self._vulns.get(iss["vuln_id"], "") if iss.get("vuln_id") else ""
            details = iss.get("details", "")
            line = iss.get("line", "")
            host = hostname or asset
            target = f"{host} ({line})" if line else host
            values = [idx, iss["validated"], sev, "", details or iss["category"],
                      iss["category"], iss["rule_name"], line,
                      iss["cis_controls"], iss["cis_benchmark"], iss["pci_dss"], iss["scf"],
                      iss["description"], iss["recommendation"], details,
                      asset, target, vuln, source]
            for col, val in enumerate(values, 1):
                c = ws.cell(row=row, column=col, value=val)
                c.border = THIN
                if col == 3:
                    c.fill = _fill(bg)
                    c.font = _font(bold=True, color=fg)
                    c.alignment = _align("center")
                    continue
                if col in (1, 2, 8):
                    c.font = _font(bold=col in (1, 2))
                    c.alignment = _align("center")
                elif col in (9, 11, 12):
                    c.font = _font(bold=True, color={9: "17375E", 11: "7B2D8B", 12: "1A5C3A"}[col], size=9)
                    c.alignment = _align("center")
                else:
                    c.font = _font()
                    c.alignment = _align()
                if row_bg:
                    c.fill = _fill(row_bg)
            ws.row_dimensions[row].height = 40
        self._set_widths(ws, [5, 10, 12, 14, 26, 40, 28, 12, 18, 14, 18, 18, 55, 55, 50, 22, 18, 44, 26])

    # ── Ticketing Export ──────────────────────────────────────────────────────
    def _sheet_export(self):
        ws = self.wb.create_sheet("Export")
        ws.sheet_view.showGridLines = False
        headers = ["Hostname", "line#", "protocol", "port", "output"]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        hostname = self.p.system.get("Hostname", ("", 0))[0] or self.p.source_label
        for idx, iss in enumerate(self._sorted_issues(), 1):
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

    # ── Framework mapping sheets ─────────────────────────────────────────────
    def _mapping_sheet(self, name, title, sub, color, ids_key, desc_table, label_fn, show_empty=True):
        ws = self.wb.create_sheet(name)
        ws.sheet_view.showGridLines = False
        self._title(ws, title, sub, color)
        by_id: dict[str, list[dict]] = defaultdict(list)
        for iss in self.p.issues:
            for cid in iss.get(ids_key, []):
                by_id[cid].append(iss)
        keys = set(by_id) | (set(desc_table) if show_empty else set())

        def sk(k):
            m = re.match(r'^([A-Z]+)-(\d+)(?:\.(\d+))?$', k)
            if m:
                return (m.group(1), int(m.group(2)), int(m.group(3) or 0))
            return ("", *_id_key(k))
        row = 4
        for cid in sorted(keys, key=sk):
            issues_for = sorted(by_id.get(cid, []), key=lambda x: self.SEV_ORDER.get(x["severity"], 9))
            count = len(issues_for)
            ws.merge_cells(f"A{row}:F{row}")
            desc = desc_table.get(cid, "")
            hc = ws.cell(row=row, column=1, value=f"{label_fn(cid)}  [{count} finding{'s' if count != 1 else ''}]"
                                                  + (f"  {desc}" if desc else ""))
            hc.font = Font(name="Calibri", bold=True, size=11, color="FFFFFF")
            hc.fill = _fill(color)
            hc.alignment = _align("left", wrap=False)
            hc.border = THIN
            ws.row_dimensions[row].height = 24
            row += 1
            row = self._mapping_rows(ws, row, issues_for)
            row += 1
        self._set_widths(ws, [12, 40, 28, 14, 55, 55])

    def _mapping_rows(self, ws, row, issues_for):
        if not issues_for:
            ws.merge_cells(f"A{row}:F{row}")
            nc = ws.cell(row=row, column=1, value="No findings for this control/requirement")
            nc.font = _font(italic=True, color=C["info"])
            nc.fill = _fill("F9F9F9")
            nc.alignment = _align()
            nc.border = THIN
            return row + 1
        for col, h in enumerate(["Severity", "Category", "Rule / Object", "Config Line(s)", "Description",
                                 "Recommendation"], 1):
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
            vals = [sev, iss["category"], iss["rule_name"], iss.get("line", ""), iss["description"],
                    iss["recommendation"]]
            for col, val in enumerate(vals, 1):
                c = ws.cell(row=row, column=col, value=val)
                c.border = THIN
                if col == 1:
                    c.fill = _fill(bg)
                    c.font = _font(bold=True, color=fg)
                    c.alignment = _align("center")
                    continue
                c.font = _font(color=C["info"], size=9) if col == 4 else _font()
                c.alignment = _align("center") if col == 4 else _align()
                if rb:
                    c.fill = _fill(rb)
            ws.row_dimensions[row].height = 36
            row += 1
        return row

    # ── Save ──────────────────────────────────────────────────────────────────
    def save(self):
        _vuln_controls()   # merge shared descriptions before the mapping sheets
        self._sheet_summary()
        self._sheet_system()
        self._sheet_cis_status()
        self._sheet_policies()
        self._sheet_interfaces()
        self._sheet_addresses()
        self._sheet_addrgrps()
        self._sheet_services()
        self._sheet_nat()
        self._sheet_admins()
        self._sheet_vpn()
        self._sheet_issues()
        self._sheet_export()
        self._mapping_sheet("CIS Controls Mapping", "CIS Controls v8.1 — Finding Cross-Reference",
                            "Each CIS Control safeguard lists all findings from this config that map to it.",
                            "17375E", "cis_ids", CIS_CTRL_DESC, lambda k: f"CIS {k}")
        self._mapping_sheet("PCI DSS Mapping", "PCI DSS v4.0.1 — Finding Cross-Reference",
                            "Each PCI DSS v4.0.1 requirement lists all findings from this config that map to it.",
                            "5C1A8C", "pci_ids", PCI_DSS_DESC, lambda k: f"PCI DSS {k}")
        self._mapping_sheet("SCF Mapping", "Secure Controls Framework (SCF 2026.3) — Finding Cross-Reference",
                            "Each SCF control with at least one finding from this config.",
                            "1A5C3A", "scf_ids", {}, lambda k: f"SCF {k}", show_empty=False)
        self.wb.save(self.out)


# ── Directory (batch) mode ───────────────────────────────────────────────────
_BATCH_SKIP_EXT = {".xlsx", ".xls", ".pyc", ".zip", ".tar", ".gz", ".py", ".json", ".csv", ".pdf"}


def _looks_like_fortios_config(path: str) -> bool:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            sample = fh.read(200_000)
    except OSError:
        return False
    return "#config-version=FG" in sample or bool(
        re.search(r'(?m)^\s*config system (global|interface)\s*$', sample)
        and re.search(r'(?m)^\s*(next|end)\s*$', sample))


def _run_one(config_file: str, output_path: str, wan_intfs=None) -> "FortigateParser | None":
    print(f"[*] Parsing: {config_file}")
    try:
        parser = FortigateParser(config_file, wan_intfs=wan_intfs)
        parser.parse()
    except SystemExit as exc:
        print(f"[!] Skipped {config_file}: {exc}")
        return None
    sev_counts: dict[str, int] = defaultdict(int)
    for iss in parser.issues:
        sev_counts[iss["severity"]] += 1
    cis = defaultdict(int)
    for r in parser.cis_results.values():
        cis[r["status"]] += 1
    print(f"      Firewall policies: {len(parser.policies)}   Interfaces: {len(parser.interfaces)}")
    print(f"      CIS: {cis['PASS'] + cis['VERIFY']} pass, {cis['FAIL']} fail, {cis['MANUAL']} manual, "
          f"{cis['NA']} n/a")
    print(f"[*] Security findings: {len(parser.issues)}")
    for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"):
        if sev_counts[sev]:
            print(f"      {sev:<10}: {sev_counts[sev]}")
    ExcelReporter(parser, output_path).save()
    print(f"[+] Saved: {output_path}")
    return parser


def _run_batch(directory: str, output_dir: "str | None", recursive: bool, wan_intfs=None):
    walk = os.walk(directory) if recursive else [(directory, [], sorted(os.listdir(directory)))]
    configs = []
    for root, _dirs, files in walk:
        for fname in sorted(files):
            path = os.path.join(root, fname)
            if fname.startswith(".") or not os.path.isfile(path):
                continue
            if os.path.splitext(fname)[1].lower() in _BATCH_SKIP_EXT:
                continue
            if _looks_like_fortios_config(path):
                configs.append(path)
    if not configs:
        sys.exit(f"No FortiOS configuration files found under {directory}")
    print(f"[*] Found {len(configs)} FortiOS config file(s) under {directory}{' (recursive)' if recursive else ''}")
    results = []
    for cfg in configs:
        out_dir = output_dir or os.path.dirname(cfg) or "."
        os.makedirs(out_dir, exist_ok=True)
        stem = os.path.splitext(os.path.basename(cfg))[0]
        results.append((cfg, _run_one(cfg, os.path.join(out_dir, f"{stem}_analysis.xlsx"), wan_intfs)))
        print()
    ok = sum(1 for _, p in results if p is not None)
    print(f"[*] Batch complete: {ok}/{len(results)} report(s) written.")
    for c, p in results:
        if p is None:
            print(f"[!] Failed: {c}")


def main():
    ap = argparse.ArgumentParser(
        description="FortiGate (FortiOS 7.x / 7.6) Config Analyzer — CIS FortiGate Benchmark, "
                    "CIS Controls v8.1, PCI DSS v4.0.1, SCF — outputs Excel report(s)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python fortigate_analyzer.py FGT01_20261110.conf
  python fortigate_analyzer.py FGT01.conf -o audit-$(date +%%Y%%m%%d).xlsx
  python fortigate_analyzer.py FGT01.conf --wan-intf port1 --wan-intf wan2
  python fortigate_analyzer.py ./configs/ --output-dir ./audits/ --recursive

Input: a FortiOS backup (System > Configuration > Backup, unencrypted) or a
'show' / 'show full-configuration' CLI capture. Multi-VDOM configs are
supported. Settings left at their factory default are evaluated using
FortiOS 7.6 defaults.
""",
    )
    ap.add_argument("config", help="FortiOS configuration file, or a directory of them (batch mode).")
    ap.add_argument("-o", "--output", default=None,
                    help="Output Excel file (default: <config-stem>_analysis.xlsx). Not used in batch mode.")
    ap.add_argument("--wan-intf", action="append", default=None,
                    help="Internet-facing interface/zone name (repeatable). Overrides auto-detection "
                         "(role wan, default-route device, SD-WAN members).")
    ap.add_argument("--output-dir", default=None, help="Batch mode: directory for the *_analysis.xlsx reports.")
    ap.add_argument("--recursive", action="store_true", help="Batch mode: also scan subdirectories.")
    args = ap.parse_args()

    if os.path.isdir(args.config):
        if args.output:
            sys.exit("--output isn't used in batch mode — use --output-dir instead.")
        _run_batch(args.config, args.output_dir, args.recursive, args.wan_intf)
        return
    output_path = args.output or f"{os.path.splitext(os.path.basename(args.config))[0]}_analysis.xlsx"
    if _run_one(args.config, output_path, args.wan_intf) is None:
        sys.exit(1)


if __name__ == "__main__":
    main()
