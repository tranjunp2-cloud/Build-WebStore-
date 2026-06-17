# Product Weight/Dimensions & Order Line Items Modeling
## F36 EasyParcel Shipping Label Design Investigation

**Date:** 2026-06-17 | **Project:** ech-prime-web-v2 | **Context:** Next.js + Payload CMS

---

## 1. Products Collection Schema

**File:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/collections/Products.ts` (Lines 451–467)

### Weight Field
- **Field Name:** `weight`
- **Type:** `number`
- **Unit:** **Grams** (per admin description: "Product weight in grams (for shipping calculation)")
- **Constraints:** `min: 0`, `defaultValue: 0`
- **Required:** No (optional, defaults to 0)
- **Location:** Top-level product field (not nested)

### Dimensions Group
- **Field Name:** `dimensions`
- **Type:** `group` (nested object, NOT a relationship)
- **Structure:** Object with three sub-fields:
  - **`length`** — `number`, min: 0, defaultValue: 0 — **Unit: cm**
  - **`width`** — `number`, min: 0, defaultValue: 0 — **Unit: cm**
  - **`height`** — `number`, min: 0, defaultValue: 0 — **Unit: cm**
- **Required:** No (all optional, default to 0)
- **Location:** Top-level product field (not nested)
- **Admin Note:** "Package dimensions matching shipping logic in F14"

### Variant Weight/Dimensions
- **Verdict:** **NOT PRESENT** on variants
- **Variant Fields Only:** `name`, `sku`, `price`, `compareAtPrice`, `stock`
  - (Lines 416–433)
- **Implication:** All variants of a product share the same weight/dimensions

### Summary
```typescript
{
  weight: number,           // grams, optional
  dimensions: {
    length: number,         // cm, optional
    width: number,          // cm, optional
    height: number,         // cm, optional
  }
}
```

---

## 2. Order Schema & Line Items

**File:** `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/collections/Orders.ts` (Lines 119–152)

### Items Array Structure
- **Field Name:** `items`
- **Type:** `array` (required, at least 1 item per order)
- **Fields per item:**

```typescript
{
  product: string | number,              // relationship → products collection (required)
  productName: string,                   // snapshot of product name at order time (required)
  variant?: string,                      // e.g. "Red - M" (optional, snapshot text only)
  quantity: number,                      // min: 1 (required)
  unitPrice: number,                     // min: 0 (required)
  // ❌ NO weight field
  // ❌ NO dimensions field
  // ❌ NO product snapshot of weight/dimensions
}
```

### Critical Gap
- **Order items DO NOT store a snapshot of weight/dimensions at order time**
- **Order items DO NOT store variant-specific weight (variant would be same as product anyway)**
- **Implication:** To get weight/dimensions for label creation, must JOIN back to Products collection at label time

---

## 3. Existing Weight Aggregation & Shipping Logic

**Files:** 
- `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/lib/shipping/`
  - `calculate-fee.ts` (Lines 1–21)
  - `constants.ts` (Lines 1–19)
  - `types.ts` (Lines 1–6)
- `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/api/orders/calculate-shipping/route.ts`

### Current Shipping Model
- **NO weight-based calculations** — Only geographic (east/west Malaysia) + subtotal threshold
- **Fee Calculation:**
  - West Malaysia: 800 sen (RM 8)
  - East Malaysia: 1500 sen (RM 15)
  - Free above: 10,000 sen (RM 100) subtotal
- **No Parcel Constants:** No `DEFAULT_PARCEL`, no weight aggregation logic exists

### Shipping Config (Per Site)
```typescript
interface ShippingConfig {
  enabled?: boolean | null
  westRate?: number | null              // sen
  eastRate?: number | null              // sen
  freeAbove?: number | null             // sen threshold
}
```

### Calculation API
- **Endpoint:** `POST /api/orders/calculate-shipping`
- **Body:** `{ siteId, state, subtotalSen }`
- **Response:** `{ fee, isFree, region, hint? }`
- **Uses:** Geographic region only, no weight/dimensions

### Verdict
**Weight/dimensions are defined on products but NOT used in any shipping fee calculation.** Current model is entirely geography + price driven.

---

## 4. Can Create-Label Modal Get Weight/Dims from Order Alone?

**Files:**
- `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/(dashboard)/orders/_components/ShipOrderModal.tsx`
- `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/(dashboard)/orders/_components/OrderDetailPanel.tsx`
- `/Volumes/DominSSD/MyProject/ech-prime-web-v2/src/app/api/orders/[id]/route.ts`

### ShipOrderModal Today
- **Currently:** Simple modal asking for **tracking number only**
- **No fields:** weight, dimensions, parcel data
- **No API:** Does not create shipping labels; only updates `trackingNumber` field on order

### Order Fetch Chain (for label creation)
1. **OrderDetailPanel:** Fetches order via `/api/orders/{id}?depth=1` (Line 993)
   - Returns order with `items[].product` resolved (first level)
   - Does NOT include `product.weight` or `product.dimensions` at depth=1
2. **GET /api/orders/[id]:** Uses `depth: 2` (Line 261 in route.ts)
   - Should resolve `items[].product.*` plus nested media/images
   - **Would include `product.weight` and `product.dimensions` at depth=2**

### Critical Finding
```
Depth=1 (current OrderDetailPanel):
  order.items[0].product = { id, name, ... }  ❌ NO weight/dimensions

Depth=2 (Orders API, but not used by OrderDetailPanel yet):
  order.items[0].product = { id, name, weight, dimensions {...}, ... }  ✓ Has weight/dims
```

### Answer: NO (with current architecture)
- **OrderDetailPanel uses depth=1** → does not fetch weight/dimensions
- **ShipOrderModal receives order data from OrderDetailPanel** → no weight/dims available
- **Must either:**
  1. Upgrade OrderDetailPanel fetch to depth=2, OR
  2. Create a dedicated label-creation endpoint that fetches products separately

---

## 5. Multi-Item Parcel Reality

### Available at Order Time
For an order with N different products, order structure provides:
```
order.items = [
  { productName, quantity, unitPrice, variant?, product_id },
  { productName, quantity, unitPrice, variant?, product_id },
  ...
]
```

### Must Fetch from Products
To aggregate parcel weight/dims:
```javascript
// For each order item:
totalWeight = 0
maxLength = 0, maxWidth = 0, maxHeight = 0  // or sum?

for (item of order.items) {
  product = await fetchProduct(item.product_id)
  totalWeight += product.weight * item.quantity
  // Dims aggregation rule unclear (see below)
}
```

### Aggregation Rules — MISSING
- **Weight:** `SUM(product.weight × quantity)` per item → obvious
- **Dimensions:** **UNDEFINED**
  - Option A: Use largest single product's dims (assume flat packing)
  - Option B: Sum all dims (assume stacking)
  - Option C: Use "default box" if any item has 0 dims
  - Option D: EasyParcel F36 may auto-calculate from weight

**Current State:**
- No existing multi-item parcel aggregation logic
- No DEFAULT_PARCEL constant
- No dims aggregation rule documented

---

## Summary: What Exists vs. What's Missing

### EXISTS ✓
1. **Product weight** — grams, top-level, optional (defaults 0)
2. **Product dimensions** — cm-based group (length/width/height), optional (defaults 0)
3. **Order items array** — with quantity, unit price, product relationship
4. **Product relationship in order items** — can be depth-resolved to get weight/dims
5. **ShipOrderModal** — placeholder UI (tracking number only)
6. **Order API with depth=2** — can return full product data including weight/dims

### MISSING ❌
1. **Weight/dims snapshot on order items** — must re-fetch Products at label time
2. **Variant-specific weight/dims** — all variants share product weight/dims
3. **Weight-based shipping fee calculation** — only geography + subtotal
4. **Multi-item dims aggregation rule** — no standard for combining N product dims
5. **Parcel constants** — no DEFAULT_PARCEL, no weight tier thresholds
6. **Label creation endpoint** — ShipOrderModal is tracking-only; no F36/EasyParcel integration
7. **OrderDetailPanel depth=2 fetch** — currently uses depth=1, missing product.weight/dims

---

## Design Decision: F36 EasyParcel Integration Path

### For Create-Label Modal (Next Steps)
1. **Upgrade order fetch to depth=2** (OrderDetailPanel or new endpoint)
2. **Calculate total parcel weight:** `SUM(item.quantity × product.weight)` in grams
3. **Define dims aggregation:** Propose rule to business (max dims? default box? weight-based dims lookup?)
4. **Create POST /api/orders/{id}/create-label endpoint** that:
   - Accepts order ID
   - Fetches order with depth=2
   - Calculates weight & dims per aggregation rule
   - Calls F36 EasyParcel API
   - Returns label PDF URL + tracking number
5. **Update ShipOrderModal** to either:
   - Auto-generate label & display tracking (if no manual entry needed), OR
   - Add parcel weight/dims display fields for verification before generating label

### Risk Assessment
- **Low risk:** Weight can always be calculated from Products
- **Medium risk:** Dims aggregation rule is business logic (missing)
- **High risk:** No variant-level weight → multi-size sets must have manual weight entry per size

