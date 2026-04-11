# ADR-002: CES Native vs Accelerator Boundary

**Status:** Accepted
**Date:** 2026-04-08

## Context

CX Agent Studio (CES) already provides instruction refinement, test case hill climbing, and agent generation natively. Building accelerators that duplicate platform capabilities wastes sprint capacity and produces tools that drift from the platform as CES evolves.

Acc-5 (Few-Shot Factory) and Acc-7 (Test Case Factory) were proposed in early planning but overlap directly with CES-native functionality.

## Decision

Accelerators only cover **pre-import generation** — work that happens before a ZIP or config is uploaded to CES:

- ZIP scaffold in CX Agent Studio AppSnapshot format (Acc-3)
- XML-validated, CES-syntax-correct agent instructions (Acc-2)
- Callback code stubs with enforced signatures (Acc-4, planned)
- Production-ready OpenAPI specs for tool integrations (Acc-6, planned)
- Vertical-specific guardrail configuration with sensitivity tiers (Acc-1)

Acc-5 (Few-Shot Factory) and Acc-7 (Test Case Factory) are killed. CES covers these natively and our versions would add no enforced correctness or quality scoring.

**Gate question for any new accelerator:** Does CES already do this? If yes, does our version add enforced correctness, CES-specific syntax, or quality scoring that CES doesn't provide? If the answer is no, don't build it.

## Consequences

**Positive:**
- Accelerator scope is stable and bounded; no feature creep into CES territory.
- Each accelerator has a clear exit condition (the import to CES).
- Killed accelerators free up sprint capacity for Acc-4 and Acc-6.

**Negative:**
- Pre-import quality is our responsibility; CES refinement won't catch our structural errors.
- The gate question requires someone to know CES capabilities well — must be reassessed as CES ships new features.
