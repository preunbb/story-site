#!/usr/bin/env python3
"""
Repaint illegible signage / ticket text on the Courtroom Wedding NSFW flip cover.
Only touches UI-like regions; dragons and nudity are preserved.
Reads courtroom_nsfw_1.png and writes courtroom_nsfw_2.png.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[1]
SRC = REPO / "assets/covers/courtroom_nsfw_1.png"
DST = REPO / "assets/covers/courtroom_nsfw_2.png"

BG_LED = (52, 40, 34)
WHITE_LED = (235, 235, 235)
RED_LED = (240, 45, 55)
RED_GLOW = (120, 15, 25)

VISION_BG = (248, 250, 255)
VISION_HDR = (32, 56, 92)
VISION_ROW = (55, 72, 98)

BULLETIN_BG = (255, 252, 248)
BULLETIN_INK = (42, 42, 46)

# Queue ticket: fully masks the hand-drawn slip (was still visible at edges)
TICKET_RECT = (446, 480, 564, 580)


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def centered_text(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill,
    shadow=None,
) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x, y = cx - w / 2, cy - h / 2
    if shadow:
        draw.text((x + 2, y + 2), text, font=font, fill=shadow)
    draw.text((x, y), text, font=font, fill=fill)


def main() -> None:
    arial_bold = str(Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"))
    arial_blk = str(Path("/System/Library/Fonts/Supplemental/Arial Black.ttf"))
    arial = str(Path("/System/Library/Fonts/Supplemental/Arial.ttf"))

    font_now = load_font(arial_bold, 30)
    font_led_big = load_font(arial_blk, 56)
    font_vision_hdr = load_font(arial_bold, 15)
    font_vision_row = load_font(arial, 13)
    font_vision_small = load_font(arial, 11)
    font_bullet_hdr = load_font(arial_bold, 11)
    font_bullet_line = load_font(arial, 10)
    font_ticket = load_font(arial_bold, 34)

    shutil.copy2(SRC, DST)
    im = Image.open(DST).convert("RGBA")
    w, h = im.size
    draw = ImageDraw.Draw(im)

    # --- LED ---
    draw.rectangle((160, 42, 695, 86), fill=BG_LED + (255,))
    centered_text(draw, 427, 64, "NOW SERVING", font_now, WHITE_LED)
    draw.rectangle((332, 88, 528, 164), fill=BG_LED + (255,))
    centered_text(draw, 430, 126, "B42", font_led_big, RED_GLOW)
    centered_text(draw, 428, 124, "B42", font_led_big, RED_LED)

    # --- Vision chart (covers garbled blue “PESION” banner + eye chart) ---
    vx0, vy0, vx1, vy1 = 12, 138, 128, 448
    draw.rectangle((vx0, vy0, vx1, vy1), fill=VISION_BG + (255,), outline=VISION_HDR, width=2)
    cx = (vx0 + vx1) / 2
    y = vy0 + 14
    centered_text(draw, cx, y, "VISION TEST", font_vision_hdr, VISION_HDR)
    y += 26
    for line, fnt in (
        ("E  F  P", font_vision_row),
        ("T  O  Z", font_vision_row),
        ("L  P  E  D", font_vision_small),
        ("P  E  C  F  D", font_vision_small),
    ):
        centered_text(draw, cx, y, line, fnt, VISION_ROW)
        y += 18

    # --- Bulletin slip ---
    bx0, by0, bx1, by1 = 726, 318, 794, 408
    draw.rectangle((bx0, by0, bx1, by1), fill=BULLETIN_BG + (255,), outline=BULLETIN_INK, width=1)
    lines = [
        "RULES & NOTICES",
        "• Wait for your #",
        "• ID: both parties",
        "• License window",
    ]
    ty = by0 + 8
    centered_text(draw, (bx0 + bx1) / 2, ty + 8, lines[0], font_bullet_hdr, BULLETIN_INK)
    ty += 22
    for ln in lines[1:]:
        centered_text(draw, (bx0 + bx1) / 2, ty, ln, font_bullet_line, BULLETIN_INK)
        ty += 14

    # --- Queue ticket: small white card + single B42 (no flood-fill) ---
    tx0, ty0, tx1, ty1 = TICKET_RECT
    draw.rounded_rectangle(
        (tx0, ty0, tx1, ty1),
        radius=4,
        fill=(255, 255, 255, 255),
        outline=(88, 88, 92, 255),
        width=1,
    )
    centered_text(
        draw,
        (tx0 + tx1) / 2,
        (ty0 + ty1) / 2 + 1,
        "B42",
        font_ticket,
        (22, 22, 26),
    )

    im = im.convert("RGB")
    im.save(DST, format="PNG", optimize=True)
    print(f"Wrote {DST.relative_to(REPO)} ({w}x{h})")


if __name__ == "__main__":
    main()
