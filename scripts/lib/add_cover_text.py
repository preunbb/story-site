"""Overlay a title block and author tagline onto an existing cover image.

Usage:
    python add_cover_text.py <input.jpg> <output.jpg> \
        --main-title "..." [--sub-title "..."] [--author "..."]

Dependencies: Pillow (PIL) — installed in .venv-crop.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Font candidates by style. First one that loads wins.
FONT_PATHS = {
    "title_bold": [
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        "/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf",
        "/System/Library/Fonts/Supplemental/Impact.ttf",
    ],
    "subtitle_serif": [
        "/System/Library/Fonts/Supplemental/Big Caslon.ttf",
        "/System/Library/Fonts/Supplemental/Baskerville.ttc",
        "/System/Library/Fonts/Supplemental/Charter.ttc",
    ],
    "author_italic": [
        "/System/Library/Fonts/Supplemental/Baskerville.ttc",
        "/System/Library/Fonts/Avenir.ttc",
        "/System/Library/Fonts/Supplemental/Charter.ttc",
    ],
}


def load_font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    last_err: Exception | None = None
    for path in FONT_PATHS[kind]:
        try:
            return ImageFont.truetype(path, size=size)
        except Exception as exc:  # noqa: BLE001
            last_err = exc
    raise RuntimeError(f"No font available for {kind}: {last_err}")


def measure(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def fit_font_size(
    draw: ImageDraw.ImageDraw,
    text: str,
    kind: str,
    max_width: int,
    target_size: int,
    min_size: int = 18,
) -> ImageFont.FreeTypeFont:
    """Shrink font until text fits within max_width."""
    size = target_size
    while size > min_size:
        font = load_font(kind, size)
        w, _ = measure(draw, text, font)
        if w <= max_width:
            return font
        size -= 2
    return load_font(kind, min_size)


def draw_text_with_shadow(
    canvas: Image.Image,
    text: str,
    font: ImageFont.FreeTypeFont,
    xy: tuple[int, int],
    fill: tuple[int, int, int] = (255, 255, 255),
    shadow: tuple[int, int, int, int] = (0, 0, 0, 200),
    shadow_blur: int = 6,
    shadow_offset: tuple[int, int] = (0, 3),
) -> None:
    """Draw text with a soft drop shadow for readability over busy backgrounds."""
    shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow_layer)
    sx = xy[0] + shadow_offset[0]
    sy = xy[1] + shadow_offset[1]
    sdraw.text((sx, sy), text, font=font, fill=shadow)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(shadow_blur))
    canvas.alpha_composite(shadow_layer)

    text_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    tdraw = ImageDraw.Draw(text_layer)
    tdraw.text(xy, text, font=font, fill=fill + (255,) if len(fill) == 3 else fill)
    canvas.alpha_composite(text_layer)


def add_top_gradient(canvas: Image.Image, height: int, opacity: int = 170) -> None:
    """Darken the top of the image with a smooth top-down gradient for title legibility."""
    grad = Image.new("RGBA", (1, height), (0, 0, 0, 0))
    for y in range(height):
        # Eased: full opacity at top, fades to 0 by `height`.
        t = 1.0 - (y / max(height - 1, 1))
        a = int(opacity * (t ** 1.4))
        grad.putpixel((0, y), (0, 0, 0, a))
    grad = grad.resize((canvas.width, height))
    full = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    full.paste(grad, (0, 0))
    canvas.alpha_composite(full)


def add_bottom_gradient(canvas: Image.Image, height: int, opacity: int = 140) -> None:
    grad = Image.new("RGBA", (1, height), (0, 0, 0, 0))
    for y in range(height):
        t = y / max(height - 1, 1)
        a = int(opacity * (t ** 1.4))
        grad.putpixel((0, y), (0, 0, 0, a))
    grad = grad.resize((canvas.width, height))
    full = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    full.paste(grad, (0, canvas.height - height))
    canvas.alpha_composite(full)


def render(
    input_path: Path,
    output_path: Path,
    main_title_lines: list[str],
    subtitle: str | None,
    author: str | None,
) -> None:
    base = Image.open(input_path).convert("RGBA")
    canvas = base.copy()
    W, H = canvas.size
    side_margin = int(W * 0.06)
    max_text_width = W - 2 * side_margin

    # Atmospheric darkening at top and bottom for legibility.
    top_band = int(H * 0.34)
    bottom_band = int(H * 0.12)
    add_top_gradient(canvas, top_band, opacity=180)
    if author:
        add_bottom_gradient(canvas, bottom_band, opacity=160)

    draw = ImageDraw.Draw(canvas)

    # Main title — large, bold, uppercase, centered. Auto-shrink each line.
    target_main_size = int(H * 0.085)
    main_fonts = [
        fit_font_size(draw, line.upper(), "title_bold", max_text_width, target_main_size)
        for line in main_title_lines
    ]
    # Use the smallest of the per-line sizes so all lines render at the same size.
    common_size = min(f.size for f in main_fonts)
    main_font = load_font("title_bold", common_size)

    # Subtitle: smaller serif, italic-flavored. Auto-fit.
    sub_font: ImageFont.FreeTypeFont | None = None
    if subtitle:
        target_sub_size = int(common_size * 0.42)
        sub_font = fit_font_size(draw, subtitle, "subtitle_serif", max_text_width, target_sub_size)

    # Compute total title block height to vertically center within the top band.
    line_gap = int(common_size * 0.08)
    line_heights = [measure(draw, line.upper(), main_font)[1] for line in main_title_lines]
    block_h = sum(line_heights) + line_gap * (len(main_title_lines) - 1)
    if sub_font:
        sub_w, sub_h = measure(draw, subtitle, sub_font)
        block_h += int(common_size * 0.45) + sub_h

    y = int(top_band * 0.5 - block_h * 0.5) + int(H * 0.015)

    for i, line in enumerate(main_title_lines):
        text = line.upper()
        w, _ = measure(draw, text, main_font)
        x = (W - w) // 2
        draw_text_with_shadow(
            canvas,
            text,
            main_font,
            (x, y),
            fill=(255, 255, 255),
            shadow=(0, 0, 0, 230),
            shadow_blur=8,
            shadow_offset=(0, 4),
        )
        y += line_heights[i] + line_gap

    if sub_font and subtitle:
        y += int(common_size * 0.25)
        sub_w, sub_h = measure(draw, subtitle, sub_font)
        x = (W - sub_w) // 2
        draw_text_with_shadow(
            canvas,
            subtitle,
            sub_font,
            (x, y),
            fill=(245, 230, 200),  # warm cream tone to harmonize with arena lights
            shadow=(0, 0, 0, 220),
            shadow_blur=6,
            shadow_offset=(0, 2),
        )

    # Author at bottom, smaller, subtle.
    if author:
        author_size = int(H * 0.032)
        author_font = load_font("author_italic", author_size)
        aw, ah = measure(draw, author, author_font)
        ax = (W - aw) // 2
        ay = H - bottom_band + (bottom_band - ah) // 2
        draw_text_with_shadow(
            canvas,
            author,
            author_font,
            (ax, ay),
            fill=(235, 220, 195),
            shadow=(0, 0, 0, 200),
            shadow_blur=4,
            shadow_offset=(0, 2),
        )

    canvas.convert("RGB").save(output_path, format="JPEG", quality=92, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--main-title-line", action="append", required=True,
                        help="One line of the main title (repeat for multi-line titles).")
    parser.add_argument("--subtitle", default=None)
    parser.add_argument("--author", default=None)
    args = parser.parse_args()

    render(
        Path(args.input),
        Path(args.output),
        main_title_lines=args.main_title_line,
        subtitle=args.subtitle,
        author=args.author,
    )


if __name__ == "__main__":
    main()
