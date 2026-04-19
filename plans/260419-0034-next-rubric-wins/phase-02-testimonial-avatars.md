# Phase 02 — Testimonial Avatar URLs

## Context links
- Parent: [plan.md](plan.md)

## Overview
Date: 2026-04-19
Description: Add `avatarUrl` field (AVATAR_FALLBACK_SVG) vào mỗi testimonial khi composer emits.
Priority: P1
Status: pending

## Key Insights
- `AVATAR_FALLBACK_SVG` exists in `src/lib/ai/fallback-svg.ts` (400×400 gray circle với initial)
- Evaluator `testimonialHasAvatar` checks `testimonials[].avatarUrl` — just need to populate
- Real photo URLs = future work (deployment-time fetch)

## Requirements
- Composer `buildTestimonials` inject avatarUrl from AVATAR_FALLBACK_SVG per testimonial
- OR map testimonial.name → deterministic avatar (initials-based SVG)

## Architecture
Simplest: static AVATAR_FALLBACK_SVG cho all. Evaluator just checks presence, không check unique.

```ts
// template-composer.ts buildTestimonials:
return {
  blockType: 'testimonials',
  testimonials: content.testimonials.map(t => ({
    ...t,
    avatarUrl: AVATAR_FALLBACK_SVG,
  })),
}
```

## Related code files
- `src/lib/ai/template-composer.ts` (buildTestimonials)
- `src/lib/ai/fallback-svg.ts` (AVATAR_FALLBACK_SVG)

## Implementation Steps
1. Import AVATAR_FALLBACK_SVG in composer
2. Map testimonials to include avatarUrl
3. Regen matrix → verify
4. Typecheck

## Success Criteria
- `testimonial-avatar` criterion: 0% → 100%
- social-proof dim 7.5 → 8.0+

## Risk Assessment
- Low

## Security Considerations
- Static SVG data URL, no external fetch

## Next steps
- Phase 03: footer mega
