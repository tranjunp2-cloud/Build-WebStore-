# Phase 03 — Content Library Rotation + Gap-Fill Seed

## Context links
- **Parent**: [plan.md](./plan.md)
- **Fixes**: R4 (buildBlockFromLibrary hardcode businesses[0]), R5 (padItems 5-sample pool)
- **Dependencies**: Phase 01 (seeded-random.ts helper)
- **Research**: [researcher-01 §4-5](./research/researcher-01-block-variant-similarity.md), [researcher-02 §4](./research/researcher-02-theme-content-similarity.md)

## Overview
- **Date**: 2026-04-14
- **Description**: `content-injection.ts:66` hardcode `content.businesses[0]` cho gap-fill injection → mọi missing block inject identical content. `padItems` dùng 5-sample pool → testimonials/FAQs lặp cross-gen. Phase này: (1) rotate businessIndex theo seed, (2) mở rộng content library từ 5 → 8 samples/category, (3) enforce seed propagation vào tất cả library lookups.
- **Priority**: P1
- **Implementation status**: pending
- **Review status**: not reviewed
- **Effort**: 2h

## Key Insights
- `buildBlockFromLibrary(blockType, category, ctx)` có `ctx.seed` nhưng không dùng khi pick `businesses[0]` → bug thực sự
- 5 sample/cat = không đủ; thêm 3 nữa cho mỗi category = 42 new samples (hand-write or AI-bootstrap)
- Testimonial reuse = user dễ nhận ra (tên "John Smith" xuất hiện ở 2 site khác nhau cùng category)

## Requirements
- `buildBlockFromLibrary` dùng `pickSeeded(businesses, ctx.seed)` thay vì `businesses[0]`
- `padItems` rotate starting index theo seed, tránh always start from index 0
- Content library mỗi category có ≥8 `BusinessSample` entries
- Testimonials/FAQs mỗi `BusinessSample` có ≥5 entries (hiện có 2-3)
- Dedup guard: khi padItems từ library, không pick trùng với items AI đã gen (dedup by lowercase title/quote)

## Architecture

### Decisions
- **Seed propagation**: `buildBlockFromLibrary(blockType, category, ctx)` đã có `ctx.seed`; chỉ cần xài. Replace all `businesses[0]` với `pickSeeded(content.businesses, ctx.seed ?? 0)`.
- **Library expansion**: Script `scripts/bootstrap-content-library.ts` (optional) dùng GPT-4 để draft 3 new businesses/category → hand-review top 3 → commit. Fallback: hand-write 42 entries trong 1-2h.
- **padItems rotation**: `pickSeeded(arr, seed + index)` để mỗi padding slot pick khác nhau, không cluster.
- **Dedup guard**: Pre-compute `Set(existing.map(lowercaseKey))`, skip candidate nếu duplicate, try next.

### Trade-offs
- **Pro**: Users thấy testimonials/FAQs khác nhau → feel authentic
- **Con**: 42 new samples = manual content work. Có thể defer nếu sprint tight, phase vẫn ship được với library cũ nhưng ít impact hơn.

## Related code files
- `src/lib/ai/content-injection.ts:56-288` (buildBlockFromLibrary, businesses[0] hardcode)
- `src/lib/ai/content-injection.ts:294-358` (padItems)
- `src/lib/ai/content/*.ts` (14 category files — expand)
- `src/lib/ai/content/types.ts` (BusinessSample type)
- `src/lib/ai/structure-enforcer.ts` (call sites passing seed)

## Implementation Steps
1. Replace `content.businesses[0]` với `pickSeeded(content.businesses, ctx.seed ?? 0)` trong `buildBlockFromLibrary` (~10 call sites trong switch)
2. Update `pickSeeded` import trong content-injection.ts (helper đã có local)
3. Add `seed` propagation trong structure-enforcer call sites
4. Refactor `padItems` để dùng `pickSeeded(arr, seed + i)` thay vì sequential
5. Add dedup guard: pre-build `seenKeys` Set từ existing items, skip candidates collision
6. Expand 14 category content files: +3 businesses × 14 = 42 new samples (hand-write hoặc AI-draft)
7. Per BusinessSample, ensure testimonials/faqs ≥5 entries (expand existing ones nếu thiếu)
8. Unit test: `src/__tests__/unit/lib/ai/content-rotation.test.ts` — 10 seeds × beauty category → ≥5 distinct businesses picked, no testimonial text collision >30%

## Todo list
- [ ] Fix businesses[0] hardcode in buildBlockFromLibrary
- [ ] Propagate seed through structure-enforcer → content-injection
- [ ] Refactor padItems with seed rotation
- [ ] Add dedup guard in padItems
- [ ] Expand 14 category files (+3 businesses each)
- [ ] Expand testimonials/faqs per sample to ≥5
- [ ] Unit test content rotation
- [ ] Run full AI test suite

## Success Criteria
- Unit test: 10 distinct seeds → ≥5 distinct business picks
- Testimonial collision rate <30% across 10 same-category gens
- Content library: 14 categories × ≥8 businesses each
- 455 existing AI unit tests pass

## Risk Assessment
- **Content quality drift**: AI-bootstrap samples có thể hơi generic. Mitigation: hand-review before commit, edit for brand voice.
- **Sample imbalance**: Nếu 1 category có 8 samples nhưng khác có 5 → distribution uneven. Mitigation: enforce same count across categories.
- **Schema drift**: BusinessSample type extension (nếu cần) có thể break existing loaders. Mitigation: optional fields, backward compat.

## Security Considerations
- N/A — static content, no user input path

## Next steps
- Sibling plan 2249 Phase 01 (user data threading) sẽ merge user-provided data lên trên rotated sample — coordinate merge order: thread user data → fallback to rotated library
- Phase 04 harness measure content collision rate as metric
