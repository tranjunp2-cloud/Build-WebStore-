# Phase 04 — A5 Thin Block Expansion (Team/CTA/About/Stats/Newsletter/FAQ)

## Context
- Parent: [plan.md](plan.md)
- Research: [researcher-01-a4-a5-scope](research/researcher-01-a4-a5-scope.md)
- Dependencies: Phase 03 (A4) — new variants use A4 primitives

## Overview
- Date: 2026-04-17
- Description: Expand 6 thin-variant blocks để rotation pool có 5-8 choices thay vì 2-4. Mỗi new variant import decorative từ A4 để tránh "same gradient blob". Update Zod enums + switch cases + pool tables + tests.
- Priority: P1
- Implementation status: pending

## Key Insights
- Research đã xác định target counts:
  - team 2 → 6 (+4: cards-hover-reveal, horizontal-scroll, bio-modal, compact-row)
  - cta 4 → 8 (+4: image-bg, split-testimonial, dark-card, mesh-gradient-hero)
  - about 3 → 7 (+4: TBD)
  - stats 3 → 6 (+3)
  - newsletter 3 → 6 (+3)
  - faq 3 → 6 (+3)
- CTA dispatch pattern = switch statement + legacy alias (cta/index.tsx:383) — clean, extend by adding case.
- Pool tables (`category-requirements.ts`) need widen per category từ 3 → up to 6 variants as pool grows.
- `structure-enforcer.ts` cần check — có thể hardcode max variants. Verify trước A5 merge.

## Requirements
### Per block expansion
For each of 6 blocks (team, cta, about, stats, newsletter, faq):
1. Update Zod variant enum trong `config.ts` + `meta.variants`.
2. Implement each new variant component với dispatch case.
3. Update pool table trong `category-requirements.ts` — 14 categories × up to 6 picks.
4. Update variant-pool-validator test (already tests enum↔pool match).
5. Add distribution test case for expanded pool.

### Quality bar per new variant
- ≤ 200 LOC component.
- Import ≥ 1 A4 decorative primitive (from Phase 03).
- Responsive `md:` + mobile-first.
- Accept same props as existing variants (backward compat).
- TypeScript strict.

## Architecture
**Pool table widening strategy**:
```ts
// Before (team):
beauty: ['list', 'grid'],  // pool size 2

// After:
beauty: ['grid', 'bio-modal', 'cards-hover-reveal'],  // pool size 3, can grow to 6
```

Each category gets 3-4 variants (not all 6) để preserve category flavor — e.g., tech prefers grid/compact-row, creative prefers cards-hover-reveal/bio-modal.

**New variant spec (team example)**:
| Variant | Description | A4 primitive |
|---|---|---|
| grid (existing) | 3-col avatars | GradientBlob |
| list (existing) | horizontal list | (none) |
| cards-hover-reveal | bio reveals on hover | LayeredShapes |
| horizontal-scroll | snap-scroll row | GridLines |
| bio-modal | grid + modal on click | NoiseTexture |
| compact-row | dense row w/ avatar + role | (none) |

Similar specs for cta/about/stats/newsletter/faq — document in phase file before code.

## Related code files
Per block (×6):
- `src/blocks/{block}/config.ts` — Zod enum + meta.variants
- `src/blocks/{block}/index.tsx` — switch dispatch + new variant components
- `src/lib/ai/category-requirements.ts` — pool table
- `src/__tests__/unit/ai/variant-pool-validation.test.ts` (no change, already tests ↔ match)
- `src/__tests__/unit/ai/variant-rotation.test.ts` (add new pool coverage)

Plus:
- `src/lib/ai/structure-enforcer.ts` (audit — may need relax max-variants)

## Implementation Steps

### Block-by-block (1.5-2h per block × 6 = 9-12h)
For each block:
1. Design variant spec (30min): write 3-5 line description + wireframe sketch.
2. Update Zod enum (5min).
3. Implement dispatch + component (45-60min).
4. Update pool table (15min).
5. Unit test: render + prop pass (20min).
6. Visual QA: render 1 instance each in Storybook or dev (10min).

### Order
1. **team** (2h) — smallest pool (2→6), biggest relative win.
2. **cta** (1.5h) — already 4, extend to 8. Uses A4 heavily.
3. **stats** (1h), **newsletter** (1h), **faq** (1h) — small extensions.
4. **about** (1.5h) — design 4 new variants first.

### Cross-cutting
- After all 6 blocks done, run `pnpm vitest variant-pool-validation variant-rotation` → expect 6 new entries + distribution pass.
- TSC clean.
- Ensure `structure-enforcer.ts` doesn't reject > 3 variants/category (may need bump).

## Todo list
- [ ] Audit structure-enforcer max-variant constraint
- [ ] Design 4 team variants spec
- [ ] Implement team cards-hover-reveal
- [ ] Implement team horizontal-scroll
- [ ] Implement team bio-modal
- [ ] Implement team compact-row
- [ ] Update team Zod + pool
- [ ] Design + implement 4 cta variants
- [ ] Design + implement 4 about variants
- [ ] Design + implement 3 stats variants
- [ ] Design + implement 3 newsletter variants
- [ ] Design + implement 3 faq variants
- [ ] Update 6 pool tables
- [ ] Run variant-pool-validation (expect clean)
- [ ] Run variant-rotation (expect ≥ 4 distinct per category)
- [ ] Visual QA grid
- [ ] Commit: `feat(f01): A5 thin block expansion — 6 blocks +3-4 variants each`

## Success Criteria
- team enum = 6, cta enum = 8, about enum = 7, stats/newsletter/faq enum = 6.
- Pool tables have ≥ 3 variants per category for all 6 blocks.
- `variant-pool-validation.test.ts` pass (0 enum mismatch).
- `variant-rotation.test.ts` pass with stricter threshold (≥ 4 distinct per category per block).
- Each new variant renders without error in dev + no console warn.
- TSC clean.

## Risk Assessment
- **Risk**: 20 new variant components = 4000+ LOC. Big PR. **Mitigation**: split per-block commits, review incrementally.
- **Risk**: `structure-enforcer.ts` may hardcode "3 variants per category" → reject new pool entries. **Mitigation**: audit first (Q4 unresolved), widen if needed.
- **Risk**: Payload schema drift — Zod enum expand, but Payload block config lags. **Mitigation**: run `node scripts/check-migrations.js origin/staging` before commit (CI gate).
- **Risk**: New variants use A4 decoratives heavy → bundle size. **Mitigation**: lazy-load rare variants via `dynamic()` if > 10KB.
- **Risk**: Mobile responsive untested on new variants. **Mitigation**: manual QA 375px for each before merge.

## Security Considerations
- `bio-modal` variant: if modal renders user HTML, sanitize. Default: plain text bio.
- `horizontal-scroll`: snap-scroll CSS only, no JS, no user input.

## Next steps
- After A5 ship → run 30-site smoke gen, compare Before/After "same-ness" metric.
- Wave 3 (X1-X5) architectural R&D optional if Wave 2 insufficient.
- Consider Wave 2.5: dedicated "hero refresh" phase if user feedback still says hero looks same across sites.
