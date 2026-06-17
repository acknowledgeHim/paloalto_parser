#!/usr/bin/env python3
"""
MSMQ binary packet auditor.
Usage: python3 audit_msmq.py
"""
import struct, uuid, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

FILES = {
    "establish_connection.bin": "Session CONNECT — first packet sent",
    "connection_parameters.bin": "Session parameters — second packet sent",
    "user_message.bin": "Application message — third packet sent",
}

SECTION_FLAGS = {
    0x0002: "AUTHENTICATED",
    0x0004: "JOURNAL",
    0x0008: "DEADLETTER",
    0x0020: "CONNECTOR_TYPE_PRESENT",
    0x0040: "USE_TRACING",
    0x0080: "USE_ENCRYPTION",
    0x0800: "ACKNOWLEDGMENT_REQUESTED",
}


def read_guid(data, offset):
    return uuid.UUID(bytes_le=data[offset:offset + 16])


def read_utf16(data, offset, byte_len):
    return data[offset:offset + byte_len].decode("utf-16-le").rstrip("\x00")


def parse_baseheader(data):
    version  = data[0]
    reserved = data[1]
    flags    = struct.unpack_from("<H", data, 2)[0]
    sig      = data[4:8]
    pktsize  = struct.unpack_from("<I", data, 8)[0]
    ttr      = struct.unpack_from("<i", data, 12)[0]
    return {
        "version": version,
        "reserved": reserved,
        "flags": flags,
        "signature": sig,
        "packet_size": pktsize,
        "time_to_reach": ttr,
    }


def parse_establish(data):
    bh          = parse_baseheader(data)
    sess_flags  = struct.unpack_from("<I", data, 0x10)[0]
    src_guid    = read_guid(data, 0x14)
    dst_guid    = read_guid(data, 0x24)
    nonce       = struct.unpack_from("<I", data, 0x34)[0]
    subtype     = struct.unpack_from("<I", data, 0x38)[0]
    pad_bytes   = data[0x3C:]
    pad_unique  = set(pad_bytes)
    return {**bh,
            "session_flags": sess_flags,
            "src_qm_guid":   src_guid,
            "dst_qm_guid":   dst_guid,
            "nonce":         nonce,
            "subtype":       subtype,
            "padding_size":  len(pad_bytes),
            "padding_fill":  list(pad_unique)}


def parse_params(data):
    bh       = parse_baseheader(data)
    pflags   = struct.unpack_from("<I", data, 0x10)[0]
    mtu      = struct.unpack_from("<I", data, 0x14)[0]
    timeout  = struct.unpack_from("<I", data, 0x18)[0]
    capflags = struct.unpack_from("<I", data, 0x1C)[0]
    return {**bh,
            "param_flags":   pflags,
            "mtu_bytes":     mtu,
            "timeout_ms":    timeout,
            "cap_flags":     capflags}


def parse_message(data):
    bh           = parse_baseheader(data)
    src_guid     = read_guid(data, 0x10)
    ttbr         = struct.unpack_from("<i", data, 0x20)[0]
    sent_time    = struct.unpack_from("<I", data, 0x24)[0]
    msg_id       = struct.unpack_from("<I", data, 0x28)[0]
    uh_flags     = struct.unpack_from("<I", data, 0x2C)[0]
    inner_sig    = data[0x34:0x38]
    sec_flags    = struct.unpack_from("<I", data, 0x38)[0]
    path_len     = struct.unpack_from("<H", data, 0x40)[0]
    dest_queue   = read_utf16(data, 0x42, path_len)
    # SID (starts at 0x6C)
    sid_off      = 0x6C
    sid_rev      = data[sid_off]
    sid_cnt      = data[sid_off + 1]
    sid_auth     = int.from_bytes(data[sid_off + 2:sid_off + 8], "big")
    sid_subs     = [struct.unpack_from("<I", data, sid_off + 8 + i * 4)[0]
                    for i in range(sid_cnt)]
    sid_str      = f"S-{sid_rev}-{sid_auth}-" + "-".join(str(s) for s in sid_subs)
    msg_class    = struct.unpack_from("<H", data, 0x88)[0]
    priority     = data[0x89]
    body_len     = struct.unpack_from("<I", data, 0xA8)[0]
    # Label: UTF-16LE starting at 0xC0, null-terminated
    label_raw    = data[0xC0:]
    lend         = next(i for i in range(0, len(label_raw) - 1, 2)
                        if label_raw[i] == 0 and label_raw[i + 1] == 0)
    label        = label_raw[:lend].decode("utf-16-le")
    body_start   = 0xC0 + lend + 2
    body         = data[body_start:body_start + body_len].decode("utf-16-le",
                                                                   errors="replace")
    sec_flag_names = [name for bit, name in SECTION_FLAGS.items() if sec_flags & bit]
    return {**bh,
            "src_qm_guid":    src_guid,
            "ttbr":           ttbr,
            "sent_time":      sent_time,
            "msg_id":         msg_id,
            "uh_flags":       uh_flags,
            "inner_sig":      inner_sig,
            "sec_flags":      sec_flags,
            "sec_flag_names": sec_flag_names,
            "dest_queue":     dest_queue,
            "sid":            sid_str,
            "rid":            sid_subs[-1] if sid_subs else 0,
            "msg_class":      msg_class,
            "priority":       priority,
            "body_len":       body_len,
            "label":          label,
            "body":           body,
            "body_start_off": body_start}


def print_header(title, purpose):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"  {purpose}")
    print(f"{'='*70}")


def dump_establish(d):
    print_header("establish_connection.bin", FILES["establish_connection.bin"])
    print(f"  BaseHeader:")
    print(f"    Version          : 0x{d['version']:02X}")
    print(f"    Reserved         : 0x{d['reserved']:02X}  (0xC0 = connection-type, requires ACK)")
    print(f"    Flags            : 0x{d['flags']:04X}  (session connect packet type)")
    print(f"    Signature        : {d['signature']}")
    print(f"    PacketSize       : {d['packet_size']} bytes")
    print(f"    TimeToReach      : {d['time_to_reach']}  (unlimited)")
    print(f"  Session control:")
    print(f"    Session Flags    : 0x{d['session_flags']:08X}")
    print(f"    Source QM GUID   : {{{str(d['src_qm_guid']).upper()}}}")
    print(f"    Dest QM GUID     : {{{str(d['dst_qm_guid']).upper()}}}")
    print(f"    Nonce/Sequence   : 0x{d['nonce']:08X} = {d['nonce']}")
    print(f"    Sub-type flags   : 0x{d['subtype']:08X}")
    print(f"  Padding:")
    print(f"    Size             : {d['padding_size']} bytes (0x{d['padding_size']:X})")
    print(f"    Fill value       : {[hex(x) for x in d['padding_fill']]}  "
          f"(0x5A = reserved cert/auth slot — NO CERTIFICATE PRESENT)")


def dump_params(d):
    print_header("connection_parameters.bin", FILES["connection_parameters.bin"])
    print(f"  BaseHeader:")
    print(f"    Version          : 0x{d['version']:02X}")
    print(f"    Reserved         : 0x{d['reserved']:02X}  (connection-type)")
    print(f"    Flags            : 0x{d['flags']:04X}")
    print(f"    Signature        : {d['signature']}")
    print(f"    PacketSize       : {d['packet_size']} bytes")
    print(f"  Negotiated parameters:")
    print(f"    Param Flags      : 0x{d['param_flags']:08X}")
    print(f"    MTU / Window     : {d['mtu_bytes']} bytes  "
          f"(= 1500 Ethernet - 4 byte MSMQ header)")
    print(f"    Timeout          : {d['timeout_ms']} ms  "
          f"= {d['timeout_ms']//1000} seconds  "
          f"= {d['timeout_ms']//60000} minutes")
    print(f"    Capability Flags : 0x{d['cap_flags']:08X}  (bit 22 = MSMQ2 routing)")


def dump_message(d):
    print_header("user_message.bin", FILES["user_message.bin"])
    print(f"  BaseHeader:")
    print(f"    Version          : 0x{d['version']:02X}")
    print(f"    Reserved         : 0x{d['reserved']:02X}  (0x00 = standard message)")
    print(f"    Flags            : 0x{d['flags']:04X}  (user message type)")
    print(f"    Signature        : {d['signature']}")
    print(f"    PacketSize       : {d['packet_size']} bytes")
    print(f"  UserHeader:")
    print(f"    Source QM GUID   : {{{str(d['src_qm_guid']).upper()}}}")
    print(f"    TimeToBeReceived : {d['ttbr']}  "
          f"{'(not set)' if d['ttbr'] == 0 else ''}")
    print(f"    SentTime         : {d['sent_time']}  "
          f"{'(not set — crafted packet)' if d['sent_time'] == 0 else ''}")
    print(f"    MessageID        : {d['msg_id']}  "
          f"{'(not set)' if d['msg_id'] == 0 else ''}")
    print(f"  Inner section:")
    print(f"    Inner Signature  : {d['inner_sig']}")
    print(f"    Section Flags    : 0x{d['sec_flags']:08X}")
    for name in d['sec_flag_names']:
        print(f"      [{name}]")
    print(f"  Routing:")
    print(f"    Destination      : \"{d['dest_queue']}\"")
    print(f"      -> Format: DirectOS (bypasses AD, connects to host directly)")
    host = d['dest_queue'].split("\\")[0].replace("OS:", "")
    queue = d['dest_queue'].split("\\")[-1]
    print(f"      -> Host  : {host}")
    print(f"      -> Queue : {queue}")
    print(f"  Sender identity:")
    print(f"    SID              : {d['sid']}")
    print(f"    RID              : {d['rid']}  (0x{d['rid']:X})  "
          f"{'(first domain user)' if d['rid'] == 1000 else ''}")
    print(f"  Message properties:")
    print(f"    Class            : 0x{d['msg_class']:04X}  "
          f"{'(ANOMALY: non-standard, should be 0x0000)' if d['msg_class'] != 0 else '(normal)'}")
    print(f"    Priority         : {d['priority']}  "
          f"{'(ANOMALY: max valid is 7)' if d['priority'] > 7 else ''}")
    print(f"    Label            : \"{d['label']}\"")
    print(f"    Body offset      : 0x{d['body_start_off']:02X}")
    print(f"    Body length      : {d['body_len']} bytes  "
          f"= {d['body_len']//2} UTF-16LE chars")
    print(f"    Body             : \"{d['body']}\"")


if __name__ == "__main__":
    ec = parse_establish(open(os.path.join(SCRIPT_DIR, "establish_connection.bin"), "rb").read())
    cp = parse_params(open(os.path.join(SCRIPT_DIR, "connection_parameters.bin"), "rb").read())
    um = parse_message(open(os.path.join(SCRIPT_DIR, "user_message.bin"), "rb").read())

    dump_establish(ec)
    dump_params(cp)
    dump_message(um)

    print(f"\n{'='*70}")
    print("  SESSION LINKAGE CHECK")
    print(f"{'='*70}")
    match = str(ec["src_qm_guid"]) == str(um["src_qm_guid"])
    print(f"  Source QM GUID matches establish↔message : {'YES — same session' if match else 'NO — different sessions'}")
    print()
