# Phase 01 — SSR Product Grid

## Overview
- **Priority:** Medium (SEO internal-link signal)
- **Status:** Pending (chưa implement)
- **Mục tiêu:** Product list render server-side → cards + link PDP nằm trong HTML đầu, không chỉ sau hydration.

## Vấn đề hiện tại
- `src/blocks/products-grid/index.tsx` + `src/blocks/products-featured/index.tsx` là `'use client'`,
  fetch `/api/storefront/products?site={id}&limit={n}&sort=-createdAt` trong `useEffect` → render `loading` state SSR, data chỉ có sau hydration.
- Hệ quả SEO: link `/products/{slug}` không có trong HTML đầu (bot phải render JS mới thấy). Sitemap đã bù discovery nhưng internal-link signal yếu.

## Độ phức tạp chính (đọc kỹ trước khi code)
- Block render ở **2 ngữ cảnh**:
  1. **Storefront** — server component (`SiteRenderer`/`SiteLayoutShell`), có `site` + payload context.
  2. **Editor iframe** — client, dùng in-memory `editorStore` state, KHÔNG có server round-trip.
- Block hiện fetch client-side để chạy được ở **cả hai**. SSR-ing phải xử lý: storefront lấy data server-side, editor vẫn lấy preview client-side.

## Hướng tiếp cận (đề xuất)
**Split block: server-data + client-interactive.**
- Tách phần fetch+render cards thành **server component** (storefront) nhận `products` qua props (fetch ở `SiteRenderer` hoặc 1 server loader theo `site.id`).
- Phần tương tác (add-to-cart, editor-intercept, hover state) giữ ở client sub-component.
- Editor: giữ nhánh client-fetch (preview) — phát hiện ngữ cảnh qua flag `isEditor`/`isEditorIframe` đã có trong `SiteRenderer`.
- "View Detail" đã là `<Link>` (làm ở nhánh soft-nav) → giữ.

## Cần điều tra khi bắt đầu
1. Cách block nhận props ở storefront vs editor (`blockRegistry`, `SiteRenderer` truyền gì).
2. Logic trong `/api/storefront/products/route.ts` → tái dùng cho server fetch (DRY, đừng viết lại query).
3. `products-featured` có cùng pattern → áp cùng cách.
4. Pagination/limit, sort, filter (category?) hiện có.

## Related Code Files
- `src/blocks/products-grid/index.tsx` (sửa)
- `src/blocks/products-featured/index.tsx` (sửa, cùng pattern)
- `src/app/api/storefront/products/route.ts` (đọc — tái dùng query logic)
- `src/components/site-renderer/SiteRenderer.tsx` (đọc — cách inject data + flag editor)
- Có thể tạo: `src/lib/storefront/load-products.ts` (server loader dùng chung storefront + API)

## Success Criteria
- View-source storefront (không JS) → thấy `<a href=".../products/{slug}">` + tên/giá sản phẩm trong HTML.
- Editor: grid vẫn preview live khi kéo-thả/sửa, không vỡ.
- Add-to-cart / View Detail hoạt động như cũ.
- Không regression visual (light/dark, mobile, 3 variant grid-3/grid-4/list).

## Risk Assessment
- **Editor preview vỡ** nếu SSR-path không tách đúng → test kỹ trong editor iframe.
- **Trùng lặp query** giữa API route và server loader → tái dùng, đừng copy.
- **Hydration mismatch** nếu server data ≠ client preview → tách rõ 2 path theo flag editor.

## Todo
- [ ] Điều tra cơ chế props storefront vs editor
- [ ] Tách server loader (tái dùng API query)
- [ ] products-grid: server cards + client interactive
- [ ] products-featured: áp cùng
- [ ] Test storefront SSR (view-source) + editor preview + add-to-cart
- [ ] code-reviewer

## Next Steps
- Độc lập với phase-02. Có thể làm trước nếu ưu tiên SEO.
