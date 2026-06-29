# Phase 03 — Regression tests

**Ưu tiên:** P1 (logic mới chưa có test riêng; suite cũ vẫn pass)

## Cần test (TC-ID lấy/bổ sung từ `docs/qa/F36*.md`)

### 1. Courier filter trong `get-rates.ts`
- selectedCourier set + có courier khớp → chỉ trả rate courier đó.
- selectedCourier set + KHÔNG khớp route → fallback trả tất cả (không chặn checkout).
- selectedCourier rỗng/`'flat'` → trả tất cả.
- Mock `quotations()` trả nhiều courier (vd EP-CR0AP, EP-CR0AW).

### 2. Warehouse validation (settings tab)
- Thiếu phone/name/address1/state/postcode → Save bị disable + cảnh báo liệt kê field.
- Đủ hết → Save enable, payload có `phone`.
- Phone < 8 digit → invalid.

### 3. Pickup seed (oauth-callback)
- EP có pickup_address + tenant chưa có warehouse → seed.
- Tenant đã có warehouse → KHÔNG đè.
- `province_code` (MY-10) → map đúng state name (Selangor) qua `mapSubdivisionName`.

### 4. Sync from EP (easyparcel-test route)
- body `{syncWarehouse:true}` + pickup có data → ghi warehouse, `warehouseApplied=true`.
- pickup rỗng → `warehouseApplied=false`.

## Files (tester owns test files only)

- `src/__tests__/unit/shipping/get-rates-courier-filter.test.ts` (mới)
- `src/__tests__/unit/dashboard/easyparcel-warehouse-validate.test.tsx` (mới)
- `src/__tests__/api/easyparcel-oauth-callback.test.ts` (mới, seed logic)
- Tham khảo gold-standard: `src/__tests__/api/orders-calculate-shipping.test.ts`

## Success

- 100% pass; mock đúng (không fake data để qua build).
- Import logic từ source, không re-implement.
