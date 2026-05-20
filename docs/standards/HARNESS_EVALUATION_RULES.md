---
owner: QC
last_updated: 2026-04-29
rubric_version: v1.3
---

# Harness Evaluation Rules — QC Reference Guide

Quick-access reference for the test-harness rubric v1.3. Use this when a template report says FAIL or WARN and you need to understand **why** and **what to tell the developer**.

---

## 1. Overview

The harness generates ~390 template fixtures (14 categories × multiple seeds/presets), evaluates each against the rubric, and produces `rubric-report-v1.3.json`.

### Scoring System

Each fixture receives a **weighted score out of 10**:

| Status | Score | Meaning |
|--------|-------|---------|
| **PASS** | ≥ 7.0 | Template is production-ready |
| **WARN** | 5.0 – 6.9 | Needs improvement before ship |
| **FAIL** | < 5.0 | Blocked — must fix before merge |

**How the score is computed:**

1. Each criterion returns `pass`, `partial`, or `fail` → earns `passPoints`, `partialPoints` (or 0).
2. Each dimension converts earned/max points → score 0–10.
3. Final weighted score = `Σ(dimScore × weight) / Σ(weights)`. Total weight = 103.

Criteria with only `passPoints` (no `partialPoints`) are **hard criteria** — binary pass/fail. Criteria with both `passPoints` and `partialPoints` are **soft criteria** — can earn partial credit.

---

## 2. Dimension Overview (11 Dimensions)

| # | ID | Name | Weight | Purpose |
|---|----|----|--------|---------|
| 1 | `visual-richness` | Visual Richness | 12 | Gallery, stats, logo-cloud, variant diversity, icon usage |
| 2 | `typography-hierarchy` | Typography Hierarchy | 12 | Distinct fonts, headline length, section coverage |
| 3 | `social-proof` | Social Proof & Trust | 10 | Testimonials, logos, ratings, avatars |
| 4 | `micro-interactions` | Micro-Interactions | 9 | Nav variant, CTA block, forms, block diversity |
| 5 | `spacing-rhythm` | Spacing & Rhythm | 10 | Block count sweet spot, no adjacent dupes, token compliance |
| 6 | `conversion-path` | Conversion Path Clarity | 10 | Hero CTA, mid-page CTA, newsletter, CTA copy quality |
| 7 | `content-authenticity` | Content Authenticity | 8 | No Lorem, content depth, FAQ & features item count |
| 8 | `information-density` | Information Density | 8 | Block cap, uniqueness ratio, footer columns, nav links |
| 9 | `accessibility` | Accessibility | 8 | Alt text, heading order, color contrast (UI + body), focus indicator |
| 10 | `category-dna` | Category DNA | 10 | Per-category mandatory block groups compliance |
| 11 | `content-uniqueness` | Content Uniqueness | 6 | Cross-fixture duplication detection (headlines, CTAs) |

---

## 3. Per-Criterion Reference

### Dimension 1 — Visual Richness (weight 12)

---

#### `hero-variant-diverse` · Hard · 3 pts
**What it checks:** Hero block has a variant other than default. Allowed: `split-left`, `split-right`, `fullscreen`, `video`, `magazine`, `minimal`, `cards-overlay`, `gradient`, `parallax`, `slideshow`, `split-video`.

**Source:** `rubric-v1.3.json` → enum check on `hero.variant`

**Common failure:** Hero variant is `default` or missing.

**Fix:** Set `variant` on the hero block to one of the allowed values in the template composer.

---

#### `gallery-present` · Hard · 2 pts
**What it checks:** Template contains at least one block of type `gallery`, `gallery-masonry`, or `portfolio-grid` — on any page.

**Source:** Presence check; searches homepage then all pages.

**Common failure:** Template skips gallery entirely (text-heavy templates).

**Fix:** Add a `gallery` or `gallery-masonry` block. Even a 3-image grid counts.

---

#### `stats-present` · Hard · 2 pts
**What it checks:** A `stats` block is present anywhere in the template.

**Common failure:** Stats omitted in minimal or blog-style templates.

**Fix:** Add a `stats` block with at least 3 items (also helps `social-proof`).

---

#### `logo-cloud-present` · Hard · 2 pts
**What it checks:** A `client-logos` or `logo-cloud` block is present.

**Common failure:** Frequently absent in non-business categories.

**Fix:** Add `client-logos`. Note: `restaurant` and `health` categories do not require this globally, but it contributes points if present.

---

#### `image-coverage` · Hard · 3 pts
**What it checks:** Template has either (a) a gallery/portfolio block OR (b) a hero background image set (`hero.data.backgroundImage` or `hero.data.image` with a non-empty URL). SVG placeholders count — media injector swaps them at runtime.

**Source:** `evaluators.ts` → `imageCoverage`

**Common failure:** Hero has no background image and no gallery block exists.

**Fix:** Set `backgroundImage.url` on the hero block, or ensure a gallery block is present.

---

#### `features-have-icons` · Hard · 2 pts
**What it checks:** If a `features` block uses an icon-* variant, ≥70% of its items must have an `icon` property set.

**Source:** `evaluators.ts` → `featuresHaveIcons`

**Note:** If no `features` block exists OR the variant doesn't contain "icon", this criterion auto-passes (skip).

**Common failure:** `features` block uses `icon-grid` variant but items are missing the `icon` field.

**Fix:** Populate `icon` on each feature item when using icon variants.

---

### Dimension 2 — Typography Hierarchy (weight 12)

---

#### `hero-headline-present` · Hard · 2 pts
**What it checks:** Hero block exists and `hero.data.headline` is a non-empty string.

**Source:** `evaluators.ts` → `heroHasHeadline`

**Common failure:** AI gen omits the headline field entirely.

**Fix:** Ensure the hero block always has a non-empty `headline`.

---

#### `single-hero` · Hard · 2 pts
**What it checks:** Exactly 1 block has `blockType === 'hero'`.

**Source:** `evaluators.ts` → `singleHero`

**Common failure:** AI gen duplicates a hero block (e.g. two pages merged, both have hero).

**Fix:** Remove duplicate hero blocks. Homepage should have exactly one.

---

#### `theme-heading-body-distinct` · Hard · 2 pts
**What it checks:** Theme has BOTH `fontHeading` and `fontBody` explicitly set (string values) AND they are different fonts. Using only `fontPairingId` does NOT pass.

**Source:** `evaluators.ts` → `themeHeadingBodyDistinct`

**Common failure:** Template uses `fontPairingId` only, or sets both to the same font name.

**Fix:** Set both `theme.fontHeading` and `theme.fontBody` to distinct font names explicitly.

---

#### `hero-subheadline` · Hard · 1 pt
**What it checks:** Hero has a non-empty `subheadline` (also checks `subHeadline` camelCase variant).

**Common failure:** Hero block only has headline, no subheadline.

**Fix:** Add `hero.data.subheadline` with a 1-2 sentence description.

---

#### `section-headlines-coverage-85` · Hard · 2 pts
**What it checks:** ≥85% of content blocks (excluding `navigation`, `footer`, `announcement-bar`, `breadcrumb`) have at least one of: `headline`, `sectionLabel`, or `title`.

**Source:** `evaluators.ts` → `sectionHeadlinesCoverage85`

**Common failure:** Generic blocks like `newsletter` or `cta` lack a headline.

**Fix:** Add a `headline` or `sectionLabel` to every content block section.

---

#### `hero-headline-length-strict` · Soft · 2 pts (partial: unspecified → floor 1)
**What it checks:**
- PASS (2 pts): hero headline is 25–70 characters
- PARTIAL: headline is 15–24 or 71–90 characters
- FAIL (0 pts): headline is <15 or >90 characters

**Source:** `evaluators.ts` → `heroHeadlineLengthStrict`

**Common failure:** AI gen produces very long headlines (>90 chars) or placeholder (<15 chars).

**Fix:** Keep hero headline concise — 4-10 words that communicate the core value proposition.

---

#### `hero-subheadline-length` · Hard · 1 pt
**What it checks:** Subheadline is 30–200 characters (partial for 20–29 or 201–300).

**Source:** `evaluators.ts` → `heroSubheadlineLength`

**Fix:** Write 1-2 sentences. Avoid both stub text (<30 chars) and overly long paragraphs (>200 chars).

---

### Dimension 3 — Social Proof & Trust (weight 10)

---

#### `testimonials-present` · Hard · 2 pts
**What it checks:** A `testimonials` block is present on any page.

**Common failure:** Template skips social proof entirely.

**Fix:** Add a `testimonials` block.

---

#### `testimonials-count-3plus` · Hard · 2 pts
**What it checks:** The `testimonials` block has ≥3 items in its `testimonials` or `items` array.

**Common failure:** Only 1-2 placeholder testimonials.

**Fix:** Populate at least 3 testimonial items with real-looking content.

---

#### `logos-count-4plus` · Hard · 2 pts
**What it checks:** The `client-logos` or `logo-cloud` block has ≥4 logos.

**Common failure:** Only 2-3 logos added.

**Fix:** Ensure at least 4 logo entries in the logos array.

---

#### `stats-count-3plus` · Hard · 2 pts
**What it checks:** The `stats` block has ≥3 stat items.

**Common failure:** Only 2 stats (e.g. "10+ years, 500+ clients").

**Fix:** Add a third stat (e.g. "100% satisfaction" or "50+ cities served").

---

#### `testimonial-avatar` · Hard · 2 pts
**What it checks:** At least 1 testimonial item has `avatarUrl` or `avatar` set.

**Source:** `evaluators.ts` → `testimonialHasAvatar`

**Common failure:** Testimonial items have no avatar fields.

**Fix:** Add avatar image URL to at least one testimonial item.

---

#### `testimonials-have-ratings` · Hard · 2 pts
**What it checks:** ≥50% of testimonial items have a numeric `rating` field ≥ 1.

**Source:** `evaluators.ts` → `testimonialsHaveRatings`

**Common failure:** Testimonials lack rating stars.

**Fix:** Add `rating: 5` (or 4) to at least half the testimonial items.

---

#### `testimonial-quote-length` · Hard · 1 pt
**What it checks:** ≥80% of testimonial items have a `quote` field that is 80–300 characters.

**Source:** `evaluators.ts` → `testimonialQuoteLength`

**Common failure:** Quotes are either placeholder ("Great service!") or excessively long.

**Fix:** Write 1-2 sentence quotes that are substantive but not essays.

---

### Dimension 4 — Micro-Interactions (weight 9)

---

#### `nav-variant-rich` · Hard · 2 pts
**What it checks:** Navigation block has variant in: `centered`, `mega`, `transparent`, `sidebar`, `floating`.

**Common failure:** Navigation uses default/basic variant.

**Fix:** Set `navigation.variant` to one of the non-basic options.

---

#### `cta-block-present` · Hard · 2 pts
**What it checks:** A `cta` block is present (any page). See also `category-dna` for which categories mandate this.

**Common failure:** Template skips the standalone CTA section.

**Fix:** Add a `cta` block mid-page or near the bottom.

---

#### `interactive-form` · Hard · 2 pts
**What it checks:** A `newsletter` or `contact` block is present (any page).

**Common failure:** No form in the template.

**Fix:** Add a `newsletter` or `contact` block. Contact forms can live on the `/contact` sub-page and still pass (allBlocks search).

---

#### `block-variety-8plus` · Hard · 2 pts
**What it checks:** Homepage has ≥8 distinct `blockType` values.

**Source:** `evaluators.ts` → `distinctBlockTypes8`

**Common failure:** Template reuses the same block types and only has 6-7 distinct ones.

**Fix:** Diversify block types. Add missing blocks from the category's `recommendedBlocks` list in `template-rules.ts`.

---

#### `nav-links-balanced` · Hard · 1 pt
**What it checks:** Navigation has 3–7 links in its `links` array.

**Source:** `evaluators.ts` → `navLinksBalanced`

**Common failure:** Nav has only 1-2 links or too many (>7 = cluttered).

**Fix:** Ensure the navigation `data.links` array has 3–7 entries.

---

### Dimension 5 — Spacing & Rhythm (weight 10)

---

#### `block-count-sweet-spot` · Soft · 4 pts (partial: 2 pts)
**What it checks:**
- PASS (4 pts): Homepage has 9–14 blocks
- PARTIAL (2 pts): 7–8 or 15–16 blocks
- FAIL (0 pts): ≤6 or ≥17 blocks

**Source:** `evaluators.ts` → `blockCountSweetSpot`

**Common failure:** Template is either too sparse (<9) or bloated (>14).

**Fix:** Target 10-12 blocks for homepage. Use gap-filler logic to reach floor; remove duplicate block types to reduce.

---

#### `no-consecutive-duplicates` · Hard · 2 pts
**What it checks:** No two adjacent blocks in the homepage array have the same `blockType`.

**Source:** `evaluators.ts` → `noConsecutiveDuplicates`

**Common failure:** Two `cta` blocks or two `features` blocks placed back-to-back.

**Fix:** Reorder blocks so same-type blocks are separated by at least one different block type.

---

#### `theme-has-spacing-preset` · Hard · 1 pt
**What it checks:** Theme has a `spacingPreset` field set.

**Common failure:** Theme object is generated without `spacingPreset`.

**Fix:** Add `spacingPreset` (e.g. `"comfortable"`, `"compact"`, `"spacious"`) to the theme config.

---

#### `spacing-rhythm-token-only` · Hard · 3 pts
**What it checks:** Any explicit numeric padding/margin/gap values in block data must be from the design token scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 72, 80, 96, 112, 128` (px).

**Source:** `evaluators.ts` → `spacingRhythmTokenOnly`

**Note:** If no explicit values are set (spacing driven by theme/CSS), this auto-passes.

**Common failure:** AI gen uses off-scale values like `30px` or `50px`.

**Fix:** Round spacing values to the nearest token scale value.

---

### Dimension 6 — Conversion Path Clarity (weight 10)

---

#### `hero-has-cta` · Hard · 2 pts
**What it checks:** Hero block has at least one CTA — either a non-empty `ctaButtons`/`buttons` array, or a `primaryCta`/`ctaButton`/`cta` object.

**Source:** `evaluators.ts` → `heroHasCta`

**Common failure:** Hero has headline and image but no CTA button.

**Fix:** Add `ctaButtons: [{ label: "...", url: "..." }]` to the hero block data.

---

#### `mid-cta-present` · Hard · 2 pts
**What it checks:** A `cta` block is present anywhere (same as `cta-block-present` in micro-interactions). Points awarded in both dimensions if present.

**Fix:** Same as `cta-block-present` above.

---

#### `newsletter-present` · Hard · 1 pt
**What it checks:** A `newsletter` block is present.

**Fix:** Add a `newsletter` block, typically near the footer.

---

#### `cta-text-quality-specific-2x` · Hard · 2 pts
**What it checks:** Collects all CTA button labels across the template. At least 2 must NOT be in the generic list: `click here`, `learn more`, `read more`, `view more`, `find out more`, `more info`, `submit`.

**Note:** "Get Started" is NOT considered generic by design.

**Source:** `evaluators.ts` → `ctaTextQualitySpecific2x`

**Common failure:** All CTAs use "Learn More" or "Read More".

**Fix:** Use action-oriented, specific labels: "Book Your Free Consultation", "Start Your Trial", "Get a Custom Quote".

---

#### `hero-cta-variety` · Hard · 3 pts
**What it checks:** Hero has ≥2 CTA buttons with different `variant`/`style`/`type` values (e.g. `primary` + `outline`).

**Source:** `evaluators.ts` → `heroCtaVariety`

**Common failure:** Hero has only one CTA or two with the same style.

**Fix:** Add a primary CTA and a secondary CTA with contrasting styles (e.g. filled + outlined).

---

### Dimension 7 — Content Authenticity (weight 8)

---

#### `no-lorem-broad` · Hard · 2 pts
**What it checks:** Scans all block data as JSON for Lorem Ipsum patterns: `lorem`, `ipsum`, `dolor sit`, `adipiscing`, `consectetur`, `eiusmod`, `tempor incididunt`.

**Source:** `evaluators.ts` → `noLoremBroad`

**Common failure:** Placeholder text left in feature descriptions or about blocks.

**Fix:** Replace all placeholder text with real-looking industry-specific content.

---

#### `hero-headline-substantial` · Hard · 1 pt
**What it checks:** Hero headline is ≥10 characters.

**Common failure:** Headline is a single word like "Welcome".

**Fix:** Write a real value proposition headline.

---

#### `features-count-3plus` · Hard · 2 pts
**What it checks:** The `features` block has ≥3 items.

**Common failure:** Only 2 feature items.

**Fix:** Add a third feature item with title, description, and icon.

---

#### `faq-count-4plus` · Hard · 2 pts
**What it checks:** The `faq` block has ≥4 items in `items` array.

**Common failure:** Only 2-3 FAQ entries. Note: FAQ can live on a sub-page and still pass.

**Fix:** Add at least 4 FAQ questions relevant to the industry.

---

#### `content-depth-500` · Hard · 1 pt
**What it checks:** Total visible text across the template ≥500 characters. Counts: hero headline + subheadline, section labels, headlines, body copy, feature descriptions, FAQ answers, testimonial quotes, pricing descriptions, team bios, CTA subtitles, blog excerpts, footer tagline.

**Source:** `evaluators.ts` → `contentDepth500`

**Common failure:** Sparse template where most blocks have only headlines and no body copy.

**Fix:** Add descriptive text to at least: hero subheadline, 2+ feature descriptions, FAQ answers.

---

### Dimension 8 — Information Density (weight 8)

---

#### `block-count-max-16` · Hard · 2 pts
**What it checks:** Homepage has ≤16 blocks total.

**Common failure:** AI gen gap-filler injects too many blocks.

**Fix:** Cap homepage at 16. Move lower-priority blocks to sub-pages.

---

#### `variety-unique-85` · Hard · 3 pts
**What it checks:** The ratio of unique block types to total blocks is ≥85%. Formula: `uniqueTypes / totalBlocks ≥ 0.85`.

**Source:** `evaluators.ts` → `varietyUnique85`

**Common failure:** Template repeats block types — e.g. two `features` blocks + two `cta` blocks drops the ratio.

**Fix:** Keep each block type to one instance on the homepage where possible.

---

#### `footer-mega-columns` · Hard · 2 pts
**What it checks:** Footer block has ≥4 column/section entries in `data.columns`, `data.linkColumns`, or `data.sections`.

**Source:** `evaluators.ts` → `footerMegaColumns`

**Common failure:** Footer has only 2-3 columns (basic footer variant).

**Fix:** Use a mega-footer variant with 4+ columns: Company, Services, Resources, Contact.

---

#### `nav-links-not-repeat` · Hard · 1 pt
**What it checks:** All navigation link labels are unique (no duplicate menu items).

**Source:** `evaluators.ts` → `navLinksNotRepeat`

**Common failure:** Nav has "Home" listed twice, or "Services" duplicated.

**Fix:** Deduplicate nav link labels.

---

### Dimension 9 — Accessibility (weight 8)

---

#### `alt-text-coverage-80` · Hard · 2 pts
**What it checks:** ≥80% of images with a `url` field also have a non-empty `alt` string. Checks gallery/portfolio image arrays and hero background images.

**Source:** `evaluators.ts` → `altTextCoverage80`

**Note:** If the template has no images at all, this auto-passes.

**Common failure:** Gallery images added without `alt` text.

**Fix:** Set descriptive `alt` on every image object.

---

#### `heading-order-no-skip` · Hard · 2 pts
**What it checks:** Verifies semantic heading order — hero block comes first (H1) with no content blocks having headlines placed before it (which would imply H2 before H1). Also fails if multiple hero blocks exist (multiple H1s).

**Source:** `evaluators.ts` → `headingOrderNoSkip`

**Common failure:** A `features` or `stats` block appears before the `hero` in the blocks array.

**Fix:** Ensure block order: `navigation` → `hero` → all other content blocks → `footer`.

---

#### `theme-color-contrast` · Hard · 1 pt
**What it checks:** Primary color vs. surface/background color contrast ratio ≥ 3.0:1 (WCAG AA for UI elements and large text). If `theme.contrastRatio` is set explicitly, uses that value.

**Source:** `evaluators.ts` → `themeColorContrast`

**Common failure:** Light-colored primary button on a white background.

**Fix:** Ensure `primaryColor` has sufficient contrast with `surfaceColor`. Darken the primary color or use a contrast-checking tool.

---

#### `text-color-body-contrast` · Hard · 2 pts (v1.3 new)
**What it checks:** `theme.textColor` vs. surface/background contrast ratio ≥ 4.5:1 (WCAG AA for body text — stricter than UI elements).

**Source:** `evaluators.ts` → `textColorBodyContrast`

**Common failure:** Light gray body text (`#888888`) on a white background fails (ratio ~3.9:1).

**Fix:** Set `theme.textColor` to at minimum `#767676` on white, or darker. For dark-mode themes, verify on `#0a0a0a` background.

---

#### `nav-aria-label` · Hard · 1 pt
**What it checks:** Navigation block has either `data.ariaLabel` set, OR its links array has items with `title` string attributes.

**Source:** `evaluators.ts` → `navAriaLabel`

**Common failure:** Nav block data has no accessibility attributes.

**Fix:** Add `ariaLabel: "Main navigation"` to the navigation block data, or ensure all link objects have `title` properties.

---

#### `focus-indicator-defined` · Hard · 1 pt
**What it checks:** Theme has any of: `focusStyle`, `focusRing`, `focusOutlineColor`, `focusIndicator`.

**Source:** `evaluators.ts` → `focusIndicatorDefined`

**Common failure:** Theme config does not include focus indicator styling.

**Fix:** Add `focusRing: "2px solid #005FCC"` (or similar) to the theme object.

---

### Dimension 10 — Category DNA (weight 10)

---

#### `category-dna-compliance` · Soft · 6 pts (partial: 3 pts)
**What it checks:** Per-category mandatory block groups (from `template-rules.ts` → `dnaMandatoryGroups`). At least one block from each group must be present across all pages.

- PASS (6 pts): All mandatory groups satisfied
- PARTIAL (3 pts): At least ceil(total/2) groups satisfied
- FAIL (0 pts): Fewer than half the groups satisfied

**Source:** `evaluators.ts` → `categoryDnaCompliance`, sourced from `src/lib/ai/template-rules.ts`

**Common failure:** Education template missing both `class-schedule` AND `service-cards` — the first group fails entirely.

**Fix:** Check the category's `dnaMandatoryGroups` in `template-rules.ts` and ensure at least one block from each group is present somewhere in the template pages.

---

#### `category-signature-variety` · Soft · 4 pts (partial: 2 pts)
**What it checks:** Template uses ≥2 signature industry blocks from `signatureBlocks` list in `template-rules.ts`.

- PASS (4 pts): ≥2 signature blocks present
- PARTIAL (2 pts): Exactly 1 signature block present
- FAIL (0 pts): 0 signature blocks

**Source:** `evaluators.ts` → `categorySignatureVariety`

**Common failure:** Restaurant template has only a gallery but no `menu-display` or `booking-widget`.

**Fix:** Include at least 2 blocks from the category's `signatureBlocks` list.

---

### Dimension 11 — Content Uniqueness (weight 6)

---

#### `hero-headline-unique` · Soft · 3 pts (partial: 1 pt)
**What it checks:** Counts how many fixtures across the 390-fixture pool share the same normalized hero headline. Normalized = lowercase + trimmed + collapsed whitespace.

- PASS (3 pts): ≤8 occurrences
- PARTIAL (1 pt): 9–20 occurrences
- FAIL (0 pts): >20 occurrences

**Calibration:** 5 seed fixtures per preset is expected. ≤8 allows for seed noise and minor preset reuse.

**Source:** `evaluators.ts` → `heroHeadlineUnique`, `buildUniquenessContext()` in `scorer-lib.ts`

**Common failure:** All templates in a category share the same headline ("Transform Your Business").

**Fix:** Vary the headline by sub-niche or persona. Each template should have a distinct angle.

---

#### `hero-subheadline-unique` · Soft · 2 pts (partial: 1 pt)
**What it checks:** Same logic as `hero-headline-unique` but for the subheadline field.

- PASS: ≤8 occurrences
- PARTIAL: 9–20
- FAIL: >20

**Common failure:** Generic subheadlines like "We provide quality services for your business" repeated everywhere.

**Fix:** Tailor the subheadline to the specific category and template persona.

---

#### `cta-label-unique` · Hard · 1 pt
**What it checks:** Collects all CTA labels across all blocks in the fixture. Computes the average occurrence count across the 390-fixture pool.

- PASS: avg ≤40 occurrences
- PARTIAL: 41–100
- FAIL: avg >100

**Note:** CTAs are naturally shared ("Get Started", "Book Now") — threshold is intentionally looser than headline uniqueness.

**Source:** `evaluators.ts` → `ctaLabelUnique`

**Common failure:** Every template uses only "Learn More" and "Contact Us" — extremely high average count.

**Fix:** Use more specific CTAs. Mix in category-specific labels ("Book a Table", "View Listings", "See Pricing").

---

## 4. Category DNA Reference

All mandatory groups and signature blocks from `src/lib/ai/template-rules.ts`:

| Category | DNA Mandatory Groups | Signature Blocks | CTA Mandatory? |
|----------|---------------------|------------------|----------------|
| restaurant | [`menu-display` OR `booking-widget`], [`gallery` OR `gallery-masonry`] | menu-display, booking-widget, review-cards | No |
| fnb | [`menu-display` OR `features`], [`gallery` OR `gallery-masonry`] | menu-display, gallery, review-cards | Yes |
| ecommerce | [`product-quick-view` OR `features`], [`pricing` OR `pricing-table`] | product-quick-view, pricing | Yes |
| beauty | [`service-cards` OR `features`], [`gallery` OR `gallery-masonry` OR `before-after`] | service-cards, booking-widget, before-after | Yes |
| tech | [`pricing` OR `pricing-table`], [`features`] | pricing, features, feature-comparison, video-showcase | Yes |
| health | [`doctor-profile` OR `service-cards` OR `team`], [`faq`] | doctor-profile, booking-widget | No |
| education | [`class-schedule` OR `features` OR `service-cards`], [`faq`] | class-schedule, pricing | Yes |
| realestate | [`property-card` OR `gallery`], [`stats` OR `features`] | property-card, gallery | No |
| fitness | [`class-schedule` OR `features`], [`pricing` OR `team`] | class-schedule, team, pricing | Yes |
| creative | [`gallery` OR `gallery-masonry` OR `portfolio-grid`], [`testimonials`] | portfolio-grid, gallery-masonry, video-showcase | No |
| business | [`team` OR `features`], [`testimonials`] | team, stats, features | Yes |
| events | [`booking-widget` OR `contact`], [`gallery`] | booking-widget, gallery | No |
| blog | [`features` OR `testimonials`], [`newsletter`] | newsletter, features | Yes |
| travel | [`gallery` OR `gallery-masonry`], [`features` OR `service-cards`] | gallery, features | Yes |

**Categories that mandate a CTA block (8 total):** `fnb`, `ecommerce`, `beauty`, `tech`, `education`, `fitness`, `business`, `blog`, `travel`

---

## 5. FAQ for QC

**Q: Why does Education need class-schedule?**

Education's `dnaMandatoryGroups[0]` is `['class-schedule', 'features', 'service-cards']`. At least ONE of those three must be present. `class-schedule` is the most distinctive, but `features` or `service-cards` also satisfies the group. Source: `src/lib/ai/template-rules.ts` → `education.dnaMandatoryGroups`.

---

**Q: What is contentDepth500 exactly?**

It adds up all visible body-copy text across the entire template homepage: hero headline + subheadline, every section's headline/sectionLabel/description/body, feature item descriptions, FAQ answers, testimonial quotes, team bios, pricing plan descriptions, blog excerpts, footer tagline, CTA subtitles. If the combined character count ≥500, it passes. A template with only short section labels and no body copy (e.g. 3 features with no descriptions) will typically fail.

---

**Q: heroHeadlineUnique says avg 335 — what does that mean?**

The number shown in the report reason field is the raw count of fixtures sharing the exact same normalized headline across the 390-fixture pool. An avg of 335 means almost every fixture has the same headline — that's a clear templating problem. The threshold is ≤8 for pass, 9–20 for partial, >20 for fail.

---

**Q: CTA avg X.X — what's a good score?**

For `ctaLabelUnique`, the metric is the average occurrence count of CTA labels across all 390 fixtures:
- ≤40 = PASS (good — CTAs are specific enough)
- 41–100 = PARTIAL (acceptable — some generic ones but not all)
- >100 = FAIL (all CTAs are generic and massively repeated)

Common safe CTAs: "Book a Table" (restaurant-specific, low count). Risky CTAs: "Learn More", "Click Here" (extremely high counts across all categories).

---

**Q: Which categories require a CTA block?**

8 categories mandate `cta` as part of their `mandatoryBlocks` (enforced by the structure enforcer injector and the `cta-block-present` + `mid-cta-present` rubric criteria): `fnb`, `ecommerce`, `beauty`, `tech`, `education`, `fitness`, `business`, `blog`, `travel`. The other 5 (`restaurant`, `health`, `realestate`, `creative`, `events`) don't mandate it but still earn points from `conversion-path` if a CTA block is present.

---

**Q: What are BROKEN_VARIANTS?**

Variants that exist in the template composer rotation logic (the `variant` field value assigned to a block) but don't have a corresponding registered component in the CMS block schema. When the builder renders a block with a broken variant, it either shows an empty section or throws. The rubric doesn't directly check for broken variants — they surface as empty content (failing `hero-headline-present`, `content-depth-500`, etc.) rather than a dedicated criterion. A separate BROKEN_VARIANTS constant in the composer skips these variants during generation.

---

## 6. Data Flow

```
template-rules.ts           (category rules — single source of truth)
       │
       ▼
template-composer.ts        (generates block arrays per category + seed)
       │
       ▼
matrix.json                 (.harness-out/ — 390 fixture outputs)
       │
       ├──► check.ts        (structural checks — block presence, counts)
       │
       └──► scorer.ts       (CLI entry) ──► scorer-lib.ts (pure logic)
                                                    │
                                         evaluators.ts (criterion logic)
                                         rubric-v1.3.json (weights/thresholds)
                                                    │
                                                    ▼
                                    rubric-report-v1.3.json (.harness-out/)
                                                    │
                                                    ▼
                            /templates-health (dashboard — shows per-template scores)
```

---

## 7. Source Files Reference

| Concern | Authoritative File |
|---------|-------------------|
| Category mandatory blocks, DNA groups, signature blocks | `src/lib/ai/template-rules.ts` |
| Rubric dimensions, criteria, weights, thresholds | `scripts/test-harness/rubric/rubric-v1.3.json` |
| Criterion logic (all custom evaluators) | `scripts/test-harness/rubric/evaluators.ts` |
| Scoring engine (dimension → weighted score) | `scripts/test-harness/rubric/scorer-lib.ts` |
| CLI entry point for scoring | `scripts/test-harness/rubric/scorer.ts` |
| Template block generation | `src/lib/ai/template-composer.ts` |
| Fixture output (input to scorer) | `.harness-out/matrix.json` |
| Final score report | `.harness-out/rubric-report-v1.3.json` |
| Templates health dashboard | `src/app/(dashboard)/templates-health/` |
| Generic CTAs blocklist | `evaluators.ts` → `GENERIC_CTA_LABELS` constant |
| Design token spacing scale | `evaluators.ts` → `TOKEN_SCALE` constant in `spacingRhythmTokenOnly` |
| WCAG contrast computation | `evaluators.ts` → `luminance()` + `contrastRatio()` helpers |
