# Wave 1 Completion Report

**Date**: 2026-04-19
**Branch**: `fix/F01-wave1-completion` ← `origin/staging`
**Parent plan**: [`260417-0817-wave1-wix-detailed-plan`](../../260417-0817-wave1-wix-detailed-plan/plan.md)

## Summary

Wave 1 (A1 + A2 + A3 + C2) was shipped to `origin/staging` via PR #690 (`fb9579e7`). Only residual gap = `dedupSectionLabel` helper wired at 1 site but missing at 6 others. This completion PR wires the remaining 6 sites + verifies all 5 success metrics.

## Metrics

| # | Metric | Status | Evidence |
|---|---|---|---|
| 1 | Variant distribution ≥ 80% pool utilization | ✅ | `variant-rotation.test.ts` passes (part of 6058/6058 green) |
| 2 | 0 sites render fallback dark cyan/magenta | ✅ | `FALLBACK_COLOR_MODE = 'light'` in `src/lib/theme/resolve.ts`; `FALLBACK_SECONDARY_COLOR = '#374151'` |
| 3 | `BLOCK_IMAGE_SPEC` ≥ 15, 0 `placehold.co` in composer | ✅ | 15 entries in `media-injector.ts`; `grep -c placehold.co src/lib/ai/template-composer.ts` → 0 |
| 4 | 11/11 hero variants pass overlay check | ✅ | 4 variants use image BG (cards-overlay, parallax, slideshow, video) — all have overlay; other 7 use gradient blobs/side images (body BG, no overlay needed) |
| 5 | 0 "unknown variant" fallback | ✅ | `BROKEN_VARIANTS` tracks hero + testimonials orphans; no staging log `unknown variant` hits in last 7d (sample) |

**Result**: all 5 metrics ✅.

## Changes in this PR

- Wired `dedupSectionLabel` in 6 previously-missed emission sites:
  - `src/lib/ai/add-section.ts:560` (about case)
  - `src/lib/ai/generate-blocks.ts:549` (about case)
  - `src/lib/ai/generate-blocks.ts:557` (features case)
  - `src/lib/ai/seed-templates.ts:52` (features helper)
  - `src/lib/ai/seed-templates.ts:89` (about helper)
  - `src/lib/ai/seed-templates.ts:132` (aboutPage scaffold)
- Added imports for `dedupSectionLabel` in `generate-blocks.ts` + `seed-templates.ts`.

No schema / migration / dep changes.

## Test

- `pnpm test` → **6058/6058 passed** (299 test files, 44.45s)
- 0 new test failures; existing `dedup-section-label.test.ts` (7 cases) continues to pass
- TypeScript: 0 errors in edited files (baseline pre-existing drizzle-orm duplicate-type errors unrelated)

## Misclassified-audit notes

- Earlier audit flagged "8/11 hero variants missing overlay". Re-audit: 7 of those 8 don't render image as full BG → overlay is N/A. Only 4 variants (cards-overlay, parallax, slideshow, video) actually render image BG, all have overlay.
- Earlier audit flagged "BLOCK_IMAGE_SPEC only 10 entries". Re-audit: grep regex missed unquoted TS keys (`hero:` vs `'hero':`). Actual count = 15.

## Residual follow-ups (Wave 2 scope, not blockers)

- `A3.2` BROKEN_VARIANTS expansion to per-block systematic audit (currently 2 blocks documented). Recommend adding snapshot test `BROKEN_VARIANTS-coverage.test.ts` that asserts every Zod variant enum value has a matching switch case in `blocks/{block}/index.tsx`. Effort ~2h.
- `variant-pool-validator` scope (11 blocks) vs `rotateStructuralVariants` pools (14 blocks). Expand validator to 14 so NAV/CONTACT/FOOTER pools are checked. Effort ~20m.
- Dev-time `[theme] resolveTheme filling ≥ 2 fields` warn spec'd but not emitted. Nice-to-have; defer.

## Unresolved Questions

1. Should `variant-pool-validator.ts` expand 11 → 14 blocks as part of this PR or Wave 2? (Currently deferred.)
2. Should `BROKEN_VARIANTS` orphan audit run as a CI snapshot test? (Deferred, Wave 2 scope.)
