# F36 COD — Decision & Dev Handoff

> GH-1333 · branch `feat/1333-F36-easyparcel-delivery` · validated on EP **sandbox** (Prime Commerce Sandbox), 2026-07-02.

## Chốt phương án: PA2 — code tự enforce COD, không tin EP

EP **không validate COD** ở submit (test: under-min, over-max, sai courier, East MY → EP nhận hết). Nên toàn bộ rule COD do **code mình** gác.

## Rule COD (1 nguồn chân lý)

COD được phép ⟺ **cả 3 đúng**:
1. **Dest = West Malaysia** (East: Sabah/Sarawak/Labuan → chặn).
2. Courier đã chọn có **`cod.available = true`** (đọc từ quotation).
3. Tổng đơn nằm trong **`[min_cod_amount, max_cod_amount]`** của courier đó.

## Đã validate (sandbox thật)

| Điều | Kết quả |
|---|---|
| Param COD lúc submit | **`cod_amount`** (RM float) ✅ |
| EP tự chặn under-min/over-max/sai-courier/East | ❌ Không — **nhận tuốt** → phải tự enforce |
| Tín hiệu tin được | `quotations` trả per-courier `cod.available` + `min_cod_amount` + `max_cod_amount` (bất biến theo cân nặng & amount) |
| Courier non-COD (City-Link) + `cod_amount` | EP **vẫn tạo đơn** → giao xong không thu được tiền → **bắt buộc lọc picker** |
| Cancel contract | `{cancel_list:[{shipment_number}]}` — **code hiện đang sai** (đang gửi `shipment[{tracking_number}]`) |

## Đầu API dùng (đều `/open_api/2026-03/…`)

| Endpoint | Dùng để | Ghi chú |
|---|---|---|
| `POST /shipment/quotations` | Đọc `cod.available` + min/max per courier | Free, read-only |
| `POST /shipment/submit_orders` | Gửi `cod_amount` khi tạo đơn | Trừ ví = phí ship |
| `POST /shipment/cancel` | Huỷ đơn | Sửa sang `cancel_list` |

## Dev làm gì

1. **`src/lib/shipping/cod-eligibility.ts`** — helper `isCodEligible({destState, courierCodAvailable, min, max, orderTotal})` = nguồn chân lý duy nhất cho 3 rule trên.
2. **Courier picker (settings)** — khi seller **bật COD** → picker chỉ hiện courier COD-capable (buộc `selectedCourier` là courier COD được). COD off → hiện tất cả courier như hiện tại.
3. **Checkout hard-gate** — hide/disable COD ở UI **và** reject ở server nếu `isCodEligible` false; auto-switch payment khác khi không đủ điều kiện.
4. **Fix cancel** — đổi `cancelShipment()` sang body `cancel_list`.

## Mô hình chốt: PA2 thuần (seller khóa 1 courier)

Checkout dùng đúng **1 courier** seller chọn (`selectedCourier`, `get-rates.ts`). COD ở checkout ⟺ courier đó COD-capable + West MY + total ∈ [min,max]. Buyer **không** chọn courier.

**Tradeoff đã chấp nhận (chủ đích, không phải thiếu sót):** COD coverage bị giới hạn bởi courier seller chọn — nếu seller ưu tiên 1 courier không-COD thì đơn đó không có COD. Đổi lại: đơn giản, ship nhanh, dev thấp. (Bản auto-assign courier COD tối ưu coverage hơn nhưng đã bỏ để giữ KISS.)

## Open (cần Domin xác nhận với EP, không test được ở sandbox)

- Sandbox nhận COD East MY, nhưng official EP = **West only**. Mặc định **chặn East**. Muốn mở East MY COD → verify với EP support (production), đừng dựa sandbox.
