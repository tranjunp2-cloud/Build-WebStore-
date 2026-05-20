# Email Templates — Design

> Design specs cho 8 commerce email templates còn thiếu/chưa wired.
> Pair với: `docs/architecture/email-templates.md` (technical index) + `plans/260519-1549-commerce-email-rollout/` (implementation plan).

## Conventions

- **Master design preview:** [`./email-templates/index.html`](./email-templates/index.html) — local bundle với 10 templates (open trong browser)
- **Original Claude Design link:** [Claude Design source](https://claude.ai/design/p/019dd7e0-9ebb-7240-9a01-c5a1a8aa733b?file=emails%2Findex.html&present=1) — chỉ accessible cho team có workspace access
- **Canonical HTML code reference:** `src/lib/email/templates/welcome.ts` — gradient header, white card, gray footer
- **Max width:** 600px
- **Default palette:** `#0d9488 → #6366f1` (teal-indigo gradient header)
- **Status colors** (order-status variants): processing `#f59e0b` · shipped `#3b82f6` · delivered `#10b981` · cancelled `#ef4444` · failed `#dc2626`
- **Font stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Locale:** EN + MS đầy đủ trước khi ship (anti-pattern `staff-invitation`)

---

## 1. `contact-buyer-confirmation`

- **Recipient:** Buyer (visitor submit contact form)
- **Trigger:** `src/app/api/contact-submit/route.ts` (sau khi insert submission)
- **Subject (EN):** _TBD_
- **Subject (MS):** _TBD_

### Design reference

[`./email-templates/06-contact-form-buyer.html`](./email-templates/06-contact-form-buyer.html)

### Layout

_[Header / hero / body / CTA / footer sections]_

### Color & typography

_[Palette, font sizes, special tokens nếu khác default]_

### Notes

_[CTA destination, variable content rules, edge cases]_

---

## 2. `contact-seller-notification`

- **Recipient:** Seller (site owner)
- **Trigger:** Cùng endpoint với #1; thay thế inline tại `contact-submit/route.ts:93`
- **Reply-To:** `visitorEmail` (seller reply trực tiếp buyer)
- **Subject (EN):** _TBD_
- **Subject (MS):** _TBD_

### Design reference

[`./email-templates/07-contact-form-seller.html`](./email-templates/07-contact-form-seller.html)

### Layout

_[Fields table: visitorName, visitorEmail, visitorPhone, message, siteName]_

### Color & typography

_[Internal-notification style — simpler hơn buyer-facing]_

### Notes

_[Include link tới admin panel? Highlight urgency?]_

---

## 3. `newsletter-buyer-confirmation`

- **Recipient:** Buyer (subscriber)
- **Trigger:** `src/app/api/subscribe/route.ts` (sau khi insert subscriber)
- **Mode:** Single-opt-in (theo plan decision)
- **Subject (EN):** _TBD_
- **Subject (MS):** _TBD_

### Design reference

[`./email-templates/08-newsletter-buyer.html`](./email-templates/08-newsletter-buyer.html)

### Layout

_[Thank-you hero, optional CTA visit site, unsubscribe link nếu add v1.5]_

### Color & typography

_[Brand teal hoặc custom theo site palette?]_

### Notes

_[Welcome offer/coupon include? Frequency expectation message?]_

---

## 4. `newsletter-seller-notification`

- **Recipient:** Seller (site owner)
- **Trigger:** Cùng endpoint với #3
- **Subject (EN):** _TBD_
- **Subject (MS):** _TBD_

### Design reference

[`./email-templates/09-newsletter-seller.html`](./email-templates/09-newsletter-seller.html)

### Layout

_[Subscriber email + source field + signup time]_

### Color & typography

_[Internal-notification style]_

### Notes

_[v1 = per-signup instant; v2 = digest mode batched]_

---

## 5. `new-order-seller`

- **Recipient:** Seller (all tenant owners, deduplicated)
- **Trigger:** `src/collections/Orders.ts` afterChange create (COD/QR) + `src/app/api/webhooks/stripe/route.ts:194` (Stripe)
- **Reply-To:** `customerEmail` (seller reply direct buyer)
- **Subject (EN):** _TBD_
- **Subject (MS):** _TBD_

### Design reference

[`./email-templates/02-new-order-seller.html`](./email-templates/02-new-order-seller.html)

### Layout

_[Order number hero, items table, total, customer info, payment method badge, CTA view in admin]_

### Color & typography

_[Match `order-confirmation` brand teal? Hay alert-style để urgency?]_

### Notes

_[Payment method icons (COD/QR/Stripe)? Highlight pending_verification status nếu manual payment?]_

---

## 6. `order-status` — `cancelled` variant

- **Recipient:** Buyer
- **Trigger:** `src/app/api/orders/[id]/cancel/route.ts` (migrate inline) + `Orders.ts` afterChange when `status` → `'cancelled'`
- **Template:** Existing `src/lib/email/templates/order-status.ts` (wire only)
- **Status color:** `#ef4444` (red)
- **Status emoji:** ❌
- **Subject (EN):** Current — `❌ {statusT.title} — {orderNumber}` _(update nếu cần)_
- **Subject (MS):** _TBD nếu đổi_

### Design reference

[`./email-templates/03-order-cancelled-buyer.html`](./email-templates/03-order-cancelled-buyer.html)

### Notes

_[Cancellation reason field: thêm vào template hay vẫn inline? Open question từ plan phase-04]_

---

## 7. `order-status` — `delivered` variant

- **Recipient:** Buyer
- **Trigger:** `Orders.ts` afterChange when `status` → `'delivered'`
- **Template:** Existing `order-status.ts` (wire only)
- **Status color:** `#10b981` (green)
- **Status emoji:** ✅
- **Subject (EN):** Current — `✅ {statusT.title} — {orderNumber}`
- **Subject (MS):** _TBD nếu đổi_

### Design reference

[`./email-templates/04-order-delivered-buyer.html`](./email-templates/04-order-delivered-buyer.html)

### Notes

_[Include thank-you message? Review request CTA? Cross-sell?]_

---

## 8. `order-status` — `failed` variant (new)

- **Recipient:** Buyer
- **Trigger:** `Orders.ts` afterChange when `status` → `'failed'`
- **Template:** Extend existing `order-status.ts` enum (phase 01)
- **Status color:** `#dc2626` (darker red than cancelled — distinguish "failure" vs "cancellation")
- **Status emoji:** ⚠️
- **Subject (EN):** _TBD_
- **Subject (MS):** _TBD_

### Design reference

[`./email-templates/05-order-failed-buyer.html`](./email-templates/05-order-failed-buyer.html)

---

## 9. `payment-timeout-cancelled-buyer` (new — F10 Bank Transfer flow)

> Đơn hàng Bank Transfer auto-huỷ sau 24h nếu buyer không upload payment proof. Email giải thích rõ lý do timeout + CTA re-order. **Dedicated template** (không reuse `order-status` cancelled) vì tone explanatory + CTA khác hẳn admin-cancel flow.

- **Recipient:** Buyer
- **Trigger:** Cron job 24h timeout — order `pending_verification` quá hạn → auto-cancel + restock + send mail
- **Template:** `src/lib/email/templates/payment-timeout-cancelled-buyer.ts` (NEW)
- **Status color:** `#f59e0b` (warning amber — softer than cancel red, vì là time-based policy không phải failure)
- **Status emoji:** ⏰
- **Subject (EN):** `Order #{orderNumber} cancelled — payment window expired`
- **Subject (MS):** `Pesanan #{orderNumber} dibatalkan — tempoh pembayaran tamat`
- **i18n key prefix:** `email.paymentTimeout.*`

### Input schema

```ts
paymentTimeoutCancelledBuyerEmail({
    orderNumber, customerName, total, currency, paymentMethod,
    expiredAt,          // Date — khi nào hết hạn
    placedAt,           // Date — buyer đặt khi nào
    reorderUrl,         // CTA chính: re-order với cart cũ
    siteName, locale?
})
```

### Layout (key sections)

1. **Header amber** — emoji ⏰ + heading "Đơn hàng đã huỷ tự động"
2. **Explanation block** — "Hệ thống không nhận được thanh toán trong 24h kể từ {placedAt}. Theo chính sách, đơn hàng đã huỷ tự động và sản phẩm đã được restock."
3. **Order summary** — orderNumber, total, paymentMethod (Bank Transfer)
4. **No-refund clarification** — "Không cần hoàn tiền (chưa thanh toán)" — tránh confusion
5. **CTA primary** — "Đặt lại đơn hàng" → `reorderUrl`
6. **CTA secondary** — "Liên hệ hỗ trợ nếu đã thanh toán" — phòng case edge transfer thành công nhưng không upload proof

### Design reference

[`./email-templates/10-order-auto-cancelled-buyer.html`](./email-templates/10-order-auto-cancelled-buyer.html)

### Notes

- **Phụ thuộc infra mới:** Cần Vercel Cron / scheduled job để detect timeout. Hiện chưa có endpoint — cần plan riêng cho cron job
- **Race condition:** Nếu buyer vừa upload proof đúng lúc cron fire → cần lock (DB transaction) tránh double-process
- **Companion seller email:** `payment-expired-seller` (P2 — nice-to-have) fire cùng lúc cho seller awareness
- **i18n MS:** Translation cần MY-context — tránh dịch literal "expired" (dùng "tamat tempoh" thay vì "tamat masa")

---

## 10. `payment-proof-uploaded-seller` (new — F10 Bank Transfer flow, P0)

> Khi buyer upload payment proof image, seller cần email để biết action: verify proof trong vòng 24h. Đây là **action trigger** quan trọng — không có email này, seller chỉ thấy in-app notif và có thể miss → buyer chờ vô ích → order auto-cancel sai oan.

- **Recipient:** Seller (tenant owners, deduplicated)
- **Trigger:** `POST /api/orders/[id]/payment-proof` — sau khi upload proof thành công + insert proof record
- **Template:** `src/lib/email/templates/payment-proof-uploaded-seller.ts` (NEW)
- **Reply-To:** `customerEmail` (seller có thể reply ngay nếu cần hỏi buyer)
- **Tone:** Urgent amber — "Action required within 24h"
- **Status emoji:** 📸 (proof uploaded) hoặc ⏳ (verify pending)
- **Subject (EN):** `[Action Required] Verify payment proof for Order #{orderNumber}`
- **Subject (MS):** `[Tindakan Diperlukan] Sahkan bukti pembayaran untuk Pesanan #{orderNumber}`
- **i18n key prefix:** `email.paymentProofUploaded.*`

### Input schema

```ts
paymentProofUploadedSellerEmail({
    orderNumber, customerName, customerEmail, total, currency,
    proofImageUrl?,     // optional preview thumb
    uploadedAt,         // Date
    expiresAt,          // Date — verify deadline (uploadedAt + 24h)
    timeRemaining,      // formatted string "23h 45m"
    verifyUrl,          // CTA chính: link tới admin verify screen
    siteName, locale?
})
```

### Layout (key sections)

1. **Header amber** — emoji 📸 + heading "Bukti pembayaran mới"
2. **Urgency banner** — "Verify trong {timeRemaining} — nếu không, order auto-cancel"
3. **Order summary** — orderNumber, customerName, customerEmail, total
4. **Proof preview** — thumbnail nếu có `proofImageUrl` (server-side rendered URL với token)
5. **CTA primary** — "Verify Payment Now" → `verifyUrl` (admin panel)
6. **CTA secondary** — "Reply trực tiếp buyer" (mailto: customerEmail) — case cần hỏi thêm thông tin

### Design reference

_[Cần design mới — chưa có HTML trong bundle]_

### Notes

- **Dependency endpoint:** `POST /api/orders/[id]/payment-proof` cần tồn tại trước (F10 in-progress trên branch `docs/F10-manual-payment-verification`)
- **Owner enumeration:** Reuse helper `get-tenant-owner-emails.ts` (plan phase-04)
- **Dedupe:** Multiple owners → 1 email mỗi owner, không double-fire khi buyer upload nhiều lần (chỉ fire ở proof đầu tiên hoặc khi re-upload sau reject)
- **Security:** `proofImageUrl` phải là signed URL (token-based) — không leak public access đến private payment proof

---

## 11. `payment-expired-seller` (new — F10 Bank Transfer flow, P2 nice-to-have)

> Khi cron job auto-cancel order do timeout 24h, seller nhận email awareness. P2 vì in-app notif đã đủ cho most case — email chỉ thêm safety net cho seller không login admin thường xuyên.

- **Recipient:** Seller
- **Trigger:** Cron job 24h timeout — order auto-cancel → fire cùng lúc với `#9 payment-timeout-cancelled-buyer`
- **Template:** `src/lib/email/templates/payment-expired-seller.ts` (NEW)
- **Tone:** Neutral info (không urgent — không cần seller action)
- **Status emoji:** ⏰
- **Subject (EN):** `Order #{orderNumber} auto-cancelled — payment timeout`
- **Subject (MS):** `Pesanan #{orderNumber} dibatalkan automatik — tempoh pembayaran tamat`
- **i18n key prefix:** `email.paymentExpiredSeller.*`

### Input schema

```ts
paymentExpiredSellerEmail({
    orderNumber, customerName, customerEmail, total, currency,
    placedAt, expiredAt,
    restockedItems,     // string[] hoặc count — confirm items đã restock
    viewOrderUrl,       // CTA: xem order detail (read-only state)
    siteName, locale?
})
```

### Layout (key sections)

1. **Header grey** — emoji ⏰ + heading "Order auto-cancelled"
2. **Status summary** — "Buyer không upload payment proof trong 24h. Đơn hàng đã huỷ và sản phẩm đã được restock."
3. **Order info** — orderNumber, customerName, total, placedAt → expiredAt
4. **Restock confirmation** — list items đã restock (transparency cho seller)
5. **CTA** — "View Order Details" → `viewOrderUrl` (read-only audit)

### Design reference

_[Cần design mới — chưa có HTML trong bundle]_

### Notes

- **P2 priority:** Có thể defer sang plan v2 nếu in-app notif sufficient
- **Cron dependency:** Same job triggers `#9 payment-timeout-cancelled-buyer` — fire cả 2 trong cùng transaction
- **No action required:** Đảm bảo tone không tạo cảm giác urgent cho seller (khác hẳn `#10 payment-proof-uploaded-seller`)

---

## Bonus: `order-confirmation` redesign

> Template `order-confirmation` đã production-wired ở Stripe webhook, nhưng bundle có 1 thiết kế mới (`01-order-confirmation-buyer.html`). Cân nhắc adopt như visual refresh trong cùng plan rollout (out of scope `260519-1549-commerce-email-rollout` hiện tại — có thể add Phase 06 hoặc plan riêng).

- **Design reference:** [`./email-templates/01-order-confirmation-buyer.html`](./email-templates/01-order-confirmation-buyer.html)
- **Current code:** `src/lib/email/templates/order-confirmation.ts`

### Layout

_[Header warning style, failure reason, next steps (retry / contact support), refund timeline nếu paid]_

### Notes

_[Differentiate clearly từ cancelled — "failed" = shipping/payment failure ngoài ý muốn]_

---

## Checklist trước khi handoff cho dev

- [ ] Tất cả 8 sections có design reference (Figma/image)
- [ ] Subject EN + MS đầy đủ
- [ ] Color tokens không khác default (hoặc note rõ override)
- [ ] Special components (button, table, badge) reference component nào trong design system
- [ ] Variable content rules rõ ràng (vd: hide section nếu data null)
- [ ] Mobile responsiveness verified ≤ 375px viewport
