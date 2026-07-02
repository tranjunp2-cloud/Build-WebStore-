# F36 COD — Decision & Dev Handoff

> GH-1333 · branch `feat/1333-F36-easyparcel-delivery` · validated on EP **sandbox** (Prime Commerce Sandbox), 2026-07-02.

## Chốt phương án: code tự enforce COD, không tin EP

EP **không validate COD** ở submit (test: under-min, over-max, sai courier, East MY → EP nhận hết). Nên toàn bộ rule COD do **code mình** gác.

## Mô hình courier (đã chốt — khớp code as-built)

Commit `722b47f0` đã đổi từ "seller khóa 1 courier" sang **allowlist** (`selectedCouriers[]`, multi-select) + **auto-cheapest at checkout**. Giữ nguyên hạ tầng này.

- Seller chọn **allowlist** courier (UX **mặc định/khuyến khích 1 courier**; legacy `selectedCourier` được `getAllowedCouriers()` coalesce → tương thích ngược).
- Checkout **auto-quote courier rẻ nhất** trong allowlist phục vụ route.
- **Đơn COD → auto chọn courier COD-capable rẻ nhất** trong allowlist (đã build ở `get-rates.ts`).

## Rule COD eligibility (1 nguồn chân lý)

COD được phép ⟺ **cả 3 đúng** (áp cho courier được auto-pick cho đơn đó):
1. **Dest = West Malaysia** (East: Sabah/Sarawak/Labuan → chặn).
2. Courier auto-pick có **`cod.available = true`** (đọc từ quotation).
3. Tổng đơn nằm trong **`[min_cod_amount, max_cod_amount]`** của courier đó.

## Đã validate (sandbox thật)

| Điều | Kết quả |
|---|---|
| Param COD lúc submit | **`cod_amount`** (RM float) ✅ |
| EP tự chặn under-min/over-max/sai-courier/East | ❌ Không — **nhận tuốt** → phải tự enforce |
| Tín hiệu tin được | `quotations` trả per-courier `cod.available` + `min_cod_amount` + `max_cod_amount` (bất biến theo cân nặng & amount) |
| Courier non-COD + `cod_amount` | EP **vẫn tạo đơn** → bắt buộc lọc courier COD-capable (đã build) |
| Cancel contract | `{cancel_list:[{shipment_number}]}` — **code hiện đang sai** (đang gửi `shipment[{tracking_number}]`) |

## Đầu API dùng (đều `/open_api/2026-03/…`)

| Endpoint | Dùng để | Ghi chú |
|---|---|---|
| `POST /shipment/quotations` | Đọc `cod.available` + min/max per courier | Free, read-only |
| `POST /shipment/submit_orders` | Gửi `cod_amount` khi tạo đơn | Trừ ví = phí ship |
| `POST /shipment/cancel` | Huỷ đơn | Body = `cancel_list` |

## Code đã có (commit 722b47f0)

- ✅ Allowlist `selectedCouriers[]` + auto-cheapest (`get-rates.ts`, `calculate-shipping`).
- ✅ Đơn COD → lọc chỉ courier `codAvailable=true`.
- ✅ Trích `codAvailable` + `codMaxSen` từ quotation.

## Dev còn phải làm (chưa có trong code)

1. **`src/lib/shipping/cod-eligibility.ts`** — helper `isCodEligible({destState, courierCodAvailable, minCodSen, maxCodSen, orderTotalSen})` = nguồn chân lý duy nhất cho 3 rule trên.
2. **Enforce `min` + `max`** — `get-rates.ts` mới lọc `codAvailable`, **chưa** chặn total ngoài `[min,max]`; cần thêm `codMinSen` vào rate response + gate amount.
3. **Chặn East MY** — thêm zone check (West-only) vào eligibility (chưa có).
4. **Checkout hard-gate** — hide/disable COD ở UI **và** reject ở server nếu `isCodEligible` false; auto-switch payment khác.
5. **Fix cancel** — đổi `cancelShipment()` sang body `cancel_list`.

## Open (cần Domin xác nhận với EP, không test được ở sandbox)

- Sandbox nhận COD East MY, nhưng official EP = **West only**. Mặc định **chặn East**. Muốn mở East MY COD → verify với EP support (production), đừng dựa sandbox.
