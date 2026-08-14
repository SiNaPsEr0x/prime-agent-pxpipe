#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="${PRIME_PXPIPE_STATE_FILE:-$HOME/.prime/agent/pxpipe-state.json}"

if command -v prime-agent >/dev/null 2>&1; then
  prime-agent shutdown --force >/dev/null 2>&1 || true
  prime-agent package remove "$ROOT" >/dev/null 2>&1 || true
fi

rm -f "$STATE_FILE" >/dev/null 2>&1 || true
cd "$HOME"
rm -rf "$ROOT"

echo "OK: prime-agent-pxpipe rimosso completamente."
