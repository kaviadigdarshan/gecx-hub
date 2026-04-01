#!/bin/bash
# PostToolUse hook: runs pytest after backend file edits
FILE=$1
if [[ "$FILE" == *"backend/"* ]]; then
  cd ~/gecx-hub/backend
  source venv/bin/activate 2>/dev/null || source ../.venv/bin/activate 2>/dev/null
  python -m pytest tests/ -x -q --tb=short 2>&1 | tail -20
fi
