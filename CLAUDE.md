# GECX Accelerator Hub — Project Rules
# last updated: 2026-04-02

## Developer Profile
- Stack: React 18 + TypeScript strict + Vite + Zustand (frontend), FastAPI + Python 3.12 (backend)
- IDE: VS Code + Claude Code extension

## Platform
- API: ces.googleapis.com (CX Agent Studio) — NOT Dialogflow CX, never reference it
- GCP Project: gecx-hub-491908
- GCS Bucket: gecx-hub-dev-artifacts
- AI Model: Gemini 2.5 Flash
- Auth: Google OAuth 2.0 (frontend) + ADC (backend)

## Architecture
- Monorepo: ~/gecx-hub/ → frontend/ + backend/
- Shared state: ScaffoldContext (GCS-persisted JSON + Zustand store)

## Accelerator Pipeline (order is fixed)
1. Acc 3 — Scaffolder: runs first, populates ScaffoldContext
2. Acc 2 — Instruction Architect: reads ScaffoldContext per agent
3. Acc 1 — Guardrails Generator: reads vertical from ScaffoldContext
- Each accelerator writes its completion status back to ScaffoldContext

## File Conventions
- Components: frontend/src/components/{Name}/{Name}.tsx
- Pages: frontend/src/pages/{Name}.tsx
- Services: backend/services/{name}_service.py
- Routes: backend/routes/{name}.py
- Types: frontend/src/types/{domain}.ts

## AI Service
- All Gemini calls route through backend/services/ai_service.py — no direct calls elsewhere
- Endpoint: https://us-central1-aiplatform.googleapis.com/v1/projects/gecx-hub-491908/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent

## Demo Mode
- Triggered by ENVIRONMENT=demo
- Shows amber badge in UI — no real API calls in this mode

## Verification (run only when asked to verify or before marking a task done)
- Frontend: npx tsc --noEmit && npx eslint src/
- Backend: pytest && bandit -r backend/
- Security scan: semgrep --config=auto && trufflehog filesystem .
- File writes succeeding ≠ code compiling — always verify

## Testing Stack
- Frontend: Vitest + React Testing Library + Playwright
- Backend: pytest + httpx + Schemathesis

## Session Management
- Treat each session as single-task scoped — one session, one goal
- Before /clear, run /done to write CONTEXT.md
- Resume with: "Read CONTEXT.md and resume from there"

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
