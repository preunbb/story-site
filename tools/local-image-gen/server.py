"""
Local Stable Diffusion HTTP server for Apple Silicon (MPS).

POST /generate with JSON body → PNG bytes.
First run downloads the model from Hugging Face (~4GB for SD 1.5).

Environment:
  LOCAL_SD_BACKEND — sd15 | sdxl (default sd15)
  LOCAL_SD_MODEL_ID — HF repo (defaults per backend)
  LOCAL_SD_PRECISION — auto | fp16 | fp32 (default auto)
  LOCAL_SD_UPCAST_VAE — 1 | 0 | unset (unset = auto: on for fp16 weights)
  LOCAL_SD_HOST / LOCAL_SD_PORT — bind address (default 127.0.0.1:8787)
  LOCAL_SD_SCHEDULER — dpmpp | euler_a | pretrained (default: dpmpp = DPM++ 2M Karras)

  POST /generate optional: save_each_step_dir, save_each_step_every — write VAE-decoded PNG per step (slow).
"""

from __future__ import annotations

import io
import logging
import os
import random
from contextlib import asynccontextmanager
from typing import Any

import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from pipeline_factory import LAST_BUILD, MODEL_ID, build_pipe
from step_saves import make_step_save_callback

logger = logging.getLogger("local_sd")

HOST = os.environ.get("LOCAL_SD_HOST", "127.0.0.1")
PORT = int(os.environ.get("LOCAL_SD_PORT", "8787"))

_pipe = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _pipe
    logging.basicConfig(level=logging.INFO)
    _pipe = build_pipe()
    logger.info("Ready — listening on http://%s:%s", HOST, PORT)
    yield
    _pipe = None


app = FastAPI(title="Local SD (Apple Silicon)", lifespan=lifespan)

_DEFAULT_STEPS = int(os.environ.get("LOCAL_SD_DEFAULT_STEPS", "40"))
_MAX_STEPS = int(os.environ.get("LOCAL_SD_MAX_STEPS", "200"))
_MAX_SIDE = int(os.environ.get("LOCAL_SD_MAX_SIDE", "1024"))


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000)
    negative_prompt: str = ""
    steps: int = Field(default=_DEFAULT_STEPS, ge=1, le=_MAX_STEPS)
    width: int = Field(default=512, ge=256, le=_MAX_SIDE)
    height: int = Field(default=512, ge=256, le=_MAX_SIDE)
    seed: int | None = Field(default=None, description="Random if omitted")
    guidance_scale: float = Field(default=7.5, ge=1.0, le=20.0)
    save_each_step_dir: str | None = Field(
        default=None,
        description="If set, writes VAE-decoded PNGs per denoising step into this directory (slow).",
    )
    save_each_step_every: int = Field(
        default=1,
        ge=1,
        description="With save_each_step_dir, save only every Nth step.",
    )


@app.get("/health")
def health() -> dict[str, Any]:
    body: dict[str, Any] = {
        "ok": True,
        "device": "mps" if torch.backends.mps.is_available() else "cpu",
        "model_id": MODEL_ID,
        "default_steps": _DEFAULT_STEPS,
        "max_steps": _MAX_STEPS,
        "max_side": _MAX_SIDE,
    }
    body.update(LAST_BUILD)
    return body


@app.post("/generate")
def generate(body: GenerateRequest) -> Response:
    if _pipe is None:
        raise HTTPException(status_code=503, detail="Pipeline not loaded")

    seed = body.seed if body.seed is not None else random.randint(0, 2**31 - 1)
    gen_device = "cpu" if _pipe.device.type == "mps" else _pipe.device.type
    gen = torch.Generator(device=gen_device).manual_seed(seed)

    cb = None
    if body.save_each_step_dir:
        cb = make_step_save_callback(
            body.save_each_step_dir, every=body.save_each_step_every
        )

    try:
        with torch.inference_mode():
            out = _pipe(
                prompt=body.prompt,
                negative_prompt=body.negative_prompt or None,
                num_inference_steps=body.steps,
                guidance_scale=body.guidance_scale,
                width=body.width,
                height=body.height,
                generator=gen,
                callback_on_step_end=cb,
            )
    except Exception as e:
        logger.exception("Generation failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    image = out.images[0]
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={"X-Seed": str(seed)},
    )


def main() -> None:
    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
        reload=False,
        log_level="info",
        timeout_keep_alive=7200,
    )


if __name__ == "__main__":
    main()
