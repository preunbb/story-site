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
ITALIC_FONT_CANDIDATES = (
    "/System/Library/Fonts/Supplemental/Arial Italic.ttf",
    "/Library/Fonts/Arial Italic.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf",
)
ITALIC_MARKUP_RE = re.compile(r"\*([^*]+)\*")
INLINE_ASSET_RE = re.compile(r"\[\[([a-z0-9_-]+)\]\](?::(\d+)px)?", re.IGNORECASE)
WRAP_UNIT_RE = re.compile(r"\[\[[a-z0-9_-]+\]\](?::\d+px)?|\S+", re.IGNORECASE)
CAPTION_INSERTS_SUBDIR = Path("assets") / "caption_inserts"
INLINE_ASSET_HEIGHT_SCALE = 0.88  # fit within a mixed text line
INLINE_ASSET_ONLY_HEIGHT_SCALE = 1.28  # standalone [[asset]] lines may be taller
INLINE_ASSET_H_PAD = 14  # horizontal clearance on each side of an asset
INLINE_ASSET_GAP = 10  # gap between an asset and adjacent text
INLINE_ASSET_V_PAD = 6  # extra vertical clearance around asset lines
_REPO_ROOT: Path | None = None
_ASSET_CACHE: dict[str, Image.Image] = {}
_ASSET_TRIM_CACHE: dict[str, Image.Image] = {}


@dataclass(frozen=True)
class InlineToken:
    kind: str  # "text" | "asset"
    value: str
    italic: bool = False
    height_px: int | None = None  # asset only — explicit render height


def set_caption_inserts_root(start: Path) -> None:
    global _REPO_ROOT
    _REPO_ROOT = find_repo_root(start)


def set_caption_assets_root(start: Path) -> None:
    """Backward-compatible alias."""
    set_caption_inserts_root(start)


def caption_insert_path(name: str) -> Path | None:
    if _REPO_ROOT is None:
        return None
    path = _REPO_ROOT / CAPTION_INSERTS_SUBDIR / f"{name.lower()}.png"
    return path if path.is_file() else None


def caption_asset_path(name: str) -> Path | None:
    """Backward-compatible alias."""
    return caption_insert_path(name)


def load_caption_asset(name: str) -> Image.Image | None:
    key = name.lower()
    if key in _ASSET_CACHE:
        return _ASSET_CACHE[key]
    path = caption_asset_path(key)
    if path is None:
        return None
    with Image.open(path) as src:
        img = src.convert("RGBA")
    _ASSET_CACHE[key] = img
    return img


def trim_asset_image(
    img: Image.Image, threshold: int = 28, margin: int = 8
) -> Image.Image:
    """Crop to visible (non-background) pixels so layout matches the wordart."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()
    min_x, min_y, max_x, max_y = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 16:
                continue
            if r > threshold or g > threshold or b > threshold:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x < min_x or max_y < min_y:
        return rgba
    min_x = max(0, min_x - margin)
    min_y = max(0, min_y - margin)
    max_x = min(w - 1, max_x + margin)
    max_y = min(h - 1, max_y + margin)
    return rgba.crop((min_x, min_y, max_x + 1, max_y + 1))


def trimmed_caption_asset(name: str) -> Image.Image | None:
    key = name.lower()
    if key in _ASSET_TRIM_CACHE:
        return _ASSET_TRIM_CACHE[key]
    asset = load_caption_asset(key)
    if asset is None:
        return None
    trimmed = trim_asset_image(asset)
    _ASSET_TRIM_CACHE[key] = trimmed
    return trimmed


def line_contains_asset(text: str) -> bool:
    return "[[" in text and INLINE_ASSET_RE.search(text) is not None


def is_asset_only_line(text: str) -> bool:
    tokens = tokenize_inline_line(text)
    return bool(tokens) and all(token.kind == "asset" for token in tokens)


def asset_height_budget(font: ImageFont.ImageFont, *, asset_only: bool) -> int:
    ascent, descent = font.getmetrics()
    scale = (
        INLINE_ASSET_ONLY_HEIGHT_SCALE if asset_only else INLINE_ASSET_HEIGHT_SCALE
    )
    return max(1, int((ascent + descent) * scale))


def asset_token_label(token: InlineToken) -> str:
    if token.height_px is not None:
        return f"[[{token.value}]]:{token.height_px}px"
    return f"[[{token.value}]]"


def parse_asset_unit(unit: str) -> tuple[str, int | None] | None:
    match = INLINE_ASSET_RE.fullmatch(unit.strip())
    if not match:
        return None
    height_px = int(match.group(2)) if match.group(2) else None
    return match.group(1).lower(), height_px


def scaled_asset_dimensions(
    name: str,
    font: ImageFont.ImageFont,
    *,
    asset_only: bool = False,
    height_px: int | None = None,
) -> tuple[int, int] | None:
    asset = trimmed_caption_asset(name)
    if asset is None:
        return None
    if height_px is not None:
        height = max(1, int(height_px))
    else:
        height = asset_height_budget(font, asset_only=asset_only)
    scale = height / asset.height
    width = max(1, int(asset.width * scale))
    return width + INLINE_ASSET_H_PAD * 2, height


def asset_token_dimensions(
    token: InlineToken,
    font: ImageFont.ImageFont,
    *,
    asset_only: bool,
) -> tuple[int, int] | None:
    if token.kind != "asset":
        return None
    return scaled_asset_dimensions(
        token.value,
        font,
        asset_only=asset_only,
        height_px=token.height_px,
    )


def max_asset_height_on_line(
    text: str, font: ImageFont.ImageFont, *, asset_only: bool
) -> int:
    tallest = 0
    for token in tokenize_inline_line(text):
        if token.kind != "asset":
            continue
        dims = asset_token_dimensions(token, font, asset_only=asset_only)
        if dims is not None:
            tallest = max(tallest, dims[1])
    return tallest


def line_slot_height(
    line: str | object,
    font: ImageFont.ImageFont,
    base_line_height: int,
) -> int:
    if line is PARA_BREAK or line == "" or not line_contains_asset(str(line)):
        return base_line_height
    line_text = str(line)
    asset_only = is_asset_only_line(line_text)
    asset_h = max_asset_height_on_line(line_text, font, asset_only=asset_only)
    if asset_h <= 0:
        return base_line_height
    return max(base_line_height, asset_h + INLINE_ASSET_V_PAD * 2)


def inline_token_gap(prev: InlineToken | None, token: InlineToken) -> int:
    if prev is None:
        return 0
    if prev.kind == "asset" or token.kind == "asset":
        return INLINE_ASSET_GAP
    return 0


def tokenize_inline_line(text: str) -> list[InlineToken]:
    tokens: list[InlineToken] = []
    pos = 0
    while pos < len(text):
        asset_match = INLINE_ASSET_RE.match(text, pos)
        if asset_match:
            height_px = int(asset_match.group(2)) if asset_match.group(2) else None
            tokens.append(
                InlineToken(
                    "asset",
                    asset_match.group(1).lower(),
                    height_px=height_px,
                )
            )
            pos = asset_match.end()
            continue
        next_asset = INLINE_ASSET_RE.search(text, pos)
        end = next_asset.start() if next_asset else len(text)
        chunk = text[pos:end]
        for segment, is_italic in parse_markup_segments(chunk):
            if segment:
                tokens.append(InlineToken("text", segment, is_italic))
        pos = end
    return tokens


def wrap_units(text: str) -> list[str]:
    return WRAP_UNIT_RE.findall(text)


def unit_width(
    unit: str,
    font: ImageFont.ImageFont,
    italic_font: ImageFont.ImageFont,
) -> int:
    parsed = parse_asset_unit(unit)
    if parsed is not None:
        name, height_px = parsed
        asset_only = is_asset_only_line(unit)
        dims = scaled_asset_dimensions(
            name, font, asset_only=asset_only, height_px=height_px
        )
        if dims is not None:
            return dims[0]
        return line_width_markup(asset_token_label(
            InlineToken("asset", name, height_px=height_px)
        ), font, italic_font)
    return line_width_markup(unit, font, italic_font)


def line_width_inline(
    text: str,
    font: ImageFont.ImageFont,
    italic_font: ImageFont.ImageFont,
    *,
    asset_only: bool | None = None,
) -> int:
    if "[[" not in text:
        return line_width_markup(text, font, italic_font)
    if asset_only is None:
        asset_only = is_asset_only_line(text)
    total = 0
    prev: InlineToken | None = None
    for token in tokenize_inline_line(text):
        total += inline_token_gap(prev, token)
        if token.kind == "asset":
            dims = asset_token_dimensions(token, font, asset_only=asset_only)
            if dims is not None:
                total += dims[0]
            else:
                total += line_width(font, asset_token_label(token))
        else:
            segment_font = italic_font if token.italic else font
            total += line_width(segment_font, token.value)
        prev = token
    return total


def paste_inline_asset(
    canvas: Image.Image,
    name: str,
    x: int,
    line_y: int,
    font: ImageFont.ImageFont,
    slot_height: int,
    *,
    asset_only: bool = False,
    height_px: int | None = None,
) -> int:
    asset = trimmed_caption_asset(name)
    if asset is None:
        return 0
    dims = scaled_asset_dimensions(
        name, font, asset_only=asset_only, height_px=height_px
    )
    if dims is None:
        return 0
    total_w, height = dims
    content_w = max(1, total_w - INLINE_ASSET_H_PAD * 2)
    resized = asset.resize((content_w, height), Image.LANCZOS)
    paste_x = x + INLINE_ASSET_H_PAD
    ascent, descent = font.getmetrics()
    text_block_h = ascent + descent
    if slot_height > text_block_h:
        y_off = line_y + (slot_height - height) // 2
    else:
        y_off = line_y + max(0, (text_block_h - height) // 2)
    if resized.mode == "RGBA":
        canvas.paste(resized, (paste_x, y_off), resized)
    else:
        canvas.paste(resized, (paste_x, y_off))
    return total_w


def draw_inline_line(
    canvas: Image.Image,
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    italic_font: ImageFont.ImageFont,
    slot_height: int,
    *,
    asset_only: bool = False,
    fill: str = "white",
) -> None:
    x, y = xy
    prev: InlineToken | None = None
    for token in tokenize_inline_line(text):
        x += inline_token_gap(prev, token)
        if token.kind == "asset":
            pasted = paste_inline_asset(
                canvas,
                token.value,
                x,
                y,
                font,
                slot_height,
                asset_only=asset_only,
                height_px=token.height_px,
            )
            if pasted:
                x += pasted
                prev = token
                continue
            fallback = asset_token_label(token)
            draw.text((x, y), fallback, fill=fill, font=font)
            x += line_width(font, fallback)
            prev = token
            continue
        segment_font = italic_font if token.italic else font
        draw.text((x, y), token.value, fill=fill, font=segment_font)
        x += line_width(segment_font, token.value)
        prev = token


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def load_italic_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in ITALIC_FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return load_font(size)


def paired_italic_font(font: ImageFont.ImageFont) -> ImageFont.ImageFont:
    return load_italic_font(getattr(font, "size", 12))


def parse_markup_segments(text: str) -> list[tuple[str, bool]]:
    if "*" not in text:
        return [(text, False)]
    segments: list[tuple[str, bool]] = []
    pos = 0
    for match in ITALIC_MARKUP_RE.finditer(text):
        if match.start() > pos:
            segments.append((text[pos : match.start()], False))
        segments.append((match.group(1), True))
        pos = match.end()
    if pos < len(text):
        segments.append((text[pos:], False))
    return segments if segments else [(text, False)]


def line_width_markup(
    text: str,
    font: ImageFont.ImageFont,
    italic_font: ImageFont.ImageFont,
) -> int:
    return sum(
        line_width(italic_font if is_italic else font, segment)
        for segment, is_italic in parse_markup_segments(text)
    )


def draw_markup_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    italic_font: ImageFont.ImageFont,
    *,
    fill: str = "white",
) -> None:
    x, y = xy
    for segment, is_italic in parse_markup_segments(text):
        segment_font = italic_font if is_italic else font
        draw.text((x, y), segment, fill=fill, font=segment_font)
        x += line_width(segment_font, segment)


def line_width(font: ImageFont.ImageFont, text: str) -> int:
    if not text:
        return 0
    bbox = ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox((0, 0), text, font=font)
    return math.ceil(bbox[2] - bbox[0])


def longest_word_width(
    text: str,
    font: ImageFont.ImageFont,
    italic_font: ImageFont.ImageFont | None = None,
) -> int:
    italic_font = italic_font or paired_italic_font(font)
    units = wrap_units(text)
    if not units:
        return 0
    return max(unit_width(word, font, italic_font) for word in units)


def longest_word_width_preserved(text: str, font: ImageFont.ImageFont) -> int:
    """Longest single word across paragraphs and explicit line breaks."""
    text = text.strip()
    if not text:
        return 0
    italic_font = paired_italic_font(font)
    best = 0
    for paragraph in re.split(r"\n{2,}", text):
        for raw_line in paragraph.split("\n"):
            best = max(best, longest_word_width(raw_line.strip(), font, italic_font))
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
    base_line_height = ascent + descent + LINE_SPACING
    height = 0
    for line in lines:
        if line is PARA_BREAK:
            height += PARAGRAPH_GAP
        elif line == "":
            height += base_line_height
        else:
            height += line_slot_height(line, font, base_line_height)
    return height - LINE_SPACING


def wrap_text(text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    """Wrap at word boundaries only; never split words mid-character."""
    italic_font = paired_italic_font(font)
    max_width = max(max_width - MEASURE_SLACK, 1)
    units = wrap_units(text)
    if not units:
        return [""]

    lines: list[str] = []
    current = ""
    for unit in units:
        if not current:
            current = unit
            continue
        trial = f"{current} {unit}"
        if line_width_inline(trial, font, italic_font) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = unit
    if current:
        lines.append(current)
    return lines


def text_block_size(
    text: str, font: ImageFont.ImageFont, max_width: int
) -> tuple[int, int, list[str | object]]:
    italic_font = paired_italic_font(font)
    lines = layout_text_lines(text, font, max_width)
    if not lines or lines == [""]:
        return 0, 0, [""]

    height = lines_block_height(lines, font)
    drawable = [line for line in lines if line is not PARA_BREAK and line != ""]
    width = (
        max(line_width_inline(str(line), font, italic_font) for line in drawable)
        if drawable
        else 0
    )
    return width, height, lines


def draw_centered_text(
    canvas: Image.Image,
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

    italic_font = paired_italic_font(font)
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
        line_text = str(line)
        slot_h = line_slot_height(line_text, font, line_height)
        line_w = line_width_inline(
            line_text,
            font,
            italic_font,
            asset_only=is_asset_only_line(line_text),
        )
        x = inner_left + max(0, (inner_w - line_w) // 2)
        draw_inline_line(
            canvas,
            draw,
            (x, y),
            line_text,
            font,
            italic_font,
            slot_h,
            asset_only=is_asset_only_line(line_text),
        )
        y += slot_h


def max_font_size(img_w: int, img_h: int) -> int:
    """Upper bound for caption font scaled to image dimensions."""
    return min(max(img_w, img_h) // 10, 120)


def max_font_for_box(inner_w: int, inner_h: int) -> int:
    """Upper bound when binary-searching a font to fill a known box."""
    return max(12, min(120, inner_h))


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


def fit_text_to_box(
    text: str,
    inner_w: int,
    inner_h: int,
    *,
    min_size: int = 12,
    max_size: int | None = None,
) -> tuple[ImageFont.ImageFont, list[str | object]]:
    """Largest font where copy wrapped to the full inner width fits the inner height."""
    text = text.strip()
    if not text:
        return load_font(min_size), [""]

    inner_w = max(inner_w, 32)
    inner_h = max(inner_h, 24)
    if max_size is None:
        max_size = max_font_for_box(inner_w, inner_h)

    lo, hi = min_size, max_size
    best_font = load_font(min_size)
    best_lines: list[str | object] = layout_text_lines(
        text, best_font, inner_w + MEASURE_SLACK
    )

    while lo <= hi:
        mid = (lo + hi) // 2
        font = load_font(mid)
        if longest_word_width_preserved(text, font) > inner_w:
            hi = mid - 1
            continue

        lines = layout_text_lines(text, font, inner_w + MEASURE_SLACK)
        block_h = lines_block_height(lines, font)
        italic_font = paired_italic_font(font)
        drawable = [line for line in lines if line is not PARA_BREAK and line != ""]
        max_line_w = (
            max(line_width_inline(str(line), font, italic_font) for line in drawable)
            if drawable
            else 0
        )

        if block_h <= inner_h and max_line_w <= inner_w:
            best_font = font
            best_lines = lines
            lo = mid + 1
        else:
            hi = mid - 1

    return best_font, best_lines


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

    italic_font = paired_italic_font(font)
    while lo <= hi:
        mid = (lo + hi) // 2
        _, block_h, lines = text_block_size(text, font, mid)
        drawable = [line for line in lines if line is not PARA_BREAK and line != ""]
        max_line_w = (
            max(line_width_inline(str(line), font, italic_font) for line in drawable)
            if drawable
            else 0
        )
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
        italic_font = paired_italic_font(font)
        if max_inner_h is None:
            _, text_h, lines = text_block_size(text, font, max_inner_w + MEASURE_SLACK)
            drawable = [line for line in lines if line is not PARA_BREAK and line != ""]
            max_line_w = (
                max(line_width_inline(str(line), font, italic_font) for line in drawable)
                if drawable
                else 0
            )
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
    text: str,
    img_w: int,
    max_bar_h: int,
    *,
    fixed_bar_h: int | None = None,
) -> tuple[int, ImageFont.ImageFont, list[str | object]]:
    """Top/bottom bar: thickness is bar height; text wraps to image width."""
    text = text.strip()
    if not text:
        return 0, load_font(12), [""]

    if fixed_bar_h is not None:
        bar_h = max(fixed_bar_h, MIN_BAR_PX)
        max_inner_w = max(img_w - PADDING * 2 - MEASURE_SLACK, 32)
        max_inner_h = max(bar_h - PADDING * 2 - MEASURE_SLACK, 24)
        font, lines = fit_text_to_box(text, max_inner_w, max_inner_h)
        return bar_h, font, lines

    max_bar_h = max(max_bar_h, MIN_BAR_PX)
    max_inner_w = max(img_w - PADDING * 2 - MEASURE_SLACK, 32)
    max_inner_h = max(max_bar_h - PADDING * 2 - MEASURE_SLACK, 24)
    font, lines = fit_text_to_box(text, max_inner_w, max_inner_h)

    text_h = lines_block_height(lines, font)
    bar_h = min(max_bar_h, max(MIN_BAR_PX, text_h + PADDING * 2 + MEASURE_SLACK))
    return bar_h, font, lines


def _horizontal_bar_content_width(
    lines: list[str | object], font: ImageFont.ImageFont
) -> int:
    italic_font = paired_italic_font(font)
    drawable = [line for line in lines if line is not PARA_BREAK and line != ""]
    if not drawable:
        return 0
    return max(
        line_width_inline(str(line), font, italic_font) for line in drawable
    )


def layout_horizontal_bar(
    text: str,
    img_h: int,
    max_bar_w: int | None = None,
    *,
    fixed_bar_w: int | None = None,
) -> tuple[int, ImageFont.ImageFont, list[str | object]]:
    """Left/right bar: thickness is bar width; text wraps within bar height."""
    text = text.strip()
    if not text:
        return 0, load_font(12), [""]

    inner_h = max(img_h - PADDING * 2, 32)

    if fixed_bar_w is not None:
        bar_w = max(fixed_bar_w, MIN_BAR_PX)
        max_inner_w = max(bar_w - PADDING * 2 - MEASURE_SLACK, 32)
        font, lines = fit_text_to_box(text, max_inner_w, inner_h)
        return bar_w, font, lines

    bar_cap = max_bar_w if max_bar_w is not None else inner_h
    max_inner_w = max(bar_cap - PADDING * 2 - MEASURE_SLACK, 32)
    font, lines = fit_text_to_box(text, max_inner_w, inner_h)

    text_w = _horizontal_bar_content_width(lines, font)
    bar_w = max(MIN_BAR_PX, text_w + PADDING * 2 + MEASURE_SLACK)
    if max_bar_w is not None:
        bar_w = min(bar_w, max_bar_w)

    inner_w = max(bar_w - PADDING * 2 - MEASURE_SLACK, 32)
    if inner_w < max_inner_w:
        font, lines = fit_text_to_box(text, inner_w, inner_h)

    return bar_w, font, lines


def compose_vertical(
    image: Image.Image,
    text_a: str,
    text_b: str,
    *,
    top_bar_h: int | None = None,
    bottom_bar_h: int | None = None,
) -> Image.Image:
    layout = prepare_vertical_layout(
        image.size[0],
        image.size[1],
        text_a,
        text_b,
        top_bar_h=top_bar_h,
        bottom_bar_h=bottom_bar_h,
    )
    return compose_vertical_with_layout(image, layout)


def layout_quad_caption(
    text: str, panel_w: int, panel_h: int
) -> tuple[ImageFont.ImageFont, list[str | object]]:
    """Fit caption copy inside a single quadrant, using the largest font that fits."""
    text = text.strip()
    if not text:
        return load_font(12), [""]

    max_inner_w = max(panel_w - PADDING * 2 - MEASURE_SLACK, 32)
    max_inner_h = max(panel_h - PADDING * 2 - MEASURE_SLACK, 24)
    font, lines = fit_text_to_box(text, max_inner_w, max_inner_h)
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
            canvas,
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


@dataclass(frozen=True)
class HorizontalLayout:
    left_w: int
    right_w: int
    left_font: ImageFont.ImageFont
    left_lines: list[str | object]
    right_font: ImageFont.ImageFont
    right_lines: list[str | object]


@dataclass(frozen=True)
class VerticalLayout:
    top_h: int
    bottom_h: int
    top_font: ImageFont.ImageFont
    top_lines: list[str | object]
    bottom_font: ImageFont.ImageFont
    bottom_lines: list[str | object]


def prepare_horizontal_layout(
    img_w: int,
    img_h: int,
    text_a: str,
    text_b: str,
    *,
    left_bar_w: int | None = None,
    right_bar_w: int | None = None,
) -> HorizontalLayout:
    base_max_bar_w = min(max(img_w // 3, MIN_BAR_PX), max(img_h // 2, MIN_BAR_PX), 560)
    only_one_side = bool(text_a.strip()) ^ bool(text_b.strip())
    max_bar_w = base_max_bar_w * 2 if only_one_side else base_max_bar_w

    left_w, left_font, left_lines = layout_horizontal_bar(
        text_a, img_h, max_bar_w, fixed_bar_w=left_bar_w
    )
    right_w, right_font, right_lines = layout_horizontal_bar(
        text_b, img_h, max_bar_w, fixed_bar_w=right_bar_w
    )
    return HorizontalLayout(
        left_w, right_w, left_font, left_lines, right_font, right_lines
    )


def compose_horizontal_with_layout(
    image: Image.Image, layout: HorizontalLayout
) -> Image.Image:
    img_w, img_h = image.size
    out_w = layout.left_w + img_w + layout.right_w
    canvas = Image.new("RGB", (out_w, img_h), "black")
    canvas.paste(image, (layout.left_w, 0))

    draw = ImageDraw.Draw(canvas)
    if layout.left_w > 0:
        draw_centered_text(
            canvas, draw, (0, 0, layout.left_w, img_h), layout.left_lines, layout.left_font
        )
    if layout.right_w > 0:
        draw_centered_text(
            canvas,
            draw,
            (layout.left_w + img_w, 0, out_w, img_h),
            layout.right_lines,
            layout.right_font,
        )
    return canvas


def prepare_vertical_layout(
    img_w: int,
    img_h: int,
    text_a: str,
    text_b: str,
    *,
    top_bar_h: int | None = None,
    bottom_bar_h: int | None = None,
) -> VerticalLayout:
    top_max, bot_max = vertical_caption_budgets(img_h, text_a, text_b)
    top_h, top_font, top_lines = layout_vertical_bar(
        text_a, img_w, top_max, fixed_bar_h=top_bar_h
    )
    bot_h, bot_font, bot_lines = layout_vertical_bar(
        text_b, img_w, bot_max, fixed_bar_h=bottom_bar_h
    )
    return VerticalLayout(top_h, bot_h, top_font, top_lines, bot_font, bot_lines)


def compose_vertical_with_layout(
    image: Image.Image, layout: VerticalLayout
) -> Image.Image:
    img_w, img_h = image.size
    out_h = layout.top_h + img_h + layout.bottom_h
    canvas = Image.new("RGB", (img_w, out_h), "black")
    canvas.paste(image, (0, layout.top_h))

    draw = ImageDraw.Draw(canvas)
    if layout.top_h > 0:
        draw_centered_text(
            canvas, draw, (0, 0, img_w, layout.top_h), layout.top_lines, layout.top_font
        )
    if layout.bottom_h > 0:
        draw_centered_text(
            canvas,
            draw,
            (0, layout.top_h + img_h, img_w, out_h),
            layout.bottom_lines,
            layout.bottom_font,
        )
    return canvas


def gif_frame_to_rgb(frame: Image.Image) -> Image.Image:
    rgba = frame.convert("RGBA")
    rgb = Image.new("RGB", rgba.size, (0, 0, 0))
    rgb.paste(rgba, mask=rgba.split()[3])
    return rgb


def is_animated_gif(path: Path) -> bool:
    if path.suffix.lower() != ".gif":
        return False
    try:
        with Image.open(path) as im:
            return int(getattr(im, "n_frames", 1)) > 1
    except OSError:
        return False


def load_gif_frames(path: Path) -> tuple[list[Image.Image], list[int], int]:
    frames: list[Image.Image] = []
    durations: list[int] = []
    with Image.open(path) as im:
        loop = int(im.info.get("loop", 0))
        n_frames = int(getattr(im, "n_frames", 1))
        for index in range(n_frames):
            im.seek(index)
            frames.append(gif_frame_to_rgb(im))
            duration = im.info.get("duration", 100)
            durations.append(int(duration) if duration else 100)
    return frames, durations, loop


def save_animated_gif(
    frames: list[Image.Image],
    path: Path,
    durations: list[int],
    loop: int,
) -> None:
    if not frames:
        raise ValueError("no frames to save")
    normalized = [duration if duration > 0 else 100 for duration in durations]
    if len(normalized) < len(frames):
        normalized.extend([normalized[-1]] * (len(frames) - len(normalized)))
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        duration=normalized[: len(frames)],
        loop=loop,
        optimize=False,
    )


def normalize_frame_size(
    frame: Image.Image, size: tuple[int, int]
) -> Image.Image:
    if frame.size == size:
        return frame
    return frame.resize(size, Image.Resampling.LANCZOS)


def compose_bar_spec_frames(
    frames: list[Image.Image], spec: CaptionSpec
) -> list[Image.Image]:
    if not frames:
        return []

    ref_w, ref_h = frames[0].size
    normalized = [normalize_frame_size(frame, (ref_w, ref_h)) for frame in frames]

    if spec.layout == "vertical":
        layout = prepare_vertical_layout(
            ref_w,
            ref_h,
            spec.text_a,
            spec.text_b,
            top_bar_h=spec.bar_a_px,
            bottom_bar_h=spec.bar_b_px,
        )
        return [compose_vertical_with_layout(frame, layout) for frame in normalized]

    layout = prepare_horizontal_layout(
        ref_w,
        ref_h,
        spec.text_a,
        spec.text_b,
        left_bar_w=spec.bar_a_px,
        right_bar_w=spec.bar_b_px,
    )
    return [compose_horizontal_with_layout(frame, layout) for frame in normalized]


def compose_bar_spec(image: Image.Image, spec: CaptionSpec) -> Image.Image:
    if spec.layout == "vertical":
        layout = prepare_vertical_layout(
            image.size[0],
            image.size[1],
            spec.text_a,
            spec.text_b,
            top_bar_h=spec.bar_a_px,
            bottom_bar_h=spec.bar_b_px,
        )
        return compose_vertical_with_layout(image, layout)
    layout = prepare_horizontal_layout(
        image.size[0],
        image.size[1],
        spec.text_a,
        spec.text_b,
        left_bar_w=spec.bar_a_px,
        right_bar_w=spec.bar_b_px,
    )
    return compose_horizontal_with_layout(image, layout)


def compose_horizontal(
    image: Image.Image,
    text_a: str,
    text_b: str,
    *,
    left_bar_w: int | None = None,
    right_bar_w: int | None = None,
) -> Image.Image:
    layout = prepare_horizontal_layout(
        image.size[0],
        image.size[1],
        text_a,
        text_b,
        left_bar_w=left_bar_w,
        right_bar_w=right_bar_w,
    )
    return compose_horizontal_with_layout(image, layout)


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
BAR_SIZE_INLINE_RE = re.compile(r"^(\d+)\s*px$", re.IGNORECASE)


@dataclass(frozen=True)
class CaptionSpec:
    layout: str
    text_a: str = ""
    text_b: str = ""
    bar_a_px: int | None = None
    bar_b_px: int | None = None
    image_paths: tuple[str, str, str] = ("", "", "")
    caption: str = ""


def parse_bar_size_inline(inline: str) -> int | None:
    match = BAR_SIZE_INLINE_RE.match(inline.strip())
    if match is None:
        return None
    return int(match.group(1))


def parse_sectioned_caption(content: str) -> tuple[dict[str, str], dict[str, int]]:
    sections: dict[str, str] = {}
    bar_sizes: dict[str, int] = {}
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
            bar_size = parse_bar_size_inline(inline)
            if bar_size is not None:
                bar_sizes[current_key] = bar_size
                current_lines = []
            else:
                current_lines = [inline] if inline else []
            continue
        if current_key is not None:
            current_lines.append(line)

    flush()
    return sections, bar_sizes


def parse_caption_file(content: str) -> CaptionSpec:
    sections, bar_sizes = parse_sectioned_caption(content)

    has_quad = all(key in sections for key in ("image1", "image2", "image3", "caption"))
    has_horizontal = "left" in sections or "right" in sections
    has_vertical = "top" in sections or "bottom" in sections

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
            text_a=sections.get("left", ""),
            text_b=sections.get("right", ""),
            bar_a_px=bar_sizes.get("left"),
            bar_b_px=bar_sizes.get("right"),
        )
    if has_vertical:
        return CaptionSpec(
            layout="vertical",
            text_a=sections.get("top", ""),
            text_b=sections.get("bottom", ""),
            bar_a_px=bar_sizes.get("top"),
            bar_b_px=bar_sizes.get("bottom"),
        )

    raise ValueError(
        'caption file needs "image1:" + "image2:" + "image3:" + "caption:", '
        'or at least one of "left:" / "right:" / "top:" / "bottom:"'
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
    set_caption_inserts_root(directory)

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
        output_path = directory / "final.png"
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

    if is_animated_gif(input_path):
        output_path = directory / "final.gif"
        try:
            frames, durations, loop = load_gif_frames(input_path)
            captioned = compose_bar_spec_frames(frames, bar_spec)
            save_animated_gif(captioned, output_path, durations, loop)
        except (OSError, ValueError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
        print(output_path)
        return 0

    output_path = directory / "final.png"
    with Image.open(input_path) as src:
        image = src.convert("RGB")
        result = compose_bar_spec(image, bar_spec)

    result.save(output_path, quality=95)
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
