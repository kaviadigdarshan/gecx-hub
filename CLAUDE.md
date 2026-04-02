# GECX Accelerator Hub — Project Rules

## Platform
- Target: CX Agent Studio, API: ces.googleapis.com (NOT Dialogflow CX)
- GCP Project: gecx-hub-491908
- GCS Bucket: gecx-hub-dev-artifacts
- AI Model: Gemini 2.5 Flash
- Auth: Google OAuth 2.0 + ADC for backend credentials

## Architecture
- Monorepo root: ~/gecx-hub/
- Frontend: frontend/ (React 18 + TypeScript + Vite + Zustand)
- Backend: backend/ (FastAPI Python 3.12)
- Shared state: ScaffoldContext (GCS-persisted JSON + Zustand store)

## Three Accelerators — Unified Pipeline
- Acc 3 (Scaffolder) runs first → populates ScaffoldContext
- Acc 2 (Instruction Architect) reads ScaffoldContext per agent
- Acc 1 (Guardrails Generator) reads vertical from ScaffoldContext
- Each accelerator writes completion status back to ScaffoldContext

## File Conventions
- Components: frontend/src/components/{ComponentName}/{ComponentName}.tsx
- Pages: frontend/src/pages/{PageName}.tsx
- Services: backend/services/{name}_service.py
- Routes: backend/routes/{name}.py
- Types: frontend/src/types/{domain}.ts

## AI Service
- All Gemini calls go through backend/services/ai_service.py
- Use ADC via google.auth.default() — never hardcode tokens
- Endpoint: https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT}/
  locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent

## Guards
- The project gate (selectedProject/selectedApp requirement) has been removed
- Users access accelerators directly without selecting a GCP project in UI
- Demo Mode exists: triggered by ENVIRONMENT=demo, shows amber badge

## Verification Rule
Never report a task complete without running: npx tsc --noEmit (frontend)
and pytest (backend). File writes succeeding ≠ code compiling.

## Testing
- Frontend: Vitest + React Testing Library + Playwright
- Backend: pytest + httpx + Schemathesis
- Security: Bandit + Semgrep + truffleHog

## Session Handoff (CONTEXT.md)
- Before running /clear, update CONTEXT.md at ~/gecx-hub/CONTEXT.md
- CONTEXT.md format:
  ## Last Session: <date>
  ### What I was working on
  ### What's done
  ### Open decisions / blockers
  ### Next immediate step
- At the start of a new session, say: "Read CONTEXT.md and resume from there"
- CONTEXT.md is the single source of truth for cross-session continuity