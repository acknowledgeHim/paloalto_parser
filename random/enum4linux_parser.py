#!/usr/bin/env python3
"""
enum4linux / enum4linux-ng User & Computer Parser

Pulls every account out of enum4linux or enum4linux-ng output and splits it
into two .txt files, one per line each:
  - regular user accounts   -> <input>_users.txt
  - machine/computer accounts (trailing '$') -> <input>_computers.txt

Handles all the common places enum4linux prints accounts:
  - SID/RID cycling lines:
        S-1-5-21-...-500 SAMBA\\Administrator (Local User)
        500: TARGET\\Administrator (SidTypeUser)          [enum4linux-ng]
  - rpcclient querydispinfo dump:
        index: 0x1 RID: 0x1f4 acb: ... Account: bob    Name: ...    Desc: ...
  - rpcclient enumdomusers dump:
        user:[bob] rid:[0x3e8]
  - enum4linux-ng JSON output (-oJ), any depth, any key layout.

Group/alias/well-known-group entries are ignored. Accounts whose name ends
in '$' are treated as machine/computer accounts and routed to the computers
file (with the trailing '$' stripped, since that's the actual hostname);
everything else goes to the users file.

Usage:
    python enum4linux_parser.py enum4linux_output.txt
        -> enum4linux_output_users.txt, enum4linux_output_computers.txt
    python enum4linux_parser.py scan.json --with-domain
    cat scan.txt | python enum4linux_parser.py - -o loot_users.txt -c loot_computers.txt
"""

import re
import os
import sys
import json
import argparse

# ── regexes for classic enum4linux / rpcclient text output ────────────────────

# S-1-5-21-...-500 SAMBA\Administrator (Local User)
_RE_SID_LINE = re.compile(
    r'S-1-5-\S+\s+(?P<domain>[^\\\s]+)\\(?P<user>\S+?)\s*\((?P<type>[^)]+)\)'
)

# 500: TARGET\Administrator (SidTypeUser)   [enum4linux-ng RID cycling]
_RE_NG_RID_LINE = re.compile(
    r'^\s*\d+:\s+(?P<domain>[^\\\s]+)\\(?P<user>\S+?)\s*\((?P<type>Sid\w+)\)'
)

# index: 0x1 RID: 0x1f4 acb: 0x00000010 Account: bob    Name: ...    Desc: ...
_RE_ACCOUNT_LINE = re.compile(r'Account:\s*(?P<user>\S+)')

# user:[bob] rid:[0x3e8]
_RE_USER_RID_LINE = re.compile(r'user:\[(?P<user>[^\]]+)\]\s*rid:\[')

# Types that indicate a *user* record (as opposed to a group/alias)
_USER_TYPE_RE = re.compile(r'user', re.I)
_GROUP_TYPE_RE = re.compile(r'group|alias|domain\b(?!\s*user)', re.I)


def _is_user_type(type_str):
    """True if the (Local User)/(SidTypeUser)/etc. tag denotes a user, not a group.
    Note: machine accounts also carry a 'user' type tag — they're split out later
    by their trailing '$', same as real Windows/Samba convention."""
    if _GROUP_TYPE_RE.search(type_str) and not _USER_TYPE_RE.search(type_str):
        return False
    return bool(_USER_TYPE_RE.search(type_str))


def parse_text(text):
    """Return list of (domain_or_None, username) tuples found in raw enum4linux text output."""
    found = []
    for line in text.splitlines():
        m = _RE_SID_LINE.search(line)
        if m and _is_user_type(m.group('type')):
            found.append((m.group('domain'), m.group('user')))
            continue

        m = _RE_NG_RID_LINE.search(line)
        if m and _is_user_type(m.group('type')):
            found.append((m.group('domain'), m.group('user')))
            continue

        m = _RE_USER_RID_LINE.search(line)
        if m:
            found.append((None, m.group('user')))
            continue

        m = _RE_ACCOUNT_LINE.search(line)
        if m:
            found.append((None, m.group('user')))
            continue

    return found


# ── JSON (enum4linux-ng -oJ) ────────────────────────────────────────────────

def _walk_json(node, found):
    """Recursively hunt for user records anywhere in an enum4linux-ng JSON tree.
    A user record is any dict with a 'username' key whose type (if present)
    doesn't mark it as a group/alias."""
    if isinstance(node, dict):
        if 'username' in node and isinstance(node['username'], str):
            type_str = str(node.get('type', 'user'))
            if _is_user_type(type_str) or 'type' not in node:
                found.append((node.get('domain'), node['username']))
        for v in node.values():
            _walk_json(v, found)
    elif isinstance(node, list):
        for item in node:
            _walk_json(item, found)


def parse_json(data):
    found = []
    _walk_json(data, found)
    return found


# ── main ─────────────────────────────────────────────────────────────────────

def parse_enum4linux(raw_text):
    """Try JSON first (enum4linux-ng -oJ), fall back to text-line parsing."""
    stripped = raw_text.strip()
    if stripped.startswith('{') or stripped.startswith('['):
        try:
            return parse_json(json.loads(raw_text))
        except json.JSONDecodeError:
            pass
    return parse_text(raw_text)


def _dedup_sort(names, no_sort):
    seen = set()
    out = []
    for n in names:
        if n not in seen:
            seen.add(n)
            out.append(n)
    if not no_sort:
        out.sort(key=str.lower)
    return out


def _write(names, path):
    with open(path, "w", encoding="utf-8") as fh:
        for n in names:
            fh.write(n + "\n")


def main():
    ap = argparse.ArgumentParser(
        description="Parse enum4linux / enum4linux-ng output and split accounts into users/computers txt files"
    )
    ap.add_argument("input", metavar="FILE",
                     help="enum4linux output file (text or -oJ JSON); use '-' for stdin")
    ap.add_argument("-o", "--users-output", metavar="USERS.txt",
                     help="Users output file (default: <input>_users.txt)")
    ap.add_argument("-c", "--computers-output", metavar="COMPUTERS.txt",
                     help="Computers output file (default: <input>_computers.txt)")
    ap.add_argument("--with-domain", action="store_true",
                     help="Prefix each name with DOMAIN\\ when a domain was captured")
    ap.add_argument("--keep-dollar-sign", action="store_true",
                     help="Keep the trailing '$' on computer account names instead of stripping it")
    ap.add_argument("--no-computers", action="store_true",
                     help="Don't split out machine accounts — write everything to the users file")
    ap.add_argument("--no-sort", action="store_true",
                     help="Preserve discovery order instead of sorting alphabetically")
    args = ap.parse_args()

    if args.input == "-":
        raw_text = sys.stdin.read()
        stem = "enum4linux"
    else:
        with open(args.input, "r", encoding="utf-8", errors="replace") as fh:
            raw_text = fh.read()
        stem = os.path.splitext(args.input)[0]

    users_output = args.users_output or f"{stem}_users.txt"
    computers_output = args.computers_output or f"{stem}_computers.txt"

    records = parse_enum4linux(raw_text)

    if not records:
        print("[warn] No accounts found in input.", file=sys.stderr)

    user_names = []
    computer_names = []
    for domain, user in records:
        user = user.strip()
        if not user:
            continue

        is_machine = user.endswith('$') and not args.no_computers
        if is_machine and not args.keep_dollar_sign:
            user = user[:-1]

        name = f"{domain}\\{user}" if (args.with_domain and domain) else user
        (computer_names if is_machine else user_names).append(name)

    user_names = _dedup_sort(user_names, args.no_sort)
    computer_names = _dedup_sort(computer_names, args.no_sort)

    _write(user_names, users_output)
    print(f"Wrote {len(user_names)} unique user(s) to {users_output}", file=sys.stderr)

    if not args.no_computers:
        _write(computer_names, computers_output)
        print(f"Wrote {len(computer_names)} unique computer(s) to {computers_output}", file=sys.stderr)


if __name__ == "__main__":
    main()
