# Phase 02 — Theme Preset + Font Pair Expansion

## Context links
- **Parent**: [plan.md](./plan.md)
- **Fixes**: R3 (5 presets/category, modulo-5 hash clustering), R6 (17 fontPairingId → 10 unique pairs)
- **Dependencies**: none — independently shippable
- **Research**: [researcher-02-theme-content-similarity.md §1-2](./research/researcher-02-theme-content-similarity.md)

## Overview
- **Date**: 2026-04-14
- **Description**: Mở rộng `theme-presets.ts` từ 5 → 8 presets/category (14×8=112 presets), đảm bảo mỗi preset dùng `fontPairingId` unique (dedupe 17→14+ pairs), đổi `pickCategoryTheme` từ modulo hash sang seeded Fisher-Yates shuffle để phân bố đều hơn.
- **Priority**: P1
- **Implementation status**: pending
- **Review status**: not reviewed
- **Effort**: 2h

## Key Insights
- Modulo-5 hash clustering = djb2 output biased về low indices cho common English/Vietnamese business names (observed: "Farah", "Priya", "Zen" → idx 0,1,2)
- 5 presets × 14 cats = đủ theme *quantity* nhưng `fontPairingId` reuse trong cùng category làm 2 preset khác màu nhưng cùng font → visually blend
- Fisher-Yates shuffle với seed cho distribution đều hơn modulo

## Requirements
- Mỗi category có ≥8 `ThemePreset` entries
- Mỗi category có ≥5 unique `(fontHeading, fontBody)` combos
- `pickCategoryTheme(category, seed)` dùng seeded shuffle, output distribution entropy ≥2.5 bits cho 20 seeds
- Backward compat: existing sites vẫn render với preset cũ nếu tên trùng

## Architecture

### Decisions
- **Preset expansion**: Thêm 3 preset/category × 14 categories = 42 presets mới. Mỗi preset pick 1 (primary, secondary, accent) từ design-tokens color palette + `fontPairingId` unique nhất có thể. Hand-curate, không AI-generate.
- **Font pair dedupe**: Audit `font-pairings.ts` 17 IDs. Xóa duplicates hoặc thay fontBody/fontHeading để có 14+ unique pairs. Add 3-5 new pairs nếu thiếu (dùng Google Fonts có sẵn như Fraunces+Inter, Bricolage Grotesque+Lora, etc.)
- **Fisher-Yates seeded pick**: Đổi `pickCategoryTheme`:
  ```ts
  const rng = createSeededRandom(seed)
  const shuffled = [...presets]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled[0]
  ```

### Trade-offs
- **Pro**: +60% preset diversity, no prompt token cost (presets injected post-parse)
- **Con**: Hand-curating 42 presets = ~1h manual work
- **Con**: Fisher-Yates first-of-shuffled ≡ `rng() % length` mathematically, nhưng xor với compound seed cho distribution tốt hơn modulo-only

## Related code files
- `src/lib/ai/theme-presets.ts` (expand from ~160 lines → ~270 lines)
- `src/lib/ai/font-pairings.ts` (audit 17 IDs, dedupe/add)
- `src/lib/ai/category-theme-picker.ts:42-48` (pickCategoryTheme)
- `src/lib/ai/seeded-random.ts` (from Phase 01, reuse createSeededRandom)

## Implementation Steps
1. Audit `font-pairings.ts`: list 17 IDs → (heading, body). Identify duplicates. Add 3-5 new pairs. Ensure 14+ unique output.
2. For each category in `theme-presets.ts`, add 3 new `ThemePreset` entries — pick color trio from `src/lib/ai/content-safety.ts` palette inspiration + unique fontPairingId + mode (mix light/dark)
3. Verify `CATEGORY_PRESETS` export still indexes all 14 categories → each has ≥8 presets
4. Refactor `pickCategoryTheme` dùng `seededShuffle` helper từ Phase 01
5. Unit test: `src/__tests__/unit/lib/ai/theme-preset-distribution.test.ts` — 20 seeds × 14 categories → entropy ≥2.5 bits, no index >25% share
6. Manual visual sanity: run `scripts/preview-theme-presets.ts` (if exists) hoặc JSON dump để verify colors không clash

## Todo list
- [ ] Audit font-pairings.ts, dedupe to 14+ unique
- [ ] Add 3 presets per category (42 total)
- [ ] Refactor pickCategoryTheme to seeded shuffle
- [ ] Unit test distribution entropy
- [ ] Visual sanity check (JSON dump + compare in browser)
- [ ] Run full AI test suite

## Success Criteria
- `theme-presets.ts`: every category has ≥8 presets
- `font-pairings.ts`: ≥14 unique (heading, body) tuples
- Distribution test: 20 seeds → no single preset >25% share per category
- 455 existing AI unit tests pass

## Risk Assessment
- **Color clash**: Hand-curating 42 colors có thể tạo ugly combos. Mitigation: reference `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` palette guide, cross-check with 60-30-10 rule.
- **Font loading performance**: Thêm font pairs → thêm Google Fonts imports → slower LCP. Mitigation: use `next/font/google` subsetting, measure LCP delta.
- **Backward compat**: Existing sites have theme saved with old `fontPairingId`. Renaming IDs breaks them. Mitigation: chỉ ADD new IDs, không rename existing ones.

## Security Considerations
- N/A — static data, no user input

## Next steps
- Sibling plan 2249 Phase 02 (theme moods) sẽ bundle mood/voice/CTA vào các preset mới sinh ra ở phase này — coordinate để không overwrite preset count
- Phase 04 variety harness dùng distribution test làm regression guard
