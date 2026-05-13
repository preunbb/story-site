#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export LOCAL_SD_BACKEND="${LOCAL_SD_BACKEND:-sdxl}"
export LOCAL_SD_MODEL_ID="${LOCAL_SD_MODEL_ID:-stabilityai/stable-diffusion-xl-base-1.0}"
exec ./run_cli.sh "$@"
