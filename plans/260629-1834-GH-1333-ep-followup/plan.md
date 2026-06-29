# GH-1333 F36 EasyParcel — Follow-up Plan

> Handoff plan: tiếp tục sau PR #1434. Ghi lại context EP API đã verify để không phải research lại.

## Bối cảnh

- **Branch:** `feat/1333-F36-easyparcel-delivery`
- **PR đang mở:** #1434 → base `staging` (toàn bộ feature F36 + hardening session 2026-06-29)
- **Research flow đầy đủ:** `plans/reports/researcher-260629-1435-GH-1333-ep-connect-flow.md`

## Đã hoàn tất (trong PR #1434)

- OAuth 2.0 connect/refresh, settings UI, checkout/rate, fulfillment/label, tracking (phases trước).
- **Hardening session này:** account identity (name+email), pickup seed từ EP, sender phone + validate + lock Save, "Sync from EasyParcel", wallet path/shape fix + low-balance warning, courier filter (selectedCourier giờ thực sự lọc quotation).

## EP API — sự thật đã verify live (QUAN TRỌNG)

| Endpoint | Method + path THẬT | Ghi chú |
|---|---|---|
| Wallet | `GET /open_api/2026-03/wallet` | KHÔNG `/account/`; shape `data.wallet[].{balance,currency}` |
| Account info | `GET /open_api/2026-03/account/get_account_information` | doc ghi POST — SAI; email ở `data.address.pickup_address.email` (rỗng nếu chưa cấu hình) |
| Quotation | `POST /open_api/2026-03/shipment/quotations` | trả `courier.courier_id` = `EP-CR0AP` |
| Courier list | `GET /open_api/2026-03/courier/list?country_code=MY` | CHƯA verify live (best-effort + fallback) |
| Submit order | doc: `POST /open_api/2026-03/shipment/submit_orders` | **code đang thiếu prefix** → bug |
| Tracking | doc: `POST /open_api/2026-03/shipment/tracking_status` (`awb_numbers[]`) | code dùng `GET .../shipment/tracking?tracking_number=` → lệch |

- Host live chỉ serve version **2026-03** (2026-06 trong doc CHƯA deploy).
- Pattern verify an toàn: thêm probe tạm trong `oauth-callback` (token sống), reconnect, đọc log, rồi gỡ. Đã dùng cho wallet + account-info.

## Phases (việc còn lại)

| Phase | Việc | Ưu tiên | File |
|---|---|---|---|
| 01 | Fix `submit_orders` thiếu prefix (verify live → sửa) | P0 — hỏng mua AWB | [phase-01](phase-01-fix-submit-orders.md) |
| 02 | Verify `/courier/list` + `tracking_status` live | P1 | [phase-02](phase-02-verify-courier-tracking.md) |
| 03 | Regression tests (courier filter + warehouse validate + sync) | P1 | [phase-03](phase-03-regression-tests.md) |
| 04 | Deferred: diff-badge, webhook thay cron polling | P2 | [phase-04](phase-04-deferred.md) |

## Dependencies

- Phase 01 nên xong trước khi QA fulfillment (label creation là chức năng cốt lõi).
- Phase 02 cần 1 lần connect EP thật để probe (giống session trước).
