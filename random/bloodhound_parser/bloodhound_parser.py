#!/usr/bin/env python3
"""
BloodHound JSON Parser
Parses SharpHound/BloodHound .json output and produces a structured security findings report.
Usage: python bloodhound_parser.py <file_or_dir> [file_or_dir ...] [-o output.json]
"""

import json
import sys
import argparse
from pathlib import Path

# ── dangerous edges (from python_bloodhound_parser instructions) ──────────────

DANGEROUS_EDGES = {
    # ACL abuse (original)
    "GenericAll", "GenericWrite", "WriteDacl", "WriteOwner", "Owns", "AllExtendedRights",

    # Password / credential abuse
    "ForceChangePassword", "AddKeyCredentialLink", "WriteSPN",
    "ReadLAPSPassword",
    "SyncLAPSPassword",       # CE: sync LAPS password (newer endpoint)
    "ReadGMSAPassword",       # read Group Managed Service Account password
    "DumpSMSAPassword",       # dump Standalone Managed Service Account password

    # Group / membership abuse
    "AddMember",
    "AddSelf",                # CE: add yourself to a group

    # Account attribute abuse
    "WriteAccountRestrictions",   # modify userAccountControl / msDS-AllowedToActOnBehalfOfOtherIdentity
    "WriteGPLink",                # link arbitrary GPOs to an OU — GPO abuse path

    # Replication / DCSync
    "GetChanges", "GetChangesAll", "GetChangesInFilteredSet",
    "DCSync",                 # CE composite DCSync edge

    # Delegation
    "AllowedToDelegate", "AllowedToAct",

    # Session / Admin / lateral movement
    "AdminTo", "CanPSRemote", "CanRDP", "ExecuteDCOM", "CanSSH",
    "SQLAdmin",               # SQL Server sysadmin role
    "HasSession",

    # SID history / trust abuse
    "HasSIDHistory",          # SID history on account — may bypass SID filtering

    # GPO / structure
    "GpLink", "Contains",

    # AD CS (ADCS ESC paths — BloodHound CE)
    "Enroll", "ManageCA", "ManageCertificates",
    "EnrollOnBehalfOf",       # can enroll on behalf of another user (ESC3)
    "ADCSESC1",               # vulnerable cert template — SAN spoofing
    "ADCSESC3",               # ESC3: enroll-on-behalf-of chain
    "ADCSESC4",               # ESC4: write cert template attributes
    "ADCSESC6a", "ADCSESC6b", # ESC6: CA with EDITF_ATTRIBUTESUBJECTALTNAME2
    "ADCSESC7",               # ESC7: ManageCA + ManageCertificates
    "ADCSESC8",               # ESC8: NTLM relay to AD CS HTTP endpoint
    "ADCSESC9a", "ADCSESC9b", # ESC9: no-security-extension on template
    "ADCSESC10a","ADCSESC10b",# ESC10: weak certificate mapping

    # Computer / domain structure
    "MemberOfLocalGroup", "DCFor",
}

SEVERITY_MAP = {
    # Critical
    "DCFor":                   "Critical",
    "GetChangesAll":           "Critical",
    "DCSync":                  "Critical",
    "ADCSESC1":                "Critical",
    "ADCSESC8":                "Critical",
    # High
    "GenericAll":              "High",
    "GenericWrite":            "High",
    "WriteDacl":               "High",
    "WriteOwner":              "High",
    "Owns":                    "High",
    "AllExtendedRights":       "High",
    "ForceChangePassword":     "High",
    "AdminTo":                 "High",
    "ManageCA":                "High",
    "ReadGMSAPassword":        "High",
    "DumpSMSAPassword":        "High",
    "SyncLAPSPassword":        "High",
    "WriteGPLink":             "High",
    "HasSIDHistory":           "High",
    "ADCSESC3":                "High",
    "ADCSESC4":                "High",
    "ADCSESC6a":               "High",
    "ADCSESC6b":               "High",
    "ADCSESC7":                "High",
    "ADCSESC9a":               "High",
    "ADCSESC9b":               "High",
    "ADCSESC10a":              "High",
    "ADCSESC10b":              "High",
    "EnrollOnBehalfOf":        "High",
    # Medium
    "AddMember":               "Medium",
    "ReadLAPSPassword":        "Medium",
    "AddKeyCredentialLink":    "Medium",
    "WriteSPN":                "Medium",
    "WriteAccountRestrictions":"Medium",
    "AddSelf":                 "Medium",
    "CanPSRemote":             "Medium",
    "CanRDP":                  "Medium",
    "ExecuteDCOM":             "Medium",
    "AllowedToDelegate":       "Medium",
    "AllowedToAct":            "Medium",
    "ManageCertificates":      "Medium",
    "CanSSH":                  "Medium",
    "SQLAdmin":                "Medium",
    # Low
    "HasSession":              "Low",
    "MemberOfLocalGroup":      "Low",
    "GetChanges":              "Low",
    "GetChangesInFilteredSet": "Low",
    "Enroll":                  "Low",
    # Informational
    "GpLink":                  "Informational",
    "Contains":                "Informational",
}

ISSUE_DESCRIPTIONS = {
    # ACL abuse
    "GenericAll":              "Full control over target; can reset passwords, modify group membership, or write any attribute",
    "GenericWrite":            "Write access to non-protected attributes; can set scripts, delegates, or member lists",
    "WriteDacl":               "Can modify the target's DACL, escalating to GenericAll",
    "WriteOwner":              "Can change target ownership, then modify DACL for full control",
    "Owns":                    "Object owner; can modify DACL without needing WriteDacl",
    "AllExtendedRights":       "All extended rights including force-change-password and replication",
    # Credential abuse
    "ForceChangePassword":     "Can reset the target user's password without knowing the current one",
    "AddKeyCredentialLink":    "Can add a shadow credential enabling authentication as the target (ADCS-style)",
    "WriteSPN":                "Can set SPNs on target, enabling Kerberoasting",
    "ReadLAPSPassword":        "Can read the LAPS-managed local administrator password",
    "SyncLAPSPassword":        "Can sync the LAPS password via newer API (equivalent to ReadLAPSPassword)",
    "ReadGMSAPassword":        "Can read the Group Managed Service Account password; enables authentication as the GMSA",
    "DumpSMSAPassword":        "Can dump the Standalone Managed Service Account password from LSA secrets",
    # Group / membership
    "AddMember":               "Can add arbitrary principals to the target group",
    "AddSelf":                 "Can add themselves to the target group without requiring AddMember right",
    # Account attribute abuse
    "WriteAccountRestrictions":"Can modify userAccountControl or msDS-AllowedToActOnBehalfOfOtherIdentity, enabling delegation or disabling Kerberos preauth",
    "WriteGPLink":             "Can link arbitrary GPOs to the target OU; enables code execution on all objects in scope via malicious GPO",
    # Replication / DCSync
    "GetChanges":              "DRS GetChanges right; combined with GetChangesAll enables DCSync",
    "GetChangesAll":           "DCSync-capable: can replicate all domain secrets (NTLM hashes, Kerberos keys)",
    "GetChangesInFilteredSet": "Can replicate filtered attribute set; may expose sensitive attributes",
    "DCSync":                  "Can perform a full DCSync attack, extracting NTLM hashes and Kerberos keys for every account in the domain",
    # Delegation
    "AllowedToDelegate":       "Constrained/unconstrained delegation; can impersonate users to target services",
    "AllowedToAct":            "Resource-Based Constrained Delegation; any service account can impersonate users to this computer",
    # Lateral movement / admin
    "AdminTo":                 "Local administrator on target computer",
    "CanPSRemote":             "Can connect via WinRM/PowerShell Remoting",
    "CanRDP":                  "Can connect via Remote Desktop Protocol",
    "ExecuteDCOM":             "Can execute DCOM objects; potential code execution path",
    "CanSSH":                  "Can connect via SSH",
    "SQLAdmin":                "Has sysadmin rights on the target SQL Server instance; enables OS command execution via xp_cmdshell",
    # SID history
    "HasSIDHistory":           "Account carries SID history from a trusted domain; may bypass SID filtering and gain privileges in that domain",
    # GPO / structure
    "GpLink":                  "GPO is linked to target container; GPO abuse affects all objects in scope",
    "Contains":                "Container relationship; OU/domain contains the source object",
    # AD CS
    "Enroll":                  "Can enroll in the target certificate template",
    "ManageCA":                "Can manage the Certificate Authority; enables issuing arbitrary certs (ESC7)",
    "ManageCertificates":      "Can manage CA certificates; enables ESC7 attacks",
    "EnrollOnBehalfOf":        "Can enroll a certificate on behalf of another user (ESC3); enables impersonation via certificate",
    "ADCSESC1":                "ESC1: certificate template allows SAN specification and is enrollable; attacker can request cert for any user including DA",
    "ADCSESC3":                "ESC3: enroll-on-behalf-of chain through application policy; enables obtaining certs for arbitrary users",
    "ADCSESC4":                "ESC4: write permissions on a certificate template; can weaken template to enable ESC1",
    "ADCSESC6a":               "ESC6a: CA has EDITF_ATTRIBUTESUBJECTALTNAME2 flag set; any enrollable template can be used to request certs with arbitrary SANs",
    "ADCSESC6b":               "ESC6b: variant of ESC6 affecting specific template configurations",
    "ADCSESC7":                "ESC7: principal has ManageCA + ManageCertificates; can issue certs for any user",
    "ADCSESC8":                "ESC8: AD CS HTTP endpoint is vulnerable to NTLM relay; enables obtaining machine/DC certs",
    "ADCSESC9a":               "ESC9a: template has no-security-extension flag; certificate mapping relies only on UPN which can be spoofed",
    "ADCSESC9b":               "ESC9b: variant affecting computer accounts in ESC9 scenario",
    "ADCSESC10a":              "ESC10a: weak certificate mapping on domain controller allows certificate reuse attacks",
    "ADCSESC10b":              "ESC10b: variant of ESC10 affecting specific account types",
    # Computer / domain
    "MemberOfLocalGroup":      "Member of a local group on the target computer",
    "HasSession":              "Has an active or recent session on the target; credential exposure risk",
    "DCFor":                   "Is a Domain Controller for the target domain",
}

# Relationship list fields present on computer objects (SharpHound format)
COMPUTER_RELATIONSHIP_FIELDS = [
    ("LocalAdmins",        "AdminTo"),
    ("RemoteDesktopUsers", "CanRDP"),
    ("PSRemoteUsers",      "CanPSRemote"),
    ("DcomUsers",          "ExecuteDCOM"),
    ("Sessions",           "HasSession"),
]

SEVERITY_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Informational": 4}


# ── helpers ───────────────────────────────────────────────────────────────────

def _props(obj):
    return obj.get("Properties", {})

def _name(obj):
    p = _props(obj)
    return p.get("name") or p.get("Name") or obj.get("Name") or "Unknown"

def _sid(obj):
    p = _props(obj)
    return (p.get("objectid") or p.get("ObjectIdentifier")
            or obj.get("ObjectIdentifier") or "")

def _resolve(sid, sid_map):
    return sid_map.get(sid, sid) if sid else "Unknown"

def _members(field_value):
    """Normalize BloodHound relationship field to a flat list."""
    if isinstance(field_value, list):
        return field_value
    if isinstance(field_value, dict):
        return field_value.get("Results", field_value.get("Members", []))
    return []

def _flat(edge, principal, principal_type, target, target_type, inherited=False, extra=None):
    """Internal flat finding — one record per edge instance. Grouped into output by group_findings()."""
    return {
        "principal":      principal,
        "principal_type": principal_type,
        "_edge":          edge,
        "target":         target,
        "target_type":    target_type,
        "inherited":      inherited,
        "severity":       SEVERITY_MAP.get(edge, "Informational"),
        "details":        ISSUE_DESCRIPTIONS.get(edge, edge),
        "_extra":         extra or {},
    }


# ── parsers ───────────────────────────────────────────────────────────────────

def parse_aces(obj, obj_name, obj_type, sid_map):
    findings = []
    for ace in obj.get("Aces", []):
        edge = ace.get("RightName", "")
        if edge not in DANGEROUS_EDGES:
            continue
        p_sid  = ace.get("PrincipalSID", "")
        p_type = ace.get("PrincipalType", "Unknown")
        p_name = _resolve(p_sid, sid_map)
        findings.append(_flat(
            edge, p_name, p_type, obj_name, obj_type,
            inherited=ace.get("IsInherited", False),
        ))
    return findings


def parse_delegation(obj, obj_name, obj_type, sid_map):
    """AllowedToDelegate / AllowedToAct: principal = the delegating computer, target = where it delegates."""
    findings = []
    for field, edge in [("AllowedToDelegate", "AllowedToDelegate"),
                        ("AllowedToAct",      "AllowedToAct")]:
        for t in _members(obj.get(field, [])):
            t_sid  = t.get("ObjectIdentifier", "")
            t_type = t.get("ObjectType", "Unknown")
            t_name = _resolve(t_sid, sid_map)
            findings.append(_flat(edge, obj_name, obj_type, t_name, t_type))
    return findings


def parse_relationship_list(obj, obj_name, obj_type, field, edge, sid_map):
    """Computer relationship lists: principal = the member, target = the computer."""
    findings = []
    if edge not in DANGEROUS_EDGES:
        return findings
    for member in _members(obj.get(field, [])):
        m_sid  = (member.get("ObjectIdentifier") or member.get("MemberId")
                  or member.get("UserSID") or "")
        m_type = (member.get("ObjectType") or member.get("MemberType") or "Unknown")
        m_name = _resolve(m_sid, sid_map)
        findings.append(_flat(edge, m_name, m_type, obj_name, obj_type))
    return findings


def detect_dcsync(flat_findings):
    """Inject a synthetic DCSync flat-finding when a principal has GetChanges+GetChangesAll
    on the same domain (or the CE composite DCSync edge is present)."""
    domain_rights = {}
    for f in flat_findings:
        edge = f["_edge"]
        if edge in ("GetChanges", "GetChangesAll", "GetChangesInFilteredSet", "DCSync"):
            key = (f["principal"], f["principal_type"], f["target"])
            domain_rights.setdefault(key, set()).add(edge)

    extra = []
    for (principal, p_type, domain), rights in domain_rights.items():
        if "DCSync" in rights or ("GetChanges" in rights and "GetChangesAll" in rights):
            extra.append({
                "principal":      principal,
                "principal_type": p_type,
                "_edge":          "DCSync",
                "target":         domain,
                "target_type":    "Domain",
                "inherited":      False,
                "severity":       "Critical",
                "details":        (
                    "Principal holds both GetChanges and GetChangesAll on the domain, "
                    "enabling full DCSync — extraction of NTLM hashes and Kerberos keys for all accounts"
                ),
                "_extra":         {"rights": sorted(rights)},
            })
    return extra


def group_findings(flat_findings):
    """Convert flat per-edge findings into grouped output:
       target  = the node that HOLDS the permission (the dangerous account)
       evidence = list of nodes it has that permission over.
    """
    groups = {}
    for f in flat_findings:
        principal = f["principal"]
        p_type    = f["principal_type"]
        edge      = f["_edge"]
        key       = (principal, p_type, edge)

        if key not in groups:
            groups[key] = {
                "issue":       f"{edge}: {p_type} '{principal}'",
                "severity":    f["severity"],
                "target":      principal,
                "target_type": p_type,
                "edge":        edge,
                "details":     f["details"],
                "evidence":    [],
            }

        ev_entry = {
            "node":      f["target"],
            "node_type": f["target_type"],
        }
        if f.get("inherited") is not None:
            ev_entry["inherited"] = f["inherited"]
        if f.get("_extra"):
            ev_entry.update(f["_extra"])

        # Avoid duplicate evidence entries
        if ev_entry not in groups[key]["evidence"]:
            groups[key]["evidence"].append(ev_entry)

    findings = list(groups.values())
    findings.sort(key=lambda f: (SEVERITY_ORDER.get(f["severity"], 5), f["target"]))
    return findings


# ── file loading ──────────────────────────────────────────────────────────────

def load_files(input_paths):
    """Return list of (filepath, parsed_json) tuples."""
    files = []
    for p in input_paths:
        p = Path(p)
        if p.is_dir():
            files.extend(sorted(p.glob("*.json")))
        else:
            files.append(p)

    loaded = []
    for fp in files:
        try:
            with open(fp, "r", encoding="utf-8-sig") as fh:
                loaded.append((fp, json.load(fh)))
        except Exception as e:
            print(f"[warn] Skipping {fp}: {e}", file=sys.stderr)
    return loaded


def build_sid_map(all_objects):
    sid_map = {}
    for obj_type, objects in all_objects.items():
        for obj in objects:
            sid  = _sid(obj)
            name = _name(obj)
            if sid and name and name != "Unknown":
                sid_map[sid] = name
    return sid_map


# ── main parse ────────────────────────────────────────────────────────────────

def parse_bloodhound(input_paths):
    loaded = load_files(input_paths)
    if not loaded:
        print("[error] No files loaded.", file=sys.stderr)
        sys.exit(1)

    # Group objects by type
    all_objects = {}
    for fp, data in loaded:
        meta     = data.get("meta", {})
        obj_type = meta.get("type", fp.stem.lower())
        objects  = data.get("data", [])
        # Tag each object with its singular type label
        label = obj_type.rstrip("s").capitalize()
        for obj in objects:
            obj["_type_label"] = label
        all_objects.setdefault(obj_type, []).extend(objects)

    sid_map   = build_sid_map(all_objects)
    flat      = []

    for obj_type, objects in all_objects.items():
        for obj in objects:
            obj_name  = _name(obj)
            obj_label = obj.get("_type_label", obj_type.rstrip("s").capitalize())

            flat.extend(parse_aces(obj, obj_name, obj_label, sid_map))
            flat.extend(parse_delegation(obj, obj_name, obj_label, sid_map))

            if obj_type == "computers":
                for field, edge in COMPUTER_RELATIONSHIP_FIELDS:
                    flat.extend(
                        parse_relationship_list(obj, obj_name, obj_label, field, edge, sid_map)
                    )

    # Inject DCSync synthetic findings, then group everything
    flat     = detect_dcsync(flat) + flat
    findings = group_findings(flat)

    summary = {
        "total":         len(findings),
        "critical":      sum(1 for f in findings if f["severity"] == "Critical"),
        "high":          sum(1 for f in findings if f["severity"] == "High"),
        "medium":        sum(1 for f in findings if f["severity"] == "Medium"),
        "low":           sum(1 for f in findings if f["severity"] == "Low"),
        "informational": sum(1 for f in findings if f["severity"] == "Informational"),
    }

    return {"summary": summary, "findings": findings}


# ── entry point ───────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="Parse BloodHound JSON files into a structured security findings report"
    )
    ap.add_argument("inputs", nargs="+", metavar="FILE_OR_DIR",
                    help="BloodHound .json file(s) or directory containing them")
    ap.add_argument("-o", "--output", metavar="OUTPUT.json",
                    help="Write findings to this file (default: stdout)")
    ap.add_argument("--severity", metavar="LEVEL",
                    choices=["Critical", "High", "Medium", "Low", "Informational"],
                    help="Filter output to this severity and above")
    args = ap.parse_args()

    result = parse_bloodhound(args.inputs)

    if args.severity:
        cutoff = SEVERITY_ORDER[args.severity]
        result["findings"] = [
            f for f in result["findings"]
            if SEVERITY_ORDER.get(f["severity"], 5) <= cutoff
        ]
        # Recalculate summary
        findings = result["findings"]
        result["summary"] = {
            "total":         len(findings),
            "critical":      sum(1 for f in findings if f["severity"] == "Critical"),
            "high":          sum(1 for f in findings if f["severity"] == "High"),
            "medium":        sum(1 for f in findings if f["severity"] == "Medium"),
            "low":           sum(1 for f in findings if f["severity"] == "Low"),
            "informational": sum(1 for f in findings if f["severity"] == "Informational"),
        }

    out = json.dumps(result, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as fh:
            fh.write(out)
        s = result["summary"]
        print(
            f"Wrote {s['total']} findings to {args.output} "
            f"(Critical:{s['critical']} High:{s['high']} Medium:{s['medium']} "
            f"Low:{s['low']} Info:{s['informational']})",
            file=sys.stderr,
        )
    else:
        print(out)


if __name__ == "__main__":
    main()
