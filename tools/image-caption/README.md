# Image caption bars

Adds caption bars around a source image. Bar background matches the approximate
center color of the source; text is black on light bars and white on dark bars
(luminance threshold 0.4 — black more often than a mid-gray split). Body copy
uses a sensual readable serif (Hoefler Text when available).

## Directory layout

Point the tool at a folder containing:

| File | Required |
|------|----------|
| One source image (`.png`, `.jpg`, etc.) | yes — any filename **except** `final.*` |
| `caption.txt` | yes — two labelled sections (see below) |

The tool writes `final.png` into the same directory, or `final.gif` when the source is an animated GIF.

### `caption.txt` format

**Bar layouts** — one composite image plus labelled caption sections.

Horizontal side bars — use `left:` and/or `right:` (either or both):

```
right:
Caption on one side only.
```

```
left:
First caption block.

right:
Second caption block.
```

Set a fixed bar width (in pixels) on the label line — bar height still matches the image.
Optionally force text color with `white` or `black` (default: auto from background luminance):

```
left:400px
First caption block.

right:200px:black
Second caption block.
```

```
right:800px:white
Light bar? Force white text anyway.
```

```
caption:black
Quad caption with forced black text.
```

Vertical top/bottom bars — use `top:` and `bottom:` (same `NNNpx` syntax sets bar height):

```
top:120px
Caption above the image.

bottom:
Caption below the image.
```

**Quad layout** — three panel images in a 2×2 grid; caption text fills the fourth quadrant (bottom-right). Leave an image line blank to auto-discover panels from `raw/` or `subimages/` (`*_left_*`, `*_right_*`, center injury asset).

```
image1:
raw/ch19_yvette_knee_strike_triptych_left_v1.png

image2:

image3:

caption:
*KICK*

I know it seems a bit untraditional…
```

Panel order: **image1** = top-left (Yvette), **image2** = top-right (patient), **image3** = bottom-left (injury, letterboxed — never cropped). **caption** = bottom-right quadrant.

```bash
npm run image-caption -- assets/captions/yvette-kick/
```

Quad mode writes `final.png` directly — no separate composite step required.

Labels are case-insensitive. A colon is required. Text can start on the next line or inline after the label.

Within each section, single line breaks start a new line and blank lines separate paragraphs.

Wrap text in `*asterisks*` to render it in italics (e.g. `*crunch*`).

Insert inline wordart and clipart with `[[name]]` — assets live in `assets/caption_inserts/`.

**Intensity ladder** (15 assets: 5 words × 3 levels):

| Tag | Meaning |
|-----|---------|
| `[[crunch_1]]` … `[[splut_3]]` | `{word}_{intensity}` — e.g. `crunch_2`, `pop_3` |
| **1** | Cartoon hit — black/blue bruise theme |
| **2** | Crushing blow / permanent damage — wetness, faint pink-white, dead cells |
| **3** | Rupture / pop — pink-white spray, X-eyed defeated cells |

Words: `crunch`, `squick`, `pop`, `splish`, `splut`.

**Ballsack clipart decay ladder** (`testicles_1` … `testicles_5`):

| Level | State |
|-------|--------|
| **1** | Healthy intact scrotum |
| **2** | Slightly bruised sack |
| **3** | Badly bruised sack |
| **4** | Falling apart / leaking |
| **5** | Fully popped / ruptured |

Use as `[[testicles_3]]` or `[[testicles_5]]:64px`.

Set an explicit height with `[[name]]:40px` (height in pixels). Unknown tags render as literal text.

Legacy single-file assets (`pop.png`, `crunch_v2.png`, etc.) still work if present.

If the directory contains exactly one other `.txt` file (and no `caption.txt`), that file is used instead.

Bar thickness auto-sizes to fit the text (minimum 72px). Font size scales up to fill each bar's available area — copy wraps to the full inner width and the largest type that fits the height is chosen. Fixed `NNNpx` bars use the same fill logic.

## Usage

From inside a caption project folder (uses the current directory):

```bash
cd assets/captions/mommy-next-day
npm run image-caption
```

Or pass a directory explicitly:

```bash
npm run image-caption -- assets/captions/mommy-next-day/
```

```bash
python3 tools/image-caption/caption.py
python3 tools/image-caption/caption.py assets/captions/mommy-next-day/
```

Requires Python 3 with [Pillow](https://pypi.org/project/pillow/) (`pip install Pillow`).

To show a caption on the site, add its folder name to `data/captions.js`. The gallery loads `assets/captions/<folder>/final.png` by default. Animated outputs use `final.gif` — register them as `{ slug: "folder-name", media: "final.gif" }`.

## Triptych compositing

`triptych.py` stitches three panel images into one composite before captioning.

### Panel discovery

Put left and right panels in `raw/`, `subimages/`, or the project root. Filenames must contain `_left_` and `_right_`. The center panel is resolved in order:

1. `--center path/to/image.png`
2. A file whose name contains `_center_`
3. The middle third of an existing row triptych (`*_triptych_v*.png` without left/right in the name)

Writes `initial.png` by default (use `--output` to override, e.g. `final_raw.png`).

### Layout

- **`row`** (default) — three panels side by side (4624×1024 when using the standard reference).
- **`stack`** — three panels stacked vertically (~1541×3072).
- **`top-split`** — left and right on top; center injury spans full width below (~3082×2048).
- **`quad`** — 2×2 grid matching the quad caption layout (caption quadrant left blank).

For quad captions with text, use `npm run image-caption` and the `image1`/`image2`/`image3`/`caption:` format instead.

When a caption folder has many images, name the bare composite `initial.png` or `final_raw.png` so `caption.py` picks it as the source.
