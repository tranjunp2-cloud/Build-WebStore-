# Plan — Gen Template Harness Rules Overhaul

**Branch:** `fix/gen-template-harness`
**Worktree:** `/Users/ngotuannhan/Claude Code/projects/worktrees/ech-prime-web-v2-gen-template-harness`
**Created:** 2026-04-29

## Phases

| # | Phase | Status | ETA |
|---|-------|--------|-----|
| 1 | Variant whitelist sync (rubric JSON + nav pool) | ⬜ todo | 4h |
| 2 | Fix contentDepth500 evaluator (full visible text) | ⬜ todo | 3h |
| 3 | Single source of truth `template-rules.ts` | ⬜ todo | 1.5d |
| 4 | Fix aiVisible:false paradox (6 blocks) | ⬜ todo | 3h |
| 5 | CTA suggestion per category | ⬜ todo | 4h |
| 6 | Harness evaluation rule guide doc | ⬜ todo | 4h |
| 7 | Validation & ship | ⬜ todo | 4h |

## Key files

- `scripts/test-harness/rubric/rubric-v1.3.json` — rubric variant whitelists
- `scripts/test-harness/rubric/evaluators.ts` — custom evaluators
- `scripts/test-harness/assertions/variant-whitelist.ts` — BROKEN_VARIANTS
- `src/lib/ai/category-requirements.ts` — composer floor (will become re-export shell)
- `src/lib/ai/template-composer.ts` — CATEGORY_INDUSTRY_BLOCKS (will migrate)
- `src/lib/ai/openai-generator.ts` — nav variant pool
- `src/lib/ai/pages-schema.ts` — nav variant enum
- `src/blocks/*/config.ts` — aiVisible flags (6 blocks to flip)
- **NEW** `src/lib/ai/template-rules.ts` — single source of truth
- **NEW** `src/lib/ai/suggested-cta.ts` — per-category CTA suggestions
- **NEW** `docs/standards/HARNESS_EVALUATION_RULES.md` — QC guide

## Dependencies

Phase 1, 2 are independent → can run in parallel.
Phase 3 must complete before consumer migrations in Phase 4.
Phase 5 is independent.
Phase 6 can run after Phase 3 is documented.
Phase 7 is last (validation).
