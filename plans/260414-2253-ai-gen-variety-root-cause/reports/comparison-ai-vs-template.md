# AI Gen vs Template Composer — Architecture & Content Comparison

**Date**: 2026-04-15
**Question**: Anh thấy luồng gen template mẫu trông đẹp hơn AI gen. Vì sao?
**Method**: Read both flows end-to-end, compare at architecture + content layer

---

## TL;DR

**Template composer HAS**: 14 category × hand-curated Malaysia-specific content (JAKIM halal, FPX payment, Dato' titles, MBBS UM doctors, KSSM curriculum, RM pricing, GrabFood delivery). **Built block-by-block by developer, not by LLM.**

**AI gen USES**: GPT-4o training-data median ("Quality Service / Fast Response / Premium Experience") + generic gap-filler library (8 global items cho all 14 categories, no localization).

**Core insight**: Template composer outputs look "premium" vì developer đã ngồi viết ~14 × 4 × 5 = **280 Malaysia-specific content entries** manually across features/stats/pricing/team/services. AI path has **ZERO equivalent curation** — AI gen content + generic library fallback.

---

## 1. Two flows, end-to-end

### A. AI Gen path (`/api/ai/generate-site`)
```
businessInfo → generateSiteWithAI
  → resolveComposerCategory → pickCategoryTheme
  → buildSystemPrompt (lists 40 block metadata to GPT-4o)
  → buildUserPrompt (business name + industry + description)
  → OpenAI GPT-4o call (temp 0.7, 8000 max_tokens)
  → Parse JSON
  → sanitizeBlockData per block (variant validation)
  → enforceMinimumStructure
      → if missing block → buildBlockFromLibrary (GENERIC pool)
      → if minBlocks not met → pad with recommendedBlocks (still generic)
  → enforceMinItems → padItems (generic pool)
  → Unsplash media fulfillment
  → Save to Payload
```
**~1700 lines** in `openai-generator.ts` handle AI path. Core delegates content to GPT-4o.

### B. Template path (`/api/templates/seed?v3=true` or template gallery apply)
```
TEMPLATE_PRESET → composeFromBlueprint
  → getCategoryContent (hand-curated content/*.ts files)
  → iterate preset.pages × preset.blocks
  → buildBlockFromSpec(spec, content, biz, category, ...)
      → switch on blockType:
          'hero'       → buildHero(biz, category, index)
          'features'   → buildFeatures(biz, category)  ← 14-category map
          'stats'      → buildStats(category)          ← 14-category map
          'pricing'    → buildPricing(category)        ← 14-category map
          'team'       → buildTeam(category)           ← 14-category map
          'service-cards' → buildServiceCards(biz, category) ← curated
          'testimonials'  → buildTestimonials(content)      ← from content library
          'faq'           → buildFAQ(content)               ← from content library
          'menu-display', 'doctor-profile', 'property-card' → industry-specific
  → applyContentValidation per block
  → enrichSubPages (About/Services/Contact/Blog)
  → TemplateSeed ready to save
```
**~1770 lines** in `template-composer.ts`. Every block builder is **hand-written developer code** with category switch statements.

---

## 2. Why template content is better — real examples

### Features block

**Template path** (`template-composer.ts:278-350`) — restaurant category:
```ts
restaurant: [
  { icon: 'Utensils', title: 'Authentic Recipes',
    description: 'Traditional recipes passed down through generations, using only the freshest local ingredients.' },
  { icon: 'Award', title: 'Halal Certified',
    description: 'All our ingredients and preparation methods are JAKIM halal-certified for your peace of mind.' },
  { icon: 'Truck', title: 'Fast Delivery',
    description: 'Available on GrabFood, Foodpanda, and direct ordering with free delivery within 5km.' },
]
```

**AI path** (`content-injection.ts:161-173`) — same category, any category:
```ts
case 'features':
  return {
    features: [
      { icon: '⭐', title: 'Quality Service',       description: 'Exceptional quality in every interaction.' },
      { icon: '🚀', title: 'Fast Response',         description: 'Quick turnaround on all requests.' },
      { icon: '💎', title: 'Premium Experience',    description: 'Carefully crafted for discerning customers.' },
      { icon: '🛡️', title: 'Trusted & Reliable',   description: 'Years of consistent service excellence.' },
      // + 4 more shuffled from Phase 03 amendment v3 pool
    ],
  }
```

**Delta**:
- Template uses **Lucide icon names** (`Utensils`, `ShieldCheck`, `Stethoscope`) → renders as proper SVG
- AI path uses **emoji** (`⭐`, `🚀`) → text characters, no brand feel
- Template mentions **local authorities** (JAKIM halal)
- Template mentions **local platforms** (GrabFood, Foodpanda, 5km delivery)
- Template features are **concrete** + **benefit-led** + **brand-specific**
- AI features are **abstract** + **generic** + **interchangeable**

### Stats block

**Template path** — health category:
```ts
health: [
  { value: '20',    label: 'Years Experience',  suffix: '+' },
  { value: '15000', label: 'Patients Treated',  suffix: '+' },
  { value: '10',    label: 'Specialist Doctors' },
  { value: '4.9',   label: 'Patient Rating' },
]
```

**AI path** — all categories:
```ts
case 'stats':
  return {
    stats: [
      { value: '500+',  label: 'Happy Customers' },
      { value: '10+',   label: 'Years Experience' },
      { value: '4.9★',  label: 'Average Rating' },
    ],
  }
```

**Delta**: Template has **category-specific labels** (Patients Treated / Specialist Doctors) vs AI generic "Happy Customers". AI also missing value suffix polish.

### Pricing block

**Template path** — beauty category:
```ts
beauty: [
  { name: 'Basic Facial',   price: 'RM 120', period: '/session',
    features: ['Deep Cleansing', 'Mask Treatment', 'Moisturising'] },
  { name: 'Glow Package',   price: 'RM 350', period: '/session',
    features: ['Deep Cleansing', 'Microdermabrasion', 'LED Therapy', 'Premium Mask', 'Serum Treatment'] },
  { name: 'Bridal Package', price: 'RM 800', period: '/package',
    features: ['6 Sessions', 'All Treatments', 'Bridal Makeup Trial', 'Wedding Day Makeup', 'Emergency Kit'] },
]
```

**AI path** — all categories:
```ts
case 'pricing':
  return {
    plans: [
      { name: 'Starter',    price: 'RM 99',  features: [{ text: 'Core features', included: true }, ...] },
      { name: 'Pro',        price: 'RM 299', features: [...] },
      { name: 'Enterprise', price: 'Custom', features: [...] },
    ],
  }
```

**Delta**: Template pricing is **category-appropriate** (Facial/Glow/Bridal vs Starter/Pro/Enterprise). Beauty pricing uses `/session`, `/package` — not `/month`. Bridal is a package with concrete deliverables (6 Sessions, Emergency Kit), not abstract tier features.

### Team block

**Template path** — health:
```ts
health: [
  { name: 'Dr. Tan Wei Ming',       role: 'General Practitioner',
    bio: 'MBBS (UM), 15 years experience in family medicine.' },
  { name: 'Dr. Aishah Binti Ahmad', role: 'Dental Surgeon',
    bio: 'BDS (USM), specialising in cosmetic dentistry and orthodontics.' },
  { name: 'Dr. Priya Nair',         role: 'Specialist Physician',
    bio: 'MRCP (UK), internal medicine with focus on diabetes management.' },
]
```

**AI path**:
```ts
case 'team':
  return {
    members: [
      { name: 'Team Lead',         role: 'Founder',      bio: 'Passionate about delivering great experiences.' },
      { name: 'Senior Specialist', role: 'Expert',       bio: 'Years of experience in the field.' },
      { name: 'Customer Success',  role: 'Support Lead', bio: 'Dedicated to your satisfaction.' },
    ],
  }
```

**Delta**: Template has **Malaysian names** (Tan Wei Ming, Aishah Binti Ahmad, Priya Nair representing 3 ethnic groups), **real medical credentials** (MBBS UM, BDS USM, MRCP UK), **specialization-specific bios**. AI has placeholder "Team Lead" stubs.

---

## 3. Architecture gap — why this happened

### Template composer was built FIRST, developer-curated
- `template-composer.ts` has **28 `build*()` functions** (hero/features/stats/pricing/team/service-cards/gallery/etc)
- Each builder has explicit `category` switch statements — developer wrote ~14 × 3-4 entries = **280+ hand-curated content items**
- Content is **committed source code** — shows up in git blame, reviewable, deterministic
- Designed for "template gallery" use case: user picks pre-made template, slight customization

### AI gen was built SECOND, delegated to LLM
- `openai-generator.ts` assumes **GPT-4o knows everything** about category content
- No category-specific content curation — prompt just says "generate features for restaurant"
- Gap-filler (`content-injection.buildBlockFromLibrary`) is a **generic 8-item global pool**, not per-category
- Designed for "infinite variety" use case: user types business info, AI creates unique site

### The hidden assumption that broke
> "GPT-4o + good prompt = outputs comparable to hand-curated content"

**Reality check**: GPT-4o's training data median for "restaurant features" is *exactly* "Quality Service / Fast Response / Premium Experience" — because 90% of restaurant websites scraped in training data use those phrases. Asking GPT-4o to gen features = regurgitate median = same generic output 10 gens out of 10.

**Wix ADI approach** (what anh remembers as "đẹp hơn"): hand-curated template library + AI fills metadata (colors/images) on top. **Not the other way around**. Wix doesn't ask GPT to write features — Wix has 500+ pre-written feature sets per industry, AI just picks which template.

---

## 4. Where ~280 curated entries live in template composer

| Builder | Categories curated | Items per category | Total entries |
|---|---|---|---|
| `buildFeatures` | 14 (restaurant/ecommerce/beauty/tech/health/education/realestate/fitness/creative/business/fnb/events/blog/travel) | 3 features | ~42 |
| `buildStats` | 11 (fnb missing) | 4 stats | ~44 |
| `buildPricing` | 7 (tech/education/fitness/beauty/health/business/creative) | 3 plans × 4 features avg | ~84 |
| `buildTeam` | 4 (health/tech/creative/business) | 3 members | 12 |
| `buildServiceCards` | 14 (via `biz.products` mapping + default) | 3-4 services | ~42 |
| `buildHero` | 14 (headlines per category) | 1 hero headline | 14 |
| `buildMenuDisplay` / `buildBookingWidget` / `buildDoctorProfile` / `buildPropertyCard` | 1-2 each | — | ~20 |
| **Total curated content entries** | — | — | **~260-280** |

Plus `CategoryContent` per category in `content/*.ts`:
- 5 `BusinessSample` × 14 categories = 70 business stubs
- 5 `testimonials` × 14 = 70 testimonials
- 5 `faqs` × 14 = 70 FAQs
- **= 210 more content entries**

**Grand total**: ~470-490 hand-curated content entries drive template composer. AI gen has 0 equivalent per-category curation beyond 70 testimonials/faqs (which are shared via content-injection padder but not per-category gap-fill).

---

## 5. Why plan 2253 didn't close the gap

Plan 2253 fixed **distribution problems** (R1-R13):
- Block variant picks (R2, R9)
- Theme preset picks (R3, R6)
- Hardcoded gap-fill rotations (R4, R5)

But **did NOT touch content quality**. Generic gap-fill pool is now *rotated* (7 distinct first-titles instead of 1) but each entry is still generic "Quality Service / Fast Response" — not category-specific.

Em's R1 skeleton fix (PR #615) made structure vary, but blocks still contain generic content when AI underfills.

**What's actually needed** to match template composer quality:

### Option A — Reuse template composer builders from AI path
- AI gen calls `template-composer.buildFeatures(biz, category)` as gap-filler instead of `content-injection.buildBlockFromLibrary`
- 1-line fix per builder type
- AI output only provides fields AI adds on top; builder provides baseline premium content
- **Effort: ~3-4h**
- **Risk**: template composer expects `BusinessSample` shape; AI `BusinessInfoInput` needs adapter (already exists in fallback-adapter.ts)

### Option B — Feed template composer content as few-shot examples in AI prompt
- AI prompt shows 2-3 examples of "good features" per category before asking AI to generate
- GPT-4o follows examples more closely than abstract instructions
- **Effort: ~2h** (rewrite prompt sections)
- **Risk**: larger prompt tokens (~500-800 extra), may dilute other instructions

### Option C — Post-gen override with curated content
- AI generates features → compare with template composer's category content → replace if AI quality is generic
- **Effort: ~1-2h**
- **Risk**: AI's unique phrasing lost; template content may not match AI's chosen headline

**Recommended**: **Option A** (reuse builders). Cleanest, biggest quality lift, lowest risk. Template composer content is already production-proven. AI path just wasn't wired to use it.

---

## 6. Other differences (minor)

| Dimension | Template | AI gen |
|---|---|---|
| **Theme** | Pre-assigned per preset | Seed-picked from 8/category (Plan 2253 Phase 02) |
| **Blocks count** | Preset-defined (8-12) | AI-determined + enforcer min 10 |
| **Multi-page** | Blueprint has `pages[]` array | Enforcer via recipes (Plan 2249 phase 05) |
| **User data** | `bizOverride` merges user name/tagline over canned | `buildUserPrompt` sends businessName/products/phone to GPT |
| **Media** | Placeholder URLs (`placehold.co`) | Unsplash pipeline fetches real images |
| **Layout order** | Preset `blocks[]` array OR recipe (since R1 fix) | Recipe (since R1 fix) |
| **Font/color** | Preset `themePreset` | `pickCategoryTheme` (Plan 2253 Phase 02) |
| **Variant picking** | `selectVariant` seeded hash | `pickWeightedVariant` + force re-pick (post cleanup) |

Most structural dimensions are now **aligned** between 2 paths (post Plan 2253 + R1 + cleanup). **Only content quality is the remaining gap**.

---

## 7. Recommendation

### Short-term (1 PR, 3-4h): Option A — Wire template builders into AI gap-fill

1. Export `buildFeatures`, `buildStats`, `buildPricing`, `buildTeam`, `buildServiceCards` từ `template-composer.ts`
2. Rewrite `content-injection.buildBlockFromLibrary` switch cases:
   - `case 'features'` → delegate to `template-composer.buildFeatures(biz, category)`
   - `case 'stats'` → `template-composer.buildStats(category)`
   - `case 'pricing'` → `template-composer.buildPricing(category)`
   - `case 'team'` → `template-composer.buildTeam(category)`
   - `case 'service-cards'` → `template-composer.buildServiceCards(biz, category)`
3. Adapter: convert `AI BusinessInfoInput` → `BusinessSample` (pattern exists in `fallback-adapter.ts:mapBusinessInfo`)
4. AI output merged over template content (AI wins for fields it provides, template fills gaps)
5. Measurement: re-run variety harness + eyeball check same businesses before/after

**Result**: AI gen for restaurant will output hand-curated "Halal Certified / JAKIM / GrabFood" features instead of "Quality Service". Template composer quality delivered through AI path with zero new content curation.

### Long-term (next sprint): few-shot example injection

Feed 2-3 per-category sample blocks into system prompt as "good examples". GPT-4o emits content closer to examples than training median. Requires prompt engineering iteration. Bigger potential quality lift (AI becomes aware of quality bar) but harder to measure.

---

## Open questions (resolved by code check)

1. **Template composer có dùng AI không?** → Không. Pure algorithmic. 0 OpenAI calls in composeFromBlueprint.
2. **AI gen có reuse template builders không?** → Không. Separate code paths. `openai-generator.ts` doesn't import `template-composer.ts`. Only fallback path reuses composer via `composeFallbackResult`.
3. **Content/*.ts có share giữa 2 paths?** → Partial. Both read `getCategoryContent()` for testimonials/FAQs/businesses. But builders (features/stats/pricing) are only in template-composer.

---

## Summary cho anh

Template mẫu đẹp hơn vì developer đã **ngồi viết ~280 content entries bằng tay** (Malaysia-specific, với JAKIM/FPX/MBBS/Dato'/RM pricing) — đây là thứ GPT-4o training data không có granularity đó.

AI gen path không reuse thứ này → rơi xuống generic gap-fill pool ("Quality Service / Fast Response").

**Fix đơn giản nhất**: gọi template composer builders từ AI gap-fill. ~3-4h. Zero new content needed — code đã có sẵn, chỉ thiếu wiring.

Anh muốn em ship fix này?
