---
title: "BUG-F05-07: Layout consistency — migrate blocks to SectionWrapper"
description: "Fix layout vỡ bằng cách migrate tất cả blocks sang SectionWrapper thay vì hardcode container classes"
status: pending
priority: P1
effort: 4h
branch: fix/F05-07-layout-consistency
issue: 656
tags: [editor, layout, F05, design-tokens]
created: 2026-04-16
---

# BUG-F05-07: Layout Website vỡ, bố cục không thống nhất

## Problem
Các section render trên website bị vỡ layout — bố cục giữa blocks không thống nhất, kích thước content/hình ảnh to nhỏ thất thường.

## Root Cause
- `SectionWrapper` component tồn tại nhưng **0% adoption** (chỉ 2/50 blocks dùng)
- 48 blocks còn lại hardcode container classes riêng (`max-w-6xl mx-auto px-6 md:px-8`)
- Không có enforcement → blocks dùng khác nhau → layout không đồng nhất
- Một số blocks thiếu responsive padding hoặc max-width hoàn toàn

## Solution
Migrate tất cả content blocks sang `<SectionWrapper>` — single source of truth cho container width, padding, background.

## Scope & Priority

### Blocks TO migrate (content blocks — need consistent container):
| Priority | Blocks | Count |
|----------|--------|-------|
| P0 | about, features, contact, stats, pricing, faq, team, gallery, cta | 9 |
| P1 | newsletter, service-cards, step-process, social-proof, portfolio-grid, menu-food, accordion, blog-list, logo-cloud | 9 |
| P2 | video, google-maps, countdown-timer, carousel, products-grid, products-featured, divider, custom-html | 8 |

### Blocks NOT to migrate (special layout needs):
- `hero` — full-viewport backgrounds, split layouts, own padding system
- `navigation` — sticky/fixed, full-width by design
- `footer` — already uses SectionWrapper
- `testimonials` — already uses SectionWrapper
- `whatsapp-button` — floating widget, no section layout
- `social-widget` — floating widget
- `cart-widget` — floating widget
- `announcement-bar` — full-width banner
- Industry-specific blocks (doctor-profile, booking-widget, etc.) — not in main render path

## Phases

| Phase | Description | Status | Effort | Blocks |
|-------|-------------|--------|--------|--------|
| 01 | P0 core blocks (9 blocks) | pending | 2h | about, features, contact, stats, pricing, faq, team, gallery, cta |
| 02 | P1 extended blocks (9 blocks) | pending | 1.5h | newsletter, service-cards, step-process, social-proof, portfolio-grid, menu-food, accordion, blog-list, logo-cloud |
| 03 | P2 media/utility blocks (8 blocks) | pending | 30m | video, google-maps, countdown-timer, carousel, products-grid, products-featured, divider, custom-html |

## Migration Pattern

### Before (typical block):
```tsx
export function AboutBlock({ ... }) {
    return (
        <section className="py-16 md:py-24 bg-[var(--surface-primary)]">
            <div className="max-w-6xl mx-auto px-6 md:px-8 lg:px-12">
                {/* content */}
            </div>
        </section>
    )
}
```

### After:
```tsx
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'

export function AboutBlock({ ... }) {
    return (
        <SectionWrapper padding="default" container="default">
            {/* content — no wrapper div needed */}
        </SectionWrapper>
    )
}
```

### Rules:
1. Replace outermost `<section>` + inner `<div className="max-w-...">` with `<SectionWrapper>`
2. Keep block-specific inner layout (grids, flex, etc.) unchanged
3. Use `padding="compact"` for smaller blocks (divider, announcement)
4. Use `container="wide"` for gallery/carousel that need more horizontal space
5. Use `background="alternate"` for sections that alternate bg color
6. Do NOT change visual appearance — only standardize the container pattern

## Risk Assessment
- **Low:** SectionWrapper already tested in 2 blocks
- **Medium:** Visual regression possible — need to check each block renders same after migration
- **Mitigation:** Migrate 1 block, verify visually, then batch the rest

## Success Criteria
- All content blocks use SectionWrapper
- Consistent container width (max-w-6xl) across all sections
- Consistent responsive padding (px-6 → px-8 → px-12)
- No visual regression — blocks look the same as before
