import io

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

OUTPUT_FILE = "/home/portal/gitprojects/sample-graphs/PCI_Treemap.pdf"

BRAND_BLUE = "#1B3A6B"
LIGHT_GREY = "#F4F6F9"
TEXT_DARK  = "#1C1C2E"

plt.rcParams.update({"font.family": "DejaVu Sans", "figure.facecolor": "white"})

# ── Data ──────────────────────────────────────────────────────────────────────

VULN_DATA = [
    # (name, short label, pci reqs, risk, cvss)
    ("Weak / Reused Passwords",        "Weak Passwords",    "Req 8",          "Critical", 9.1),
    ("Default Credentials",            "Default Creds",     "Req 2,Req 8",    "Critical", 9.3),
    ("Missing MFA",                    "Missing MFA",       "Req 8",          "High",     8.2),
    ("Unpatched OS / Software",        "Unpatched SW",      "Req 6",          "Critical", 9.5),
    ("Missing Security Patches",       "Missing Patches",   "Req 6,Req 11",   "High",     8.7),
    ("Weak Cipher Suites (TLS)",       "Weak TLS",          "Req 4",          "High",     7.4),
    ("Outdated TLS (1.0/1.1)",         "Old TLS",           "Req 4",          "High",     7.8),
    ("Unencrypted Data at Rest",       "Plaintext Storage", "Req 3",          "Critical", 9.0),
    ("Unencrypted Data in Transit",    "Plaintext Transit", "Req 4",          "Critical", 9.2),
    ("Excessive Privileges",           "Excess Privs",      "Req 7",          "High",     7.9),
    ("Missing Firewall Rules",         "Firewall Gaps",     "Req 1",          "High",     8.1),
    ("Flat Network / No Segmentation", "No Segmentation",   "Req 1",          "Critical", 9.4),
    ("Malware / No AV Controls",       "No AV/EDR",         "Req 5",          "High",     8.0),
    ("Insufficient Logging",           "No Logging",        "Req 10",         "Medium",   6.5),
    ("No Vulnerability Scanning",      "No VA Scans",       "Req 11",         "High",     7.6),
    ("Insecure Configuration",         "Misconfig",         "Req 2",          "High",     7.3),
    ("Lack of Physical Controls",      "Physical Access",   "Req 9",          "Medium",   5.8),
    ("No Security Policy / Training",  "No Policy",         "Req 12",         "Medium",   5.5),
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

# ── Aggregate: vuln count and avg CVSS per requirement ────────────────────────

req_vulns = {r: [] for r in PCI_REQS}
for v in VULN_DATA:
    for req in v[2].split(","):
        req = req.strip()
        if req in req_vulns:
            req_vulns[req].append(v)

reqs      = list(PCI_REQS.keys())
counts    = [len(req_vulns[r]) for r in reqs]
avg_cvss  = [
    np.mean([x[4] for x in req_vulns[r]]) if req_vulns[r] else 0
    for r in reqs
]

# ── Treemap layout ────────────────────────────────────────────────────────────
# Uses a simple row-slice layout: sort by size, then alternate between
# slicing horizontally and vertically so larger tiles sit in the top-left.
#
# Each call to _layout_row() fills one "strip" of the remaining canvas,
# placing items side-by-side along the dominant axis. The strip height/width
# is proportional to the row's share of the remaining total area.
#
# Returns a list of (label, value, x, y, width, height) tuples.

def _treemap_rects(values, x0=0.0, y0=0.0, w=1.0, h=1.0):
    if not values:
        return []

    total = sum(v for _, v in values)
    if total == 0:
        return []

    def layout_row(items, x, y, rw, rh, horizontal):
        """Place items side-by-side along the chosen axis."""
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

    rects     = []
    remaining = list(values)
    cx, cy, cw, ch = x0, y0, w, h

    while remaining:
        # Decide how many items go in this row (roughly proportional to the
        # largest item's share of the remaining total).
        row_frac = min(0.5, remaining[0][1] / total) if total else 0.5
        n_row    = max(1, round(len(remaining) * row_frac + 0.5))
        row_items = remaining[:n_row]
        remaining = remaining[n_row:]

        row_total = sum(v for _, v in row_items)

        if cw >= ch:
            # Wide canvas → slice off a vertical strip on the left
            row_w = cw * (row_total / total)
            rects += layout_row(row_items, cx, cy, row_w, ch, horizontal=False)
            cx += row_w
            cw -= row_w
        else:
            # Tall canvas → slice off a horizontal strip on the bottom
            row_h = ch * (row_total / total)
            rects += layout_row(row_items, cx, cy, cw, row_h, horizontal=True)
            cy += row_h
            ch -= row_h

        total -= row_total

    return rects

# ── Plot → in-memory PNG ────────────────────────────────────────────────────

def render_treemap_png(dpi=150):
    """Draw the treemap and return it as an in-memory PNG (BytesIO)."""
    fig, ax = plt.subplots(figsize=(10, 7))
    fig.patch.set_facecolor(LIGHT_GREY)

    fig.suptitle(
        "PCI DSS Requirements — Vulnerability Count Treemap\n"
        "(tile size ∝ vulnerability count  |  colour ∝ average CVSS score)",
        fontsize=13, fontweight='bold', color=BRAND_BLUE, y=0.98,
    )

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    # Colormap: yellow → orange → red, scaled to CVSS 5–10
    norm = plt.Normalize(vmin=5, vmax=10)
    cmap = plt.cm.YlOrRd

    # Sort largest tile first so the layout fills top-left with the biggest block
    sorted_items = sorted(zip(reqs, counts), key=lambda x: -x[1])
    rects = _treemap_rects([(r, c) for r, c in sorted_items if c > 0])

    for label, val, rx, ry, rw, rh in rects:
        avg  = avg_cvss[reqs.index(label)]
        color = cmap(norm(avg))

        # Rounded rectangle tile
        patch = mpatches.FancyBboxPatch(
            (rx + 0.005, ry + 0.005), rw - 0.01, rh - 0.01,
            boxstyle="round,pad=0.005",
            facecolor=color, edgecolor='white', linewidth=1.5,
        )
        ax.add_patch(patch)

        # Font size scales with tile width so text fits inside small tiles
        fs         = max(6, min(11, rw * 55))
        text_color = 'white' if avg > 7.5 else TEXT_DARK

        # Requirement label (bold, top line)
        ax.text(
            rx + rw / 2, ry + rh / 2 + 0.02, label,
            ha='center', va='center',
            fontsize=fs, fontweight='bold', color=text_color,
        )
        # Stats line (vuln count + avg CVSS)
        ax.text(
            rx + rw / 2, ry + rh / 2 - 0.04,
            f"{val} vulns\nCVSS {avg:.1f}",
            ha='center', va='center',
            fontsize=max(5, fs - 2), color=text_color, alpha=0.9,
        )

    # ── Colourbar ─────────────────────────────────────────────────────────────
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=ax, shrink=0.5, pad=0.02,
                        orientation='horizontal', location='bottom')
    cbar.set_label("Average CVSS Score", fontsize=9)
    cbar.ax.tick_params(labelsize=8)

    plt.tight_layout(rect=[0, 0.05, 1, 0.95])

    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', dpi=dpi)
    plt.close(fig)
    buf.seek(0)
    return buf


# ── PNG (in memory) → PDF via reportlab ──────────────────────────────────────

def build_pdf(png_buf, output_file, pagesize=letter, margin=36):
    """Place an in-memory PNG onto a reportlab PDF page, centred and scaled
    to fit within the page margins while preserving aspect ratio."""
    img = ImageReader(png_buf)
    iw, ih = img.getSize()
    aspect = ih / iw

    page_w, page_h = pagesize
    max_w = page_w - 2 * margin
    max_h = page_h - 2 * margin

    draw_w = max_w
    draw_h = draw_w * aspect
    if draw_h > max_h:
        draw_h = max_h
        draw_w = draw_h / aspect

    x = (page_w - draw_w) / 2
    y = (page_h - draw_h) / 2

    c = canvas.Canvas(output_file, pagesize=pagesize)
    c.drawImage(img, x, y, width=draw_w, height=draw_h,
                preserveAspectRatio=True, mask='auto')
    c.showPage()
    c.save()


if __name__ == "__main__":
    png_buf = render_treemap_png()
    build_pdf(png_buf, OUTPUT_FILE)
    print(f"Saved → {OUTPUT_FILE}")
