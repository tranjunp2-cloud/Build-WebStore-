---
date: 2026-04-14
branch: feat/F01-ai-gen-variety-fix
tags: [ai-gen, architecture, flow-diagram, reference]
purpose: quick-reference cho flow gen website — đọc file này trước khi touch src/lib/ai/
---

# AI Website Generation — Flow Overview

> **Đọc file này khi:** cần hiểu luồng gen website hoạt động thế nào, file nào làm gì, data đi đâu.
> **Chi tiết hơn:** `docs/standards/AI_WEBSITE_GENERATION_GUIDE.md` (full context 500+ dòng)
> **Session journal:** `docs/journals/260414-session-ai-gen-deep-dive.md`

---

## 1. Tổng quan — 3 đường gen website

```
                    User nhấn "Tạo Website"
                           │
              POST /api/ai/generate-site
                           │
                    ┌──────┴──────┐
                    │             │
               Có OpenAI?    Không/Fail
                    │             │
              ┌─────┴─────┐      │
              │ AI PATH   │  FALLBACK PATH
              │ (GPT-4o)  │  (rule-based)
              └─────┬─────┘      │
                    │             │
              sanitizeBlockData  generateBlocks(prompt, seed)
                    │             │
                    └──────┬──────┘
                           │
                   GenerationResult
                           │
                    Unsplash images
                           │
                    Save to Payload CMS
                           │
                    SSE stream → Client


              Template Gallery (không qua AI)
                           │
              composeFromBlueprint(preset)
                           │
                      TemplateSeed
                           │
                    Save to Payload CMS
```

## 2. AI Path — Chi tiết

```
generateSiteWithAI(businessInfo, extra, lang, refPrompt)
│
├── A. Resolve theme preset TRƯỚC prompt
│   ├── resolveComposerCategory(prompt) → 14 categories
│   ├── hashBusinessName(name) → deterministic seed
│   └── pickCategoryTheme(cat, seed) → ThemePreset
│       (hex colors + font pairing ID + colorMode)
│
├── B. Build prompts
│   ├── buildSystemPrompt(lang, themeContext)
│   │   ├── Block registry (47 blocks, 142 variants)
│   │   ├── REQUIRED THEME section (exact hex + font)
│   │   ├── PROFESSIONAL DESIGN RULES
│   │   │   ├── Hero: 5-8 words headline, 12-20 sub
│   │   │   ├── Color: 60-30-10 rule
│   │   │   ├── Typography: 2 fonts, contrast axes
│   │   │   ├── AIDA section ordering
│   │   │   └── Anti-patterns blocklist
│   │   └── VARIETY RULES (7 rules)
│   │
│   └── buildUserPrompt(info, extra, lang, ref)
│       ├── Business info (name, industry, products, desc)
│       ├── selectPersonality(info) → keyword matching
│       │   (8 personalities: bold, minimal, warm, pro...)
│       └── generateCompositionHint(category)
│           (dynamic block sequence, never repeats)
│
├── C. OpenAI API
│   model: gpt-4o | temp: 0.7 | max_tokens: 8000
│   response_format: json_object
│   → JSON: { siteName, category, theme, pages[], seo }
│
├── D. Parse + Validate
│   ├── JSON parse (truncation repair if needed)
│   ├── Theme: override with preset (AI theme ignored)
│   │   fonts → ALLOWED_HEADING/BODY_FONTS whitelist
│   └── Per block: sanitizeBlockData(block, category)
│       ├── Strip upload URL strings
│       ├── Variant validation (3 bước):
│       │   1. fuzzyMatchVariant() → exact/case/alias
│       │   2. pickWeightedVariant() → category-aware
│       │   3. enforceMinContent() → carousel≥3
│       ├── Normalize fields per block type
│       └── Gallery/logo: keep alt/caption metadata
│
├── E. Structure enforcement (homepage only)
│   ├── enforceMinimumStructure() → inject missing blocks
│   └── enforceMinItems() → pad thin arrays
│
└── F. Return GenerationResult
    { siteName, siteType, blocks[], pages[], seo, lang, theme }
```

## 3. Fallback Path — Khi AI fail

```
generateWithFallback(prompt, events)
│
└── generateBlocks(prompt, Date.now())
    ├── parseIntent(prompt) → { name, type, style }
    │   type: restaurant|ecommerce|portfolio|blog|business
    │
    ├── Seeded PRNG → createSeededRandom(seed)
    │   (same seed = same output, different seed = different)
    │
    ├── pickRandom(THEME_PALETTES[type])
    │   → 3 palettes per category (was 1)
    │
    ├── pickRandom(CONTENT_VARIATIONS[type])
    │   → 3 content sets per category
    │   (hero headline, features, testimonials, CTA)
    │
    ├── Build blocks:
    │   ├── [1] navigation (random variant from pool)
    │   ├── [2] hero (random variant)
    │   ├── [3-8] 4-6 blocks from MIDDLE_BLOCK_POOL
    │   │   pool: about, features, stats, gallery,
    │   │         testimonials, faq, cta, newsletter, team
    │   │   → shuffle + ordering constraints:
    │   │     features→stats, features→testimonials, about→team
    │   ├── [N-1] contact (random variant)
    │   └── [N] footer (random variant)
    │
    └── Return GenerationResult
```

**Lưu ý Phase 06 (pending):** Fallback hiện gọi `generateBlocks()` (5 categories, placeholder content). Phase 06 sẽ đổi sang `composeFromBlueprint()` (14 categories, real content).

## 4. Template Path — Template Gallery

```
composeFromBlueprint(preset, seed?)
│
├── getCategoryContent(preset.category) → 14 categories
│   mỗi category có: businesses[], testimonials[], FAQ, industry data
│
├── seed = compositionSeed ?? businessIndex * 7919
│
├── Per page → per block:
│   buildBlockFromSpec(spec, content, biz, cat, pages, seed)
│   ├── spec.variant provided → use it
│   └── spec.variant undefined → selectVariant(blockType, seed, cat)
│       → simpleHash(blockType + category + seed) % variants.length
│
└── Return TemplateSeed
    { name, description, category, tier, theme, pages[] }


Legacy: composeTemplate(input)  ← deprecated, backward-compat
│
├── ComposerInput { category, businessIndex, variant, themePreset, compositionSeed? }
├── buildHomePage(biz, content, cat, variant, index, pages, seed?)
│   ├── getVariant(blockType, fallback) → seed-based or legacy
│   ├── Middle blocks: collect all → shuffle (if seed) → enforce ordering
│   └── enforceMinContent() for testimonials
├── buildAboutPage(), buildServicesPage(), buildContactPage(), buildBlogPage()
└── Return TemplateSeed
```

## 5. Post-Generation Pipeline

```
← GenerationResult from AI or Fallback
│
├── Unsplash pipeline (default):
│   ├── planImageNeeds(blocks) → which blocks need images
│   ├── fulfillImageNeeds() → fetch Unsplash → upload to Payload Media
│   │   targets: hero bg, gallery, team avatars, about, testimonials
│   └── cleanupNonNumericImageFields() → strip leftover URLs
│
├── URL ContentBrief override (nếu user dán URL):
│   └── visualStyle → override theme colors + colorMode
│
├── Save to Payload CMS:
│   ├── Create/update Site doc (tenant, theme, SEO)
│   ├── Create Page docs (4 pages: /, /about, /services, /contact)
│   ├── Each page → blocks[] saved as JSON
│   └── Increment tenant.aiGenerationsCount
│
└── SSE stream events → Client preview:
    step:analyzing(10%) → step:generating(20%) → theme_set
    → block_complete × N → seo_generated → step:saving(95%) → done
```

## 6. Key Files — Cheat Sheet

| File | Dòng | Làm gì |
|------|------|--------|
| `src/app/api/ai/generate-site/route.ts` | ~350 | API entry: auth, rate limit, tenant, safety, image pipeline, save CMS |
| `src/lib/ai/system-prompt.ts` | ~403 | System + user prompt builder, personalities, composition hints, design rules |
| `src/lib/ai/openai-generator.ts` | ~982 | GPT-4o call, sanitizer (fuzzy match, weights, aliases, content guard), fallback dispatch |
| `src/lib/ai/generate-blocks.ts` | ~718 | Rule-based fallback: seeded PRNG, 3 palettes/content per category, block pool |
| `src/lib/ai/template-composer.ts` | ~1248 | Template builder: 25 builders, seed-based variants, block shuffle |
| `src/lib/ai/template-definitions.ts` | ~220 | 48 old + 56 new template presets, CategoryDNA |
| `src/lib/ai/theme-presets.ts` | — | Industry theme palettes (colors, fonts, modes) |
| `src/lib/ai/content/*.ts` | 14 files | Category content: businesses, testimonials, FAQ, industry data |
| `src/blocks/registry.ts` | ~225 | 47 blocks, 142 variants, Zod schemas |

## 7. Variety System — Tóm tắt

| Layer | Mechanism | Diversity |
|-------|-----------|-----------|
| **Prompt** | selectPersonality() + generateCompositionHint() | 8 personalities × ∞ compositions |
| **Sanitizer** | fuzzyMatch → weightedRandom → enforceMinContent | 14 categories × 14 block types |
| **Fallback** | Seeded PRNG + block pool shuffle | 3 themes × 3 contents × C(9,4-6) orderings |
| **Composer** | selectVariant(simpleHash) + block shuffle | Seed-based, deterministic per template |

## 8. Pending / Known Issues

| Issue | Status | Impact |
|-------|--------|--------|
| Phase 06: Fallback gọi generateBlocks thay vì composeFromBlueprint | pending | Fallback chỉ 5 categories, placeholder content |
| Phase 07: Dynamic content từ form input (2 cafe cùng menu Pad Thai) | stub | Content vẫn pre-curated per category |
| Phase 08: Wire theme-presets vào AI happy path | planned | AI output theme bị ignore, preset thắng (đã sửa) |
| hero:animated-gradient | excluded | Không có implementation, excluded từ random pool |
| hero:split-right | cosmetic | Render giống split-left (chưa reverse layout) |
| Plan B (Design Quality): tokens, typography, color, block audit | in-progress | `plans/260412-2300-design-quality-rules/` — Phase 01 done |
