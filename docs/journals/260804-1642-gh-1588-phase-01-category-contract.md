---
date: 2026-08-04
session: GH-1588 Phase 01 fail-closed category contract
---

# Journal: 2026-08-04 — GH-1588 Phase 01 Category Contract

## Context

Phase 01 establishes the regression contract for incorrect AI category assignments before changing production behavior.

## What Happened

- Added a 13-case synthetic fixture covering valid matches, unrelated categories, ambiguous evidence, normalization edges, and unknown IDs.
- Added API regression coverage: TC-F08-04-120 intentionally fails because the route returns category ID `42` instead of `null`; TC-F08-04-121 passes for a valid skincare match.
- Confirmed the production bug is not fixed in this phase. Phase 01 records the failing boundary that Phase 02 must close.

## Reflection

The red test gives a precise, reproducible signal without obscuring the current behavior. Keeping synthetic names and categories avoids leaking merchant data. The main constraint is deliberate: Phase 01 is complete as contract work, but the user-visible defect remains until the guard is implemented.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Keep TC-F08-04-120 red in Phase 01 | Preserve evidence of the current fail-open behavior | Phase 02 has an explicit target: `42` must become `null` |
| Retain TC-F08-04-121 as a positive control | Prevent the future guard from rejecting valid category assignments | Phase 02 must be fail-closed without becoming fail-always |
| Use a reviewed synthetic fixture corpus | Make matching rules reproducible and privacy-safe | Future matcher changes can be tested against stable cases |

## Next Steps

- Phase 02: implement the deterministic category guard and make TC-F08-04-120 pass while preserving TC-F08-04-121.
