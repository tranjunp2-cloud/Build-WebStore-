# Plan — Gỡ dead code `oversellReview` (GH-1099 / US-F13-06, Bug 3)

**Branch:** `fix/1099-F13-06-reliable-payment-rework`
**Issue:** #1099 (US-F13-06 — qa:failed)
**Loại:** Refactor / dead-code removal (Hướng A)

## Bối cảnh

QA fail issue 1099 với 4 lỗi Critical. Check code thực tế (260604):

| Lỗi | TC | Trạng thái thực tế |
|-----|-----|-------------------|
| 1. field `oversellReview` schema | TC-F13.171 | ✅ ĐÃ có |
| 2. `decrementStock` guard | TC-F13.170 | ✅ ĐÃ fix (CAS `WHERE stock>=qty`) |
| 4. cron `/api/cron/reconcile-orders` | TC-F13.155/173 | ✅ ĐÃ implement + đăng ký vercel.json |
| **3. oversell branch + SYSTEM_ALERT** | TC-F13.145/172 | ⚠️ **dead code** |

**Lỗi 3 — kết luận điều tra:** Kiến trúc đã đổi sang **decrement stock UPFRONT** (lúc tạo session/order) cho MỌI payment method (Stripe/COD/bank_transfer/free), đều CAS-guarded + compensation. Không path nào decrement SAU thanh toán (`reconcileOrderPaid` và `approve-payment` đều không decrement). ⟹ Kịch bản oversell-after-capture **bất khả thi** → field `oversellReview` không bao giờ được set `true` → **dead code**.

## Mục tiêu

Gỡ sạch dead code `oversellReview` ở tầng application, **giữ nguyên column DB** (rule NEVER DROP). Đề nghị QA cập nhật TC-F13.145/146/172 theo cách tiếp cận "prevent upfront".

## Quyết định an toàn

- **DB column `oversell_review`**: GIỮ migration `ADD COLUMN IF NOT EXISTS` trong `db-setup.js` (NEVER DROP). Column tồn tại, default false, không còn được đọc/ghi — vô hại. `check-migrations.js` không gate orphan column (chỉ gate field MỚI trong diff) → CI pass.
- **Tầng code/collection**: gỡ field khỏi `Orders.ts` → Payload regenerate types → mọi tham chiếu `order.oversellReview` thành TS error → đó chính là các site cần gỡ (refund route, UI panel).
- **Refund logic**: sau khi gỡ, đơn chỉ refundable khi `status ∈ {shipped, completed}` (giữ nguyên hành vi thực tế hiện tại, vì oversellReview luôn false nên nhánh OR không bao giờ active).

## Phases

| Phase | Mô tả | Status |
|-------|-------|--------|
| [phase-01](phase-01-remove-oversell-dead-code.md) | Gỡ dead code (collection + refund + UI + tests) | ✅ Done (reviewed, APPROVE) |

## Files chạm

| File | Hành động |
|------|-----------|
| `src/collections/Orders.ts` | Gỡ field `oversellReview` (dòng ~366-373) |
| `src/app/api/orders/[id]/refund/route.ts` | Gỡ `oversellReview` khỏi pre-check (64) + 2 CAS SQL (153/155, 232/234) |
| `src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx` | Gỡ type field (52), điều kiện refundDisabled (882), banner (1057-1083), import `AlertTriangle` (6) |
| `src/__tests__/api/stripe-refund.test.ts` | Gỡ TC-F13.146 (315-340), đơn giản hóa regression test (343-363) |
| `src/__tests__/unit/payment/reconcile-order-paid.test.ts` | Sửa tên describe (38) bỏ "& oversell" |
| `scripts/db-setup.js` | **GIỮ NGUYÊN** migration; thêm comment ghi rõ column giữ lại theo NEVER DROP |

## Success Criteria

- [ ] Không còn tham chiếu `oversellReview`/`oversell_review` ở tầng code (trừ comment trong db-setup.js)
- [ ] `npx tsc --noEmit` pass (không TS error sót)
- [ ] `npm test` — toàn bộ test liên quan pass
- [ ] `node scripts/check-migrations.js` pass (CI gate)
- [ ] Hành vi refund không đổi cho đơn hợp lệ (shipped/completed vẫn refund được; new/pending vẫn bị chặn)

## Out of scope

- Không đổi logic decrement/CAS (đã đúng)
- Không đổi cron reconcile (đã đúng)
- Không DROP column DB
- Cập nhật TC trong `docs/qa/F13-*.md` → đề nghị QC làm (ghi note trong PR)

## Unresolved

- Cần PM/QC xác nhận chính thức đóng AC-3 theo hướng "prevent upfront" (ghi trong PR description, gắn `Relates to #1099`).
