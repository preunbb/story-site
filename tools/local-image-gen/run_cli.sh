#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
[[ -d .venv ]] || { echo "Run ./bootstrap.sh first." >&2; exit 1; }
# shellcheck source=/dev/null
source .venv/bin/activate
exec python generate_cli.py "$@"
