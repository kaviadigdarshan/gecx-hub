## Last Session: 2026-04-02

### What I was working on
Scaffolder Step 1 UX improvements — dynamic capabilities grid by industry vertical and increased use case description character limit.

### What's done
- **UX-1: Dynamic capabilities grid by industry vertical**
  - Created `frontend/src/constants/capabilitiesByVertical.ts` with `CAPABILITIES_BY_VERTICAL` map covering retail, bfsi, healthcare, telecom, hospitality, ecommerce, utilities, and generic verticals
  - Added `customCapabilities: string[]` to `UseCaseData` interface and `defaultUseCaseData` in `frontend/src/types/scaffolder.ts`
  - Rewrote capabilities section in `frontend/src/components/accelerators/scaffolder/Step1UseCase.tsx`:
    - Domain change auto-selects all preset capabilities, preserves custom ones
    - Preset grid renders dynamically from `CAPABILITIES_BY_VERTICAL[domain]`
    - Generic vertical shows empty state placeholder + immediate custom input
    - Custom capability chips with dashed border and × remove button
    - `+ Add capability` inline input (Enter confirms, Escape cancels)
    - Capabilities section hidden until a domain is selected
    - Helper text updated as specified
  - Note: capabilities now stored as display strings (e.g. "Order Management"), not slugs. Backend `validate_capabilities` validator in `models/accelerators/scaffolder.py` still filters against old slug-based `CAPABILITY_OPTIONS` — this will silently strip all capabilities. Needs a follow-up fix.

- **UX-2: Increase use case description limit to 2000 chars**
  - `frontend/src/components/accelerators/scaffolder/Step1UseCase.tsx`: `MAX_CHARS` 500 → 2000, placeholder text updated
  - `backend/models/accelerators/scaffolder.py`: validator truncation `[:500]` → `[:2000]`, comment updated

### Open decisions / blockers
- **Backend capabilities validator mismatch**: `UseCaseInput.validate_capabilities` in `backend/models/accelerators/scaffolder.py` (~line 44) filters `expected_capabilities` against the old slug-based `CAPABILITY_OPTIONS` list. Since UX-1 changed the frontend to send display strings, the backend will silently strip all capabilities on every request. Options: (a) remove the validator and accept free-form strings — recommended, since Gemini handles free-form capability descriptions; (b) update backend `CAPABILITY_OPTIONS` to match new display strings; (c) map display strings back to slugs before API submission.

### Next immediate step
Fix the backend `validate_capabilities` validator in `backend/models/accelerators/scaffolder.py` to accept free-form capability strings (remove the slug filter). Then verify with `pytest tests/accelerators/ -q`.
