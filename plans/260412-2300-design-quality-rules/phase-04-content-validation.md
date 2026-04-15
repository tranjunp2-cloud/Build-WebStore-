# Phase 04: Content Validation Rules

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01, 02 (tokens, typography)
- Priority: P1
- Status: **done** (2026-04-13)
- Scout ref: `scout/scout-design-quality-scan.md` section 4
- Plan A commit beffa9b đã merge sanitizer với VARIANT_ALIASES + CATEGORY_VARIANT_WEIGHTS

## Implementation Notes (2026-04-13)

**Files shipped:**
- `src/lib/ai/content-rules.ts` (NEW, ~340 lines) — CONTENT_RULES, BLOCKED_CONTENT, BLOCKED_CTA_BY_LANG (en/vi/ms), SUGGESTED_CTA_BY_LANG, ORDERING_RULES, CATEGORY_ORDERING_OVERRIDES, MIN_BLOCKS_PER_PAGE, validateBlockContent, applyContentValidation, validateOrdering, checkPageBlockCount, getContentArray, normalizeLang
- `src/lib/ai/openai-generator.ts` — sanitizeBlockData gains `language` param (en/vi/ms), wires validateBlockContent after content-count guard, wires checkPageBlockCount + validateOrdering at page level for both multi-page and single-page paths
- `src/lib/ai/template-composer.ts` — composeFromBlueprint wraps buildBlockFromSpec with applyContentValidation; legacy composeTemplate iterates pages post-build
- `src/__tests__/unit/lib/ai/content-rules.test.ts` (NEW, 38 tests)
- `src/__tests__/unit/lib/ai/content-rules-integration.test.ts` (NEW, 9 tests — 7 AI path + 2 template path smoke)

**Test count:** 47 new tests, full suite 3890/3890 pass post-commit.

**Scenarios resolved from report:**
- #5, #6, #7 English blocked CTAs (exact + case-insensitive + prefix match)
- #8 (C1) Vietnamese/Malay slip-through (per-language lookup tables)
- #2, #3 Headline word limits (boundary + over-limit auto-truncate)
- #19 (C3) `MIN_BLOCKS_PER_PAGE = 3` guard with warning
- #22 Idempotent validation (re-run returns same object on no-op)
- #51 Fundraising category ordering override
- #55 Grapheme-aware char counting for emoji

**Validated decisions:**
- Non-blocking — never throws, always logs + auto-fixes
- Additive — Plan A `enforceMinContent` / `VARIANT_ALIASES` preserved, content-rules runs on top
- Multi-language — language propagates from `generateSiteWithAI` → `sanitizeBlockData` → `validateBlockContent`
- Template path defaults to 'en' (content/*.ts is pre-curated, Phase 05 can re-eval per category)

**Deferred to Phase 05:**
- FR-17 migration script `scripts/migrate-legacy-font-pairings.mjs` — no legacy pairings in DB during test suite, defer until pre-deploy cleanup
- Auto-reorder via `reorderHints` — Phase 04 only warns, template-composer has its own enforceBlockOrdering

## Mục tiêu
Validate nội dung AI generate + template content: headline length, CTA labels, section ordering, minimum content counts. Wire vào **cả 2 path**: AI (`sanitizeBlockData`) và template (`buildBlockFromSpec`).

## Key Insights
- CRO Research: 6-word headlines convert tốt nhất
- Anti-pattern: "Welcome to our website", "Click Here", "Submit"
- AIDA funnel: features trước stats, testimonials trước pricing
- Content-count guard: carousel cần 3+ items, masonry 4+ items (từ scenario analysis)

## Hook Points (scout findings)

### AI path — `src/lib/ai/openai-generator.ts`
- `sanitizeBlockData()` lines 478-557
- Plan A đã có: fuzzy match variant (507-518), weighted random (513), min content guard (528)
- **Insert validation: sau line 529** (after min content, before variant finalization)

### Template path — `src/lib/ai/template-composer.ts`
- **25 builder functions** (không phải 15 như plan cũ ghi):
  - 15 core: buildNavigation, buildHero, buildFeatures, buildTestimonials, buildContact, buildFooter, buildStats, buildGallery, buildFAQ, buildCTA, buildAbout, buildPricing, buildTeam, buildNewsletter, buildMenuDisplay
  - 10 industry: buildBookingWidget, buildClassSchedule, buildReviewCards, buildVideoShowcase, buildDoctorProfile, buildPropertyCard, buildProductQuickView, buildPortfolioGrid, buildServiceCards, buildClientLogos
- **Centralized hook: `buildBlockFromSpec()` line 963** — gọi bởi mọi builder, wire 1 chỗ ăn cả 25
- Content source: `getCategoryContent(category)` → `src/lib/ai/content/*.ts` (14 category files)

## Implementation Steps

### 4.1 Tạo `src/lib/ai/content-rules.ts`

```typescript
// Content validation rules — applied AFTER AI generation, BEFORE saving to CMS

export const CONTENT_RULES = {
  hero: {
    headlineMaxWords: 10,
    headlineMinWords: 3,
    subheadlineMaxWords: 25,
    subheadlineMinWords: 5,
  },
  cta: {
    labelMaxWords: 5,
    blockedLabels: ['Submit', 'Click Here', 'Buy Now', 'Learn More'],
    goodPatterns: /^(Get|Book|Start|View|Try|Download|Join|Contact|Request|Schedule)\s/,
  },
  section: {
    titleMaxWords: 8,
    titleMinWords: 2,
  },
  testimonial: {
    quoteMaxChars: 200,
    requiredFields: ['quote', 'name'],
    optionalFields: ['title', 'company', 'rating'],
  },
  feature: {
    descriptionMaxChars: 150,
    titleMaxWords: 6,
  },
} as const

// Blocked generic content
export const BLOCKED_CONTENT = [
  'Welcome to our website',
  'We are the best',
  'Lorem ipsum',
  'Quality service',
  'Professional team',
  'Your trusted partner',
  'One-stop solution',
]
```

### 4.2 Content validation function

```typescript
export function validateBlockContent(block: Record<string, unknown>): {
  valid: boolean
  warnings: string[]
  fixes: Record<string, unknown> // auto-fixable issues
}
```

Kiểm tra:
- Hero headline > 10 words → truncate/warn
- CTA label trong blocked list → suggest alternative
- Generic content detected → warn
- Testimonial thiếu name → add placeholder
- Feature description > 150 chars → truncate

### 4.3 Minimum content count per variant

```typescript
export const VARIANT_MIN_CONTENT: Record<string, Record<string, number>> = {
  testimonials: {
    carousel: 3,
    masonry: 4,
    'avatar-row': 3,
    cards: 2,
    simple: 1,
  },
  features: {
    'grid-4': 4,
    'grid-3': 3,
    'grid-2': 2,
    carousel: 3,
    list: 2,
  },
  gallery: {
    masonry: 6,
    carousel: 3,
    grid: 4,
    lightbox: 4,
  },
}

// If content count < minimum → fallback to simpler variant
export function enforceMinContent(blockType: string, variant: string, contentCount: number): string {
  const mins = VARIANT_MIN_CONTENT[blockType]
  if (!mins) return variant
  const required = mins[variant]
  if (required && contentCount < required) {
    // Find variant that fits current count
    const fallback = Object.entries(mins)
      .filter(([, min]) => contentCount >= min)
      .sort((a, b) => b[1] - a[1])[0]
    return fallback ? fallback[0] : variant
  }
  return variant
}
```

### 4.4 Section ordering validation

```typescript
// AIDA funnel constraints
export const ORDERING_RULES = {
  // Block A must come before Block B
  dependencies: [
    ['features', 'stats'],          // stats need context from features
    ['features', 'pricing'],        // pricing needs value context
    ['features', 'testimonials'],   // social proof after value
    ['about', 'team'],              // team after company intro
  ],
  // These blocks should be in first half of page
  firstHalf: ['features', 'about', 'stats'],
  // These blocks should be in second half
  secondHalf: ['pricing', 'contact', 'newsletter', 'faq'],
  // These are always fixed position
  fixed: {
    first: ['navigation'],
    second: ['hero'],
    last: ['footer'],
    secondToLast: ['contact'],
  },
}
```

### 4.5 Wire AI path — `openai-generator.ts`

Trong `sanitizeBlockData()`, sau line 529 (min content guard):
```typescript
// Existing (line ~529): min content enforcement
// ...

// NEW: content validation
const validation = validateBlockContent(sanitized)
if (!validation.valid) {
  console.warn('[sanitize] content violations:', validation.warnings)
  Object.assign(sanitized, validation.fixes) // auto-fix
}

// NEW: variant fallback based on content count
const contentArray = getContentArray(sanitized) // helper to find items/testimonials/features array
if (contentArray) {
  sanitized.variant = enforceMinContent(block.blockType, sanitized.variant, contentArray.length)
}
```

### 4.6 Wire Template path — `template-composer.ts`

Trong `buildBlockFromSpec()` line 963 (centralized — ăn cả 25 builders):
```typescript
export function buildBlockFromSpec(spec: BlockSpec, biz: BusinessInfo, content: CategoryContent) {
  // Existing: call appropriate build*() function
  const block = callBuilder(spec, biz, content)

  // NEW: validate content (same rules as AI path)
  const validation = validateBlockContent(block)
  if (!validation.valid) {
    console.warn(`[template] ${spec.type} violations:`, validation.warnings)
    Object.assign(block, validation.fixes)
  }

  // NEW: enforce min content variant
  const contentArray = getContentArray(block)
  if (contentArray) {
    block.variant = enforceMinContent(spec.type, block.variant, contentArray.length)
  }

  return block
}
```

**Single source of truth:** `validateBlockContent()` + `enforceMinContent()` export từ `src/lib/ai/content-rules.ts`, consumed bởi cả 2 paths. Đồng bộ rules.

### 4.7 Section ordering — apply sau khi build toàn bộ blocks

Ordering validation là **page-level** (không phải block-level), áp dụng sau khi generate full page:
- AI path: trong `generateSiteWithAI()` sau `sanitizeBlockData()` loop
- Template path: trong `composeFromBlueprint()` / `composeTemplate()` sau khi gọi hết builders

## Todo
- [ ] Tạo `src/lib/ai/content-rules.ts` với all constants
- [ ] Implement `validateBlockContent()`, `enforceMinContent()`, `validateOrdering()`
- [ ] Helper `getContentArray()` — find items/testimonials/features array in block
- [ ] Wire AI path: `sanitizeBlockData()` sau line 529
- [ ] Wire Template path: `buildBlockFromSpec()` line 963 (centralized)
- [ ] Wire ordering: page-level validation sau khi build blocks (cả 2 paths)
- [ ] Test: blocked content detected + warned
- [ ] Test: carousel với 1 item → fallback to cards
- [ ] Test: template path validation trigger khi content có "Submit" CTA

## Success Criteria
- [ ] Headline > 10 words → warned in console (cả AI + template path)
- [ ] "Submit" CTA → warned, suggest alternative (cả 2 paths)
- [ ] Generic content detected → warned
- [ ] Carousel 1 item → auto-fallback to simpler variant
- [ ] Features always before stats in rendered page
- [ ] Cả 25 template builders qua `buildBlockFromSpec()` validation
- [ ] `src/lib/ai/content/*.ts` (14 files) không chứa blocked labels sau validation pass
- [ ] Multi-language: Vietnamese "Gửi", Malay "Hantar" detected + fixed
- [ ] Page-level guard: min 3 blocks enforce (nav + hero + footer fallback skeleton)
- [ ] Migration script: existing `modern-clean`/`humanist` pairings detected + updated

## Addendum — Multi-language + Migration (from scenario report)

Scenario report (`reports/scenario-content-visual.md`) phát hiện 2 gap critical:

### Multi-language BLOCKED_CTA (Scenario C1)
English-only blocked list sẽ miss Vietnamese/Malay CTAs. Fix:

```typescript
// src/lib/ai/content-rules.ts
export const BLOCKED_CTA_BY_LANG: Record<'en' | 'vi' | 'ms', string[]> = {
  en: ['Submit', 'Click Here', 'Buy Now', 'Learn More', 'Read More'],
  vi: ['Gửi', 'Nhấn vào đây', 'Bấm vào đây', 'Đọc thêm', 'Xem thêm'],
  ms: ['Hantar', 'Klik di sini', 'Tekan di sini', 'Baca lagi'],
}

export const SUGGESTED_CTA_BY_LANG: Record<'en' | 'vi' | 'ms', string[]> = {
  en: ['Get Started', 'Contact Us', 'Book Now', 'Request Demo'],
  vi: ['Đăng ký ngay', 'Liên hệ', 'Đặt lịch', 'Yêu cầu demo'],
  ms: ['Mula Sekarang', 'Hubungi Kami', 'Tempah', 'Minta Demo'],
}

export function validateBlockContent(block: Record<string, unknown>, lang: 'en' | 'vi' | 'ms' = 'en') {
  // ... reads BLOCKED_CTA_BY_LANG[lang]
}
```

Language source:
- AI path: `theme.language` hoặc `businessInfo.language` passed qua `sanitizeBlockData`
- Template path: `composeFromBlueprint` pass language xuống `buildBlockFromSpec`
- Default: `'en'`

### Page-level guard (Scenario C3)
```typescript
// After all block validation completes, before returning page
const MIN_BLOCKS_PER_PAGE = 3

if (validBlocks.length < MIN_BLOCKS_PER_PAGE) {
  console.warn(`[design-quality] page has ${validBlocks.length} blocks, adding skeleton`)
  // Fallback: ensure nav + hero + footer exist
  const hasNav = validBlocks.some(b => b.blockType === 'navigation')
  const hasFooter = validBlocks.some(b => b.blockType === 'footer')
  if (!hasNav) validBlocks.unshift(buildFallbackNav(biz))
  if (!hasFooter) validBlocks.push(buildFallbackFooter(biz))
}
```

### Font pairing migration script (Scenario C4)
```bash
# scripts/migrate-legacy-font-pairings.mjs
# Dry-run:
node scripts/migrate-legacy-font-pairings.mjs
# Apply:
node scripts/migrate-legacy-font-pairings.mjs --apply
```

Logic:
1. Connect Payload client
2. Scan `themes` / `sites` collections
3. Detect:
   - `fontPairingId === 'modern-clean'` → update to `'startup-vibe'` (Outfit+DM Sans)
   - `fontPairingId === 'humanist'` → update to `'pro-corporate'` (Manrope+Inter)
   - `fontHeading === fontBody` (raw same-font) → fallback to `'startup-vibe'`
4. Log before/after per site
5. Dry-run default; `--apply` flag để commit DB updates
6. Rollback: save snapshot file `migrations/font-pairings-backup-{timestamp}.json`

**Chạy TRƯỚC deploy Plan B.**
