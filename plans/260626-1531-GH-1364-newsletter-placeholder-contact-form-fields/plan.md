---
title: "GH-1364: Newsletter placeholder + Contact empty formFields"
description: "Fix newsletter brand variant placeholder invisible in dark mode; add default formFields fallback in ContactForm"
status: completed
priority: P1
effort: 30m
branch: fix/1364-contact-input-dark-mode
tags: [dark-mode, storefront, contact, newsletter, form]
created: 2026-06-26
---

# GH-1364 — Newsletter placeholder + Contact empty formFields

Two isolated storefront bugs. Scouting complete; line refs verified against source. CSS/fallback-only — no logic paths, no tests.

## Phases

| # | Phase | File owned | Status | Effort |
|---|-------|-----------|--------|--------|
| 01 | [Newsletter placeholder dark-mode fix](phase-01-newsletter-placeholder.md) | `src/blocks/newsletter/index.tsx` | completed | 10m |
| 02 | [Contact empty formFields fallback](phase-02-contact-form-fields-fallback.md) | `src/blocks/contact/index.tsx` | completed | 20m |

## Dependency graph

```
Phase 01 ──┐  (disjoint files — fully parallelizable)
Phase 02 ──┘
```

No cross-phase dependency. Different files, different blocks. Can run in parallel or any order.

## Data flow summary

- **Phase 01:** Newsletter brand input missing `placeholder:*` and `bg-*`. Adds `bg-[rgba(var(--brand-primary-rgb),0.03)]` (same as contact INPUT_BASE_CLASS) + `placeholder:text-[var(--text-muted)]`. Inline `style color:` already correct — untouched.
- **Phase 02:** AI-generated/saved `formFields[]` → `ContactForm` → `.map()` render. Empty array → 0 fields rendered. Fix interposes a `DEFAULT_FORM_FIELDS` fallback between data and render.

## Out of scope

- `FooterNewsletterForm.tsx` — not imported anywhere (dead code), skip.
- `openai-generator.ts` upstream fix — UI fallback covers all cases incl. old saved data.
- **AC8 (Editor validation)** — Editor Settings panel block khi `formFields: []` + variant ≠ `info-only`. Deferred to separate issue (editor/builder scope, different codebase area).
- Unit tests — no logic branches worth testing; pure presentational/fallback change.

## Verification (manual, storefront)

1. Render newsletter block (inline/popup/banner/stacked-card/minimal/incentive-grid) in dark mode → placeholder text legible, input visually distinct from background.
2. Render contact block with `formFields: []` → Name/Email/Message fields appear.
3. Render contact block with explicit `formFields` → unchanged (explicit wins).
4. Render contact `info-only` variant → no form fields injected (early-return path).

## Validation Summary

**Validated:** 2026-06-26 · **Questions:** 3

### Confirmed Decisions
- **Default labels:** English-only hardcode — consistent with `phoneLabel = 'Phone'`, `addressLabel = 'Address'` etc. at line 325; no storefront block calls `getBlockStrings` at render time
- **Default fields:** 4 — name (required), email (required), phone (optional), message (required)
- **API verified:** `/api/contact-submit` Zod schema hardcodes all 4 field names; phone is optional ✅
- **Type handling:** no `language` prop, no `getBlockStrings` import — plain const, single-file change

### Action Items
- [x] Phase 02 updated: English-only `DEFAULT_FORM_FIELDS` const, 4 fields, no new imports

## Rollback

Each phase = single-file, single-hunk edit. Revert = `git checkout src/blocks/{newsletter,contact}/index.tsx`. No schema, no migration, no data change → zero cascade.
