# Phase 02 — Verify courier/list + tracking_status live

**Ưu tiên:** P1

## A. Courier list (`/courier/list`)

Đã wire best-effort (fallback static nếu lỗi) nhưng CHƯA verify path live.
- Code: `client.ts` → `courierList()` = `GET /open_api/2026-03/courier/list?country_code=MY`
- Route: `src/app/api/tenant/[id]/easyparcel-couriers/route.ts`
- Doc request sample dùng body `{country_code:"MY"}` nhưng method GET → mơ hồ (query vs body). Đang dùng query param.

**Verify:** mở Settings → Shipping sau connect, xem picker có hiện courier EP thật (id `EP-CR...`) hay rơi về fallback (`flash/jnt/...`). Nếu fallback → path/param sai → probe để tìm đúng (thử body GET, hoặc POST).

## B. Tracking endpoint lệch

- Code: `client.ts` → `tracking()` = `GET /open_api/2026-03/shipment/tracking?tracking_number=`
- Doc: `POST /open_api/2026-03/shipment/tracking_status` body `awb_numbers[]` (max 100)
- → Cần verify cái nào đúng live. Nếu doc đúng → sửa `tracking()` + consumer `orders/track/[orderNumber]` + cron `sync-tracking`.

**Verify:** sau khi có 1 đơn với awb thật, gọi cả 2 cách, xem cái nào trả status_log.

## Files

- `src/lib/shipping/easyparcel/client.ts` (courierList, tracking)
- `src/app/api/tenant/[id]/easyparcel-couriers/route.ts`
- `src/app/api/orders/track/[orderNumber]/route.ts`, `src/app/api/cron/sync-tracking/route.ts`

## Success

- Courier picker load courier EP thật.
- Tracking gọi đúng endpoint, trả status_log.

## Pattern probe an toàn

Thêm log tạm trong `oauth-callback` (có token sống) thử các method/path candidate, reconnect, đọc terminal, gỡ log. (Đã dùng thành công cho wallet + account-info session trước.)
