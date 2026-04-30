"""Extend an image's canvas to meet minimum dimensions WITHOUT scaling or cropping
the original artwork.

The original image is pasted unchanged into the middle of a larger canvas.
The new top/bottom (and left/right, if needed) regions are filled by stretching
and blurring the corresponding edge strips of the original — this works well
when those edges are visually uniform (e.g. dark backgrounds, gradients, plain
floor/sky), which is typical for the dark gradient borders on book covers.

Examples:
    python extend_canvas.py cover.jpg cover_amazon.jpg
    python extend_canvas.py cover.jpg cover_amazon.jpg --min-h 1000 --min-w 625
    python extend_canvas.py cover.jpg cover_amazon.jpg --top-bias 0.6
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageFilter


def stretch_strip_vertical(strip: Image.Image, new_height: int, blur: float) -> Image.Image:
    """Stretch a horizontal strip vertically to `new_height`, then blur it."""
    if new_height <= 0:
        return Image.new("RGB", (strip.width, 0))
    stretched = strip.resize((strip.width, new_height), Image.LANCZOS)
    if blur > 0:
        stretched = stretched.filter(ImageFilter.GaussianBlur(radius=blur))
    return stretched


def stretch_strip_horizontal(strip: Image.Image, new_width: int, blur: float) -> Image.Image:
    if new_width <= 0:
        return Image.new("RGB", (0, strip.height))
    stretched = strip.resize((new_width, strip.height), Image.LANCZOS)
    if blur > 0:
        stretched = stretched.filter(ImageFilter.GaussianBlur(radius=blur))
    return stretched


def extend(
    src: Path,
    dst: Path,
    min_w: int,
    min_h: int,
    *,
    top_bias: float = 0.5,
    left_bias: float = 0.5,
    edge_sample: int = 32,
    seam_feather: int = 18,
    blur: float = 10.0,
    quality: int = 92,
) -> tuple[int, int, int, int]:
    """Extend `src` onto a canvas at least min_w x min_h. Returns (final_w, final_h, paste_x, paste_y)."""
    img = Image.open(src).convert("RGB")
    w, h = img.size

    target_w = max(w, min_w)
    target_h = max(h, min_h)

    if (target_w, target_h) == (w, h):
        img.save(dst, format="JPEG", quality=quality, optimize=True, progressive=True)
        return (w, h, 0, 0)

    extra_w = target_w - w
    extra_h = target_h - h

    extra_left = int(round(extra_w * left_bias))
    extra_right = extra_w - extra_left
    extra_top = int(round(extra_h * top_bias))
    extra_bottom = extra_h - extra_top

    canvas = Image.new("RGB", (target_w, target_h), (0, 0, 0))

    # 1) Vertical extensions (top & bottom).
    if extra_top > 0:
        sample_h = min(edge_sample, h)
        top_strip = img.crop((0, 0, w, sample_h))
        # Pad the stretch a bit so we can crop the seam-side more cleanly.
        ext_top = stretch_strip_vertical(top_strip, extra_top + sample_h, blur=blur)
        canvas.paste(ext_top.crop((0, 0, w, extra_top)), (extra_left, 0))

    if extra_bottom > 0:
        sample_h = min(edge_sample, h)
        bottom_strip = img.crop((0, h - sample_h, w, h))
        ext_bottom = stretch_strip_vertical(bottom_strip, extra_bottom + sample_h, blur=blur)
        canvas.paste(
            ext_bottom.crop((0, sample_h, w, sample_h + extra_bottom)),
            (extra_left, extra_top + h),
        )

    # 2) Horizontal extensions (left & right) — only needed if width < min_w.
    if extra_left > 0:
        sample_w = min(edge_sample, w)
        left_strip = img.crop((0, 0, sample_w, h))
        ext_left = stretch_strip_horizontal(left_strip, extra_left + sample_w, blur=blur)
        canvas.paste(ext_left.crop((0, 0, extra_left, h)), (0, extra_top))

    if extra_right > 0:
        sample_w = min(edge_sample, w)
        right_strip = img.crop((w - sample_w, 0, w, h))
        ext_right = stretch_strip_horizontal(right_strip, extra_right + sample_w, blur=blur)
        canvas.paste(
            ext_right.crop((sample_w, 0, sample_w + extra_right, h)),
            (extra_left + w, extra_top),
        )

    # 3) Fill corners with the four nearest corner colors (small areas, low priority).
    if extra_left > 0 and extra_top > 0:
        canvas.paste(img.getpixel((0, 0)), (0, 0, extra_left, extra_top))
    if extra_right > 0 and extra_top > 0:
        canvas.paste(img.getpixel((w - 1, 0)), (extra_left + w, 0, target_w, extra_top))
    if extra_left > 0 and extra_bottom > 0:
        canvas.paste(img.getpixel((0, h - 1)), (0, extra_top + h, extra_left, target_h))
    if extra_right > 0 and extra_bottom > 0:
        canvas.paste(
            img.getpixel((w - 1, h - 1)),
            (extra_left + w, extra_top + h, target_w, target_h),
        )

    # 4) Paste the original unchanged in the middle.
    canvas.paste(img, (extra_left, extra_top))

    # 5) Soften the seams with a feathered overlay so the edge doesn't show as a hard line.
    if seam_feather > 0:
        from PIL import ImageDraw

        mask = Image.new("L", canvas.size, 0)
        mdraw = ImageDraw.Draw(mask)
        # Draw a rectangle slightly inside the original-image region; everything outside
        # gradually becomes the extension. We blur the mask to feather it.
        mdraw.rectangle(
            (
                extra_left + seam_feather,
                extra_top + seam_feather,
                extra_left + w - seam_feather,
                extra_top + h - seam_feather,
            ),
            fill=255,
        )
        mask = mask.filter(ImageFilter.GaussianBlur(radius=seam_feather))

        full_orig_layer = Image.new("RGB", canvas.size, (0, 0, 0))
        full_orig_layer.paste(img, (extra_left, extra_top))
        canvas = Image.composite(full_orig_layer, canvas, mask)

    canvas.save(dst, format="JPEG", quality=quality, optimize=True, progressive=True)
    return (target_w, target_h, extra_left, extra_top)


def main() -> int:
    parser = argparse.ArgumentParser(description="Extend image canvas to minimum dimensions.")
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--min-w", type=int, default=625, help="Minimum width (default 625).")
    parser.add_argument("--min-h", type=int, default=1000, help="Minimum height (default 1000).")
    parser.add_argument(
        "--top-bias", type=float, default=0.5,
        help="Fraction of vertical extension placed above the original (0=all below, 1=all above).",
    )
    parser.add_argument(
        "--left-bias", type=float, default=0.5,
        help="Fraction of horizontal extension placed to the left of the original.",
    )
    parser.add_argument("--edge-sample", type=int, default=32,
                        help="How many edge pixels to sample for the stretched fill (default 32).")
    parser.add_argument("--blur", type=float, default=10.0,
                        help="Gaussian blur radius applied to the stretched extension (default 10).")
    parser.add_argument("--seam-feather", type=int, default=18,
                        help="Pixels of feathered blending around the original-edge seam (default 18, 0 disables).")
    parser.add_argument("--quality", type=int, default=92)
    args = parser.parse_args()

    final_w, final_h, px, py = extend(
        Path(args.input),
        Path(args.output),
        min_w=args.min_w,
        min_h=args.min_h,
        top_bias=args.top_bias,
        left_bias=args.left_bias,
        edge_sample=args.edge_sample,
        seam_feather=args.seam_feather,
        blur=args.blur,
        quality=args.quality,
    )
    print(f"[ok] {args.input} -> {args.output}  size={final_w}x{final_h}  original-at=({px},{py})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
