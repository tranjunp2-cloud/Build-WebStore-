---
name: Scout — Blocks + Template API
description: File inventory for plan implementation
---

# Scout Report: Template System Quality

## Block Components

| Block | index.tsx | Lines | 'use client' | Variants (config) | Quality | Framer Motion |
|-------|-----------|-------|-------------|-------------------|---------|---------------|
| stats | src/blocks/stats/index.tsx | 23 | ❌ | row, grid, highlight | STUB | ❌ |
| team | src/blocks/team/index.tsx | 24 | ❌ | grid, list | STUB | ❌ |
| newsletter | src/blocks/newsletter/index.tsx | 18 | ❌ | inline, popup, banner | STUB | ❌ |
| about | src/blocks/about/index.tsx | 78 | ✅ | simple, split, story | PARTIAL | ✅ |
| faq | src/blocks/faq/index.tsx | 54 | ✅ | accordion, grid, simple | PARTIAL | ❌ |
| cta | src/blocks/cta/index.tsx | 55 | ✅ | banner, inline, floating | PARTIAL | ✅ |

Config files: src/blocks/{name}/config.ts (all exist, 6-33 lines each)

## Shared Animations
- `src/blocks/shared/animations.tsx` (118 lines, 'use client')
- Exports: AnimatedSection, StaggerGrid, StaggerItem, HoverCard, fadeInUp, fadeIn, scaleIn, slideInLeft/Right

## Template API

| File | Lines | Purpose | Key Notes |
|------|-------|---------|-----------|
| src/app/api/ai/apply-template/route.ts | 198 | Apply template to site | NO delete, NO transaction, rate limit 20/hr |
| src/components/editor/EditorTemplateModal.tsx | 353 | Template picker modal | ✅ HAS confirmation dialog + warning text |
| src/lib/ai/template-composer.ts | 976 | Compose template → blocks | String-only block refs, 11 categories |
| src/lib/ai/template-definitions.ts | 92 | 48 template definitions | 11 starter + 22 pro + 15 premium |
| src/app/api/templates/seed/route.ts | 161 | Seed templates to DB | v2 mode, batch 10, Promise.allSettled |
| src/collections/Templates.ts | 97 | Payload collection | defaultBlocks JSON, NO pages array field |
| src/lib/rateLimit.ts | 108 | Rate limiting | checkRateLimit(), two-tier, in-memory Map |

## Missing Files
- ❌ src/collections/Subscribers.ts — DOES NOT EXIST (cần tạo)
- ❌ src/app/api/subscribe/route.ts — DOES NOT EXIST (cần tạo)
- ❌ templates_template_pages table — NOT IN db-setup.js (cần migration)

## Key Discoveries (khác plan assumptions)
1. **EditorTemplateModal ĐÃ CÓ warning dialog** — "This will replace your current page layout and theme. This action cannot be undone." → Phase 3 chỉ cần update text, không cần tạo mới
2. **Config variants khác plan**: stats (row/grid/highlight vs numbers/cards/progress-bars), newsletter (inline/popup/banner vs inline/card) → implement theo config.ts, KHÔNG theo plan text
3. **about 'story' variant đã tồn tại** trong config — timeline chính là upgrade cho variant này
