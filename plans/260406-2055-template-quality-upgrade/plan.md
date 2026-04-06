---
title: "Template Quality Upgrade"
description: "Fix stub blocks, expand tokens, randomize composition, create 30 distinct templates"
status: pending
priority: P1
effort: 5.5d
branch: staging-2
tags: [templates, quality, design-tokens, blocks]
created: 2026-04-06
---

# Template Quality Upgrade — Consolidated Plan

## Problem
48 templates nhin giong nhau vi: stub blocks (23 lines vs 855 lines hero), chi 2 color tokens thuc su anh huong layout, deterministic composition (cung category = cung block order), placeholder images xam.

## 6 Phases (5.5d total)

| Phase | Task | Effort | Impact |
|-------|------|--------|--------|
| 01 | Fix stub blocks (stats 3v, team 3v, newsletter 2v) | 1d | HIGH — xoa bo 80%+ templates nhin "cheap" |
| 02 | Design token expansion (tokens da co trong types.ts, can blocks su dung) | 1d | HIGH — templates co the nhin khac nhau |
| 03 | Randomize composition (block order + optional blocks + variant selection) | 0.5d | MEDIUM — cung category != cung layout |
| 04 | 30 distinct template presets (unique block combo + theme + variant) | 1.5d | HIGH — visual diversity that thu giai |
| 05 | Multi-page templates (About/Services/Contact per category) | 1d | MEDIUM — professional/premium co nhieu page |
| 06 | Real images + polish (Unsplash URLs, real stats, content) | 0.5d | MEDIUM — xoa placeholder xam |

## Key Code Files
- `src/blocks/stats/index.tsx` (23 lines — STUB)
- `src/blocks/team/index.tsx` (24 lines — STUB)
- `src/blocks/newsletter/index.tsx` (18 lines — STUB)
- `src/blocks/types.ts` (ThemeConfig — da co 6 colors + spacing + radius + shadow)
- `src/lib/theme/resolve.ts` (CSS vars — da co spacing/radius/shadow presets)
- `src/lib/ai/template-composer.ts` (1k lines — deterministic composition)
- `src/lib/ai/template-definitions.ts` (48 templates — can 30 presets moi)
- `src/lib/ai/theme-presets.ts` (55 presets — da co spacing/radius/shadow)

## Important Discovery
ThemeConfig VA theme-presets.ts DA CO 6 colors, spacing, radius, shadow.
Van de CHINH: **blocks khong su dung** cac tokens nay. Chi dung `theme.primaryColor`.
Phase 02 focus vao update 51 blocks de dung tokens, KHONG phai add tokens moi.

## Execution Order
Phase 01 → 02 co the parallel. Phase 03 → 04 sequential. Phase 05, 06 independent.

## Success Criteria
- [ ] Stats/Team/Newsletter co 3/3/2 variants, moi variant >80 lines JSX
- [ ] >20 blocks su dung spacing/radius/shadow CSS vars
- [ ] 30 template presets co visual fingerprint rieng (unique block combo + theme)
- [ ] Same category cho ra >3 layouts khac nhau
- [ ] 0 placehold.co URLs trong templates
