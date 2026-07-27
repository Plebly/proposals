# Proposal ID sequence

Canonical counter for auto-assigned numeric IDs (`PLEBLY-YYYY-NNN`).

Human-readable seed IDs (e.g. `PLEBLY-SIGNET-DEMO`) do not consume this counter.

| Field | Value |
|-------|-------|
| Next sequence | 1 |
| Year prefix | calendar year of assignment |

CI (`scripts/assign-sequence.mjs`) bumps **Next sequence** when a proposal under `proposals/` lacks a stable `id:` and writes `PLEBLY-YYYY-NNN`.
