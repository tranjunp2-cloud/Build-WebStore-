---
phase: 01
title: "Code Audit — Variant Rendering Matrix"
effort: ~2h
status: pending
---

# Phase 01: Code Audit

## Context
- Parent plan: [plan.md](./plan.md)
- 14 blocks, 77 total variants
- Mot so variants duoc define trong config.ts nhung khong co branch rieng trong index.tsx

## Overview
Doc tat ca 14 index.tsx files, xay dung audit matrix cho tung variant.

## Requirements
- Moi variant co entry trong matrix: UNIQUE / FALLTHROUGH / DEAD
- CSS_VARS import status per block
- Responsive breakpoint coverage (sm/md/lg)
- Accessibility check (headings, alt text, aria)

## Audit Matrix (Preliminary)

### Blocks voi Clean Routing (0 issues)
| Block | Variants | Pattern | CSS_VARS |
|-------|----------|---------|----------|
| stats (3) | row, grid, highlight | Named functions + switch | NO |
| team (2) | grid, list | Named functions + switch | NO |
| newsletter (3) | inline, popup, banner | Named functions + switch | NO |
| about (3) | simple, split, story | Named functions + switch | NO |
| faq (3) | accordion, grid, simple | Named functions + switch | NO |
| cta (3) | banner, inline, floating | Named functions + switch | NO |

### Blocks voi Dead/Fallthrough Variants
| Block | Variant | Status | Notes |
|-------|---------|--------|-------|
| hero | video | DEAD | No branch, falls to centered |
| gallery | masonry | FALLTHROUGH | Same as grid default |
| gallery | carousel | FALLTHROUGH | Same as grid default |
| navigation | centered | FALLTHROUGH | Same as simple |
| navigation | mega-menu | FALLTHROUGH | Same as simple |
| testimonials | carousel | FALLTHROUGH | Same as cards |
| testimonials | simple | FALLTHROUGH | Same as cards |
| pricing | table | FALLTHROUGH | Same as cards |
| footer | expanded | FALLTHROUGH | Same as simple |
| footer | minimal | FALLTHROUGH | Same as simple |
| features | grid-2/grid-3/grid-4/list | NEAR-IDENTICAL | Differ only by grid class |

## Related Files
- `src/blocks/*/index.tsx` — 14 component files
- `src/blocks/*/config.ts` — 14 config files
- `src/lib/theme/resolve.ts:203-235` — CSS_VARS constant
- `src/blocks/shared/` — animations.tsx, decorative.tsx

## Implementation Steps
1. Tao audit spreadsheet cho 14 blocks x variants
2. Doc config.ts lay danh sach variants
3. Doc index.tsx tim conditional branches (if/switch)
4. Map variant → branch existence
5. Check CSS_VARS import + raw var() usage
6. Check responsive classes
7. Check accessibility patterns
8. Output: completed audit matrix

## Todo
- [ ] Complete audit matrix cho hero (12 variants)
- [ ] Complete audit matrix cho features (8 variants)
- [ ] Complete audit matrix cho testimonials (8 variants)
- [ ] Complete audit matrix cho pricing (8 variants)
- [ ] Complete audit cho gallery, navigation, contact, footer (6 each)
- [ ] Complete audit cho stats, team, newsletter, about, faq, cta

## Success Criteria
- Matrix co 77 rows (1 per variant)
- Moi row co verdict: UNIQUE / FALLTHROUGH / DEAD
- Design token + responsive + a11y status per variant

## Risk Assessment
- **Low**: Read-only phase, khong thay doi code
