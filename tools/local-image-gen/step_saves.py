"""
Save a decoded PNG after each diffusion step (or every Nth step).

Uses the pipeline VAE; decoding every step is much slower than inference alone.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Callable

import torch

logger = logging.getLogger("local_sd.steps")

StepEnd = Callable[..., dict[str, Any]]


def make_step_save_callback(
    out_dir: str | Path,
    *,
    every: int = 1,
) -> StepEnd:
    """Returns callback_on_step_end suitable for StableDiffusionPipeline.__call__."""
    root = Path(out_dir).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    if every < 1:
        raise ValueError("every must be >= 1")

    def callback_on_step_end(
        pipeline,
        step_index: int,
        timestep,
        callback_kwargs: dict[str, Any],
    ) -> dict[str, Any]:
        if step_index % every != 0:
            return {}
        latents = callback_kwargs.get("latents")
        if latents is None:
            return {}
        lat = latents.to(dtype=pipeline.vae.dtype)
        try:
            with torch.inference_mode():
                image = pipeline.vae.decode(
                    lat / pipeline.vae.config.scaling_factor,
                    return_dict=False,
                )[0]
            pil = pipeline.image_processor.postprocess(image, output_type="pil")[0]
            t_int = int(timestep) if timestep is not None else 0
            path = root / f"step_{step_index:04d}_t{t_int:05d}.png"
            pil.save(path)
            logger.info("Wrote %s", path)
        except Exception:
            logger.exception("Failed saving step %s preview", step_index)
        return {}

    return callback_on_step_end
