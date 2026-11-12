---
title: "fix(F01): malay input still generates english product descriptions (#2160)"
status: in-review
issue: 2160
branch: fix/F01-2160-malay-content-language
---

# Plan — #2160 BM input → EN product short description + EN headings

Scout: `plans/reports/scout-261104-1100-issue-2160-malay-english-leak.md`

## Scope
| # | Symptom | Root cause | Phase |
|---|---------|-----------|-------|
| 1 | Product description EN ("Frothy milk coffee…") | `generate-sample-products.ts:112-134` — `ms` gets no language rule; storefront shows `shortDescription` only | [phase-01](phase-01-sample-product-short-description-malay.md) |
| 2 | "Gallery" heading + nav item | `template-composer.ts:556-560` hardcoded `Gallery — {name}`; `/gallery` page title from preset `name: 'Gallery'` | [phase-02](phase-02-gallery-headline-and-page-title-locale.md) |
| 0 | Template-first composed in EN for builder requests (`language:'auto'` + `generationLocale`) | `openai-generator.ts` passed raw `language` to `generateTemplateFirst` → `'auto'` → `'en'` (found in localhost repro) | phase-02 addendum |
| 3 | Homepage newsletter heading EN ("Stay Updated with…") — same class, i18n exists, 1 fn | `template-composer.ts:643-651` | phase-02 |

Branch from `staging`: `fix/F01-2160-malay-content-language`. PR → staging, `Relates to #2160`.

## Phases
- [x] Phase 01 — sample product `shortDescription` in BM for `ms`
- [x] Phase 02 — gallery headline + `/gallery` title + newsletter localized
- [x] Phase 03 — QA doc TC-TF-028..031, update TC-TF-007; `npm run verify`

## Key decisions
- Keep bilingual product schema: `description` = EN, `descriptionBM` = BM (Products.ts). Fix only customer-facing `shortDescription`.
- Gallery page title localized **after** `enrichSubPages` (it matches pages by EN title + derives Blog-page nav URLs from titles). Never touch `pageNames`/slug.
- Reuse existing i18n (`getSectionLabels`, `getBlockStrings`); no new keys. en output byte-identical.

## Review findings (applied)
- Original step "title at `:1834`" would create `/galeri` links on Blog page → moved after `enrichSubPages`.
- Dropped nav test via service internals (would re-implement `normalizedPageLinks`); assert page title + no `/galeri` URL instead.
- blog-list `items` placeholders not rendered (block fetches posts from API) → not an issue.
- Review 2: all storefront product text reads `shortDescription` (card, featured, detail, quick-view `:389`); locale reaching products is normalized `ms` (`normalizeSupportedLocale`); newsletter button/placeholder left to existing normalizer; eyebrow/headline repeat matches en pattern (accepted); no snapshot tests; 16 `/gallery` presets all slug-matched.

## Out of scope (too wide / separate) — see phase-03
Blog page headings (needs new i18n keys × 8 locales), other page titles/SEO, category "Fnb", EN curated fallback, BM names when nothing listed.

## Validation
- Unit tests (TC-ID); existing suites green; scratch probe re-run (ms clean, en unchanged).
- Manual: issue repro on local `/builder/new`.
