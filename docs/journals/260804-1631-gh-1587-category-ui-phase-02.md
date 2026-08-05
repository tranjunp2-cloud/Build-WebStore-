---
date: 2026-08-04
session: gh-1587-category-ui-rework-phase-02
---

# Journal: 2026-08-04 — GH-1587 Category UI Rework Phase 2

## Context

Phase 2 turns the four GH-1587 rework cases into traceable regression gates after Phase 1 corrected the level badge colors and row-level Add Subcategory guidance.

## What Happened

- Expanded the Category Manager unit suite to cover L1→L2 and L2→L3 guidance, locked parent state, absence of guidance in toolbar-create/edit, authoritative L1/L2/L3 color classes, and the exact one-product delete error while the confirmation remains open.
- Added an authenticated Playwright project and `tests/category-management-rework.spec.ts` for real L1→L2→L3 creation, computed badge colors in both themes, L3 action limits, delete/re-parent persistence, and assigned-product delete blocking with cleanup in dependency order.
- Corrected the existing browser test mappings to TC-F08-05-17, TC-F08-05-18, and TC-F08-05-06.
- Added TC-F08-05-38 and TC-F08-05-39 plus the canonical automation mapping to the F08 QA matrix.
- Incorporated tester corrections in the test harness: Select mocks now preserve disabled/value state, the confirmation mock exercises the real confirm path, and fixture cleanup preserves the primary test failure while deleting products before assigned categories.

## Validation

| Check | Result |
|---|---|
| Focused automated tests | Passed 33/33 |
| TypeScript typecheck | Passed |
| Playwright collection | New category regression project and both scenarios collected successfully |
| Scoped diff review | Passed; no category collection, schema, migration, environment, or shared Badge changes |
| Live browser execution | Passed 3/3 in 34.6 seconds using a compatible Ubuntu Playwright container on the local app network |

The auth guard was not bypassed because doing so would weaken the validity of the authenticated E2E result. Pre-existing unrelated working-tree changes remain untouched.

## Findings Fix Addendum

### What Happened

- Strengthened the badge E2E oracle: L1/L2/L3 computed colors must match `--primary`, `--info`, and `--p-violet-300`, not merely differ.
- Added browser-negative checks confirming toolbar Add Category and Edit Category show no subcategory guidance and keep Parent enabled.
- Expanded the delete/re-parent fixture to two direct children plus one deeper descendant, proving all direct children are promoted while deeper relations remain intact.

### Decisions

- Keep semantic CSS tokens as the authoritative color contract in both themes.
- Exercise UX-positive and UX-negative paths in the real browser suite.
- Retain deterministic unit coverage alongside browser persistence checks.

### Validation

- Focused unit suite: 33/33 passed.
- Typecheck: passed.
- Playwright discovery: passed.
- Scoped diff check: passed.

### Earlier Environment Blocker

An earlier attempt ran inside the correct Alpine application container at the guard-approved `http://localhost:3000`; browser launch failed before assertions because the downloaded Ubuntu Chromium binary required unavailable GLib/ATK symbols. The compatible-container run below supersedes this blocker without changing the auth guard.

## Final Verification Addendum

- Diagnosed the badge assertion as a test race: the one-shot RGB read could observe `transition-colors` before the theme transition settled. Replaced it with Playwright's web-first `toHaveCSS` assertions so each semantic color comparison auto-retries.
- No production color mapping change was needed; L1/L2/L3 already resolve to `--primary`, `--info`, and `--p-violet-300`.
- Kept the shared staging workflow unchanged by user direction; the dedicated category project remains available for explicit local or CI invocation.
- Final verification passed: live local Playwright 3/3 in 34.6 seconds, focused unit tests 33/33, typecheck, and diff check. Explicit discovery reports 49 tests total, with the two GH-1587 tests collected exactly once.


## Reflection

The useful split is now explicit: deterministic component tests protect copy, state, and class contracts; browser tests protect computed theme output and persisted hierarchy behavior. The compatible local browser run now verifies both layers on the permitted auth origin.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Keep TC-F08-05-06 partially automated in the QA matrix | The new browser flow covers hard-block and re-parenting, but not the full assigned-L3 relation after re-parent | Avoids overstating coverage |
| Preserve the auth-origin guard | Bypassing it would test a different security posture | A compatible Ubuntu browser container shares the app network while keeping the approved `localhost:3000` origin |
| Leave the working tree uncommitted | The user requested continuation without a commit | Phase 1 and Phase 2 changes remain available for review |

## Next Steps

- Run the category regression project explicitly before PR until separate staging CI wiring is approved, and treat future transition timing with web-first assertions.
- Review the final scoped diff, then commit only when explicitly requested.
