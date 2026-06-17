#!/usr/bin/env python3
"""
MSMQ user_message.bin body builder.

Reads user_message.bin as a template and writes a new packet with:
  - custom destination queue
  - custom label
  - custom body (plain text, JSON, or XML)
  - corrected priority and message class

Usage:
    python3 build_message.py
    python3 build_message.py --body "your instruction here"
    python3 build_message.py --format json --body '{"action":"restart","service":"svc1"}'
    python3 build_message.py --dest "OS:myhost\\myqueue" --label "task" --body "go"

Field layout of user_message.bin that this script modifies:
    0x08        PacketSize (updated automatically)
    0x88        MsgClass   -> fixed to 0x0000 (normal)
    0x89        Priority   -> fixed to 0x03   (medium)
    0xA8, 0xAC  BodyLen    (updated automatically)
    0xC0+       Label      (UTF-16LE, null-terminated)
    0xC0+llen+2 Body       (UTF-16LE)
"""

import struct
import os
import sys
import json
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE   = os.path.join(SCRIPT_DIR, "user_message.bin")
FOOTER     = bytes([0x11, 0x11, 0x11, 0x11,
                    0x00, 0x00, 0x00, 0x40,
                    0x00, 0x00, 0x00, 0x40,
                    0x00, 0x00, 0x00, 0x00])

# ── fixed offsets that never move ────────────────────────────────────────────
OFF_PKTSIZE   = 0x08   # 4 bytes, LE uint32
OFF_MSGCLASS  = 0x88   # 2 bytes, LE uint16
OFF_PRIORITY  = 0x8A   # 1 byte
OFF_BODYLEN_1 = 0xA8   # 4 bytes, LE uint32  (primary body length field)
OFF_BODYLEN_2 = 0xAC   # 4 bytes, LE uint32  (duplicate)
OFF_LABEL     = 0xC0   # variable UTF-16LE, null-terminated
# Body starts immediately after the null terminator of the label


def encode_utf16(text):
    return text.encode("utf-16-le") + b"\x00\x00"   # include null terminator


def build(dest_queue, label, body_text, priority=3, out_path=None):
    if not os.path.exists(TEMPLATE):
        sys.exit(f"Template not found: {TEMPLATE}")

    with open(TEMPLATE, "rb") as f:
        tmpl = bytearray(f.read())

    label_enc = encode_utf16(label)
    body_enc  = body_text.encode("utf-16-le")   # NO null terminator on body
    body_len  = len(body_enc)

    # ── destination queue path (fixed in template, update if different) ───
    # Queue path is at 0x42, preceded by 2-byte length at 0x40
    orig_path_len = struct.unpack_from("<H", tmpl, 0x40)[0]
    orig_path     = tmpl[0x42:0x42 + orig_path_len].decode("utf-16-le").rstrip("\x00")

    if dest_queue != orig_path:
        # Rebuild everything after the BaseHeader+UserHeader+inner_sig block (0x3C)
        # For simplicity we only support same-length path substitutions here;
        # for different-length paths rebuild from scratch below.
        new_path_enc = dest_queue.encode("utf-16-le") + b"\x00\x00"
        if len(new_path_enc) != orig_path_len:
            print(f"[NOTE] Path length changed ({orig_path_len} → {len(new_path_enc)}). "
                  f"Adjusting structure.")
        struct.pack_into("<H", tmpl, 0x40, len(new_path_enc))
        # Replace path bytes (simple splice — keep rest of header intact up to 0xC0)
        tmpl = (tmpl[:0x42]
                + bytearray(new_path_enc)
                + tmpl[0x42 + orig_path_len:])

    # ── fix anomalous fields ─────────────────────────────────────────────
    struct.pack_into("<H", tmpl, OFF_MSGCLASS, 0x0000)   # normal message class
    tmpl[OFF_PRIORITY] = priority & 0x07                  # clamp to valid range 0-7

    # ── splice in label + body (everything from 0xC0 onward) ────────────
    payload = bytearray(label_enc) + bytearray(body_enc) + bytearray(FOOTER)
    new_packet = tmpl[:OFF_LABEL] + payload

    # ── update length fields ─────────────────────────────────────────────
    struct.pack_into("<I", new_packet, OFF_PKTSIZE,   len(new_packet))
    struct.pack_into("<I", new_packet, OFF_BODYLEN_1, body_len)
    struct.pack_into("<I", new_packet, OFF_BODYLEN_2, body_len)

    if out_path is None:
        base   = os.path.splitext(TEMPLATE)[0]
        out_path = base + "_new.bin"

    with open(out_path, "wb") as f:
        f.write(new_packet)

    print(f"Written {len(new_packet)} bytes → {out_path}")
    print(f"  Dest queue : {dest_queue}")
    print(f"  Label      : {label}")
    print(f"  Priority   : {priority}")
    print(f"  Body       : {body_text!r}")
    print(f"  Body bytes : {body_len}  ({body_len // 2} UTF-16 chars)")

    # verify by re-reading
    raw = open(out_path, "rb").read()
    check_body_len = struct.unpack_from("<I", raw, OFF_BODYLEN_1)[0]
    body_off       = OFF_LABEL + len(label_enc)
    check_body     = raw[body_off:body_off + check_body_len].decode("utf-16-le", errors="replace")
    print(f"  Verify read: \"{check_body}\"")


# ── body format helpers ───────────────────────────────────────────────────────

def body_plain(instruction):
    """Plain text — receiver processes the string directly."""
    return instruction


def body_json(action, **kwargs):
    """JSON envelope — common for task queues / service buses."""
    payload = {"action": action}
    payload.update(kwargs)
    return json.dumps(payload, separators=(",", ":"))


def body_xml(action, **kwargs):
    """Minimal XML envelope."""
    fields = "".join(f"<{k}>{v}</{k}>" for k, v in kwargs.items())
    return f"<task><action>{action}</action>{fields}</task>"


# ── examples ──────────────────────────────────────────────────────────────────

EXAMPLES = {
    "plain":   body_plain("restart service svc_payment"),
    "json":    body_json("restart", service="svc_payment", timeout=30),
    "xml":     body_xml("restart", service="svc_payment", timeout=30),
    "custom":  None,   # provided via --body
}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Build MSMQ user_message.bin with custom body")
    ap.add_argument("--dest",     default="OS:a04bm02\\q",     help="Destination queue path")
    ap.add_argument("--label",    default="mqsender label",    help="Message label")
    ap.add_argument("--body",     default=None,                help="Raw body string")
    ap.add_argument("--format",   choices=["plain","json","xml"], default="plain",
                    help="Body format (default: plain)")
    ap.add_argument("--action",   default="run",               help="Action name for json/xml")
    ap.add_argument("--priority", type=int, default=3,
                    help="Priority 0-7 (default 3 = medium)")
    ap.add_argument("--out",      default=None,                help="Output file path")
    ap.add_argument("--demo",     action="store_true",
                    help="Print demo outputs for all formats without writing files")
    args = ap.parse_args()

    if args.demo:
        print("=== Body format demos ===")
        print(f"plain : {body_plain('restart service svc_payment')}")
        print(f"json  : {body_json('restart', service='svc_payment', timeout=30)}")
        print(f"xml   : {body_xml('restart', service='svc_payment', timeout=30)}")
        sys.exit(0)

    if args.body:
        body_text = args.body
    elif args.format == "json":
        body_text = body_json(args.action)
    elif args.format == "xml":
        body_text = body_xml(args.action)
    else:
        body_text = body_plain(args.action)

    build(
        dest_queue=args.dest,
        label=args.label,
        body_text=body_text,
        priority=args.priority,
        out_path=args.out,
    )
