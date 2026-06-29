# Phase 01 — Fix submit_orders thiếu prefix

**Ưu tiên:** P0 (hỏng mua AWB/label — chức năng cốt lõi F36)

## Vấn đề

`src/lib/shipping/easyparcel/client.ts` → `submitOrder()`:
```ts
return epFetch('POST', '/shipment/submit_orders', token, { shipment: [params] })
```
THIẾU prefix `/open_api/2026-03/`. Mọi endpoint shipment khác đều có:
- `POST /open_api/2026-03/shipment/quotations`
- `GET  /open_api/2026-03/shipment/tracking`
- `POST /open_api/2026-03/shipment/cancel`

→ `epFetch` ghép `EP_API_BASE + path` = `https://api.easyparcel.com/shipment/submit_orders` → khả năng cao **404**, không tạo được vận đơn.

Doc xác nhận path đúng: `POST /open_api/2026-03/shipment/submit_orders`.

## Bước làm

1. **Verify live trước** (đừng sửa mù — bài học wallet/account-info):
   - Thêm probe tạm trong `oauth-callback` (token sống), hoặc tạo 1 đơn test qua create-label và bắt response.
   - Confirm `/open_api/2026-03/shipment/submit_orders` trả 200 (không 404).
2. Sửa path trong `submitOrder()`:
   ```ts
   return epFetch('POST', '/open_api/2026-03/shipment/submit_orders', token, { shipment: [params] })
   ```
3. Kiểm tra response shape `EpSubmitOrderResponse` khớp thực tế (awb, tracking_number, shipment_id, label url).
4. Gỡ probe tạm.

## Files

- Sửa: `src/lib/shipping/easyparcel/client.ts` (L76)
- Đọc: `src/app/api/orders/[id]/create-label/route.ts` (consumer), `build-submit-params.ts`, `src/lib/shipping/easyparcel/types.ts` (EpSubmitOrderResponse)

## Success

- submit_orders trả 200 với token thật.
- create-label tạo được AWB + lưu `awbNo`/`labelUrl` vào order.

## Risk

- Response shape có thể khác type hiện tại (giống vụ wallet) → verify field awb/tracking/label trước khi tin.
