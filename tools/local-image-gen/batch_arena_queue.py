#!/usr/bin/env python3
"""
Serial HQ local generations from tools/local-image-gen/queue/*.txt

Each spec file: line1 positive, line2 negative, line3 basename, line4 caption (ignored here).
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
TOOL = Path(__file__).resolve().parent
GEN = TOOL / "generate_cli.py"
VPY = TOOL / ".venv" / "bin" / "python"

# SDXL example on 16 GB Mac: STEPS="28" W = H = "896" + run_cli_sdxl.sh instead of bare python below.
STEPS = "40"
W = H = "512"

JOBS: list[tuple[str, Path]] = [
    ("arena1.txt", REPO / "assets" / "scenes" / "arena_1"),
    ("arena2.txt", REPO / "assets" / "scenes" / "arena_2_sofias_choice"),
    ("arena3.txt", REPO / "assets" / "scenes" / "arena_3"),
    ("arena4.txt", REPO / "assets" / "scenes" / "arena_4"),
    ("arena5a.txt", REPO / "assets" / "scenes" / "arena_5"),
    ("arena5b.txt", REPO / "assets" / "scenes" / "arena_5"),
]


def main() -> int:
    if not GEN.is_file():
        print("Missing generate_cli.py", file=sys.stderr)
        return 1
    py = str(VPY) if VPY.is_file() else sys.executable
    queue = TOOL / "queue"
    for spec_name, out_dir in JOBS:
        spec = queue / spec_name
        if not spec.is_file():
            print(f"Skip missing spec {spec}", flush=True)
            continue
        raw = spec.read_text(encoding="utf-8").strip().splitlines()
        if len(raw) < 3:
            print(f"Bad spec {spec}", file=sys.stderr)
            return 1
        pos, neg, base = raw[0].strip(), raw[1].strip(), raw[2].strip()
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / base
        print(f"\n=== {spec_name} -> {out_path} ===", flush=True)
        subprocess.run(
            [
                py,
                str(GEN),
                "-p",
                pos,
                "-n",
                neg,
                "--steps",
                STEPS,
                "--width",
                W,
                "--height",
                H,
                "--guidance",
                "7.5",
                "-o",
                str(out_path),
            ],
            check=True,
            cwd=str(TOOL),
        )
    print("\nAll batch jobs finished.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
