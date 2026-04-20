# Phase 01 — Nav ariaLabel

## Context links
- Parent: [plan.md](plan.md)

## Overview
Date: 2026-04-18
Description: Add `ariaLabel` field vào NavigationConfig + Zod schema + composer buildNavigation() emit default label per category.
Priority: P1
Status: pending

## Key Insights
- Evaluator `navAriaLabel` check: `nav.data.ariaLabel` hoặc any link có `title` attribute
- Simplest path: add ariaLabel on nav block (once), avoid per-link titles
- Default "Main navigation" + category-specific override ("Restaurant navigation", etc.)

## Requirements
- `NavigationConfig.ariaLabel?: string`
- `NavigationConfigSchema` extended với `ariaLabel: z.string().optional()`
- `buildNavigation()` emits `ariaLabel` based on category + biz name
- Render: `<nav aria-label={block.ariaLabel}>` in index.tsx (3 variants)

## Architecture
```ts
// config.ts
export type NavigationConfig = {
  ...
  ariaLabel?: string
}

// index.tsx
<motion.nav aria-label={block.ariaLabel || 'Main navigation'} ...>
```

## Related code files
- `src/blocks/navigation/config.ts` (type + Zod)
- `src/blocks/navigation/index.tsx` (3 variants render nav)
- `src/lib/ai/template-composer.ts:166` (buildNavigation composer)

## Implementation Steps
1. Extend NavigationConfig type + Zod schema
2. buildNavigation: emit `ariaLabel: \`${biz.name} main navigation\`` (e.g., "Farah Glow Studio main navigation")
3. Update 3 nav variants trong index.tsx: motion.nav aria-label prop
4. Regen matrix: `npm run harness:gen`
5. Verify via curl: `curl .../tech-blueprint-tech-cyber-saas-seed0 | grep aria-label`
6. Commit

## Todo list
- [ ] config.ts type + schema
- [ ] buildNavigation composer
- [ ] 3 nav variants aria-label render
- [ ] Regen matrix
- [ ] Verify rendered HTML có aria-label
- [ ] Commit

## Success Criteria
- Rendered `<nav aria-label="...">` visible trong HTML
- Rubric `nav-aria-label` criterion: 0% → 100% pass
- No type errors, no runtime errors

## Risk Assessment
- Low: additive schema change, backward compat

## Security Considerations
- aria-label is user-facing label — no XSS risk (React escapes)

## Next steps
- Phase 02: focusStyle token
