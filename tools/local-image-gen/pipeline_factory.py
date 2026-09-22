"""
Shared pipeline construction for local SD (server + CLI).

Backends:
  LOCAL_SD_BACKEND=sd15   — Stable Diffusion 1.x (default)
  LOCAL_SD_BACKEND=sdxl  — Stable Diffusion XL base (~16 GB RAM: fp16 + VAE tricks)

Safety checker is always disabled (uncensored inference — lawful use is on you).
"""

from __future__ import annotations

import logging
import os
from typing import Any

import torch
from diffusers import (
    DPMSolverMultistepScheduler,
    EulerAncestralDiscreteScheduler,
    StableDiffusionPipeline,
    StableDiffusionXLPipeline,
)

logger = logging.getLogger("local_sd")

BACKEND = os.environ.get("LOCAL_SD_BACKEND", "sd15").strip().lower()
if BACKEND not in ("sd15", "sdxl"):
    logger.warning("Unknown LOCAL_SD_BACKEND=%r; using sd15", BACKEND)
    BACKEND = "sd15"

_DEFAULT_SD15 = "runwayml/stable-diffusion-v1-5"
_DEFAULT_SDXL = "stabilityai/stable-diffusion-xl-base-1.0"
MODEL_ID = os.environ.get(
    "LOCAL_SD_MODEL_ID",
    _DEFAULT_SDXL if BACKEND == "sdxl" else _DEFAULT_SD15,
)

_SCHEDULER = os.environ.get("LOCAL_SD_SCHEDULER", "dpmpp").lower()
if _SCHEDULER not in ("dpmpp", "euler_a", "pretrained"):
    logger.warning("Unknown LOCAL_SD_SCHEDULER=%r; using dpmpp", _SCHEDULER)
    _SCHEDULER = "dpmpp"

# auto | fp16 | fp32
_PRECISION = os.environ.get("LOCAL_SD_PRECISION", "auto").strip().lower()
if _PRECISION not in ("auto", "fp16", "fp32"):
    logger.warning("Unknown LOCAL_SD_PRECISION=%r; using auto", _PRECISION)
    _PRECISION = "auto"

_UCAST_RAW = os.environ.get("LOCAL_SD_UPCAST_VAE", "").strip().lower()
if _UCAST_RAW in ("0", "false", "no"):
    _UPCAST_MODE: bool | None = False
elif _UCAST_RAW in ("1", "true", "yes"):
    _UPCAST_MODE = True
else:
    _UPCAST_MODE = None  # auto


def pick_device(*, backend: str) -> tuple[str, torch.dtype]:
    """Return (device_string, torch_dtype_for_weights)."""
    if torch.backends.mps.is_available():
        device = "mps"
        if _PRECISION == "fp32":
            return device, torch.float32
        if _PRECISION == "fp16":
            return device, torch.float16
        # auto
        if backend == "sd15":
            # fp32 VAE decode on MPS avoids the classic SD1.5 NaN issues.
            return device, torch.float32
        # SDXL: fp16 weights are the realistic default for ~16 GB unified memory.
        return device, torch.float16

    logger.warning("MPS not available; using CPU (very slow).")
    if _PRECISION == "fp16":
        return "cpu", torch.float16
    return "cpu", torch.float32


def _should_upcast_vae(*, backend: str, dtype: torch.dtype) -> bool:
    if _UPCAST_MODE is True:
        return True
    if _UPCAST_MODE is False:
        return False
    # auto: fp16 weights → decode VAE in fp32 (fewer NaNs / rainbow junk on MPS).
    return dtype == torch.float16


def _attach_scheduler(pipe: StableDiffusionPipeline | StableDiffusionXLPipeline, device: str) -> None:
    if _SCHEDULER == "pretrained":
        if device == "mps":
            try:
                pipe.scheduler = pipe.scheduler.__class__.from_config(
                    pipe.scheduler.config
                )
            except Exception as e:
                logger.debug("Scheduler reinit skipped: %s", e)
        return

    if _SCHEDULER == "euler_a":
        pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(
            pipe.scheduler.config,
        )
        logger.info("Scheduler: Euler a")
        return

    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config,
        use_karras_sigmas=True,
        algorithm_type="dpmsolver++",
    )
    logger.info("Scheduler: DPM++ 2M Karras")


def _memory_config_sd15(pipe: StableDiffusionPipeline) -> None:
    pipe.enable_attention_slicing()
    if hasattr(pipe.vae, "enable_slicing"):
        pipe.vae.enable_slicing()
    if hasattr(pipe.vae, "enable_tiling"):
        pipe.vae.enable_tiling()


def _memory_config_sdxl(pipe: StableDiffusionXLPipeline) -> None:
    pipe.enable_attention_slicing()
    # XL benefits strongly from these on Apple Silicon unified memory:
    if hasattr(pipe.vae, "enable_slicing"):
        pipe.vae.enable_slicing()
    if hasattr(pipe.vae, "enable_tiling"):
        pipe.vae.enable_tiling()


# Populated by build_pipe() for /health and logs.
LAST_BUILD: dict[str, Any] = {}


def build_pipe() -> StableDiffusionPipeline | StableDiffusionXLPipeline:
    device, dtype = pick_device(backend=BACKEND)
    upcast_vae = _should_upcast_vae(backend=BACKEND, dtype=dtype)

    logger.info(
        "Loading backend=%s model=%s device=%s dtype=%s upcast_vae=%s",
        BACKEND,
        MODEL_ID,
        device,
        dtype,
        upcast_vae,
    )

    common_kw: dict[str, Any] = dict(
        torch_dtype=dtype,
        safety_checker=None,
        requires_safety_checker=False,
        use_safetensors=True,
    )
    if dtype == torch.float16:
        common_kw["variant"] = "fp16"

    # Never assign `pipe.upcast_vae = True` — in current Diffusers, `upcast_vae` is a *method*
    # on XL pipelines (`self.upcast_vae()` during decode); clobbering it causes
    # "'bool' object is not callable". Prefer explicit VAE dtype:
    _vae_ft = torch.float32 if upcast_vae else None

    if BACKEND == "sd15":
        pipe = StableDiffusionPipeline.from_pretrained(MODEL_ID, **common_kw)
        pipe = pipe.to(device)
        if _vae_ft is not None:
            pipe.vae.to(dtype=_vae_ft)
        _memory_config_sd15(pipe)
    else:
        pipe = StableDiffusionXLPipeline.from_pretrained(MODEL_ID, **common_kw)
        pipe = pipe.to(device)
        if _vae_ft is not None:
            pipe.vae.to(dtype=_vae_ft)
        _memory_config_sdxl(pipe)

    _attach_scheduler(pipe, device)

    LAST_BUILD.clear()
    LAST_BUILD.update(
        {
            "backend": BACKEND,
            "model_id": MODEL_ID,
            "device": device,
            "dtype": str(dtype),
            "upcast_vae": upcast_vae,
            "scheduler": _SCHEDULER,
        }
    )
    return pipe
