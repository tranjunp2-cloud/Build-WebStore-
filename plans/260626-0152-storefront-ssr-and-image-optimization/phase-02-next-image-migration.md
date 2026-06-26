# Phase 02 — `<img>` → `next/image` Migration

## Overview
- **Priority:** Medium (Core Web Vitals: LCP, bandwidth)
- **Status:** Pending (chưa implement)
- **Mục tiêu:** Thay `<img>` raw bằng `next/image` `<Image>` toàn storefront → tối ưu ảnh tự động (resize, lazy, srcset, format hiện đại).

## Key insight (giảm rủi ro)
- `next.config.ts` **đã có** `images.remotePatterns: [{ protocol:'https', hostname:'**' }, http://localhost, http://minio]`
  → **KHÔNG cần đổi config**. Mọi ảnh https (S3/CDN) đã được phép tối ưu. Đây là rào cản lớn nhất thường gặp → đã xong sẵn.

## Vấn đề hiện tại
- Nhiều block dùng `<img>` raw → lint cảnh báo `@next/next/no-img-element` (LCP chậm, bandwidth cao, không lazy/srcset).
- Danh sách (enumerate lại khi làm — `grep -rln "<img " src/blocks src/components/site-renderer`):
  footer, product-quick-view, menu-display, products-featured, StorefrontBlogList, portfolio-grid, products-grid, products-show, team, hero/PDP (kiểm tra).

## Độ phức tạp chính
- `<Image>` **bắt buộc** `width`+`height` HOẶC `fill` (+ parent `position:relative` đã sized).
- Ảnh user-upload → **không biết kích thước** → dùng `fill` + parent có aspect ratio + `object-cover` + `sizes`.
- Sai → **layout shift** / ảnh vỡ tỉ lệ. Cần test visual từng block.

## Hướng tiếp cận
1. **Enumerate** mọi `<img>` trong `src/blocks` + `src/components/site-renderer`.
2. Phân loại mỗi chỗ:
   - **Kích thước cố định** (avatar, logo, thumbnail vuông) → `<Image width h>`.
   - **Responsive/fill container** (hero, card cover, gallery) → `<Image fill>` + parent `relative` + `aspect-*` + `object-cover` + `sizes`.
3. **`priority`** cho ảnh above-the-fold (hero / LCP candidate); còn lại `loading="lazy"` (mặc định Image).
4. `sizes` hợp lý theo layout (vd `(max-width:768px) 100vw, 33vw` cho grid-3).
5. Giữ nguyên `alt` (SEO + a11y) — nhiều `<img>` đã có alt.

## Related Code Files (enumerate khi làm)
- `src/blocks/footer/index.tsx`, `product-quick-view/index.tsx`, `menu-display/index.tsx`,
  `products-featured/index.tsx`, `products-grid/index.tsx`, `products-show/index.tsx`,
  `portfolio-grid/index.tsx`, `team/index.tsx`
- `src/components/site-renderer/StorefrontBlogList.tsx`
- PDP `products/[productSlug]/page.tsx` (ảnh gallery — kiểm tra)

## Success Criteria
- 0 cảnh báo `no-img-element` ở các block đã migrate.
- Không layout shift (CLS ~0) — test mobile + desktop, light + dark.
- LCP cải thiện trên trang nhiều ảnh (đo Lighthouse trước/sau).
- Ảnh remote (S3) load + optimize đúng (không 400/broken).

## Risk Assessment
- **Layout shift / vỡ tỉ lệ** nếu fill/parent sai → test visual từng block (screenshot before/after).
- **Ảnh remote optimize lỗi** (rất hiếm vì remotePatterns `**`) → kiểm tra vài host S3 thật.
- **`fill` cần parent positioned** → dễ quên → review kỹ.
- Làm **theo nhóm nhỏ** (vài block/PR) để dễ review visual, đừng đổi 10 file 1 lần.

## Todo
- [ ] Enumerate toàn bộ `<img>`
- [ ] Phân loại fixed-size vs fill
- [ ] Migrate theo nhóm (vd: product blocks → 1 nhóm; team/footer/blog → nhóm khác)
- [ ] `priority` cho hero/LCP, `sizes` responsive
- [ ] Test visual light/dark/mobile + đo LCP/CLS
- [ ] code-reviewer

## Next Steps
- Độc lập phase-01. Ưu tiên nếu cần cải thiện Core Web Vitals / điểm Lighthouse.
