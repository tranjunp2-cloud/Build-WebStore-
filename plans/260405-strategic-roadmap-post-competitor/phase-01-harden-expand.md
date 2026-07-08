# Phase 1: v1.1 — Harden & Expand

> **Parent Plan:** [plan.md](./plan.md)
> **Dependencies:** v1.0 Phase 1 milestone (51% done)
> **Docs:** [F03 PRD](../../docs/prd/F03-dashboard.md), [F05 PRD](../../docs/prd/F05-ai-editor.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-04-05 → 2026-04-30 |
| Description | Fix critical gaps, expand block library, mobile polish |
| Priority | P0 |
| Implementation status | in-progress |
| Review status | pending |

## Key Insights

1. **Security gaps are launch blockers** — iframe origin validation and XSS in AI chat must be fixed before any public launch
2. **Block library is the #1 product gap** — 30 blocks vs competitor's 150+. Target 60+ for v1.1
3. **Mobile UX deviates from PRD** — stat cards 3-col instead of 2x2, editor needs bottom sheet
4. **Line coverage 58%** — needs 2% more to hit 60% CI gate

## Requirements

### 1A. Security Fixes (P0, Week 1) ✅
- [x] **iframe postMessage origin validation** — verify `e.origin` before processing messages in PreviewFrame.tsx
- [x] **XSS sanitization in AI chat** — sanitize user prompts before rendering in chat bubbles (DOMPurify)
- [x] **Analytics query limit** — replaced with `payload.count()` + cap 5000
- [x] **SEO undo backup persistence** — sessionStorage with 5-min expiry

### 1B. Block Library Expansion (P0-P1, Week 1-3)
Current blocks (~30): hero, features, cta, faq, testimonials, gallery, contact, team, about, newsletter, pricing, stats, logo-cloud, video, carousel, footer, navigation, products-featured, products-grid, blog-list, cart-widget, custom-html

**New blocks added (20):** ✅
- [x] Pricing Table — 3-column comparison with toggle (monthly/yearly)
- [x] Gallery Masonry — masonry grid variant (2-3-4 columns)
- [x] WhatsApp Floating Button — sticky CTA (MY market essential)
- [x] Google Maps Embed — location block for local business
- [x] Social Proof — reviews/ratings widget
- [x] Countdown Timer — promotion urgency
- [x] Before/After — comparison slider
- [x] Feature Comparison — table with checkmarks
- [x] Download CTA — file download + email capture
- [x] Video Background — full-width video hero variant
- [x] Breadcrumb — navigation aid
- [x] Divider/Spacer — layout utility
- [x] Announcement Bar — top banner for promos
- [x] Client Logos — scrolling marquee variant
- [x] Accordion — expandable content sections
- [x] Step Process — numbered steps with icons
- [x] Portfolio Grid — project showcase
- [x] Menu/Food — restaurant menu display
- [x] Service Cards — service listing with pricing
- [x] Carousel — content slider with autoplay

### 1C. Mobile UX Polish (P1, Week 2-3) ✅
- [x] Dashboard stat cards: `grid-cols-2` on mobile (F03 FR-16)
- [x] Editor: bottom sheet for block settings on mobile (F05 FR-31)
- [x] Editor: FAB chat button on mobile (F05 FR-29)
- [x] Editor: disable drag-drop on mobile, use tap-to-add (F05 FR-30)

### 1D. Test Coverage (P1, Week 2-4) ✅
- [x] 161 new block config/registry/schema tests
- [x] 15 new mobile UX tests (DashboardStats grid, PreviewFrame disableDragDrop, registry count)
- [x] Updated block-configs test to expect 42 blocks
- [x] Total: 2043 → 2262 tests (+219), 100% pass

### 1E. Payment Gateway — FPX (P1, Week 3-4)
- [ ] Stripe MY account setup with FPX support
- [ ] Checkout flow with FPX bank selection (F13 PRD)
- [ ] Webhook handler for payment confirmation
- [ ] Order status auto-update on payment success

## Related Code Files

| File | Purpose |
|------|---------|
| `src/components/editor/PreviewFrame.tsx` | iframe origin fix |
| `src/components/editor/AIChatPanel.tsx` | XSS sanitization |
| `src/app/(dashboard)/dashboard/analytics/page.tsx` | Analytics limit fix |
| `src/blocks/*/config.ts` | Block definitions |
| `src/blocks/registry.ts` | Block registration |
| `src/components/dashboard/DashboardStats.tsx` | Mobile grid fix |

## Implementation Steps

1. **Week 1**: Security fixes (4 critical items) + start block library design
2. **Week 2**: Ship 15 new blocks + mobile UX fixes
3. **Week 3**: Ship 15 more blocks + FPX payment integration + test coverage
4. **Week 4**: QA, polish, coverage push to 60%, staging validation

## Success Criteria

- [ ] 0 Critical security gaps remaining
- [ ] 60+ block types in registry
- [ ] Mobile layout matches PRD (2x2 grid, bottom sheet)
- [ ] Line coverage ≥ 60%
- [ ] FPX payment working on staging
- [ ] All 1990+ tests passing

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Block quality inconsistent across 30 new blocks | High | Define block template standard, review each block |
| FPX Stripe setup delays | Medium | Start with test mode, parallel to block work |
| Coverage regression from new code | Medium | Write tests alongside each block |

## Security Considerations

- iframe origin whitelist: only accept messages from `window.location.origin` and preview subdomain
- AI chat input: use DOMPurify before rendering any user text in chat
- Analytics: use Payload `count()` aggregation instead of fetching 10K docs

## Next Steps

After Phase 1 → proceed to [Phase 2: AI Wow Features](./phase-02-ai-wow-features.md)
