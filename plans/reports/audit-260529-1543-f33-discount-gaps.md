# F33 Discount CMS — Gap / Vulnerability Audit

> Audit của PLAN + PRD + design (chưa code). Verify chéo với code thật: `stripe-checkout/route.ts`,
> `webhooks/stripe/handlers/checkout-completed.ts`, `payment-failed.ts`, Orders lifecycle.
> Date: 2026-05-29. Branch: feat/F33-discount-cms.

## Kiến trúc thật đã xác nhận (quan trọng cho severity)

- Stripe: **pending order tạo TRƯỚC khi thanh toán** (`stripe-checkout/route.ts:55,218`). Buyer redirect ra Stripe.
- Success → `checkout-completed.ts:98-102` chuyển `pending→new` bằng **raw drizzle SQL** (KHÔNG fire Payload afterChange hook). `payload.update` sau đó chỉ set stripeSessionId/paymentIntentId (status đã 'new').
- Fail → `payment-failed.ts` set `payment_failed`.
- **Abandon** (buyer đóng tab) → KHÔNG webhook nào fire → order kẹt 'pending' vĩnh viễn.

---

## CRITICAL

### A. Stripe usage-leak: redeem (usageCount++) chạy lúc tạo session, TRƯỚC khi trả tiền
Phase 03 step 7: Stripe "same resolve→redeem→compute" ⇒ `usageCount++` ngay lúc tạo pending order.
- Abandon / payment_failed ⇒ usageCount đã tăng nhưng KHÔNG rollback, KHÔNG history row.
- ⇒ usageCount drift > số redemption thật. Discount limit=100 bị **100 lần abandon đốt sạch** → buyer thật bị chặn. Trivially abusable (mở checkout N lần).
- Vi phạm FR-12 + success-metric "100% applied discount = 1 history record".

**+ Defect thứ 2 (cùng vùng):** Phase 03 step 8 ghi history qua `Orders.afterChange` "on webhook-confirmed transition". Nhưng webhook chuyển status bằng **raw SQL**, afterChange KHÔNG fire. ⇒ recordDiscountUsage **không bao giờ chạy cho Stripe** như plan mô tả. History phải ghi explicit TRONG `checkout-completed.ts`.

**Fix đề xuất:** Stripe KHÔNG redeem lúc tạo session. Snapshot `discountId/discountCode/discountAmount` lên pending order; redeem + recordUsage **bên trong `checkout-completed.ts`** sau khi atomic transition thắng. Phải quyết: at-limit lúc webhook (buyer đã trả giá giảm rồi) → hoặc cho phép vượt limit nhẹ trên Stripe, hoặc reserve-on-create + release-on-fail. Plan chưa đụng tới quyết định này.

### B. Idempotency history = check-then-act, KHÔNG có UNIQUE constraint DB
Phase 01 chỉ tạo index thường trên `discount_usage_history(order_id)`, không UNIQUE. Phase 03 idempotency = "SELECT existing row → INSERT" = race. Stripe retry webhook / admin re-save đồng thời → double insert + (kết hợp) double count.
**Fix:** `CREATE UNIQUE INDEX discount_usage_history_order_uniq ON discount_usage_history (order_id);` (1 redemption / order). Rẻ, đóng race, reconcile được usageCount vs history.

### C. COD: redeem TRƯỚC payload.create, không rollback nếu create fail
Phase 03 step 6 redeem rồi mới create. Nếu `payload.create` throw (validation/DB) ⇒ usageCount tăng vĩnh viễn, không order, không history. Leak.
**Fix:** create order trước rồi redeem; hoặc redeem trong cùng transaction với create; hoặc decrement khi create fail.

---

## HIGH

### D. Redeem trước khi tính amount → đốt usage cả khi discountAmount = 0
Step 6 thứ tự: resolve → redeem → computeDiscount. Nếu amount=0 (percentage=0, hoặc fixed=0), 1 slot usage bị tiêu cho 0 đồng. **Fix:** compute trước, chỉ redeem khi `discountAmount > 0`.

### E. Không có per-customer limit; semantics "NEWUSER20" không enforce được
Chỉ có global `usageLimit`. Cùng 1 khách reuse code vô hạn tới khi cạn global cap. Ví dụ design "NEWUSER20" ám chỉ new-user-only nhưng model không biểu diễn được. Abuse vector phổ biến. Nếu defer thì phải **defer có ý thức**, không im lặng. (Cân nhắc field `perCustomerLimit` + match theo customer/email/phone.)

### F. Email xác nhận Stripe KHÔNG hiển thị dòng discount
`checkout-completed.ts:168-191` gọi `orderConfirmationEmail({...})` KHÔNG truyền `discountAmount`/`discountCode`. Plan Phase 03 liệt kê sửa 2 route + email template nhưng **bỏ sót handler webhook này**. ⇒ đơn Stripe nhận email sai (không có dòng giảm giá, hoặc subtotal/total không khớp). **Fix:** thêm `checkout-completed.ts` vào file-list Phase 03, truyền discount fields.

---

## MEDIUM

### G. Unique index `(tenant_id, code)` mâu thuẫn site-scoping
`site` optional (null = all sites) nhưng unique index bỏ qua `site_id` ⇒ KHÔNG thể có "SALE" cho site A và "SALE" cho site B trong cùng tenant. Hoặc đổi `(tenant_id, site_id, code)` (lưu ý NULL!=NULL trong Postgres unique), hoặc nêu rõ "code unique per tenant bất kể site". Hiện đang nửa nọ nửa kia.

### H. expiresAt boundary + timezone off-by-one
Design nói "inclusive end-of-day" nhưng field `date`→timestamptz, picker cho midnight. resolve check "now ∈ [startsAt, expiresAt]". Code "valid through 31/08" lưu `2026-08-31T00:00Z` hết hạn ngay đầu ngày 31, mất nguyên ngày; UTC+8 (MY) còn sớm hơn. **Fix:** end-of-day rõ ràng (expiresAt +1 ngày exclusive, hoặc so date-only theo tz store). Tương tự startsAt.

### I. Stripe line-item proportional scaling: rounding / display / refund
"Scale mỗi item, fix remainder dòng cuối": (a) discount ~100% có thể ra line 0/âm — phải guard; (b) Stripe receipt hiện unit price méo → khó hiểu + lệch kế toán; (c) refund từng phần tính sai trên giá méo. Phải chốt: `orders.items[].unitPrice` giữ **giá gốc** (email/stock dùng nó), chỉ Stripe `line_items` bị scale; discount lưu riêng. (Liên quan F.)

### J. Hard-delete discount đã có usage → hỏng audit trail (mâu thuẫn BR-07)
FR-08 cho "soft hoặc hard delete (chưa chốt)". Phase 01 cho `delete: allowed`. Xoá discount đang được history/order tham chiếu ⇒ orphan `discount_id`, vỡ relationship, mất audit (BR-07 nói history immutable). **Fix:** chặn delete nếu có usage, hoặc soft-delete (status inactive).

### K. Normalization phải đồng nhất 2 phía + không enforce ở DB
BR-05 store UPPERCASE/compare case-insensitive chỉ đúng nếu beforeChange luôn upper+trim VÀ resolveDiscount upper+trim input. Create qua API/import bỏ qua hook có thể chèn 'sale' lẫn 'SALE' (index case-sensitive cho qua) → resolve ambiguous. Đảm bảo invariant `UPPER(TRIM(code))`.

---

## LOW

- **L.** Stock reserve lúc webhook nhưng discount (plan hiện tại) redeem lúc session-create → 2 mô hình reservation lệch nhau. Align cả hai về webhook (gắn với fix A).
- **M.** Pending Stripe order mang discount snapshot → admin/report thấy discount "đã áp" trên đơn chưa trả/abandon (gắn A).
- **N.** customerEmail snapshot null cho guest COD (Customers unique theo phone, email optional) → audit thiếu email. Chấp nhận được.
- **O.** Code charset/length: chốt max 50, trim, chặn whitespace giữa/unicode confusables.

---

## Unresolved questions (cần product/tech quyết)

1. Stripe redeem: reserve-on-create+release, hay defer-to-webhook chấp nhận vượt limit nhẹ? (quyết định A)
2. Per-customer limit có làm v1 không? (E) — nếu không, ghi rõ deferred trong PRD.
3. Code unique theo `(tenant)` hay `(tenant, site)`? (G)
4. Delete policy: soft hay hard? (J)
5. expiresAt: lưu end-of-day theo tz nào (store tz vs UTC)? (H)
