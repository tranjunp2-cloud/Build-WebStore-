---
parent: plan.md
phase: 2
---

# Phase 2: Polish Partial Blocks

## Context
- Parent: [plan.md](plan.md)
- Dependencies: None (parallel with Phase 1)
- Docs: Block configs, reference implementations

## Overview
- **Date:** 2026-04-06
- **Description:** Upgrade 3 partial blocks (about, faq, cta) from basic to production quality with proper variants and design tokens
- **Priority:** P0
- **Implementation status:** done
- **Review status:** not started

## Key Insights
- about (78 lines): Used on every About page. Currently renders basic text, no visual variety
- faq (54 lines): Used on home + services pages. Basic accordion, no design tokens
- cta (55 lines): Used throughout templates. Currently a centered text + button, no variants
- These appear in Professional + Premium templates → quality visible to paying users

## Requirements
1. Each block MUST support defined variants from config.ts
2. MUST use full design token system (colors, spacing, radius, shadows)
3. MUST be responsive and accessible (keyboard nav for accordion)
4. MUST handle variant prop from template-composer correctly

## Related Code Files
| File | Purpose | Action |
|------|---------|--------|
| `src/blocks/about/index.tsx` | About block (78 lines) | ENHANCE |
| `src/blocks/about/config.ts` | About config + schema | READ |
| `src/blocks/faq/index.tsx` | FAQ block (54 lines) | ENHANCE |
| `src/blocks/faq/config.ts` | FAQ config + schema | READ |
| `src/blocks/cta/index.tsx` | CTA block (55 lines) | ENHANCE |
| `src/blocks/cta/config.ts` | CTA config + schema | READ |

## Implementation Steps

### 0. Pre-requisites
1. **Verify `'use client'`** có trong about/index.tsx, faq/index.tsx, cta/index.tsx (research cho thấy 3 block này ĐÃ CÓ `'use client'` — chỉ cần verify)
2. **Import `AnimatedSection`** từ `src/blocks/shared/animations.tsx` (tạo ở Phase 1 step 0)
3. Tất cả animations dùng wrapper này — tự động respect `prefers-reduced-motion`

### 1. About Block (~3.5h)
- **split variant**: Image left/right + text content (alternating layout)
- **full-width variant**: Full-width hero-style with overlay text
- **timeline variant**: Company history as vertical timeline
- **Schema change**: Thêm timeline fields vào about/config.ts:
  - `timelineItems[].year` (string) — e.g. "2020"
  - `timelineItems[].icon` (string, optional) — emoji hoặc icon name
  - Update AboutConfigSchema (Zod)
  - Thêm migration trong db-setup.js nếu About block data lưu DB (check trước)
  - **Lưu ý từ predict**: AI chưa biết generate timeline data → cần update AI prompt trong template-composer để populate year/icon khi category phù hợp (Business, Tech, Education)
- Add: image handling (placeholder if missing), responsive columns, Framer Motion fade-in + stagger
- All variants use design tokens for dark mode support (--surface, --text, --muted)

### 2. FAQ Block (~2h)
- **accordion variant**: Collapsible items with smooth animation, keyboard accessible
- **two-column variant**: Questions split into 2 columns on desktop
- Add: aria-expanded, focus management, design token borders/shadows

### 3. CTA Block (~2h)
- **centered variant**: Text + buttons centered, gradient/solid background
- **split variant**: Text on one side, image/illustration on other
- **banner variant**: Full-width banner with subtle pattern background
- Add: Primary + secondary button support, design token colors

## Todo List
- [ ] Read about/config.ts → enhance about/index.tsx (3 variants, 200+ lines)
- [ ] Read faq/config.ts → enhance faq/index.tsx (2 variants, 120+ lines)
- [ ] Read cta/config.ts → enhance cta/index.tsx (3 variants, 120+ lines)
- [ ] Test all 3 in SiteRenderer
- [ ] Verify accessibility (keyboard, aria)
- [ ] Run existing tests

## Success Criteria
- [ ] about: 200+ lines, 3 variants, image handling, responsive
- [ ] faq: 120+ lines, 2 variants, keyboard accessible accordion
- [ ] cta: 120+ lines, 3 variants, dual button support
- [ ] All pass existing schema tests
- [ ] Visual: blocks look professional, match core block quality

## Risk Assessment
- **Low**: Existing structure works, just adding variant logic
- **Medium**: FAQ accessibility — must test with screen reader patterns

## Security Considerations
- FAQ content from CMS → sanitized by Payload
- CTA links: use `rel="noopener noreferrer"` for external links

## Next Steps
→ Phase 4 (smoke test) after completion
