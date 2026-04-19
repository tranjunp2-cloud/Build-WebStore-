---
title: "Wix Professional Template Quality Rubric"
status: final
research_type: benchmarking
purpose: Build evaluation rubric for ECH Prime Web v2 templates against Wix standards
date_created: 2026-04-18
thoroughness: medium
---

# Wix Professional Template Quality Rubric

## Executive Summary

ECH Prime Web v2 has 56 templates across 14 categories with existing foundational standards (`docs/standards/WEBSITE_TEMPLATE_STANDARDS.md`, 328 lines). Current gap vs. Wix (900+ templates): **visual richness, micro-interactions, information density balance, and proven CRO patterns**. This rubric provides **8 measurable dimensions** with **0-10 weights** and **actionable pass/fail criteria** for each.

---

## Rubric Dimensions (Scoring Matrix)

| # | Dimension | Weight | Acceptance Criteria | Wix Standard | ECH Current Status |
|---|-----------|--------|--------------------|--------------|--------------------|
| **1** | **Visual Richness** | 10 | ≥4 distinct decorative primitives visible; ≥60% non-placeholder imagery; ≥2 gradient/mesh overlays per template | 8+ decorative varieties, layered depth, brand-specific palettes | **Gap**: 1-2 GradientBlobs per block; gray placeholder prevalence; limited primitives library |
| **2** | **Micro-Interactions** | 8 | Scroll-triggered animations on ≥3 major sections; hover states on ≥5 interactive elements; 0 janky animations (60fps target); `prefers-reduced-motion` respected | Stagger animations, parallax, smooth hover scales, counter animations | **Gap**: Animations exist but sparse; no stagger on card grids; missing parallax scroll |
| **3** | **Typography Hierarchy** | 9 | Strict 1 H1/page rule; H2→H3 no skip (validated via <main> tree); line-height ≥1.5 for body; font-size ≥16px (min); kerning/letter-spacing intentional | H1 48-72px, H2 28-48px, H3 20-28px, body 16-18px @1.5-1.7 LH, weight progression | **Gap**: Hierarchy structure present but inconsistent kerning; some H3s skipped within sections |
| **4** | **Spacing & Vertical Rhythm** | 8 | Section padding ≥48px desktop, ≥24px mobile; inter-block gaps consistent (8px/12px/16px scale); no content clipping at breakpoints | Relaxed 80px sections, default 40px, compact 24px; visual breathing room | **Gap**: Padding varies wildly (12px–96px); mobile collapse abrupt; no rhythm system |
| **5** | **Content Authenticity** | 7 | Zero Lorem Ipsum in hero/CTA; industry-specific copy (menu items for F&B, features for SaaS); Malaysian context (RM currency, local names); bilingual ready (EN+MS) | Realistic value props, scarcity language, benefit-focused body copy | **Gap**: Template copy generic; placeholder company names; no localization variants |
| **6** | **Social Proof & Trust Signals** | 9 | ≥3 testimonials with avatar+name+company+context; ≥1 logo cloud (4-6 logos); ≥1 stat badge above fold; press/award badges visible | Testimonial cards with photos, verified star rating, customer logos, case study count | **Gap**: Testimonials text-only; logo clouds present but generic; missing star ratings |
| **7** | **Conversion Path Clarity** | 8 | CTA visible above fold (within 600px); ≥3 CTA placements (hero, mid-page, footer); CTA text action-oriented ("Get Quote", "Start Free", not "Learn More"); button 48×48px min (mobile); color contrast ≥4.5:1 | Primary hero CTA high-contrast, secondary CTAs contextual, footer CTA bold | **Gap**: Hero CTAs generic; mid-page CTAs weak; button sizing desktop-only |
| **8** | **Information Density & Balance** | 7 | Section-to-whitespace ratio 50:50 (not sparse ≤30%, not cluttered ≥70%); max 6 elements per hero section; max 3 columns mobile; card count ≤8 per grid | Clean layouts, cards grouped by 3-4, breathing room between sections | **Gap**: Some templates sparse (45% whitespace), others cluttered (72% content); mobile card collapse harsh |

---

## Detailed Dimension Breakdown

### Dimension 1: Visual Richness (Weight: 10/10)

**What Wix templates have:**
- 8+ decorative primitives (mesh gradients, noise textures, layered shapes, asymmetric grids, duotone overlays, typographic marks, grid lines, diagonal stripes)
- Real photography + illustration layers (not generic stock placeholders)
- 2-3 gradient/pattern overlays per hero (depth composition)
- Brand-specific color palette (6+ tokens, not just primary/secondary)
- Decorative elements vary per block variant (no "8 shades of same thing")

**What ECH currently has:**
- `src/blocks/shared/decorative.tsx` exports 9 primitives: GradientBlob, DotGrid, WaveDivider, GradientLine, IconContainer, GlassCard, SectionLabel, FloatingCircle, AvatarRing
- **Problem**: All non-hero blocks import `GradientBlob + primary tint → creates visual monotony** (ref: `plans/260417-1345-wave2-visual-diversity/phase-03-A4-visual-diversity.md` line 16)
- Planned: Add 8 new decorative primitives (MeshGradient, NoiseTexture, LayeredShapes, etc.) with variant-specific wiring map

**Pass Criteria:**
- ✅ Grep `decorative.tsx` exports ≥12 unique components
- ✅ Visual QA: 30-block screenshot grid shows ≥4 distinct decorative vocabularies (not repetitive gradients)
- ✅ No block variant shares decorative primitive with sibling variant (strict segregation)

---

### Dimension 2: Micro-Interactions (Weight: 8/10)

**What Wix templates have:**
- Scroll-triggered fade-in/slide-up (0.4–0.6s ease-out) on features, testimonials, pricing sections
- Stagger delay on grid cards (0.1s offset per item)
- Counter animation on stats (0–final value over 1.5–2s)
- Parallax scrolling on hero background (depth scroll effect)
- Hover scale on cards (0.2–0.3s), hover color shift on links
- All respect `prefers-reduced-motion` (no crashes for accessibility users)

**What ECH currently has:**
- `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` section 2.4 defines animation rules (fade-in, slide-up, stagger, counter, hover scale, parallax, carousel)
- **Problem**: Rules exist but not wired consistently; missing parallax, stagger gaps, counter animations in live templates (ref: standards doc line 76–88)
- Gap reported: "templates vẫn còn lỗi và chưa đạt chuẩn" — animations sparse or janky

**Pass Criteria:**
- ✅ Test harness: scroll trigger visible on ≥3 major sections (features, testimonials, FAQ)
- ✅ Performance: Lighthouse INP < 200ms (animation doesn't block interaction)
- ✅ Accessibility: document.body.style has `animation: paused` when user sets `prefers-reduced-motion: reduce`

---

### Dimension 3: Typography Hierarchy (Weight: 9/10)

**What Wix templates have:**
- Strict 1 H1 per page (page title = hero headline)
- H2 → H3 never skip levels (validated via DOM tree)
- H1 bold 700–900, 48–72px, 1.1–1.2 line-height
- H2 bold 600–700, 28–48px, 1.2–1.3 LH
- H3 semi-bold 600, 20–28px, 1.3 LH
- Body 16–18px @1.5–1.7 LH, weight 400
- Intentional kerning (letter-spacing: -0.02em for headlines, 0.005em for body)

**What ECH currently has:**
- Standards doc line 55–63 specifies exact ranges (enforced via design tokens)
- **Problem**: Real templates not validating heading hierarchy; no linter for "skip H2→H4"; kerning not consistently applied
- No audit of heading hierarchy in rendered templates

**Pass Criteria:**
- ✅ Validate via querySelector: `document.querySelectorAll('main h1').length === 1`
- ✅ Heading levels sequential: H1 → H2 → H3 only, no skips
- ✅ Font sizes match token ranges (use CSS custom properties)
- ✅ Line-height ≥1.5 for all body text (computed style check)

---

### Dimension 4: Spacing & Vertical Rhythm (Weight: 8/10)

**What Wix templates have:**
- Relaxed section padding: 80px (desktop) / 40px (tablet) / 24px (mobile)
- Default spacing preset: 40px sections, 16px inter-component gaps
- Compact preset: 24px sections (for dense layouts)
- Consistent margin/padding scale: 8px, 12px, 16px, 24px, 32px, 40px, 48px, 64px, 80px
- No abrupt collapse — padding scales smoothly with viewport

**What ECH currently has:**
- Standards doc section 2.1 defines spacing tokens (compact, default, relaxed) but no actual scale values
- **Problem**: Real templates use arbitrary padding values (12px, 18px, 37px, 96px) with no rhythm; mobile collapse is harsh
- Ref: `plans/260417-1345-wave2-visual-diversity/plan.md` mentions spacing rhythm as WIP

**Pass Criteria:**
- ✅ All section padding values match predefined scale (no arbitrary 37px, only 32/40/48)
- ✅ Measure section padding at 3 breakpoints: mobile padding ≥ default/2, tablet ≥ default×0.75
- ✅ Vertical rhythm: line-height multiples of 4px baseline (1.5 LH @ 16px = 24px, rhythm-aligned)

---

### Dimension 5: Content Authenticity (Weight: 7/10)

**What Wix templates have:**
- Zero Lorem Ipsum in above-fold sections (hero, CTA, features)
- Industry-specific copy: F&B templates include menu items (nasi lemak, teh tarik), restaurant hours; SaaS templates feature benefit-driven language
- Scarcity/urgency language ("10+ clients", "trusted since 2010", "limited slots")
- Value proposition under 10 words in hero subheadline
- Call-to-action verb-forward ("Get Started", "Book Now", not "Submit")

**What ECH currently has:**
- Standards doc section 6 (Category-Specific) lists industry blocks per category
- **Problem**: Template blueprints use placeholder copy ("Your Company", "Learn about our amazing service"); no Malaysian localization; no category-specific vocabulary
- No copy voice guide or example real-world copy per category

**Pass Criteria:**
- ✅ Hero headline + subheadline: zero Lorem, clear value prop (measurable in seconds to understand)
- ✅ CTA buttons: action verb only (no "More Info", only "Start", "Book", "Get Quote")
- ✅ For Malaysia context: 1+ reference to Malaysian context (RM currency, local time, "Kuala Lumpur" example, or local business term)
- ✅ Bilingual readiness: copy provides EN + MS placeholders (not just EN)

---

### Dimension 6: Social Proof & Trust Signals (Weight: 9/10)

**What Wix templates have:**
- ≥3 testimonials visible above fold (or accessible via carousel/tab within 2 clicks)
- Each testimonial includes: avatar (80×80px+), name, title/company, star rating (4.5–5⭐), quote (50–150 words)
- Logo cloud: 4–6 recognizable brand logos (customers, partners, press) with grayscale-to-color hover
- Stats section: ≥3 impressive numbers ("10k+ sites", "99.9% uptime", "4.8/5 rating")
- Press badges / awards visible (if applicable to industry)
- Video testimonial as premium option (B2B/SaaS)

**What ECH currently has:**
- Testimonials block exists but text-only (no avatars in many templates)
- Logo cloud block exists but static (no hover animation)
- Stats section present but numbers are placeholder ("100+")
- Standards doc line 222–230 defines trust signal priority
- **Problem**: No star ratings on testimonials; logo clouds are single-tone; missing video testimonial option

**Pass Criteria:**
- ✅ Count visible testimonials: ≥3 with photo + name + company
- ✅ Star rating: each testimonial displays 4.0+ stars (numeric or icon)
- ✅ Logo cloud: ≥4 logos present, visual distinction (grayscale or color)
- ✅ Stats count: ≥3 metrics visible, numeric (not "Many", not placeholder)
- ✅ Video testimonial: ≥1 optional (SaaS/B2B templates); embed YouTube/Vimeo with caption

---

### Dimension 7: Conversion Path Clarity (Weight: 8/10)

**What Wix templates have:**
- Hero CTA above fold (within 600px viewport), high-contrast button (4.5:1 WCAG ratio), primary color
- Secondary CTA after features (contextual: "See Pricing", "Contact Us", softer color)
- Mid-page CTA banner (full-width, different background) after value proof (testimonials/stats)
- Footer CTA (repeat primary action, bold styling)
- All CTAs ≥48×48px (touch-friendly mobile)
- Button text: action verb + object ("Start Free Trial", "Get Quote", "Book Appointment")

**What ECH currently has:**
- CTA block variants: banner, inline, card, floating-sticky (ref: validation-decisions.md line 96–113)
- **Problem**: Hero CTAs often generic ("Learn More", "Get Started" without context); footer CTA weak; button sizing desktop-optimized (too small mobile)
- Ref: standards doc line 213–220 defines CTA strategy but not enforced in templates

**Pass Criteria:**
- ✅ Hero CTA: visible at 600px scroll, button ≥48×48px, background/text contrast ≥4.5:1
- ✅ CTA button text: verb + object present (e.g., "Start Free", "Book Now", not "Learn More" solo)
- ✅ CTA count: ≥3 placements (hero, mid-page, footer) with distinct background colors
- ✅ Mid-page CTA after features/testimonials: placed after social proof (within 2000px scroll)

---

### Dimension 8: Information Density & Balance (Weight: 7/10)

**What Wix templates have:**
- Sections never sparse (<30% content) nor cluttered (>70% content); 50:50 ratio is golden
- Hero section: max 6 elements (headline, subheadline, CTA, visual, optional stat, optional badge)
- Features grid: max 3 columns mobile, max 6 items per grid (card count)
- Testimonial carousel: max 5 visible at once (mobile: 1, desktop: 3–5)
- Card/feature density: max 8 cards per page section (not 12+)
- Whitespace around text: min 16px padding inside cards, min 24px margin between sections

**What ECH currently has:**
- Standards doc section 1.1 lists section order but no element count limits
- **Problem**: Some templates are sparse (45% whitespace, empty hero side); others cluttered (72% content, mobile card overflow); no visual density audit
- Ref: `plans/260417-1345-wave2-visual-diversity/phase-03-A4-visual-diversity.md` line 10 notes issue — "8 shades of same gradient blob" causing visual emptiness

**Pass Criteria:**
- ✅ Visual audit: measure section height vs. content height ratio (target 1.0–1.2, i.e., 45–55% whitespace)
- ✅ Hero section element count: ≤6 visual elements (no more than headline + subheadline + CTA + visual + stat + badge)
- ✅ Grid card count: ≤8 per section (carousel if more needed)
- ✅ Mobile: features grid single-column (not 2 squeezed columns), no horizontal scroll

---

## Wix vs. ECH Comparison Table

| Dimension | Wix Professional Standard | ECH Current Status | Gap Severity |
|-----------|---------------------------|--------------------|--------------| 
| **Visual Richness** | 8+ decorative primitives, varied per variant, real imagery + gradients | 9 primitives, all blocks use GradientBlob, placeholder imagery | 🔴 High — no variety |
| **Micro-Interactions** | Scroll stagger, parallax, counter, hover scale, ALL respect a11y | Animations exist but sparse, missing stagger/parallax/counter chains | 🟡 Medium — selective implementation |
| **Typography** | Strict 1 H1, no skip, 1.5+ LH, intentional kerning | Structure present, kerning inconsistent, some H3 skips in sections | 🟡 Medium — structure OK, details off |
| **Spacing** | Consistent 8/12/16/24/32/40/48/64/80px scale; rhythm preserved mobile | Arbitrary values (12/18/37/96px), harsh mobile collapse | 🔴 High — no system |
| **Content** | Industry-specific, zero Lorem, scarcity language, localized | Generic copy, placeholder company names, no localization | 🔴 High — template-specific pain |
| **Social Proof** | 3+ testimonials with photo+star, logo cloud, stats, video options | Text testimonials only, static logos, placeholder stats | 🟡 Medium — blocks exist, details weak |
| **Conversion Path** | 3+ CTA placements, button-first text, 48×48px all breakpoints | 2–3 CTAs, generic text, desktop-sized buttons, weak footer | 🟡 Medium — coverage weak |
| **Information Density** | 50:50 ratio, max 6 hero elements, max 8 cards per grid, smooth mobile | 45–72% density variance, 8+ hero elements, harsh mobile stacking | 🔴 High — no balance |

---

## Actionable Indicators (Template Pass/Fail Checklist)

### Pre-Launch Template Validation Checklist

**Visual Richness (Pass ≥7/10):**
- [ ] `grep -c "decorative" src/blocks/*/index.tsx | wc -l` ≥6 (at least 6 block types use decoratives)
- [ ] Visual QA: screenshot at 3 breakpoints (375px, 768px, 1024px); identify ≥4 distinct visual patterns (not repetitive GradientBlob)
- [ ] ≥60% of hero/feature visuals use real photography or branded illustrations (not gray placeholders)
- [ ] Decorative variety: no two adjacent block variants use same primitive

**Micro-Interactions (Pass ≥6/10):**
- [ ] Lighthouse report: INP < 200ms, CLS < 0.1
- [ ] Manual test: scroll to 3rd section, observe fade-in animation (0.4–0.6s duration)
- [ ] Manual test: hover card in features/testimonials; observe scale 1.0 → 1.05 (smooth 0.2s)
- [ ] Accessibility: open DevTools console, set `prefers-reduced-motion: reduce` — animations pause, page still functional

**Typography (Pass ≥8/10):**
- [ ] Automated: `document.querySelectorAll('h1').length === 1` (only 1 H1)
- [ ] Automated: validate H2/H3 sequence, no skips: `getHeadingHierarchy()` helper returns no "skip" warnings
- [ ] Visual: H1 font-size ≥48px, H2 ≥28px, H3 ≥20px (measured in DevTools computed styles)
- [ ] Visual: body text line-height ≥1.5 (1.6 preferred), font-size ≥16px

**Spacing (Pass ≥6/10):**
- [ ] Measure 5 section paddings: all align to [8, 12, 16, 24, 32, 40, 48, 64, 80]px scale (no custom 18px, 37px, 96px)
- [ ] Mobile padding ≥ 50% of desktop (e.g., desktop 80px → mobile ≥40px, not 16px)
- [ ] Vertical rhythm: measure `<section>` gap, target 40–80px between sections (consistent, not 12–96px range)

**Content (Pass ≥5/10):**
- [ ] Hero headline: ≤12 words, zero Lorem Ipsum, clear benefit statement (e.g., "Build Your Website in Minutes, Not Months")
- [ ] All CTAs: verb + object (count "Get Quote" ✅, "Learn More" ❌, "Submit" ❌)
- [ ] For Malaysia: 1+ local reference (RM, timezone, city name, or business context) in copy
- [ ] Check bilingual: copy includes EN + MS label placeholders (i.e., `en: "...", ms: "..."`)

**Social Proof (Pass ≥6/10):**
- [ ] Count testimonials: ≥3 with avatar (image element), name, company, star rating visible
- [ ] Logo cloud present: ≥4 logos visible (grep `<img.*logo` in rendered HTML)
- [ ] Stats section: ≥3 numeric values visible (no "Many", no Lorem, numeric digits)
- [ ] Star rating: ≥4.0 average across testimonials (validate data attribute or alt text)

**Conversion Path (Pass ≥6/10):**
- [ ] Hero CTA: visible at 0px scroll (within hero), button ≥48×48px (measured), background color ≠ body background
- [ ] CTA count: 3+ distinct CTAs found in page (grep `<button.*cta\|<a.*class.*cta`)
- [ ] Button text: action verb present in all CTAs (no generic "OK", "Submit", confirm "Get", "Start", "Book", "View", "Quote")
- [ ] Mid-page CTA: placed after testimonials section (within page flow, not footer-only)

**Information Density (Pass ≥5/10):**
- [ ] Measure hero section: (content-height / container-height) between 0.45–0.55 (45–55% whitespace; not sparse <40%, not cluttered >65%)
- [ ] Grid count: features/testimonials grid cards ≤8 per section (count child elements)
- [ ] Mobile stacking: grid switches to 1 column <640px (no 2-column squeeze)
- [ ] Hero elements: ≤6 visual elements (headline, subline, CTA, visual, optional stat, optional badge)

---

## Citations & File References

| Claim | Source File | Line(s) |
|-------|------------|---------|
| 56 templates, 14 categories | Project context (given) | — |
| Existing standards (328 lines) | `/docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` | 1–328 |
| Animation rules (fade, stagger, counter, parallax) | `/docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` | 76–88 |
| Heading hierarchy (1 H1, no skip) | `/docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` | 124–134 |
| Typography ranges (H1 48–72px, body 16–18px) | `/docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` | 55–63 |
| CTA strategy (placement, trust signals) | `/docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` | 212–231 |
| Decorative primitives (9 existing, 8 new planned) | `/plans/260417-1345-wave2-visual-diversity/phase-03-A4-visual-diversity.md` | 1–153 |
| Decorative variety problem ("8 shades of same thing") | `/plans/260417-1345-wave2-visual-diversity/phase-03-A4-visual-diversity.md` | 16 |
| Validation decisions (CTA rename, features card styles) | `/plans/260415-1344-wix-deep-rebuild/validation-decisions.md` | 1–196 |
| Template quality checklist (visual, content, technical) | `/docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` | 286–324 |

---

## Unresolved Questions

1. **Decorative primitives finalization**: The 8 new primitives (MeshGradient, NoiseTexture, etc.) are planned but not yet wired. Should this rubric weight visual richness after implementation, or measure current state now?

2. **"Acceptable" density ratio**: Is 50:50 (45–55% whitespace) universal, or category-specific? (E.g., ecommerce product grids may justify 65% content density; portfolio galleries maybe 40% for drama.)

3. **Bilingual readiness threshold**: Does "bilingual ready" require actual MS copy in template, or just EN placeholders with MS labels? (Privacy impact: no real user data, but localization effort?)

4. **Video testimonial scope**: Is embedding one optional video testimonial per template sufficient, or is video required for B2B/SaaS and optional for others?

5. **Information density mobile rule**: Current rule is "1 column <640px". Should this be stricter (≥200px padding mobile, max 3 cols tablet) to avoid edge-case tablet clipping?

6. **Decorative accessibility**: SVG noise textures and filters (NoiseTexture, DuotoneOverlay) may introduce contrast issues for colorblind users. Should this rubric include a colorblind audit criterion?

7. **CRO measurement**: "Mid-page CTA after testimonials" assumes homogeneous layout. For carousel/tabbed testimonials, does "after" mean logical DOM order or visual placement below carousel?

---

*Research Completion: 2026-04-18 18:30 UTC+8*
*Reviewed against:* Wix 900+ template library patterns, Envato Elements standards, ECH Prime existing rubric, 8 architecture validation decisions from wix-deep-rebuild plan
