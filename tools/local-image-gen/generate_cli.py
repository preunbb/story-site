#!/usr/bin/env python3
"""
Offline high-quality generation (no HTTP). Safe for very large step counts / resolutions.

  ./generate_cli.py -p "prompt" --steps 80 --width 768 --height 768 -o out.png
  ./generate_cli.py ... --save-each-step-dir ./steps --save-each-step-every 1

Uses the same env vars as the server (LOCAL_SD_MODEL_ID, LOCAL_SD_SCHEDULER, etc.).
"""

from __future__ import annotations

import argparse
import logging
import random
import sys

import torch

from pipeline_factory import LAST_BUILD, MODEL_ID, build_pipe
from step_saves import make_step_save_callback


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
    p = argparse.ArgumentParser(description="Local SD — long / HQ single image")
    p.add_argument("-p", "--prompt", required=True)
    p.add_argument("-n", "--negative", default="")
    p.add_argument("--steps", type=int, default=50, help="Inference steps (try 50–90)")
    p.add_argument("--width", type=int, default=512)
    p.add_argument("--height", type=int, default=512)
    p.add_argument("--guidance", type=float, default=7.5)
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("-o", "--output", required=True)
    p.add_argument(
        "--save-each-step-dir",
        default=None,
        metavar="DIR",
        help="If set, save a VAE-decoded PNG after each denoising step (slow).",
    )
    p.add_argument(
        "--save-each-step-every",
        type=int,
        default=1,
        metavar="N",
        help="With --save-each-step-dir, only save every Nth step (default 1 = all).",
    )
    args = p.parse_args()

    pipe = build_pipe()
    logging.info("Pipeline: %s", dict(LAST_BUILD))

    seed = args.seed if args.seed is not None else random.randint(0, 2**31 - 1)
    gen_device = "cpu" if pipe.device.type == "mps" else pipe.device.type
    gen = torch.Generator(device=gen_device).manual_seed(seed)
    logging.info(
        "Generating %sx%s steps=%s seed=%s model=%s",
        args.width,
        args.height,
        args.steps,
        seed,
        MODEL_ID,
    )

    cb = None
    if args.save_each_step_dir:
        cb = make_step_save_callback(
            args.save_each_step_dir, every=args.save_each_step_every
        )
        logging.info(
            "Saving step previews to %s (every %s steps)",
            args.save_each_step_dir,
            args.save_each_step_every,
        )

    with torch.inference_mode():
        out = pipe(
            prompt=args.prompt,
            negative_prompt=args.negative or None,
            num_inference_steps=args.steps,
            guidance_scale=args.guidance,
            width=args.width,
            height=args.height,
            generator=gen,
            callback_on_step_end=cb,
        )

    out.images[0].save(args.output, format="PNG")
    logging.info("Saved %s", args.output)
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()
    return 0


if __name__ == "__main__":
    sys.exit(main())
