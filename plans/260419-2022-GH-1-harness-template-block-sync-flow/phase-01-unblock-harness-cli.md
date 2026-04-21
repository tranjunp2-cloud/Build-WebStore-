# Phase 01 — Unblock harness CLI (fix CATEGORY_DNA import)

## Context links

- Research: `plans/260419-2022-GH-1-harness-template-block-sync-flow/research/researcher-02-block-registry-template-wiring.md`
- Broken file: `scripts/test-harness/matrix.ts:20`
- Source of truth (new): `src/lib/ai/template-definitions.ts:49` (comment: "Removed: `CategoryDna` interface + `CATEGORY_DNA` record")
- Category data candidates: `src/lib/ai/category-recipes.ts`, `src/lib/ai/category-requirements.ts`
- Downstream consumers: `scripts/test-harness/compose-runner.ts:17-80`, `scripts/test-harness/cli.ts`

## Overview

- **Date:** 2026-04-19
- **Description:** Restore `npm run harness:gen` by fixing deleted `CATEGORY_DNA` import in `matrix.ts`. Prereq for Phase 02 (drift detection reads harness output) and Phase 03 (auto regen). Smallest change with biggest unblock value.
- **Priority:** P0 (blocker)
- **Implementation status:** completed
- **Review status:** approved (8.5/10 reviewer-07)

## Key Insights (VI + EN mix)

- `template-definitions.ts:49` đã xóa `CATEGORY_DNA` record với comment "0 code consumers" → `matrix.ts:20` còn reference → ImportError khi `ts-node` boot.
- Harness matrix cần list of categories. Current post-refactor sources: `category-recipes.ts` (recipe map by category slug) and/or `category-requirements.ts` (pools) — both enumerate categories.
- `TEMPLATE_DEFINITIONS` + `TEMPLATE_PRESETS` exports STILL exist in `template-definitions.ts:66,123` → safe to keep those imports.

## Requirements

**Functional**
- `npm run harness:gen` succeeds on clean checkout of `main` (no broken imports, no runtime errors pre-compose).
- Matrix output `.harness-out/matrix.json` enumerates the same category count as before (14 per researcher-02 note).
- No regression in fixture count default (14 × 3 × 5 = 210).

**Non-functional**
- Zero behaviour change for compose logic — pure import fix.
- No new dependencies.

## Architecture

```
scripts/test-harness/matrix.ts
  imports ─▶ src/lib/ai/template-definitions.ts  (TEMPLATE_DEFINITIONS, TEMPLATE_PRESETS — OK)
  imports ─▶ NEW: category list source (category-recipes.ts OR category-requirements.ts)
  exports ─▶ buildMatrix() — unchanged signature
      └─▶ compose-runner.ts iterates fixtures
          └─▶ .harness-out/matrix.json
```

**Decision point:** Pick single category-list source. Recommend `category-recipes.ts` (`Object.keys(CATEGORY_RECIPES)`) — it's the composer's canonical recipe map; if recipe exists, harness should cover it.

## Related code files

**To modify**
- `scripts/test-harness/matrix.ts` — replace `CATEGORY_DNA` import + derive `ALL_CATEGORIES`

**To read for context**
- `src/lib/ai/template-definitions.ts` (confirm remaining exports)
- `src/lib/ai/category-recipes.ts` (new category source)
- `src/lib/ai/category-requirements.ts` (fallback source)
- `scripts/test-harness/compose-runner.ts` (confirm matrix shape used)

**To create** — none
**To delete** — none

## Implementation Steps

1. Read `src/lib/ai/category-recipes.ts` — confirm it exports `CATEGORY_RECIPES` with all 14 category slugs as keys (restaurant, beauty, tech, …).
2. In `scripts/test-harness/matrix.ts:6-10`, remove `CATEGORY_DNA` from import list. Add new import:
   ```ts
   import { CATEGORY_RECIPES } from '@/lib/ai/category-recipes'
   ```
3. Replace line 20:
   ```ts
   const ALL_CATEGORIES = Object.keys(CATEGORY_RECIPES)
   ```
4. If any other references to `CATEGORY_DNA` exist in matrix.ts or siblings (grep `CATEGORY_DNA` in `scripts/test-harness/`), either delete (if invariant-lookup no longer needed) or port to recipe equivalent. Document any ported invariant in phase completion notes.
5. Run `npm run harness:gen` locally; confirm `.harness-out/matrix.json` created, fixture count == previous.
6. Run `npm run test -- variant-pool-validation` to confirm no cross-regression.
7. Commit: `fix(harness): replace deleted CATEGORY_DNA import with CATEGORY_RECIPES source`

## Todo List

- [x] Confirm `CATEGORY_RECIPES` has full 14-category coverage
- [x] Replace import in `matrix.ts`
- [x] Port/remove any secondary `CATEGORY_DNA` reference
- [x] `npm run harness:gen` passes
- [x] `npm run test` passes (no regression)
- [x] Commit + PR to staging

## Success Criteria

- `npm run harness:gen` exit code 0 on clean checkout.
- `.harness-out/matrix.json` has `fixtures.length === 210` (default mode).
- `rg CATEGORY_DNA scripts/ src/` returns 0 matches.
- CI `ai-harness.yml` workflow triggerable via `run-harness` label without import errors.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `CATEGORY_RECIPES` missing some category that was in `CATEGORY_DNA` | Low | Medium | Diff keys vs git history of `CATEGORY_DNA` before merge |
| Secondary invariant-check logic depended on `CATEGORY_DNA` fields (not just keys) | Medium | Medium | Grep all callers; if invariants needed, restore minimal subset to recipes or requirements file |
| Fixture count drift breaks CI expected-count assertion | Low | Low | Update assertion if legit; investigate if unexpected |

## Security Considerations

None — pure refactor, no auth/data path changes.

## Next Steps

- Unblocks Phase 02 (drift detection needs harness:gen working).
- Consider adding a lightweight CI step (`npm run harness:gen --mode=quick`) on every PR to prevent future silent breakage of this import path.
