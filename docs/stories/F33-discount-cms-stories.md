# User Stories: Discount Setting CMS (F33)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F33 — Discount Setting CMS
> **Wave:** 3 | **Priority:** P0/P1 | **Ref PRD:** [F33-discount-cms.md](../prd/F33-discount-cms.md)

---

> [!IMPORTANT]
> **Out of Scope:** Subscription-tier promo codes (TC-F15.14–17, platform-level super-admin feature) are handled separately in F15. F33 covers **merchant-scoped discount management** and **gateway-agnostic checkout apply** (all payment methods: COD, QR-banking, Stripe).

---

## US-F33-01: Tạo discount với loại percentage hoặc fixed

**Wave 3** | **P0** | **S** | Status: Ready

### Story

```
As a   merchant/tenant owner
I want to create a discount code (percentage or fixed amount)
       with optional usage limit and date range
So that I can offer promotions and track their usage
```

### Acceptance Criteria

#### AC-1: Create percentage discount

```gherkin
GIVEN the merchant is in Payload admin, Discounts collection
WHEN  they click [Create Discount]
  AND fill in:
    - Code: "SUMMER50" (auto-uppercase to "SUMMER50")
    - Type: Percentage
    - Value: 50
    - Status: Active
    - Usage Limit: (empty = unlimited)
    - Start Date: 2026-06-01
    - Expiry Date: 2026-08-31
THEN  the discount is saved with value = 50 (representing 50%)
  AND the system validates 0 ≤ value ≤ 100
  AND if value > 100 or < 0 → error "Percentage must be between 0 and 100"
```

#### AC-2: Create fixed discount

```gherkin
GIVEN the merchant is creating a discount
WHEN  they select Type: Fixed
  AND fill in Value: 2500 (representing RM25.00 in sen)
THEN  the discount is saved with value = 2500
  AND the system validates value ≥ 0
  AND if value < 0 → error "Fixed amount must be ≥ 0"
  AND label displays "sen" or "RM" to clarify unit
```

#### AC-3: Unique code per tenant

```gherkin
GIVEN a merchant has already created discount with code "NEWUSER"
WHEN  another user (in same tenant) tries to create code "NEWUSER" again
THEN  system rejects with error "This code is already in use for your tenant"
  AND suggestion: "Try a different code or append a number"

GIVEN the same code exists in DIFFERENT tenant
WHEN  this merchant tries to use it
THEN  system allows it (codes are unique per tenant, not globally)
```

#### AC-4: Optional date range with validation

```gherkin
GIVEN the merchant sets both Start Date and Expiry Date
WHEN  Start Date ≥ Expiry Date
THEN  system rejects with error "Start date must be before expiry date"
  AND the form remains open for correction

GIVEN the merchant leaves both dates blank
WHEN  they save the discount
THEN  the system allows it (always available, no date boundary)
```

#### AC-5: Code normalization

```gherkin
GIVEN the merchant enters code "  summer50  "
WHEN  they save the discount
THEN  code is stored as "SUMMER50" (trimmed + uppercase)
  AND display in list view shows "SUMMER50"
```

### Additional Criteria
- [ ] Form validates on submit; shows inline error messages.
- [ ] Description field is optional (max 500 chars).
- [ ] Status defaults to "Active".
- [ ] usageCount starts at 0 and is **read-only** (merchant cannot edit).

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Discount successfully created + visible in list view
- [ ] Type-specific value bounds enforced
- [ ] Code unique-per-tenant enforced (DB + app validation)
- [ ] Date range validation works
- [ ] TypeScript clean (`tsc --noEmit`)

---

## US-F33-02: Sửa thông tin discount

**Wave 3** | **P0** | **S** | Status: Ready

### Story

```
As a   merchant
I want to edit an existing discount (code, value, status, dates, limit)
So that I can adjust promotions without recreating them
```

### Acceptance Criteria

#### AC-1: Edit any field (except usageCount)

```gherkin
GIVEN a discount exists: code="SUMMER50", value=50%, status=Active
WHEN  merchant opens edit form
THEN  all fields are editable: code, type, value, status, dates, limit
  AND usageCount field is read-only (grayed out)
  AND changes are saved when merchant clicks [Save]
```

#### AC-2: Validation on edit

```gherkin
GIVEN an existing discount with Type=Percentage
WHEN  merchant changes Value to 150
THEN  system rejects with error (same as create, per US-F33-01 AC-1)
  AND form remains open

GIVEN the discount is being edited
WHEN  merchant changes Start Date to be after Expiry Date
THEN  system rejects (same date-range validation as AC-4 in US-F33-01)
```

#### AC-3: Code uniqueness still enforced on edit

```gherkin
GIVEN two discounts: A="SUMMER50", B="WINTER20"
WHEN  merchant tries to rename B → "SUMMER50" (A's code)
THEN  system rejects with "This code is already in use"
  AND merchant can edit other fields (type, value, etc.)

GIVEN a discount with code "SUMMER50" in tenant A
WHEN  merchant in tenant B tries to use "SUMMER50"
THEN  system allows (no conflict)
```

#### AC-4: usageCount preserved

```gherkin
GIVEN a discount has already been used 3 times (usageCount=3, limit=10)
WHEN  merchant edits the discount (change status, dates, value, etc.)
THEN  usageCount remains unchanged (hook does not reset it)
  AND merchant cannot directly edit usageCount
```

### Additional Criteria
- [ ] Edit form pre-populates all current values.
- [ ] Inline validation shows errors without form loss.

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Edit successfully updates discount in database
- [ ] All validation rules from US-F33-01 apply to edit
- [ ] usageCount is immutable during edit
- [ ] TypeScript clean

---

## US-F33-03: Xoá discount

**Wave 3** | **P1** | **XS** | Status: Ready

### Story

```
As a   merchant
I want to delete an old or unused discount
So that my discount list stays clean
```

### Acceptance Criteria

#### AC-1: Delete discount

```gherkin
GIVEN a discount exists in the list
WHEN  merchant clicks [Delete] action on the discount row
THEN  a confirmation dialog appears: "Delete discount 'SUMMER50'?"
  AND merchant confirms [Delete]
  AND the discount is removed from the list
  AND Payload audit log records the deletion
```

#### AC-2: Prevent accidental deletion (soft?)

```gherkin
GIVEN a discount is deleted
WHEN  merchant checks if discount_usage_history records are affected
THEN  usage history records are NOT deleted
  AND they retain the reference to the deleted discount (via discountId FK)
  AND reports still show historical data
```

### Additional Criteria
- [ ] Only merchant (tenant-owner) + super-admin can delete discounts they own/manage.
- [ ] Delete action returns 204 No Content on success.

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Discount successfully deleted
- [ ] Usage history survives deletion
- [ ] Confirm dialog UX tested

---

## US-F33-04: Danh sách discount với search và filter

**Wave 3** | **P0** | **M** | Status: Ready

### Story

```
As a   merchant
I want to view all my discounts in a searchable, filterable list
       with key info at a glance (code, type, value, status, usage, expiry)
So that I can quickly find and manage individual promotions
```

### Acceptance Criteria

#### AC-1: List view with default columns

```gherkin
GIVEN the merchant opens Discounts collection in Payload admin
WHEN  the list loads
THEN  columns are displayed in order:
       | Code | Type | Value | Status | Usage (count/limit) | Expiry Date | Actions |
  AND each discount row shows: "SUMMER50 | Percentage | 50% | Active | 3/10 | 2026-08-31 | [Edit] [Delete]"
  AND rows are sorted by creation date (newest first) or by code (alphabetical)
```

#### AC-2: Search by code or description

```gherkin
GIVEN the list view has a search box (at top)
WHEN  merchant types "SUMMER"
THEN  list filters to discounts matching code or description containing "SUMMER"
  AND matching is case-insensitive
  AND "SUMMER50", "SUMMERSALE", "SUMMER DISCOUNT" all match
  AND empty search shows all discounts

WHEN  merchant clears search
THEN  full list reappears
```

#### AC-3: Filter by status and type

```gherkin
GIVEN filter dropdowns: Status [Active ▼] [Inactive ▼], Type [Percentage ▼] [Fixed ▼]
WHEN  merchant selects Status=Inactive
THEN  list shows only inactive discounts
  AND filter is shown as active (badge or highlight)

WHEN  merchant selects both Type=Percentage AND Status=Active
THEN  list shows only active percentage discounts (AND logic)

WHEN  merchant clears filters
THEN  all discounts reappear
```

#### AC-4: Pagination / Large lists

```gherkin
GIVEN merchant has 50+ discounts
WHEN  list loads
THEN  Payload default pagination appears (e.g., 10/page with prev/next buttons)
  AND merchant can navigate pages without losing search/filter state
```

### Additional Criteria
- [ ] List uses `admin.listSearchableFields: ['code', 'description']` (Payload feature).
- [ ] Columns match PRD FR-01.
- [ ] Click row → opens detail/edit view (standard Payload behavior).

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] List displays all configured columns
- [ ] Search works by code + description (case-insensitive)
- [ ] Filters by status + type work (AND logic)
- [ ] Pagination works smoothly
- [ ] TypeScript clean

---

## US-F33-05: Export danh sách discount thành CSV

**Wave 3** | **P1** | **S** | Status: Ready

### Story

```
As a   merchant
I want to export my discount list to CSV
So that I can analyze promotion performance in spreadsheet tools
```

### Acceptance Criteria

#### AC-1: CSV export button and endpoint

```gherkin
GIVEN the merchant is viewing the Discounts list or dashboard
WHEN  they click [Export CSV] button
THEN  the browser triggers `GET /api/v1/discounts/export`
  AND a file downloads: "discounts-{tenant-name}-{date}.csv"
  AND the file contains all merchant's discounts (tenant-scoped)
```

#### AC-2: CSV structure

```gherkin
GIVEN the export completes
WHEN  merchant opens the CSV
THEN  columns appear (in order):
       Code, Type, Value, Status, Usage Limit, Usage Count, Started At, Expires At, Created At
  AND each discount is one row
  AND dates are formatted: YYYY-MM-DD HH:MM:SS (ISO 8601)
  AND Example row: "SUMMER50,percentage,50,active,10,3,2026-06-01 00:00:00,2026-08-31 23:59:59,2026-05-29 10:30:00"
```

#### AC-3: Tenant-scoped export

```gherkin
GIVEN merchant A and merchant B are different tenants
WHEN  merchant A exports CSV
THEN  only merchant A's discounts are included
  AND merchant B's discounts are NOT in the file

WHEN  super-admin calls /api/v1/discounts/export?tenantId=123
THEN  only tenant 123's discounts are exported
  AND invalid tenantId → error 400
```

#### AC-4: Row cap and error handling

```gherkin
GIVEN merchant has 15,000 discounts (exceeds 10k cap)
WHEN  they request export
THEN  system responds with HTTP 413 Payload Too Large
  AND message: "Export limited to 10,000 rows. Please apply date filter first."

WHEN  unauthenticated user tries to export
THEN  system responds with HTTP 401 Unauthorized
```

#### AC-5: CSV safety (formula injection guard)

```gherkin
GIVEN a discount code is: "=IMPORTXML(...)"
WHEN  exported to CSV
THEN  the cell is prefixed with single quote: "'=IMPORTXML(...)"
  AND spreadsheet displays it as text, not formula
  AND no injection vulnerability
```

### Additional Criteria
- [ ] Export route is self-contained (no shared CSV helper, per Decision 4).
- [ ] `Cache-Control: private, no-store` header (PII: discount codes are marketing assets).
- [ ] Auth via `getCurrentUser()` from `@/lib/auth`.
- [ ] Streaming response (large files).

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] CSV exports successfully with all columns
- [ ] Tenant-scoped: own discounts only
- [ ] Row cap (10k) enforced
- [ ] Formula-injection guard active
- [ ] `/api/v1/discounts/export` route created + tested
- [ ] TypeScript clean

---

## US-F33-06: Áp dụng discount code tại checkout (COD/QR)

**Wave 3** | **P0** | **M** | Status: Ready

### Story

```
As a   customer (shopper at merchant store)
I want to enter a discount/promo code at checkout (COD or QR-banking)
So that I receive the discount on my order total
```

### Acceptance Criteria

#### AC-1: Discount code input field at checkout

```gherkin
GIVEN customer is at the checkout page (COD/QR payment method selected)
WHEN  the page loads
THEN  a text input appears: "Discount or promo code" (with placeholder)
  AND optional [Apply Discount] button (or apply on blur/change)
  AND initially no discount is applied (shows full subtotal)
```

#### AC-2: Apply valid discount

```gherkin
GIVEN a merchant has created discount: code="SUMMER50", type=percentage, value=50, status=active
  AND no date restrictions or limit reached
WHEN  customer enters code "summer50" (lowercase) and clicks [Apply]
THEN  system normalizes to "SUMMER50" and validates
  AND discount is applied: 50% off subtotal
  AND order total updates: "Subtotal: RM100 → Discount: −RM50 → Total: RM50 + shipping + tax"
  AND [Remove Discount] button appears (or code field shows applied state)
```

#### AC-3: Discount applied to subtotal only

```gherkin
GIVEN order:
  - Subtotal: RM100
  - Shipping: RM10
  - Tax (6%): RM6.60
WHEN  50% discount is applied
THEN  discount amount = RM100 * 0.5 = RM50
  AND final total = (100 − 50) + 10 + 6.60 = RM66.60
  AND NOT (100 + 10 + 6.60 − 50) = RM66.60 (same in this case, but conceptually: discount FIRST)
```

#### AC-4: Invalid / expired / at-limit code → silent reject

```gherkin
GIVEN code "EXPIRED_CODE" (status=inactive, OR past expiry, OR at usage limit)
WHEN  customer enters code and clicks [Apply]
THEN  system silently rejects (does NOT show error)
  AND order proceeds at FULL PRICE
  AND code field clears or shows no message
  AND checkout does NOT fail or block

GIVEN code from different tenant or non-existent
WHEN  customer tries to apply it
THEN  same silent reject behavior (no 4xx, no error toast)
```

#### AC-5: Remove discount

```gherkin
GIVEN a discount is applied ("Discount: −RM50")
WHEN  customer clicks [Remove Discount] or clears the code field
THEN  discount is removed
  AND total reverts to full price
  AND order can be placed without discount
```

### Additional Criteria
- [ ] Code input is case-insensitive (backend normalizes).
- [ ] Discount applied before customer places order (not post-order snapshot).
- [ ] On successful order: `discount_usage_history` row is created, `usageCount` incremented.
- [ ] Email receipt shows discount line: "Discount: −RM50.00" if applied.

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Discount code input visible at COD/QR checkout
- [ ] Valid discount applied correctly (50% off subtotal example)
- [ ] Invalid codes silently rejected (order proceeds at full price)
- [ ] Discount removed when customer clears code
- [ ] Usage tracking works (TC-F33.06, see QA spec)
- [ ] Email receipt shows discount line
- [ ] TypeScript clean

---

## US-F33-07: Áp dụng discount code tại checkout (Stripe)

**Wave 3** | **P0** | **M** | Status: Ready

### Story

```
As a   customer paying via Stripe (credit card)
I want to enter a discount code at Stripe checkout
       so I receive the same discount as COD/QR customers
```

### Acceptance Criteria

#### AC-1: Discount code input at Stripe checkout

```gherkin
GIVEN customer selects Stripe (credit card) payment at checkout
WHEN  the Stripe checkout form loads
THEN  a text input appears: "Discount code" (same as COD/QR, US-F33-06 AC-1)
  AND [Apply] button (or apply on blur)
  AND initially no discount is applied
```

#### AC-2: Discount applied via shared computeOrderTotal()

```gherkin
GIVEN same discount as US-F33-06 AC-2: "SUMMER50", 50% off
WHEN  customer enters code at Stripe checkout
THEN  backend calls shared computeOrderTotal(subtotal, shipping, tax, discountAmount)
  AND finalAmount = (100 − 50) + 10 + 6.60 = RM66.60
  AND Stripe is charged EXACTLY RM66.60 (no Stripe Coupon object, no per-line mapping)
```

#### AC-3: Stripe line items rebuilt to sum to finalAmount

```gherkin
GIVEN finalAmount = RM66.60 (after discount)
WHEN  Stripe checkout session is created
THEN  line items are built such that:
       - Product 1: RM50 (was RM100)
       - Product 2: RM5 (was RM10)
       - Shipping: RM10
       - Tax: RM1.60
       - TOTAL: RM66.60
  AND Stripe charges exactly RM66.60
  AND (NOTE: Products and shipping are pro-rated; tax adjusted for new subtotal)
```

#### AC-4: Invalid code → silent reject (same as COD/QR)

```gherkin
GIVEN code is expired, at-limit, inactive, or wrong-tenant
WHEN  customer applies it at Stripe checkout
THEN  system silently rejects (no error)
  AND order proceeds at FULL PRICE
  AND Stripe session created with full amount (no discount)
```

#### AC-5: On successful Stripe payment

```gherkin
GIVEN discount was applied and Stripe charged finalAmount
WHEN  webhook confirms successful payment
THEN  order is created with discount snapshot:
       - order.discount = the discount record ID
       - order.discountCode = "SUMMER50"
       - order.discountAmount = 5000 (sen)
  AND discount_usage_history row is created
  AND usageCount incremented atomically
  AND email receipt shows: "Discount: −RM50.00"
```

### Additional Criteria
- [ ] Discount applies to same subtotal as COD/QR (no path divergence).
- [ ] All payment methods (COD, QR, Stripe, free-order case) consume same `finalAmount`.
- [ ] No Stripe Coupon object used (gateway-agnostic decision 3).

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Discount code input visible at Stripe checkout
- [ ] Valid discount applied, Stripe charged finalAmount
- [ ] Invalid codes silently rejected (order at full price)
- [ ] Stripe line items sum to finalAmount (no negative items)
- [ ] Usage tracking identical to COD/QR (TC-F33.07, QA spec)
- [ ] Email receipt shows discount
- [ ] TypeScript clean

---

## US-F33-08: Xem lịch sử sử dụng discount per order

**Wave 3** | **P1** | **M** | Status: Ready

### Story

```
As a   merchant (for reporting / audit)
I want to view the complete history of when and how each discount was used
       (which order, customer, amount, date)
So that I can analyze promotion effectiveness and revenue impact
```

### Acceptance Criteria

#### AC-1: Discount Usage History collection in admin

```gherkin
GIVEN merchant is in Payload admin
WHEN  they navigate to "Discount Usage History" collection
THEN  a list view appears with columns:
       | Discount Code | Type | Amount Applied | Order # | Customer Email | Used Date |
  AND each row = one use event (one order placement)
  AND rows are sorted by Used Date (newest first)
```

#### AC-2: Per-order snapshot

```gherkin
GIVEN an order was placed with "SUMMER50" discount (50% off RM100 subtotal)
       discount_usage_history row created with:
       - discountId: 42
       - orderId: 1001
       - amountApplied: 5000 (sen, RM50)
       - customerEmail: "customer@example.com" (snapshot)
       - usedAt: 2026-05-29 14:30:00
WHEN  merchant views the list
THEN  row displays:
       "SUMMER50 | Percentage 50% | RM50.00 | #1001 | customer@example.com | 2026-05-29 14:30"
```

#### AC-3: Tenant-scoped view

```gherkin
GIVEN merchant A and merchant B are different tenants
WHEN  merchant A views Discount Usage History
THEN  only usage events from merchant A's discounts are shown
  AND merchant B's usage is never visible

WHEN  super-admin views the collection
THEN  all usage events across all tenants are visible (admin power)
```

#### AC-4: Search / filter by discount code or order number

```gherkin
GIVEN the list has search box
WHEN  merchant types "SUMMER"
THEN  list filters to usage rows with discount code containing "SUMMER"

WHEN  merchant types "#1001"
THEN  list filters to usage rows for order 1001
```

#### AC-5: Immutable audit trail

```gherkin
GIVEN a usage history row exists
WHEN  merchant tries to click [Edit] or [Delete]
THEN  buttons are disabled or hidden (collection is read-only)
  AND message: "Usage history is immutable for audit purposes"
```

### Additional Criteria
- [ ] Usage history is automatically recorded on successful order placement (hook in checkout routes).
- [ ] One row per order (idempotent on orderId; no duplicates if webhook retried).
- [ ] Fields match Phase 03 spec: tenant, discount, order, amountApplied, customerEmail, usedAt.

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Discount Usage History collection visible in admin
- [ ] Columns display correctly: code, type, amount, order #, email, date
- [ ] Tenant-scoped (own usage only)
- [ ] Search by code / order works
- [ ] Collection read-only (no edit/delete)
- [ ] Usage data matches orders (TC-F33.08, QA spec)
- [ ] TypeScript clean

---

## Definition of Done Checklist (All Stories)

- [ ] 9-Point Checklist pass (per SPEC.md §13)
- [ ] All AC (Acceptance Criteria) in Gherkin pass (manual or automated)
- [ ] TypeScript clean (`tsc --noEmit`)
- [ ] Payload admin fully functional (list, create, edit, delete, export)
- [ ] Checkout integration works (COD/QR/Stripe)
- [ ] Usage tracking atomic + idempotent
- [ ] Email receipts show discount line (if applied)
- [ ] Security: tenant-scoped, no cross-tenant leakage
- [ ] Code normalized + unique per tenant enforced (DB + app)
- [ ] At-limit codes silently rejected (no checkout fail)
- [ ] CSV export functional, 10k row cap, formula-injection guard
- [ ] Related QA test cases (docs/qa/F33-*.md) reference these stories (TC-ID mapping)
