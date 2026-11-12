# GH-1520 — Ma trận route hỗ trợ cho tenant-owner (Option D)

Quyết định: không nới Payload REST (A), không bypass token (C). REST native giữ hardening; QA load test theo route hỗ trợ.
Dòng "Native REST" = Payload REST `/api/{collection}` (cookie tenant-owner). Dòng "Route hỗ trợ" = route tùy chỉnh trong `src/app/api/**` hoặc server action Dashboard (đưa vào load test, expect 2xx khi dữ liệu hợp lệ).

## Đã đổi trong PR này (có test tự động mức access function)

| Native REST | Expected (tenant-owner) | Ghi chú |
|---|---|---|
| `GET/POST/PATCH /api/products` | theo tenant + plan (không đổi) | `tenant`/`site` bị `beforeChangeHook` (GH-1587) ép về tenant của actor |
| `DELETE /api/products/{id}` | **403** | Hard delete chỉ super-admin. Xóa mềm: Dashboard (`deleteProduct`, update `deletedAt`) |
| `GET /api/email-template-settings` | 200, lọc theo tenant | |
| `POST/PATCH/DELETE /api/email-template-settings[/{id}]` | **403** | Lưu/reset qua Dashboard (`template-settings-service`, `overrideAccess:true`) |

## Không đổi — loại khỏi load test native REST, dùng route hỗ trợ

Native REST của các collection này **không được cam kết** cho tenant-owner (trạng thái hiện tại 403/404, QA không dùng làm assertion pass/fail). Route hỗ trợ:

| Collection | Route hỗ trợ (method path) |
|---|---|
| blogs | `GET/POST /api/blogs`, `GET/PATCH/DELETE /api/blogs/{id}` |
| blog_categories | `GET/POST /api/blog-categories`, `PATCH/DELETE /api/blog-categories/{id}` |
| media | `GET /api/media/library`, `POST /api/media/presign`, `POST /api/media/register`, `POST /api/media/upload`, `DELETE /api/media/library/{id}` |
| sites | `GET /api/sites/{siteId}/editor-data`, `PATCH /api/sites/{siteId}/save`, `GET/POST /api/sites/{siteId}/pages`, `PATCH /api/sites/{siteId}/pages/{pageId}`, `PATCH /api/sites/{siteId}/publish`, `GET/PATCH /api/sites/{siteId}/shipping-config` |
| users (self) | `GET/PATCH /api/users/me`, `GET/PATCH /api/users/me/preferences`, `POST /api/users/me/password`, `POST /api/users/me/avatar` |
| tenants | `PATCH /api/tenant/slug`, `/api/tenant/{id}/easyparcel-*` (couriers, save, test, oauth-start, disconnect); toggle COD/QR/Stripe/FPX/Bank: server action Dashboard (chưa có route REST riêng) |
| email templates | `POST /api/email-templates/send-test`; lưu/reset: server action Dashboard |
| users (list buyers/staff) | Không có route hỗ trợ tenant-owner; ngoài phạm vi (xem #1535) |

## Bằng chứng

- Tự động: `unit/collections/products-config.test.ts` (TC-09.54), `unit/collections/email-template-settings-access.test.ts` + `security/tenant-product-isolation.test.ts` — kiểm hàm access, không phải HTTP.
- Chưa có (pending, cần QA staging): HTTP 403 thực, dữ liệu không đổi sau request bị từ chối, Dashboard save/reset email và xóa mềm vẫn hoạt động.

## Đã chốt phương án A cho `deletedAt`

`deletedAt` vẫn ghi được qua PATCH REST vì Dashboard xóa mềm bằng update với quyền user. PR này chỉ cấm hard-delete và cấm ghi email qua REST (đã chốt A bởi chủ PR); khóa `deletedAt` theo transport làm ở issue riêng.
