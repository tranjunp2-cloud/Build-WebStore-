# Researcher 01 — A1 + A2 Post-Ship Audit

**Date**: 2026-04-18
**Audit scope**: Wave 1 Phase 01 (A1 variant wiring) + Phase 02 (A2 theme fallback) on `origin/staging`.
**Context**: PR #690 (`fix/F01-wave1-wix-wave1`, commit `fb9579e7`) merged to staging. F05 branch 19 commits behind.

## A1 — Variant Wiring — **shipped**

**Shipped on `origin/staging`**:
- `src/lib/ai/category-requirements.ts:133-400` — 14 pool tables (NAV..SERVICE_CARDS)
- `src/lib/ai/template-composer.ts` — `export function rotateStructuralVariants(...)` (exported ✅)
- `src/lib/ai/variant-pool-validator.ts` — validator module (11 blocks)
- `src/__tests__/unit/ai/variant-pool-validation.test.ts` — Zod ↔ pool match tests
- `src/__tests__/unit/ai/variant-rotation.test.ts` — distribution + stability tests
- Commits: `d44dc4ad`, `b9317d2d`, `fb9579e7`

**Residual issues (minor)**:
- Validator scope = 11 blocks, rotate pools = 14 → 3 blocks (NAV, CONTACT, FOOTER) not validated against Zod enums. Effort 20m to extend.
- Debug log `[composer] rotate=` not implemented. Effort 10m.

**Conclusion**: A1 success metric #1 (distribution ≥ 80% pool utilization) cannot be measured without debug log, but core wiring + tests are in. Residual = 30m.

## A2 — Theme Fallback — **shipped**

**Shipped on `origin/staging`**:
- `src/lib/theme/resolve.ts` — refactored: `const colorMode = partial.colorMode || FALLBACK_COLOR_MODE` with `FALLBACK_COLOR_MODE` constant
- `src/__tests__/unit/theme/a2-fallback-hardening.test.ts` — 5 test cases

**To verify post-sync**:
- Confirm `FALLBACK_COLOR_MODE` = `'light'` not `'dark'`
- Confirm LIGHT_DEFAULTS palette matches spec (primary `#111827`, secondary `#374151`, bg `#ffffff`)
- Confirm dev warn `[theme] resolveTheme filling ≥ 2 fields` emits when partial palette detected
- Confirm `category-theme-picker.ts` returns full 6-color palette per category

**Residual effort if gaps**: 1-2h (default flip + dev warn + category audit).

## F05 branch sync state

- F05 is 19 commits BEHIND `origin/staging`
- `origin/staging..HEAD` = empty → F05 has no unique commits
- Simple `git merge origin/staging` brings wave1 + wave2 in

## Unresolved Questions

1. Is `FALLBACK_COLOR_MODE` literal `'light'` on staging, or still `'dark'`?
2. Does `category-theme-picker.ts` write full palette per category, or only `{preset, mood}`?
3. Should validator scope be expanded 11 → 14 as part of this completion, or deferred to Wave 2?
