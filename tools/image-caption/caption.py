#!/usr/bin/env python3
"""Add black caption bars with white text to an image.

Vertical layout: black bars above and below the image (text-a top, text-b bottom).
Horizontal layout: black bars left and right (text-a left, text-b right).

Usage:
  python3 tools/image-caption/caption.py input.png -o output.png \\
    --layout vertical --text-a "Top caption" --text-b "Bottom caption"

  npm run image-caption -- input.png -o output.png --layout horizontal \\
    --text-a "Left" --text-b "Right"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PADDING = 24
LINE_SPACING = 6
MIN_BAR_PX = 72
FONT_CANDIDATES = (
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def wrap_text(text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return [""]

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if font.getlength(trial) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def text_block_size(
    text: str, font: ImageFont.ImageFont, max_width: int
) -> tuple[int, int, list[str]]:
    lines = wrap_text(text, font, max_width)
    if not lines or lines == [""]:
        return 0, 0, [""]

    ascent, descent = font.getmetrics()
    line_height = ascent + descent + LINE_SPACING
    height = line_height * len(lines) - LINE_SPACING
    width = max(int(font.getlength(line)) for line in lines)
    return width, height, lines


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    lines: list[str],
    font: ImageFont.ImageFont,
) -> None:
    left, top, right, bottom = box
    box_w = right - left
    box_h = bottom - top
    ascent, descent = font.getmetrics()
    line_height = ascent + descent + LINE_SPACING
    text_h = line_height * len(lines) - LINE_SPACING
    y = top + (box_h - text_h) // 2

    for line in lines:
        line_w = font.getlength(line)
        x = left + (box_w - line_w) // 2
        draw.text((x, y), line, fill="white", font=font)
        y += line_height


def fit_font_for_width(text: str, max_width: int, start_size: int = 42) -> tuple[ImageFont.ImageFont, list[str], int, int]:
    for size in range(start_size, 11, -2):
        font = load_font(size)
        _, height, lines = text_block_size(text, font, max_width)
        if height > 0:
            return font, lines, size, height
    font = load_font(12)
    _, height, lines = text_block_size(text, font, max_width)
    return font, lines, 12, height


def bar_thickness(text: str, span: int, axis: str) -> tuple[int, ImageFont.ImageFont, list[str]]:
    """Return bar thickness along the caption axis and font/lines for that text."""
    usable = max(span - PADDING * 2, 32)
    font, lines, _, text_h = fit_font_for_width(text, usable)
    thickness = max(MIN_BAR_PX, text_h + PADDING * 2)
    return thickness, font, lines


def compose_vertical(
    image: Image.Image, text_a: str, text_b: str
) -> Image.Image:
    img_w, img_h = image.size
    span = img_w

    top_h, top_font, top_lines = bar_thickness(text_a, span, "vertical")
    bot_h, bot_font, bot_lines = bar_thickness(text_b, span, "vertical")

    out_h = top_h + img_h + bot_h
    canvas = Image.new("RGB", (img_w, out_h), "black")
    canvas.paste(image, (0, top_h))

    draw = ImageDraw.Draw(canvas)
    draw_centered_text(draw, (0, 0, img_w, top_h), top_lines, top_font)
    draw_centered_text(draw, (0, top_h + img_h, img_w, out_h), bot_lines, bot_font)
    return canvas


def compose_horizontal(
    image: Image.Image, text_a: str, text_b: str
) -> Image.Image:
    img_w, img_h = image.size
    span = img_h

    left_w, left_font, left_lines = bar_thickness(text_a, span, "horizontal")
    right_w, right_font, right_lines = bar_thickness(text_b, span, "horizontal")

    out_w = left_w + img_w + right_w
    canvas = Image.new("RGB", (out_w, img_h), "black")
    canvas.paste(image, (left_w, 0))

    draw = ImageDraw.Draw(canvas)
    draw_centered_text(draw, (0, 0, left_w, img_h), left_lines, left_font)
    draw_centered_text(
        draw, (left_w + img_w, 0, out_w, img_h), right_lines, right_font
    )
    return canvas


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extend an image with black caption bars and white text."
    )
    parser.add_argument("input", type=Path, help="Source image path")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Output path (default: <stem>_caption<ext> beside input)",
    )
    parser.add_argument(
        "--layout",
        choices=("vertical", "horizontal"),
        required=True,
        help="vertical = top/bottom bars; horizontal = left/right bars",
    )
    parser.add_argument(
        "--text-a",
        required=True,
        help="Caption in the first bar (top or left)",
    )
    parser.add_argument(
        "--text-b",
        required=True,
        help="Caption in the second bar (bottom or right)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    input_path = args.input.resolve()
    if not input_path.is_file():
        print(f"Input not found: {input_path}", file=sys.stderr)
        return 1

    output_path = args.output
    if output_path is None:
        output_path = input_path.with_name(
            f"{input_path.stem}_caption{input_path.suffix}"
        )
    else:
        output_path = output_path.resolve()

    with Image.open(input_path) as src:
        image = src.convert("RGB")
        if args.layout == "vertical":
            result = compose_vertical(image, args.text_a, args.text_b)
        else:
            result = compose_horizontal(image, args.text_a, args.text_b)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, quality=95)
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
