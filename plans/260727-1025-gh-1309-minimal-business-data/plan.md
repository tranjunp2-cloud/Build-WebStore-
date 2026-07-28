---
title: "GH-1309 Minimal Business Data v2"
description: "Use Sites.name as Local Business Name, define the 20-point Business Data contract, and harden phone save behavior."
status: in-progress
progress: 50%
priority: P1
effort: 8h
issue: 1309
branch: staging
tags: [feature, frontend, scoring, testing]
blockedBy: []
blocks: []
created: 2026-07-27
---

# GH-1309 Minimal Business Data v2

## Reviewed Scope

This is the reduced implementation plan for the rewritten US-F37-01 contract:

- `Sites.name` is Local Business Name and earns 7 points.
- Address earns 8 only when street, city, postcode, and country are complete.
- `contactInfo.phone` earns 5 points.
- Invalid phone blur shows feedback, sends no save request, and restores the last confirmed value.
- A valid phone enters parent state only after the PATCH succeeds; a failed save cannot leak into a later contact save.

No collection, database migration, new API route, dashboard card, or Google/GBP account integration is required.

## What Already Exists

- Name, structured address, and phone fields and their tenant-scoped save path.
- The authenticated and rate-limited Local SEO score route.
- Responsive one-column editor styling below the desktop breakpoint.
- Server-side site validation and F37 unit/QA files.
- A Playwright auth/setup suite under `e2e/`; however, the current config does not discover the repository-mandated `tests/*.spec.ts` location.

The implementation should change only the contract gaps, not rebuild those paths.

## Ownership and Release Gate

The current production formula is `35/30/20/15`. Activating Business 20 alone would cap the total at 85, so runtime score activation belongs to the atomic #1312 `20/40/20/20` cutover.

```text
#1309 PR                                 #1312 PR
├─ pure Business 7/8/5 contract         ├─ activate helper in score engine
├─ transactional phone save + UI revert ├─ map persisted fields in score API
├─ editor persistence E2E               └─ prove complete total = 100
└─ F37 QA mapping                                  │
                 └──────── staging QC after both ──┘
```

#1309 must remain open until the integrated score API eventually proves AC1 and AC2. This does not block the editor-focused phases below. Do not add temporary bonus points or merge a `20/30/20/15` engine.

External completion dependency: GitHub #1312. The current plan intentionally stops at pre-integration QC; when #1312 starts, update this plan with its exact PR, API-test target, atomic score cutover, and final staging gate.

## Files Owned by #1309

Twelve implementation and QA targets; only the planned Playwright spec is new. The existing runner config must also make the mandated `tests/*.spec.ts` location discoverable:

1. `src/lib/seo/local-seo-score.ts`
2. `src/__tests__/unit/seo/local-seo-score.test.ts`
3. `src/lib/seo/local-business-constants.ts`
4. `src/lib/validations/sites.ts`
5. `src/components/editor/SettingsPanel.tsx`
6. `src/app/(editor)/editor/[siteId]/page.tsx`
7. `src/__tests__/unit/lib/validations/misc-validations.test.ts`
8. `src/__tests__/unit/editor/settings-panel.test.tsx`
9. `src/__tests__/unit/editor/publish-flow.test.tsx`
10. `docs/qa/F37-local-seo.md`
11. `tests/f37-minimal-business-data.spec.ts`
12. `playwright.config.ts`

The score route and its API tests are integration ownership for #1312. The future #1312 plan update—not the provisional Phase 3—will verify their output before #1309 is considered complete.

## Phases

| Phase | Name | Effort | Status |
|---|---|---:|---|
| 1 | [Lock Business Score Contract](./phase-01-lock-business-score-contract.md) | 2h | Completed |
| 2 | [Harden Editor Phone Behavior](./phase-02-harden-editor-save-and-phone-validation.md) | 2h | Completed |
| 3 | [Pre-integration QC — Provisional](./phase-03-integrate-test-and-complete-qc.md) | 4h | Pending |

Progress: 4h/8h (50% by estimated effort); 2/3 phases completed.

Current delivery order: `Phases 1 and 2 completed -> Phase 3 pre-integration QC`.

Future delivery order, to be planned with #1312: `#1312 atomic integration -> update this plan -> final score/staging QC`.

## Explicitly Not in Scope

- New Local Business fields, Payload schema changes, or SQL migrations.
- Legacy `contactInfo.address` scoring.
- Hours, category, website, or description in the Business bucket.
- Generic optimistic-save rollback framework, autosave queue redesign, or unrelated lost-update refactor.
- Dashboard score cards, checklist/deep-links, JSON-LD changes, Google account, or GBP API work.

## Current Plan Exit Criteria

- [x] Invalid non-empty phone values without a digit or with disallowed characters return before save and immediately revert in the editor implementation.
- [x] A failed valid-phone PATCH leaves the confirmed phone in parent state, guards sibling contact saves while pending, and cannot contaminate a later email save.
- [ ] Valid values persist after reload; 375px has no horizontal overflow.
- [x] The pure Business helper locks complete = 20, name + phone = 12, and incomplete address = 0.
- [ ] Playwright discovers and runs the new F37 spec without silently skipping.
- [x] No schema or migration diff in the completed Phase 1 and Phase 2 changes.

Deferred until the #1312 plan update:

- Prove the persisted score API returns Business 20/12/0 for the corresponding scenarios.
- Prove score-route 401/403 tenant boundaries.
- Prove the full integrated Local SEO total reaches 100.
- Perform final staging QC and close #1309.

## Engineering Review Outcome

- Architecture: keep domain rules in existing modules; no new service/helper files.
- Code quality: one score helper and one shared phone predicate; no duplicated regex or fallback scoring.
- Tests now: the pure contract and Phase 2 server/component/parent-integration regressions cover their current boundaries, including transactional phone failure isolation; real-browser persistence remains pending Phase 3, and #1312 API integration coverage is explicitly deferred.
- Test harness: update Playwright discovery for both the established `e2e/` suite and mandated `tests/` specs; verify with `--list` so a zero-test pass is impossible.
- Performance: no query, dependency, or bundle-heavy addition; scoring remains O(1).
- `TODOS.md`: 0 items proposed. Deferred concurrency concerns are existing platform work and are deliberately not expanded by this issue.
