"""Shared panel discovery and compositing for triptych / quad caption layouts."""

from __future__ import annotations

import re
from pathlib import Path

from PIL import Image

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
PANEL_SEARCH_DIRS = ("raw", "subimages", ".")
ROW_REF_CANDIDATES = (
    "assets/scenes/andrea_and_lucas/ch19_yvette_elastrator_felix_triptych_v6.png",
)
LEFT_RE = re.compile(r"_left_", re.IGNORECASE)
RIGHT_RE = re.compile(r"_right_", re.IGNORECASE)
CENTER_RE = re.compile(r"_center_", re.IGNORECASE)
ROW_TRIPTYCH_RE = re.compile(r"_triptych_v\d+", re.IGNORECASE)


def fit_panel(img: Image.Image, panel_w: int, panel_h: int) -> Image.Image:
    """Cover-crop resize so the panel fills panel_w x panel_h."""
    iw, ih = img.size
    scale = max(panel_w / iw, panel_h / ih)
    nw, nh = int(iw * scale), int(ih * scale)
    resized = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - panel_w) // 2
    top = (nh - panel_h) // 2
    return resized.crop((left, top, left + panel_w, top + panel_h))


def fit_panel_contain(
    img: Image.Image,
    panel_w: int,
    panel_h: int,
    *,
    background: tuple[int, int, int] = (0, 0, 0),
) -> Image.Image:
    """Scale to fit inside the panel without cropping; letterbox on black."""
    iw, ih = img.size
    scale = min(panel_w / iw, panel_h / ih)
    nw, nh = max(int(iw * scale), 1), max(int(ih * scale), 1)
    resized = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGB", (panel_w, panel_h), background)
    canvas.paste(resized, ((panel_w - nw) // 2, (panel_h - nh) // 2))
    return canvas


def compose_row(panels: list[Image.Image], panel_w: int, panel_h: int) -> Image.Image:
    fitted = [fit_panel(panel, panel_w, panel_h) for panel in panels]
    canvas = Image.new("RGB", (panel_w * len(fitted), panel_h))
    for index, panel in enumerate(fitted):
        canvas.paste(panel, (index * panel_w, 0))
    return canvas


def compose_stack(panels: list[Image.Image], panel_w: int, panel_h: int) -> Image.Image:
    fitted = [fit_panel(panel, panel_w, panel_h) for panel in panels]
    canvas = Image.new("RGB", (panel_w, panel_h * len(fitted)))
    for index, panel in enumerate(fitted):
        canvas.paste(panel, (0, index * panel_h))
    return canvas


def compose_top_split(
    left: Image.Image,
    center: Image.Image,
    right: Image.Image,
    panel_w: int,
    panel_h: int,
) -> Image.Image:
    top_w = panel_w * 2
    canvas = Image.new("RGB", (top_w, panel_h * 2))
    canvas.paste(fit_panel(left, panel_w, panel_h), (0, 0))
    canvas.paste(fit_panel(right, panel_w, panel_h), (panel_w, 0))
    canvas.paste(fit_panel(center, top_w, panel_h), (0, panel_h))
    return canvas


def compose_quad_images(
    image1: Image.Image,
    image2: Image.Image,
    image3: Image.Image,
    panel_w: int,
    panel_h: int,
) -> Image.Image:
    """2×2 grid: image1 top-left, image2 top-right, image3 bottom-left (contain)."""
    canvas = Image.new("RGB", (panel_w * 2, panel_h * 2), "black")
    canvas.paste(fit_panel(image1, panel_w, panel_h), (0, 0))
    canvas.paste(fit_panel(image2, panel_w, panel_h), (panel_w, 0))
    canvas.paste(fit_panel_contain(image3, panel_w, panel_h), (0, panel_h))
    return canvas


def is_image(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def iter_panel_candidates(directory: Path) -> list[Path]:
    seen: set[Path] = set()
    candidates: list[Path] = []
    for subdir in PANEL_SEARCH_DIRS:
        root = directory if subdir == "." else directory / subdir
        if not root.is_dir():
            continue
        for path in sorted(root.iterdir()):
            resolved = path.resolve()
            if not is_image(path) or path.stem.lower() == "final" or resolved in seen:
                continue
            seen.add(resolved)
            candidates.append(path)
    return candidates


def pick_unique(matches: list[Path], role: str, directory: Path) -> Path:
    if not matches:
        raise FileNotFoundError(f"No {role} panel image found under {directory}")
    if len(matches) > 1:
        names = ", ".join(path.name for path in matches)
        raise ValueError(f"Multiple {role} panel images under {directory}: {names}")
    return matches[0]


def find_row_triptych(candidates: list[Path]) -> Path | None:
    matches = [
        path
        for path in candidates
        if ROW_TRIPTYCH_RE.search(path.stem)
        and not LEFT_RE.search(path.stem)
        and not RIGHT_RE.search(path.stem)
        and not CENTER_RE.search(path.stem)
    ]
    if not matches:
        return None
    return sorted(matches)[-1]


def extract_center_panel(row_triptych: Path) -> Image.Image:
    with Image.open(row_triptych) as src:
        image = src.convert("RGB")
    width, height = image.size
    panel_w = width // 3
    return image.crop((panel_w, 0, panel_w * 2, height))


def discover_panels(
    directory: Path,
    *,
    center: Path | None = None,
) -> tuple[Path, Path, Path]:
    """Return (left, center, right) panel paths."""
    directory = directory.resolve()
    candidates = iter_panel_candidates(directory)

    left = pick_unique([p for p in candidates if LEFT_RE.search(p.stem)], "left", directory)
    right = pick_unique(
        [p for p in candidates if RIGHT_RE.search(p.stem)], "right", directory
    )

    if center is not None:
        center_path = center.resolve()
        if not is_image(center_path):
            raise FileNotFoundError(f"Center image not found: {center_path}")
        return left, center_path, right

    center_matches = [p for p in candidates if CENTER_RE.search(p.stem)]
    if center_matches:
        return left, pick_unique(center_matches, "center", directory), right

    row_triptych = find_row_triptych(candidates)
    if row_triptych is None:
        raise FileNotFoundError(
            f"{directory} needs a center panel (--center), *_center_* file, "
            "or an existing row triptych (*_triptych_v*.png) to slice from"
        )

    return left, row_triptych, right


def load_panel(path: Path, *, row_triptych_center: Path | None = None) -> Image.Image:
    if row_triptych_center is not None and path == row_triptych_center:
        return extract_center_panel(path)
    with Image.open(path) as src:
        return src.convert("RGB")


def resolve_panel_path(directory: Path, raw: str) -> Path:
    raw = raw.strip()
    if not raw:
        raise ValueError("empty image path")
    path = Path(raw)
    if not path.is_absolute():
        path = (directory / path).resolve()
    if not is_image(path):
        raise FileNotFoundError(f"Panel image not found: {path}")
    return path


def default_reference_size(repo_root: Path) -> tuple[int, int]:
    for rel in ROW_REF_CANDIDATES:
        ref_path = repo_root / rel
        if ref_path.exists():
            with Image.open(ref_path) as ref:
                return ref.size
    return (4624, 1024)


def panel_geometry(reference_size: tuple[int, int], panel_count: int = 3) -> tuple[int, int]:
    ref_w, ref_h = reference_size
    return max(ref_w // panel_count, 1), ref_h


def find_repo_root(start: Path) -> Path:
    for parent in [start, *start.parents]:
        if (parent / "package.json").exists() and (parent / "tools" / "image-caption").is_dir():
            return parent
    return start
