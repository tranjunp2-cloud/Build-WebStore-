# Phase 03 — Page fallback + SEO routes

**Priority:** High · **Status:** done · **Depends:** 01

Fallback khi middleware fail-open hoặc truy cập `/sites/{slug}` trực tiếp. Page không đặt được HTTP status → render
`MaintenancePage variant="unavailable"` + metadata `noindex` (503 thật do middleware).

## Files
- `[[...path]]/page.tsx`: `getTenantAndPage` trả `{ unavailable: true, locale }` ngay sau khi có tenant (trước draft/owner — owner cũng chặn); `generateMetadata` → `{ title, robots noindex }`, không tên/mô tả/OG.
- `products/[productSlug]/page.tsx`, `blog/[blogSlug]/page.tsx`: kiểm sau khi resolve tenant, cả `generateMetadata` (không lộ tên SP/blog, OG image).
- `checkout/page.tsx`: tenant chỉ `select id` → dùng `tenantFull.status`.
- `sitemap.xml`, `robots.txt`, `llms.txt` route: không khả dụng → 503 (`STORE_UNAVAILABLE_HEADERS`, body text ngắn).
- Trang đơn hàng (`/orders*`, `/order/*/confirm`): không sửa (middleware đã chặn chung) — câu hỏi mở cho BA.

## Success
- `/sites/<slug>` local của tenant không khả dụng → trang unavailable, `noindex`, không block/sản phẩm, không tên SP trong `<head>`.
