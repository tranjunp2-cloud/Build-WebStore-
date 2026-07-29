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
- A Playwright auth/setup suite under `e2e/`; the F37 spec can reuse its authenticated Chromium project.

The implementation should change only the contract gaps, not rebuild those paths.

## Ownership and Release Gate

The current top-level formula is `35/30/20/15`. #1309 exposes its persisted 7/8/5 contract as an additive `minimalBusinessData` response; it does not replace the legacy Business bucket or create a partial 85-point total.

```text
#1309 PR                                  #1312 PR
├─ pure Business 7/8/5 contract          ├─ promote helper into top-level total
├─ persisted additive API mapping        ├─ atomic 20/40/20/20 cutover
├─ transactional phone save + UI revert ├─ dashboard/checklist UI
├─ editor persistence E2E                └─ prove complete total = 100
└─ F37 QA mapping
```

#1309 remains open only for its manual live-staging browser gate. Unit/API evidence now proves complete = 20, name + phone = 12, and 401/403 tenant boundaries. Do not add temporary bonus points or merge a `20/30/20/15` engine.

#1312 is downstream work, not a completion dependency for #1309; it owns only the top-level formula cutover and seller-facing score/checklist UI.

## Files Owned by #1309

Implementation and QA targets; only the scoped Playwright spec is new. It reuses the existing runner and needs only stable selector hooks; the spec discovers the authenticated account's sole site itself and is intentionally not added to the default staging workflow:

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
11. `e2e/f37-minimal-business-data.spec.ts`
12. `src/components/editor/CompactEditorLayout.tsx`
13. `src/components/editor/EditorToolsSheet.tsx`
14. `src/components/editor/local-business/geo-cascade-fields.tsx`
15. `src/app/api/sites/[siteId]/local-seo-score/route.ts`
16. `src/__tests__/api/local-seo-score.test.ts`

The additive `minimalBusinessData` mapping and focused API regressions belong to #1309. #1312 retains ownership of replacing the legacy top-level score/breakdown and adding the dashboard/checklist.

## Phases

| Phase | Name | Effort | Status |
|---|---|---:|---|
| 1 | [Lock Business Score Contract](./phase-01-lock-business-score-contract.md) | 2h | Completed |
| 2 | [Harden Editor Phone Behavior](./phase-02-harden-editor-save-and-phone-validation.md) | 2h | Completed |
| 3 | [Pre-integration QC — Provisional](./phase-03-integrate-test-and-complete-qc.md) | 4h | In progress — live staging pending |

Progress: 4h/8h (50% by estimated effort); 2/3 phases completed.

Current delivery order: `Phases 1 and 2 completed -> Phase 3 pre-integration QC`.

Delivery order: `#1309 manual staging QC -> close #1309`; #1312 can perform its atomic score/UI cutover independently afterward.

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
- [x] The persisted score API returns additive Business 20/12 and preserves the legacy top-level formula.
- [x] Score-route API regressions prove 401/403 tenant boundaries.
- [x] Playwright locally discovers TC-F37-01-26/27 without silently skipping; live staging execution remains pending.
- [x] No schema or migration diff in the completed Phase 1 and Phase 2 changes.

Deferred to #1312:

- Replace the legacy top-level score with the atomic `20/40/20/20` formula and prove total 100.
- Build the seller-facing score cards, checklist, and deep links.

#1309 still requires its manual live-staging browser run before closure.

## Engineering Review Outcome

- Architecture: keep domain rules in existing modules; no new service/helper files.
- Code quality: one score helper and one shared phone predicate; no duplicated regex or fallback scoring.
- Tests now: the pure helper and persisted API mapping cover 20/12 plus tenant isolation; Phase 2 covers transactional phone failure isolation; the manual real-browser staging run remains pending.
- Test harness: keep the scoped spec in the established `e2e/` suite; do not change Playwright config or the default staging workflow. Verify targeted discovery with `--list` so a zero-test pass is impossible.
- Performance: no query, dependency, or bundle-heavy addition; scoring remains O(1).
- `TODOS.md`: 0 items proposed. Deferred concurrency concerns are existing platform work and are deliberately not expanded by this issue.
