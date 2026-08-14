#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git non trovato." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI (gh) non trovata. Installa gh e fai 'gh auth login'." >&2
  exit 1
fi

REPO_NAME="${REPO_NAME:-prime-agent-pxpipe}"
VISIBILITY="${VISIBILITY:-public}"
DESCRIPTION="${DESCRIPTION:-Native pxpipe compression for Prime-Agent}"
OWNER="${GITHUB_OWNER:-$(gh api user -q .login)}"

if [ ! -d .git ]; then
  git init
  git branch -M main
fi

git add .
if ! git diff --cached --quiet; then
  VERSION="$(node -p "require('./package.json').version")"
  git commit -m "release: v${VERSION}" || true
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "$OWNER/$REPO_NAME" --"$VISIBILITY" --source . --remote origin --push --description "$DESCRIPTION"
else
  git push -u origin main
fi

echo "OK: repository GitHub pronto su https://github.com/$OWNER/$REPO_NAME"
