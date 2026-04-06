---
parent: plan.md
phase: 1
---

# Phase 1: Fix Stub Blocks

## Context
- Parent: [plan.md](plan.md)
- Dependencies: None
- Docs: Block configs in `src/blocks/*/config.ts`, patterns from hero/features/testimonials

## Overview
- **Date:** 2026-04-06
- **Description:** Replace 3 stub blocks (stats, team, newsletter) with real implementations including variants, design tokens, responsive layout
- **Priority:** P0
- **Implementation status:** pending
- **Review status:** not started

## Key Insights
- These 3 blocks appear in EVERY template via template-composer → most visible quality gap
- stats: used on homepage (social proof)
- team: used on about pages
- newsletter: used on homepage (lead capture)
- Must match quality level of hero/features (100+ lines, variants, tokens)

## Requirements
1. Each block MUST support at least 2-3 variants (defined in its config.ts already)
2. MUST use design tokens: `var(--brand-primary)`, `var(--space-*)`, `var(--radius-*)`, `var(--shadow-*)`
3. MUST be responsive (mobile-first, test at 375px + 768px + 1280px)
4. MUST render real content from block config props (not hardcoded)
5. MUST handle missing/empty data gracefully

## Architecture
Each block follows the established pattern:
```
src/blocks/{name}/
├── config.ts    ← Already exists with schema + variants
└── index.tsx    ← NEEDS REWRITE (currently stub)
```

Component pattern (from hero/features):
```tsx
export default function BlockName({ block, theme }: BlockProps) {
  const variant = block.variant || 'default';
  // Switch on variant → render different layouts
  // Use design tokens via CSS variables
  // Handle responsive with Tailwind breakpoints
}
```

## Related Code Files
| File | Purpose | Action |
|------|---------|--------|
| `src/blocks/stats/index.tsx` | Stats block (23 lines) | REWRITE |
| `src/blocks/stats/config.ts` | Stats config + schema | READ (variants defined here) |
| `src/blocks/team/index.tsx` | Team block (24 lines) | REWRITE |
| `src/blocks/team/config.ts` | Team config + schema | READ |
| `src/blocks/newsletter/index.tsx` | Newsletter block (18 lines) | REWRITE |
| `src/blocks/newsletter/config.ts` | Newsletter config + schema | READ |
| `src/blocks/hero/index.tsx` | Reference implementation (855 lines) | REFERENCE |
| `src/blocks/features/index.tsx` | Reference implementation (315 lines) | REFERENCE |

## Implementation Steps

### 0. Pre-requisites (BẮT BUỘC — làm đầu tiên)
1. **Thêm `'use client'`** vào đầu file `stats/index.tsx`, `team/index.tsx`, `newsletter/index.tsx` — không có thì Framer Motion crash khi SSR
2. **Tạo/mở rộng `src/blocks/shared/animations.tsx`**:
   - Thêm `AnimatedSection` wrapper component dùng `useReducedMotion()` từ framer-motion
   - Pattern: `const shouldReduce = useReducedMotion(); if (shouldReduce) return children without animation`
   - Tất cả 6 blocks Phase 1+2 import wrapper này thay vì tự implement motion
3. **framer-motion đã có** trong package.json (`^11.12.0`) — KHÔNG cần install

### 1. Stats Block (~2h)
1. Read `stats/config.ts` to understand variants and props
2. Rewrite `stats/index.tsx`:
   - **numbers variant**: Big numbers + labels in a responsive grid (2-4 cols)
   - **cards variant**: Each stat in a card with icon, number, label, optional trend arrow
   - **progress-bars variant**: Horizontal bars with percentage fill
3. Add: Framer Motion scroll-triggered count-up + stagger, design tokens (incl dark mode via --surface/--text), responsive grid

### 2. Team Block (~2h)
1. Read `team/config.ts` for variants and member schema
2. Rewrite `team/index.tsx`:
   - **grid variant**: Photo + name + role + bio in responsive grid
   - **cards variant**: Elevated cards with hover effect, social links
   - **carousel variant**: Horizontal scroll on mobile, grid on desktop
3. Add: placeholder avatar (initials), social icon links, responsive image handling

### 3. Newsletter Block (~1.5h)
1. Read `newsletter/config.ts` for variants
2. Rewrite `newsletter/index.tsx`:
   - **inline variant**: Single-row form (email input + CTA button)
   - **card variant**: Elevated card with heading, description, email input, CTA
3. Add: email validation, Framer Motion, design tokens, dark mode
4. **Real submit**: POST /api/subscribe → Subscribers collection

### 4. Subscribers Collection + API (~45min)
1. Create `src/collections/Subscribers.ts`: email (required, Zod `.email()` validation, unique per site), siteId (relationship), createdAt
2. Register in payload.config.ts
3. Create `src/app/api/subscribe/route.ts`: POST { email, siteId } → create subscriber
4. Add migration in db-setup.js: CREATE TABLE IF NOT EXISTS subscribers
5. Rate limit: dùng `checkRateLimit()` từ `src/lib/rateLimit.ts` — 5 req/min per IP
6. **Admin view**: Subscribers collection tự hiện trong Payload admin panel (list + filter by site)
7. Email validation: dùng Zod `z.string().email()` cả backend lẫn frontend

## Todo List
- [ ] Read stats/config.ts, understand props + variants
- [ ] Rewrite stats/index.tsx (3 variants, 150+ lines)
- [ ] Read team/config.ts, understand props + variants
- [ ] Rewrite team/index.tsx (3 variants, 150+ lines)
- [ ] Read newsletter/config.ts, understand props + variants
- [ ] Rewrite newsletter/index.tsx (2 variants, 100+ lines)
- [ ] Verify all 3 render correctly in SiteRenderer
- [ ] Run existing block tests to confirm no regression

## Success Criteria
- [ ] stats: 150+ lines, 3 variants, design tokens, responsive
- [ ] team: 150+ lines, 3 variants, avatar handling, responsive
- [ ] newsletter: 100+ lines, 2 variants, email input, responsive
- [ ] All 3 pass existing test suites (schema validation)
- [ ] Visual: blocks look professional when rendered in template

## Risk Assessment
- **Low risk**: Configs/schemas already exist, just need component rewrite
- **Low risk**: Framer Motion đã có (`^11.12.0`) — không thêm bundle size
- **Critical**: PHẢI thêm `'use client'` trước khi dùng Framer Motion — thiếu = crash SSR
- **Medium risk**: `prefers-reduced-motion` — dùng shared AnimatedSection wrapper để cover
- **Low risk**: Dark mode support via design tokens — established pattern

## Security Considerations
- Newsletter: email input must use `type="email"` with validation
- Team: social URLs must be sanitized (already handled by Zod schema)
- No user-generated content injection risk (all from CMS)

## Next Steps
→ Phase 2 (polish partials) can run in parallel
→ Phase 4 (smoke test) after this completes
