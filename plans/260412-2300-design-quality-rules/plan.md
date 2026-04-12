---
title: "Design Quality Rules — Block-Level Implementation"
description: "Implement design quality standards across all blocks: typography scale, color 60-30-10, spacing tokens, content validation"
status: pending
priority: P1
effort: 5-7d
branch: chore/cleanup-env-vars
tags: [design, blocks, quality, tokens, typography, color]
created: 2026-04-12
---

# Design Quality Rules — Block-Level Implementation

## Mục tiêu
Biến DESIGN QUALITY RULES từ prompt text → code thực thi. Đảm bảo mỗi block component render theo chuẩn thiết kế chuyên nghiệp, không phụ thuộc vào AI "tuân lệnh" prompt.

## Trạng thái hiện tại
- CSS variables đã có (`--brand-primary`, `--brand-secondary`) — 192 usages
- Shared utilities: animations, decorative components, RichText sanitizer
- **Thiếu**: Design token system, typography scale, spacing scale, content validation, contrast checking

## Nguyên tắc từ research

| Nguồn | Rule cần implement |
|-------|-------------------|
| Anthropic Cookbook | Hướng dẫn AI từng dimension riêng biệt |
| Impeccable | OKLCH color, cấm reflex fonts, 4pt grid |
| v0 Vercel | Closed token layer — AI chọn từ set cố định |
| Web Design Research | AIDA ordering, 60-30-10 color, 8px spacing grid |
| CRO Research | 6-word headlines, single CTA/viewport, 48px touch targets |

## Phases

| # | Phase | Status | Effort | Key Deliverable |
|---|-------|--------|--------|-----------------|
| 01 | [Design Token System](phase-01-design-tokens.md) | pending | 1d | Spacing, typography, radius, shadow tokens |
| 02 | [Typography Scale](phase-02-typography.md) | pending | 1d | Type scale classes, font pairing validation |
| 03 | [Color System](phase-03-color-system.md) | pending | 1d | 60-30-10 enforcement, contrast checks |
| 04 | [Content Validation](phase-04-content-validation.md) | pending | 1d | Word counts, CTA labels, section ordering |
| 05 | [Block Component Audit](phase-05-block-audit.md) | pending | 2-3d | Apply tokens + validation to all 47 blocks |

## Chạy song song
Plan này **độc lập** với AI variety audit (plans/260412-2156). Có thể chạy song song:
- Variety audit: sửa prompt + sanitizer + fallback + composer
- Design quality: sửa block components + thêm token system

## Key Files
- `src/lib/theme/resolve.ts` — theme CSS var resolver (đã có)
- `src/blocks/shared/` — shared components, animations
- `src/blocks/*/index.tsx` — 47 block components
- `src/app/globals.css` — global styles
