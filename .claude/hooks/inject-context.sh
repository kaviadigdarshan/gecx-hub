#!/bin/bash
# UserPromptSubmit hook — lean version, no network calls
cd ~/gecx-hub || exit 0

CHANGED_SOURCE=$(git diff --name-only 2>/dev/null | grep -E '\.(ts|tsx|py)$' || true)
[ -z "$CHANGED_SOURCE" ] && exit 0

echo '=== CHANGED FILES ==='
echo "$CHANGED_SOURCE" | head -10
echo '=== LAST 3 COMMITS ==='
git log --oneline -3 2>/dev/null