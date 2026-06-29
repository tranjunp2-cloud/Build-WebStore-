# Plan: Storefront SSR Product Grid + next/image Optimization

> Status: **DRAFT — chưa implement** (tách từ SEO P3, làm sau)
> Created: 2026-06-26 | Base branch: `staging` | Slug: `storefront-ssr-and-image-optimization`

## Bối cảnh

Hai món P3 từ audit SEO storefront, tách riêng vì **lớn + rủi ro visual**, không gộp vào nhánh
soft-nav/SEO đang chạy. Mỗi phase = 1 PR riêng, có review + test.

## Mục tiêu

| Phase | Mục tiêu | Lợi ích |
|-------|----------|---------|
| [phase-01](phase-01-ssr-product-grid.md) | Render product grid **server-side** | Link PDP + nội dung sản phẩm nằm trong HTML đầu → SEO internal-link signal mạnh hơn, không phụ thuộc JS-render của bot |
| [phase-02](phase-02-next-image-migration.md) | `<img>` → `next/image` toàn storefront | LCP nhanh hơn, giảm bandwidth, lazy + srcset tự động (Core Web Vitals) |

## Key findings (đã khảo sát)

- `products-grid` + `products-featured` là `'use client'`, fetch `/api/storefront/products` trong `useEffect`
  → cards + link PDP **không** có trong HTML đầu. Sitemap đã bù phần *discovery*, nhưng SSR tốt hơn cho *internal-link signal*.
- Block render ở **2 ngữ cảnh**: storefront (server, có site context) + editor iframe (client, in-memory state).
  Đây là lý do gốc block fetch client-side → **độ phức tạp chính của phase-01**.
- `next.config.ts` đã có `images.remotePatterns: [{ protocol:'https', hostname:'**' }, localhost, minio]`
  → **next/image KHÔNG cần đổi config** (mọi host https đã được phép). Giảm rủi ro phase-02 đáng kể.
- Blocks dùng `<img>` (cần enumerate lại khi làm): footer, product-quick-view, menu-display, products-featured,
  StorefrontBlogList, + (lint cũ) portfolio-grid, products-grid, products-show, team.

## Thứ tự & phụ thuộc

- 2 phase **độc lập** — làm song song hoặc tách PR riêng đều được.
- Phase-01 nên đi trước nếu muốn ưu tiên SEO; phase-02 nếu ưu tiên Core Web Vitals.
- Không phụ thuộc nhánh SEO hiện tại (đã có sitemap + JSON-LD).

## Out of scope
- Sitemap-index (YAGNI — catalog nhỏ), hreflang (1 locale/site).
- Không đổi logic add-to-cart / checkout.
