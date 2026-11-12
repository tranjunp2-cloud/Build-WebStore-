# Phase 02 — Gallery headline + `/gallery` page title + newsletter (BM)

**Priority:** P2 · **Status:** done

## Context
- `src/lib/ai/template-composer.ts`
  - `:556-567` `buildGallery(biz)` → `` `Gallery — ${biz.name}` `` (no language)
  - `:643-651` `buildNewsletter(biz)` → `Stay Updated with …` / `Get the latest news…` (no language; i18n exists: `block-i18n.ts` `newsletter.headlineStayUpdated`, `subheadlineFallback`)
  - Callers: `buildBlockFromSpec` `:1476` (gallery), `:1488` (newsletter) — has `language`, = blueprint path used in prod. Legacy `buildHomePage` `:1098/:1103/:1130` + `buildBlogPage` `:1281` — no language → leave as-is.
  - Page title `:1834` `title: page.name` (preset `name: 'Gallery'`)
  - **`enrichSubPages` `:1654-1730` runs AFTER `:1834`**: matches pages by EN title (`getPage('About'|'Contact'|'Blog')`) and builds Blog page nav/footer from `pageNames = pages.map(p => p.title)` → URL derived from title (`buildNavigation` `:214-218`). Localizing title at `:1834` would produce `/galeri` links → **must localize after `enrichSubPages`**.
- Downstream (verified): service nav/footer force-replaced from `p.title` with URL from slug (`generate-site-service.ts:1682`, `ensure-navigation.ts:193-203`); `canonicalizePageSlug` keeps `/gallery` (title regex only about/contact/blog); `gen-page-split` composerFallback matches by slug; `seo-generator.ts:173` → `Galeri · {biz}`.
- Labels: `getSectionLabels(lang)?.gallery` — ms `Galeri`, vi `Thư Viện Ảnh`, en none.

## Changes
1. `buildGallery(biz, language?)`: `const label = getSectionLabels(language)?.gallery ?? 'Gallery'`; headline `` `${label} — ${biz.name}` ``. Pass `language` at `:1476`.
2. `buildNewsletter(biz, language?)`:
   - headline `i18n.newsletter.headlineStayUpdated(biz.name)` (en identical: `Stay Updated with X`)
   - subheadline: en keeps current text; non-en → `i18n.newsletter.subheadlineFallback` (en i18n text differs → keep en output byte-identical)
   - buttonLabel/placeholder: **leave as-is** — `normalizeNewsletterStrings` (post-ai-swap.ts:523) already localizes them; touching risks a different BM label.
   - Same strings as precedent `content-injection.ts:497-502`.
   - Pass `language` at `:1488`.
3. In `composeFromBlueprint`, after `enrichSubPages(...)` + `rotateStructuralVariants(...)`: set `title` of page with slug `/gallery` to `getSectionLabels(language)?.gallery` when defined. Slug, `pageNames`, nav/footer builders untouched.

Side effect: vi gets same fixes (`Thư Viện Ảnh`, `Cập Nhật Mới Nhất Từ …`). en output unchanged.

## Tests — new `src/__tests__/unit/templates/template-composer-malay-locale.test.ts` (real `composeTemplateResult`, no re-impl)
- TC-TF-029a: ms fnb seeds 1-3 → every gallery headline starts `Galeri — `; `/gallery` page title `Galeri`, slug `/gallery`.
- TC-TF-029b: ms → no nav/footer link URL `/galeri` on any page (guards enrichSubPages ordering).
- TC-TF-030: ms → newsletter headline `Ikuti Perkembangan Terbaru {name}`, subheadline BM.
- TC-TF-029c/030b: en → gallery `Gallery — {name}`, title `Gallery`, newsletter `Stay Updated with {name}` + `Get the latest news…` (regression).

## Todo
- [x] buildGallery + caller
- [x] buildNewsletter + caller
- [x] gallery page title after enrichSubPages
- [x] tests; re-run scratch probe (ms/en, fnb/restaurant, seeds 1-8)

## Risk
- Eyebrow + headline repeat ("GALERI" / "Galeri — X"): accepted — en today renders identical pattern (component fallback eyebrow `Gallery` + `Gallery — X`); no dedup runs in gen pipeline. Not changing eyebrow logic.
- Only 16 presets have `/gallery` page, all `name: 'Gallery'` → slug match covers all.
- Other `composeFromBlueprint` callers (`api/templates/seed`, `scripts/test-harness`) use default `en` → unchanged.
- Legacy `buildHomePage` path (composeTemplate, non-blueprint) stays EN — not used by template-first prod path (`composeFromBlueprint`).
- Blog page newsletter (`buildBlogPage`) stays EN — out of scope (blog page deferred).

## Addendum — root cause found in localhost repro
Composer fix alone did not reach prod path: builder sends `language: 'auto'` + `generationLocale`, and `openai-generator.ts` passed raw `language` to `generateTemplateFirst` (`resolvedLang = 'auto' → 'en'`). Log showed `path=template-first … lang=en` with `sites.generation_locale = 'ms'`.
- Fix: pass `detectedLang` (resolved locale, same as quota path) to `generateTemplateFirst`.
- Test: `src/__tests__/unit/ai/template-first-resolved-locale.test.ts` (TC-TF-031a/b) — fails without fix.
