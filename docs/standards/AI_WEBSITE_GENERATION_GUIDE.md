# AI Website Generation — Context Guide

> **Mục đích:** Document đầy đủ context cho luồng AI gen website. Session mới đọc file này để nắm toàn bộ tình hình.
> **Updated:** 2026-04-12

---

## 1. Tổng quan hệ thống

### Architecture

```
User fills BusinessInfoForm
    ↓
POST /api/ai/generate-site (src/app/api/ai/generate-site/route.ts)
    ↓
generateSiteWithAI() (src/lib/ai/openai-generator.ts)
    ├── Có OpenAI key → GPT-4o path
    │   ├── buildSystemPrompt() → system prompt với design rules + block registry
    │   ├── buildUserPrompt() → business info + personality + composition hint
    │   ├── OpenAI API call (gpt-4o, temp 0.7, max_tokens 8000, json_object)
    │   ├── Parse JSON response (truncation repair nếu cần)
    │   ├── sanitizeBlockData() per block → validate variants, normalize fields
    │   └── Save to Payload CMS
    └── Không có key / AI fail → Fallback path
        └── generateBlocks() (src/lib/ai/generate-blocks.ts) → rule-based, deterministic

Template path (không qua AI):
    composeTemplate() / composeFromBlueprint() (src/lib/ai/template-composer.ts)
    → 15 builder functions → blocks → save to CMS
```

### Key Files

| File | Dòng | Vai trò |
|------|------|---------|
| `src/lib/ai/system-prompt.ts` | ~400 | System + user prompt builder, personalities, composition hints |
| `src/lib/ai/openai-generator.ts` | ~560 | GPT-4o caller, sanitizer (validate variants, normalize fields) |
| `src/lib/ai/generate-blocks.ts` | ~315 | Rule-based fallback generator (khi AI fail) |
| `src/lib/ai/template-composer.ts` | ~1100 | Template builder, 15 builder functions, category content |
| `src/lib/ai/template-definitions.ts` | ~220 | 48 old + 56 new template definitions, CategoryDNA |
| `src/lib/ai/content/*.ts` | ~16 files | Category-specific content (testimonials, FAQ, business samples) |
| `src/blocks/registry.ts` | ~225 | Block metadata, variants, Zod schemas — 47 blocks registered |
| `src/app/api/ai/generate-site/route.ts` | ~80 | API endpoint, auth, rate limit, SSE streaming |

---

## 2. Block & Variant System

### Stats
- **47 blocks** registered in `src/blocks/registry.ts`
- **142 variants** total across all blocks
- **140/142 variants render correctly** (audit 2026-04-12)
- **2 broken:** `hero:animated-gradient` (no implementation), `hero:split-right` (same as split-left)

### Core Blocks & Variants

| Block | Variants | Default |
|-------|----------|---------|
| hero | centered, split-left, split-right, fullscreen, gradient, parallax, magazine, minimal, slideshow, cards-overlay, split-video, video | centered |
| features | grid-2, grid-3, grid-4, list, icon-top, icon-left, zigzag, carousel | grid-3 |
| testimonials | cards, carousel, simple, masonry, spotlight, minimal-quote, avatar-row, video-text | cards |
| navigation | simple, centered, mega-menu, transparent, sidebar, pill | simple |
| footer | simple, expanded, minimal, centered-stack, mega-footer, dark-gradient | simple |
| contact | form, info-only, split, card-float, map-split, minimal-inline | form |
| pricing | cards, table, horizontal, toggle, tiered, comparison, minimal, slider | cards |
| gallery | grid, masonry, carousel, lightbox, filmstrip, justified | grid |
| cta | banner, inline, floating | banner |
| stats | row, grid, highlight | row |
| faq | accordion, grid, simple | accordion |
| team | grid, list | grid |
| newsletter | inline, popup, banner | inline |
| about | simple, split, story | simple |

### Industry Blocks
menu-display, booking-widget, class-schedule, review-cards, video-showcase, doctor-profile, property-card, product-quick-view, service-cards, portfolio-grid — mỗi block 3 variants.

### Variant Audit Report
Chi tiết: `plans/260412-2156-ai-gen-website-audit/scout/scout-variant-audit-report.md`

---

## 3. Vấn đề đã phát hiện (Root Causes)

### Tại sao tất cả websites gen ra đều giống nhau

| # | Root Cause | File | Mức độ |
|---|-----------|------|--------|
| 1 | System prompt liệt kê blocks nhưng **không yêu cầu AI vary** | system-prompt.ts | Critical |
| 2 | Sanitizer **thay variant invalid bằng cùng 1 default** mỗi lần | openai-generator.ts:255-261 | Critical |
| 3 | Fallback generator **100% deterministic** — cùng blocks, cùng order | generate-blocks.ts | High |
| 4 | Template composer **14/15 builder functions hardcode 1 variant** | template-composer.ts | High |
| 5 | User prompt **phẳng** — không style/mood/personality | system-prompt.ts:buildUserPrompt | Medium |

### "AI Slop" Problem (từ industry research)
LLMs tạo design trung bình — median training data:
- Purple/indigo gradients (từ Tailwind defaults trong training data)
- Inter font mọi nơi
- Three-box icon grid layout
- Cards lồng trong cards
- Generic content ("Welcome to our website")

**Fix:** Constraints > encouragement. Cấm cụ thể + encode rules thiết kế chuyên nghiệp.

---

## 4. Hai plan đang chạy song song

### Plan A: AI Variety Audit & Fix
**Path:** `plans/260412-2156-ai-gen-website-audit/`
**Focus:** Sửa prompt + pipeline để AI chọn đa dạng hơn
**Status:** Phase 02 done, Phase 03-05 pending

| Phase | Status | Nội dung |
|-------|--------|---------|
| 01 Audit | skipped | Root causes đã confirm từ code review |
| 02 Fix System Prompt | **done** | VARIETY RULES, context-aware STYLE_PERSONALITIES, dynamic CATEGORY_BLOCK_HINTS, DESIGN QUALITY RULES trong prompt |
| 03 Fix Sanitizer | pending | Case-insensitive match, weighted-by-category random fallback, logging |
| 04 Fix Fallback Generator | pending | Seeded PRNG, block pool, 3 themes/category, seed param |
| 05 Fix Template Composer | pending | compositionSeed, selectVariant(), variant param 15 builders |

### Plan B: Design Quality Rules — Block-Level
**Path:** `plans/260412-2300-design-quality-rules/`
**Focus:** Block components render đúng chuẩn thiết kế chuyên nghiệp
**Status:** Plan created, chưa bắt đầu implement

| Phase | Status | Nội dung |
|-------|--------|---------|
| 01 Design Tokens | pending | Spacing 8px grid, radius, shadow, SectionWrapper component |
| 02 Typography Scale | pending | Type scale 1.25 ratio, font pairing validation, Heading/Body components |
| 03 Color System | pending | 60-30-10 enforcement, semantic CSS vars, contrast WCAG AA |
| 04 Content Validation | pending | Headline limits, blocked CTA labels, AIDA ordering, min content guard |
| 05 Block Audit | pending | Apply tokens to 47 blocks (3 batches: core→secondary→industry) |

### Hai plan bổ sung nhau

```
Plan A (Variety): AI chọn GÌ → prompt, sanitizer, fallback, composer
Plan B (Quality): Block render THẾ NÀO → tokens, typography, color, validation
```

---

## 5. Design Quality Rules (từ research)

### Nguồn research

| Nguồn | Key Insight |
|-------|------------|
| Anthropic Claude Cookbook | Hướng dẫn AI từng dimension riêng: typography, color, motion |
| Impeccable (15K GitHub stars) | OKLCH color, cấm reflex fonts, 4pt grid, anti-pattern list |
| v0 by Vercel | Closed token layer — AI chọn từ set cố định, không đoán |
| Web Design Research | AIDA funnel ordering, 60-30-10 color rule, 8px spacing grid |
| CRO Research | 6-word headlines, single CTA/viewport, 48px touch targets |

### Rules đã encode vào system prompt

#### Hero Section
- Headline: 5-8 words, benefit-focused, mention business name
- Subheadline: 12-20 words, expand with specifics
- 1 primary CTA (action verb + benefit), 1 optional secondary CTA
- NEVER: "Submit", "Click Here", "Welcome to our website"
- Match variant to personality: dramatic→fullscreen, professional→centered, creative→magazine

#### Color System (60-30-10)
- 60% neutral surface (backgrounds)
- 30% secondary (nav, cards, section backgrounds)
- 10% accent (CTA buttons ONLY — draws eye via scarcity)
- Max 3 core colors + neutrals
- NEVER pure black (#000000) — use brand-tinted dark
- Dark mode: invert surface/text, desaturate accent

#### Typography
- 2 fonts only: 1 heading (display/personality), 1 body (readability)
- CONTRAST between heading+body: serif+sans, geometric+humanist
- Cấm: Inter+Inter, DM Sans+DM Sans, Poppins+Poppins
- Good pairs: Playfair Display+Lato, Outfit+Inter, Raleway+Open Sans
- Body text NEVER below 16px

#### Section Ordering (AIDA Conversion Funnel)
1. Navigation (sticky, CTA button)
2. Hero (value prop, CTA — ABOVE THE FOLD)
3. Trust bar / Features
4-9. MIDDLE (vary): features, industry blocks, stats, testimonials, gallery, pricing, FAQ, newsletter
10. Contact + Footer

Rules:
- Social proof AFTER features, BEFORE pricing
- CTA mỗi 3-4 sections
- NEVER 2 text-heavy sections back-to-back — alternate text/visual
- Features MUST come before stats

#### Anti-Patterns (BLOCKED)
- Purple/indigo gradients as default
- Three identical icon-grid cards
- Cards nested inside cards
- Same font heading AND body
- "Welcome to our website" headlines
- All sections centered with same padding

### Rules cần implement ở component level (Plan B)

#### Design Tokens (`src/lib/design-tokens.ts` — chưa tạo)
```
Spacing: 8px grid — 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 120px
Radius: none, sm(4), md(8), lg(12), xl(16), 2xl(24), full
Shadow: none, subtle, medium, strong, dramatic
Icon sizes: sm(20px), md(32px), lg(48px), xl(64px)
Section padding: compact(48-64), default(64-96), relaxed(80-128), hero(96-160)
Container: narrow(768), default(1152), wide(1280)
Card padding: sm(16), md(24), lg(32) — ALWAYS less than section spacing
```

#### Typography Scale (modular 1.25)
```
Display: 36-60px (hero only)
H1: 30-48px
H2: 24-30px
H3: 20-24px
H4: 18-20px
Body: 16px (MINIMUM)
Body large: 18px
Small: 14px
Line heights: heading 1.1-1.2, body 1.5-1.7
```

#### Color Semantic Vars (cần thêm vào resolve.ts)
```css
--surface-primary   /* backgrounds — 60% */
--surface-secondary /* alternate sections */
--surface-card      /* card backgrounds */
--text-primary      /* main text — brand-tinted dark, NEVER #000 */
--text-secondary    /* muted text */
--text-inverse      /* text on dark bg */
--accent            /* CTA only — 10% */
--accent-hover      /* darker accent */
--border            /* subtle borders */
```

#### Content Validation (cần tạo `src/lib/ai/content-rules.ts`)
- Hero headline max 10 words
- CTA blocked labels: Submit, Click Here, Buy Now, Learn More
- Testimonial quote max 200 chars
- Feature description max 150 chars
- Variant min content: carousel≥3, masonry≥4, grid-4≥4

---

## 6. Context-Aware Prompt System (đã implement)

### Style Personality Selection
**File:** `system-prompt.ts` → `selectPersonality(info)`

Không random mù — phân tích user input → match keywords → chọn top 3 personality phù hợp:

```
User: "luxury spa cao cấp" → keywords match: luxury, spa, cao cấp
→ Top candidates: [Luxurious, Minimal, Warm]
→ Random trong top 3
```

8 personalities, mỗi cái có keyword list:
- Bold: startup, gym, fitness, sports, energy
- Minimal: minimal, clean, zen, modern, scandinavian
- Warm: family, home, bakery, cafe, cozy, traditional
- Professional: consulting, law, finance, corporate, b2b
- Creative: creative, design, art, photographer, studio
- Luxurious: luxury, premium, spa, jewelry, high-end, cao cấp
- Tech: tech, saas, software, ai, digital, platform
- Editorial: blog, magazine, news, story, content

### Dynamic Composition Hints
**File:** `system-prompt.ts` → `generateCompositionHint(category)`

Không hardcode 3 arrays — generate bố cục MỚI mỗi lần:
1. Hero variant random từ category pool (HERO_VARIANTS_BY_CATEGORY)
2. 1-2 signature blocks từ CATEGORY_SIGNATURE_BLOCKS (menu-display, booking-widget...)
3. 3-4 common blocks random từ pool (features, testimonials, about, stats...)
4. Shuffle middle section
5. Footer variant random

→ Vô hạn combinations, không bao giờ lặp.

---

## 7. Validated Decisions (từ user/PM)

| Quyết định | Chi tiết |
|------------|---------|
| Skip audit phase | Root causes đã rõ từ code review, không cần gen 10 test sites |
| Fix tất cả 5 phases | AI path, fallback, và template composer đều cần fix |
| Invalid variant → weighted by category | Không pure random — mỗi category có preferred variants |
| Variant whitelist | 140/142 safe. Exclude hero:animated-gradient |
| Personality context-aware | Dựa vào user input, không random cố định |
| Composition dynamic | Generate on-the-fly, không hardcode arrays |

---

## 8. Related Documents

| Document | Path |
|----------|------|
| Plan A — Variety Audit | `plans/260412-2156-ai-gen-website-audit/plan.md` |
| Plan B — Design Quality | `plans/260412-2300-design-quality-rules/plan.md` |
| PRD | `docs/prd/F01-ai-builder-variety.md` |
| QA Test Plan | `docs/qa/F01-ai-builder-variety.md` |
| Variant Audit Report | `plans/260412-2156-ai-gen-website-audit/scout/scout-variant-audit-report.md` |
| Scenario Analysis | 26 scenarios — embedded in QA test plan |
| Predict Report | 5-persona analysis — CAUTION verdict |
| Research: AI Pipeline | `plans/260412-2156-ai-gen-website-audit/research/researcher-01-ai-pipeline.md` |
| Research: Template System | `plans/260412-2156-ai-gen-website-audit/research/researcher-02-template-system.md` |
| Research: Design Quality | `plans/260412-2300-design-quality-rules/research/design-quality-research.md` |
| Website Template Standards | `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` |
