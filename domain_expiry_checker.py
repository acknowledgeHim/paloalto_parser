#!/usr/bin/env python3
"""
Domain Expiry Checker with VirusTotal Reputation Lookup

Usage:
    python domain_expiry_checker.py -d domains.txt -k YOUR_VT_API_KEY
    python domain_expiry_checker.py -d domains.txt -k YOUR_VT_API_KEY --days 180 --output report.json
    echo "example.com" | python domain_expiry_checker.py -k YOUR_VT_API_KEY

Requires:
    pip install python-whois requests
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from typing import Optional

try:
    import whois
except ImportError:
    print("Missing dependency: pip install python-whois", file=sys.stderr)
    sys.exit(1)

try:
    import requests
except ImportError:
    print("Missing dependency: pip install requests", file=sys.stderr)
    sys.exit(1)


VT_API_BASE = "https://www.virustotal.com/api/v3"
# Pause between requests to stay under VirusTotal free-tier rate limit (4 req/min)
VT_REQUEST_DELAY = 16


def get_expiry_info(domain: str) -> dict:
    """Return expiry status for a domain via WHOIS."""
    result = {
        "domain": domain,
        "expiry_date": None,
        "expired": False,
        "days_since_expiry": None,
        "whois_error": None,
    }
    try:
        w = whois.whois(domain)
        exp = w.expiration_date
        if exp is None:
            result["whois_error"] = "No expiration date found"
            return result

        # python-whois can return a list (multiple registrars)
        if isinstance(exp, list):
            exp = exp[0]

        # Normalize to UTC-aware datetime
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        result["expiry_date"] = exp.isoformat()

        if exp < now:
            result["expired"] = True
            result["days_since_expiry"] = (now - exp).days

    except Exception as exc:
        result["whois_error"] = str(exc)

    return result


def query_virustotal(domain: str, api_key: str) -> dict:
    """Query VirusTotal domain report endpoint."""
    headers = {"x-apikey": api_key}
    url = f"{VT_API_BASE}/domains/{domain}"

    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code == 404:
            return {"vt_error": "Domain not found in VirusTotal"}
        if resp.status_code == 401:
            return {"vt_error": "Invalid VirusTotal API key"}
        if resp.status_code == 429:
            return {"vt_error": "VirusTotal rate limit exceeded — slow down requests"}
        resp.raise_for_status()
        data = resp.json().get("data", {}).get("attributes", {})

        stats = data.get("last_analysis_stats", {})
        total_engines = sum(stats.values()) if stats else 0
        malicious = stats.get("malicious", 0)
        suspicious = stats.get("suspicious", 0)

        # Build a flat summary of per-engine verdicts (non-clean only)
        flagged_engines = {}
        for engine, result in data.get("last_analysis_results", {}).items():
            if result.get("category") not in ("harmless", "undetected", "clean"):
                flagged_engines[engine] = {
                    "category": result.get("category"),
                    "result": result.get("result"),
                }

        return {
            "reputation": data.get("reputation"),
            "categories": data.get("categories", {}),
            "tags": data.get("tags", []),
            "last_analysis_date": (
                datetime.fromtimestamp(
                    data["last_analysis_date"], tz=timezone.utc
                ).isoformat()
                if data.get("last_analysis_date")
                else None
            ),
            "analysis_stats": stats,
            "total_engines": total_engines,
            "malicious_count": malicious,
            "suspicious_count": suspicious,
            "flagged_engines": flagged_engines,
            "creation_date": data.get("creation_date"),
            "whois": data.get("whois", "")[:500] if data.get("whois") else None,
            "registrar": data.get("registrar"),
            "country": data.get("country"),
            "popularity_ranks": data.get("popularity_ranks", {}),
        }

    except requests.RequestException as exc:
        return {"vt_error": str(exc)}


def risk_label(vt: dict) -> str:
    """Derive a simple risk label from VirusTotal results."""
    if "vt_error" in vt:
        return "UNKNOWN"
    malicious = vt.get("malicious_count", 0)
    suspicious = vt.get("suspicious_count", 0)
    reputation = vt.get("reputation", 0) or 0
    if malicious >= 3 or reputation < -10:
        return "HIGH RISK"
    if malicious >= 1 or suspicious >= 2 or reputation < 0:
        return "SUSPICIOUS"
    return "CLEAN"


def print_report(results: list[dict], verbose: bool = False) -> None:
    """Print a human-readable report to stdout."""
    sep = "=" * 70
    print(f"\n{sep}")
    print(f"  DOMAIN EXPIRY & REPUTATION REPORT  —  {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}")
    print(sep)

    expired_count = sum(1 for r in results if r.get("expired"))
    checked_vt = sum(1 for r in results if r.get("virustotal"))
    print(f"  Domains checked : {len(results)}")
    print(f"  Expired         : {expired_count}")
    print(f"  VirusTotal hits : {checked_vt}")
    print(sep)

    for r in results:
        domain = r["domain"]
        print(f"\n  Domain  : {domain}")

        if r.get("whois_error"):
            print(f"  WHOIS   : ERROR — {r['whois_error']}")
        elif r.get("expired"):
            print(f"  Status  : EXPIRED  ({r['days_since_expiry']} days ago — {r['expiry_date']})")
        else:
            print(f"  Status  : Active  (expires {r['expiry_date']})")

        vt = r.get("virustotal")
        if vt:
            if "vt_error" in vt:
                print(f"  VT      : ERROR — {vt['vt_error']}")
            else:
                label = risk_label(vt)
                print(f"  Risk    : {label}")
                print(f"  Reputation score : {vt['reputation']}")
                stats = vt.get("analysis_stats", {})
                print(
                    f"  Engines : {vt['total_engines']} total | "
                    f"{vt['malicious_count']} malicious | "
                    f"{vt['suspicious_count']} suspicious | "
                    f"{stats.get('harmless', 0)} harmless"
                )
                if vt.get("categories"):
                    cats = ", ".join(f"{k}: {v}" for k, v in vt["categories"].items())
                    print(f"  Categories : {cats}")
                if vt.get("tags"):
                    print(f"  Tags       : {', '.join(vt['tags'])}")
                if vt.get("registrar"):
                    print(f"  Registrar  : {vt['registrar']}")
                if vt.get("last_analysis_date"):
                    print(f"  Last scan  : {vt['last_analysis_date']}")
                if verbose and vt.get("flagged_engines"):
                    print("  Flagged engines:")
                    for eng, det in vt["flagged_engines"].items():
                        print(f"    [{det['category']}] {eng}: {det['result']}")

        print(f"  {'-' * 66}")


def load_domains(args) -> list[str]:
    """Load domains from file, CLI args, or stdin."""
    domains: list[str] = []
    if args.domains:
        for entry in args.domains:
            domains.append(entry.strip().lower())
    if args.file:
        with open(args.file) as fh:
            for line in fh:
                line = line.strip().lower()
                if line and not line.startswith("#"):
                    domains.append(line)
    if not domains and not sys.stdin.isatty():
        for line in sys.stdin:
            line = line.strip().lower()
            if line and not line.startswith("#"):
                domains.append(line)
    return list(dict.fromkeys(domains))  # deduplicate, preserve order


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Check domain expiry and query VirusTotal for recently expired domains."
    )
    parser.add_argument(
        "-d", "--domain", dest="domains", metavar="DOMAIN", nargs="+",
        help="One or more domains to check",
    )
    parser.add_argument(
        "-f", "--file", metavar="FILE",
        help="File containing one domain per line",
    )
    parser.add_argument(
        "-k", "--api-key", metavar="KEY",
        help="VirusTotal API key (or set VT_API_KEY env var)",
    )
    parser.add_argument(
        "--days", type=int, default=90,
        help="Query VirusTotal for domains expired within this many days (default: 90). "
             "Use 0 to check ALL expired domains.",
    )
    parser.add_argument(
        "--check-all", action="store_true",
        help="Query VirusTotal for every domain, not just recently expired ones",
    )
    parser.add_argument(
        "--output", metavar="FILE",
        help="Save full JSON results to this file",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true",
        help="Show per-engine flagging details",
    )
    args = parser.parse_args()

    # Resolve API key
    import os
    api_key: Optional[str] = args.api_key or os.environ.get("VT_API_KEY")

    domains = load_domains(args)
    if not domains:
        parser.error("No domains provided. Use -d, -f, or pipe a list via stdin.")

    if not api_key:
        print(
            "Warning: No VirusTotal API key provided (-k / VT_API_KEY). "
            "WHOIS checks only.\n",
            file=sys.stderr,
        )

    results: list[dict] = []

    for i, domain in enumerate(domains, 1):
        print(f"[{i}/{len(domains)}] Checking {domain} ...", file=sys.stderr)
        info = get_expiry_info(domain)

        should_query_vt = False
        if api_key:
            if args.check_all:
                should_query_vt = True
            elif info.get("expired"):
                days = info.get("days_since_expiry") or 0
                if args.days == 0 or days <= args.days:
                    should_query_vt = True

        if should_query_vt:
            print(f"         → Querying VirusTotal ...", file=sys.stderr)
            info["virustotal"] = query_virustotal(domain, api_key)
            info["risk"] = risk_label(info["virustotal"])
            # Respect free-tier rate limit (4 req/min) unless last domain
            if i < len(domains):
                time.sleep(VT_REQUEST_DELAY)
        else:
            info["virustotal"] = None
            info["risk"] = None

        results.append(info)

    print_report(results, verbose=args.verbose)

    if args.output:
        with open(args.output, "w") as fh:
            json.dump(results, fh, indent=2, default=str)
        print(f"\nFull JSON saved to: {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
