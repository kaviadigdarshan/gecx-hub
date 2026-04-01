#!/bin/bash
# SessionEnd hook: writes what was done to CLAUDE.local.md
DATE=$(date '+%Y-%m-%d %H:%M')
echo "" >> ~/gecx-hub/CLAUDE.local.md
echo "## Session: $DATE" >> ~/gecx-hub/CLAUDE.local.md
echo "$1" >> ~/gecx-hub/CLAUDE.local.md
