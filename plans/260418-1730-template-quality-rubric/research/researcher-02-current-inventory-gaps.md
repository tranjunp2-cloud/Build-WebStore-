# Template Quality Rubric — Current Inventory Gaps (2026-04-18)

## Executive Summary

56 blueprint presets across 14 categories analyzed vs `WEBSITE_TEMPLATE_STANDARDS.md` sections 1.1 + 1.2.

Critical findings:
- Architecture strong: all 56 presets have 4–5 sub-pages + core blocks (nav, hero, features, testimonials, contact, footer)
- **Logo Cloud missing from 56/56 (100%)** — section 1.1 row 3
- Content library mature (5 biz/cat + testimonials + FAQs) but **0/280 testimonials have avatars**
- Design tokens built but **all 56 presets default to primary #0ea5e9** (no category-aware color)
- 115+ missing component instances across category-specific recommendations

## 1. Inventory Status by Category

| Category | Presets | Avg HP Blocks | Sub-pages | Trust Bar | Missing Canonical |
|---|---|---|---|---|---|
| Restaurant | 4 | 11.3 | 5 | 0/4 ❌ | Logo Cloud, Stats (2/4), Pricing N/A |
| E-commerce | 4 | 10.5 | 5 | 0/4 ❌ | Logo Cloud, Mid-CTA (1/4) |
| Beauty/Spa | 4 | 10.8 | 5 | 0/4 ❌ | Logo Cloud, Before-After (0/4) |
| Tech/SaaS | 4 | 10.2 | 5 | 0/4 ❌ | Logo Cloud, Stats (2/4), Video demo (0/4) |
| Health | 4 | 9.8 | 4-5 | 0/4 ❌ | Logo Cloud, Doctor profiles (1/4) |
| Education | 4 | 9.5 | 4 | 0/4 ❌ | Logo Cloud, Class schedule (2/4) |
| Real Estate | 4 | 11.0 | 5 | 0/4 ❌ | Logo Cloud, Property filter (0/4) |
| Fitness | 4 | 10.6 | 5 | 0/4 ❌ | Logo Cloud, Video (0/4) |
| Creative | 4 | 9.0 | 4 | 0/4 ❌ | Logo Cloud, Case studies (2/4) |
| Business (B2B) | 4 | 10.3 | 5 | 0/4 ❌ | Logo Cloud, Case studies (0/4) |
| Blog | 4 | 8.7 | 5 | 0/4 ❌ | Logo Cloud, Monetization (0/4) |
| Events | 4 | 10.9 | 4-5 | 0/4 ❌ | Logo Cloud, Countdown (0/4) |
| FnB | 4 | 10.5 | 5 | 0/4 ❌ | Logo Cloud, Stats (1/4) |
| Travel | 4 | 10.8 | 5 | 0/4 ❌ | Logo Cloud, Map (1/4) |

## 2. Block Coverage vs Standard Section 1.1

| Standard Block | Coverage | % | Notes |
|---|---|---|---|
| Navigation | 56/56 | **100%** | ✅ sticky variants all present |
| Hero | 56/56 | **100%** | ✅ 12+ variants |
| Trust Bar / Logo Cloud | 0/56 | **0%** | ❌ CRITICAL — section 1.1 row 3 |
| Features / Services | 54/56 | **96%** | ❌ 2 blog templates skip (expected) |
| Industry Section | 38/56 | **68%** | ❌ uneven: strong in F&B, weak in B2B |
| Stats / Social Proof | 28/56 | **50%** | ❌ Tech 3/4 OK, Restaurant 1/4 |
| Gallery / Portfolio | 44/56 | **79%** | ✅ carousel/grid/masonry variants |
| Testimonials | 55/56 | **98%** | ✅ 1 blog skips |
| Mid-page CTA | 42/56 | **75%** | ❌ missing Blog, Edu, Portfolio |
| Pricing | 16/56 | **29%** | ❌ SaaS 4/4 OK, others N/A or missing |
| FAQ | 54/56 | **96%** | ✅ accordion all |
| Blog Preview | 4/56 | **7%** | ❌ only blog category |
| Newsletter | 52/56 | **93%** | ✅ inline variant |
| Contact | 56/56 | **100%** | ✅ form + maybe map |
| Footer | 56/56 | **100%** | ✅ mega variant |

## 3. Sub-page Compliance (Standard 1.2)

All 56 presets meet minimum 4 pages. Depth gaps:
- About page: 68% missing team block, 86% missing stats block
- Services page: pricing varies (29% have), FAQ 48/56 (86%), CTA 42/56 (75%)
- Gallery page: CTA 38/56 (68%)
- Contact page: real map 28/56 (50%), address/phone/email 38/56 (68%), FAQ 20/56 (36%)

## 4. Content Library Richness (Sample: beauty.ts)

**Strengths:**
- 5 businesses with realistic RM pricing (RM 120–350)
- Halal/JAKIM compliance mentions
- Local names + KL addresses (Bangsar, Mont Kiara)
- Industry jargon authentic

**Gaps (extrapolated 14 cats × 5 biz = 70):**
- Testimonials: 0/280 have avatars (schema missing `avatarUrl`)
- Image URLs: 0% real (all SVG placeholders)
- Social proof logos: names present but 0 URLs
- FAQ: avg 4-5 items (standard says 4-8) — adequate

## 5. Design & Color Gap

**Root cause** from 260414-1630-phase-08-audit:
- Design tokens infrastructure: spacing 8px, typography scale, shadows, radius ✅
- Semantic color layer (60-30-10 ratio, WCAG AA) ✅
- **Category-aware color mapping NOT implemented** ❌
- All 56 presets default primary = `#0ea5e9` (sky blue)
- Result: Restaurant (warm), Spa (calm), Tech (cool) render identical palette

## 6. Missing Blocks — Frequency Analysis

Per category expected vs actual:

| Block Type | Expected | Actual | Gap |
|---|---|---|---|
| Trust Bar / Logo Cloud | 56 (rec'd) | 0 | 56 missing |
| Announcement Bar | ~20 | 0 | 20 missing |
| Step / How It Works | 12 | 2 | 10 missing |
| Case Study Cards | 12 | 2 | 10 missing |
| Video Testimonials | 8 | 0 | 8 missing |
| Before-After Gallery | 4 | 0 | 4 missing |
| Map (real embed) | 8 | 1 | 7 missing |
| Class Schedule | 3 | 2 | 1 missing |

**Total missing instances: ~115 across ~200 recommendations.**

## 7. Unresolved Questions

1. Logo Cloud strategy: all 56 or only B2B categories?
2. Category-aware color: deterministic hue per category or 4 variations within?
3. Testimonial avatars: add schema + AI-generate or source real?
4. Real images: batch presets or deployment-time fetch?
5. Industry blocks: mandatory per category (Before-After for Beauty, etc.)?
6. Map integration: real Google Maps in Contact/Restaurant/Health?

## 8. Citations

- `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` (baseline)
- `src/lib/ai/template-presets-batch1.ts` (presets 1-20)
- `src/lib/ai/template-presets-batch2.ts` (presets 21-38)
- `src/lib/ai/template-presets-batch3.ts` (presets 39-56)
- `src/lib/ai/content/beauty.ts` (sample biz+testimonials+faq)
- `plans/260414-1630-phase-08-audit/research/researcher-01-design-quality-audit.md` (color gap)
- `.harness-out/matrix.json` (aggregate block data)
