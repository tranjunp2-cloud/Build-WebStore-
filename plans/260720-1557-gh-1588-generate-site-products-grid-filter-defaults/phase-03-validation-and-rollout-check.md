# Phase 03 — Validation And Rollout Check

## Overview

Validate the narrow fix. Confirm it solves generated-site `products-grid` defaults without leaking into manual editor flows or unrelated generators.

## Key Insights

- Manual editor add-block should still inherit schema default `false`
- `apply-template` is intentionally out of scope for this change
- Existing F08 storefront filter plan stays the upstream dependency; this follow-up should not reopen schema/UI decisions
- Route-level normalization should now cover both slug-aware filter defaults and missing products-grid content defaults

## Requirements

- Validation must prove generated behavior only
- No changes to `src/lib/ai/pages-schema.ts` unless Phase 01 unexpectedly requires it
- No updates to editor UI/toggle behavior
- Validation must prove generated `products-grid` no longer loses `headline/subheadline`

## Related Code Files

- Verify: `src/app/api/ai/generate-site/route.ts`
- Verify: `src/__tests__/api/ai.test.ts`
- Read-only: `src/lib/ai/pages-schema.ts`, `src/components/editor/SettingsPanel.tsx`

## Validation Steps

1. Run targeted tests for `generate-site`
2. Run `npm run typecheck`
3. Optional deterministic QA only:
   - use the same mocked `result.pages` fixture as the API regression test (homepage + `/products` both containing `products-grid`)
   - confirm homepage grid persists with filter off
   - confirm `/products` grid persists with filter on
   - confirm persisted `products-grid` includes `headline/subheadline/limit`

## Todo List

- [x] Run targeted `ai.test.ts`
- [x] Run typecheck
- [x] Confirm no editor-default regression
- [x] Confirm generated products-grid defaults are restored in persisted data
- [x] Note out-of-scope follow-up if `apply-template` needs same rule later
- [x] Prefer automated fixture-based validation over free-form AI manual generation

## Success Criteria

- Fix is isolated to generate-site
- No regression in storefront or editor default behavior
- Generated `products-grid` defaults are consistent across AI-first and template-first inputs
- Follow-up scope is documented if another generation entry point needs parity

## Risk Assessment

- Highest rollout risk is scope creep into `apply-template` or manual block insertion
- Secondary risk is relying on nondeterministic AI output during QA; avoid by reusing a fixed fixture/mock
- Avoid both by documenting those as explicit non-goals in implementation PR

## Security Considerations

- No new secrets/env/config
- No authz changes

## Next Steps

- Implementation handoff: `/ck:cook --auto /home/liam/data/worktrees/ech-prime-web-v2-worktree-1/plans/260720-1557-gh-1588-generate-site-products-grid-filter-defaults/plan.md`


## Follow-Up Note

- `apply-template` and upstream `template-composer` parity remain intentionally out of scope for this PR. If generated block parity is needed there later, track it as a separate follow-up instead of widening this fix.
