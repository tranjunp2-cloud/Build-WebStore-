# Code Review — GH-1099 (US-F13-06): Remove `oversellReview` dead code

**Branch:** fix/1099-F13-06-reliable-payment-rework vs origin/staging
**Reviewer:** code-reviewer | **Date:** 2026-06-04
**Verdict:** APPROVE — refactor sạch, không lỗi correctness/safety. 0 blocking issue.

## Scope
- Files: 6 (Orders.ts, refund/route.ts, OrderDetailPanel.tsx, stripe-refund.test.ts, reconcile-order-paid.test.ts, db-setup.js)
- Diff: +18 / -82 (net -64 LOC) — đúng tính chất gỡ dead code
- Type: refactor thuần, gỡ field không bao giờ set `true`

## Overall Assessment
Refactor đúng và an toàn. Tiền đề "dead code" được xác minh độc lập (xem dưới). Hành vi refund không đổi với đơn shipped/completed; các chặn cũ vẫn nguyên. Giữ column DB đúng rule NEVER-DROP, có comment giải thích rõ. Tests sửa lại trung thực, không fake.

## 1. Correctness — PASS

**Không còn ref tầng code:** `grep -rn oversell src/ scripts/` chỉ còn:
- 2 comment không liên quan (stock-utils.ts:17, checkout/route.ts:268 — nói về CAS chống oversell, hợp lệ giữ).
- db-setup.js: comment + migration `oversell_review` (cố ý giữ).
- 0 ref `oversellReview`/`oversell_review` ở mọi nơi đọc/ghi của application code. Xác nhận khớp self-verify.

**Hành vi refund (refund/route.ts):** logic mới đúng và đầy đủ:
- `status === 'refunded'` → 400 ALREADY_REFUNDED (giữ nguyên).
- `status ∈ {shipped, completed}` → cho refund (không đổi).
- `new / pending / processing / confirmed / paid / cancelled` → 400 ORDER_NOT_REFUNDABLE.
- 2 CAS SQL gỡ `oversell_review = false` (write) và `OR oversell_review = true` (WHERE) — đối xứng, đúng. Pre-check JS và CAS WHERE giờ nhất quán (cùng chỉ {shipped, completed}), không còn lệch điều kiện giữa 2 tầng.

**Tiền đề dead code đã verify độc lập:**
- `reconcile-order-paid.ts` — comment dòng 28/32-35 xác nhận KHÔNG decrement stock; stock decrement upfront ở checkout.
- `approve-payment/route.ts` — chỉ `pending → confirmed`, không decrement, không set oversell.
- Không path nào tạo đơn `status='new' + oversellReview=true` sau capture ⇒ exception cũ thật sự bất khả thi. Gỡ là đúng.

## 2. Safety (Payload/Drizzle) — PASS

`src/payload.config.ts:163` → `push: shouldPushSchema()`, và shouldPushSchema chỉ true ở local dev (NODE_ENV=development), **never push ở production**. Schema staging/prod do `scripts/db-setup.js` migration thủ công quản lý.
⇒ Gỡ field `oversellReview` (có `index: true`) khỏi collection KHÔNG làm Drizzle drop column/index trên staging/prod. Column + migration giữ nguyên, default false, harmless. Đúng thiết kế Hướng A.
- check-migrations pass (self-verify) — phù hợp vì migration vẫn còn trong MIGRATIONS array.
- Lưu ý vô hại: ở **local dev** push=true, Drizzle có thể drop column `oversell_review` + index trên DB local của dev. Không ảnh hưởng staging/prod, không cần xử lý. (informational)

## 3. Test integrity — PASS

- `stripe-refund.test.ts`: gỡ TC-F13.146 (test exception đã không còn tồn tại — đúng phải gỡ). Regression test đổi tên + đơn giản hóa nhưng **giữ assertion thực**: status=new → 400 ORDER_NOT_REFUNDABLE + `mockRefundsCreate` NOT called. Đây chính là hành vi mới. Không fake, không nới lỏng để pass.
- `reconcile-order-paid.test.ts`: chỉ sửa tên describe (bỏ chữ "oversell"). Cosmetic, hợp lý.
- 408 tests pass (self-verify) khớp.

## 4. Dead code liên đới — không sót gì blocking

Đã kiểm: import `AlertTriangle` gỡ đúng (banner là consumer duy nhất trong file — verified không còn dùng). Type field `oversellReview?` gỡ khỏi `OrderDetail` interface đúng.

Không phát hiện dead code liên đới còn sót. `defaultValue: false` của field cũ không để lại helper/constant mồ côi.

## Positive Observations
- Comment migration trong db-setup.js xuất sắc: giải thích *vì sao* giữ column + *vì sao* dead code — future dev không hiểu nhầm là quên dọn.
- Pre-check JS và CAS WHERE giờ đồng bộ điều kiện, giảm rủi ro drift.
- Diff tối giản, đúng phạm vi, không "tiện tay" sửa thứ khác.

## Recommended Actions
Không có hành động blocking. Có thể merge.
(Optional, non-blocking) Cân nhắc thêm 1 dòng vào docs/CHANGELOG.md ghi nhận field bị gỡ ở tầng code (column giữ) cho người đọc admin/schema sau này — docs-manager xử lý.

## Metrics
- Type: `npx tsc --noEmit` 0 errors (self-verify, khớp)
- Tests: 408 pass / 32 files (self-verify)
- Residual code refs: 0
- Blocking issues: 0 | High: 0 | Medium: 0 | Low: 1 (local-dev index drop, vô hại)

## Unresolved Questions
- Không có. Tiền đề kiến trúc (decrement upfront, reconcile/approve không decrement) đã verify trực tiếp trong code, không cần giả định.
