#!/usr/bin/env python3
"""Add black caption bars with white text to an image.

Directory mode (default):
  npm run image-caption -- path/to/caption-dir/

  The directory must contain:
    - one source image (any name except final.*)
    - caption.txt with two labelled sections:

      left:
      <text>

      right:
      <text>

      or top:/bottom: for vertical bars.

  Writes final.png into the same directory.

Usage:
  python3 tools/image-caption/caption.py path/to/caption-dir/
"""

from __future__ import annotations

import argparse
import math
import os
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PADDING = 24
LINE_SPACING = 6
MIN_BAR_PX = 72
MEASURE_SLACK = 4
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
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


def line_width(font: ImageFont.ImageFont, text: str) -> int:
    if not text:
        return 0
    bbox = ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox((0, 0), text, font=font)
    return math.ceil(bbox[2] - bbox[0])


def longest_word_width(text: str, font: ImageFont.ImageFont) -> int:
    words = text.split()
    if not words:
        return 0
    return max(line_width(font, word) for word in words)


def wrap_text(text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    """Wrap at word boundaries only; never split words mid-character."""
    max_width = max(max_width - MEASURE_SLACK, 1)
    words = text.split()
    if not words:
        return [""]

    lines: list[str] = []
    current = ""
    for word in words:
        if not current:
            current = word
            continue
        trial = f"{current} {word}"
        if line_width(font, trial) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
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
    width = max(line_width(font, line) for line in lines)
    return width, height, lines


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    lines: list[str],
    font: ImageFont.ImageFont,
) -> None:
    left, top, right, bottom = box
    inner = (left + PADDING, top + PADDING, right - PADDING, bottom - PADDING)
    inner_left, inner_top, inner_right, inner_bottom = inner
    inner_w = inner_right - inner_left - MEASURE_SLACK
    inner_h = inner_bottom - inner_top
    if inner_w <= 0 or inner_h <= 0:
        return

    ascent, descent = font.getmetrics()
    line_height = ascent + descent + LINE_SPACING
    text_h = line_height * len(lines) - LINE_SPACING
    y = inner_top + max(0, (inner_h - text_h) // 2)

    for line in lines:
        line_w = line_width(font, line)
        x = inner_left + max(0, (inner_w - line_w) // 2)
        draw.text((x, y), line, fill="white", font=font)
        y += line_height


def max_font_size(img_w: int, img_h: int) -> int:
    """Upper bound for caption font scaled to image dimensions."""
    return min(max(img_w, img_h) // 10, 120)


def best_wrap_width(
    text: str,
    font: ImageFont.ImageFont,
    max_inner_w: int,
    max_inner_h: int,
) -> tuple[int, list[str]] | None:
    """Widest wrap width where the text block fits inside the inner box."""
    lo = 32
    hi = max(max_inner_w, lo)
    best: tuple[int, list[str]] | None = None

    while lo <= hi:
        mid = (lo + hi) // 2
        _, block_h, lines = text_block_size(text, font, mid)
        max_line_w = max(line_width(font, line) for line in lines)
        if block_h <= max_inner_h and max_line_w <= mid:
            best = (mid, lines)
        lo = mid + 1

    return best


def fit_largest_font(
    text: str,
    max_inner_w: int,
    max_inner_h: int | None = None,
    *,
    min_size: int = 12,
    max_size: int = 72,
) -> tuple[int, ImageFont.ImageFont, list[str], int] | None:
    """Return the largest font size (and wrapped lines) that fits the inner box."""
    lo, hi = min_size, max_size
    best: tuple[int, ImageFont.ImageFont, list[str], int] | None = None

    while lo <= hi:
        mid = (lo + hi) // 2
        font = load_font(mid)
        if max_inner_h is None:
            _, text_h, lines = text_block_size(text, font, max_inner_w + MEASURE_SLACK)
            max_line_w = max(line_width(font, line) for line in lines) if lines else 0
            if (
                text_h > 0
                and max_line_w <= max_inner_w
                and longest_word_width(text, font) <= max_inner_w
            ):
                best = (mid, font, lines, max_inner_w)
                lo = mid + 1
            else:
                hi = mid - 1
            continue

        wrapped = best_wrap_width(text, font, max_inner_w, max_inner_h)
        if wrapped and longest_word_width(text, font) <= max_inner_w:
            wrap_w, lines = wrapped
            best = (mid, font, lines, wrap_w)
            lo = mid + 1
        else:
            hi = mid - 1

    return best


def layout_vertical_bar(
    text: str, img_w: int
) -> tuple[int, ImageFont.ImageFont, list[str]]:
    """Top/bottom bar: thickness is bar height; text wraps to image width."""
    max_inner_w = max(img_w - PADDING * 2 - MEASURE_SLACK, 32)
    max_size = max_font_size(img_w, img_w)

    fit = fit_largest_font(text, max_inner_w, max_inner_h=None, max_size=max_size)
    if fit is None:
        font = load_font(12)
        _, text_h, lines = text_block_size(text, font, max_inner_w + MEASURE_SLACK)
    else:
        _, font, lines, _ = fit
        _, text_h, lines = text_block_size(text, font, max_inner_w + MEASURE_SLACK)

    bar_h = max(MIN_BAR_PX, text_h + PADDING * 2 + MEASURE_SLACK)
    return bar_h, font, lines


def layout_horizontal_bar(
    text: str, img_h: int, max_bar_w: int | None = None
) -> tuple[int, ImageFont.ImageFont, list[str]]:
    """Left/right bar: thickness is bar width; text wraps within bar height."""
    inner_h = max(img_h - PADDING * 2, 32)
    bar_cap = max_bar_w if max_bar_w is not None else inner_h
    max_inner_w = max(bar_cap - PADDING * 2 - MEASURE_SLACK, 32)
    max_size = max_font_size(max_inner_w, img_h)

    fit = fit_largest_font(
        text, max_inner_w, inner_h, min_size=12, max_size=max_size
    )
    if fit is None:
        font = load_font(12)
        wrapped = best_wrap_width(text, font, max_inner_w, inner_h)
        if wrapped is None:
            lines = wrap_text(text, font, max_inner_w + MEASURE_SLACK)
        else:
            _, lines = wrapped
    else:
        _, font, lines, wrap_w = fit

    text_w = max(line_width(font, line) for line in lines) if lines else 0
    bar_w = max(MIN_BAR_PX, text_w + PADDING * 2 + MEASURE_SLACK)
    if max_bar_w is not None:
        bar_w = min(bar_w, max_bar_w)
    inner_w = max(bar_w - PADDING * 2 - MEASURE_SLACK, 32)
    lines = wrap_text(text, font, inner_w + MEASURE_SLACK)
    return bar_w, font, lines


def compose_vertical(
    image: Image.Image, text_a: str, text_b: str
) -> Image.Image:
    img_w, img_h = image.size

    top_h, top_font, top_lines = layout_vertical_bar(text_a, img_w)
    bot_h, bot_font, bot_lines = layout_vertical_bar(text_b, img_w)

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
    max_bar_w = min(max(img_w // 3, MIN_BAR_PX), max(img_h // 2, MIN_BAR_PX), 560)

    left_w, left_font, left_lines = layout_horizontal_bar(text_a, img_h, max_bar_w)
    right_w, right_font, right_lines = layout_horizontal_bar(text_b, img_h, max_bar_w)

    out_w = left_w + img_w + right_w
    canvas = Image.new("RGB", (out_w, img_h), "black")
    canvas.paste(image, (left_w, 0))

    draw = ImageDraw.Draw(canvas)
    draw_centered_text(draw, (0, 0, left_w, img_h), left_lines, left_font)
    draw_centered_text(
        draw, (left_w + img_w, 0, out_w, img_h), right_lines, right_font
    )
    return canvas


def find_case_insensitive_file(directory: Path, name: str) -> Path | None:
    target = name.lower()
    for path in directory.iterdir():
        if path.is_file() and path.name.lower() == target:
            return path
    return None


def find_caption_text_file(directory: Path) -> Path | None:
    caption = find_case_insensitive_file(directory, "caption.txt")
    if caption is not None:
        return caption

    text_files = sorted(
        path
        for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() == ".txt"
    )
    if len(text_files) == 1:
        return text_files[0]
    return None


SECTION_HEADER_RE = re.compile(
    r"^(left|right|top|bottom)\s*:\s*(.*)$",
    re.IGNORECASE,
)


def parse_caption_sections(content: str) -> tuple[str, str, str]:
    """Parse caption.txt into layout and two caption strings."""
    sections: dict[str, str] = {}
    current_key: str | None = None
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_key, current_lines
        if current_key is not None:
            sections[current_key] = "\n".join(current_lines).strip()
        current_lines = []

    for line in content.splitlines():
        match = SECTION_HEADER_RE.match(line)
        if match:
            flush()
            current_key = match.group(1).lower()
            inline = match.group(2).strip()
            current_lines = [inline] if inline else []
            continue
        if current_key is not None:
            current_lines.append(line)

    flush()

    has_horizontal = "left" in sections and "right" in sections
    has_vertical = "top" in sections and "bottom" in sections

    if has_horizontal and has_vertical:
        raise ValueError("caption file has both left/right and top/bottom sections")
    if has_horizontal:
        return "horizontal", sections["left"], sections["right"]
    if has_vertical:
        return "vertical", sections["top"], sections["bottom"]

    raise ValueError(
        'caption file needs labelled sections: "left:" + "right:" or "top:" + "bottom:"'
    )


def read_caption_file(path: Path) -> tuple[str, str, str]:
    return parse_caption_sections(path.read_text(encoding="utf-8"))


def load_caption_directory(
    directory: Path,
) -> tuple[Path, str, str, str]:
    """Return source image, layout, and the two caption strings."""
    directory = directory.resolve()
    if not directory.is_dir():
        raise FileNotFoundError(f"Not a directory: {directory}")

    images = sorted(
        path
        for path in directory.iterdir()
        if path.is_file()
        and path.suffix.lower() in IMAGE_EXTENSIONS
        and path.stem.lower() != "final"
    )
    if not images:
        raise FileNotFoundError(
            f"No source image in {directory} (expected one image whose name is not final)"
        )
    if len(images) > 1:
        names = ", ".join(path.name for path in images)
        raise ValueError(f"Expected one source image in {directory}, found: {names}")

    caption_path = find_caption_text_file(directory)
    if caption_path is None:
        raise FileNotFoundError(
            f"{directory} needs caption.txt with left/right or top/bottom sections"
        )

    layout, text_a, text_b = read_caption_file(caption_path)
    return images[0], layout, text_a, text_b


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a captioned image from a directory of source files."
    )
    parser.add_argument(
        "directory",
        nargs="?",
        type=Path,
        default=Path.cwd(),
        help="Caption project directory (default: current working directory)",
    )
    return parser.parse_args(argv)


def resolve_directory(args: argparse.Namespace, argv: list[str]) -> Path:
    """Use CLI path when given; otherwise npm's INIT_CWD or the working directory."""
    if argv:
        return args.directory.expanduser()
    init_cwd = os.environ.get("INIT_CWD")
    if init_cwd:
        return Path(init_cwd)
    return args.directory


def main(argv: list[str] | None = None) -> int:
    cli_argv = argv if argv is not None else sys.argv[1:]
    args = parse_args(cli_argv)
    directory = resolve_directory(args, cli_argv)

    try:
        input_path, layout, text_a, text_b = load_caption_directory(directory)
    except (FileNotFoundError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    output_path = directory.resolve() / "final.png"

    with Image.open(input_path) as src:
        image = src.convert("RGB")
        if layout == "vertical":
            result = compose_vertical(image, text_a, text_b)
        else:
            result = compose_horizontal(image, text_a, text_b)

    result.save(output_path, quality=95)
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
