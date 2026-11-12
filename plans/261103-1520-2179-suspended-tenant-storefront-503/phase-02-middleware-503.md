# Phase 02 — Middleware 503 (subdomain + custom domain)

**Priority:** High · **Status:** done · **Depends:** 01

## Context
- Matcher middleware loại `api/` (`src/middleware.ts:337`) → không cần điều kiện `/api`.
- Subdomain gọi `/api/slug/redirect`; custom domain gọi `/api/domain-primary` (chỉ middleware gọi). Fail-open khi lỗi/timeout 2s — giữ.
- `storefront-cache-scope.test.ts:160` so khớp nguyên shape `/api/slug/redirect` → chỉ thêm field khi không khả dụng.

## Files
- `/api/slug/redirect`: tenant hiện tại không khả dụng (tenant + `getCachedMainSubscription`) → `{ redirect:false, unavailable:true, locale }`. Ưu tiên trước `maintenance`.
- `/api/domain-primary`: domain active của tenant không khả dụng → thêm `unavailable:true, locale`.
- `src/middleware.ts`: subdomain — `unavailable` → 503 trước nhánh maintenance; custom domain — kiểm trước redirect primary. Helper điều kiện `shouldReturnStoreUnavailable(data)` trong `maintenance.ts`.

## Success
- `curl -I` store không khả dụng → 503 + headers; store active → 200; draft-đã-publish → trang bảo trì cũ.
