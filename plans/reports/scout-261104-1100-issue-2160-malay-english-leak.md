# Scout — #2160 Malay input still generates English content

Issue: fix(F01) BM input → product desc + "Gallery" heading English. UAT prod 30/10 (QC BUG-10, UAT TC-F01.28 ≠ docs TC-F01.28; docs equivalent = TC-F01.29 + TC-TF-007).
Path assumed: template-first (GEN_MODE default, no extra instructions in repro). Not verified on prod data (no prod DB/Vercel access).

## Verified by local probe
Script: composeTemplateResult(ms, issue input) + normalizeLocaleStructuralStrings('ms'), industry fnb/restaurant, seeds 1-8 → 16/16 reproduce.

## Root causes

### 1. Product short description English (confirmed by code)
- `src/lib/ai/generate-sample-products.ts:112-134` — `ms` excluded from `targetLanguage` → prompt has no "write in Malay"; asks `description` (EN) + `descriptionBM`. `shortDescription` has no language rule.
- Storefront renders only `shortDescription` (ProductCard.tsx:100, products-featured/index.tsx:189, product detail page.tsx:210/373). `descriptionBM` not rendered anywhere in storefront (and only translates long `description`).
- Platform task `sitegen.sample-products` = caller-composed prompt (`actor-scope.ts:92`), no server-side language injection.
- Side: `canUseEnglishCuratedFallback` (`:401`) includes `ms` → curated EN products when AI fails & nothing listed.
- Side: sample category name = EN composer key (`generate-site-service.ts:2145`).

### 2. "Gallery" (confirmed)
- `template-composer.ts:556-560` `buildGallery(biz)` hardcodes `` `Gallery — ${biz.name}` ``, no language param. i18n exists: `block-i18n.ts:236` ms `gallery.headline = 'Kerja-kerja Kami'`. Since 2026-05-19, on main.
- `normalizeSectionLabels` only fixes `sectionLabel` (→ "Galeri"), not headline.
- Nav/footer `/gallery` link = "Gallery": page titles from presets (`template-presets-batch*.ts name: 'Gallery'`), nav built from `page.title` (`apply-site-nav.ts:15`); slug→label maps only cover `/`, `/about`, `/services`, `/contact`, `/blog` (`generate-site-service.ts:1670`, `post-ai-swap.ts:132`). Page title + SEO title ("Gallery · X") also EN. Only Products page localized (`ensure-products-page.ts:29`).
- Also hit via AI path: `gen-page-split.ts:699` calls composeTemplateResult.

## Other EN leaks in BM output (same class, "một số tiêu đề")
- `buildNewsletter` (`template-composer.ts:643-651`): headline/subheadline hardcoded EN; `block-i18n` has `headlineStayUpdated` but unused. normalizeNewsletterStrings only fixes button/placeholder.
- Blog page builder (`template-composer.ts:1273-1278`): hero "Blog & Updates"/"Latest news from", blog-list "Latest Articles"/subheadline EN; `buildCTA(biz, category)` called without language → "Ready to Get Started with X?" EN. (Blog posts themselves locale-aware.)
- Page titles About/Contact/Home/Menu/Blog EN in pages + SEO.
- Not a bug: `TESTIMONIAL_INVITE_TITLE` EN marker, special-cased in testimonials render.

## Tests / docs
- No test locks current behaviour (descriptionBM prompt, Gallery headline, newsletter).
- Relevant tests: `src/__tests__/unit/templates/template-composer.test.ts`, `unit/lib/ai/sample-products-image-fallback.test.ts`, `unit/lib/ai/post-ai-swap.test.ts`.
- `docs/qa/F01-template-first-gen.md` TC-TF-007 says "Template body content = English (known limitation until Phase 04)" → must update.

## Unresolved questions
1. Prod GEN_MODE confirmed template-first? (Vercel env)
2. Keep `descriptionBM` for ms (bilingual PW1 model) or write `description` in BM only?
3. Scope: only Gallery + products (issue) or whole class (newsletter, blog page, page titles, vi too)?
4. Page titles: localize page `title` (affects slug? no — slug separate) vs only nav/SEO labels?
