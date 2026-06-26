# Phase 01 — Newsletter brand input dark-mode fix

**Status:** completed · **Priority:** P1 · **Effort:** 10m · **Owns:** `src/blocks/newsletter/index.tsx`

## Overview

Brand-variant email input has three issues on dark-mode sites:
1. Placeholder invisible — no `placeholder:*` class; inline `style` cannot target `::placeholder`
2. No explicit background — input blends into dark section background
3. Text color handled by inline `style` only — already works via `CSS_VARS.text` (`var(--text)`), no change needed

`inverse` branch already has `bg-white/15 placeholder:text-white` — only `brand` branch needs fixing.

## Root cause

`src/blocks/newsletter/index.tsx:176` — brand (else) branch of the ternary:
```
'border focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)]'
```
Missing: `placeholder:*` and `bg-*`. Contrast: contact `INPUT_BASE_CLASS` has both `placeholder:text-[var(--text-muted)]` and `bg-[rgba(var(--brand-primary-rgb),0.03)]`.

## Change

File: `src/blocks/newsletter/index.tsx`, line 176, brand branch only.

Before:
```
'border focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)]'
```

After:
```
'border bg-[rgba(var(--brand-primary-rgb),0.03)] placeholder:text-[var(--text-muted)] focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)]'
```

**Why `bg-[rgba(var(--brand-primary-rgb),0.03)]`:** Same value used in contact `INPUT_BASE_CLASS` — subtle branded tint that separates the input from the section background in both light and dark modes.

**Why `placeholder:text-[var(--text-muted)]`:** `--text-muted` is palette-based (site colorMode-aware). Inline `style` cannot reach `::placeholder` pseudo-element.

## Constraints (do NOT violate)

- Do NOT touch the `inverse` branch — already has `bg-white/15 placeholder:text-white`.
- Do NOT remove/change inline `style color:` on line 179 (`CSS_VARS.text`) — text color already correct.
- Use `--text-muted` (palette-based), NOT legacy `--muted`.
- Use `--brand-primary-rgb` for bg (same as contact fix).

## Affected variants

All 6 variants render `EmailForm` with `variantColor='brand'`: inline, popup, banner, stacked-card, minimal, incentive-grid. Single edit fixes all.

## Implementation steps

1. Open `src/blocks/newsletter/index.tsx`, line 176.
2. In the brand (else) string, after `border ` insert `bg-[rgba(var(--brand-primary-rgb),0.03)] placeholder:text-[var(--text-muted)] `.
3. Compile check: `npx tsc --noEmit` — expect 0 errors (string-literal change only).

## Todo

- [x] Edit line 176 brand branch — add bg + placeholder classes
- [x] Confirm inverse branch untouched
- [x] Confirm inline style line 179 untouched
- [x] Compile check passes

## Success criteria

- Placeholder text legible in dark mode across all 6 newsletter variants.
- Input visually distinct from section background in dark mode.
- Light mode unchanged (palette vars resolve per colorMode).
- `inverse` branch unaffected.

## Risk

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `--text-muted` undefined in some palette | Low | Med | Palette-standard var; used elsewhere in storefront |
| `bg-[rgba(...,0.03)]` too subtle to notice | Low | Low | Same value as contact input — already proven OK |
| Accidental edit to inverse branch | Low | Low | Single ternary line — visually confirm only else string changed |

## Completion Results

**Completed:** 2026-06-26 · **Status:** DONE

- Code edit: line 176 brand branch updated with `bg-[rgba(var(--brand-primary-rgb),0.03)] placeholder:text-[var(--text-muted)]`
- Inverse branch: confirmed untouched
- Inline style: confirmed untouched (line 179 `CSS_VARS.text` preserved)
- Compile check: `npx tsc --noEmit` — **0 errors**
- Code review score: **9.5/10** — 0 critical issues, no blockers

## Rollback

`git checkout src/blocks/newsletter/index.tsx` — single-hunk, no dependents.
