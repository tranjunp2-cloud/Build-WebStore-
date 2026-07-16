# 2026-07-09 — GH-1185 retest fixes: business-context image keywords + logo-cloud monogram

## Context
QA retest (issue #1185 comment, @aryhibye, `bakery-chinmuoi` vi) after PR #1481 found: (1) gen images still industry-generic — rawKeywords sourced from `products` only; (2) logo-cloud slots mixed 1-char initials with grayscale pool photos.

## Decisions
- **LLM keyword extraction** over description heuristics: new `src/lib/ai/extract-image-keywords.ts` (gpt-4.1-nano hardcoded per `generate-meta.ts` precedent — no config.ts/env churn). Runs inside `imagePoolPromise` IIFE, concurrent with AI gen → ~0ms wall-clock. Any failure → `[]` → exact pre-fix products-only behavior. Skipped when products already fill the cap-3 budget (post-review guard).
- **Keep `BLOCK_IMAGE_SPEC['logo-cloud']`, skip only fulfillment**: spec entry is shared by hydrate/cleanup/strip (editor real-logo ingest). New `NO_STOCK_BLOCKS` set in `planImageNeeds` blocks stock photos regardless of `PIXABAY_BLOCKS=all`. Placeholder upgraded to `computeMonogram` (single-word→2 chars, multi-word→≤3 initials) brand tile — matches original CLIENT_LOGOS_LIBRARY name-only design intent.
- Pixabay `q` is AND-matched → merged keywords capped at 3, products-first (`mergeKeywords`).

## Gotchas
- `businessInfo.language` doesn't exist on `BusinessInfoInput` — route-scope `language` var used instead; `'auto'` sentinel must be omitted from LLM prompt.
- Worktree has a pre-existing repo-wide `next lint` failure (duplicate eslintrc/lockfile conflict with main repo root) — unrelated to changes, verified on untouched files.
- Persisted pages generated before this fix keep numeric pool-photo logo IDs — only new gens render monograms (flagged to QC).

## Outcome
69/69 tests green (4 suites), `tsc --noEmit` clean, review 9/10 (0 critical/high, both Mediums fixed). TC-F38-RAW-18..22 + TC-F04.LC1..LC3 added. Plan: `plans/260709-1404-GH-1185-image-business-context-logo-cloud/`.
