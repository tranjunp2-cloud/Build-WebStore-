---
date: 2026-04-15
branch: chore/F01-ai-gen-cleanup-unused
session_duration: ~2h research + audit
tags: [ai-gen, template-composer, architecture, research, rebuild-candidate]
---

# 2026-04-15 — AI Gen vs Template Composer Research

Context journal for future "rebuild AI gen flow" plan. Captures architectural
gap discovered while auditing why user-reported "template mẫu đẹp hơn AI gen".
Reference this when scoping the rebuild plan.

---

## TL;DR

**Root insight**: ech-prime đang build theo "AI-first" philosophy (AI sáng tạo
content) nhưng **template composer đã có ~280 hand-curated content entries
Malaysia-specific** không được AI gen path reuse. Wix ADI làm ngược lại
("template-first") — designer viết 18000+ templates, AI chỉ làm narrow
matching/personalization task.

**Immediate fix** (short-term, 3-4h): Wire `template-composer.buildFeatures/
buildStats/buildPricing/buildTeam/buildServiceCards` vào `content-injection.
buildBlockFromLibrary` switch cases. Zero content curation mới — code đã có
sẵn, thiếu wiring giữa 2 code paths.

**Long-term rebuild** (strategic, 1-2 tháng): Flip philosophy sang template-
first. Build 500+ templates per industry, rewrite gen flow từ "AI generates
everything" sang "user wizard → AI ranks templates → light personalization".

---

## 1. 2 philosophies ngược nhau

### "AI-first" (current ech-prime)
```
User input → GPT-4o generates:
  - Block types + variants
  - Feature content ("Quality Service")
  - Team bios
  - Pricing tiers
  - Layout
→ Sanitize/enforce → save
```
- **AI workload**: HIGH (writes everything)
- **Content quality**: training-data median → generic
- **Library size cần**: small (~50 generic entries để gap-fill)

### "Template-first" (Wix ADI)
```
Human designer writes 500+ templates per industry (years of work)
  → each template has hand-written features/stats/pricing/team/headlines
User wizard (7 steps) → AI ranks top 3 → user picks
  → AI light personalization (businessName, logo, image selection, SEO meta)
→ Output = 95% hand-curated + 5% AI personalization
```
- **AI workload**: LOW (matching + small edits)
- **Content quality**: professional designer quality
- **Library size cần**: HUGE (~18000 templates total)

---

## 2. Evidence — content quality gap

Feature block, `health` category:

| Layer | First item |
|---|---|
| **Template composer** | `Stethoscope | Expert Doctors | Our team of experienced doctors provide comprehensive healthcare for your whole family.` |
| **AI gen gap-fill** | `⭐ | Quality Service | Exceptional quality in every interaction.` |

Stats block, same category:

| Layer | Content |
|---|---|
| **Template** | `20+ Years / 15000+ Patients Treated / 10 Specialist Doctors / 4.9 Patient Rating` |
| **AI gap-fill** | `500+ Happy Customers / 10+ Years / 4.9★` |

Team block:

| Layer | Content |
|---|---|
| **Template** | `Dr. Tan Wei Ming — MBBS (UM), 15 years in family medicine` |
| **AI gap-fill** | `Team Lead — Passionate about delivering great experiences` |

Template path has **Malaysian context baked in**: JAKIM halal, FPX payment,
GrabFood delivery, MBBS UM credentials, Dato' titles, RM pricing, KSSM
curriculum, Great Eastern/AIA insurance. GPT-4o training data median lacks
this granularity — defaults to generic.

---

## 3. Where the ~280 curated entries live

| Builder function | Categories curated | Items/cat | Entries |
|---|---|---|---|
| `buildFeatures` | 14 | 3-4 | ~42 |
| `buildStats` | 11 | 4 | ~44 |
| `buildPricing` | 7 | 3 plans × 4 features | ~84 |
| `buildTeam` | 4 | 3 members | 12 |
| `buildServiceCards` | 14 (via biz.products) | 3-4 | ~42 |
| `buildHero` | 14 | 1 headline/cat | 14 |
| Industry blocks (menu-display, doctor-profile, property-card) | — | — | ~20 |
| **Total builders** | — | — | **~260-280** |

Plus shared `content/*.ts` files:
- 5 BusinessSample × 14 categories = 70 business stubs
- 5 testimonials × 14 = 70 testimonials
- 5 FAQs × 14 = 70 FAQs
- **= 210 more entries via `CategoryContent`**

**Grand total**: ~490 curated content entries driving template composer.
AI gen path has **0 per-category curation** — uses 8-item global gap-fill pool.

---

## 4. Why plan 2253 didn't close the gap

Plan 2253 fixed distribution problems (R1-R13):
- Variant picks (R2, R9) — PR #603
- Theme preset picks (R3, R6) — PR #603
- Content library rotation (R4, R5) — PR #603 + amendments
- Skeleton variance (R1) — PR #615
- Variant dominance (pricing/faq/contact/service-cards) — PR #617

But **did NOT touch content quality**. Plan 2253 rotated gap-fill pool from
1 → 7 distinct items, but each item is still generic ("Quality Service"
becomes "Premium Experience" — both generic, neither is "JAKIM halal").

---

## 5. Recommendation tree

### Short-term (1 PR, 3-4h): Wire template builders into AI gap-fill

**What**: `content-injection.buildBlockFromLibrary` switch cases delegate to
`template-composer.buildFeatures/buildStats/buildPricing/buildTeam/
buildServiceCards`. ~15 lines changed.

**Why**: Zero content curation new. Template content already production-
proven via template gallery path. AI gen only missing the wiring.

**Adapter**: `BusinessInfoInput` → `BusinessSample` via existing
`fallback-adapter.mapBusinessInfo()`.

**Result**: AI gen for health business outputs `Dr. Tan Wei Ming MBBS UM`
instead of `Team Lead / Passionate about delivering great experiences`.

**Risk**: Low. Template content shape matches Payload Pages.ts block schema.

### Long-term (strategic plan, 1-2 months): Flip to Wix template-first architecture

**What**:
1. Expand template library 30 → 500+ per industry (human designer work)
2. Rewrite `/builder/new` flow from AI form → wizard picker (7 steps)
3. AI gen becomes "ranking engine" not "content generator"
4. Content comes 95% from curated templates, 5% from AI personalization

**Why**:
- Content quality ceiling raised to human designer level
- AI does narrow task (matching) it's actually good at
- User trust — "my site looks professional" not "AI random generated"
- Wix parity on the dimension Wix wins

**Effort estimate**:
- Template authoring: 400 new templates × 2-4h each = 800-1600h designer work
- Wizard flow rewrite: 40-60h engineering
- Ranking engine: 20-30h engineering
- Admin tools for template CRUD: 30-40h engineering
- Image curation: 20-40h designer work
- **Total**: 900-1770h (2-4 months full-time)

**Risk**: Large scope. Requires hiring/contracting designers. Out of v1.0
scope (deadline 15/04).

### Middle path (post-v1.0): Progressive template expansion

1. Ship short-term "wire builders" fix pre-v1.0 (3-4h)
2. Post-v1.0 sprint: expand template composer to cover more block types
   + add sub-niche curation (dental ≠ spa ≠ pharmacy within `health`)
3. v1.1-v1.2: Gradually shift AI gen path toward template-matching as
   template library grows
4. v2.0: Full Wix-style wizard picker flow

---

## 6. Files referenced (for rebuild plan)

### AI gen path
- `src/app/api/ai/generate-site/route.ts` — HTTP entry, auth, SSE
- `src/lib/ai/openai-generator.ts` (1685 lines) — `generateSiteWithAI()`, sanitizer
- `src/lib/ai/system-prompt.ts` (367 post-cleanup) — prompt builder
- `src/lib/ai/content-injection.ts` (426 lines) — generic gap-fill library ← KEY WIRING TARGET
- `src/lib/ai/structure-enforcer.ts` (297 lines) — skeleton + min items
- `src/lib/ai/category-requirements.ts` — mandatoryBlocks + minBlocks
- `src/lib/ai/category-recipes.ts` — 42 hand-curated recipes (R1 fix PR #615)

### Template composer path (curated content lives here)
- `src/lib/ai/template-composer.ts` (1772 lines) — 28 `build*()` hand-curated functions
- `src/lib/ai/seed-templates.ts` (1162 lines) — 25 SEED_TEMPLATES pre-built
- `src/lib/ai/template-definitions.ts` — TEMPLATE_PRESETS + CategoryDna (deleted)
- `src/app/api/templates/seed/route.ts` — seed endpoint

### Shared
- `src/lib/ai/content/*.ts` — 14 category files (businesses, testimonials, faqs)
- `src/lib/ai/theme-presets.ts` — 112 presets (8/category)
- `src/lib/ai/fallback-adapter.ts` — bridges AI path to composer when OpenAI fails

### Measurement evidence
- `plans/260414-2253-ai-gen-variety-root-cause/reports/variety-post-fix-v3.json`
- `plans/260414-2253-ai-gen-variety-root-cause/reports/audit-unused-code.md`
- `plans/260414-2253-ai-gen-variety-root-cause/reports/comparison-ai-vs-template.md`

---

## 7. Open questions for rebuild plan

1. **Template library target size per industry**: 50? 100? 500+? Depends
   on designer capacity + user segmentation. Wix has 900 total, Shopify ~180.
2. **Wizard vs form**: Replace current AI form entirely or add wizard as
   alternative path? Risk: confusing dual flows.
3. **Template authoring tool**: Admin UI for designer to author new
   templates without engineer involvement. Builds on existing editor?
4. **Sub-niche taxonomy**: Current 14 categories too coarse (dental + spa +
   pharmacy all `health`). Need sub-niches (maybe 40-60 total).
5. **Pricing tier for template quality**: Premium templates paid? Free tier
   gets 10 templates, Pro gets 100?
6. **Localization**: Templates Malaysia-first (EN + MS) or expand to VN, ID,
   TH, PH? Each locale needs designer review.
7. **Image library**: Use Unsplash (current) or build curated local stock
   library (Malaysian-looking people/places)?
8. **Migration path**: Users with existing AI-gen sites — leave as-is, offer
   "apply template" retrofit, or no-op?

---

## 8. Next actions

- [ ] Decide short-term fix: ship "wire builders" PR (3-4h, anh review)
- [ ] Create rebuild plan dir: `plans/YYMMDD-HHMM-ai-gen-rebuild-wix-style/`
- [ ] Research Wix ADI deeper (they have engineering blog posts on architecture)
- [ ] Interview 3-5 users asking "what makes Wix/Shopify templates feel
      professional" — get qualitative signals on what "đẹp hơn" really means
- [ ] Designer hiring pipeline (contract or in-house?) if Wix-style chosen
- [ ] Defer decision to post-v1.0 — ship short-term fix for v1.0, strategize
      rebuild in post-release retro

---

## Related journals

- `260414-session-ai-gen-deep-dive.md` — plan 2253 complete session
- `260414-ai-gen-flow-overview.md` — AI gen flow diagrams
- `260414-fallback-composer-unify.md` — previous attempt to unify paths

## Related plans + PRs

- Plan 2253 (`plans/260414-2253-ai-gen-variety-root-cause/`) — distribution fix
- PR #603 — tactical variety fix (merged)
- PR #615 — R1 skeleton variants wire (merged)
- PR #617 — cleanup unused + force variant re-pick (open)
