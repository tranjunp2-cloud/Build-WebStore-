# Phase 04 — Public API + checkout block

**Priority:** High · **Status:** done · **Depends:** 01

## Public API (trả như "không tìm thấy store", không nêu lý do)
| Route | Khoá theo | Khi không khả dụng |
|---|---|---|
| `storefront/site-by-slug` | slug | 404 `{ error: 'Not found' }` |
| `storefront/products`, `products/bounds`, `categories` | `site` | 200 rỗng như site không tồn tại: `{docs:[],totalDocs:0}` / `{minPrice:0,maxPrice:0,attributes:[]}` / `{docs:[]}` |
| `storefront/blogs` | `tenant` | 200 `{docs:[],totalDocs:0}` |
| `storefront/cart/resolve` | slug/host | `{ lines: [] }` |
| `storefront/discounts/apply` | slug | nhánh silent-reject hiện có |
| `subscribe`, `contact-submit` | `siteId` | trả như site không hợp lệ (giữ status/body hiện có của nhánh đó) |
| `orders/calculate-shipping` | `siteId` | `STORE_UNAVAILABLE` 403 (tránh gọi EasyParcel bằng token tenant) |

Site → tenant: products/bounds/categories dùng `isCachedSiteUnavailable(siteId)` (cache, đọc status từ cache tenant-by-slug); subscribe/contact/calculate-shipping dùng `isSiteDocTenantUnavailable(payload, site)` trên site đã load; blogs dùng `isTenantIdUnavailable`.
Builder/editor dùng chung API → super-admin mở builder store không khả dụng thấy rỗng (owner không đăng nhập được) — ghi PR.

## Checkout (403 `STORE_UNAVAILABLE`, cùng code hiện có)
Thay `status === 'suspended'` bằng `isTenantUnavailable(payload, tenant)` tại:
`orders/checkout/route.ts:88`, `orders/stripe-checkout/route.ts` (`validate-store.ts` không được import — dead code, xoá ở PR sau), `orders/xendit-checkout/route.ts:82`, `orders/[id]/retry-payment/route.ts:140`.
`checkout/route.ts` đã đọc `getActivePlanSubscription` (trả null khi hết hạn → hiện cho qua) — dùng helper mới, không đổi gate `canUse`.

## Success
- Test: mỗi route trả đúng nhánh khi tenant suspended và khi sub hết hạn; tenant active + sub active như cũ.
- Test checkout cũ TC-F09.274–276, TC-F13.88 vẫn pass.
