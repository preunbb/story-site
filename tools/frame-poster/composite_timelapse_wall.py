#!/usr/bin/env python3
"""Composite six framed timelapse posters onto a waiting-room wall."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from frame_poster import frame_poster

PHASES = [
    "00_healthy.png",
    "01_bruised_v3.png",
    "02_damaged.png",
    "03_emaciated_v2.png",
    "04_still_barely_alive.png",
    "05_ruptured.png",
]

# Center (x, y) and scale for 1536x1024 office bg v2.
# Larger frames; lower row extends behind seated figures (foreground cutout covers).
GRID = [
    (384, 165, 0.32),  # 0 top-left
    (768, 165, 0.32),  # 1 top-center
    (1152, 165, 0.32),  # 2 top-right
    (384, 445, 0.32),  # 3 bottom-left
    (768, 445, 0.32),  # 4 bottom-center
    (1152, 445, 0.32),  # 5 bottom-right
]

# Extra occlusion for raised chins / hair not always caught by rembg (cx, cy, rx, ry).
HEAD_PATCHES = [
    (290, 360, 130, 175),  # left man
    (1245, 360, 130, 175),  # right man
]
SHADOW_OFFSET = (14, 18)
SHADOW_BLUR = 18
SHADOW_ALPHA = 140
FOREGROUND_DILATE = 6
FOREGROUND_ALPHA_FLOOR = 96


def paste_centered(base: Image.Image, overlay: Image.Image, cx: int, cy: int) -> None:
    x = cx - overlay.width // 2
    y = cy - overlay.height // 2
    base.paste(overlay, (x, y), overlay)


def make_drop_shadow(framed: Image.Image) -> Image.Image:
    """Soft wall shadow cast down-right from a framed poster."""
    alpha = framed.split()[-1]
    shadow = Image.new("RGBA", framed.size, (0, 0, 0, 0))
    shadow.putalpha(alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(SHADOW_BLUR))

    px = shadow.load()
    w, h = shadow.size
    for y in range(h):
        for x in range(w):
            _, _, _, a = px[x, y]
            if a:
                px[x, y] = (0, 0, 0, min(255, int(a * SHADOW_ALPHA / 255)))

    canvas = Image.new("RGBA", framed.size, (0, 0, 0, 0))
    canvas.paste(shadow, SHADOW_OFFSET, shadow)
    return canvas


def dilate_alpha(image: Image.Image, radius: int) -> Image.Image:
    if radius <= 0:
        return image
    alpha = image.split()[-1]
    alpha = alpha.filter(ImageFilter.MaxFilter(radius * 2 + 1))
    out = image.copy()
    out.putalpha(alpha)
    return out


def load_foreground(foreground_path: Path | None, phases_dir: Path) -> Image.Image | None:
    if foreground_path and foreground_path.is_file():
        return Image.open(foreground_path).convert("RGBA")

    default = phases_dir / "_foreground_cutout_v1.png"
    if default.is_file():
        return Image.open(default).convert("RGBA")
    return None


def composite_wall(
    office_bg: Path,
    frame_path: Path,
    phases_dir: Path,
    output_path: Path,
    *,
    framed_cache_dir: Path | None = None,
    foreground_path: Path | None = None,
    grid: list[tuple[int, int, float]] | None = None,
) -> Path:
    cache = framed_cache_dir or phases_dir / "_framed_cache"
    cache.mkdir(parents=True, exist_ok=True)

    base = Image.open(office_bg).convert("RGBA")
    placements = grid or GRID

    for i, name in enumerate(PHASES):
        poster = phases_dir / name
        framed_out = cache / f"framed_{Path(name).stem}.png"
        if not framed_out.exists():
            frame_poster(frame_path, poster, framed_out)

        framed = Image.open(framed_out).convert("RGBA")
        cx, cy, scale = placements[i]
        if scale != 1.0:
            nw = max(1, int(framed.width * scale))
            nh = max(1, int(framed.height * scale))
            framed = framed.resize((nw, nh), Image.LANCZOS)

        shadow = make_drop_shadow(framed)
        paste_centered(base, shadow, cx + SHADOW_OFFSET[0] // 2, cy + SHADOW_OFFSET[1] // 2)
        paste_centered(base, framed, cx, cy)

    foreground = load_foreground(foreground_path, phases_dir)
    if foreground:
        apply_foreground_occlusion(base, Image.open(office_bg).convert("RGBA"), foreground)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(output_path, quality=95)
    return output_path


def apply_foreground_occlusion(
    composed: Image.Image,
    office_bg: Image.Image,
    foreground: Image.Image,
) -> None:
    """Paste original office pixels wherever the cutout mask is opaque."""
    if foreground.size != composed.size:
        foreground = foreground.resize(composed.size, Image.LANCZOS)
    foreground = dilate_alpha(foreground, FOREGROUND_DILATE)

    src = office_bg.convert("RGBA")
    mask = foreground.split()[-1].point(lambda a: 255 if a >= FOREGROUND_ALPHA_FLOOR else 0)
    draw = ImageDraw.Draw(mask)
    for cx, cy, rx, ry in HEAD_PATCHES:
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    composed.paste(src, (0, 0), mask)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("office_bg", type=Path)
    parser.add_argument("frame", type=Path)
    parser.add_argument("phases_dir", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    parser.add_argument(
        "--foreground",
        type=Path,
        help="RGBA cutout pasted in front of frames (default: phases_dir/_foreground_cutout_v1.png)",
    )
    args = parser.parse_args(argv)

    for p in (args.office_bg, args.frame, args.phases_dir):
        if not p.exists():
            print(f"Missing path: {p}", file=sys.stderr)
            return 1

    out = composite_wall(
        args.office_bg,
        args.frame,
        args.phases_dir,
        args.output,
        foreground_path=args.foreground,
    )
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
