#!/bin/bash
# UserPromptSubmit hook: injects git status and recent changes
# Only fires when actual source files (.ts, .tsx, .py) are modified
cd ~/gecx-hub || exit 0

DIFF_STAT=$(git diff --stat 2>/dev/null)

# Exit immediately if no changes at all
if [ -z "$DIFF_STAT" ]; then
  exit 0
fi

# Exit if only config/doc files changed (.json, .md, .env) — no source files
CHANGED_SOURCE=$(git diff --name-only 2>/dev/null | grep -E '\.(ts|tsx|py)$' || true)
if [ -z "$CHANGED_SOURCE" ]; then
  exit 0
fi

# Check if any .py files changed (gates GCS status injection)
CHANGED_PY=$(git diff --name-only 2>/dev/null | grep -E '\.py$' || true)

{
  echo '=== CURRENT GIT STATUS ==='
  git status --short 2>/dev/null | head -15
  echo '=== RECENT CHANGES (last 5 commits) ==='
  git log --oneline -5 2>/dev/null
  echo '=== BACKEND RUNNING ==='
  curl -s http://localhost:8000/health 2>/dev/null || echo 'Backend not running'
  if [ -n "$CHANGED_PY" ]; then
    echo '=== GCS STATUS ==='
    gsutil ls gs://gecx-hub-dev-artifacts/ 2>/dev/null | tail -5 || echo 'GCS unavailable'
  fi
} | head -40
