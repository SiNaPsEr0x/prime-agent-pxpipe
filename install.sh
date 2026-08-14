#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v prime-agent >/dev/null 2>&1; then
  echo "ERROR: prime-agent non trovato nel PATH." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm non trovato nel PATH." >&2
  exit 1
fi

echo "[1/2] Installo le dipendenze runtime..."
npm install --prefix "$ROOT" --omit=dev --no-audit --no-fund

echo "[2/2] Registro il package locale in Prime-Agent..."
prime-agent package install "$ROOT"

echo
echo "OK: prime-agent-pxpipe installato."
echo "Avvia Prime-Agent e usa /pxpipe oppure /pxpipe-help."
