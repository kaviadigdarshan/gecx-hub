#!/bin/bash
# PreToolUse hook: runs TypeScript check before any file write
# Only runs for frontend files
FILE=$1
if [[ "$FILE" == *"frontend/src"* ]]; then
  cd ~/gecx-hub/frontend
  npx tsc --noEmit 2>&1 | head -20
fi
