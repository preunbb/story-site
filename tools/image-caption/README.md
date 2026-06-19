# Image caption bars

Adds black bars with centered white text around a source image.

## Layouts

| `--layout`     | Bar placement | `--text-a` | `--text-b` |
|----------------|---------------|------------|------------|
| `vertical`     | top + bottom  | top bar    | bottom bar |
| `horizontal`   | left + right  | left bar   | right bar  |

Bar thickness auto-sizes to fit the text (minimum 72px). Text wraps to the image width (vertical) or height (horizontal).

## Usage

```bash
npm run image-caption -- assets/misc/photo.png \
  -o assets/misc/photo_caption.png \
  --layout vertical \
  --text-a "When she explains ruptured gonadal integrity like it's weather." \
  --text-b "The boys: sweating. The girls: blushing."
```

```bash
python3 tools/image-caption/caption.py input.png -o output.png \
  --layout horizontal \
  --text-a "Before" \
  --text-b "After"
```

If `-o` is omitted, writes `<stem>_caption<ext>` next to the input file.

Requires Python 3 with [Pillow](https://pypi.org/project/pillow/) (`pip install Pillow`).
