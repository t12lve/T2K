#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

mkdir -p cli/keys public extension docs/superpowers/specs docs/superpowers/plans

if [[ ! -f .gitignore ]]; then
  echo "Missing .gitignore — create project files first" >&2
  exit 1
fi

if [[ ! -d .git ]]; then
  git init
fi

git add -A
# Ensure secrets stay out even if force-added by mistake later
git status --ignored || true

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "Repo already has commits; skipping initial commit."
else
  git add .gitignore .gitlab-ci.yml init.sh public extension cli docs
  git status
  git commit -m "chore: initial T2K scaffold"
fi

echo "T2K init done."
echo "Next: node cli/generate-keys.js <login>"
echo "Then update public/streamers.json and T2K_STREAMERS_URL in extension/content.js"
