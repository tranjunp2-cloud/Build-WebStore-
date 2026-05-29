# F33 Discount Setting CMS — Design & Wireframe Report

> **Epic:** Discount Management
> **Feature Code:** F33
> **Version:** 1.0
> **Created:** 2026-05-29
> **Figma Design:** [\[Placeholder Link\]](https://www.figma.com/design/)
> **Decisions:** [F33 PRD](../prd/F33-discount-cms.md) · Issue [#1114](https://github.com/primeproduction/ech-prime-web-v2/issues/1114)

Tài liệu này cung cấp bản vẽ Wireframe chi tiết cho bộ tính năng Quản lý Discount (F33), bám sát các luồng đã định nghĩa trong PRD và User Stories. Tất cả giao diện tuân thủ **F18 CMS Global Layout** (Sidebar trái và Topbar giữ nguyên).

---

## 1. Màn Hình Chính: Danh Sách Discount (Discounts Dashboard)

*Màn hình quản lý tổng quan. Điểm nhấn là Thanh tìm kiếm/lọc và Data Table hiển thị discount.*

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                           [👤 Admin]│
├──────────────┬──────────────────────────────────────────┤
│ 🏠 Dashboard │ 🎁 Discounts                             │
│ 📦 Products  │                                          │
│ 🛒 Orders    │ [+ Create Discount]                      │
│ 🎁 Discounts │                                          │
│ ⚙️ Settings  │ [🔍 Search code or description...]       │
│              │ [Status ▼] [Type ▼] [ Filters ✕ ]        │
│              │                                          │
│              │ ┌────────────────────────────────────────┐ │
│              │ │ Code      │ Type  │ Value │ Status    │ │
│              │ │ Limit/Use │ Expiry│ Actions           │ │
│              │ ├────────────────────────────────────────┤ │
│              │ │ SUMMER50  │ Pct   │ 50%   │ Active ✓  │ │
│              │ │ 10/3      │ 2026-08-31    │ [E] [D]   │ │
│              │ ├────────────────────────────────────────┤ │
│              │ │ NEWUSER20 │ Fixed │ RM20  │ Active ✓  │ │
│              │ │ Unlim     │ None  │ [E] [D]           │ │
│              │ ├────────────────────────────────────────┤ │
│              │ │ SPRING30  │ Pct   │ 30%   │ Inactive  │ │
│              │ │ 50/45     │ 2026-06-01    │ [E] [D]   │ │
│              │ └────────────────────────────────────────┘ │
│              │                                          │
│              │ [ ◀ Prev ] [ 1 | 2 | 3 ] [ Next ▶ ]     │
└──────────────┴──────────────────────────────────────────┘
```

### 1.1. List View — Columns

| Column | Content | Notes |
|--------|---------|-------|
| Code | "SUMMER50" | Clickable → opens edit drawer/form |
| Type | "Percentage" or "Fixed" | Small badge/icon |
| Value | "50%" or "RM20" | Unit matched to type |
| Status | "Active ✓" or "Inactive" | Color badge: green/gray |
| Limit/Used | "10/3" or "Unlimited" | Shows usageCount / usageLimit |
| Expiry | "2026-08-31" or "No limit" | Date or dash |
| Actions | [Edit] [Delete] | Icon buttons |

### 1.2. Search & Filter Bar

```text
[🔍 Search code or description...]
[Status: All ▼]  [Type: All ▼]
[+ Filter ▼]  [ Apply ]  [ Clear All ✕ ]
```

- **Search:** Real-time or debounced (300ms); matches code + description.
- **Status filter:** [All] [Active] [Inactive]
- **Type filter:** [All] [Percentage] [Fixed]
- **Filter behavior:** AND logic (Status=Active AND Type=Percentage shows only active % discounts).
- **Clear:** Single "Clear All ✕" button removes all active filters.

### 1.3. Create Button

Prominent `[+ Create Discount]` button, top-left of content area (or top-right).
Clicking opens the **Create/Edit Form** (see §2).

---

## 2. Form: Thêm/Sửa Discount (Create / Edit Form)

*Form dọc, chia thành các section. Modal hoặc dedicated page.*

```text
┌──────────────────────────────────────────────────────────┐
│ < Back to List       [Save]  [Cancel]                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─ 1. THÔNG TIN CƠ BẢN ─────────────────────────────────┐ │
│ │ Mã Discount (Code) * [Required]                       │ │
│ │ [ SUMMER50 (auto-UPPERCASE) ]                         │ │
│ │ ℹ️ Unique per your tenant. Auto-normalized to CAPS.   │ │
│ │ ⚠️ Error (if invalid): "Code already in use"          │ │
│ │                                                       │ │
│ │ Mô tả (Description) [Optional]                       │ │
│ │ [ Discount for summer sale on all items ]             │ │
│ │ Max 500 characters                                    │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─ 2. LOẠI & GIÁ TRỊ ────────────────────────────────────┐ │
│ │ Loại Discount *                                       │ │
│ │ ○ Percentage (%)  ○ Fixed Amount (sen/RM)             │ │
│ │                                                       │ │
│ │ Giá Trị (Value) * [Required]                          │ │
│ │ [ 50 _______ ] [Unit: % OR RM / sen]                  │ │
│ │                                                       │ │
│ │ ℹ️ Percentage: 0–100. Fixed: ≥ 0 sen (e.g. 2000=RM20)│ │
│ │ ⚠️ Error (if out of bounds): "Percentage must be..."  │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─ 3. TRẠNG THÁI & HẠNG CHỈ ─────────────────────────────┐ │
│ │ Trạng Thái (Status) * [Required]                      │ │
│ │ ○ Active (Hiệu lực)  ○ Inactive (Không dùng)          │ │
│ │                                                       │ │
│ │ Hạn Dùng (Usage Limit) [Optional]                     │ │
│ │ [ 10 _______ ] [lượt]                                 │ │
│ │ (Để trống = Unlimited — không giới hạn số lượt)       │ │
│ │                                                       │ │
│ │ Đã Dùng (Usage Count) [Read-Only]                     │ │
│ │ [ 3 _______ ] (Không thể sửa — tự động tính)          │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─ 4. NGÀY HIỆU LỰC ─────────────────────────────────────┐ │
│ │ Ngày Bắt Đầu (Start Date) [Optional]                 │ │
│ │ [ 2026-06-01 ___________ ] [Chọn ngày]                │ │
│ │ (Để trống = Hiệu lực ngay lập tức)                    │ │
│ │                                                       │ │
│ │ Ngày Hết Hạn (Expiry Date) [Optional]                │ │
│ │ [ 2026-08-31 ___________ ] [Chọn ngày]                │ │
│ │ (Để trống = Không hết hạn)                            │ │
│ │                                                       │ │
│ │ ⚠️ Error (if start ≥ expiry): "Start date must be..." │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                          │
│                   [Save Discount] [Cancel]               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.1. Field Behavior

| Field | Type | Validation | Notes |
|-------|------|-----------|-------|
| Code | Text | Required; unique per tenant; auto-uppercase; max 50 chars | Trimmed + normalized |
| Description | Textarea | Optional; max 500 chars | Marketing notes |
| Type | Radio | Required; default "Percentage" | Switches value unit label |
| Value | Number | Type-dependent (0–100 for %, ≥0 for fixed) | Decimal OK for fixed |
| Status | Radio | Required; default "Active" | Color coded (green/gray) |
| Usage Limit | Number | Optional; if set, must be ≥1 | Empty = unlimited |
| Usage Count | Number | Read-only; grayed out | Hook-only |
| Start Date | Date picker | Optional; format YYYY-MM-DD | Inclusive start-of-day |
| Expiry Date | Date picker | Optional; format YYYY-MM-DD | Inclusive end-of-day |

### 2.2. Error Handling (Inline)

- **Code duplicate:** "Discount code 'SUMMER50' already exists for your tenant."
- **Percentage out of range:** "Percentage must be between 0 and 100."
- **Fixed amount invalid:** "Fixed amount must be ≥ 0 sen."
- **Date range invalid:** "Start date must be before expiry date."
- **Server error on save:** Toast: "Failed to save discount. Please try again."

### 2.3. Type-Dependent Display

```
When Type = "Percentage" selected:
  Value unit label: "%"
  Value bounds: 0–100
  Validation: "Please enter a value between 0 and 100"

When Type = "Fixed Amount" selected:
  Value unit label: "sen (RM / 100)"
  Value bounds: ≥0
  Validation: "Please enter an amount ≥ 0 sen"
```

---

## 3. Discount Usage History View (Read-Only)

*Separate collection in admin: "Discount Usage History". Shows every time a discount was applied to an order.*

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                           [👤 Admin]│
├──────────────┬──────────────────────────────────────────┤
│ 🏠 Dashboard │ 📊 Discount Usage History                │
│ 📦 Products  │                                          │
│ 🛒 Orders    │ [🔍 Search code or order #...]           │
│ 🎁 Discounts │ [Date Range ▼] [ Filters ✕ ]             │
│ ⚙️ Settings  │                                          │
│              │ ┌──────────────────────────────────────┐ │
│              │ │ Code      │ Amount │ Order # │ Email │ │
│              │ │ Used Date │ Actions                  │ │
│              │ ├──────────────────────────────────────┤ │
│              │ │ SUMMER50  │ RM50   │ #1001   │ cust@│ │
│              │ │ 2026-05-29│ —                        │ │
│              │ ├──────────────────────────────────────┤ │
│              │ │ NEWUSER20 │ RM20   │ #1002   │ user@│ │
│              │ │ 2026-05-28│ —                        │ │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │ [ ◀ Prev ] [ Page 1 of 15 ] [ Next ▶ ] │
└──────────────┴──────────────────────────────────────────┘
```

### 3.1. List Columns

| Column | Content | Notes |
|--------|---------|-------|
| Code | "SUMMER50" | Discount code (snapshot) |
| Type | "Percentage", "Fixed" | Small badge |
| Amount Applied | "RM50" or "RM20" | Discounted amount |
| Order # | "#1001" | Clickable → opens order detail |
| Customer Email | "customer@example.com" | Snapshot; truncated if long |
| Used Date | "2026-05-29 14:30" | ISO format, sorted newest first |
| Actions | — | No edit/delete (read-only) |

### 3.2. Read-Only Badge

Each row or collection header shows: **🔒 Audit history — read-only**

---

## 4. Checkout Flow — Discount Code Input & Display

### 4.1. COD/QR Checkout

```text
┌────────────────────────────────────────────────────────────┐
│ CHECKOUT — Payment Method: COD                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌─ Order Summary ──────────────────────────────────────┐  │
│ │ Product 1 (x2)                          RM 100.00     │  │
│ │ Subtotal                                RM 100.00     │  │
│ │                                                       │  │
│ │ ┌─ Discount Code ──────────────────────────────────┐ │  │
│ │ │ [Promo / Discount Code...     ] [Apply]         │ │  │
│ │ │ ℹ️ Have a promo code? Enter it here.             │ │  │
│ │ │                                                 │ │  │
│ │ │ ✓ Discount Applied: SUMMER50 (−RM50.00) [✕]     │ │  │
│ │ └─────────────────────────────────────────────────┘ │  │
│ │                                                       │  │
│ │ Subtotal (after discount)               RM 50.00     │  │
│ │ Shipping Fee                            RM 10.00     │  │
│ │ Tax (6%)                                RM 3.60      │  │
│ │ ─────────────────────────────────────────────────────│  │
│ │ Grand Total                             RM 63.60     │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                            │
│ [Continue to Payment]  [Cancel]                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**States:**
1. **Initial:** Code input + placeholder text "Promo / Discount Code..."
2. **Applied (success):** "✓ Discount Applied: SUMMER50 (−RM50.00)" + [✕] remove button.
3. **Rejected (silent):** Input clears, no error; total shows full price (as if code never entered).
4. **Error (optional UX):** "Code not found or expired" (can be silent per spec, but optional toast OK).

### 4.2. Stripe Checkout

```text
┌────────────────────────────────────────────────────────────┐
│ CHECKOUT — Payment Method: Stripe (Card)                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌─ Order Summary ──────────────────────────────────────┐  │
│ │ [Same as above, with discount applied]              │  │
│ │ Subtotal (after discount)               RM 50.00     │  │
│ │ Shipping Fee                            RM 10.00     │  │
│ │ Tax (6%)                                RM 3.60      │  │
│ │ ─────────────────────────────────────────────────────│  │
│ │ Grand Total                             RM 63.60     │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                            │
│ ┌─ Discount Code (before Stripe) ─────────────────────┐  │
│ │ [Promo / Discount Code...     ] [Apply]             │  │
│ └────────────────────────────────────────────────────┘  │
│                                                            │
│ [Proceed to Stripe Payment]  [Cancel]                    │
│                                                            │
│ (When clicked, redirects to Stripe session with          │
│  finalAmount = RM 63.60)                                 │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Behavior:** Same discount code input as COD/QR. On success, Stripe charged RM 63.60 (finalAmount).

---

## 5. Email Receipt — Discount Line

*Sent after successful order placement (COD/QR/Stripe).*

```text
═══════════════════════════════════════════════════════════

                   ORDER CONFIRMATION #1001

───────────────────────────────────────────────────────────

ORDER DETAILS:

Product: Baju Kurung (Red, Size M)  ×2        RM 100.00
                                    Subtotal  RM 100.00

Discount (SUMMER50)                          −RM 50.00
                                    Subtotal  RM 50.00
Shipping Fee                                  RM 10.00
Tax (6%)                                      RM 3.60
                                   ─────────────────────
                             TOTAL DUE        RM 63.60

───────────────────────────────────────────────────────────

Payment Method: Cash on Delivery
Status: Awaiting Payment Confirmation

Thank you for your purchase!

═══════════════════════════════════════════════════════════
```

**Key line:** "Discount (SUMMER50) −RM 50.00" (or −RM X.XX for fixed), shown only if discount applied.

---

## 6. Admin Settings (Optional Panel)

*If merchant wants to view / disable discounts globally (future iteration).*

```text
┌─────────────────────────────────────────────────────────┐
│ ⚙️ Discount Settings                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ☑️ Enable discounts for this store                     │
│    (When unchecked, all promo codes silently rejected) │
│                                                         │
│                        [Save Settings]                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Note:** Out of scope for F33 (Phase 1). Future enhancement.

---

## 7. Responsive Design Notes

### Desktop (1024px+)
- Full form layout as shown above.
- Sidebar + content side-by-side.
- List table scrolls horizontally if needed.

### Tablet (768–1023px)
- Sidebar collapses to icon-only or drawer.
- Form fields stack vertically (full width).
- List table columns may reflow or scroll.

### Mobile (< 768px)
- Sidebar hidden behind hamburger menu.
- Form single-column, full width.
- List table: horizontal scroll or card view (one discount per card).
- Discount code input on checkout: full-width text field + button below.

---

## 8. Color & Typography Reference

### Palette (F18 CMS Global Layout)
- **Primary:** Brand color (e.g., blue)
- **Success:** Green (`#10B981`) — "Active" status, applied discount
- **Warning:** Amber (`#F59E0B`) — "At-limit approaching" (future), date soon expiring
- **Danger:** Red (`#EF4444`) — "Inactive" status, expired, error
- **Neutral:** Gray (`#6B7280`) — Read-only fields, disabled actions

### Typography
- **Headers:** Semibold 18–24px
- **Labels:** Medium 12–14px
- **Input/Display:** Regular 14–16px
- **Hint text:** Regular 12px, gray

---

## 9. Accessibility & Keyboard Navigation

- All form inputs labeled with `<label>` (or aria-label).
- Error messages associated with fields via `aria-describedby`.
- Keyboard: Tab through inputs → Save/Cancel buttons.
- Delete action: Confirmation dialog (prevent accidental deletion).
- Screen reader: "Discount code, required, text input" + error state.

---

## 10. State Transitions & Edge Cases

| Scenario | UI Behavior |
|----------|-------------|
| Discount approaching expiry (< 7 days) | Optional amber badge "Expiring soon" |
| Discount at-limit (usage = limit) | Badge "Limit reached"; still editable (status toggle to disable) |
| No discounts exist | Empty state: "No discounts yet. [+ Create Discount]" |
| Search yields no results | "No discounts match your search." + clear button |
| Form submit in progress | [Save] button shows spinner, disabled |
| Network error on save | Toast: "Failed to save. Please try again." |
| Code already copied (UX future) | Clipboard icon → tooltip "Copied!" |

---

## References

- **PRD:** [F33-discount-cms.md](../prd/F33-discount-cms.md)
- **Stories:** [F33-discount-cms-stories.md](../stories/F33-discount-cms-stories.md)
- **Plan:** [`plans/260529-1135-f33-discount-cms/`](../../plans/260529-1135-f33-discount-cms/)
- **Related Design:** [F10 Orders Management](F10-orders-management-design.md) (Checkout layout reference)
- **Payload Admin UI:** Standard Payload 3.x CMS patterns (list + form)
