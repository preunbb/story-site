# Frame poster

Place catalog art inside an empty picture frame, then composite a grid onto a wall photo.

## Requirements

Python 3 with Pillow (`pip install Pillow`).

## Frame a single poster

```bash
python3 tools/frame-poster/frame_poster.py \
  path/to/empty_frame.png \
  path/to/poster.png \
  -o path/to/framed_poster.png
```

Detects the inner mat window automatically, scales the poster to cover it, and exports a cropped frame with white keyed to transparent (for wall compositing).

## Composite the Judah Luna timelapse gallery wall

```bash
python3 tools/frame-poster/composite_timelapse_wall.py \
  assets/scenes/andrea_and_lucas/ch19_judah_luna_scan_crosssection_timelapse/ch19_judah_luna_scan_crosssection_timelapse_office_bg_v2.png \
  assets/scenes/andrea_and_lucas/ch19_judah_luna_scan_crosssection_timelapse/empty_picture_frame_v1.png \
  assets/scenes/andrea_and_lucas/ch19_judah_luna_scan_crosssection_timelapse \
  -o assets/scenes/andrea_and_lucas/ch19_judah_luna_scan_crosssection_timelapse/ch19_judah_luna_scan_crosssection_timelapse_gallery_wall_v2.png
```

Grid order (left → right, top → bottom): `00_healthy`, `01_bruised`, `02_damaged`, `03_emaciated`, `04_still_barely_alive`, `05_ruptured`.

Framed intermediates are cached in `<phases_dir>/_framed_cache/`.

### Foreground occlusion (frames behind people)

Generate a rembg cutout once (requires the tool venv):

```bash
tools/frame-poster/.venv/bin/python3 - <<'PY'
from pathlib import Path
from rembg import remove
src = Path("assets/scenes/andrea_and_lucas/ch19_judah_luna_scan_crosssection_timelapse/ch19_judah_luna_scan_crosssection_timelapse_office_bg_v2.png")
out = Path("assets/scenes/andrea_and_lucas/ch19_judah_luna_scan_crosssection_timelapse/_foreground_cutout_v1.png")
out.write_bytes(remove(src.read_bytes()))
print(out)
PY
```

The compositor pastes frames + drop shadows on the office photo, then layers the cutout on top so seated figures occlude lower poster edges.
