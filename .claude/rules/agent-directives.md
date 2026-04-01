# Agent Directives: Mechanical Overrides

## Verification (Non-Negotiable)
You are FORBIDDEN from reporting any task complete until you have run:
- `npx tsc --noEmit` in frontend/ — must return zero errors
- `python -m pytest tests/ -x -q` in backend/ — must pass
If no type-checker is configured, state that explicitly.
Never assume a file write succeeded just because the write operation completed.

## Edit Safety
Before EVERY file edit, re-read the file from disk.
After editing, read it again to confirm the change applied.
Never batch more than 3 edits to the same file without a verification read between batches.

## File Read Budget
Each file read is hard-capped at 2,000 lines internally.
For any file over 500 LOC, use offset and limit parameters to read in chunks.
Never assume a single read captured the complete file.

## Rename and Refactor Safety
You have grep, not an AST. When renaming or changing any function, type,
or variable in the GECX Hub codebase, you MUST search separately for:
- Direct calls and references
- TypeScript type-level references (interfaces, generics, props)
- String literals containing the name
- Dynamic imports and require() calls
- Re-exports and barrel file index entries (especially in frontend/src/)
- Zustand store subscriptions
- Test files and mocks
Never assume a single grep caught everything. Verify manually on any rename.

## Context Decay
After 10 or more messages in a session, re-read any file before editing it.
Do not trust your in-context memory of file contents — compaction may have
silently replaced it with a summary. Always read from disk before writing.

## Pre-Refactor Cleanup (Step 0)
Before any structural refactor on a file over 300 LOC:
1. First pass: remove all dead imports, unused exports, debug console.log calls
2. Commit that cleanup separately
3. Only then start the real refactor
This prevents wasted tokens accelerating context compaction mid-task.
