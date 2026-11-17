#!/usr/bin/env bash
# Reject push if any new commit author or committer is not preunbb.
set -euo pipefail

ALLOWED_NAME="preunbb"
ALLOWED_EMAIL="boozlejam@gmail.com"

check_range() {
  local range="$1"
  [[ -z "$range" ]] && return 0
  local bad=0
  while IFS=$'\t' read -r an ae cn ce; do
    if [[ "$an" != "$ALLOWED_NAME" || "$ae" != "$ALLOWED_EMAIL" || "$cn" != "$ALLOWED_NAME" || "$ce" != "$ALLOWED_EMAIL" ]]; then
      echo "  bad commit: author=[$an <$ae>] committer=[$cn <$ce>]"
      bad=1
    fi
  done < <(git log "$range" --format=$'%an\t%ae\t%cn\t%ce' 2>/dev/null || true)
  if [[ "$bad" -ne 0 ]]; then
    echo ""
    echo "ERROR: Push blocked — every commit must be authored and committed by preunbb <boozlejam@gmail.com>."
    exit 1
  fi
}