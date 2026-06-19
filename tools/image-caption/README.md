# Image caption bars

Adds black bars with centered white text around a source image.

## Directory layout

Point the tool at a folder containing:

| File | Required |
|------|----------|
| One source image (`.png`, `.jpg`, etc.) | yes — any filename **except** `final.*` |
| `caption.txt` | yes — two labelled sections (see below) |

The tool writes `final.png` into the same directory.

### `caption.txt` format

Horizontal side bars — use `left:` and `right:`:

```
left:
First caption block.
Can span multiple lines.

right:
Second caption block.
```

Vertical top/bottom bars — use `top:` and `bottom:`:

```
top:
Caption above the image.

bottom:
Caption below the image.
```

Labels are case-insensitive. A colon is required. Text can start on the next line or inline after the label.

If the directory contains exactly one other `.txt` file (and no `caption.txt`), that file is used instead.

Bar thickness auto-sizes to fit the text (minimum 72px). Font size scales up to fill each bar as large as possible while keeping all lines inside.

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

After adding or updating caption folders, refresh the site index:

```bash
npm run sync:captions
```

Folders whose names start with `HIDDEN_` are skipped by the gallery (useful for drafts or retired captions).
