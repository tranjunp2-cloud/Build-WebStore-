# Phase 01 — Helpers: availability, cached subscription, copy + 503 HTML

**Priority:** High · **Status:** done · **Depends:** —

## Files
- **Tạo** `src/lib/storefront/store-unavailable.ts` (Edge-safe, không import Payload): `STORE_UNAVAILABLE_COPY` (en/ms), `storeUnavailableLocale(primary)` (`ms`, `ms-MY`… → `ms`, còn lại `en`).
- **Tạo** `src/lib/storefront/store-availability.ts` (Node):
  - `isStoreUnavailable(tenantStatus, subscription)` thuần: `suspended` hoặc (`subscription` có và `!isSubscriptionActive`).
  - `findMainSubscriptionState(payload, tenantId)` (uncached, 1 statement, cho checkout/API) — trả row mới nhất `name='main'` hoặc null.
  - `isTenantUnavailable(payload, tenant)` = kết hợp 2 hàm trên; `isTenantIdUnavailable(payload, tenantId)`, `isSiteDocTenantUnavailable(payload, site)` cho route chỉ có id / site.
- **Tạo** `src/lib/storefront/cached-store-availability.ts`: bản cached cho middleware/page/listing API (`isCachedStoreUnavailable`, `isCachedSiteUnavailable`, `storefrontUnavailableFor`, `storeUnavailableResponse`).
- **Sửa** `src/lib/cache/tenant.ts`: `getCachedMainSubscription(tenantId)` (tag `storefrontTags.planSubscription(tenantId)` + `tenants`), cache row (status/endsAt/canceledAt/canceledImmediately), boolean tính lúc request.
- **Sửa** `src/lib/cache/storefront-tags.ts`: `planSubscription(tenantId)`.
- **Sửa** `src/collections/PlanSubscriptions.ts` + `src/lib/cache/revalidate-storefront.ts`: afterChange/afterDelete bust `planSubscription(tenant)` (để `/sso/renew` mở lại ngay). SSO renew/upgrade/downgrade bust lại sau khi ghi xong; ban/unban bust tag tenant.
- **Sửa** `src/lib/maintenance.ts`: `buildStoreUnavailableHtml(locale)`, `STORE_UNAVAILABLE_HEADERS` (html, `Retry-After: 3600`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`).
- **Sửa** `MaintenancePage.tsx`: `variant?: 'maintenance' | 'unavailable'`, `locale?`. Mặc định giữ hành vi cũ.

## Success
- Hàm thuần có test đủ nhánh; không có subscription → khả dụng; `endsAt` quá khứ → không khả dụng.
- `buildStoreUnavailableHtml('ms-MY')` → BM, `lang="ms"`; không có tên store.
