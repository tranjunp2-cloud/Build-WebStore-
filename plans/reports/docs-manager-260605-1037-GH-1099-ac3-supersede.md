# Docs Sync Report: GH-1099 AC-3 Oversell Supersede (F13)

**Status:** DONE

**Summary:** Cập nhật docs F13 để phản ánh quyết định: AC-3 (oversell-detect-after + manual seller refund) bị **SUPERSEDED** bởi prevent-upfront kiến trúc (GH-1099, PR #1160). Stock decrement đã move từ webhook (post-capture) sang checkout (pre-redirect) với atomic CAS. Oversell bây giờ **impossible**.

---

## Changes Made

### 1. `docs/prd/F13-payment-gateway.md`
- **Line 64-66** (§4 Scope): Cập nhật mô tả "Atomic stock decrement" → thêm CAS detail, ghi rõ prevent-upfront; gỡ bỏ "oversell flag + seller manual refund" → mark SUPERSEDED.
- **Line 132-134** (FR-17, FR-18): 
  - FR-17: Cập nhật mô tả → "Stock decrement MUST be atomic at checkout; CAS prevents oversell upfront"
  - FR-18: Ghi rõ **SUPERSEDED GH-1099** → oversell detect-after deprecated; rendered obsolete by prevent-upfront (FR-17 CAS)
- **Line 350** (Wave 7+ limitations table): Mark "Refund UI on oversell" OBSOLETE; ghi lý do oversell không còn có thể.

### 2. `docs/stories/F13-payment-gateway-stories.md`
- **AC-2** (dòng ~324-331): Rewrite mô tả stock decrement → CAS tại checkout (prevent-upfront), KHÔNG webhook
  - Thêm: "IF inventory >= qty → order created" và "IF inventory < qty → 422 OUT_OF_STOCK, order not created"
- **AC-3** (dòng ~333-339): Ghi chú **SUPERSEDED GH-1099, PR #1160**; giữ nội dung cũ kèm rationale mới
  - Giải thích: oversell không còn possible vì CAS tại checkout
  - NO SYSTEM_ALERT, NO admin refund button, NO post-capture handling
- **Definition of Done** (dòng ~377-385):
  - Mark ~~"Oversell flag tested; admin refund button wired"~~ → OBSOLETE
  - Thêm: "Stock decrement moved to checkout; CAS tested"
  - Ghi: oversell_review column giữ lại (NEVER-DROP rule) nhưng không dùng

### 3. `docs/architecture/F13-payment-gateway.md`
- **§2.1 Checkout flow** (dòng ~32-53): Thêm **[GH-1099]** block chi tiết CAS + prevent-upfront
  - CAS logic: `UPDATE products SET inventory = GREATEST(0, inventory - qty) WHERE id=? AND inventory >= qty`
  - Xử lý: inventory < qty → 422, order not created, cart preserved
  - Kết luận: "Oversell impossible due to atomic stock validation"
- **§2.4 Reconcile artifact** (dòng ~142-165): Xóa mô tả stock decrement từ webhook; thêm note:
  - "NO stock decrement here — already done at checkout"
  - Block cũ §2.4a (oversell handling) rename → **SUPERSEDED**; giải thích rationale chuyển từ detect-after sang prevent-upfront
- **§3 Components Map** (line 242-243): Update Tenants/Orders schema comment
  - Tenants: gỡ `oversellReview` (chỉ có trong Orders)
  - Orders: mark oversellReview ~~deprecated~~
- **§4.2 Order schema** (dòng ~274-285): Comment oversellReview field; ghi "DEPRECATED — kept for backward-compat"
- **§4.3 Migration** (dòng ~288-309): Thêm note (GH-1099):
  - oversell_review column kept per NEVER-DROP; NOT set in code paths post-PR #1160
- **§17 Known Limitations** (dòng ~591-602): Mark "Refund UI on oversell" OBSOLETE

### 4. `docs/decisions/decisions-log.md`
- Thêm **PD-018** mới (vị trí trước PD-018 cũ, giờ là PD-019):
  - **Decision:** AC-3 oversell-detect-after SUPERSEDED → prevent-upfront
  - **Chosen:** Prevent-upfront (atomic CAS at checkout)
  - **Rationale:** Simpler, safer, fail-fast, zero post-capture ambiguity
  - **Impact:** PR #1160, code + docs + QA changes
  - **Status:** ✅ Decided 2026-06-04

---

## Traceability

| Document | AC/FR | Status | Note |
|----------|-------|--------|------|
| PRD | FR-17 | ✅ Updated | Describe prevent-upfront |
| PRD | FR-18 | ✅ Updated | Mark SUPERSEDED |
| Stories | AC-2 | ✅ Updated | Stock decrement moved to checkout |
| Stories | AC-3 | ✅ Updated | Mark SUPERSEDED; keep old text + rationale |
| Architecture | §2.1 | ✅ Updated | Detail CAS + prevent-upfront logic |
| Architecture | §2.4 | ✅ Updated | NO webhook stock decrement; mark §2.4a SUPERSEDED |
| Architecture | §4.2 | ✅ Updated | Mark oversellReview deprecated |
| Architecture | §4.3 | ✅ Updated | Migration note (GH-1099) |
| Decisions | PD-018 | ✅ Added | New decision log entry |
| QA doc | (not touched) | — | TC-F13.145/146 already marked OBSOLETE in v1.6 |

---

## Key Points

1. **Prevent-upfront > detect-after:** CAS tại checkout loại bỏ post-capture risk; oversell không thể xảy ra do cấu trúc
2. **No refund UI needed:** Không có oversell → không cần admin refund button
3. **oversellReview field:** Deprecated nhưng giữ trong schema (NEVER-DROP); không được set hoặc check ở code
4. **Backward-compat:** Existing orders có `oversell_review` column không ảnh hưởng; cột giữ lại
5. **Clear rationale:** Docs giữ lại old approach kèm note "SUPERSEDED" để trace quyết định lịch sử

---

## Files Modified

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/docs/prd/F13-payment-gateway.md`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/docs/stories/F13-payment-gateway-stories.md`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/docs/architecture/F13-payment-gateway.md`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/docs/decisions/decisions-log.md`

---

## Concerns / Notes

- None — all updates complete; traceability maintained; backward-compat preserved.
