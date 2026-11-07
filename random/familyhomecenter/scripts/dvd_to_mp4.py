#!/usr/bin/env python3
"""
📀 DVD → .mp4 (H.264 + AAC), so it plays in the browser / 🎬 Movies.

For unprotected DVDs: home camcorder discs, DVDs you burned yourself, or a copied VIDEO_TS folder.
Store-bought movie DVDs are copy-protected (CSS); this script doesn't get around that, and says so.

    python3 scripts/dvd_to_mp4.py /media/pi/MY_DVD                 # the disc (or its VIDEO_TS folder)
    python3 scripts/dvd_to_mp4.py /media/pi/MY_DVD --list          # just show the titles on it
    python3 scripts/dvd_to_mp4.py /media/pi/MY_DVD --all -o /mnt/media/movies/DVDs
    python3 scripts/dvd_to_mp4.py ~/VIDEO_TS --title 2 --name "Wedding 2003"

An .iso file: mount it first —  sudo mount -o loop,ro disc.iso /mnt/iso  — then point at /mnt/iso.

- Only reads the DVD. Never overwrites: if "Name.mp4" exists, it writes "Name (2).mp4".
- Written as a hidden .part file and renamed when done, so a half-made file never shows.
- Picks the main title (the longest) unless --title / --all. Every sound track is kept (AAC);
  interlaced video is smoothed; 16:9 discs stay 16:9. DVD subtitles are pictures and can't go in
  an .mp4, so they're left out.
- Needs ffmpeg + ffprobe:  sudo apt install -y ffmpeg
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

VOB = re.compile(r"^VTS_(\d\d)_([1-9])\.VOB$", re.I)


def find_video_ts(src: Path) -> Path:
    """The VIDEO_TS folder: the path itself, or inside it (a mounted disc)."""
    if src.is_dir() and any(VOB.match(p.name) for p in src.iterdir()):
        return src
    for name in ("VIDEO_TS", "video_ts"):
        if (src / name).is_dir():
            return src / name
    sys.exit(f"❌ No VIDEO_TS folder in {src}. Point at the mounted disc or its VIDEO_TS folder "
             f"(an .iso: sudo mount -o loop,ro disc.iso /mnt/iso).")


def ffprobe_duration(path: str, ffprobe: str) -> float | None:
    try:
        out = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
                             capture_output=True, text=True, timeout=300)
        return float(json.loads(out.stdout)["format"]["duration"])
    except (subprocess.SubprocessError, KeyError, ValueError, json.JSONDecodeError):
        return None


def titles(video_ts: Path, ffprobe: str) -> list[dict]:
    """Each title set (VTS_01, VTS_02…): its VOB parts in order, size and length."""
    sets: dict[int, list[Path]] = {}
    for p in video_ts.iterdir():
        m = VOB.match(p.name)
        if m:  # VTS_xx_0.VOB is the menu — never matched (part numbers start at 1)
            sets.setdefault(int(m.group(1)), []).append(p)
    out = []
    for n, parts in sorted(sets.items()):
        parts.sort(key=lambda p: int(VOB.match(p.name).group(2)))
        size = sum(p.stat().st_size for p in parts)
        src = "concat:" + "|".join(str(p) for p in parts)
        # A title is one recording cut into ≤1 GB files: its length is the parts' lengths added up.
        lengths = [ffprobe_duration(str(p), ffprobe) for p in parts]
        duration = sum(lengths) if all(lengths) else ffprobe_duration(src, ffprobe)
        out.append({"n": n, "parts": parts, "size": size, "src": src, "duration": duration})
    return out


def check_readable(t: dict) -> None:
    """A copy-protected disc refuses to be read (or reads as scrambled) without decryption."""
    first = t["parts"][0]
    sectors = max(1, first.stat().st_size // 2048)
    scrambled = checked = 0
    try:
        with open(first, "rb") as f:
            for i in range(20):  # sample sectors through the middle of the title
                f.seek((sectors // 4 + i * max(1, sectors // 40)) % sectors * 2048)
                block = f.read(2048)
                if block[:4] != b"\x00\x00\x01\xba" or len(block) < 32:
                    continue
                pes = 14 + (block[13] & 7)  # after the pack header (and its stuffing)
                if block[pes:pes + 4] == b"\x00\x00\x01\xbb":  # a system header comes first
                    pes += 6 + int.from_bytes(block[pes + 4:pes + 6], "big")
                if block[pes:pes + 3] != b"\x00\x00\x01" or block[pes + 3] not in range(0xbd, 0xf0):
                    continue
                checked += 1
                if block[pes + 6] & 0x30:  # PES scrambling-control bits
                    scrambled += 1
    except OSError as e:
        sys.exit(f"❌ Can't read the disc ({e.strerror}). It's probably a copy-protected movie DVD — "
                 f"this script only does unprotected ones (home recordings, discs you burned).")
    if checked and scrambled * 2 > checked:
        sys.exit("❌ This DVD is copy-protected (CSS). This script only does unprotected discs "
                 "(home recordings, discs you burned).")


def free_name(folder: Path, name: str) -> Path:
    stem, ext = os.path.splitext(name)
    i = 1
    while True:
        p = folder / (name if i == 1 else f"{stem} ({i}){ext}")
        if not p.exists():
            return p
        i += 1


def fmt(sec: float | None) -> str:
    if not sec:
        return "?"
    h, m = int(sec // 3600), int(sec % 3600 // 60)
    return f"{h}:{m:02d}:{int(sec % 60):02d}"


def convert(t: dict, target: Path, ffmpeg: str, crf: int, preset: str, title: str) -> None:
    part = target.with_name(f".{target.name}.{os.getpid()}.part")
    cmd = [
        ffmpeg, "-nostdin", "-y", "-v", "error", "-progress", "pipe:1",
        # DVDs start their streams late; read further in to find every sound track.
        "-analyzeduration", "100M", "-probesize", "100M", "-fflags", "+genpts",
        "-i", t["src"],
        "-map", "0:v:0", "-map", "0:a?",
        "-vf", "yadif=deint=interlaced",
        "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-metadata", f"title={title}",
        "-movflags", "+faststart",
        "-f", "mp4", str(part),
    ]
    if shutil.which("nice"):
        cmd = ["nice", "-n", "10", *cmd]
    print(f"🎬 Title {t['n']} ({fmt(t['duration'])}) → {target}")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        for line in proc.stdout:  # type: ignore[union-attr]
            m = re.match(r"out_time_us=(\d+)", line)
            if m and t["duration"]:
                pct = min(99.9, int(m.group(1)) / 1e6 / t["duration"] * 100)
                print(f"\r   {pct:5.1f}%", end="", flush=True)
        err = proc.stderr.read()  # type: ignore[union-attr]
        if proc.wait() != 0:
            raise RuntimeError(err.strip().splitlines()[-3:] if err.strip() else f"ffmpeg exited with {proc.returncode}")
    except BaseException:
        proc.kill()
        part.unlink(missing_ok=True)  # only ever our own half-made file
        raise
    if target.exists():  # something by that name turned up meanwhile — don't replace it
        target = free_name(target.parent, target.name)
    part.rename(target)
    print(f"\r   ✅ done: {target}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Convert an unprotected DVD (or VIDEO_TS folder) to .mp4")
    ap.add_argument("source", type=Path, help="the mounted DVD, or its VIDEO_TS folder")
    ap.add_argument("-o", "--out", type=Path, default=Path.cwd(), help="folder for the .mp4 (default: here)")
    ap.add_argument("--name", help="file name (default: the disc's name)")
    ap.add_argument("--title", type=int, action="append", help="title number(s) to convert (see --list)")
    ap.add_argument("--all", action="store_true", help="every title longer than --min-minutes")
    ap.add_argument("--min-minutes", type=float, default=1.0, help="with --all, skip titles shorter than this")
    ap.add_argument("--list", action="store_true", help="only show the titles")
    ap.add_argument("--crf", type=int, default=20, help="quality: lower = better and bigger (18–23 is usual)")
    ap.add_argument("--preset", default="veryfast", help="x264 speed: ultrafast…veryslow (slower = smaller)")
    args = ap.parse_args()

    ffmpeg, ffprobe = os.environ.get("FFMPEG_PATH") or shutil.which("ffmpeg"), os.environ.get("FFPROBE_PATH") or shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        sys.exit("❌ ffmpeg isn't installed: sudo apt install -y ffmpeg")

    video_ts = find_video_ts(args.source.expanduser().resolve())
    found = titles(video_ts, ffprobe)
    if not found:
        sys.exit(f"❌ No video titles in {video_ts}")
    longest = max(found, key=lambda t: (t["duration"] or 0, t["size"]))
    print(f"📀 {video_ts}")
    for t in found:
        print(f"   title {t['n']:2d}: {fmt(t['duration']):>8}  {t['size'] / 1e9:5.2f} GB  ({len(t['parts'])} file{'s' if len(t['parts']) > 1 else ''})"
              f"{'  ← main' if t is longest else ''}")
    if args.list:
        return

    if args.title:
        pick = [t for t in found if t["n"] in args.title]
        missing = set(args.title) - {t["n"] for t in pick}
        if missing:
            sys.exit(f"❌ No title {', '.join(map(str, sorted(missing)))} on this disc (see --list)")
    elif args.all:
        pick = [t for t in found if (t["duration"] or 0) >= args.min_minutes * 60]
    else:
        pick = [longest]

    disc = video_ts.parent.name if video_ts.name.lower() == "video_ts" else video_ts.name
    base = re.sub(r'[\\/:*?"<>|]+', " ", args.name or disc.replace("_", " ").strip().title() or "DVD").strip()
    args.out.mkdir(parents=True, exist_ok=True)
    for t in pick:
        check_readable(t)
        name = f"{base}.mp4" if len(pick) == 1 else f"{base} - Title {t['n']}.mp4"
        try:
            convert(t, free_name(args.out, name), ffmpeg, args.crf, args.preset, base if len(pick) == 1 else f"{base} - Title {t['n']}")
        except KeyboardInterrupt:
            sys.exit("\n⏹ Stopped (nothing half-made was left behind).")
        except RuntimeError as e:
            print(f"\n   ❌ title {t['n']} failed: {e}")


if __name__ == "__main__":
    main()
