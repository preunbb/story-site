"""Convert image files (PNG, WEBP, etc.) to JPG.

Examples:
    # Convert one file (output defaults to same path with .jpg extension):
    python convert_to_jpg.py Generated_image3.png

    # Convert to a specific output path:
    python convert_to_jpg.py input.png -o output.jpg

    # Convert many files at once:
    python convert_to_jpg.py assets/covers/*.png

    # Tweak quality (default 92) or cap longest edge:
    python convert_to_jpg.py input.png --quality 88 --max-dim 2000

    # Delete the source file(s) after a successful conversion:
    python convert_to_jpg.py input.png --replace

Run with the project's existing Pillow venv:
    .venv-crop/bin/python3 scripts/convert_to_jpg.py <args>
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image


def convert(
    src: Path,
    dst: Path | None = None,
    quality: int = 92,
    max_dim: int | None = None,
    background: tuple[int, int, int] = (255, 255, 255),
    replace: bool = False,
) -> Path:
    if not src.exists():
        raise FileNotFoundError(src)

    if dst is None:
        dst = src.with_suffix(".jpg")

    if dst.resolve() == src.resolve():
        # If user asked to overwrite the source with the same name, write to a temp first.
        tmp = dst.with_suffix(".jpg.tmp")
    else:
        tmp = dst

    with Image.open(src) as img:
        # Flatten transparency onto a solid background — JPEG has no alpha channel.
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            rgba = img.convert("RGBA")
            bg = Image.new("RGB", rgba.size, background)
            bg.paste(rgba, mask=rgba.split()[-1])
            out = bg
        else:
            out = img.convert("RGB")

        if max_dim:
            w, h = out.size
            longest = max(w, h)
            if longest > max_dim:
                scale = max_dim / longest
                out = out.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

        tmp.parent.mkdir(parents=True, exist_ok=True)
        out.save(tmp, format="JPEG", quality=quality, optimize=True, progressive=True)

    if tmp != dst:
        tmp.replace(dst)

    if replace and src.resolve() != dst.resolve():
        try:
            src.unlink()
        except OSError as exc:  # pragma: no cover - best-effort cleanup
            print(f"warning: failed to delete {src}: {exc}", file=sys.stderr)

    return dst


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert image files to JPG.")
    parser.add_argument("inputs", nargs="+", help="One or more source image paths.")
    parser.add_argument(
        "-o", "--output",
        help="Output path (only valid with a single input). Defaults to <input>.jpg.",
    )
    parser.add_argument("--quality", type=int, default=92, help="JPEG quality 1-100 (default 92).")
    parser.add_argument(
        "--max-dim", type=int, default=None,
        help="Cap the longest image edge to this many pixels (preserves aspect ratio).",
    )
    parser.add_argument(
        "--bg", default="255,255,255",
        help="RGB background to flatten transparency onto, e.g. '0,0,0' (default white).",
    )
    parser.add_argument(
        "--replace", action="store_true",
        help="Delete the source file after a successful conversion (when source != output).",
    )
    args = parser.parse_args()

    if args.output and len(args.inputs) != 1:
        parser.error("--output requires exactly one input path.")

    try:
        bg = tuple(int(c.strip()) for c in args.bg.split(","))
        if len(bg) != 3 or not all(0 <= c <= 255 for c in bg):
            raise ValueError
    except ValueError:
        parser.error("--bg must be three comma-separated 0-255 integers (e.g. 255,255,255).")

    failures = 0
    for inp in args.inputs:
        src = Path(inp)
        dst = Path(args.output) if args.output else None
        try:
            out = convert(
                src=src,
                dst=dst,
                quality=args.quality,
                max_dim=args.max_dim,
                background=bg,
                replace=args.replace,
            )
            size = out.stat().st_size
            print(f"[ok]   {src} -> {out} ({size / 1024:.1f} KB)")
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"[fail] {src}: {exc}", file=sys.stderr)

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
