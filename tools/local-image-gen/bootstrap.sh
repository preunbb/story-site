#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PY="${PYTHON312:-/opt/homebrew/bin/python3.12}"
if [[ ! -x "$PY" ]]; then
  echo "Install Python 3.12 first: brew install python@3.12" >&2
  exit 1
fi

"$PY" -m venv .venv
# shellcheck source=/dev/null
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

chmod +x bootstrap.sh run.sh run_cli.sh generate_cli.py 2>/dev/null || true

echo ""
echo "Bootstrap done. Start the server with:"
echo "  cd tools/local-image-gen && ./run.sh"
echo ""
echo "Long / high-quality runs (recommended):"
echo "  ./run_cli.sh -p \"…\" --steps 60 --width 768 --height 768 -o out.png"
echo ""
echo "Test:"
echo '  curl -sS -X POST http://127.0.0.1:8787/generate -H "Content-Type: application/json" -d '"'"'{"prompt":"a red apple on a table"}'"'"' --output /tmp/test-local-sd.png'
