# Phase 04: Content Validation Rules

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01, 02 (tokens, typography)
- Priority: P1
- Status: pending

## Mục tiêu
Validate nội dung AI generate: headline length, CTA labels, section ordering, minimum content counts.

## Key Insights
- CRO Research: 6-word headlines convert tốt nhất
- Anti-pattern: "Welcome to our website", "Click Here", "Submit"
- AIDA funnel: features trước stats, testimonials trước pricing
- Content-count guard: carousel cần 3+ items, masonry 4+ items (từ scenario analysis)

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

### 4.5 Wire vào sanitizer

Trong `openai-generator.ts`, sau `sanitizeBlockData()`:
1. Run `validateBlockContent(block)` → log warnings
2. Run `enforceMinContent()` → auto-fix variant if needed
3. Apply ordering rules → reorder if dependency violated

## Todo
- [ ] Tạo `src/lib/ai/content-rules.ts` với all constants
- [ ] Implement `validateBlockContent()`
- [ ] Implement `enforceMinContent()`
- [ ] Implement ordering validation
- [ ] Wire vào sanitizer pipeline
- [ ] Test: blocked content detected + warned
- [ ] Test: carousel với 1 item → fallback to cards

## Success Criteria
- [ ] Headline > 10 words → warned in console
- [ ] "Submit" CTA → warned, suggest alternative
- [ ] Generic content detected → warned
- [ ] Carousel 1 item → auto-fallback to simpler variant
- [ ] Features always before stats in rendered page
