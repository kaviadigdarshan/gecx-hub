#!/bin/bash
# UserPromptSubmit hook: injects git status and recent changes
cd ~/gecx-hub
echo '=== CURRENT GIT STATUS ==='
git status --short 2>/dev/null | head -15
echo '=== RECENT CHANGES (last 5 commits) ==='
git log --oneline -5 2>/dev/null
echo '=== BACKEND RUNNING ==='
curl -s http://localhost:8000/health 2>/dev/null || echo 'Backend not running'
