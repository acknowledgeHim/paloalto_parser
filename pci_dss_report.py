import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.gridspec as gridspec
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyBboxPatch
import numpy as np
from datetime import datetime

OUTPUT_FILE = "/home/portal/gitprojects/sample-graphs/PCI_DSS_Vulnerability_Mapping.pdf"

# ── Colour palette ──────────────────────────────────────────────────────────
BRAND_BLUE   = "#1B3A6B"
BRAND_TEAL   = "#0D7B8A"
ACCENT_GOLD  = "#C8960C"
LIGHT_GREY   = "#F4F6F9"
MID_GREY     = "#BDC3CC"
TEXT_DARK    = "#1C1C2E"
RED_HIGH     = "#C0392B"
ORANGE_MED   = "#E67E22"
GREEN_LOW    = "#27AE60"
YELLOW_INFO  = "#F1C40F"

plt.rcParams.update({
    "font.family":      "DejaVu Sans",
    "axes.titlesize":   13,
    "axes.labelsize":   10,
    "xtick.labelsize":  8,
    "ytick.labelsize":  8,
    "legend.fontsize":  8,
    "figure.facecolor": "white",
})

# ── Data definitions ─────────────────────────────────────────────────────────

VULN_DATA = [
    # (Vulnerability, Short label, PCI Reqs, Risk, CVSS, Ease-of-fix, Frequency%)
    ("Weak / Reused Passwords",        "Weak Passwords",    "Req 8",          "Critical", 9.1, 2, 78),
    ("Default Credentials",            "Default Creds",     "Req 2,Req 8",    "Critical", 9.3, 2, 65),
    ("Missing MFA",                    "Missing MFA",       "Req 8",          "High",     8.2, 2, 58),
    ("Unpatched OS / Software",        "Unpatched SW",      "Req 6",          "Critical", 9.5, 3, 72),
    ("Missing Security Patches",       "Missing Patches",   "Req 6,Req 11",   "High",     8.7, 3, 69),
    ("Weak Cipher Suites (TLS)",       "Weak TLS",          "Req 4",          "High",     7.4, 2, 54),
    ("Outdated TLS (1.0/1.1)",         "Old TLS",           "Req 4",          "High",     7.8, 2, 47),
    ("Unencrypted Data at Rest",       "Plaintext Storage", "Req 3",          "Critical", 9.0, 3, 41),
    ("Unencrypted Data in Transit",    "Plaintext Transit", "Req 4",          "Critical", 9.2, 2, 38),
    ("Excessive Privileges",           "Excess Privs",      "Req 7",          "High",     7.9, 3, 63),
    ("Missing Firewall Rules",         "Firewall Gaps",     "Req 1",          "High",     8.1, 3, 55),
    ("Flat Network / No Segmentation", "No Segmentation",   "Req 1",          "Critical", 9.4, 4, 44),
    ("Malware / No AV Controls",       "No AV/EDR",         "Req 5",          "High",     8.0, 2, 50),
    ("Insufficient Logging",           "No Logging",        "Req 10",         "Medium",   6.5, 2, 61),
    ("No Vulnerability Scanning",      "No VA Scans",       "Req 11",         "High",     7.6, 2, 53),
    ("Insecure Configuration",         "Misconfig",         "Req 2",          "High",     7.3, 3, 66),
    ("Lack of Physical Controls",      "Physical Access",   "Req 9",          "Medium",   5.8, 3, 30),
    ("No Security Policy / Training",  "No Policy",         "Req 12",         "Medium",   5.5, 2, 45),
]

PCI_REQS = {
    "Req 1":  "Network Security Controls",
    "Req 2":  "Secure Configurations",
    "Req 3":  "Protect Stored Data",
    "Req 4":  "Encryption in Transit",
    "Req 5":  "Anti-Malware Protection",
    "Req 6":  "Secure Dev & Patching",
    "Req 7":  "Restrict Access (Least Priv)",
    "Req 8":  "Identify & Authenticate Users",
    "Req 9":  "Physical Access Restriction",
    "Req 10": "Logging & Monitoring",
    "Req 11": "Regular Security Testing",
    "Req 12": "Security Policy & Programs",
}

RISK_COLOR = {"Critical": RED_HIGH, "High": ORANGE_MED,
              "Medium": YELLOW_INFO, "Low": GREEN_LOW}

# ── Helper: cover page ────────────────────────────────────────────────────────

def cover_page(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')

    ax.add_patch(FancyBboxPatch((0, 0), 1, 1, boxstyle="square,pad=0",
                                facecolor=BRAND_BLUE, zorder=0))
    ax.add_patch(FancyBboxPatch((0, 0), 1, 0.18, boxstyle="square,pad=0",
                                facecolor=BRAND_TEAL, zorder=1))
    ax.add_patch(FancyBboxPatch((0.04, 0.22), 0.92, 0.72,
                                boxstyle="round,pad=0.01",
                                facecolor="white", alpha=0.07, zorder=1))

    ax.text(0.5, 0.86, "PCI DSS v4.0", ha='center', va='center',
            fontsize=22, fontweight='bold', color=ACCENT_GOLD, zorder=2)
    ax.text(0.5, 0.76, "Vulnerability Mapping Report",
            ha='center', va='center', fontsize=32, fontweight='bold',
            color='white', zorder=2)
    ax.text(0.5, 0.66,
            "Mapping PCI DSS Requirements to Common Security Vulnerabilities",
            ha='center', va='center', fontsize=14, color=MID_GREY, zorder=2)

    divider_y = 0.58
    ax.plot([0.1, 0.9], [divider_y, divider_y], color=ACCENT_GOLD,
            linewidth=2, zorder=2)

    bullets = [
        "12 PCI DSS Requirements  ·  18 Vulnerability Categories",
        "Risk Ratings  ·  CVSS Scoring  ·  Remediation Guidance",
        "Tables, Heatmap, Bar, Pie, Bubble & Radar Charts",
    ]
    for i, b in enumerate(bullets):
        ax.text(0.5, 0.50 - i * 0.07, f"▸  {b}",
                ha='center', va='center', fontsize=11,
                color='white', zorder=2)

    ax.text(0.5, 0.10, f"Generated: {datetime.now().strftime('%B %d, %Y')}",
            ha='center', va='center', fontsize=10,
            color="white", alpha=0.8, zorder=2)
    ax.text(0.5, 0.05,
            "For internal security & compliance review purposes",
            ha='center', va='center', fontsize=9,
            color=MID_GREY, zorder=2)
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

# ── Helper: section header utility ──────────────────────────────────────────

def section_header(ax_or_fig, title, subtitle=""):
    """Draw a header band on a dedicated axes at the top."""
    ax_or_fig.text(0.5, 0.93, title, transform=ax_or_fig.transAxes,
                   ha='center', va='top', fontsize=15, fontweight='bold',
                   color=BRAND_BLUE)
    if subtitle:
        ax_or_fig.text(0.5, 0.88, subtitle, transform=ax_or_fig.transAxes,
                       ha='center', va='top', fontsize=9, color='grey')

# ── Page 2: Main mapping table ────────────────────────────────────────────────

def page_mapping_table(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)

    # Header band
    header_ax = fig.add_axes([0, 0.90, 1, 0.10])
    header_ax.set_facecolor(BRAND_BLUE); header_ax.axis('off')
    header_ax.text(0.5, 0.55,
                   "Table 1 — PCI DSS Requirement to Vulnerability Mapping",
                   ha='center', va='center', fontsize=14, fontweight='bold',
                   color='white', transform=header_ax.transAxes)

    table_ax = fig.add_axes([0.01, 0.01, 0.98, 0.88])
    table_ax.axis('off')

    col_labels = ["Vulnerability", "PCI DSS\nRequirement(s)",
                  "Requirement Title", "Risk\nRating", "CVSS\nScore"]
    col_widths  = [0.32, 0.13, 0.32, 0.10, 0.08]

    rows = []
    for v in VULN_DATA:
        reqs = v[2]
        display_reqs = reqs.replace("Req ", "Req ").replace(",Req", ", Req")
        titles = " / ".join(PCI_REQS[r.strip()] for r in reqs.split(","))
        rows.append([v[0], display_reqs, titles, v[3], f"{v[4]:.1f}"])

    n_cols = len(col_labels)
    n_rows = len(rows)
    row_h = 0.042
    hdr_h = 0.052
    start_y = 0.97
    x_starts = [sum(col_widths[:i]) for i in range(n_cols)]

    # column headers
    for ci, (label, xw) in enumerate(zip(col_labels, col_widths)):
        rect = FancyBboxPatch((x_starts[ci]+0.003, start_y - hdr_h + 0.005),
                               xw - 0.006, hdr_h - 0.008,
                               boxstyle="round,pad=0.004",
                               facecolor=BRAND_BLUE, edgecolor='none',
                               transform=table_ax.transAxes, zorder=3)
        table_ax.add_patch(rect)
        table_ax.text(x_starts[ci] + xw/2, start_y - hdr_h/2,
                      label, ha='center', va='center',
                      fontsize=8, fontweight='bold', color='white',
                      transform=table_ax.transAxes)

    for ri, row in enumerate(rows):
        y = start_y - hdr_h - ri * row_h
        bg = "white" if ri % 2 == 0 else "#EEF2F7"
        rect = FancyBboxPatch((0.003, y - row_h + 0.003),
                               0.994, row_h - 0.004,
                               boxstyle="round,pad=0.003",
                               facecolor=bg, edgecolor='none',
                               transform=table_ax.transAxes, zorder=2)
        table_ax.add_patch(rect)
        for ci, (cell, xw) in enumerate(zip(row, col_widths)):
            color = TEXT_DARK
            fw = 'normal'
            if ci == 3:  # Risk
                color = RISK_COLOR.get(cell, TEXT_DARK)
                fw = 'bold'
            table_ax.text(x_starts[ci] + xw/2, y - row_h/2,
                          cell, ha='center', va='center',
                          fontsize=7.5, color=color, fontweight=fw,
                          transform=table_ax.transAxes)

    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

# ── Page 3: Detailed control table ───────────────────────────────────────────

def page_control_table(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)

    header_ax = fig.add_axes([0, 0.90, 1, 0.10])
    header_ax.set_facecolor(BRAND_TEAL); header_ax.axis('off')
    header_ax.text(0.5, 0.55,
                   "Table 2 — Vulnerability Control Requirements & Remediation Priority",
                   ha='center', va='center', fontsize=13, fontweight='bold',
                   color='white', transform=header_ax.transAxes)

    table_ax = fig.add_axes([0.01, 0.01, 0.98, 0.88])
    table_ax.axis('off')

    col_labels = ["Vulnerability", "PCI Req", "Key Control Objective",
                  "Remediation Action", "Ease\nof Fix\n(1-5)", "Freq\n(%)"]
    col_widths  = [0.22, 0.07, 0.28, 0.28, 0.07, 0.06]

    controls = [
        ("Weak / Reused Passwords",     "Req 8",    "Enforce password complexity policy",
         "Implement password manager + complexity rules",               2, 78),
        ("Default Credentials",         "Req 2,Req 8",  "Change all vendor defaults before deployment",
         "Credential audit; forced rotation on deploy",                 2, 65),
        ("Missing MFA",                 "Req 8",    "MFA required for all CDE access",
         "Deploy TOTP/FIDO2 across all privileged accounts",           2, 58),
        ("Unpatched OS / Software",     "Req 6",    "Critical patches within 1 month",
         "Automated patch management (WSUS/Ansible/Intune)",           3, 72),
        ("Missing Security Patches",    "Req 6,Req 11", "Systematic patch cadence & tracking",
         "Vulnerability scanner → ticketing workflow integration",      3, 69),
        ("Weak Cipher Suites",          "Req 4",    "Only approved ciphers (TLS 1.2+, AEAD)",
         "Disable SSLv3/TLS1.0/1.1; enforce TLS 1.3 where possible",  2, 54),
        ("Outdated TLS (1.0/1.1)",      "Req 4",    "Retire deprecated protocol versions",
         "IIS/Apache/Nginx cipher hardening; test w/ sslyze",          2, 47),
        ("Unencrypted Data at Rest",    "Req 3",    "Encrypt all stored CHD with AES-256",
         "Transparent DB encryption (TDE) + file-level encryption",    3, 41),
        ("Unencrypted Data in Transit", "Req 4",    "All CHD transmission over TLS 1.2+",
         "Enforce HTTPS-only; HSTS headers; mutual TLS for APIs",      2, 38),
        ("Excessive Privileges",        "Req 7",    "Least-privilege access model",
         "RBAC review; PAM solution; quarterly access recertification", 3, 63),
        ("Missing Firewall Rules",      "Req 1",    "Deny-by-default network policy",
         "Firewall rule audit; auto-deny unknown egress",               3, 55),
        ("No Network Segmentation",     "Req 1",    "Isolate CDE from other networks",
         "VLAN/micro-segmentation; separate CDE DMZ",                  4, 44),
        ("Malware / No AV",             "Req 5",    "AV/EDR on all applicable systems",
         "Deploy EDR (CrowdStrike/Defender) + weekly scan schedule",   2, 50),
        ("Insufficient Logging",        "Req 10",   "Log all access to CHD systems",
         "Centralised SIEM (Splunk/ELK) + 12-month retention",        2, 61),
        ("No Vulnerability Scanning",   "Req 11",   "Quarterly internal/external scans",
         "Scheduled Nessus/Qualys scans; automated CI/CD SAST",        2, 53),
        ("Insecure Configuration",      "Req 2",    "Harden all system configs (CIS benchmarks)",
         "CIS-CAT / InSpec automated compliance scanning",             3, 66),
        ("No Physical Controls",        "Req 9",    "Restrict physical access to CDE",
         "Badge access, CCTV, clean-desk policy, visitor logs",        3, 30),
        ("No Security Policy",          "Req 12",   "Documented security policies & training",
         "Annual policy review; mandatory security awareness training", 2, 45),
    ]

    n_cols = len(col_labels)
    row_h  = 0.042
    hdr_h  = 0.052
    start_y = 0.97
    x_starts = [sum(col_widths[:i]) for i in range(n_cols)]

    for ci, (label, xw) in enumerate(zip(col_labels, col_widths)):
        rect = FancyBboxPatch((x_starts[ci]+0.002, start_y - hdr_h + 0.004),
                               xw - 0.004, hdr_h - 0.007,
                               boxstyle="round,pad=0.003",
                               facecolor=BRAND_TEAL, edgecolor='none',
                               transform=table_ax.transAxes, zorder=3)
        table_ax.add_patch(rect)
        table_ax.text(x_starts[ci] + xw/2, start_y - hdr_h/2,
                      label, ha='center', va='center',
                      fontsize=7.5, fontweight='bold', color='white',
                      transform=table_ax.transAxes)

    ease_colors = {1: GREEN_LOW, 2: "#2ECC71", 3: YELLOW_INFO,
                   4: ORANGE_MED, 5: RED_HIGH}
    for ri, row in enumerate(controls):
        y = start_y - hdr_h - ri * row_h
        bg = "white" if ri % 2 == 0 else "#EEF2F7"
        rect = FancyBboxPatch((0.002, y - row_h + 0.003),
                               0.996, row_h - 0.004,
                               boxstyle="round,pad=0.002",
                               facecolor=bg, edgecolor='none',
                               transform=table_ax.transAxes, zorder=2)
        table_ax.add_patch(rect)
        cells = [row[0], row[1], row[2], row[3], str(row[4]), str(row[5])+"%"]
        for ci, (cell, xw) in enumerate(zip(cells, col_widths)):
            color = TEXT_DARK
            fw = 'normal'
            fs = 7.0
            if ci == 4:
                color = ease_colors.get(row[4], TEXT_DARK)
                fw = 'bold'
            table_ax.text(x_starts[ci] + xw/2, y - row_h/2,
                          cell, ha='center', va='center',
                          fontsize=fs, color=color, fontweight=fw,
                          transform=table_ax.transAxes, wrap=True)

    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

# ── Page 4: Bar charts ────────────────────────────────────────────────────────

def page_bar_charts(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)
    fig.suptitle("Figure 1 — Vulnerability Frequency & CVSS Score Distribution",
                 fontsize=14, fontweight='bold', color=BRAND_BLUE, y=0.97)

    gs = gridspec.GridSpec(1, 2, figure=fig,
                           left=0.07, right=0.97, bottom=0.12, top=0.90,
                           wspace=0.35)

    labels  = [v[1] for v in VULN_DATA]
    freqs   = [v[6] for v in VULN_DATA]
    scores  = [v[4] for v in VULN_DATA]
    risks   = [v[3] for v in VULN_DATA]
    bar_colors = [RISK_COLOR[r] for r in risks]

    # — Chart A: Frequency horizontal bar —
    ax1 = fig.add_subplot(gs[0])
    y_pos = np.arange(len(labels))
    bars = ax1.barh(y_pos, freqs, color=bar_colors, edgecolor='white',
                    linewidth=0.5, height=0.7)
    ax1.set_yticks(y_pos)
    ax1.set_yticklabels(labels, fontsize=7.5)
    ax1.set_xlabel("Observed Frequency (%)", fontsize=9)
    ax1.set_title("Vulnerability Occurrence Frequency", fontsize=11,
                  fontweight='bold', color=BRAND_BLUE)
    ax1.set_xlim(0, 100)
    ax1.axvline(x=50, color=MID_GREY, linestyle='--', linewidth=0.8, alpha=0.7)
    ax1.set_facecolor(LIGHT_GREY)
    ax1.spines[['top', 'right']].set_visible(False)
    for bar, val in zip(bars, freqs):
        ax1.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2,
                 f"{val}%", va='center', fontsize=6.5, color=TEXT_DARK)

    # — Chart B: CVSS score vertical bar —
    ax2 = fig.add_subplot(gs[1])
    x_pos = np.arange(len(labels))
    bars2 = ax2.bar(x_pos, scores, color=bar_colors, edgecolor='white',
                    linewidth=0.5, width=0.7)
    ax2.set_xticks(x_pos)
    ax2.set_xticklabels(labels, rotation=55, ha='right', fontsize=6.5)
    ax2.set_ylabel("CVSS v3.1 Base Score", fontsize=9)
    ax2.set_title("CVSS Base Scores by Vulnerability", fontsize=11,
                  fontweight='bold', color=BRAND_BLUE)
    ax2.set_ylim(0, 11)
    ax2.axhline(y=9.0, color=RED_HIGH,    linestyle='--', linewidth=1,
                alpha=0.7, label="Critical threshold (9.0)")
    ax2.axhline(y=7.0, color=ORANGE_MED,  linestyle='--', linewidth=1,
                alpha=0.7, label="High threshold (7.0)")
    ax2.set_facecolor(LIGHT_GREY)
    ax2.spines[['top', 'right']].set_visible(False)
    ax2.legend(fontsize=7, loc='lower right')
    for bar, val in zip(bars2, scores):
        ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                 f"{val}", ha='center', va='bottom', fontsize=5.5,
                 color=TEXT_DARK)

    legend_patches = [
        mpatches.Patch(color=RED_HIGH,    label="Critical"),
        mpatches.Patch(color=ORANGE_MED,  label="High"),
        mpatches.Patch(color=YELLOW_INFO, label="Medium"),
    ]
    fig.legend(handles=legend_patches, loc='lower center',
               ncol=3, fontsize=9, frameon=True,
               bbox_to_anchor=(0.5, 0.01))

    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

# ── Page 5: Heatmap ──────────────────────────────────────────────────────────

def page_heatmap(pdf):
    req_labels = list(PCI_REQS.keys())
    vuln_labels = [v[1] for v in VULN_DATA]

    matrix = np.zeros((len(vuln_labels), len(req_labels)))
    for vi, v in enumerate(VULN_DATA):
        for req in v[2].split(","):
            req = req.strip()
            if req in req_labels:
                ri = req_labels.index(req)
                matrix[vi, ri] = v[4]   # CVSS score as intensity

    fig, ax = plt.subplots(figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)
    fig.suptitle("Figure 2 — PCI DSS Requirement × Vulnerability Heatmap  (intensity = CVSS score)",
                 fontsize=13, fontweight='bold', color=BRAND_BLUE, y=0.97)

    im = ax.imshow(matrix, cmap='YlOrRd', aspect='auto', vmin=0, vmax=10)

    ax.set_xticks(np.arange(len(req_labels)))
    ax.set_yticks(np.arange(len(vuln_labels)))
    short_reqs = [f"{r}\n{PCI_REQS[r][:18]}" for r in req_labels]
    ax.set_xticklabels(short_reqs, fontsize=7, ha='center')
    ax.set_yticklabels(vuln_labels, fontsize=7.5)
    ax.set_xlabel("PCI DSS Requirement", fontsize=10)
    ax.set_ylabel("Vulnerability Category", fontsize=10)

    for i in range(len(vuln_labels)):
        for j in range(len(req_labels)):
            val = matrix[i, j]
            if val > 0:
                text_color = 'white' if val > 7 else TEXT_DARK
                ax.text(j, i, f"{val:.1f}", ha='center', va='center',
                        fontsize=7, color=text_color, fontweight='bold')

    plt.colorbar(im, ax=ax, label="CVSS Base Score", shrink=0.6)
    ax.set_title("Red cells indicate high-severity vulnerabilities covered by that PCI requirement",
                 fontsize=9, color='grey', pad=8)

    plt.tight_layout(rect=[0, 0, 1, 0.95])
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

# ── Page 6: Pie + Stacked bar ─────────────────────────────────────────────────

def page_pie_stacked(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)
    fig.suptitle("Figure 3 — Risk Distribution & PCI Requirement Coverage",
                 fontsize=14, fontweight='bold', color=BRAND_BLUE, y=0.97)

    gs = gridspec.GridSpec(1, 2, figure=fig,
                           left=0.05, right=0.97, bottom=0.10, top=0.90,
                           wspace=0.30)

    # — Pie: risk distribution —
    ax1 = fig.add_subplot(gs[0])
    risk_counts = {}
    for v in VULN_DATA:
        risk_counts[v[3]] = risk_counts.get(v[3], 0) + 1
    order = ["Critical", "High", "Medium", "Low"]
    sizes  = [risk_counts.get(r, 0) for r in order]
    colors = [RISK_COLOR[r] for r in order]
    explode = [0.05] * len(order)
    wedges, texts, autotexts = ax1.pie(
        sizes, labels=order, colors=colors, explode=explode,
        autopct=lambda p: f'{p:.1f}%\n({int(round(p*sum(sizes)/100))})',
        startangle=140, pctdistance=0.70,
        textprops={'fontsize': 9})
    for at in autotexts:
        at.set_fontsize(8)
        at.set_color('white')
        at.set_fontweight('bold')
    ax1.set_title("Vulnerability Risk Distribution\n(by Risk Rating)",
                  fontsize=11, fontweight='bold', color=BRAND_BLUE)

    # — Stacked bar: vulnerabilities per PCI requirement by risk —
    ax2 = fig.add_subplot(gs[1])
    req_risk = {r: {"Critical": 0, "High": 0, "Medium": 0} for r in PCI_REQS}
    for v in VULN_DATA:
        for req in v[2].split(","):
            req = req.strip()
            if req in req_risk:
                req_risk[req][v[3]] = req_risk[req].get(v[3], 0) + 1

    reqs = list(PCI_REQS.keys())
    crit_vals = [req_risk[r]["Critical"] for r in reqs]
    high_vals  = [req_risk[r]["High"]     for r in reqs]
    med_vals   = [req_risk[r]["Medium"]   for r in reqs]

    x = np.arange(len(reqs))
    w = 0.55
    p1 = ax2.bar(x, crit_vals, w, label="Critical", color=RED_HIGH,   edgecolor='white')
    p2 = ax2.bar(x, high_vals,  w, bottom=crit_vals, label="High",
                 color=ORANGE_MED, edgecolor='white')
    bot3 = [c+h for c, h in zip(crit_vals, high_vals)]
    p3 = ax2.bar(x, med_vals, w, bottom=bot3, label="Medium",
                 color=YELLOW_INFO, edgecolor='white')

    ax2.set_xticks(x)
    ax2.set_xticklabels(reqs, rotation=45, ha='right', fontsize=7.5)
    ax2.set_ylabel("Number of Vulnerabilities", fontsize=9)
    ax2.set_title("Vulnerabilities per PCI Requirement\n(stacked by risk rating)",
                  fontsize=11, fontweight='bold', color=BRAND_BLUE)
    ax2.legend(fontsize=8)
    ax2.set_facecolor(LIGHT_GREY)
    ax2.spines[['top', 'right']].set_visible(False)
    ax2.yaxis.set_major_locator(plt.MaxNLocator(integer=True))

    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

# ── Page 7: Bubble chart ──────────────────────────────────────────────────────

def page_bubble(pdf):
    fig, ax = plt.subplots(figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)
    ax.set_facecolor("#FAFBFD")
    fig.suptitle("Figure 4 — Risk vs. Remediation Effort  (bubble size = occurrence frequency)",
                 fontsize=13, fontweight='bold', color=BRAND_BLUE, y=0.97)

    labels   = [v[1] for v in VULN_DATA]
    cvss     = [v[4] for v in VULN_DATA]
    effort   = [v[5] for v in VULN_DATA]
    freq     = [v[6] for v in VULN_DATA]
    risks    = [v[3] for v in VULN_DATA]
    colors   = [RISK_COLOR[r] for r in risks]
    sizes    = [f * 18 for f in freq]

    scatter = ax.scatter(effort, cvss, s=sizes, c=colors,
                         alpha=0.75, edgecolors='white', linewidths=1.2, zorder=3)

    for i, label in enumerate(labels):
        ax.annotate(label, (effort[i], cvss[i]),
                    textcoords="offset points", xytext=(6, 4),
                    fontsize=6.5, color=TEXT_DARK)

    ax.axhline(y=9.0, color=RED_HIGH,   linestyle='--', linewidth=1,
               alpha=0.6, label="Critical CVSS (9.0)")
    ax.axhline(y=7.0, color=ORANGE_MED, linestyle='--', linewidth=1,
               alpha=0.6, label="High CVSS (7.0)")
    ax.axvline(x=2.5, color=MID_GREY,   linestyle=':',  linewidth=1,
               alpha=0.8, label="Ease boundary")

    ax.set_xlabel("Remediation Effort  (1=Easy → 5=Hard)", fontsize=10)
    ax.set_ylabel("CVSS v3.1 Base Score", fontsize=10)
    ax.set_xlim(0.5, 5.5)
    ax.set_ylim(4, 11)
    ax.set_xticks([1, 2, 3, 4, 5])
    ax.set_xticklabels(["1\n(Trivial)", "2\n(Easy)", "3\n(Moderate)",
                         "4\n(Hard)", "5\n(Very Hard)"])

    # quadrant annotations
    for (xq, yq, txt) in [
        (1.2, 10.3, "Quick Wins\n(high risk, easy fix)"),
        (4.2, 10.3, "Major Projects\n(high risk, hard fix)"),
        (1.2, 5.0,  "Low Priority\n(low risk, easy fix)"),
        (4.2, 5.0,  "Evaluate\n(low risk, hard fix)"),
    ]:
        ax.text(xq, yq, txt, fontsize=7, color='grey',
                ha='center', va='center', style='italic',
                bbox=dict(boxstyle='round,pad=0.3', facecolor='white',
                          edgecolor=MID_GREY, alpha=0.7))

    legend_patches = [
        mpatches.Patch(color=RED_HIGH,    label="Critical"),
        mpatches.Patch(color=ORANGE_MED,  label="High"),
        mpatches.Patch(color=YELLOW_INFO, label="Medium"),
    ]
    ax.legend(handles=legend_patches + [
        plt.Line2D([0], [0], color=RED_HIGH,   linestyle='--', label="Critical CVSS (9.0)"),
        plt.Line2D([0], [0], color=ORANGE_MED, linestyle='--', label="High CVSS (7.0)"),
    ], fontsize=8, loc='lower right')
    ax.spines[['top', 'right']].set_visible(False)

    plt.tight_layout(rect=[0, 0, 1, 0.95])
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

# ── Page 8: Radar chart ──────────────────────────────────────────────────────

def page_radar(pdf):
    categories = list(PCI_REQS.keys())
    N = len(categories)
    angles = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
    angles += angles[:1]

    # Normalised exposure (0-10) and remediation-effort scores per requirement
    exposure = {}
    effort_map = {}
    for v in VULN_DATA:
        for req in v[2].split(","):
            req = req.strip()
            if req in PCI_REQS:
                exposure[req]    = max(exposure.get(req, 0),    v[4])
                effort_map[req]  = max(effort_map.get(req, 0),  v[5] * 2)

    exp_vals    = [exposure.get(r, 0)   for r in categories] + [exposure.get(categories[0], 0)]
    effort_vals = [effort_map.get(r, 0) for r in categories] + [effort_map.get(categories[0], 0)]

    fig, ax = plt.subplots(figsize=(9, 8.5), subplot_kw=dict(polar=True))
    fig.patch.set_facecolor(LIGHT_GREY)
    ax.set_facecolor("#FAFBFD")
    fig.suptitle("Figure 5 — Radar: Max CVSS Exposure vs. Remediation Effort per PCI Requirement",
                 fontsize=12, fontweight='bold', color=BRAND_BLUE, y=0.98)

    ax.plot(angles, exp_vals,    color=RED_HIGH,   linewidth=2,   label="Max CVSS Exposure")
    ax.fill(angles, exp_vals,    color=RED_HIGH,   alpha=0.20)
    ax.plot(angles, effort_vals, color=BRAND_TEAL, linewidth=2,   label="Remediation Effort (scaled)")
    ax.fill(angles, effort_vals, color=BRAND_TEAL, alpha=0.15)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, fontsize=9, color=BRAND_BLUE, fontweight='bold')
    ax.set_ylim(0, 11)
    ax.set_yticks([2, 4, 6, 8, 10])
    ax.set_yticklabels(["2", "4", "6", "8", "10"], fontsize=7, color='grey')
    ax.yaxis.set_tick_params(labelsize=7)
    ax.grid(color=MID_GREY, linewidth=0.7, linestyle='--', alpha=0.6)
    ax.spines['polar'].set_color(MID_GREY)

    ax.legend(loc='upper right', bbox_to_anchor=(1.35, 1.15), fontsize=9)
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

# ── Page 9: Line / trend chart ───────────────────────────────────────────────

def page_trend(pdf):
    fig, axes = plt.subplots(1, 2, figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)
    fig.suptitle("Figure 6 — Trend Analysis: Historical Breach Incidents & Cumulative Risk Coverage",
                 fontsize=13, fontweight='bold', color=BRAND_BLUE, y=0.97)

    years = [2019, 2020, 2021, 2022, 2023, 2024, 2025]

    incidents = {
        "Credential Attacks":    [320, 410, 490, 530, 570, 610, 640],
        "Unpatched Systems":     [280, 300, 350, 390, 420, 450, 480],
        "Crypto Failures":       [150, 170, 200, 230, 260, 290, 310],
        "Misconfiguration":      [190, 220, 270, 320, 360, 400, 430],
        "Insufficient Logging":  [80,  95, 110, 120, 130, 140, 150],
    }
    line_colors = [RED_HIGH, ORANGE_MED, BRAND_BLUE, BRAND_TEAL, GREEN_LOW]

    ax1 = axes[0]
    ax1.set_facecolor(LIGHT_GREY)
    for (cat, vals), col in zip(incidents.items(), line_colors):
        ax1.plot(years, vals, marker='o', color=col, linewidth=2,
                 markersize=5, label=cat)
        ax1.fill_between(years, vals, alpha=0.05, color=col)
    ax1.set_title("Annual Breach Incidents by Category\n(illustrative trend data)",
                  fontsize=10, fontweight='bold', color=BRAND_BLUE)
    ax1.set_xlabel("Year", fontsize=9)
    ax1.set_ylabel("Incident Count", fontsize=9)
    ax1.legend(fontsize=7, loc='upper left')
    ax1.spines[['top', 'right']].set_visible(False)
    ax1.set_xticks(years)

    # cumulative risk coverage improvement
    ax2 = axes[1]
    ax2.set_facecolor(LIGHT_GREY)
    reqs_implemented = [3, 5, 6, 7, 8, 9, 10, 11, 12]
    coverage_pct     = [25, 42, 53, 62, 70, 77, 83, 90, 96]

    ax2.plot(reqs_implemented, coverage_pct, marker='D', color=BRAND_BLUE,
             linewidth=2.5, markersize=7, zorder=3)
    ax2.fill_between(reqs_implemented, coverage_pct,
                     alpha=0.15, color=BRAND_BLUE)
    for x, y in zip(reqs_implemented, coverage_pct):
        ax2.annotate(f"{y}%", (x, y),
                     textcoords="offset points", xytext=(0, 8),
                     ha='center', fontsize=8, color=BRAND_BLUE,
                     fontweight='bold')

    ax2.axhline(y=80, color=GREEN_LOW, linestyle='--', linewidth=1.5,
                alpha=0.8, label="Target coverage (80%)")
    ax2.set_title("Cumulative Risk Coverage\nvs. PCI Requirements Implemented",
                  fontsize=10, fontweight='bold', color=BRAND_BLUE)
    ax2.set_xlabel("Number of PCI Requirements Implemented", fontsize=9)
    ax2.set_ylabel("Estimated Risk Coverage (%)", fontsize=9)
    ax2.set_ylim(0, 105)
    ax2.legend(fontsize=8)
    ax2.spines[['top', 'right']].set_visible(False)

    plt.tight_layout(rect=[0, 0, 1, 0.93])
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

# ── Page 10: Summary scorecard ────────────────────────────────────────────────

def page_scorecard(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)

    header_ax = fig.add_axes([0, 0.88, 1, 0.10])
    header_ax.set_facecolor(BRAND_BLUE); header_ax.axis('off')
    header_ax.text(0.5, 0.55, "Table 3 — Remediation Scorecard & Prioritisation",
                   ha='center', va='center', fontsize=14, fontweight='bold',
                   color='white', transform=header_ax.transAxes)

    body_ax = fig.add_axes([0.03, 0.03, 0.94, 0.84])
    body_ax.axis('off')

    # KPI metrics strip
    kpis = [
        ("18",       "Vulnerability\nCategories",  BRAND_BLUE),
        ("12",       "PCI DSS\nRequirements",       BRAND_TEAL),
        ("7",        "Critical / High\nCVSS ≥ 9.0", RED_HIGH),
        ("8",        "High\nCVSS 7–8.9",            ORANGE_MED),
        ("3",        "Medium\nCVSS 5–6.9",          YELLOW_INFO),
    ]
    kpi_w = 0.18
    for ki, (val, label, col) in enumerate(kpis):
        xk = 0.01 + ki * (kpi_w + 0.015)
        rect = FancyBboxPatch((xk, 0.82), kpi_w, 0.13,
                               boxstyle="round,pad=0.01",
                               facecolor=col, edgecolor='none',
                               transform=body_ax.transAxes, zorder=2)
        body_ax.add_patch(rect)
        body_ax.text(xk + kpi_w/2, 0.93, val, ha='center', va='center',
                     fontsize=20, fontweight='bold', color='white',
                     transform=body_ax.transAxes, zorder=3)
        body_ax.text(xk + kpi_w/2, 0.83, label, ha='center', va='bottom',
                     fontsize=7.5, color='white',
                     transform=body_ax.transAxes, zorder=3)

    # Priority action table
    prio_cols   = ["Priority", "Vulnerability", "PCI Req", "Risk",
                   "CVSS", "Action", "Timeline"]
    prio_widths = [0.07, 0.19, 0.09, 0.09, 0.06, 0.35, 0.10]
    prio_data   = [
        ("P1", "Default Credentials",        "Req 2,8",  "Critical", "9.3",
         "Immediate credential audit + forced rotation",          "0–7 days"),
        ("P1", "Unpatched OS / Software",    "Req 6",    "Critical", "9.5",
         "Emergency patch cycle; isolate unpatched hosts",        "0–7 days"),
        ("P1", "Unencrypted Data in Transit","Req 4",    "Critical", "9.2",
         "Enforce TLS 1.2+ everywhere; revoke HTTP endpoints",    "0–14 days"),
        ("P1", "No Network Segmentation",    "Req 1",    "Critical", "9.4",
         "Immediate VLAN isolation of CDE",                       "0–14 days"),
        ("P2", "Weak Passwords",             "Req 8",    "Critical", "9.1",
         "Deploy password policy + privileged account review",    "14–30 days"),
        ("P2", "Unencrypted Data at Rest",   "Req 3",    "Critical", "9.0",
         "Enable TDE; encrypt CHD file stores",                   "14–30 days"),
        ("P2", "Missing MFA",                "Req 8",    "High",     "8.2",
         "Roll out TOTP/FIDO2 for all CDE admin accounts",        "14–30 days"),
        ("P2", "Missing Security Patches",   "Req 6,11", "High",     "8.7",
         "Automated patching pipeline; weekly cadence",           "14–30 days"),
        ("P3", "Excessive Privileges",       "Req 7",    "High",     "7.9",
         "RBAC review; remove stale accounts",                    "30–60 days"),
        ("P3", "Missing Firewall Rules",     "Req 1",    "High",     "8.1",
         "Firewall rule audit; deny-by-default policy",           "30–60 days"),
        ("P3", "Insufficient Logging",       "Req 10",   "Medium",   "6.5",
         "Deploy centralised SIEM + 12-month retention",          "30–60 days"),
        ("P3", "Insecure Configuration",     "Req 2",    "High",     "7.3",
         "CIS benchmark scanning + remediation sprints",          "30–60 days"),
    ]

    prio_colors = {"P1": RED_HIGH, "P2": ORANGE_MED, "P3": YELLOW_INFO}
    col_bg      = BRAND_BLUE
    row_h = 0.054
    hdr_h = 0.060
    start_y = 0.78
    x_starts = [sum(prio_widths[:i]) + 0.01 for i in range(len(prio_cols))]

    for ci, (label, xw) in enumerate(zip(prio_cols, prio_widths)):
        rect = FancyBboxPatch((x_starts[ci], start_y - hdr_h + 0.005),
                               xw - 0.005, hdr_h - 0.008,
                               boxstyle="round,pad=0.003",
                               facecolor=col_bg, edgecolor='none',
                               transform=body_ax.transAxes, zorder=3)
        body_ax.add_patch(rect)
        body_ax.text(x_starts[ci] + xw/2, start_y - hdr_h/2,
                     label, ha='center', va='center',
                     fontsize=8, fontweight='bold', color='white',
                     transform=body_ax.transAxes)

    for ri, row in enumerate(prio_data):
        y = start_y - hdr_h - ri * row_h
        bg = "white" if ri % 2 == 0 else "#EEF2F7"
        rect = FancyBboxPatch((0.01, y - row_h + 0.003),
                               0.985, row_h - 0.005,
                               boxstyle="round,pad=0.003",
                               facecolor=bg, edgecolor='none',
                               transform=body_ax.transAxes, zorder=2)
        body_ax.add_patch(rect)
        for ci, (cell, xw) in enumerate(zip(row, prio_widths)):
            color = TEXT_DARK
            fw = 'normal'
            fs = 7.5
            if ci == 0:
                color = prio_colors.get(cell, TEXT_DARK)
                fw = 'bold'
                fs = 8
            elif ci == 3:
                color = RISK_COLOR.get(cell, TEXT_DARK)
                fw = 'bold'
            body_ax.text(x_starts[ci] + xw/2, y - row_h/2,
                         cell, ha='center', va='center',
                         fontsize=fs, color=color, fontweight=fw,
                         transform=body_ax.transAxes)

    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

# ── Page 11: Grouped bar — severity counts per PCI requirement ────────────────

def page_grouped_bar(pdf):
    fig, ax = plt.subplots(figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)
    ax.set_facecolor("#FAFBFD")
    fig.suptitle(
        "Figure 7 — Vulnerabilities per PCI Requirement  (grouped by severity)",
        fontsize=13, fontweight='bold', color=BRAND_BLUE, y=0.97)

    # build counts per req per risk
    req_risk = {r: {"Critical": 0, "High": 0, "Medium": 0} for r in PCI_REQS}
    for v in VULN_DATA:
        for req in v[2].split(","):
            req = req.strip()
            if req in req_risk:
                req_risk[req][v[3]] = req_risk[req].get(v[3], 0) + 1

    reqs      = list(PCI_REQS.keys())
    short_req = [f"{r}\n{PCI_REQS[r][:16]}" for r in reqs]
    crit  = [req_risk[r]["Critical"] for r in reqs]
    high  = [req_risk[r]["High"]     for r in reqs]
    med   = [req_risk[r]["Medium"]   for r in reqs]

    x  = np.arange(len(reqs))
    w  = 0.26
    b1 = ax.bar(x - w,   crit, w, label="Critical", color=RED_HIGH,
                edgecolor='white', linewidth=0.8)
    b2 = ax.bar(x,       high, w, label="High",     color=ORANGE_MED,
                edgecolor='white', linewidth=0.8)
    b3 = ax.bar(x + w,   med,  w, label="Medium",   color=YELLOW_INFO,
                edgecolor='white', linewidth=0.8)

    for bars in (b1, b2, b3):
        for bar in bars:
            h = bar.get_height()
            if h:
                ax.text(bar.get_x() + bar.get_width() / 2, h + 0.05,
                        str(int(h)), ha='center', va='bottom',
                        fontsize=8, fontweight='bold', color=TEXT_DARK)

    ax.set_xticks(x)
    ax.set_xticklabels(short_req, fontsize=7.5)
    ax.set_ylabel("Number of Vulnerabilities", fontsize=10)
    ax.set_yticks(range(0, int(max(crit + high + med)) + 2))
    ax.legend(fontsize=9, loc='upper right')
    ax.spines[['top', 'right']].set_visible(False)

    # annotate requirements with highest exposure
    total = [c + h + m for c, h, m in zip(crit, high, med)]
    max_r = reqs[total.index(max(total))]
    ax.annotate(f"Most exposed:\n{max_r}",
                xy=(total.index(max(total)), max(total) + 0.2),
                xytext=(total.index(max(total)) + 1.2, max(total) + 0.5),
                arrowprops=dict(arrowstyle='->', color=BRAND_BLUE),
                fontsize=8, color=BRAND_BLUE, fontweight='bold')

    plt.tight_layout(rect=[0, 0, 1, 0.95])
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)


# ── Page 12: 100 % stacked horizontal bar + lollipop ─────────────────────────

def page_proportional_lollipop(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)
    fig.suptitle(
        "Figure 8 — Severity Proportion per Requirement  &  Total Vulnerability Count",
        fontsize=13, fontweight='bold', color=BRAND_BLUE, y=0.97)

    gs = gridspec.GridSpec(1, 2, figure=fig,
                           left=0.12, right=0.97, bottom=0.08, top=0.90,
                           wspace=0.40)

    req_risk = {r: {"Critical": 0, "High": 0, "Medium": 0} for r in PCI_REQS}
    for v in VULN_DATA:
        for req in v[2].split(","):
            req = req.strip()
            if req in req_risk:
                req_risk[req][v[3]] = req_risk[req].get(v[3], 0) + 1

    reqs  = list(PCI_REQS.keys())
    crit  = np.array([req_risk[r]["Critical"] for r in reqs], float)
    high  = np.array([req_risk[r]["High"]     for r in reqs], float)
    med   = np.array([req_risk[r]["Medium"]   for r in reqs], float)
    total = crit + high + med

    # — 100 % stacked horizontal bar —
    ax1 = fig.add_subplot(gs[0])
    ax1.set_facecolor(LIGHT_GREY)
    safe_total = np.where(total == 0, 1, total)
    p_crit = crit / safe_total * 100
    p_high = high / safe_total * 100
    p_med  = med  / safe_total * 100

    y = np.arange(len(reqs))
    h = 0.55
    ax1.barh(y,         p_crit, h, color=RED_HIGH,    edgecolor='white', label="Critical")
    ax1.barh(y, p_high, h, left=p_crit,               color=ORANGE_MED,  edgecolor='white', label="High")
    ax1.barh(y, p_med,  h, left=p_crit + p_high,      color=YELLOW_INFO, edgecolor='white', label="Medium")

    # percentage labels inside bars
    for i, (pc, ph, pm) in enumerate(zip(p_crit, p_high, p_med)):
        if pc > 8:
            ax1.text(pc / 2,         i, f"{pc:.0f}%", ha='center', va='center',
                     fontsize=6.5, color='white', fontweight='bold')
        if ph > 8:
            ax1.text(pc + ph / 2,    i, f"{ph:.0f}%", ha='center', va='center',
                     fontsize=6.5, color='white', fontweight='bold')
        if pm > 8:
            ax1.text(pc + ph + pm/2, i, f"{pm:.0f}%", ha='center', va='center',
                     fontsize=6.5, color=TEXT_DARK, fontweight='bold')

    ax1.set_yticks(y)
    ax1.set_yticklabels(reqs, fontsize=8)
    ax1.set_xlim(0, 100)
    ax1.set_xlabel("Percentage of Mapped Vulnerabilities", fontsize=9)
    ax1.set_title("Severity Breakdown\n(100% per requirement)", fontsize=10,
                  fontweight='bold', color=BRAND_BLUE)
    ax1.spines[['top', 'right']].set_visible(False)
    ax1.legend(fontsize=8, loc='lower right')

    # — Lollipop: total vuln count per requirement —
    ax2 = fig.add_subplot(gs[1])
    ax2.set_facecolor(LIGHT_GREY)
    sorted_idx = np.argsort(total)
    s_reqs  = [reqs[i]  for i in sorted_idx]
    s_total = total[sorted_idx]
    s_crit  = crit[sorted_idx]
    dot_colors = [RED_HIGH if c > 0 else ORANGE_MED for c in s_crit]

    y2 = np.arange(len(s_reqs))
    ax2.hlines(y2, 0, s_total, color=MID_GREY, linewidth=2)
    ax2.scatter(s_total, y2, color=dot_colors, s=90, zorder=3)

    for i, (val, col) in enumerate(zip(s_total, dot_colors)):
        ax2.text(val + 0.08, i, str(int(val)),
                 va='center', fontsize=8, color=col, fontweight='bold')

    ax2.set_yticks(y2)
    ax2.set_yticklabels(s_reqs, fontsize=8)
    ax2.set_xlabel("Total Mapped Vulnerabilities", fontsize=9)
    ax2.set_title("Total Vulnerability Count\n(sorted, dot=red if any Critical)",
                  fontsize=10, fontweight='bold', color=BRAND_BLUE)
    ax2.set_xlim(0, max(s_total) + 1.5)
    ax2.spines[['top', 'right']].set_visible(False)

    plt.tight_layout(rect=[0, 0, 1, 0.95])
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)


# ── Page 13: Strip / dot plot — every vuln plotted on its requirement ─────────

def page_strip_plot(pdf):
    fig, ax = plt.subplots(figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)
    ax.set_facecolor("#FAFBFD")
    fig.suptitle(
        "Figure 9 — CVSS Score Distribution per PCI Requirement  (each dot = one vulnerability)",
        fontsize=13, fontweight='bold', color=BRAND_BLUE, y=0.97)

    reqs      = list(PCI_REQS.keys())
    req_index = {r: i for i, r in enumerate(reqs)}

    # expand: one row per (vuln, req) pair
    xs, ys, cs, ss, labels = [], [], [], [], []
    jitter_rng = np.random.default_rng(42)
    for v in VULN_DATA:
        for req in v[2].split(","):
            req = req.strip()
            if req in req_index:
                yi = req_index[req] + jitter_rng.uniform(-0.18, 0.18)
                xs.append(v[4])
                ys.append(yi)
                cs.append(RISK_COLOR[v[3]])
                ss.append(v[6] * 3)
                labels.append(v[1])

    sc = ax.scatter(xs, ys, c=cs, s=ss, alpha=0.80,
                    edgecolors='white', linewidths=0.8, zorder=3)

    for x, y, lbl in zip(xs, ys, labels):
        ax.annotate(lbl, (x, y), textcoords="offset points",
                    xytext=(5, 2), fontsize=5.8, color=TEXT_DARK, alpha=0.85)

    ax.set_yticks(range(len(reqs)))
    short = [f"{r}  {PCI_REQS[r]}" for r in reqs]
    ax.set_yticklabels(short, fontsize=8)
    ax.set_xlabel("CVSS v3.1 Base Score", fontsize=10)
    ax.set_xlim(4.5, 11)
    ax.axvline(9.0, color=RED_HIGH,   linestyle='--', linewidth=1,
               alpha=0.6, label="Critical (9.0)")
    ax.axvline(7.0, color=ORANGE_MED, linestyle='--', linewidth=1,
               alpha=0.6, label="High (7.0)")

    # horizontal grid lines between requirements
    for i in range(len(reqs)):
        ax.axhline(i - 0.5, color=MID_GREY, linewidth=0.4, alpha=0.5)

    legend_patches = [
        mpatches.Patch(color=RED_HIGH,    label="Critical"),
        mpatches.Patch(color=ORANGE_MED,  label="High"),
        mpatches.Patch(color=YELLOW_INFO, label="Medium"),
        plt.Line2D([0], [0], color=RED_HIGH,   linestyle='--', label="CVSS 9.0"),
        plt.Line2D([0], [0], color=ORANGE_MED, linestyle='--', label="CVSS 7.0"),
    ]
    ax.legend(handles=legend_patches, fontsize=8, loc='lower right')
    ax.spines[['top', 'right']].set_visible(False)

    note = "Bubble size ∝ observed frequency  |  Jitter added on Y-axis for readability"
    fig.text(0.5, 0.01, note, ha='center', fontsize=8, color='grey', style='italic')

    plt.tight_layout(rect=[0, 0.02, 1, 0.95])
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)


# ── Page 14: Treemap + CVSS range dumbbell ────────────────────────────────────

def _treemap_rects(values, x0=0, y0=0, w=1, h=1):
    """Squarified treemap via simple row-slice layout."""
    if not values:
        return []
    total = sum(v for _, v in values)
    if total == 0:
        return []
    rects = []
    remaining = list(values)

    def layout_row(items, x, y, rw, rh, horizontal):
        row_total = sum(v for _, v in items)
        cursor = x if horizontal else y
        out = []
        for label, v in items:
            frac = v / row_total
            if horizontal:
                out.append((label, v, cursor, y, rw * frac, rh))
                cursor += rw * frac
            else:
                out.append((label, v, x, cursor, rw, rh * frac))
                cursor += rh * frac
        return out

    # simple row-based split
    cx, cy, cw, ch = x0, y0, w, h
    while remaining:
        row_frac = min(0.5, remaining[0][1] / total) if total else 0.5
        n_row = max(1, round(len(remaining) * row_frac + 0.5))
        row_items = remaining[:n_row]
        remaining  = remaining[n_row:]
        row_total  = sum(v for _, v in row_items)
        if cw >= ch:
            row_w = cw * (row_total / (total if total else 1))
            rects += layout_row(row_items, cx, cy, row_w, ch, horizontal=False)
            cx += row_w
            cw -= row_w
        else:
            row_h = ch * (row_total / (total if total else 1))
            rects += layout_row(row_items, cx, cy, cw, row_h, horizontal=True)
            cy += row_h
            ch -= row_h
        total -= row_total
    return rects


def page_treemap_dumbbell(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)
    fig.suptitle(
        "Figure 10 — Requirement Treemap (size=vuln count)  &  CVSS Range per Requirement",
        fontsize=13, fontweight='bold', color=BRAND_BLUE, y=0.97)

    gs = gridspec.GridSpec(1, 2, figure=fig,
                           left=0.04, right=0.97, bottom=0.06, top=0.90,
                           wspace=0.30)

    # — build per-req stats —
    req_vulns = {r: [] for r in PCI_REQS}
    for v in VULN_DATA:
        for req in v[2].split(","):
            req = req.strip()
            if req in req_vulns:
                req_vulns[req].append(v)

    reqs   = list(PCI_REQS.keys())
    counts = [len(req_vulns[r]) for r in reqs]
    avg_cv = [np.mean([x[4] for x in req_vulns[r]]) if req_vulns[r] else 0
              for r in reqs]
    min_cv = [min(x[4] for x in req_vulns[r]) if req_vulns[r] else 0
              for r in reqs]
    max_cv = [max(x[4] for x in req_vulns[r]) if req_vulns[r] else 0
              for r in reqs]

    # — Treemap —
    ax1 = fig.add_subplot(gs[0])
    ax1.set_xlim(0, 1); ax1.set_ylim(0, 1); ax1.axis('off')
    ax1.set_title("Vulnerability Count per Requirement\n(tile size ∝ count, colour ∝ avg CVSS)",
                  fontsize=10, fontweight='bold', color=BRAND_BLUE)

    norm_cv = plt.Normalize(vmin=5, vmax=10)
    cmap    = plt.cm.YlOrRd

    sorted_items = sorted(zip(reqs, counts), key=lambda x: -x[1])
    rects = _treemap_rects([(r, c) for r, c in sorted_items if c > 0])

    for label, val, rx, ry, rw, rh in rects:
        avg = avg_cv[reqs.index(label)]
        color = cmap(norm_cv(avg))
        patch = mpatches.FancyBboxPatch(
            (rx + 0.005, ry + 0.005), rw - 0.01, rh - 0.01,
            boxstyle="round,pad=0.005",
            facecolor=color, edgecolor='white', linewidth=1.5)
        ax1.add_patch(patch)
        fs = max(6, min(11, rw * 55))
        text_color = 'white' if avg > 7.5 else TEXT_DARK
        ax1.text(rx + rw / 2, ry + rh / 2 + 0.02,
                 label, ha='center', va='center',
                 fontsize=fs, fontweight='bold', color=text_color)
        ax1.text(rx + rw / 2, ry + rh / 2 - 0.04,
                 f"{val} vulns\nCVSS {avg:.1f}",
                 ha='center', va='center',
                 fontsize=max(5, fs - 2), color=text_color, alpha=0.9)

    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm_cv)
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=ax1, shrink=0.5, pad=0.02,
                        orientation='horizontal', location='bottom')
    cbar.set_label("Avg CVSS Score", fontsize=8)

    # — Dumbbell / range chart —
    ax2 = fig.add_subplot(gs[1])
    ax2.set_facecolor(LIGHT_GREY)
    ax2.set_title("CVSS Range per Requirement\n(min ── avg ●── max)",
                  fontsize=10, fontweight='bold', color=BRAND_BLUE)

    valid = [(r, mn, av, mx) for r, mn, av, mx
             in zip(reqs, min_cv, avg_cv, max_cv) if mx > 0]
    valid_sorted = sorted(valid, key=lambda x: -x[2])

    for i, (r, mn, av, mx) in enumerate(valid_sorted):
        ax2.hlines(i, mn, mx, color=MID_GREY, linewidth=3, alpha=0.6)
        ax2.scatter(mn, i, color=GREEN_LOW,  s=60, zorder=4, label="Min" if i == 0 else "")
        ax2.scatter(mx, i, color=RED_HIGH,   s=60, zorder=4, label="Max" if i == 0 else "")
        ax2.scatter(av, i, color=BRAND_BLUE, s=80, marker='D', zorder=5,
                    label="Avg" if i == 0 else "")
        ax2.text(mx + 0.05, i, f"{mx:.1f}", va='center', fontsize=7, color=RED_HIGH)
        ax2.text(mn - 0.05, i, f"{mn:.1f}", va='center', fontsize=7,
                 color=GREEN_LOW, ha='right')

    ax2.set_yticks(range(len(valid_sorted)))
    ax2.set_yticklabels([x[0] for x in valid_sorted], fontsize=8)
    ax2.set_xlabel("CVSS v3.1 Score", fontsize=9)
    ax2.axvline(9.0, color=RED_HIGH,   linestyle='--', linewidth=0.8, alpha=0.5)
    ax2.axvline(7.0, color=ORANGE_MED, linestyle='--', linewidth=0.8, alpha=0.5)
    ax2.set_xlim(4, 11.5)
    ax2.legend(fontsize=8, loc='lower right')
    ax2.spines[['top', 'right']].set_visible(False)

    plt.tight_layout(rect=[0, 0, 1, 0.95])
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)


# ── Page 15: Co-occurrence matrix + cumulative risk heat strip ────────────────

def page_cooccurrence(pdf):
    """Which requirement pairs share the most vulnerabilities?"""
    fig = plt.figure(figsize=(11, 8.5))
    fig.patch.set_facecolor(LIGHT_GREY)
    fig.suptitle(
        "Figure 11 — Requirement Co-occurrence Matrix  &  Avg CVSS Heat Strip",
        fontsize=13, fontweight='bold', color=BRAND_BLUE, y=0.97)

    gs = gridspec.GridSpec(2, 1, figure=fig,
                           left=0.08, right=0.92, bottom=0.05, top=0.90,
                           hspace=0.50, height_ratios=[4, 1])

    reqs = list(PCI_REQS.keys())
    n    = len(reqs)
    comat = np.zeros((n, n), int)

    for v in VULN_DATA:
        mapped = [r.strip() for r in v[2].split(",") if r.strip() in reqs]
        for i, r1 in enumerate(mapped):
            for r2 in mapped:
                ri, rj = reqs.index(r1), reqs.index(r2)
                comat[ri, rj] += 1

    # — Co-occurrence heatmap —
    ax1 = fig.add_subplot(gs[0])
    # zero out diagonal for visual clarity
    diag_vals = np.diag(comat).copy()
    np.fill_diagonal(comat, 0)

    im = ax1.imshow(comat, cmap='Blues', aspect='auto')
    ax1.set_xticks(range(n))
    ax1.set_yticks(range(n))
    ax1.set_xticklabels(reqs, rotation=45, ha='right', fontsize=8)
    ax1.set_yticklabels(reqs, fontsize=8)
    ax1.set_title(
        "Shared vulnerability count between requirement pairs\n"
        "(diagonal zeroed; darker = more shared vulns)",
        fontsize=9, color='grey')

    for i in range(n):
        for j in range(n):
            val = comat[i, j]
            if val:
                ax1.text(j, i, str(val), ha='center', va='center',
                         fontsize=8, color='white' if val > 0.6 * comat.max() else TEXT_DARK,
                         fontweight='bold')

    plt.colorbar(im, ax=ax1, label="Shared Vulnerability Count", shrink=0.7)

    # — Heat strip: avg CVSS per requirement —
    ax2 = fig.add_subplot(gs[1])
    avg_cvss = []
    for r in reqs:
        vals = [v[4] for v in VULN_DATA if r in [x.strip() for x in v[2].split(",")]]
        avg_cvss.append(np.mean(vals) if vals else 0)

    data_strip = np.array(avg_cvss).reshape(1, -1)
    im2 = ax2.imshow(data_strip, cmap='RdYlGn_r', aspect='auto',
                     vmin=5, vmax=10)
    ax2.set_xticks(range(n))
    ax2.set_xticklabels(reqs, fontsize=8)
    ax2.set_yticks([])
    ax2.set_title("Average CVSS Score per Requirement  (red = higher risk exposure)",
                  fontsize=9, color='grey')
    for j, val in enumerate(avg_cvss):
        if val:
            ax2.text(j, 0, f"{val:.1f}", ha='center', va='center',
                     fontsize=8, fontweight='bold',
                     color='white' if val > 8 else TEXT_DARK)

    plt.colorbar(im2, ax=ax2, label="Avg CVSS", shrink=0.9,
                 orientation='horizontal', pad=0.4)

    plt.tight_layout(rect=[0, 0, 1, 0.95])
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)


# ── Build PDF ────────────────────────────────────────────────────────────────

def build_pdf():
    with PdfPages(OUTPUT_FILE) as pdf:
        cover_page(pdf)
        page_mapping_table(pdf)
        page_control_table(pdf)
        page_bar_charts(pdf)
        page_heatmap(pdf)
        page_pie_stacked(pdf)
        page_bubble(pdf)
        page_radar(pdf)
        page_trend(pdf)
        page_scorecard(pdf)
        page_grouped_bar(pdf)
        page_proportional_lollipop(pdf)
        page_strip_plot(pdf)
        page_treemap_dumbbell(pdf)
        page_cooccurrence(pdf)

        d = pdf.infodict()
        d['Title']   = 'PCI DSS v4.0 Vulnerability Mapping Report'
        d['Author']  = 'Security Compliance Team'
        d['Subject'] = 'PCI DSS Requirements mapped to common security vulnerabilities'
        d['Keywords'] = 'PCI DSS, vulnerability, compliance, CVSS, security'

    print(f"PDF written → {OUTPUT_FILE}")

if __name__ == "__main__":
    build_pdf()
