#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  echo "Run ./bootstrap.sh first." >&2
  exit 1
fi

# shellcheck source=/dev/null
source .venv/bin/activate
export LOCAL_SD_HOST="${LOCAL_SD_HOST:-127.0.0.1}"
export LOCAL_SD_PORT="${LOCAL_SD_PORT:-8787}"
export LOCAL_SD_MODEL_ID="${LOCAL_SD_MODEL_ID:-runwayml/stable-diffusion-v1-5}"

exec python server.py
