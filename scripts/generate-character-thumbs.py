#!/usr/bin/env python3
"""Generate WebP thumbnails for cast / brand portraits used on the site.

Reads profile picture paths from data/characters.js, writes:
  assets/characters/foo.png  -> assets/characters/thumbs/foo.webp
  assets/brands/bar.png      -> assets/brands/thumbs/bar.webp

Thumbs are max THUMB_PX on the long edge (default 160) for graph + cast grid.
Full-resolution originals stay untouched for lightbox / zoom.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CHARACTERS_JS = ROOT / "data" / "characters.js"
THUMB_PX = 160
WEBP_QUALITY = 78

PATH_RE = re.compile(
    r'["\']((?:assets/characters|assets/brands)/[^"\']+\.(?:png|jpe?g|webp|gif))["\']',
    re.I,
)


def collect_portrait_paths() -> list[Path]:
    text = CHARACTERS_JS.read_text(encoding="utf-8")
    seen: set[str] = set()
    out: list[Path] = []
    for m in PATH_RE.finditer(text):
        rel = m.group(1).replace("\\", "/")
        if rel in seen:
            continue
        seen.add(rel)
        out.append(ROOT / rel)
    return out


def thumb_path_for(src: Path) -> Path:
    # assets/characters/foo.png -> assets/characters/thumbs/foo.webp
    return src.parent / "thumbs" / f"{src.stem}.webp"


def make_thumb(src: Path, dest: Path, size: int, quality: int) -> tuple[str, int, int]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = im.convert("RGBA") if im.mode in ("P", "RGBA", "LA") else im.convert("RGB")
        im.thumbnail((size, size), Image.Resampling.LANCZOS)
        save_kwargs = {"quality": quality, "method": 6}
        if im.mode == "RGBA":
            im.save(dest, "WEBP", **save_kwargs)
        else:
            im.save(dest, "WEBP", **save_kwargs)
        return dest.name, im.width, im.height


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--size", type=int, default=THUMB_PX)
    ap.add_argument("--quality", type=int, default=WEBP_QUALITY)
    ap.add_argument("--force", action="store_true", help="Rebuild even if thumb is newer")
    args = ap.parse_args()

    paths = collect_portrait_paths()
    if not paths:
        print("No portrait paths found in data/characters.js", file=sys.stderr)
        return 1

    made = 0
    skipped = 0
    missing = 0
    total_in = 0
    total_out = 0

    for src in paths:
        if not src.is_file():
            print(f"MISSING {src.relative_to(ROOT)}")
            missing += 1
            continue
        dest = thumb_path_for(src)
        src_mtime = src.stat().st_mtime
        if (
            not args.force
            and dest.is_file()
            and dest.stat().st_mtime >= src_mtime
        ):
            skipped += 1
            total_in += src.stat().st_size
            total_out += dest.stat().st_size
            continue
        name, w, h = make_thumb(src, dest, args.size, args.quality)
        in_b = src.stat().st_size
        out_b = dest.stat().st_size
        total_in += in_b
        total_out += out_b
        made += 1
        print(
            f"OK {src.relative_to(ROOT)} -> {dest.relative_to(ROOT)} "
            f"({w}x{h}, {in_b // 1024}KB -> {out_b // 1024}KB)"
        )

    print(
        f"\nDone: {made} written, {skipped} up-to-date, {missing} missing. "
        f"Bytes {total_in / 1024 / 1024:.1f}MB -> {total_out / 1024 / 1024:.2f}MB"
    )
    return 0 if missing == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
