# Phase 01 — Gỡ dead code `oversellReview`

**Priority:** P1 | **Status:** ⬜ Pending | **Single agent (atomic — schema + consumers cùng lúc)**

## Context
- Plan: [plan.md](plan.md)
- Báo cáo QA: issue #1099 comments (Bug 3 / TC-F13.145/172)

## Key insight
`oversellReview` không bao giờ được set `true` (decrement upfront làm oversell-after-capture bất khả thi). Field + nhánh refund + UI banner = dead code. Gỡ ở code, GIỮ column DB (NEVER DROP).

## Implementation steps (theo thứ tự)

### 1. `src/collections/Orders.ts` — gỡ field
Gỡ block (kèm comment header `// --- Oversell review (US-F13-06) ---`):
```ts
        // --- Oversell review (US-F13-06) ---
        {
            name: 'oversellReview',
            type: 'checkbox',
            defaultValue: false,
            index: true,
            admin: { description: 'Stock oversold after payment captured — seller must decide on a manual refund' },
        },
```
> Sau bước này Payload regenerate types → `order.oversellReview` thành lỗi TS ở các file dưới (đúng kỳ vọng).

### 2. `src/app/api/orders/[id]/refund/route.ts` — gỡ 3 chỗ
**a) Pre-check (dòng ~54-64):** sửa comment + bỏ `&& !order.oversellReview`:
```ts
    // Only shipped/completed orders can be refunded — mirrors the dashboard UI gate.
    if (order.status === 'refunded') { ... }   // giữ nguyên
    const refundableStatuses = ['shipped', 'completed']
    if (!refundableStatuses.includes(order.status)) {   // BỎ "&& !order.oversellReview"
```
**b) CAS bank_transfer/cod (dòng ~153-155):**
```sql
UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = NOW()
WHERE id = ${order.id}
AND status = ANY(ARRAY['shipped','completed']::enum_orders_status[])
RETURNING id
```
> Bỏ `oversell_review = false` khỏi SET và bỏ `OR oversell_review = true` khỏi WHERE.

**c) CAS Stripe (dòng ~232-234):** sửa y hệt (b).

### 3. `src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx` — gỡ 4 chỗ
- **Dòng 6:** bỏ `AlertTriangle` khỏi import `lucide-react` (chỉ banner dùng) → `import { Loader2, ZoomIn, X } from 'lucide-react'`
- **Dòng 52:** bỏ `oversellReview?: boolean` khỏi type order
- **Dòng 882:** `const refundDisabled = isLoading || !['shipped', 'completed'].includes(status)` (bỏ `|| order.oversellReview`)
- **Dòng 1057-1083:** gỡ toàn bộ block `{/* Oversell Warning Banner */}` ... `{order.oversellReview && (...)}`

### 4. `src/__tests__/api/stripe-refund.test.ts` — cập nhật test
- Gỡ TC-F13.146 (dòng 314-340) — không còn oversell exception.
- Regression test (343-363): GIỮ (vẫn đúng — status=new bị chặn refund) nhưng bỏ field `oversellReview: false` khỏi mock order và bỏ chữ "without oversellReview flag" trong tên it → `it('rejects refund for status=new order (not shipped/completed)', ...)`.

### 5. `src/__tests__/unit/payment/reconcile-order-paid.test.ts` — sửa tên describe
- Dòng 38: `describe('[TC-F13.143] reconcileOrderPaid — idempotency', ...)` (bỏ "& oversell").

### 6. `scripts/db-setup.js` — GIỮ migration, thêm comment
Tại dòng ~4077, sửa comment để ghi rõ column được giữ lại có chủ đích:
```js
  // ── F13 US-F13-06: oversell_review column RETAINED per NEVER-DROP policy.
  //    Field removed from Orders collection (GH-1099): decrement-upfront architecture makes
  //    oversell-after-capture impossible, so the flag was dead code. Column kept (harmless, default false). ──
  { name: 'orders.oversell_review',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS oversell_review boolean DEFAULT false;` },
```

## Validation
```bash
# 1. Không còn ref ở code (chỉ còn comment db-setup.js + comment giải thích)
grep -rn "oversellReview\|oversell_review" src --include="*.ts" --include="*.tsx"   # → rỗng
# 2. Typecheck
npx tsc --noEmit
# 3. Test
npm test -- stripe-refund reconcile-order-paid
# 4. CI migration gate
node scripts/check-migrations.js
```

## Todo
- [ ] B1: gỡ field Orders.ts
- [ ] B2: gỡ 3 chỗ refund/route.ts
- [ ] B3: gỡ 4 chỗ OrderDetailPanel.tsx (+ import)
- [ ] B4: cập nhật stripe-refund.test.ts
- [ ] B5: sửa tên describe reconcile test
- [ ] B6: comment db-setup.js (giữ migration)
- [ ] B7: chạy validation (grep + tsc + test + check-migrations)

## Success criteria
- grep ref rỗng (trừ comment), tsc pass, test pass, check-migrations pass
- Hành vi refund không đổi: shipped/completed refund OK; new/pending/refunded bị chặn

## Risk
- **Refund regression:** thấp — oversellReview luôn false nên nhánh OR vốn đã không active; gỡ = no-op hành vi.
- **Orphan DB column:** vô hại; check-migrations baseline chỉ WARN.
- **Type drift:** Payload regenerate types tự bắt mọi ref sót qua tsc.
