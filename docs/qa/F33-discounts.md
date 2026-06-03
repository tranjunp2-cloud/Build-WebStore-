# F33 Discount CMS — QA Test Cases

> Test cases for discount code application engine, admin API, and storefront preview.
> All amounts in sen (integer). All tests marked `[x] AUTO` require unit tests.

---

## TC-F33-01..09: Apply Discount Engine (`applyDiscount`)

Pure function at `src/lib/discounts/apply-discount.ts`. No I/O, fully deterministic.

### TC-F33-01: Valid percentage discount
**Severity:** Blocker  
**Type:** Unit (pure function)  
**Automation:** [x] AUTO  

Percentage discount calculates correctly and clamps to subtotal.
- **Given:** discount type='percentage', value=10, subtotalSen=100,000 (1000 yen = 10% = 10,000 sen)
- **When:** applyDiscount() called with valid row + matching tenant + active status + no expiry
- **Then:** returns `{ ok: true, discountSen: 10000, discount: {...} }`

---

### TC-F33-02: Valid fixed-amount discount
**Severity:** Blocker  
**Type:** Unit (pure function)  
**Automation:** [x] AUTO  

Fixed discount applies without percentage calculation.
- **Given:** discount type='fixed', value=5000 (sen), subtotalSen=100,000
- **When:** applyDiscount() called with valid row + matching tenant + active status
- **Then:** returns `{ ok: true, discountSen: 5000, discount: {...} }`

---

### TC-F33-03: Clamp discount to subtotal
**Severity:** Blocker  
**Type:** Unit (pure function)  
**Automation:** [x] AUTO  

Discount amount never exceeds subtotal (total never negative).
- **Given:** discount type='percentage', value=50, subtotalSen=5000 (50% = 2500, already ≤ 5000)
- **Also Given:** discount type='fixed', value=100000, subtotalSen=5000 (100% of subtotal, clamped to 5000)
- **When:** applyDiscount() called
- **Then:** `discountSen = min(computed, subtotalSen)` and `max(0, discountSen)`

---

### TC-F33-04: Discount not yet started
**Severity:** Medium  
**Type:** Unit (pure function)  
**Automation:** [x] AUTO  

Discount with future startsAt date is rejected before it activates.
- **Given:** discount startsAt='2026-07-01T00:00:00Z', now='2026-06-15T00:00:00Z'
- **When:** applyDiscount() called
- **Then:** returns `{ ok: false, reason: 'not-started' }`

---

### TC-F33-05: Discount expired
**Severity:** Medium  
**Type:** Unit (pure function)  
**Automation:** [x] AUTO  

Discount with past expiresAt date is rejected after expiration.
- **Given:** discount expiresAt='2026-06-01T00:00:00Z', now='2026-06-15T00:00:00Z'
- **When:** applyDiscount() called
- **Then:** returns `{ ok: false, reason: 'expired' }`

---

### TC-F33-06: Discount inactive
**Severity:** Medium  
**Type:** Unit (pure function)  
**Automation:** [x] AUTO  

Discount with status='inactive' is rejected.
- **Given:** discount status='inactive'
- **When:** applyDiscount() called
- **Then:** returns `{ ok: false, reason: 'inactive' }`

---

### TC-F33-07: Usage limit reached
**Severity:** Medium  
**Type:** Unit (pure function)  
**Automation:** [x] AUTO  

Discount at usage limit (usageCount >= usageLimit) is rejected.
- **Given:** discount usageLimit=10, usageCount=10
- **When:** applyDiscount() called
- **Then:** returns `{ ok: false, reason: 'at-limit' }`
- **Note:** usageCount=9 still allowed (10 uses remain); usageCount=10 rejects

---

### TC-F33-08: Wrong tenant isolation
**Severity:** Critical  
**Type:** Unit (pure function)  
**Automation:** [x] AUTO  

Discount from tenant A cannot be applied by tenant B.
- **Given:** discount row tenant=123 (or tenant={ id: 123 }), tenantId param=456
- **When:** applyDiscount() called with mismatched tenantId
- **Then:** returns `{ ok: false, reason: 'wrong-tenant' }`
- **Note:** Engine normalizes tenant as string for comparison

---

### TC-F33-09: Discount not found
**Severity:** Blocker  
**Type:** Unit (pure function)  
**Automation:** [x] AUTO  

Non-existent discount code returns not-found.
- **Given:** row=null (code not found in DB)
- **When:** applyDiscount(null, ctx) called
- **Then:** returns `{ ok: false, reason: 'not-found' }`

---

## TC-F33-10..13: Admin API (`/api/v1/discounts`)

REST API for discount CRUD. Requires authentication; tenant scoped.

### TC-F33-10: Create discount forces tenant + zeros usage
**Severity:** Blocker  
**Type:** Integration (API route + mock auth)  
**Automation:** [x] AUTO  

Create endpoint forces tenant from authenticated user and resets usageCount to 0.
- **Given:** POST /api/v1/discounts with `{ code: "SUMMER20", type: "percentage", value: 20, description: "..." }`
- **When:** authenticated user with tenantId=123 calls endpoint
- **Then:** 
  - Returns 201 with created discount
  - Discount.tenant forced to 123 (client-sent tenant param ignored)
  - Discount.usageCount set to 0 (client-sent usageCount param ignored)
  - Code stored as uppercase (SUMMER20)

---

### TC-F33-11: List discounts tenant-scoped
**Severity:** Medium  
**Type:** Integration (API route + mock auth)  
**Automation:** [x] AUTO  

List endpoint returns only discounts for authenticated user's tenant(s).
- **Given:** 10 discounts exist: 5 for tenant-A, 5 for tenant-B
- **When:** authenticated user with tenantId=tenant-A calls GET /api/v1/discounts
- **Then:** response includes only 5 discounts from tenant-A

---

### TC-F33-12: Duplicate code per tenant rejected
**Severity:** Medium  
**Type:** Integration (API route + mock auth)  
**Automation:** [x] AUTO  

Unique constraint on (tenant_id, upper(code)) prevents duplicate codes per tenant.
- **Given:** discount "SUMMER20" exists for tenant-A
- **When:** attempt to create another "summer20" or "SUMMER20" for tenant-A
- **Then:** returns 409 Conflict with error code 'DUPLICATE_CODE'
- **Note:** Same code can exist in different tenants

---

### TC-F33-13: Export with column limit
**Severity:** Low  
**Type:** Manual (export UI — not auto-tested)  
**Automation:** [ ] MANUAL  

Admin export endpoint caps columns and rows to prevent abuse.
- **Given:** request to export all discounts with 50 columns selected
- **When:** backend processes export
- **Then:** returns 413 if request exceeds configured limit (e.g., max 40 columns, 5000 rows)

---

## TC-F33-20..23: Storefront Preview API (`/api/storefront/discounts/apply`)

Advisory discount preview. Always returns 200 (no 4xx). Never trusts client-sent discountSen.

### TC-F33-20: Success response shape
**Severity:** Blocker  
**Type:** Integration (API route + mock Payload)  
**Automation:** [x] AUTO  

Valid discount returns full discount object in response.
- **Given:** valid code for site, subtotal=100,000 sen, discount=10,000
- **When:** POST /api/storefront/discounts/apply with siteSlug + code + subtotalSen
- **Then:** returns 200 with `{ ok: true, discountSen: 10000, discount: { id, code, type, value } }`
- **Note:** Response MUST NOT include reason field

---

### TC-F33-21: Failure response (no reason leak)
**Severity:** Critical  
**Type:** Integration (API route + mock Payload)  
**Automation:** [x] AUTO  

Invalid discount returns silent reject (ok:false) without exposing reason.
- **Given:** expired code, nonexistent code, wrong tenant, etc.
- **When:** POST /api/storefront/discounts/apply with invalid code
- **Then:** returns 200 with `{ ok: false }` (no reason field)
- **Note:** Reason logged server-side only (console.info); never in response

---

### TC-F33-22: Always HTTP 200 (even on error)
**Severity:** Critical  
**Type:** Integration (API route + mock Payload)  
**Automation:** [x] AUTO  

Endpoint never returns 4xx for invalid codes; only 429 for rate-limit + 200 for all discounts results.
- **Given:** invalid JSON, missing siteSlug, invalid subtotalSen, code not found, etc.
- **When:** POST /api/storefront/discounts/apply called
- **Then:** returns 200 with `{ ok: false }` (except 429 if rate-limited, 400 for parse error)
- **Note:** Exception: genuine parse errors (invalid JSON) return 400

---

### TC-F33-23: Code matching case-insensitive
**Severity:** Medium  
**Type:** Integration (API route + mock Payload)  
**Automation:** [x] AUTO  

Code lookup is case-insensitive; stored as uppercase in DB.
- **Given:** discount code stored as "SUMMER20" in DB
- **When:** POST /api/storefront/discounts/apply with code="summer20" or "SuMmEr20"
- **Then:** discount found and applied correctly
- **Note:** Schema validation uppercases before lookup

---

## TC-F33-30..34: Order Discount Application (Phase 4 integration)

Server-side authoritative re-check. Client-sent discount amounts are never trusted.

### TC-F33-30: Server recomputes discount from code
**Severity:** Critical  
**Type:** Integration (order creation flow)  
**Automation:** [x] AUTO  

Order creation endpoint calls applyDiscount() server-side; ignores client-sent discountSen.
- **Given:** client sends `{ discountCode: "SUMMER20", discountSen: 99999 }` (wrong amount)
- **When:** POST /api/orders/checkout or /api/orders/stripe-checkout
- **Then:** server runs applyDiscount(row, ctx) independently and uses server-computed discountSen
- **Note:** Client discountSen is advisory only (from storefront preview)

---

### TC-F33-31: Usage history created once per order
**Severity:** Medium  
**Type:** Integration (order creation + DB)  
**Automation:** [x] AUTO  

Each order creates exactly one DiscountUsageHistory record (if discount applied).
- **Given:** valid discount code, order created with code
- **When:** INSERT to orders table with discount_code foreign key
- **Then:** exactly 1 row created in discount_usage_history collection

---

### TC-F33-32: Usage count increment idempotent
**Severity:** Medium  
**Type:** Integration (order creation + DB)  
**Automation:** [x] AUTO  

Duplicate order_id does not double-increment usageCount (idempotent on retry).
- **Given:** order 42 created with discount code (usageCount → 5)
- **When:** retry creates order 42 again (duplicate UUID)
- **Then:** usageCount remains 5 (not incremented to 6)
- **Note:** Idempotency key prevents double-counting

---

### TC-F33-33: Invalid code at checkout → full price
**Severity:** Medium  
**Type:** Integration (order creation)  
**Automation:** [x] AUTO  

If discount code invalid at checkout time (expired/at-limit/etc.), no history row created and full price charged.
- **Given:** discount code expired between storefront preview and checkout
- **When:** POST /api/orders/checkout with expired code
- **Then:** order created with discountSen=0, no DiscountUsageHistory row

---

### TC-F33-34: Total calculation (subtotal − discount + shipping + tax ≥ 0)
**Severity:** Blocker  
**Type:** Integration (order creation)  
**Automation:** [x] AUTO  

Final order total = max(0, subtotalSen − discountSen) + shippingSen + taxSen.
- **Given:** subtotal=10,000, discount=5,000, shipping=1,000, tax=500
- **When:** order created
- **Then:** total = max(0, 10000 − 5000) + 1000 + 500 = 6,500 sen
- **Also:** if discount > subtotal, clamped: total = max(0, 10000 − 10000) + 1000 + 500 = 1,500 sen (not negative)

---

## Summary

| TC | Area | Count | Auto | Manual |
|---|---|---|---|---|
| TC-F33-01..09 | Engine | 9 | 9 | 0 |
| TC-F33-10..13 | Admin API | 4 | 3 | 1 |
| TC-F33-20..23 | Storefront API | 4 | 4 | 0 |
| TC-F33-30..34 | Order Integration | 5 | 5 | 0 |
| **Total** | | **22** | **21** | **1** |

---

## Coverage Notes

- **Validation tests:** Zod schema in `src/lib/validations/discounts.ts` covered by TC-F33-10 (code format, value bounds, date ordering)
- **Rate limiting:** POST /api/storefront/discounts/apply rate-limited to 20 req/60s per IP (covered by TC-F33-22)
- **Database uniqueness:** (tenant_id, upper(code)) unique constraint in Discounts collection (covered by TC-F33-12)
