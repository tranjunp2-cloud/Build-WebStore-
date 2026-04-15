# Phase 06 — Image Pool Coverage

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Phase 01, 02
- Related: [researcher-02 F3](research/researcher-02-gen-flow-output.md)

## Overview
- Date: 2026-04-15
- Description: Expand `BLOCK_IMAGE_SPEC` from 7 to 15+ block types. Kill hardcoded `placehold.co` URLs in composer. Ensure all visual blocks receive real images from pool or sensible fallback.
- Priority: P1
- Implementation status: pending
- Review status: pending

## Key Insights
- `src/lib/ai/media-injector.ts` `BLOCK_IMAGE_SPEC` covers only 7 blocks: hero, about, gallery, portfolio-grid, team, testimonials, logo-cloud.
- Missing coverage (13+): features, services, cta, banner, video-background, products-grid, property-card, doctor-profile, event-card, case-study, before-after, stats, timeline, pricing, faq, blog-posts, press, partners, map.
- Composer hardcodes `placehold.co/600x400/e2e8f0/64748b` gray boxes for gallery (template-composer.ts:567-573) — falls through to gray placeholder if pool fails.
- Hero currently uses same image for `image` + `backgroundImage` (media-injector.ts:119-132). Should sample 2 distinct images.

## Requirements
- `BLOCK_IMAGE_SPEC` covers ≥ 15 blocks: hero, about, gallery, portfolio-grid, team, testimonials, logo-cloud, features, services, cta, case-study, event-card, property-card, doctor-profile, products-grid, timeline, blog-posts.
- Each spec entry: `fields: string[]`, `role: ImageRole`, `minCount: number`, `aspect?: string`.
- Remove all `placehold.co` URL emissions from composer.
- Block components have sensible `<Image src={block.image?.url ?? INDUSTRY_FALLBACK} />` fallback chain.
- Hero uses 2 distinct images for `image` vs `backgroundImage`.

## Architecture
Extend `BLOCK_IMAGE_SPEC` in `media-injector.ts`. Extend `roleForBlock()` in `image-pool.ts` to map new block types → roles. Fallback chain in block components: `block.image?.url → ctx.industryFallback → neutral gray inline SVG data URL (not external)`.

## Related code files
- `src/lib/ai/media-injector.ts` (BLOCK_IMAGE_SPEC table)
- `src/lib/ai/image-pool.ts` (roleForBlock, batchFetchFromPool)
- `src/lib/ai/template-composer.ts:567-573` (placehold.co — remove)
- `src/blocks/*/index.tsx` (add Image fallback chain)

## Implementation Steps
1. Read current `BLOCK_IMAGE_SPEC` and `roleForBlock`.
2. Add 8 new block type entries to spec + role map.
3. Remove `placehold.co` from composer gallery builder.
4. Add inline SVG data-URL fallback (no external placeholder).
5. Audit block components (features, services, cta, etc.) for Image fallback chain.
6. Hero: sample 2 distinct images from pool.
7. Regen 5 sites × category; verify 0 placehold.co + 0 empty image slots.

## Todo list
- [ ] Audit current BLOCK_IMAGE_SPEC
- [ ] Add 8 block types
- [ ] Extend roleForBlock mapping
- [ ] Remove placehold.co from composer
- [ ] Inline SVG fallback
- [ ] Block component Image fallback chain audit
- [ ] Hero dual-image sampling
- [ ] Regen verification

## Success Criteria
- ≥ 15 blocks in BLOCK_IMAGE_SPEC.
- 0 `placehold.co` grep matches in composer output.
- 0 empty image slots in generated sites (visual QA).
- Hero uses 2 distinct images.

## Risk Assessment
- **Risk**: pool pre-fetch size grows → slower gen. **Mitigation**: parallelize `batchFetchFromPool`; cache per category.
- **Risk**: Unsplash rate limit. **Mitigation**: existing cache; add exponential backoff.

## Security Considerations
- Validate image URLs are from whitelisted CDN (Unsplash, Payload media, own S3).

## Next steps
Parallel with 04, 05. Phase 07 consumes clean image data.
