# Template Gen Flow — Visual Output Audit

## ⚠️ Correction — 2026-04-15 (sau khi deep-dive navigation)

Finding **F1** bên dưới **KHÔNG CHÍNH XÁC** — tuyên bố "variant selection là dead code, chỉ hero rotate" là sai. Sự thật:

1. **`rotateStructuralVariants`** (`src/lib/ai/template-composer.ts:1398-1419`) ĐANG HOẠT ĐỘNG cho 3 block types: `navigation`, `contact`, `footer`. Được gọi ở dòng 1869 trong `composeTemplateFromPreset`.
2. Mỗi block type có pool variants theo category ở `src/lib/ai/category-requirements.ts`:
   - `NAV_VARIANT_BY_CATEGORY` (dòng 133-148) — 14 categories × 3 variants
   - `CONTACT_VARIANT_BY_CATEGORY` (dòng 159-174)
   - `FOOTER_VARIANT_BY_CATEGORY` (dòng 180+)
3. Hero rotate theo `CATEGORY_HERO_VARIANTS` riêng (dòng 187 trong `buildHero`).
4. `seededShufflePick(pool, seed ^ hashString(salt))` — deterministic theo seed, cùng seed → cùng variant.
5. Trong `composeBlockFromSpec` (blueprint path, dòng 1495) có call `selectVariant(spec.blockType, compositionSeed, category)` cho mọi block — nhưng phụ thuộc `selectVariant` được register cho block type đó hay không.

**Vấn đề thực sự**: rotation hiện chỉ bao phủ 4 block types (hero, nav, contact, footer). Còn lại **~45 blocks** (features, pricing, testimonials, about, cta, stats, newsletter, team, faq, gallery, service-cards, team, v.v.) vẫn hardcode variant trong các `buildX` function. Đó mới là gap thật.

→ Xem `nav-bugfix-followup.md` cho các fix navigation cụ thể đã làm.
→ Phase 01 của plan chính (`phase-01-variant-wiring.md`) cần scope lại: **MỞ RỘNG pattern rotation sẵn có** cho 45 blocks còn thiếu, KHÔNG phải viết mới từ đầu.

Phần còn lại của report (F2-F7) vẫn đúng.

---

## Render path (1-line map)
`generate-site API → template-composer.buildX() [variant via variantIndex] → structure-enforcer → media-injector (mutates image fields with Media IDs) → Payload save → SiteRenderer (resolveTheme → generateThemeCSS → block components receive {block, theme, site, page})`

Key files:
- `src/lib/ai/template-composer.ts` (1939 lines — deterministic block builders)
- `src/lib/ai/media-injector.ts` (image field mutator, BLOCK_IMAGE_SPEC)
- `src/lib/ai/image-pool.ts` + `media-pipeline.ts` (Unsplash fetch)
- `src/components/site-renderer/SiteRenderer.tsx` (theme resolve, global header/footer merge)
- `src/lib/theme/resolve.ts` (theme defaults + CSS var gen)

## Critical findings

### F1. Block variant selection (đã sửa lại sau correction)
- **Hero**: `CATEGORY_HERO_VARIANTS[category]` map mỗi category → 2-4 hero variants. `buildHero(biz, cat, variantIndex)` picks theo variantIndex.
- **Navigation / Contact / Footer**: CÓ rotation qua `rotateStructuralVariants` (dòng 1398-1419) + pool `NAV_VARIANT_BY_CATEGORY` / `CONTACT_VARIANT_BY_CATEGORY` / `FOOTER_VARIANT_BY_CATEGORY` ở `category-requirements.ts`. 14 categories × 3 variants mỗi block. Deterministic via `seededShufflePick`. Tuy vậy `buildNavigation` dòng 154 vẫn hardcode `variant:'simple'` trong return — rotate override sau nên không ảnh hưởng luồng chính, nhưng bất cứ code path nào không chạy qua rotate (editor tạo page bằng tay) sẽ kẹt ở simple.
- **45+ blocks còn lại** (features, pricing, testimonials, about, cta, stats, newsletter, team, faq, gallery, service-cards, v.v.): hardcode variant trong composer — `features:'grid-3'`, `gallery:'grid'`, `contact:'split'` (trước khi rotate override), `footer:'expanded'`. Chưa có pool + rotate.
- **Issue thực**: variant rotation bao phủ 4 block types, 45 types còn lại chưa có → các site cùng category ra features/pricing/testimonials giống hệt nhau.
- **Impact**: templates converge ở 45 blocks. Structure-level variety chỉ thấy ở nav/hero/contact/footer.

### F2. Theme resolution
- SiteRenderer.tsx line 81-98: `resolveTheme()` pulls from `site.theme?.*` DB fields, generates CSS vars string, injects via `<style>` tag. Blocks receive `theme` prop.
- Defaults in resolve.ts line 72-110: **colorMode default = 'dark'**, primary fallback `#0ea5e9` (cyan), secondary `#d946ef` (magenta), bg `#09090b`. Borderradius default `rounded`, shadow `subtle`.
- Issue: if composer writes `site.theme` w/ only 1-2 colors (common — composer sets primary + secondary from category-theme-picker only), resolver fills rest w/ defaults → every site ends up dark cyan/magenta unless composer explicitly sets colorMode:'light' + full palette. Need to verify category-theme-picker actually writes full palette to site.theme.
- Blocks DO receive theme (line 279: `<BlockComponent block={normalizedBlock} theme={theme} ... />`) but individual blocks may ignore it and use CSS vars only; if block uses hardcoded Tailwind classes (e.g. `bg-gray-900`) the theme is silently dropped.

### F3. Image injection
- `media-injector.BLOCK_IMAGE_SPEC` covers ONLY 7 block types: hero, about, gallery, portfolio-grid, team, testimonials, logo-cloud.
- Issue: **features, services, cta, banner, video-background, products-grid, property-card, doctor-profile, event-card, case-study, before-after, stats, timeline, pricing, faq, blog-posts, press, partners, map — NO image spec**. These blocks either get placeholders from composer or render empty image slots.
- Composer hardcodes `placehold.co/...` URLs for gallery (line 567-573) — if media-injector fulfils these, fine; if not, user sees gray "Gallery 1" placeholder. Gallery IS in the spec so it's OK, but only if images[] array exists — composer passes 6 items so minCount=6 is met.
- Plan 260414-2249 phase-03 added `ctx.pool` (image pool per category + role). If pool is empty/API fails, media-injector falls through to `placehold.co` gray placeholders — visually dead.

### F4. Header/Nav data flow
- template-composer `buildNavigation()` (142-159): only sets `logoText` (business name TEXT, not logo image), links from pages list (auto-capitalized), and CTA hardcoded to `/contact`. **No `logo` image field.** Hardcoded variant `'simple'`. No mobile menu config, no sticky prop, no transparent-on-hero prop.
- SiteRenderer does `applyGlobalSystemBlocks()` (52-78): if `site.headerBlock` exists, it replaces the page's nav block. So the composer's nav may be OVERWRITTEN by a stored headerBlock after first save — meaning subsequent regens don't update nav. This is fine but hidden.
- Impact: every generated site gets same simple-variant text-logo nav. No variety. Logo = wordmark only.

### F5. Hero data flow
- `buildHero()` (181-231): headline derived from `biz.name + " — " + (topProduct || descWords || tagline)`, capped at 10 words. Subheadline = truncated description (140 chars). CTAs hardcoded `/contact` + `/about`. `height: '90vh'`, `overlayOpacity: 0.4`. Variant rotates by category table.
- Image: NOT set by composer. media-injector fills `hero.image` + `hero.backgroundImage` with same Media ID (line 119-132) — sharing 1 image across both fields. Relies on ctx.pool hero bucket; if pool empty → placeholder.
- Good: real biz data reaches hero. Bad: CTAs always `/contact` + `/about`, no variation; heights fixed; 2 variant pool per category is thin.

### F6. Contact data flow
- `buildContact` (line 438-450 in template-composer.ts): **DOES** set `email: biz.email`, `phone: biz.phone`, `address: biz.address`. So user data IS threaded to contact block. Variant hardcoded `'split'`.
- Footer (472-): sets `logoText: biz.name`, link columns include `{ label: biz.email, url: 'mailto:...' }` and `{ label: biz.phone, url: 'tel:...' }`. Contact info reaches footer too.
- Status: Phase 01 of ai-gen-wix-level-optimize (user-data threading) appears DONE based on code inspection. Contact/footer receive real data.

### F7. Common visual bugs observed (by code smell)
1. **Dark-mode default** (resolve.ts:72) — any site without explicit colorMode gets `#09090b` bg. If category picker writes light colors but leaves colorMode unset → mismatch (dark bg + light-designed blocks).
2. **Hardcoded placeholders in gallery** (template-composer:567-573) — `placehold.co/600x400/e2e8f0/64748b` gray boxes if media-injector pool fails.
3. **No logo IMAGE anywhere** (nav.logoText only is string).
4. **Single variant per non-hero block** → structural monotony.
5. **90vh hero + fixed overlayOpacity 0.4** — no variety in hero intensity/height.
6. **BLOCK_IMAGE_SPEC coverage gap** — features, services, cta, products, etc. have no image injection → render empty `<Image>` slots or hardcoded placeholders inside block component defaults.
7. **Font fallback** — if `fontPairingId` null, defaults to `Outfit + Inter` for every site. No rotation.
8. **Nav CTA hardcoded `/contact`** even when site has no /contact page → broken link; SiteRenderer rewrites to `#` in editor but not in live preview/production render.
9. **applyGlobalSystemBlocks** silently overwrites page nav with stored headerBlock → regen may appear broken (old nav sticks).

## Status of prior pending work
- Phase 01 user-data threading: **DONE** (email/phone/address reach contact + footer; biz.name reaches nav/hero; description reaches hero subheadline)
- Phase 02 theme moods: **PARTIAL** — `theme-moods.ts` + `resolveCTA(mood, ...)` exists and is called in buildHero/buildNavigation for CTA labels. But mood doesn't drive layout/variant/spacing/shadow. Mood = CTA text change only.
- Phase 03 image-pool consistency: **PARTIAL** — `ctx.pool` + `batchFetchFromPool` + `roleForBlock` implemented for 7 block types. 40+ other blocks don't use pool.
- Phase 04 layout recipes: folder exists at `category-recipes.ts` but composer builders still use hardcoded variants — recipes likely not wired to actual block builder.
- Phase 07 variety retrofit: unknown; `variety-regression-diagnostic.md` report exists in the folder (only report present) — suggests variety was regressed and investigated but not fully fixed.

## Recommended fix scope for "fix từng component cho đẹp"
Must fix (in priority):
1. **Navigation redesign** — add logo image slot (reuse site logo field), add variant rotation (simple/centered/split/mega), sticky-on-scroll, mobile drawer config, transparent-over-hero mode per category.
2. **Hero variant expansion** — grow CATEGORY_HERO_VARIANTS to ≥5 per category, vary height (70vh/90vh/100vh), vary overlay (0.2–0.7), add image-split + asymmetric variants.
3. **Theme palette completeness** — audit category-theme-picker: ensure it writes ALL 6 colors + colorMode + bg to site.theme. Light-mode default for most categories.
4. **BLOCK_IMAGE_SPEC expansion** — add features/services/cta/products/case-study/event-card/doctor-profile/property-card. ≥15 blocks covered (from current 7).
5. **Non-hero variant rotation** — replace hardcoded `variant:'grid-3'/'simple'/'split'` with seeded selector using `selectVariantBySeed` (already exists, just unused).
6. **Gallery hardcoded placeholders** — stop emitting `placehold.co` URLs; rely on media-injector fulfillment + proper fallback.
7. **Hero CTA resolution** — use real page slugs (only emit `/contact` if contact page exists in `pages[]`).
8. **Font pairing rotation** — pick `fontPairingId` from category-tuned pool (similar to theme-picker) instead of always defaulting.

Can defer:
- Animation polish (already done in 260407 block-wix-audit)
- SEO fields (separate pipeline)
- Footer column variety (low visual weight)
- Mood-driven spacing/shadow (nice-to-have after structural variety)

## Unresolved questions
1. Does `category-theme-picker.ts` write full 6-color palette + colorMode, or only primary/secondary? Need to Read it to confirm F7.1 severity.
2. Is `site.headerBlock` pre-populated during first-gen, or only on manual header customization? If always present, `applyGlobalSystemBlocks` silently kills nav regens.
3. Does `category-recipes.ts` actually get called from composer, or is it dead code (phase-04 pending)?
4. For blocks outside BLOCK_IMAGE_SPEC — do their React components have sensible `<Image src={block.image?.url ?? FALLBACK} />` defaults, or do they render broken?
5. Is `colorMode` dark-default intentional for the preview editor (readability) but wrong for end-user sites?
