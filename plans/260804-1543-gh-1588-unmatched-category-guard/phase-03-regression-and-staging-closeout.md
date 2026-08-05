# Phase 03 — Regression and Staging Closeout

**Status:** in_progress · **Priority:** P1 · **Effort:** 1–2h engineering + external QA wait · **Depends:** Phase 02

## Related files

**Modify**

- `docs/qa/F08-product-crud.md`
- `docs/CHANGELOG.md` only after staging gates pass
- `plans/260710-1625-f08-category-integrity/phase-10-tests-qa-pr2.md` only after QA sign-off

## Release gates

| Metric | Gate |
|--------|------|
| Deterministic TC120–TC123 | 100% |
| Full Vitest, typecheck, and scoped lint | Pass |
| Authenticated staging negative control | Tent remains uncategorized and Approve stays disabled |
| Authenticated staging positive control | Serum retains the existing Skincare category |

## Verification

```bash
npm test -- src/__tests__/unit/ai/bulk-category-matching.test.ts src/__tests__/api/ai.test.ts src/__tests__/unit/dashboard/bulk-create-save.test.tsx
npm test
npm run typecheck
npm run lint
```

## Execution evidence — 2026-08-05

- Deterministic TC120–TC123 + dashboard regression: **155/155 passed**.
- Full Vitest suite (serial): **11,619/11,619 passed**, 3 skipped.
- Typecheck passed. Full lint exited 0 with existing repository warnings; scoped lint passed without warnings/errors.
- Authenticated deployed staging flow and external QA sign-off remain open; no changelog or parent Phase 10 closeout is allowed yet.

## Staging TC124

1. Deploy via the normal preview/staging flow from the focused branch, then use a tenant whose only active category is `QA Skincare`.
2. Parse `4-Person Camping Tent`; verify category is empty, validation is shown, and Approve is disabled until a merchant chooses an existing category.
3. Parse `Vitamin C Skin Serum`; verify `QA Skincare` is preselected and Approve succeeds. Verify no category is created.
4. Inspect the single aggregate application event: reason totals equal product count and no compared text, prompt, output, path, or ID is present.
5. Attach staging evidence to GH-1588 and request QA re-test. External QA waiting time is not included in the engineering estimate.
6. After sign-off, update changelog and parent Phase 10, then merge the PR to `staging` with `Relates to #1588`.

## Rollout and rollback

- Monitor aggregate `semanticRejected`/`ambiguous`/`matched` counts and parse p95; investigate a sharp null-rate increase before production.
- If positives regress, revert the guard merge commit and redeploy. Existing model override may support diagnosis but must never bypass the guard.

## Exit criteria

- All release gates and authenticated staging TC124 pass with evidence.
- QA confirms both the reported negative and positive control.
- Parent F08 Phase 10 is unblocked only after external sign-off.
