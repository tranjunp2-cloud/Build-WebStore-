# Phase 01 — Variant Wiring (scope sửa lại 2026-04-15)

## Context
- Parent: [plan.md](plan.md)
- Dependencies: none (blocker for phases 03-07)
- Related: [researcher-02 F1 + correction](research/researcher-02-gen-flow-output.md)

## Overview
- Date: 2026-04-15
- Description: Mở rộng pattern rotation sẵn có (đang chạy cho hero + nav + contact + footer) để phủ thêm ~45 block types còn lại — features, pricing, testimonials, about, cta, stats, newsletter, team, faq, gallery, service-cards, v.v. Pattern đã có, chỉ cần thêm pool + gọi rotate.
- Priority: P0
- Implementation status: pending
- Review status: pending

## Key Insights (sửa lại)
- **Pattern sẵn có**: `rotateStructuralVariants` trong `src/lib/ai/template-composer.ts:1398-1419` — duyệt mọi page + override `block.variant` bằng `seededShufflePick(pool, seed ^ hashString(salt))`. Gọi ở dòng 1869 trong `composeTemplateFromPreset`.
- **Pool sẵn có**: `src/lib/ai/category-requirements.ts` có 3 tables — `NAV_VARIANT_BY_CATEGORY`, `CONTACT_VARIANT_BY_CATEGORY`, `FOOTER_VARIANT_BY_CATEGORY`. Mỗi table 14 categories × 3 variants.
- **Hero** có pattern riêng qua `CATEGORY_HERO_VARIANTS` trong composer (dòng 187).
- **45 blocks còn lại** hardcode variant: `buildFeatures:'grid-3'`, `buildGallery:'grid'`, `buildTestimonials:...`, v.v. Không có pool.
- **Fix = mở rộng pattern**: thêm 10-12 pool tables mới (features, pricing, testimonials, about, cta, stats, newsletter, team, faq, gallery) vào `category-requirements.ts`, extend `rotateStructuralVariants` pools array thêm 10-12 entry. KHÔNG phải viết hook mới, KHÔNG phải dead code — pattern đang chạy.

## Requirements
- Mọi block type được rotate đều nhận variant deterministic theo seed + category.
- Cùng seed → cùng variant (ổn định khi regen).
- Pool theo category phản ánh khẩu vị ngành (ví dụ features `icon-left` + `zigzag` hợp tech; `carousel` hợp creative; `grid-2/3/4` phổ thông).
- Không đụng hero (đã hoạt động).
- Không đụng nav/contact/footer (đã hoạt động qua `rotateStructuralVariants`).
- Debug log mỗi lần rotate: `console.debug('[composer] rotate=X category=Y variant=Z seed=S')` để đo phân bố.

## Architecture
Mở rộng `category-requirements.ts`:
- Thêm `FEATURES_VARIANT_BY_CATEGORY`, `PRICING_VARIANT_BY_CATEGORY`, `TESTIMONIALS_VARIANT_BY_CATEGORY`, `ABOUT_VARIANT_BY_CATEGORY`, `CTA_VARIANT_BY_CATEGORY`, `STATS_VARIANT_BY_CATEGORY`, `NEWSLETTER_VARIANT_BY_CATEGORY`, `TEAM_VARIANT_BY_CATEGORY`, `FAQ_VARIANT_BY_CATEGORY`, `GALLERY_VARIANT_BY_CATEGORY`, `SERVICE_CARDS_VARIANT_BY_CATEGORY` — mỗi table 14 category × 3 variants.

Mở rộng `rotateStructuralVariants` trong `template-composer.ts:1398`:
- Thêm 10-12 entry vào `pools` array, mỗi entry `{ blockType, pool, salt }`.
- Vòng lặp override `block.variant` đã có sẵn, không cần sửa logic.

Không cần thêm function mới, không cần thay đổi builder signatures, không thread seed xuống từng `buildX`. Rotate chạy sau khi composer build xong toàn bộ pages.

## Related code files
- `src/lib/ai/template-composer.ts` (dòng 1398-1419 `rotateStructuralVariants`, dòng 1869 call site)
- `src/lib/ai/category-requirements.ts` (dòng 133-200+ các pool tables)
- `src/lib/ai/seeded-random.ts` (`seededShufflePick`, `hashString` — đã có)
- `src/blocks/*/index.tsx` (để inventory tên variant hợp lệ mỗi block)

## Implementation Steps
1. Inventory tên variant hợp lệ cho 11 blocks còn thiếu: đọc `src/blocks/{features,pricing,testimonials,about,cta,stats,newsletter,team,faq,gallery,service-cards}/config.ts` (hoặc index.tsx nếu config không có) — lấy Zod enum `variant` làm source of truth.
2. Viết 11 pool tables mới trong `category-requirements.ts`, mỗi table 14 category × 3 variants phù hợp. Dùng cùng cấu trúc `Readonly<Record<string, string[]>>`.
3. Mở rộng `pools` array trong `rotateStructuralVariants` thêm 11 entry. Salt format `'${blockType}${category}'` giống 3 entry hiện có.
4. Thêm `console.debug` log trong vòng `for` của rotate để đo phân bố variant.
5. Smoke test: gen 5 site cùng category × 5 seed khác nhau → grep log → confirm variant distribution phủ ≥ 80% pool per block type.
6. Check regen stability: gen 2 lần cùng seed → log ra cùng variants.

## Todo list
- [ ] Grep block dispatchers for valid variant names
- [ ] Define CATEGORY_X_VARIANTS for 15 blocks
- [ ] Update builder signatures to accept seed
- [ ] Swap hardcoded variants for selectVariantBySeed
- [ ] Add debug logging
- [ ] Regen-stability test (same seed → same output)
- [ ] Distribution test (10 seeds → variant histogram)

## Success Criteria
- 15 blocks use `selectVariantBySeed` (grep-able assertion).
- 10 seeds × 5 categories → ≥ 80% variant utilization per block.
- Regen w/ same seed produces identical variant selection.

## Risk Assessment
- **Risk**: invalid variant name silently falls through to block's default case → rendering bug. **Mitigation**: type `CATEGORY_X_VARIANTS` values as literal union of block's actual variant names.
- **Risk**: existing stored templates reference hardcoded variants → regen mismatch. **Mitigation**: phase only affects NEW generations; existing sites unaffected.

## Security Considerations
None — read-only variant selection, no new user input.

## Next steps
Phases 03/04/05 consume variant rotation infra. Phase 02 runs in parallel.
