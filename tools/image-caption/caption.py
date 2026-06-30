#!/usr/bin/env python3
"""Add black caption bars with white text to an image.

Directory mode (default):
  npm run image-caption -- path/to/caption-dir/

  Bar layouts — one source image plus caption.txt with:
    left:/right:  or  top:/bottom:

  Quad layout — three panel images plus caption in a fourth quadrant:
    image1:   (optional path; auto-discovered if blank)
    image2:
    image3:
    caption:
    <text>

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
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from panels import (
    ROW_TRIPTYCH_RE,
    compose_quad_images,
    default_reference_size,
    discover_panels,
    find_repo_root,
    load_panel,
    panel_geometry,
    resolve_panel_path,
)

PADDING = 24
LINE_SPACING = 6
PARAGRAPH_GAP = 14
MIN_BAR_PX = 72
MEASURE_SLACK = 4
# Combined top+bottom caption height may not exceed this fraction of image height.
MAX_CAPTION_TO_IMAGE_RATIO = 0.75
PARA_BREAK = object()
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


def longest_word_width_preserved(text: str, font: ImageFont.ImageFont) -> int:
    """Longest single word across paragraphs and explicit line breaks."""
    text = text.strip()
    if not text:
        return 0
    best = 0
    for paragraph in re.split(r"\n{2,}", text):
        for raw_line in paragraph.split("\n"):
            best = max(best, longest_word_width(raw_line.strip(), font))
    return best


def layout_text_lines(
    text: str, font: ImageFont.ImageFont, max_width: int
) -> list[str | object]:
    """Lay out copy honoring blank-line paragraphs and single line breaks."""
    text = text.strip()
    if not text:
        return [""]

    lines: list[str | object] = []
    paragraphs = re.split(r"\n{2,}", text)
    for pi, paragraph in enumerate(paragraphs):
        if pi > 0:
            lines.append(PARA_BREAK)
        for raw_line in paragraph.split("\n"):
            stripped = raw_line.strip()
            if not stripped:
                if lines and lines[-1] is not PARA_BREAK:
                    lines.append("")
                continue
            lines.extend(wrap_text(stripped, font, max_width))
    return lines or [""]


def lines_block_height(lines: list[str | object], font: ImageFont.ImageFont) -> int:
    if not lines or lines == [""]:
        return 0

    ascent, descent = font.getmetrics()
    line_height = ascent + descent + LINE_SPACING
    height = 0
    for line in lines:
        if line is PARA_BREAK:
            height += PARAGRAPH_GAP
        else:
            height += line_height
    return height - LINE_SPACING


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
) -> tuple[int, int, list[str | object]]:
    lines = layout_text_lines(text, font, max_width)
    if not lines or lines == [""]:
        return 0, 0, [""]

    height = lines_block_height(lines, font)
    drawable = [line for line in lines if line is not PARA_BREAK and line != ""]
    width = max(line_width(font, line) for line in drawable) if drawable else 0
    return width, height, lines


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    lines: list[str | object],
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
    text_h = lines_block_height(lines, font)
    y = inner_top + max(0, (inner_h - text_h) // 2)

    for line in lines:
        if line is PARA_BREAK:
            y += PARAGRAPH_GAP
            continue
        if line == "":
            y += line_height
            continue
        line_w = line_width(font, str(line))
        x = inner_left + max(0, (inner_w - line_w) // 2)
        draw.text((x, y), str(line), fill="white", font=font)
        y += line_height


def max_font_size(img_w: int, img_h: int) -> int:
    """Upper bound for caption font scaled to image dimensions."""
    return min(max(img_w, img_h) // 10, 120)


def scaled_max_font_for_text(
    base_max: int, text: str, max_inner_h: int
) -> int:
    """Pull font ceiling down for long copy or tight vertical space."""
    chars = len(text.strip())
    cap = base_max
    if chars > 120:
        cap = min(cap, 40)
    if chars > 250:
        cap = min(cap, 30)
    if chars > 400:
        cap = min(cap, 24)
    if chars > 600:
        cap = min(cap, 20)
    line_budget = max(1, max_inner_h // 18)
    cap = min(cap, max(12, line_budget * 2))
    return max(12, cap)


def vertical_caption_budgets(
    img_h: int, text_a: str, text_b: str
) -> tuple[int, int]:
    """Split a shared height budget between top and bottom bars."""
    text_a = text_a.strip()
    text_b = text_b.strip()
    total_max = max(int(img_h * MAX_CAPTION_TO_IMAGE_RATIO), MIN_BAR_PX)

    len_a = len(text_a)
    len_b = len(text_b)
    if len_a == 0 and len_b == 0:
        return 0, 0
    if len_a == 0:
        return 0, total_max
    if len_b == 0:
        return total_max, 0

    share_a = len_a / (len_a + len_b)
    top_max = max(MIN_BAR_PX, int(total_max * share_a))
    bot_max = max(MIN_BAR_PX, total_max - top_max)
    return top_max, bot_max


def best_wrap_width(
    text: str,
    font: ImageFont.ImageFont,
    max_inner_w: int,
    max_inner_h: int,
) -> tuple[int, list[str | object]] | None:
    """Widest wrap width where the text block fits inside the inner box."""
    lo = 32
    hi = max(max_inner_w, lo)
    best: tuple[int, list[str | object]] | None = None

    while lo <= hi:
        mid = (lo + hi) // 2
        _, block_h, lines = text_block_size(text, font, mid)
        drawable = [line for line in lines if line is not PARA_BREAK and line != ""]
        max_line_w = max(line_width(font, line) for line in drawable) if drawable else 0
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
) -> tuple[int, ImageFont.ImageFont, list[str | object], int] | None:
    """Return the largest font size (and wrapped lines) that fits the inner box."""
    lo, hi = min_size, max_size
    best: tuple[int, ImageFont.ImageFont, list[str | object], int] | None = None

    while lo <= hi:
        mid = (lo + hi) // 2
        font = load_font(mid)
        if max_inner_h is None:
            _, text_h, lines = text_block_size(text, font, max_inner_w + MEASURE_SLACK)
            drawable = [line for line in lines if line is not PARA_BREAK and line != ""]
            max_line_w = max(line_width(font, line) for line in drawable) if drawable else 0
            if (
                text_h > 0
                and max_line_w <= max_inner_w
                and longest_word_width_preserved(text, font) <= max_inner_w
            ):
                best = (mid, font, lines, max_inner_w)
                lo = mid + 1
            else:
                hi = mid - 1
            continue

        wrapped = best_wrap_width(text, font, max_inner_w, max_inner_h)
        if wrapped and longest_word_width_preserved(text, font) <= max_inner_w:
            wrap_w, lines = wrapped
            best = (mid, font, lines, wrap_w)
            lo = mid + 1
        else:
            hi = mid - 1

    return best


def layout_vertical_bar(
    text: str, img_w: int, max_bar_h: int
) -> tuple[int, ImageFont.ImageFont, list[str | object]]:
    """Top/bottom bar: thickness is bar height; text wraps to image width."""
    text = text.strip()
    if not text:
        return 0, load_font(12), [""]

    max_bar_h = max(max_bar_h, MIN_BAR_PX)
    max_inner_w = max(img_w - PADDING * 2 - MEASURE_SLACK, 32)
    max_inner_h = max(max_bar_h - PADDING * 2 - MEASURE_SLACK, 24)
    base_max = max_font_size(img_w, max_bar_h)
    max_size = scaled_max_font_for_text(base_max, text, max_inner_h)

    fit = fit_largest_font(
        text, max_inner_w, max_inner_h, min_size=12, max_size=max_size
    )
    if fit is None:
        font = load_font(12)
        wrapped = best_wrap_width(text, font, max_inner_w, max_inner_h)
        if wrapped is None:
            lines = layout_text_lines(text, font, max_inner_w + MEASURE_SLACK)
        else:
            _, lines = wrapped
    else:
        _, font, lines, _ = fit

    text_h = lines_block_height(lines, font)
    bar_h = min(max_bar_h, max(MIN_BAR_PX, text_h + PADDING * 2 + MEASURE_SLACK))
    return bar_h, font, lines


def layout_horizontal_bar(
    text: str, img_h: int, max_bar_w: int | None = None
) -> tuple[int, ImageFont.ImageFont, list[str | object]]:
    """Left/right bar: thickness is bar width; text wraps within bar height."""
    inner_h = max(img_h - PADDING * 2, 32)
    bar_cap = max_bar_w if max_bar_w is not None else inner_h
    max_inner_w = max(bar_cap - PADDING * 2 - MEASURE_SLACK, 32)
    base_max = max_font_size(max_inner_w, img_h)
    max_size = scaled_max_font_for_text(base_max, text, inner_h)

    fit = fit_largest_font(
        text, max_inner_w, inner_h, min_size=12, max_size=max_size
    )
    if fit is None:
        font = load_font(12)
        wrapped = best_wrap_width(text, font, max_inner_w, inner_h)
        if wrapped is None:
            lines = layout_text_lines(text, font, max_inner_w + MEASURE_SLACK)
        else:
            _, lines = wrapped
    else:
        _, font, lines, wrap_w = fit

    drawable = [line for line in lines if line is not PARA_BREAK and line != ""]
    text_w = max(line_width(font, line) for line in drawable) if drawable else 0
    bar_w = max(MIN_BAR_PX, text_w + PADDING * 2 + MEASURE_SLACK)
    if max_bar_w is not None:
        bar_w = min(bar_w, max_bar_w)
    inner_w = max(bar_w - PADDING * 2 - MEASURE_SLACK, 32)
    lines = layout_text_lines(text, font, inner_w + MEASURE_SLACK)
    return bar_w, font, lines


def compose_vertical(
    image: Image.Image, text_a: str, text_b: str
) -> Image.Image:
    img_w, img_h = image.size

    top_max, bot_max = vertical_caption_budgets(img_h, text_a, text_b)
    top_h, top_font, top_lines = layout_vertical_bar(text_a, img_w, top_max)
    bot_h, bot_font, bot_lines = layout_vertical_bar(text_b, img_w, bot_max)

    out_h = top_h + img_h + bot_h
    canvas = Image.new("RGB", (img_w, out_h), "black")
    canvas.paste(image, (0, top_h))

    draw = ImageDraw.Draw(canvas)
    if top_h > 0:
        draw_centered_text(draw, (0, 0, img_w, top_h), top_lines, top_font)
    if bot_h > 0:
        draw_centered_text(
            draw, (0, top_h + img_h, img_w, out_h), bot_lines, bot_font
        )
    return canvas


def layout_quad_caption(
    text: str, panel_w: int, panel_h: int
) -> tuple[ImageFont.ImageFont, list[str | object]]:
    """Fit caption copy inside a single quadrant, using the largest font that fits."""
    text = text.strip()
    if not text:
        return load_font(12), [""]

    max_inner_w = max(panel_w - PADDING * 2 - MEASURE_SLACK, 32)
    max_inner_h = max(panel_h - PADDING * 2 - MEASURE_SLACK, 24)
    # Quad panels dedicate the whole cell to copy — don't apply bar-layout char caps.
    max_size = max(12, min(max_inner_h, 96))

    fit = fit_largest_font(
        text, max_inner_w, max_inner_h, min_size=12, max_size=max_size
    )
    if fit is None:
        font = load_font(12)
        wrapped = best_wrap_width(text, font, max_inner_w, max_inner_h)
        if wrapped is None:
            lines = layout_text_lines(text, font, max_inner_w + MEASURE_SLACK)
        else:
            _, lines = wrapped
    else:
        _, font, lines, wrap_w = fit
        lines = layout_text_lines(text, font, wrap_w + MEASURE_SLACK)
    return font, lines


def compose_quad(
    image1: Image.Image,
    image2: Image.Image,
    image3: Image.Image,
    caption_text: str,
    *,
    reference_size: tuple[int, int],
) -> Image.Image:
    """2×2 grid: three images plus caption text in the bottom-right quadrant."""
    panel_w, panel_h = panel_geometry(reference_size, 3)
    canvas = compose_quad_images(image1, image2, image3, panel_w, panel_h)
    if caption_text.strip():
        draw = ImageDraw.Draw(canvas)
        font, lines = layout_quad_caption(caption_text, panel_w, panel_h)
        draw_centered_text(
            draw,
            (panel_w, panel_h, panel_w * 2, panel_h * 2),
            lines,
            font,
        )
    return canvas


def resolve_quad_panel_paths(
    directory: Path,
    image_paths: tuple[str, str, str],
) -> tuple[Path, Path, Path]:
    """Map image1/2/3 to top-left, top-right, bottom-left panel paths."""
    left_default, center_default, right_default = discover_panels(directory)
    defaults = (left_default, right_default, center_default)
    resolved: list[Path] = []

    for index, raw in enumerate(image_paths):
        if raw.strip():
            resolved.append(resolve_panel_path(directory, raw))
        else:
            resolved.append(defaults[index])

    return resolved[0], resolved[1], resolved[2]


def load_quad_panels(
    directory: Path,
    image_paths: tuple[str, str, str],
) -> tuple[Image.Image, Image.Image, Image.Image]:
    left_path, right_path, center_path = resolve_quad_panel_paths(directory, image_paths)
    row_triptych_center = (
        center_path if ROW_TRIPTYCH_RE.search(center_path.stem) else None
    )
    return (
        load_panel(left_path),
        load_panel(right_path),
        load_panel(center_path, row_triptych_center=row_triptych_center),
    )


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
    r"^(left|right|top|bottom|image1|image2|image3|caption)\s*:\s*(.*)$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class CaptionSpec:
    layout: str
    text_a: str = ""
    text_b: str = ""
    image_paths: tuple[str, str, str] = ("", "", "")
    caption: str = ""


def parse_sectioned_caption(content: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    current_key: str | None = None
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_key, current_lines
        if current_key is not None:
            sections[current_key] = "\n".join(current_lines).strip("\n")
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
    return sections


def parse_caption_file(content: str) -> CaptionSpec:
    sections = parse_sectioned_caption(content)

    has_quad = all(key in sections for key in ("image1", "image2", "image3", "caption"))
    has_horizontal = "left" in sections and "right" in sections
    has_vertical = "top" in sections and "bottom" in sections

    layouts = sum([has_quad, has_horizontal, has_vertical])
    if layouts > 1:
        raise ValueError(
            "caption file mixes quad (image1/2/3/caption) with bar layouts (left/right or top/bottom)"
        )

    if has_quad:
        return CaptionSpec(
            layout="quad",
            image_paths=(
                sections["image1"],
                sections["image2"],
                sections["image3"],
            ),
            caption=sections["caption"],
        )
    if has_horizontal:
        return CaptionSpec(
            layout="horizontal",
            text_a=sections["left"],
            text_b=sections["right"],
        )
    if has_vertical:
        return CaptionSpec(
            layout="vertical",
            text_a=sections["top"],
            text_b=sections["bottom"],
        )

    raise ValueError(
        'caption file needs "image1:" + "image2:" + "image3:" + "caption:", '
        'or "left:" + "right:", or "top:" + "bottom:"'
    )


def read_caption_file(path: Path) -> CaptionSpec:
    return parse_caption_file(path.read_text(encoding="utf-8"))


def load_caption_directory(directory: Path) -> tuple[Path, CaptionSpec]:
    """Return source image and bar-layout caption spec."""
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
    preferred_names = ("final_raw.png", "initial.png")
    for name in preferred_names:
        match = next((path for path in images if path.name.lower() == name), None)
        if match is not None:
            images = [match]
            break
    if len(images) > 1:
        names = ", ".join(path.name for path in images)
        raise ValueError(
            f"Expected one source image in {directory}, found: {names} "
            "(rename the composite to initial.png or final_raw.png)"
        )

    caption_path = find_caption_text_file(directory)
    if caption_path is None:
        raise FileNotFoundError(
            f"{directory} needs caption.txt with left/right or top/bottom sections"
        )

    spec = read_caption_file(caption_path)
    return images[0], spec


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
    directory = resolve_directory(args, cli_argv).resolve()
    output_path = directory / "final.png"

    caption_path = find_caption_text_file(directory)
    if caption_path is None:
        print(f"{directory} needs caption.txt", file=sys.stderr)
        return 1

    try:
        spec = read_caption_file(caption_path)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if spec.layout == "quad":
        try:
            image1, image2, image3 = load_quad_panels(directory, spec.image_paths)
        except (FileNotFoundError, ValueError, OSError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
        reference_size = default_reference_size(find_repo_root(directory))
        result = compose_quad(
            image1,
            image2,
            image3,
            spec.caption,
            reference_size=reference_size,
        )
        result.save(output_path, quality=95)
        print(output_path)
        return 0

    try:
        input_path, bar_spec = load_caption_directory(directory)
    except (FileNotFoundError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    with Image.open(input_path) as src:
        image = src.convert("RGB")
        if bar_spec.layout == "vertical":
            result = compose_vertical(image, bar_spec.text_a, bar_spec.text_b)
        else:
            result = compose_horizontal(image, bar_spec.text_a, bar_spec.text_b)

    result.save(output_path, quality=95)
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
