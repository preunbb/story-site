#!/usr/bin/env bash
# Recommended preset for ~16 GB unified memory: fp16 XL weights + VAE upcast (see pipeline_factory defaults).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export LOCAL_SD_BACKEND="${LOCAL_SD_BACKEND:-sdxl}"
export LOCAL_SD_MODEL_ID="${LOCAL_SD_MODEL_ID:-stabilityai/stable-diffusion-xl-base-1.0}"
export LOCAL_SD_DEFAULT_STEPS="${LOCAL_SD_DEFAULT_STEPS:-28}"
export LOCAL_SD_MAX_SIDE="${LOCAL_SD_MAX_SIDE:-1024}"
exec ./run.sh
