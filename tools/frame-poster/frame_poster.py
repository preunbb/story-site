#!/usr/bin/env python3
"""Place a poster image inside an empty picture frame."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}


def _luma(rgb: tuple[int, ...]) -> float:
    return (rgb[0] + rgb[1] + rgb[2]) / 3


def detect_inner_window(frame: Image.Image) -> tuple[int, int, int, int]:
    """Return (x0, y0, x1, y1) of the empty poster opening inside the mat."""
    rgb = frame.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    cx, cy = w // 2, h // 2

    def similar(x: int, y: int, ref: tuple[int, int, int], tol: int = 28) -> bool:
        r, g, b = px[x, y]
        return abs(r - ref[0]) <= tol and abs(g - ref[1]) <= tol and abs(b - ref[2]) <= tol

    def blocked(x: int, y: int) -> bool:
        return _luma(px[x, y]) < 120

    ref = px[cx, cy]
    stack = [(cx, cy)]
    seen = set()
    xs: list[int] = []
    ys: list[int] = []
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or x < 0 or y < 0 or x >= w or y >= h:
            continue
        if blocked(x, y) or not similar(x, y, ref):
            continue
        seen.add((x, y))
        xs.append(x)
        ys.append(y)
        stack.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    if not xs:
        raise RuntimeError("Could not detect inner poster window in frame image")

    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def detect_outer_frame(frame: Image.Image, inner: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    """Return bounding box of the physical frame (dark border), with small padding."""
    rgb = frame.convert("RGB")
    w, h = rgb.size
    px = rgb.load()

    dark = [(x, y) for y in range(h) for x in range(w) if _luma(px[x, y]) < 90]
    if not dark:
        return inner

    xs = [p[0] for p in dark]
    ys = [p[1] for p in dark]
    pad = 1
    return (
        max(0, min(xs) - pad),
        max(0, min(ys) - pad),
        min(w, max(xs) + pad + 1),
        min(h, max(ys) + pad + 1),
    )


def fit_cover(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = max(width / image.width, height / image.height)
    resized = image.resize(
        (max(1, int(image.width * scale)), max(1, int(image.height * scale))),
        Image.LANCZOS,
    )
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def frame_poster(
    frame_path: Path,
    poster_path: Path,
    output_path: Path,
    *,
    transparent_outside: bool = True,
    matte_inset: int = 0,
) -> Path:
    frame = Image.open(frame_path).convert("RGBA")
    poster = Image.open(poster_path).convert("RGB")

    inner = detect_inner_window(frame)
    x0, y0, x1, y1 = inner
    if matte_inset:
        x0 += matte_inset
        y0 += matte_inset
        x1 -= matte_inset
        y1 -= matte_inset

    inner_w, inner_h = x1 - x0, y1 - y0
    art = fit_cover(poster, inner_w, inner_h).convert("RGBA")

    out = frame.copy()
    out.paste(art, (x0, y0))

    if transparent_outside:
        outer = detect_outer_frame(frame, inner)
        ox0, oy0, ox1, oy1 = outer
        cropped = out.crop(outer)
        px = cropped.load()
        cw, ch = cropped.size
        for y in range(ch):
            for x in range(cw):
                r, g, b, a = px[x, y]
                if r > 250 and g > 250 and b > 250:
                    px[x, y] = (r, g, b, 0)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        cropped.save(output_path)
        return output_path

    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(output_path)
    return output_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("frame", type=Path, help="Empty frame PNG")
    parser.add_argument("poster", type=Path, help="Poster / artwork image")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Output path (default: framed_<poster stem>.png beside poster)",
    )
    parser.add_argument(
        "--no-transparent",
        action="store_true",
        help="Keep full canvas instead of cropping and keying white to transparent",
    )
    parser.add_argument(
        "--matte-inset",
        type=int,
        default=2,
        help="Pixels to inset art from detected inner window (default: 2)",
    )
    args = parser.parse_args(argv)

    if args.poster.suffix.lower() not in IMAGE_EXTENSIONS:
        print(f"Unsupported poster format: {args.poster}", file=sys.stderr)
        return 1
    if not args.frame.is_file() or not args.poster.is_file():
        print("Frame and poster paths must exist.", file=sys.stderr)
        return 1

    output = args.output or args.poster.with_name(f"framed_{args.poster.stem}.png")
    frame_poster(
        args.frame,
        args.poster,
        output,
        transparent_outside=not args.no_transparent,
        matte_inset=args.matte_inset,
    )
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
