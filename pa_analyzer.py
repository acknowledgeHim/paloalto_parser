#!/usr/bin/env python3
"""
Palo Alto Firewall Configuration Analyzer
Parses PAN-OS XML configuration (device or Panorama), checks for security
issues/misconfigurations, and exports findings + rule inventory to Excel.

Usage:
    python pa_analyzer.py running-config.xml
    python pa_analyzer.py running-config.xml -o audit.xlsx
"""

import xml.etree.ElementTree as ET
import argparse
import os
import sys
from collections import defaultdict
from datetime import datetime

try:
    import openpyxl
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    print("ERROR: openpyxl is required.  Run:  pip install openpyxl")
    sys.exit(1)


# ── Line-number-aware XML parser ─────────────────────────────────────────────
def _parse_xml_with_linenos(filename: str):
    """Parse an XML file and return (root_element, {id(elem): lineno}) dict.

    Uses the expat C parser directly so we can read CurrentLineNumber at
    the moment each start-tag is processed — before the Python-level
    XMLParser C-accelerator drops that information.
    """
    from xml.parsers import expat

    builder = ET.TreeBuilder()
    linemap: dict[int, int] = {}
    ep = expat.ParserCreate()
    ep.ordered_attributes = 1   # attrs arrive as flat [name, val, ...] list

    def _start(tag, attr_flat):
        attrs = {}
        for i in range(0, len(attr_flat), 2):
            attrs[attr_flat[i]] = attr_flat[i + 1]
        elem = builder.start(tag, attrs)
        linemap[id(elem)] = ep.CurrentLineNumber

    ep.StartElementHandler = _start
    ep.EndElementHandler = lambda tag: builder.end(tag)
    ep.CharacterDataHandler = lambda data: builder.data(data)

    with open(filename, "rb") as fh:
        ep.ParseFile(fh)

    return builder.close(), linemap


# ── Colour palette ────────────────────────────────────────────────────────────
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
    return PatternFill("solid", fgColor=hex_color)


def _font(bold=False, color="000000", size=10, italic=False) -> Font:
    return Font(name="Calibri", bold=bold, italic=italic, color=color, size=size)


def _align(h="left", wrap=True) -> Alignment:
    return Alignment(horizontal=h, vertical="center", wrap_text=wrap)


# ── Config parser ─────────────────────────────────────────────────────────────
class PaloAltoParser:
    def __init__(self, config_file: str):
        self.config_file = config_file
        self.root: ET.Element | None = None

        self.security_rules: list[dict] = []
        self.nat_rules: list[dict] = []
        self.address_objects: list[dict] = []
        self.address_groups: list[dict] = []
        self.service_objects: list[dict] = []
        self.service_groups: list[dict] = []
        self.zones: list[dict] = []
        self.profile_groups: dict[str, dict] = {}
        self.issues: list[dict] = []

        # Crypto / system data
        self.ike_crypto_profiles: list[dict] = []
        self.ipsec_crypto_profiles: list[dict] = []
        self.ssl_tls_profiles: list[dict] = []
        self.ike_gateways: list[dict] = []
        self.admin_accounts: list[dict] = []
        self.mgmt_settings: dict = {}
        self.log_syslog_servers: list[dict] = []

    # ── Parse entry point ─────────────────────────────────────────────────────
    def parse(self):
        try:
            self.root, self._linemap = _parse_xml_with_linenos(self.config_file)
        except ET.ParseError as exc:
            sys.exit(f"XML parse error: {exc}")
        except FileNotFoundError:
            sys.exit(f"File not found: {self.config_file}")

        self._parse_objects()
        self._parse_profile_groups()
        self._parse_security_rules()
        self._parse_nat_rules()
        self._parse_zones()
        self._parse_ike_crypto_profiles()
        self._parse_ipsec_crypto_profiles()
        self._parse_ssl_tls_profiles()
        self._parse_ike_gateways()
        self._parse_admin_accounts()
        self._parse_mgmt_settings()
        self._parse_syslog_servers()
        self._run_checks()

    # ── Low-level helpers ─────────────────────────────────────────────────────
    @staticmethod
    def _members(el: ET.Element, path: str) -> list[str]:
        container = el.find(path)
        if container is None:
            return []
        return [m.text.strip() for m in container.findall("member") if m.text]

    @staticmethod
    def _text(el: ET.Element, path: str, default: str = "") -> str:
        found = el.find(path)
        return found.text.strip() if (found is not None and found.text) else default

    def _lineno(self, el: ET.Element) -> int:
        """Return the source line number for an element, or 0 if unknown."""
        return self._linemap.get(id(el), 0)

    def _lineno_str(self, el: ET.Element, child_paths: list[str] | None = None) -> str:
        """Return a human-readable line reference like '42' or '42-51'."""
        start = self._lineno(el)
        if not start:
            return ""
        if child_paths:
            end = start
            for path in child_paths:
                child = el.find(path)
                if child is not None:
                    ln = self._lineno(child)
                    if ln and ln > end:
                        end = ln
            return f"{start}-{end}" if end != start else str(start)
        return str(start)

    # ── Object parsing ────────────────────────────────────────────────────────
    def _parse_objects(self):
        """Collect address / service objects from all scopes."""
        scopes = []
        for vsys in self.root.findall(".//vsys/entry"):
            scopes.append((vsys.get("name", "vsys1"), vsys))
        shared = self.root.find(".//shared")
        if shared is not None:
            scopes.append(("shared", shared))
        for dg in self.root.findall(".//device-group/entry"):
            scopes.append((dg.get("name", "device-group"), dg))
        if not scopes:
            scopes.append(("global", self.root))

        for scope_name, scope_el in scopes:
            for addr in scope_el.findall(".//address/entry"):
                ip = self._text(addr, "ip-netmask")
                ip_range = self._text(addr, "ip-range")
                fqdn = self._text(addr, "fqdn")
                if ip:
                    atype, val = "ip-netmask", ip
                elif ip_range:
                    atype, val = "ip-range", ip_range
                elif fqdn:
                    atype, val = "fqdn", fqdn
                else:
                    atype, val = "unknown", ""
                self.address_objects.append({
                    "scope": scope_name,
                    "name": addr.get("name", ""),
                    "type": atype, "value": val,
                    "description": self._text(addr, "description"),
                    "tags": ", ".join(self._members(addr, "tag")),
                })

            for grp in scope_el.findall(".//address-group/entry"):
                dyn = self._text(grp, "dynamic/filter")
                self.address_groups.append({
                    "scope": scope_name,
                    "name": grp.get("name", ""),
                    "type": "dynamic" if dyn else "static",
                    "members": ", ".join(self._members(grp, "static")),
                    "dynamic_filter": dyn,
                    "description": self._text(grp, "description"),
                    "tags": ", ".join(self._members(grp, "tag")),
                })

            for svc in scope_el.findall(".//service/entry"):
                proto, port = "", ""
                if svc.find("protocol/tcp") is not None:
                    proto = "tcp"
                    port = self._text(svc.find("protocol/tcp"), "port")
                elif svc.find("protocol/udp") is not None:
                    proto = "udp"
                    port = self._text(svc.find("protocol/udp"), "port")
                self.service_objects.append({
                    "scope": scope_name,
                    "name": svc.get("name", ""),
                    "protocol": proto, "port": port,
                    "description": self._text(svc, "description"),
                })

            for grp in scope_el.findall(".//service-group/entry"):
                self.service_groups.append({
                    "scope": scope_name,
                    "name": grp.get("name", ""),
                    "members": ", ".join(self._members(grp, "members")),
                    "tags": ", ".join(self._members(grp, "tag")),
                })

    def _parse_profile_groups(self):
        for grp in self.root.findall(".//profile-group/entry"):
            name = grp.get("name", "")
            self.profile_groups[name] = {
                "virus":            self._text(grp, "virus/member"),
                "vulnerability":    self._text(grp, "vulnerability/member"),
                "spyware":          self._text(grp, "spyware/member"),
                "url-filtering":    self._text(grp, "url-filtering/member"),
                "file-blocking":    self._text(grp, "file-blocking/member"),
                "wildfire-analysis": self._text(grp, "wildfire-analysis/member"),
            }

    # ── Security rules ────────────────────────────────────────────────────────
    def _parse_security_rules(self):
        paths = [
            ".//rulebase/security/rules/entry",
            ".//pre-rulebase/security/rules/entry",
            ".//post-rulebase/security/rules/entry",
        ]
        rule_num = 1
        for path in paths:
            rb = "security"
            if "pre-rulebase" in path:
                rb = "pre-security"
            elif "post-rulebase" in path:
                rb = "post-security"

            for rule in self.root.findall(path):
                ps = rule.find("profile-setting")
                profile_type, profiles = "", {}
                if ps is not None:
                    gm = ps.find("group/member")
                    if gm is not None and gm.text:
                        profile_type = "group"
                        profiles = {"group": gm.text.strip()}
                    else:
                        profile_type = "profiles"
                        profiles = {
                            k: self._text(ps, f"profiles/{k}/member")
                            for k in ("virus", "vulnerability", "spyware",
                                      "url-filtering", "file-blocking", "wildfire-analysis")
                        }

                self.security_rules.append({
                    "num": rule_num,
                    "name":          rule.get("name", f"rule-{rule_num}"),
                    "line":          self._lineno_str(rule, ["action", "description"]),
                    "rulebase":      rb,
                    "disabled":      self._text(rule, "disabled", "no"),
                    "src_zones":     ", ".join(self._members(rule, "from")),
                    "dst_zones":     ", ".join(self._members(rule, "to")),
                    "sources":       ", ".join(self._members(rule, "source")),
                    "destinations":  ", ".join(self._members(rule, "destination")),
                    "negate_src":    self._text(rule, "negate-source", "no"),
                    "negate_dst":    self._text(rule, "negate-destination", "no"),
                    "applications":  ", ".join(self._members(rule, "application")),
                    "services":      ", ".join(self._members(rule, "service")),
                    "categories":    ", ".join(self._members(rule, "category")),
                    "action":        self._text(rule, "action", "allow"),
                    "profile_type":  profile_type,
                    "profiles":      profiles,
                    "log_start":     self._text(rule, "log-start", "no"),
                    "log_end":       self._text(rule, "log-end", "yes"),
                    "log_setting":   self._text(rule, "log-setting"),
                    "hip_profiles":  ", ".join(self._members(rule, "hip-profiles")),
                    "schedule":      self._text(rule, "schedule"),
                    "tags":          ", ".join(self._members(rule, "tag")),
                    "description":   self._text(rule, "description"),
                })
                rule_num += 1

    # ── NAT rules ─────────────────────────────────────────────────────────────
    def _parse_nat_rules(self):
        paths = [
            ".//rulebase/nat/rules/entry",
            ".//pre-rulebase/nat/rules/entry",
            ".//post-rulebase/nat/rules/entry",
        ]
        rule_num = 1
        for path in paths:
            for rule in self.root.findall(path):
                # Source translation
                st = rule.find("source-translation")
                src_type, src_val = "", ""
                if st is not None:
                    for st_kind in ("dynamic-ip-and-port", "dynamic-ip", "static-ip"):
                        el = st.find(st_kind)
                        if el is not None:
                            src_type = st_kind
                            addrs = self._members(el, "translated-address")
                            iface_el = el.find("interface-address")
                            if addrs:
                                src_val = ", ".join(addrs)
                            elif iface_el is not None:
                                src_val = f"interface:{self._text(iface_el, 'interface')}"
                            break

                # Destination translation
                dt = rule.find("destination-translation")
                dst_addr = self._text(dt, "translated-address") if dt is not None else ""
                dst_port = self._text(dt, "translated-port") if dt is not None else ""

                self.nat_rules.append({
                    "num": rule_num,
                    "name":        rule.get("name", f"nat-{rule_num}"),
                    "line":        self._lineno_str(rule),
                    "disabled":    self._text(rule, "disabled", "no"),
                    "nat_type":    self._text(rule, "nat-type", "ipv4"),
                    "src_zones":   ", ".join(self._members(rule, "from")),
                    "dst_zones":   ", ".join(self._members(rule, "to")),
                    "sources":     ", ".join(self._members(rule, "source")),
                    "destinations": ", ".join(self._members(rule, "destination")),
                    "services":    ", ".join(self._members(rule, "service")),
                    "src_trans_type":  src_type,
                    "src_trans_value": src_val,
                    "dst_trans_addr":  dst_addr,
                    "dst_trans_port":  dst_port,
                    "description": self._text(rule, "description"),
                    "tags":        ", ".join(self._members(rule, "tag")),
                })
                rule_num += 1

    # ── Zones ─────────────────────────────────────────────────────────────────
    def _parse_zones(self):
        for zone in self.root.findall(".//zone/entry"):
            zone_type, ifaces = "", []
            for zt in ("layer3", "layer2", "virtual-wire", "tap", "external", "tunnel", "loopback"):
                el = zone.find(zt)
                if el is not None:
                    zone_type = zt
                    ifaces = self._members(el, "member")
                    break
            self.zones.append({
                "name":     zone.get("name", ""),
                "line":     self._lineno_str(zone),
                "type":     zone_type,
                "interfaces": ", ".join(ifaces),
                "zone_protection_profile": self._text(zone, "network/zone-protection-profile"),
                "user_id":  self._text(zone, "enable-user-identification", "no"),
                "log_setting": self._text(zone, "log-setting"),
            })

    # ── Security checks ───────────────────────────────────────────────────────
    def _issue(self, severity, category, rule_name, description, recommendation,
               details="", line=""):
        self.issues.append({
            "severity":       severity,
            "category":       category,
            "rule_name":      rule_name,
            "line":           str(line) if line else "",
            "description":    description,
            "recommendation": recommendation,
            "details":        details,
        })

    def _run_checks(self):
        self._chk_any_any_any()
        self._chk_missing_profiles()
        self._chk_logging()
        self._chk_overly_permissive()
        self._chk_risky_services_from_any()
        self._chk_disabled_rules()
        self._chk_missing_descriptions()
        self._chk_negate_rules()
        self._chk_zones_no_protection()
        self._chk_shadow_rules()
        self._chk_app_any_svc_any_allow()
        self._chk_inbound_no_inspection()
        self._chk_service_any_allow()
        # Crypto / system checks
        self._chk_weak_ike_crypto()
        self._chk_weak_ipsec_crypto()
        self._chk_weak_ssl_tls()
        self._chk_ike_gateways()
        self._chk_management_access()
        self._chk_admin_accounts()
        self._chk_snmp()
        self._chk_no_syslog()

    def _active_allow(self):
        return [r for r in self.security_rules if r["disabled"] != "yes" and r["action"] == "allow"]

    def _active_rules(self):
        return [r for r in self.security_rules if r["disabled"] != "yes"]

    @staticmethod
    def _has_any(field: str) -> bool:
        return "any" in (x.strip().lower() for x in field.split(","))

    def _rule_has_security_profiles(self, rule: dict) -> bool:
        pt = rule["profile_type"]
        if pt == "group":
            return bool(rule["profiles"].get("group"))
        if pt == "profiles":
            p = rule["profiles"]
            return bool(p.get("virus") or p.get("vulnerability") or p.get("spyware"))
        return False

    # Check 1: any/any/any allow ───────────────────────────────────────────────
    def _chk_any_any_any(self):
        for r in self._active_allow():
            if self._has_any(r["sources"]) and self._has_any(r["destinations"]) and self._has_any(r["applications"]):
                self._issue(
                    "CRITICAL", "Any/Any/Any Allow Rule", r["name"],
                    "Rule allows ALL applications from ANY source to ANY destination.",
                    "Apply least-privilege: restrict source, destination, and application.",
                    f"Zones: {r['src_zones']} → {r['dst_zones']}",
                    line=r["line"],
                )

    # Check 2: missing security profiles ─────────────────────────────────────
    def _chk_missing_profiles(self):
        for r in self._active_allow():
            if not self._rule_has_security_profiles(r):
                self._issue(
                    "HIGH", "Missing Security Profiles", r["name"],
                    "Allow rule has no Antivirus / IPS / Anti-Spyware profile.",
                    "Attach a security profile group with AV, Vulnerability, and Spyware profiles.",
                    f"App: {r['applications']}  Svc: {r['services']}",
                    line=r["line"],
                )

    # Check 3: logging ────────────────────────────────────────────────────────
    def _chk_logging(self):
        for r in self._active_rules():
            if r["log_end"] == "no" and r["log_start"] == "no":
                self._issue(
                    "HIGH", "No Logging Configured", r["name"],
                    "Both log-at-session-start and log-at-session-end are disabled.",
                    "Enable at minimum log-at-session-end on all rules for audit visibility.",
                    f"Action: {r['action']}",
                    line=r["line"],
                )
            elif r["action"] == "allow" and r["log_end"] == "no":
                self._issue(
                    "MEDIUM", "Allow Rule Not Logging Session End", r["name"],
                    "Allow rule does not log at session end; traffic details won't be captured.",
                    "Enable log-at-session-end to record bytes transferred, duration, and threat data.",
                    line=r["line"],
                )

    # Check 4: overly permissive (partial any) ────────────────────────────────
    def _chk_overly_permissive(self):
        for r in self._active_allow():
            src_any = self._has_any(r["sources"])
            dst_any = self._has_any(r["destinations"])
            app_any = self._has_any(r["applications"])
            if src_any and dst_any and app_any:
                continue
            if src_any and not dst_any:
                self._issue(
                    "HIGH", "Unrestricted Source Address", r["name"],
                    "Allow rule permits traffic from any source IP.",
                    "Restrict the source to specific trusted IP ranges.",
                    f"Dest: {r['destinations']}  App: {r['applications']}",
                    line=r["line"],
                )
            if dst_any and not src_any:
                self._issue(
                    "HIGH", "Unrestricted Destination Address", r["name"],
                    "Allow rule permits traffic to any destination IP.",
                    "Restrict the destination to required hosts/subnets only.",
                    f"Src: {r['sources']}  App: {r['applications']}",
                    line=r["line"],
                )

    # Check 5: risky services from any ────────────────────────────────────────
    def _chk_risky_services_from_any(self):
        risky = {
            "rdp":    ("Exposed RDP from Any Source",    "HIGH",
                       "RDP allowed from any source — high brute-force/ransomware risk.",
                       "Restrict to management hosts or require VPN before RDP."),
            "telnet": ("Cleartext Telnet Allowed",        "HIGH",
                       "Telnet transmits credentials in cleartext.",
                       "Replace with SSH. Block all Telnet."),
            "ssh":    ("SSH Exposed from Any Source",     "MEDIUM",
                       "SSH allowed from any source — brute-force risk.",
                       "Restrict SSH to dedicated management network."),
            "smb":    ("SMB Exposed from Any Source",     "HIGH",
                       "SMB from any source enables lateral movement and ransomware spread.",
                       "Block SMB from untrusted zones entirely."),
            "vnc":    ("VNC Exposed from Any Source",     "HIGH",
                       "VNC often lacks strong authentication and uses cleartext.",
                       "Replace with a properly authenticated remote-access solution."),
        }
        for r in self._active_allow():
            if not self._has_any(r["sources"]):
                continue
            apps_lower = r["applications"].lower()
            for keyword, (category, sev, desc, rec) in risky.items():
                if keyword in apps_lower:
                    self._issue(sev, category, r["name"], desc, rec,
                                f"Src zones: {r['src_zones']}", line=r["line"])

    # Check 6: disabled rules ─────────────────────────────────────────────────
    def _chk_disabled_rules(self):
        for r in self.security_rules:
            if r["disabled"] == "yes":
                self._issue(
                    "LOW", "Disabled Rule", r["name"],
                    "Rule is disabled, adding clutter and potential confusion.",
                    "Remove disabled rules that are no longer needed.",
                    line=r["line"],
                )

    # Check 7: missing descriptions ───────────────────────────────────────────
    def _chk_missing_descriptions(self):
        for r in self.security_rules:
            if not r["description"]:
                self._issue(
                    "LOW", "Missing Rule Description", r["name"],
                    "No description is set; future reviewers cannot determine the rule's purpose.",
                    "Add a description stating the business owner and intent of the rule.",
                    line=r["line"],
                )

    # Check 8: negate rules ───────────────────────────────────────────────────
    def _chk_negate_rules(self):
        for r in self._active_rules():
            if r["negate_src"] == "yes":
                self._issue(
                    "MEDIUM", "Negated Source Address", r["name"],
                    "Rule uses a negated source — all IPs *except* the listed ones match.",
                    "Confirm this is intentional; consider rewriting as explicit allow/deny pairs.",
                    f"NOT ({r['sources']})",
                    line=r["line"],
                )
            if r["negate_dst"] == "yes":
                self._issue(
                    "MEDIUM", "Negated Destination Address", r["name"],
                    "Rule uses a negated destination — all IPs *except* the listed ones match.",
                    "Confirm this is intentional; consider rewriting as explicit allow/deny pairs.",
                    f"NOT ({r['destinations']})",
                    line=r["line"],
                )

    # Check 9: zones without protection profile ───────────────────────────────
    def _chk_zones_no_protection(self):
        for z in self.zones:
            if not z["zone_protection_profile"]:
                self._issue(
                    "MEDIUM", "Zone Missing Protection Profile", f"Zone: {z['name']}",
                    f"Zone '{z['name']}' has no Zone Protection Profile (DoS, flood, recon protection).",
                    "Assign a Zone Protection Profile — especially critical for external/untrust zones.",
                    f"Zone type: {z['type']}  Interfaces: {z['interfaces']}",
                    line=z["line"],
                )

    # Check 10: shadow rules ──────────────────────────────────────────────────
    def _chk_shadow_rules(self):
        active = self._active_rules()

        def covers(a_val: str, b_val: str) -> bool:
            a_set = {x.strip().lower() for x in a_val.split(",")}
            b_set = {x.strip().lower() for x in b_val.split(",")}
            if "any" in a_set:
                return True
            return b_set.issubset(a_set)

        for i, rule in enumerate(active):
            for prior in active[:i]:
                if prior["action"] != rule["action"]:
                    continue
                if (covers(prior["src_zones"],    rule["src_zones"]) and
                        covers(prior["dst_zones"],    rule["dst_zones"]) and
                        covers(prior["sources"],      rule["sources"]) and
                        covers(prior["destinations"], rule["destinations"]) and
                        covers(prior["applications"], rule["applications"]) and
                        covers(prior["services"],     rule["services"])):
                    self._issue(
                        "MEDIUM", "Potential Shadow Rule", rule["name"],
                        f"Rule may never be matched because rule '{prior['name']}' (#{prior['num']}) already covers its traffic.",
                        "Review rule order and remove or reorder as appropriate.",
                        f"Shadowed by: {prior['name']} (rule #{prior['num']})",
                        line=rule["line"],
                    )
                    break

    # Check 11: application=any + service=any on allow ────────────────────────
    def _chk_app_any_svc_any_allow(self):
        for r in self._active_allow():
            app_any = self._has_any(r["applications"])
            svc_any = self._has_any(r["services"])
            src_any = self._has_any(r["sources"])
            dst_any = self._has_any(r["destinations"])
            if app_any and svc_any and not (src_any and dst_any):
                self._issue(
                    "HIGH", "Application+Service Both Any", r["name"],
                    "Allow rule uses application=any AND service=any, completely bypassing App-ID.",
                    "Specify explicit applications; use service=application-default to enforce App-ID.",
                    f"Src: {r['sources']}  Dst: {r['destinations']}",
                    line=r["line"],
                )

    # Check 12: inbound allow without security inspection ─────────────────────
    def _chk_inbound_no_inspection(self):
        ext_hints = {"untrust", "external", "internet", "outside", "wan", "dmz", "public"}
        int_hints = {"trust", "internal", "inside", "lan", "servers", "server", "corporate"}

        for r in self._active_allow():
            src_z = {z.strip().lower() for z in r["src_zones"].split(",")}
            dst_z = {z.strip().lower() for z in r["dst_zones"].split(",")}

            is_inbound = any(any(h in z for h in ext_hints) for z in src_z)
            is_to_int  = any(any(h in z for h in int_hints) for z in dst_z)

            if is_inbound and is_to_int and not self._rule_has_security_profiles(r):
                self._issue(
                    "HIGH", "Inbound Allow Without Inspection", r["name"],
                    "Inbound rule (external→internal) allows traffic with no AV/IPS/Spyware profiles.",
                    "Apply a security profile group with AV, Vulnerability, and Spyware to all inbound rules.",
                    f"Zones: {r['src_zones']} → {r['dst_zones']}",
                    line=r["line"],
                )

    # Check 13: service=any on allow (not application-default) ────────────────
    def _chk_service_any_allow(self):
        for r in self._active_allow():
            svcs = [s.strip().lower() for s in r["services"].split(",")]
            apps = r["applications"].lower()
            if "any" in svcs and "any" not in apps:
                self._issue(
                    "MEDIUM", "Service=Any with Specific Application", r["name"],
                    "Rule uses service=any; application traffic is allowed on non-standard ports too.",
                    "Change service to 'application-default' to enforce standard port usage.",
                    f"App: {r['applications']}",
                    line=r["line"],
                )

    # ── Crypto / system parsers ───────────────────────────────────────────────

    def _parse_ike_crypto_profiles(self):
        for prof in self.root.findall(".//ike-crypto-profiles/entry"):
            lt_h = self._text(prof, "lifetime/hours", "")
            lt_m = self._text(prof, "lifetime/minutes", "")
            lt_s = self._text(prof, "lifetime/seconds", "")
            lt_d = self._text(prof, "lifetime/days", "")
            lifetime = (lt_d + "d" if lt_d else "") or (lt_h + "h" if lt_h else "") or \
                       (lt_m + "m" if lt_m else "") or (lt_s + "s" if lt_s else "")
            self.ike_crypto_profiles.append({
                "name":       prof.get("name", ""),
                "line":       self._lineno_str(prof),
                "encryption": ", ".join(self._members(prof, "encryption")),
                "hash":       ", ".join(self._members(prof, "hash")),
                "dh_group":   ", ".join(self._members(prof, "dh-group")),
                "lifetime":   lifetime,
            })

    def _parse_ipsec_crypto_profiles(self):
        for prof in self.root.findall(".//ipsec-crypto-profiles/entry"):
            # ESP or AH
            esp = prof.find("esp")
            ah  = prof.find("ah")
            if esp is not None:
                enc  = ", ".join(self._members(esp, "encryption"))
                auth = ", ".join(self._members(esp, "authentication"))
                proto = "esp"
            elif ah is not None:
                enc  = ""
                auth = ", ".join(self._members(ah, "authentication"))
                proto = "ah"
            else:
                enc, auth, proto = "", "", ""

            lt_h = self._text(prof, "lifetime/hours", "")
            lt_m = self._text(prof, "lifetime/minutes", "")
            lt_s = self._text(prof, "lifetime/seconds", "")
            lt_d = self._text(prof, "lifetime/days", "")
            lifetime = (lt_d + "d" if lt_d else "") or (lt_h + "h" if lt_h else "") or \
                       (lt_m + "m" if lt_m else "") or (lt_s + "s" if lt_s else "")

            self.ipsec_crypto_profiles.append({
                "name":       prof.get("name", ""),
                "line":       self._lineno_str(prof),
                "protocol":   proto,
                "encryption": enc,
                "auth":       auth,
                "dh_group":   self._text(prof, "dh-group"),
                "lifetime":   lifetime,
            })

    def _parse_ssl_tls_profiles(self):
        for prof in self.root.findall(".//ssl-tls-service-profile/entry"):
            self.ssl_tls_profiles.append({
                "name":        prof.get("name", ""),
                "line":        self._lineno_str(prof),
                "min_version": self._text(prof, "protocol-settings/min-version", "tls1-0"),
                "max_version": self._text(prof, "protocol-settings/max-version", "max"),
                "certificate": self._text(prof, "certificate"),
            })

    def _parse_ike_gateways(self):
        for gw in self.root.findall(".//ike-gateways/entry"):
            # IKEv1 vs IKEv2
            proto_ver = "ikev1"
            if gw.find("protocol/ikev2") is not None:
                proto_ver = "ikev2"
            if gw.find("protocol/version") is not None:
                ver_text = self._text(gw, "protocol/version")
                if ver_text:
                    proto_ver = ver_text

            self.ike_gateways.append({
                "name":            gw.get("name", ""),
                "line":            self._lineno_str(gw),
                "version":         proto_ver,
                "peer_ip":         self._text(gw, "peer-ip-value"),
                "local_ip":        self._text(gw, "local-ip-value"),
                "crypto_profile":  self._text(gw, "ikev1/ike-crypto-profile") or
                                   self._text(gw, "ikev2/ike-crypto-profile"),
                "auth_type":       self._text(gw, "authentication/pre-shared-key") and "psk" or
                                   (self._text(gw, "authentication/certificate") and "cert" or ""),
                "psk_set":         "yes" if gw.find("authentication/pre-shared-key") is not None else "no",
                "nat_traversal":   self._text(gw, "protocol-common/nat-traversal/enable", "no"),
            })

    def _parse_admin_accounts(self):
        for admin in self.root.findall(".//administrator/entry"):
            name = admin.get("name", "")
            role_type = "superuser" if admin.find("permissions/role-based/superuser") is not None else ""
            if not role_type:
                if admin.find("permissions/role-based/superreader") is not None:
                    role_type = "superreader"
                elif admin.find("permissions/role-based/vsysadmin") is not None:
                    role_type = "vsysadmin"
                elif admin.find("permissions/role-based/custom") is not None:
                    role_type = "custom"
                else:
                    role_type = "unknown"

            self.admin_accounts.append({
                "name":             name,
                "line":             self._lineno_str(admin),
                "role":             role_type,
                "auth_profile":     self._text(admin, "authentication-profile"),
                "public_key":       "yes" if admin.find("public-key") is not None else "no",
                "password_hash":    "set" if admin.find("phash") is not None else "none",
            })

    def _parse_mgmt_settings(self):
        sys_el = self.root.find(".//deviceconfig/system")
        if sys_el is None:
            self.mgmt_settings = {}
            return

        # Permitted IPs for management
        permitted = [e.get("name", "") for e in sys_el.findall("permitted-ip/entry")]

        # Services enabled/disabled
        svc = sys_el.find("service")
        def svc_enabled(tag: str) -> bool:
            if svc is None:
                return True
            val = self._text(svc, f"disable-{tag}", "no")
            return val.lower() != "yes"

        # SNMP
        snmp_v1  = sys_el.find(".//snmp-setting/access-setting/version/v1")  is not None
        snmp_v2c = sys_el.find(".//snmp-setting/access-setting/version/v2c") is not None
        snmp_v3  = sys_el.find(".//snmp-setting/access-setting/version/v3")  is not None
        community = self._text(sys_el, ".//snmp-setting/access-setting/version/v2c/snmp-community-string")

        # NTP
        ntp_primary   = self._text(sys_el, "ntp-servers/primary-ntp-server/ntp-server-address")
        ntp_secondary = self._text(sys_el, "ntp-servers/secondary-ntp-server/ntp-server-address")

        # DNS
        dns_primary = self._text(sys_el, "dns-setting/servers/primary")
        dns_secondary = self._text(sys_el, "dns-setting/servers/secondary")

        # Login banner
        login_banner = self._text(sys_el, "login-banner")

        self.mgmt_settings = {
            "permitted_ips":   permitted,
            "http_enabled":    svc_enabled("http"),
            "https_enabled":   svc_enabled("https"),
            "telnet_enabled":  svc_enabled("telnet"),
            "ssh_enabled":     svc_enabled("ssh"),
            "snmp_enabled":    svc_enabled("snmp"),
            "snmp_v1":         snmp_v1,
            "snmp_v2c":        snmp_v2c,
            "snmp_v3":         snmp_v3,
            "snmp_community":  community,
            "ntp_primary":     ntp_primary,
            "ntp_secondary":   ntp_secondary,
            "dns_primary":     dns_primary,
            "dns_secondary":   dns_secondary,
            "login_banner":    login_banner,
            "hostname":        self._text(sys_el, "hostname"),
        }

    def _parse_syslog_servers(self):
        for srv in self.root.findall(".//syslog/entry"):
            for server in srv.findall("server/entry"):
                self.log_syslog_servers.append({
                    "profile": srv.get("name", ""),
                    "name":    server.get("name", ""),
                    "server":  self._text(server, "server"),
                    "port":    self._text(server, "port", "514"),
                    "transport": self._text(server, "transport", "UDP"),
                    "format":  self._text(server, "format", "BSD"),
                    "facility": self._text(server, "facility", "LOG_USER"),
                })

    # ── Crypto / system checks ────────────────────────────────────────────────

    # Weak values reference tables
    _WEAK_ENC  = {"des", "3des", "null"}
    _WEAK_HASH = {"md5", "sha1"}
    _WEAK_DH   = {"group1", "group2", "group5"}      # 768, 1024, 1536-bit
    _CRIT_DH   = {"group1"}                           # 768-bit
    _WEAK_TLS  = {"ssl3-0": "CRITICAL", "tls1-0": "HIGH", "tls1-1": "MEDIUM"}

    def _chk_weak_ike_crypto(self):
        for p in self.ike_crypto_profiles:
            name = f"IKE Profile: {p['name']}"
            encs = {e.strip().lower() for e in p["encryption"].split(",")}
            hashes = {h.strip().lower() for h in p["hash"].split(",")}
            dh_groups = {g.strip().lower() for g in p["dh_group"].split(",")}

            for enc in encs & self._WEAK_ENC:
                sev = "CRITICAL" if enc in ("des", "null") else "HIGH"
                self._issue(sev, "Weak IKE Encryption", name,
                    f"IKE crypto profile '{p['name']}' uses {enc.upper()} encryption.",
                    f"Replace {enc.upper()} with AES-256-GCM or AES-256-CBC.",
                    f"Encryption list: {p['encryption']}", line=p["line"])

            for h in hashes & self._WEAK_HASH:
                sev = "HIGH" if h == "md5" else "MEDIUM"
                self._issue(sev, "Weak IKE Hash/PRF", name,
                    f"IKE crypto profile '{p['name']}' uses {h.upper()} for integrity/PRF.",
                    f"Replace {h.upper()} with SHA-256, SHA-384, or SHA-512.",
                    f"Hash list: {p['hash']}", line=p["line"])

            for dh in dh_groups & self._WEAK_DH:
                sev = "CRITICAL" if dh in self._CRIT_DH else "HIGH"
                self._issue(sev, "Weak IKE DH Group", name,
                    f"IKE crypto profile '{p['name']}' includes {dh} (insufficient key size).",
                    "Use DH Group 14 (2048-bit) minimum; prefer Group 19/20 (ECDH-256/384).",
                    f"DH groups: {p['dh_group']}", line=p["line"])

    def _chk_weak_ipsec_crypto(self):
        for p in self.ipsec_crypto_profiles:
            name = f"IPSec Profile: {p['name']}"
            encs  = {e.strip().lower() for e in p["encryption"].split(",")} if p["encryption"] else set()
            auths = {a.strip().lower() for a in p["auth"].split(",")}       if p["auth"]       else set()
            dh    = p["dh_group"].strip().lower()

            for enc in encs & self._WEAK_ENC:
                sev = "CRITICAL" if enc in ("des", "null") else "HIGH"
                self._issue(sev, "Weak IPSec Encryption", name,
                    f"IPSec crypto profile '{p['name']}' uses {enc.upper()} for ESP encryption.",
                    f"Replace {enc.upper()} with AES-256-GCM (preferred) or AES-256-CBC.",
                    f"Encryption list: {p['encryption']}", line=p["line"])

            for a in auths & self._WEAK_HASH:
                sev = "HIGH" if a == "md5" else "MEDIUM"
                self._issue(sev, "Weak IPSec Authentication", name,
                    f"IPSec crypto profile '{p['name']}' uses {a.upper()} for ESP authentication.",
                    f"Replace {a.upper()} with SHA-256 or higher.",
                    f"Auth list: {p['auth']}", line=p["line"])

            if dh in self._WEAK_DH:
                sev = "CRITICAL" if dh in self._CRIT_DH else "HIGH"
                self._issue(sev, "Weak IPSec DH Group (PFS)", name,
                    f"IPSec profile '{p['name']}' uses {dh} for Perfect Forward Secrecy.",
                    "Use DH Group 14 minimum for PFS; prefer Group 19/20.",
                    f"DH group: {p['dh_group']}", line=p["line"])

            if dh in ("no-pfs", "") and p["dh_group"].lower() in ("no-pfs", ""):
                self._issue("MEDIUM", "IPSec PFS Disabled", name,
                    f"IPSec profile '{p['name']}' has Perfect Forward Secrecy disabled.",
                    "Enable PFS with at least DH Group 14 to limit session key exposure.",
                    "", line=p["line"])

    def _chk_weak_ssl_tls(self):
        weak_map = {"ssl3-0": "CRITICAL", "tls1-0": "HIGH", "tls1-1": "MEDIUM"}
        version_order = ["ssl3-0", "tls1-0", "tls1-1", "tls1-2", "tls1-3", "max"]

        for p in self.ssl_tls_profiles:
            name = f"SSL/TLS Profile: {p['name']}"
            min_ver = p["min_version"].strip().lower()

            if min_ver in weak_map:
                sev = weak_map[min_ver]
                self._issue(sev, "Weak Minimum TLS Version", name,
                    f"SSL/TLS profile '{p['name']}' allows {min_ver.upper().replace('-', '.')} connections.",
                    "Set minimum version to TLS 1.2; prefer TLS 1.3 where supported.",
                    f"min-version: {p['min_version']}  max-version: {p['max_version']}",
                    line=p["line"])

        # Also check GlobalProtect and management SSL profiles embedded elsewhere
        for prof in self.root.findall(".//ssl-exclude-cert/entry"):
            pass  # placeholder for future cert checks

    def _chk_ike_gateways(self):
        for gw in self.ike_gateways:
            name = f"IKE Gateway: {gw['name']}"
            if gw["version"].lower() == "ikev1":
                self._issue("MEDIUM", "IKEv1 in Use", name,
                    f"IKE gateway '{gw['name']}' uses IKEv1, which lacks several security improvements.",
                    "Migrate to IKEv2 for stronger authentication, built-in NAT-T, and DoS resistance.",
                    f"Peer: {gw['peer_ip']}", line=gw["line"])

            if gw["psk_set"] == "yes":
                self._issue("LOW", "IKE Pre-Shared Key Authentication", name,
                    f"IKE gateway '{gw['name']}' uses PSK authentication.",
                    "Certificate-based authentication is preferred over PSK for scalability and security.",
                    f"Peer: {gw['peer_ip']}", line=gw["line"])

    def _chk_management_access(self):
        m = self.mgmt_settings
        if not m:
            return

        if m.get("http_enabled"):
            self._issue("HIGH", "HTTP Management Enabled", "Management",
                "HTTP access to the management interface is enabled (cleartext).",
                "Disable HTTP management: set service/disable-http to yes.",
                "Management traffic including credentials sent in plaintext over HTTP.")

        if m.get("telnet_enabled"):
            self._issue("HIGH", "Telnet Management Enabled", "Management",
                "Telnet access to the management interface is enabled (cleartext).",
                "Disable Telnet management: set service/disable-telnet to yes. Use SSH instead.",
                "")

        if not m.get("permitted_ips"):
            self._issue("MEDIUM", "No Management IP Restrictions", "Management",
                "No permitted-ip entries restrict which hosts can reach the management interface.",
                "Add permitted-ip entries to restrict management access to known admin hosts/subnets.",
                "Without restrictions, any host that can route to the mgmt interface can attempt login.")

        if not m.get("ntp_primary"):
            self._issue("MEDIUM", "NTP Not Configured", "Management",
                "No primary NTP server is configured.",
                "Configure at least two NTP servers for accurate timestamps in logs and certificates.",
                "Inaccurate time breaks certificate validation, log correlation, and TOTP/MFA.")

        if not m.get("login_banner"):
            self._issue("LOW", "No Login Banner", "Management",
                "No login banner is configured on the management interface.",
                "Add a legal warning banner (login-banner) to satisfy compliance requirements and "
                "establish notice of unauthorized access.",
                "")

        if not m.get("dns_primary"):
            self._issue("LOW", "DNS Not Configured", "Management",
                "No primary DNS server is configured in device settings.",
                "Configure DNS for FQDN resolution used by URL filtering, FQDN objects, and updates.",
                "")

    def _chk_admin_accounts(self):
        superusers = [a for a in self.admin_accounts if a["role"] == "superuser"]

        for admin in self.admin_accounts:
            name = f"Admin: {admin['name']}"
            if not admin["auth_profile"]:
                self._issue("HIGH", "Admin Without Authentication Profile", name,
                    f"Administrator '{admin['name']}' has no authentication profile — "
                    "local password only, no MFA.",
                    "Assign an authentication profile with MFA to all admin accounts.",
                    f"Role: {admin['role']}", line=admin["line"])

            if admin["password_hash"] == "none" and admin["public_key"] == "no":
                self._issue("CRITICAL", "Admin Account Has No Password", name,
                    f"Administrator '{admin['name']}' has no password hash or SSH key set.",
                    "Set a strong password or SSH key for this account immediately.",
                    f"Role: {admin['role']}", line=admin["line"])

        if len(superusers) > 2:
            names = ", ".join(a["name"] for a in superusers)
            self._issue("MEDIUM", "Excessive Superuser Accounts", "Admin Accounts",
                f"{len(superusers)} accounts have the superuser role.",
                "Limit superuser accounts to the minimum required; use role-based access for others.",
                f"Superusers: {names}")

    def _chk_snmp(self):
        m = self.mgmt_settings
        if not m:
            return

        if m.get("snmp_v1"):
            self._issue("HIGH", "SNMPv1 Enabled", "SNMP",
                "SNMPv1 is enabled; it uses cleartext community strings and has no authentication.",
                "Disable SNMPv1. Use SNMPv3 with authPriv (auth + encryption).",
                "")

        if m.get("snmp_v2c"):
            self._issue("MEDIUM", "SNMPv2c Enabled", "SNMP",
                "SNMPv2c is enabled; community strings are transmitted in cleartext.",
                "Migrate to SNMPv3 with authPriv. If SNMPv2c is required, restrict source IPs.",
                "")

        community = m.get("snmp_community", "").lower()
        if community in ("public", "private", "cisco", "community", "snmp"):
            self._issue("CRITICAL", "Default/Weak SNMP Community String", "SNMP",
                f"SNMP community string is set to the well-known default value '{community}'.",
                "Change the community string to a long random value and restrict allowed SNMP hosts.",
                "")

        if m.get("snmp_v1") or m.get("snmp_v2c"):
            if not m.get("permitted_ips"):
                self._issue("HIGH", "SNMP Enabled Without Source Restrictions", "SNMP",
                    "SNMP is enabled and no management permitted-ip list is configured.",
                    "Restrict SNMP access to specific NMS hosts via permitted-ip or ACL.",
                    "")

    def _chk_no_syslog(self):
        if not self.log_syslog_servers:
            self._issue("MEDIUM", "No Syslog Servers Configured", "Logging",
                "No syslog servers are defined; firewall logs may only reside on the local device.",
                "Configure at least one remote syslog server (preferably two) for log retention, "
                "correlation, and incident response.",
                "")
        else:
            # Check for unencrypted syslog
            for srv in self.log_syslog_servers:
                if srv["transport"].upper() == "UDP":
                    self._issue("LOW", "Syslog Transmitted Over UDP", f"Syslog: {srv['server']}",
                        f"Syslog server {srv['server']} uses UDP — logs can be lost or spoofed in transit.",
                        "Switch syslog transport to TCP or SSL for reliable, tamper-evident log delivery.",
                        f"Profile: {srv['profile']}  Port: {srv['port']}")


# ── Excel report writer ───────────────────────────────────────────────────────
class ExcelReporter:
    SEV_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
    SEV_COLORS = {
        "CRITICAL": (C["critical"],   C["critical_l"]),
        "HIGH":     (C["high"],       C["high_l"]),
        "MEDIUM":   (C["medium"],     C["medium_l"]),
        "LOW":      (C["low"],        C["low_l"]),
        "INFO":     (C["info"],       C["info_l"]),
    }
    ACTION_COLORS = {
        "allow":        (C["allow"],  C["allow_l"]),
        "deny":         (C["deny"],   C["deny_l"]),
        "drop":         (C["deny"],   C["deny_l"]),
        "reset-client": (C["deny"],   C["deny_l"]),
        "reset-server": (C["deny"],   C["deny_l"]),
        "reset-both":   (C["deny"],   C["deny_l"]),
    }

    def __init__(self, parser: PaloAltoParser, output_file: str):
        self.p = parser
        self.out = output_file
        self.wb = openpyxl.Workbook()
        self.wb.remove(self.wb.active)

    # ── Sheet helpers ─────────────────────────────────────────────────────────
    def _hdr(self, ws, headers: list[str], row: int = 1):
        for col, h in enumerate(headers, 1):
            c = ws.cell(row=row, column=col, value=h)
            c.fill  = _fill(C["hdr_bg"])
            c.font  = _font(bold=True, color=C["hdr_fg"])
            c.alignment = _align("center", wrap=False)
            c.border = THIN
        ws.row_dimensions[row].height = 28

    def _row_fill(self, row_idx: int, disabled: bool = False) -> str | None:
        if disabled:
            return C["info_l"]
        return C["alt_row"] if row_idx % 2 == 0 else None

    def _set_widths(self, ws, widths: list[int | float]):
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w

    def _write_cell(self, ws, row, col, value, bold=False, bg=None,
                    fg="000000", h="left", border=True):
        c = ws.cell(row=row, column=col, value=value)
        c.font      = _font(bold=bold, color=fg)
        c.alignment = _align(h)
        if bg:
            c.fill = _fill(bg)
        if border:
            c.border = THIN
        return c

    # ── Summary ───────────────────────────────────────────────────────────────
    def _sheet_summary(self):
        ws = self.wb.create_sheet("Summary", 0)
        ws.sheet_view.showGridLines = False

        # Title banner
        ws.merge_cells("A1:G1")
        c = ws["A1"]
        c.value = "Palo Alto Firewall — Configuration Security Report"
        c.font  = Font(name="Calibri", bold=True, size=16, color="FFFFFF")
        c.fill  = _fill(C["hdr_bg"])
        c.alignment = _align("center", wrap=False)
        ws.row_dimensions[1].height = 42

        ws.merge_cells("A2:G2")
        c = ws["A2"]
        c.value = (f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}    "
                   f"Source file: {os.path.basename(self.p.config_file)}")
        c.font  = _font(italic=True, color="595959", size=9)
        c.fill  = _fill("F2F2F2")
        c.alignment = _align("center", wrap=False)
        ws.row_dimensions[2].height = 18

        row = 4
        p = self.p

        def section_header(label: str):
            nonlocal row
            ws.cell(row=row, column=1).value = label
            ws.cell(row=row, column=1).font = _font(bold=True, color=C["hdr_bg"], size=12)
            row += 1

        def kv(label: str, value):
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
        kv("Security Rules (total)",    len(p.security_rules))
        kv("  Active",  sum(1 for r in p.security_rules if r["disabled"] != "yes"))
        kv("  Disabled", sum(1 for r in p.security_rules if r["disabled"] == "yes"))
        kv("  Allow",   sum(1 for r in p.security_rules if r["action"] == "allow"))
        kv("  Deny/Drop/Reset", sum(1 for r in p.security_rules
                                   if r["action"] not in ("allow",)))
        kv("NAT Rules", len(p.nat_rules))
        kv("Address Objects", len(p.address_objects))
        kv("Address Groups",  len(p.address_groups))
        kv("Service Objects", len(p.service_objects))
        kv("Service Groups",  len(p.service_groups))
        kv("Zones", len(p.zones))
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
            c1.fill  = _fill(bg); c1.font = _font(bold=True, color=fg)
            c1.alignment = _align("center"); c1.border = THIN
            c2 = ws.cell(row=row, column=2, value=cnt)
            c2.fill  = _fill(bg); c2.font = _font(bold=True, color=fg)
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

        self._set_widths(ws, [40, 15, 15, 15, 15, 15, 15])

    # ── Security rules ────────────────────────────────────────────────────────
    def _sheet_security_rules(self):
        ws = self.wb.create_sheet("Security Rules")
        ws.sheet_view.showGridLines = False
        headers = [
            "#", "Rule Name", "Line #", "Status", "Rulebase",
            "Src Zone", "Dst Zone", "Source Address", "Destination Address",
            "Negate Src", "Negate Dst", "Application", "Service", "URL Category",
            "Action",
            "Profile/Group", "AV", "Vulnerability", "Spyware",
            "URL Filter", "File Blocking", "WildFire",
            "Log Start", "Log End", "Log Profile",
            "HIP Profiles", "Schedule", "Tags", "Description",
        ]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"

        for rule in self.p.security_rules:
            row = rule["num"] + 1
            disabled = rule["disabled"] == "yes"
            row_bg = self._row_fill(row, disabled)

            # Expand profile group
            pt = rule["profile_type"]
            if pt == "group":
                pg = rule["profiles"].get("group", "")
                prof_display = f"Group: {pg}"
                grp_data = self.p.profile_groups.get(pg, {})
                av   = grp_data.get("virus", "")
                vuln = grp_data.get("vulnerability", "")
                spy  = grp_data.get("spyware", "")
                url  = grp_data.get("url-filtering", "")
                fb   = grp_data.get("file-blocking", "")
                wf   = grp_data.get("wildfire-analysis", "")
            else:
                prof_display = ""
                av   = rule["profiles"].get("virus", "")
                vuln = rule["profiles"].get("vulnerability", "")
                spy  = rule["profiles"].get("spyware", "")
                url  = rule["profiles"].get("url-filtering", "")
                fb   = rule["profiles"].get("file-blocking", "")
                wf   = rule["profiles"].get("wildfire-analysis", "")

            values = [
                rule["num"], rule["name"], rule.get("line", ""),
                "Disabled" if disabled else "Active", rule["rulebase"],
                rule["src_zones"], rule["dst_zones"],
                rule["sources"], rule["destinations"],
                rule["negate_src"], rule["negate_dst"],
                rule["applications"], rule["services"], rule["categories"],
                rule["action"].upper(),
                prof_display, av, vuln, spy, url, fb, wf,
                rule["log_start"], rule["log_end"], rule["log_setting"],
                rule["hip_profiles"], rule["schedule"],
                rule["tags"], rule["description"],
            ]

            action = rule["action"].lower()
            act_fg, act_bg = self.ACTION_COLORS.get(action, (C["info"], C["info_l"]))

            for col, val in enumerate(values, 1):
                fg = C["disabled"] if disabled else "000000"
                bg = row_bg
                bold = False

                if col == 15:  # Action (shifted +1 for Line # column)
                    fg, bg, bold = act_fg, act_bg, True
                elif col == 3:  # Line # — center
                    c2 = ws.cell(row=row, column=col, value=val)
                    c2.font = _font(color=C["info"] if not disabled else C["disabled"])
                    c2.alignment = _align("center")
                    c2.border = THIN
                    if bg:
                        c2.fill = _fill(bg)
                    continue

                c = ws.cell(row=row, column=col, value=val)
                c.font      = _font(bold=bold, color=fg)
                c.alignment = _align()
                c.border    = THIN
                if bg:
                    c.fill = _fill(bg)

        widths = [4, 30, 10, 9, 13, 20, 20, 28, 28, 10, 10,
                  30, 20, 18, 10,
                  22, 15, 15, 15, 15, 15, 15,
                  10, 10, 20, 20, 15, 20, 40]
        self._set_widths(ws, widths)

    # ── NAT rules ─────────────────────────────────────────────────────────────
    def _sheet_nat_rules(self):
        ws = self.wb.create_sheet("NAT Rules")
        ws.sheet_view.showGridLines = False
        headers = [
            "#", "Rule Name", "Line #", "Status", "Type",
            "Src Zone", "Dst Zone", "Source", "Destination", "Service",
            "Src Trans Type", "Src Trans Value",
            "Dst Trans Address", "Dst Trans Port",
            "Description", "Tags",
        ]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"

        for rule in self.p.nat_rules:
            row = rule["num"] + 1
            disabled = rule["disabled"] == "yes"
            bg = self._row_fill(row, disabled)
            values = [
                rule["num"], rule["name"], rule.get("line", ""),
                "Disabled" if disabled else "Active", rule["nat_type"],
                rule["src_zones"], rule["dst_zones"],
                rule["sources"], rule["destinations"], rule["services"],
                rule["src_trans_type"], rule["src_trans_value"],
                rule["dst_trans_addr"], rule["dst_trans_port"],
                rule["description"], rule["tags"],
            ]
            for col, val in enumerate(values, 1):
                c = ws.cell(row=row, column=col, value=val)
                c.font      = _font(color=C["disabled"] if disabled else "000000")
                c.alignment = _align()
                c.border    = THIN
                if bg:
                    c.fill = _fill(bg)

        widths = [4, 32, 10, 9, 9, 20, 20, 28, 28, 18, 22, 28, 22, 16, 38, 20]
        self._set_widths(ws, widths)

    # ── Address objects ───────────────────────────────────────────────────────
    def _sheet_address_objects(self):
        ws = self.wb.create_sheet("Address Objects")
        ws.sheet_view.showGridLines = False
        headers = ["Scope", "Name", "Type", "Value / Address", "Description", "Tags"]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"

        for i, obj in enumerate(self.p.address_objects, 2):
            bg = self._row_fill(i)
            for col, val in enumerate([
                obj["scope"], obj["name"], obj["type"],
                obj["value"], obj["description"], obj["tags"]
            ], 1):
                c = ws.cell(row=i, column=col, value=val)
                c.font = _font(); c.alignment = _align(); c.border = THIN
                if bg:
                    c.fill = _fill(bg)

        self._set_widths(ws, [16, 36, 14, 32, 42, 26])

    # ── Address groups ────────────────────────────────────────────────────────
    def _sheet_address_groups(self):
        ws = self.wb.create_sheet("Address Groups")
        ws.sheet_view.showGridLines = False
        headers = ["Scope", "Name", "Type", "Static Members / Dynamic Filter", "Description", "Tags"]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"

        for i, grp in enumerate(self.p.address_groups, 2):
            bg = self._row_fill(i)
            val = grp["dynamic_filter"] if grp["type"] == "dynamic" else grp["members"]
            for col, v in enumerate([
                grp["scope"], grp["name"], grp["type"], val,
                grp["description"], grp["tags"]
            ], 1):
                c = ws.cell(row=i, column=col, value=v)
                c.font = _font(); c.alignment = _align(); c.border = THIN
                if bg:
                    c.fill = _fill(bg)

        self._set_widths(ws, [16, 36, 12, 65, 42, 26])

    # ── Service objects ───────────────────────────────────────────────────────
    def _sheet_service_objects(self):
        ws = self.wb.create_sheet("Service Objects")
        ws.sheet_view.showGridLines = False

        # Service objects section
        ws.cell(row=1, column=1).value = "SERVICE OBJECTS"
        ws.cell(row=1, column=1).font  = _font(bold=True, color=C["hdr_bg"], size=11)
        ws.row_dimensions[1].height = 22

        headers = ["Scope", "Name", "Protocol", "Port(s)", "Description"]
        self._hdr(ws, headers, row=2)
        ws.freeze_panes = "A3"

        for i, svc in enumerate(self.p.service_objects, 3):
            bg = self._row_fill(i)
            for col, v in enumerate([
                svc["scope"], svc["name"], svc["protocol"],
                svc["port"], svc["description"]
            ], 1):
                c = ws.cell(row=i, column=col, value=v)
                c.font = _font(); c.alignment = _align(); c.border = THIN
                if bg:
                    c.fill = _fill(bg)

        sep = len(self.p.service_objects) + 4
        if self.p.service_groups:
            ws.cell(row=sep, column=1).value = "SERVICE GROUPS"
            ws.cell(row=sep, column=1).font = _font(bold=True, color=C["hdr_bg"], size=11)
            self._hdr(ws, ["Scope", "Name", "Members", "", "Tags"], row=sep + 1)
            for i, grp in enumerate(self.p.service_groups, sep + 2):
                bg = self._row_fill(i)
                for col, v in enumerate([
                    grp["scope"], grp["name"], grp["members"], "", grp["tags"]
                ], 1):
                    c = ws.cell(row=i, column=col, value=v)
                    c.font = _font(); c.alignment = _align(); c.border = THIN
                    if bg:
                        c.fill = _fill(bg)

        ws.auto_filter.ref = f"A2:{get_column_letter(5)}{sep - 1}" if sep > 3 else None
        self._set_widths(ws, [16, 36, 12, 30, 44])

    # ── Zones ─────────────────────────────────────────────────────────────────
    def _sheet_zones(self):
        ws = self.wb.create_sheet("Zones")
        ws.sheet_view.showGridLines = False
        headers = ["Zone Name", "Type", "Interfaces",
                   "Zone Protection Profile", "User-ID", "Log Setting"]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"

        for i, z in enumerate(self.p.zones, 2):
            bg = self._row_fill(i)
            has_prot = bool(z["zone_protection_profile"])
            values = [
                z["name"], z["type"], z["interfaces"],
                z["zone_protection_profile"] or "NONE",
                z["user_id"], z["log_setting"],
            ]
            for col, val in enumerate(values, 1):
                c = ws.cell(row=i, column=col, value=val)
                c.font = _font(); c.alignment = _align(); c.border = THIN
                if col == 4 and not has_prot:
                    c.fill  = _fill(C["medium_l"])
                    c.font  = _font(bold=True, color=C["medium"])
                elif bg:
                    c.fill = _fill(bg)

        self._set_widths(ws, [30, 18, 44, 36, 12, 26])

    # ── Security issues ───────────────────────────────────────────────────────
    def _sheet_issues(self):
        ws = self.wb.create_sheet("Security Issues")
        ws.sheet_view.showGridLines = False
        headers = ["#", "Severity", "Category",
                   "Rule / Object", "Config Line(s)", "Description", "Recommendation", "Details"]
        self._hdr(ws, headers)
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"

        sorted_issues = sorted(
            self.p.issues,
            key=lambda x: self.SEV_ORDER.get(x["severity"], 9),
        )
        for idx, iss in enumerate(sorted_issues, 1):
            row = idx + 1
            sev = iss["severity"]
            fg, bg = self.SEV_COLORS[sev]
            row_bg = self._row_fill(row)

            values = [idx, sev, iss["category"], iss["rule_name"],
                      iss.get("line", ""),
                      iss["description"], iss["recommendation"], iss.get("details", "")]
            for col, val in enumerate(values, 1):
                c = ws.cell(row=row, column=col, value=val)
                c.border = THIN
                if col == 2:
                    c.fill  = _fill(bg)
                    c.font  = _font(bold=True, color=fg)
                    c.alignment = _align("center")
                elif col in (1, 5):
                    c.font = _font(bold=(col == 1))
                    c.alignment = _align("center")
                    if row_bg:
                        c.fill = _fill(row_bg)
                else:
                    c.font = _font()
                    c.alignment = _align()
                    if row_bg:
                        c.fill = _fill(row_bg)
            ws.row_dimensions[row].height = 40

        self._set_widths(ws, [4, 12, 32, 36, 14, 62, 62, 36])

    # ── Crypto & System Config ────────────────────────────────────────────────
    def _sheet_crypto_system(self):
        ws = self.wb.create_sheet("Crypto & System")
        ws.sheet_view.showGridLines = False
        p = self.p

        WEAK_ENC  = {"des", "3des", "null"}
        WEAK_HASH = {"md5", "sha1"}
        WEAK_DH   = {"group1", "group2", "group5"}

        def flag_cell(cell, value: str, bad_set: set, crit_set: set | None = None):
            lv = value.strip().lower()
            if lv in (crit_set or set()):
                cell.fill  = _fill(C["critical_l"])
                cell.font  = _font(bold=True, color=C["critical"])
            elif lv in bad_set:
                cell.fill  = _fill(C["high_l"])
                cell.font  = _font(bold=True, color=C["high"])
            else:
                cell.font  = _font()

        def flag_multi(cell, csv_value: str, bad_set: set, crit_set: set | None = None):
            """Highlight cell if any token in a CSV value is in the bad set."""
            tokens = {t.strip().lower() for t in csv_value.split(",") if t.strip()}
            if tokens & (crit_set or set()):
                cell.fill = _fill(C["critical_l"])
                cell.font = _font(bold=True, color=C["critical"])
            elif tokens & bad_set:
                cell.fill = _fill(C["high_l"])
                cell.font = _font(bold=True, color=C["high"])
            else:
                cell.font = _font()

        def flag_tls(cell, version: str):
            ver = version.strip().lower()
            if ver == "ssl3-0":
                cell.fill = _fill(C["critical_l"]); cell.font = _font(bold=True, color=C["critical"])
            elif ver == "tls1-0":
                cell.fill = _fill(C["high_l"]);     cell.font = _font(bold=True, color=C["high"])
            elif ver == "tls1-1":
                cell.fill = _fill(C["medium_l"]);   cell.font = _font(bold=True, color=C["medium"])
            else:
                cell.font = _font()

        row = 1

        def section(title: str, headers: list[str]) -> int:
            nonlocal row
            ws.cell(row=row, column=1).value = title
            ws.cell(row=row, column=1).font  = _font(bold=True, color=C["hdr_bg"], size=12)
            ws.row_dimensions[row].height = 22
            row += 1
            self._hdr(ws, headers, row=row)
            row += 1
            return row  # first data row

        # ── IKE Crypto Profiles ───────────────────────────────────────────────
        section("IKE CRYPTO PROFILES", ["Name", "Encryption", "Hash / PRF", "DH Group", "Lifetime"])
        for prof in p.ike_crypto_profiles:
            bg = C["alt_row"] if row % 2 == 0 else None
            vals = [prof["name"], prof["encryption"], prof["hash"], prof["dh_group"], prof["lifetime"]]
            for col, v in enumerate(vals, 1):
                c = ws.cell(row=row, column=col, value=v)
                c.alignment = _align(); c.border = THIN
                if bg:
                    c.fill = _fill(bg)
            flag_multi(ws.cell(row=row, column=2), prof["encryption"], WEAK_ENC, {"des", "null"})
            flag_multi(ws.cell(row=row, column=3), prof["hash"],       WEAK_HASH, {"md5"})
            flag_multi(ws.cell(row=row, column=4), prof["dh_group"],   WEAK_DH,  {"group1"})
            row += 1
        if not p.ike_crypto_profiles:
            ws.cell(row=row, column=1).value = "(none found)"
            ws.cell(row=row, column=1).font = _font(italic=True, color=C["info"])
            row += 1
        row += 1

        # ── IPSec Crypto Profiles ─────────────────────────────────────────────
        section("IPSEC CRYPTO PROFILES",
                ["Name", "Protocol", "Encryption", "Authentication", "DH Group (PFS)", "Lifetime"])
        for prof in p.ipsec_crypto_profiles:
            bg = C["alt_row"] if row % 2 == 0 else None
            vals = [prof["name"], prof["protocol"], prof["encryption"],
                    prof["auth"], prof["dh_group"], prof["lifetime"]]
            for col, v in enumerate(vals, 1):
                c = ws.cell(row=row, column=col, value=v)
                c.alignment = _align(); c.border = THIN
                if bg:
                    c.fill = _fill(bg)
            flag_multi(ws.cell(row=row, column=3), prof["encryption"], WEAK_ENC, {"des", "null"})
            flag_multi(ws.cell(row=row, column=4), prof["auth"],       WEAK_HASH, {"md5"})
            dh_val = prof["dh_group"].strip().lower()
            dh_cell = ws.cell(row=row, column=5)
            if dh_val in ("no-pfs", ""):
                dh_cell.fill = _fill(C["medium_l"]); dh_cell.font = _font(bold=True, color=C["medium"])
            else:
                flag_cell(dh_cell, dh_val, WEAK_DH, {"group1"})
            row += 1
        if not p.ipsec_crypto_profiles:
            ws.cell(row=row, column=1).value = "(none found)"
            ws.cell(row=row, column=1).font = _font(italic=True, color=C["info"])
            row += 1
        row += 1

        # ── SSL/TLS Profiles ──────────────────────────────────────────────────
        section("SSL/TLS SERVICE PROFILES", ["Name", "Min TLS Version", "Max TLS Version", "Certificate"])
        for prof in p.ssl_tls_profiles:
            bg = C["alt_row"] if row % 2 == 0 else None
            vals = [prof["name"], prof["min_version"], prof["max_version"], prof["certificate"]]
            for col, v in enumerate(vals, 1):
                c = ws.cell(row=row, column=col, value=v)
                c.alignment = _align(); c.border = THIN
                if bg:
                    c.fill = _fill(bg)
            flag_tls(ws.cell(row=row, column=2), prof["min_version"])
            row += 1
        if not p.ssl_tls_profiles:
            ws.cell(row=row, column=1).value = "(none found)"
            ws.cell(row=row, column=1).font = _font(italic=True, color=C["info"])
            row += 1
        row += 1

        # ── IKE Gateways ──────────────────────────────────────────────────────
        section("IKE GATEWAYS",
                ["Name", "IKE Version", "Peer IP", "Local IP",
                 "Crypto Profile", "Auth Type", "NAT-T"])
        for gw in p.ike_gateways:
            bg = C["alt_row"] if row % 2 == 0 else None
            vals = [gw["name"], gw["version"], gw["peer_ip"], gw["local_ip"],
                    gw["crypto_profile"], gw["auth_type"], gw["nat_traversal"]]
            for col, v in enumerate(vals, 1):
                c = ws.cell(row=row, column=col, value=v)
                c.alignment = _align(); c.border = THIN
                if bg:
                    c.fill = _fill(bg)
            ver_cell = ws.cell(row=row, column=2)
            if gw["version"].lower() == "ikev1":
                ver_cell.fill = _fill(C["medium_l"])
                ver_cell.font = _font(bold=True, color=C["medium"])
            row += 1
        if not p.ike_gateways:
            ws.cell(row=row, column=1).value = "(none found)"
            ws.cell(row=row, column=1).font = _font(italic=True, color=C["info"])
            row += 1
        row += 1

        # ── Management Settings ───────────────────────────────────────────────
        section("MANAGEMENT SETTINGS", ["Setting", "Value", "Status"])
        m = p.mgmt_settings
        if m:
            def mgmt_row(label: str, value: str, good: bool | None = None):
                nonlocal row
                bg = C["alt_row"] if row % 2 == 0 else None
                for col, v in enumerate([label, value], 1):
                    c = ws.cell(row=row, column=col, value=v)
                    c.font = _font(); c.alignment = _align(); c.border = THIN
                    if bg:
                        c.fill = _fill(bg)
                status_cell = ws.cell(row=row, column=3)
                status_cell.border = THIN; status_cell.alignment = _align("center")
                if good is True:
                    status_cell.value = "OK"
                    status_cell.font  = _font(bold=True, color=C["allow"])
                    status_cell.fill  = _fill(C["allow_l"])
                elif good is False:
                    status_cell.value = "ISSUE"
                    status_cell.font  = _font(bold=True, color=C["high"])
                    status_cell.fill  = _fill(C["high_l"])
                else:
                    status_cell.value = "INFO"
                    status_cell.font  = _font(color=C["info"])
                row += 1

            mgmt_row("Hostname",              m.get("hostname", "(not set)"), None)
            mgmt_row("HTTP Management",       "Enabled" if m.get("http_enabled") else "Disabled",
                                               not m.get("http_enabled"))
            mgmt_row("HTTPS Management",      "Enabled" if m.get("https_enabled") else "Disabled",
                                               m.get("https_enabled"))
            mgmt_row("Telnet Management",     "Enabled" if m.get("telnet_enabled") else "Disabled",
                                               not m.get("telnet_enabled"))
            mgmt_row("SSH Management",        "Enabled" if m.get("ssh_enabled") else "Disabled",
                                               m.get("ssh_enabled"))
            mgmt_row("SNMP Enabled",          "Yes" if m.get("snmp_enabled") else "No", None)
            mgmt_row("SNMP v1",               "Enabled" if m.get("snmp_v1") else "Disabled",
                                               not m.get("snmp_v1"))
            mgmt_row("SNMP v2c",              "Enabled" if m.get("snmp_v2c") else "Disabled",
                                               not m.get("snmp_v2c"))
            mgmt_row("SNMP v3",               "Enabled" if m.get("snmp_v3") else "Disabled",
                                               m.get("snmp_v3"))
            mgmt_row("SNMP Community String", m.get("snmp_community") or "(not set)", None)
            mgmt_row("Permitted Mgmt IPs",
                     ", ".join(m["permitted_ips"]) if m.get("permitted_ips") else "NONE (unrestricted)",
                     bool(m.get("permitted_ips")))
            mgmt_row("NTP Primary",           m.get("ntp_primary") or "(not configured)",
                                               bool(m.get("ntp_primary")))
            mgmt_row("NTP Secondary",         m.get("ntp_secondary") or "(not configured)", None)
            mgmt_row("DNS Primary",           m.get("dns_primary") or "(not configured)",
                                               bool(m.get("dns_primary")))
            mgmt_row("Login Banner",          "Set" if m.get("login_banner") else "Not configured",
                                               bool(m.get("login_banner")))
        else:
            ws.cell(row=row, column=1).value = "(deviceconfig/system not found in this export)"
            ws.cell(row=row, column=1).font  = _font(italic=True, color=C["info"])
            row += 1
        row += 1

        # ── Admin Accounts ────────────────────────────────────────────────────
        section("ADMINISTRATOR ACCOUNTS",
                ["Username", "Role", "Auth Profile (MFA)", "SSH Key", "Password"])
        for admin in p.admin_accounts:
            bg = C["alt_row"] if row % 2 == 0 else None
            vals = [admin["name"], admin["role"], admin["auth_profile"] or "(none)",
                    admin["public_key"], admin["password_hash"]]
            for col, v in enumerate(vals, 1):
                c = ws.cell(row=row, column=col, value=v)
                c.font = _font(); c.alignment = _align(); c.border = THIN
                if bg:
                    c.fill = _fill(bg)
            if not admin["auth_profile"]:
                ws.cell(row=row, column=3).fill = _fill(C["high_l"])
                ws.cell(row=row, column=3).font = _font(bold=True, color=C["high"])
            if admin["password_hash"] == "none" and admin["public_key"] == "no":
                ws.cell(row=row, column=5).fill = _fill(C["critical_l"])
                ws.cell(row=row, column=5).font = _font(bold=True, color=C["critical"])
            row += 1
        if not p.admin_accounts:
            ws.cell(row=row, column=1).value = "(none found)"
            ws.cell(row=row, column=1).font = _font(italic=True, color=C["info"])
            row += 1
        row += 1

        # ── Syslog Servers ────────────────────────────────────────────────────
        section("SYSLOG SERVERS", ["Profile", "Server Name", "Address", "Port", "Transport", "Format"])
        for srv in p.log_syslog_servers:
            bg = C["alt_row"] if row % 2 == 0 else None
            vals = [srv["profile"], srv["name"], srv["server"],
                    srv["port"], srv["transport"], srv["format"]]
            for col, v in enumerate(vals, 1):
                c = ws.cell(row=row, column=col, value=v)
                c.font = _font(); c.alignment = _align(); c.border = THIN
                if bg:
                    c.fill = _fill(bg)
            if srv["transport"].upper() == "UDP":
                ws.cell(row=row, column=5).fill = _fill(C["medium_l"])
                ws.cell(row=row, column=5).font = _font(bold=True, color=C["medium"])
            row += 1
        if not p.log_syslog_servers:
            ws.cell(row=row, column=1).value = "(no syslog servers configured)"
            ws.cell(row=row, column=1).fill  = _fill(C["high_l"])
            ws.cell(row=row, column=1).font  = _font(bold=True, color=C["high"])
            row += 1

        self._set_widths(ws, [30, 22, 30, 25, 20, 22, 18])

    # ── Save ──────────────────────────────────────────────────────────────────
    def save(self):
        self._sheet_summary()
        self._sheet_security_rules()
        self._sheet_nat_rules()
        self._sheet_address_objects()
        self._sheet_address_groups()
        self._sheet_service_objects()
        self._sheet_zones()
        self._sheet_crypto_system()
        self._sheet_issues()
        self.wb.save(self.out)


# ── CLI entry point ───────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(
        description="Palo Alto Firewall Config Analyzer — outputs Excel report",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python pa_analyzer.py running-config.xml
  python pa_analyzer.py running-config.xml -o audit-$(date +%%Y%%m%%d).xlsx
  python pa_analyzer.py panorama-export.xml -o panorama-audit.xlsx
""",
    )
    ap.add_argument("config", help="PAN-OS XML configuration file (exported from device or Panorama)")
    ap.add_argument("-o", "--output", default=None,
                    help="Output Excel file (default: <config-stem>_analysis.xlsx)")
    args = ap.parse_args()

    if not args.output:
        stem = os.path.splitext(os.path.basename(args.config))[0]
        args.output = f"{stem}_analysis.xlsx"

    print(f"[*] Parsing:  {args.config}")
    parser = PaloAltoParser(args.config)
    parser.parse()

    sev_counts: dict[str, int] = defaultdict(int)
    for iss in parser.issues:
        sev_counts[iss["severity"]] += 1

    print(f"[*] Parsed:")
    print(f"      Security rules : {len(parser.security_rules)}")
    print(f"      NAT rules      : {len(parser.nat_rules)}")
    print(f"      Address objects: {len(parser.address_objects)}")
    print(f"      Address groups : {len(parser.address_groups)}")
    print(f"      Service objects: {len(parser.service_objects)}")
    print(f"      Zones          : {len(parser.zones)}")
    print(f"[*] Security findings: {len(parser.issues)}")
    for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"):
        if sev_counts[sev]:
            print(f"      {sev:<10}: {sev_counts[sev]}")

    print(f"[*] Writing Excel report...")
    reporter = ExcelReporter(parser, args.output)
    reporter.save()
    print(f"[+] Saved: {args.output}")


if __name__ == "__main__":
    main()
