#!/usr/bin/env bash
# Only preunbb <boozlejam@gmail.com> may commit in this repository.
set -euo pipefail

ALLOWED_NAME="preunbb"
ALLOWED_EMAIL="boozlejam@gmail.com"

name="$(git config --get user.name 2>/dev/null || true)"
email="$(git config --get user.email 2>/dev/null || true)"

if [[ "$name" != "$ALLOWED_NAME" || "$email" != "$ALLOWED_EMAIL" ]]; then
  echo ""
  echo "ERROR: Commit blocked — git author must be preunbb <boozlejam@gmail.com>."
  echo "       Current: ${name:-<unset>} <${email:-unset}>"
  echo ""
  echo "Set locally for this repo only (not global):"
  echo "  git config user.name preunbb"
  echo "  git config user.email boozlejam@gmail.com"
  echo ""
  exit 1
fi