#!/usr/bin/env python3
"""Composite left / center / right panels into a triptych image.

Directory mode discovers panel files under raw/, subimages/, or the project root.
Filenames must contain _left_ and _right_; center comes from _center_, --center,
or the middle third of an existing row triptych (*_triptych_v*.png without
left/right in the name).

Usage:
  npm run triptych -- assets/captions/yvette-kick/ --layout quad
  python3 tools/image-caption/triptych.py assets/captions/yvette-kick/ --layout row
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from PIL import Image

from panels import (
    ROW_TRIPTYCH_RE,
    compose_quad_images,
    compose_row,
    compose_stack,
    compose_top_split,
    default_reference_size,
    discover_panels,
    find_repo_root,
    load_panel,
    panel_geometry,
)

LAYOUT_CHOICES = ("row", "stack", "top-split", "quad")


def compose_triptych(
    left: Image.Image,
    center: Image.Image,
    right: Image.Image,
    *,
    layout: str,
    reference_size: tuple[int, int],
) -> Image.Image:
    panel_w, panel_h = panel_geometry(reference_size, 3)
    if layout == "stack":
        return compose_stack([left, center, right], panel_w, panel_h)
    if layout == "top-split":
        return compose_top_split(left, center, right, panel_w, panel_h)
    if layout == "quad":
        return compose_quad_images(left, right, center, panel_w, panel_h)
    if layout == "row":
        return compose_row([left, center, right], panel_w, panel_h)
    raise ValueError(f"layout must be one of {LAYOUT_CHOICES}, got {layout!r}")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Composite triptych panels.")
    parser.add_argument(
        "directory",
        nargs="?",
        type=Path,
        default=Path.cwd(),
        help="Caption project directory (default: current working directory)",
    )
    parser.add_argument(
        "--layout",
        choices=LAYOUT_CHOICES,
        default="row",
        help=(
            'Panel arrangement: "row", "stack", "top-split", or "quad" '
            "(2×2 with injury bottom-left; caption quadrant left blank)"
        ),
    )
    parser.add_argument(
        "--center",
        type=Path,
        help="Explicit center panel image (overrides auto-discovery)",
    )
    parser.add_argument(
        "--reference",
        type=Path,
        help="Reference triptych for row dimensions (default: elastrator v6 or 4624x1024)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output image (default: initial.png in the project directory)",
    )
    return parser.parse_args(argv)


def resolve_directory(args: argparse.Namespace, argv: list[str]) -> Path:
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
    repo_root = find_repo_root(directory)

    try:
        left_path, center_path, right_path = discover_panels(
            directory, center=args.center
        )
    except (FileNotFoundError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    row_triptych_center = (
        center_path if ROW_TRIPTYCH_RE.search(center_path.stem) else None
    )
    try:
        left = load_panel(left_path)
        center = load_panel(center_path, row_triptych_center=row_triptych_center)
        right = load_panel(right_path)
    except OSError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.reference is not None:
        with Image.open(args.reference) as ref:
            reference_size = ref.size
    else:
        reference_size = default_reference_size(repo_root)

    result = compose_triptych(
        left, center, right, layout=args.layout, reference_size=reference_size
    )

    output_path = (args.output or directory / "initial.png").resolve()
    result.save(output_path, quality=95)
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
