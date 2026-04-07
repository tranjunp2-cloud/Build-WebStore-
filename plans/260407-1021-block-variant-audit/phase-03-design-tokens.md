---
phase: 03
title: "Design Token Compliance"
effort: ~2h
status: pending
depends_on: phase-02
---

# Phase 03: Design Token Compliance

## Context
- Parent plan: [plan.md](./plan.md)
- 6/14 blocks khong import `CSS_VARS` (about, faq, newsletter, stats, team, cta)
- Raw `var()` strings de bi typo, khong co fallback

## Overview
Chuan hoa 14 blocks import va su dung CSS_VARS constant object.

## Requirements
- 14/14 blocks import CSS_VARS
- Replace raw var() strings bang CSS_VARS references
- Remove duplicated local SectionLabel trong about block
- No visual regression (CSS output identical)

## CSS_VARS Object (resolve.ts:203-235)
```
primary, secondary, accent, surface, text, muted, background
primaryRgb, secondaryRgb, accentRgb
fontHeading, fontBody
spaceXs → space2xl, sectionPadding
radiusSm/Md/Lg/Full, shadowSm/Md/Lg
```

## Related Files
- `src/lib/theme/resolve.ts:203-235` — CSS_VARS definition
- `src/blocks/about/index.tsx` — no CSS_VARS + local SectionLabel
- `src/blocks/faq/index.tsx` — no CSS_VARS
- `src/blocks/newsletter/index.tsx` — no CSS_VARS
- `src/blocks/stats/index.tsx` — no CSS_VARS
- `src/blocks/team/index.tsx` — no CSS_VARS
- `src/blocks/cta/index.tsx` — no CSS_VARS

## Implementation Steps

Per block (6 blocks):
1. Add `import { CSS_VARS } from '@/lib/theme/resolve'`
2. Replace `"var(--brand-primary)"` → `CSS_VARS.primary`
3. Replace `"var(--font-heading)"` → `CSS_VARS.fontHeading`
4. Replace `"var(--text)"` → `CSS_VARS.text`, etc.
5. about: remove local SectionLabel, import from `../shared/decorative`

Then audit remaining 8 blocks for mixed usage.

## Todo
- [ ] about: import CSS_VARS + remove local SectionLabel
- [ ] faq: import CSS_VARS, replace raw var()
- [ ] newsletter: import CSS_VARS, replace raw var()
- [ ] stats: import CSS_VARS, replace raw var()
- [ ] team: import CSS_VARS, replace raw var()
- [ ] cta: import CSS_VARS, replace raw var()
- [ ] Audit 8 blocks already importing CSS_VARS for mixed usage
- [ ] Verify no visual regression

## Success Criteria
- 14/14 blocks import CSS_VARS
- `grep -r "var(--brand-primary)" src/blocks/` returns 0 hits (inline styles only)
- No visual changes

## Risk Assessment
- **Low**: Pure refactor, CSS output identical
