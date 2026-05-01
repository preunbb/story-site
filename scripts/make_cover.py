"""Generate a story cover JPEG with a title at the top and "by Preun BB" at the bottom.

Looks up the cover and title for the given story id from data/stories.js,
copies the existing cover artwork without scaling or cropping, extends the
canvas (filling the new edges by stretching/blurring the existing edge
pixels) until it is at least 1000x625 px, downscales if any side exceeds
10000 px, and overlays the title at the top and the author tagline at the
bottom in a consistent font. Output is always a JPEG.

Examples:
    .venv-crop/bin/python3 scripts/make_cover.py 5
    .venv-crop/bin/python3 scripts/make_cover.py 5 --title "Battle Royale"
    .venv-crop/bin/python3 scripts/make_cover.py 5 -o dist/covers/arena_1.jpg
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

# Reuse the existing canvas-extension helper.
sys.path.insert(0, str(SCRIPT_DIR))
from extend_canvas import extend as extend_canvas_to_min  # type: ignore  # noqa: E402

MIN_W = 1000
MIN_H = 625
MAX_DIM = 10000
DEFAULT_AUTHOR = "by Preun BB"

# A single consistent typographic voice across every generated cover.
# Optima is a humanist sans-serif: upright, highly readable, but with subtle
# calligraphic stroke modulation (thicker at the bowls, tapered at the joins)
# that keeps it from feeling sterile or geometric the way Arial does. It's
# the typeface used on the Vietnam Veterans Memorial and a lot of mid-century
# literary book covers — serious, elegant, and warm without being fussy.
TITLE_FONT_FACE = (
    "/System/Library/Fonts/Optima.ttc",
    0,  # Optima.ttc indices: 0=Regular, 1=Bold, 2=Italic, 3=Bold Italic, 4=ExtraBlack
)
TITLE_FONT_FALLBACKS = [
    ("/System/Library/Fonts/Supplemental/Baskerville.ttc", 0),  # Regular
    ("/System/Library/Fonts/Supplemental/Hoefler Text.ttc", 0),
]
AUTHOR_FONT_FACE = (
    "/System/Library/Fonts/Optima.ttc",
    0,
)
AUTHOR_FONT_FALLBACKS = [
    ("/System/Library/Fonts/Supplemental/Baskerville.ttc", 0),
    ("/System/Library/Fonts/Supplemental/Hoefler Text.ttc", 0),
]

# Margin / palette tuning for the "soft-erotic-but-dangerous" vibe.
MARGIN_BG = (10, 6, 8)  # near-black with the faintest warm-blood undertone
TITLE_FILL = (236, 218, 184)  # warm candlelit ivory
TITLE_GLOW = (96, 12, 20, 200)  # deep wine glow — looks like dried blood
AUTHOR_FILL = (198, 174, 144)  # subdued cream, lower-key than the title
AUTHOR_GLOW = (48, 6, 12, 170)


# ---------- font / drawing helpers ----------

FontFace = tuple[str, int]  # (path, font_index)


def load_font(face: FontFace, fallbacks: list[FontFace], size: int) -> ImageFont.FreeTypeFont:
    last_err: Exception | None = None
    for path, idx in [face, *fallbacks]:
        try:
            return ImageFont.truetype(path, size=size, index=idx)
        except Exception as exc:  # noqa: BLE001
            last_err = exc
    raise RuntimeError(f"could not load any font from {[face, *fallbacks]}: {last_err}")


def measure(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return int(bbox[2] - bbox[0]), int(bbox[3] - bbox[1])


def fit_font(
    face: FontFace,
    fallbacks: list[FontFace],
    text: str,
    max_width: int,
    target_size: int,
    min_size: int = 14,
) -> ImageFont.FreeTypeFont:
    """Shrink the font 1pt at a time until the rendered text fits within max_width."""
    size = target_size
    while size > min_size:
        font = load_font(face, fallbacks, size)
        left, _, right, _ = font.getbbox(text)
        if right - left <= max_width:
            return font
        size -= 1
    return load_font(face, fallbacks, min_size)


def draw_text_with_glow(
    canvas: Image.Image,
    text: str,
    font: ImageFont.FreeTypeFont,
    xy: tuple[int, int],
    fill: tuple[int, int, int],
    glow: tuple[int, int, int, int],
    glow_blur: int = 8,
) -> None:
    """Draw text with a soft colored glow behind it (no offset — symmetric halo)."""
    glow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow_layer)
    gdraw.text(xy, text, font=font, fill=glow)
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(glow_blur))
    canvas.alpha_composite(glow_layer)

    text_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    tdraw = ImageDraw.Draw(text_layer)
    tdraw.text(xy, text, font=font, fill=fill + (255,))
    canvas.alpha_composite(text_layer)


# ---------- story metadata ----------

def lookup_story(story_id: int) -> dict:
    """Return {id, title, cover} for the given story id by evaluating data/stories.js."""
    js = """
const { readFileSync } = require('fs');
const vm = require('vm');
const code = readFileSync(process.argv[1], 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const target = Number(process.argv[2]);
const s = (sandbox.window.DATA_STORIES || []).find(x => Number(x.id) === target);
if (!s) { console.error('no story with id ' + target); process.exit(2); }
process.stdout.write(JSON.stringify({ id: s.id, title: s.title, cover: s.cover }));
"""
    proc = subprocess.run(
        ["node", "-e", js, str(REPO_ROOT / "data" / "stories.js"), str(story_id)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise SystemExit((proc.stderr or "stories.js lookup failed").strip())
    return json.loads(proc.stdout)


def slugify(s: str) -> str:
    out: list[str] = []
    prev_dash = False
    for ch in s.lower():
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        else:
            if not prev_dash:
                out.append("-")
            prev_dash = True
    return "".join(out).strip("-")


# ---------- canvas sizing ----------

def size_canvas(src: Path, dst: Path) -> tuple[int, int]:
    """Make sure the image is between MIN_W x MIN_H and MAX_DIM in any direction.

    The artwork is never cropped: we downscale only if a side exceeds MAX_DIM,
    then extend the canvas (preserving the original pixels in the middle) to
    reach the minimum dimensions. Returns the final (width, height) saved at dst.
    """
    with Image.open(src) as img:
        w, h = img.size

    capped_path: Path | None = None
    if max(w, h) > MAX_DIM:
        scale = MAX_DIM / max(w, h)
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))
        with Image.open(src) as img:
            scaled = img.convert("RGB").resize((new_w, new_h), Image.Resampling.LANCZOS)
        capped_path = dst.with_suffix(".__capped.jpg")
        capped_path.parent.mkdir(parents=True, exist_ok=True)
        scaled.save(capped_path, format="JPEG", quality=95, optimize=True)
        src_for_extend: Path = capped_path
    else:
        src_for_extend = src

    final_w, final_h, _, _ = extend_canvas_to_min(
        src_for_extend, dst, min_w=MIN_W, min_h=MIN_H
    )

    if capped_path is not None:
        capped_path.unlink(missing_ok=True)
    return final_w, final_h


# ---------- title / author overlay ----------

def render_overlays(image_path: Path, output_path: Path, title: str, author: str | None) -> None:
    """Place `title` in a dark margin above the artwork (and the byline in a
    matching margin below it) so the original image is never overwritten."""
    artwork = Image.open(image_path).convert("RGB")
    art_w, art_h = artwork.size

    # Margins are sized as a fraction of the artwork height so they scale with
    # the cover. Title margin is more generous than the byline margin.
    top_margin = max(96, int(art_h * 0.17))
    bottom_margin = max(56, int(art_h * 0.10)) if author else 0

    canvas_w = art_w
    canvas_h = art_h + top_margin + bottom_margin

    canvas = Image.new("RGB", (canvas_w, canvas_h), MARGIN_BG)
    canvas.paste(artwork, (0, top_margin))

    # A whisper-thin wine-red rule between each margin and the artwork — this
    # is what sells the "blade against velvet" feel without being heavy.
    rule = Image.new("RGB", (canvas_w, max(1, canvas_h // 900)), (90, 14, 22))
    canvas.paste(rule, (0, top_margin - rule.height))
    if bottom_margin:
        canvas.paste(rule, (0, top_margin + art_h))

    canvas = canvas.convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    side_pad = int(canvas_w * 0.05)
    max_text_w = canvas_w - 2 * side_pad

    # --- Title in the top margin (Didot italic, warm ivory + wine glow) ---
    target_title_size = int(top_margin * 0.55)
    title_font = fit_font(
        TITLE_FONT_FACE, TITLE_FONT_FALLBACKS, title, max_text_w, target_title_size, min_size=22
    )
    tw, th = measure(draw, title, title_font)
    tx = (canvas_w - tw) // 2
    # Italic faces report ascent/descent with extra vertical slack; nudge up
    # slightly for true optical centering inside the margin.
    ty = (top_margin - th) // 2 - int(top_margin * 0.06)
    draw_text_with_glow(
        canvas, title, title_font, (tx, ty),
        fill=TITLE_FILL,
        glow=TITLE_GLOW,
        glow_blur=max(4, int(top_margin * 0.06)),
    )

    # --- Byline in the bottom margin, same family but smaller and quieter ---
    if author:
        target_author_size = int(bottom_margin * 0.42)
        author_font = fit_font(
            AUTHOR_FONT_FACE, AUTHOR_FONT_FALLBACKS, author, max_text_w,
            target_author_size, min_size=14,
        )
        aw, ah = measure(draw, author, author_font)
        ax = (canvas_w - aw) // 2
        ay = canvas_h - bottom_margin + (bottom_margin - ah) // 2 - int(bottom_margin * 0.08)
        draw_text_with_glow(
            canvas, author, author_font, (ax, ay),
            fill=AUTHOR_FILL,
            glow=AUTHOR_GLOW,
            glow_blur=max(3, int(bottom_margin * 0.06)),
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(
        output_path, format="JPEG", quality=92, optimize=True, progressive=True
    )


# ---------- entrypoint ----------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("story_id", type=int, help="Story id from data/stories.js.")
    parser.add_argument(
        "--title",
        default=None,
        help="Override the title text. Defaults to the story's title from stories.js.",
    )
    parser.add_argument(
        "--author",
        default=DEFAULT_AUTHOR,
        help=f"Author tagline at the bottom (default: {DEFAULT_AUTHOR!r}). Pass an empty "
        "string to omit it.",
    )
    parser.add_argument(
        "--output", "-o", default=None,
        help="Output JPEG path. Default: dist/covers/<story_slug>.jpg.",
    )
    args = parser.parse_args()

    story = lookup_story(args.story_id)
    cover_rel = story.get("cover")
    if not cover_rel:
        raise SystemExit(f"story {story['id']} has no cover field in data/stories.js")
    cover_path = (REPO_ROOT / cover_rel).resolve()
    if not cover_path.is_file():
        raise SystemExit(f"cover image not found: {cover_path}")

    title_text = args.title if args.title is not None else story["title"]

    if args.output:
        output_path = Path(args.output).resolve()
    else:
        # When --title is supplied, slug the output filename from it too so
        # `dist/covers/<slug>.jpg` lines up with the EPUB's <slug>.epub.
        slug = slugify(title_text) or f"story-{story['id']}"
        output_path = (REPO_ROOT / "dist" / "covers" / f"{slug}.jpg").resolve()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sized_path = output_path.with_name(output_path.stem + ".__sized.jpg")

    try:
        final_w, final_h = size_canvas(cover_path, sized_path)
        render_overlays(sized_path, output_path, title_text, args.author or None)
    finally:
        sized_path.unlink(missing_ok=True)

    print(
        f"[ok] story {story['id']} '{story['title']}' -> {output_path} "
        f"({final_w}x{final_h})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
