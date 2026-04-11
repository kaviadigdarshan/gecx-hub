# ADR-001: ScaffoldContext GCS Ownership Model

**Status:** Accepted
**Date:** 2026-04-08

## Context

ScaffoldContext is shared state read and written by three accelerators in sequence. It must survive page reloads, browser refreshes, and multi-tab sessions. Early prototypes stored context only in Zustand (in-memory), which caused state loss on navigation and made accelerator handoffs unreliable.

## Decision

GCS bucket `gecx-hub-dev-artifacts` is the single source of truth for ScaffoldContext. Zustand holds a derived, read-only view that is hydrated from GCS on load and after every write.

Conflict resolution rule: the GCS response always overwrites Zustand state. There is no merge — the client never wins a conflict.

`contextSyncStatus` in `uiStore` surfaces three states:
- `pending` — a write is in flight
- `error` — the last GCS operation failed (shown in UI; user must retry)
- `synced` — Zustand matches the last known GCS state

## Consequences

**Positive:**
- Accelerator handoffs are reliable: Acc-2 always reads what Acc-3 wrote.
- Browser state loss is recoverable — reload re-hydrates from GCS.
- No merge conflicts to resolve; conflict rule is trivially simple.

**Negative:**
- Every ScaffoldContext read/write requires a GCS round-trip; offline use is not supported.
- Demo mode must stub GCS responses to keep the pipeline functional without real credentials.
- New fields added to ScaffoldContext require a `schema_version` bump and a migration note in `ARCHITECTURE.md`.
