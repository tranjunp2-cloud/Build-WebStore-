# PRD: Products CRUD (F09)
> **Version:** 2.0 | **Updated:** 2026-03-13 | **Agent:** `project-planner`  
> **Priority:** P0 | **Wave:** 4 | **Size:** L  
> **Depends on:** Dashboard ✅, Payload CMS Products collection ✅  
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §6 Halal, §4 Payment

---

## 1. Problem Statement

Site owners need to manage products from the dashboard — create, edit, delete, and organize. Currently the product management page is a basic table with no form validation, no image upload UI, and no AI-assisted description generation.

## 2. User Story

```
AS A site owner with an online shop
I WANT TO manage products from my dashboard
SO THAT I can keep my storefront up-to-date with accurate products and prices
```

## 3. Screen Layout

```
┌─ /dashboard/products ──────────────────────────────┐
│  Products                   [+ Add Product]         │
│                                                      │
│  ┌─ Filter ──────────────────────────────────────┐  │
│  │ [All ▼] [Active ▼] [Category ▼] [🔍 Search]  │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │ 🖼 | Name          | Category | Price   | Stock│  │
│  │ ── │ ──────────── │ ──────── │ ─────── │ ─────│  │
│  │ 📷 │ Baju Kurung  │ Fashion  │ RM 89   │ 25   │  │
│  │ 📷 │ Kuih Raya    │ F&B      │ RM 29   │ 100  │  │
│  │ 📷 │ Lip Gloss    │ Beauty   │ RM 39   │ 0 ⚠️ │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  Mobile: cards instead of table                      │
└──────────────────────────────────────────────────────┘
```

## 4. Acceptance Criteria

### AC-1: Product List
```gherkin
GIVEN user navigates to /dashboard/products
WHEN  page loads
THEN  table shows: thumbnail, name, category, price (RM XX.XX), stock
AND   filter by: status (All/Active/Inactive), category, search by name
AND   pagination if > 20 products
AND   empty state: "No products yet. Add your first product →"
```

### AC-2: Add Product
```gherkin
GIVEN user clicks "+ Add Product"
WHEN  form opens (drawer or page)
THEN  fields: name*, price* (RM), compareAtPrice, category*, description, images (max 5), stock*
AND   price field auto-formats as RM XX.XX
AND   image upload: drag & drop, max 5MB per image, auto-resize
AND   "✨ AI Write Description" button below description field
AND   Halal section: toggle "Halal Certified" + upload cert image (JAKIM)
AND   weight field (grams) for shipping calculation
```

### AC-3: AI Description
```gherkin
GIVEN user enters product name and category
WHEN  clicks "✨ AI Write Description"
THEN  AI generates description in site's language (BM or EN)
AND   description appears in textarea (editable)
AND   loading spinner during generation
```

### AC-4: Edit Product
```gherkin
GIVEN user clicks on a product row
WHEN  edit form opens (same as add, pre-filled)
THEN  all fields editable
AND   "Save" updates product
AND   "Delete" → confirmation dialog → soft delete
```

### AC-5: Delete Product (Soft)
```gherkin
GIVEN user clicks "Delete" on a product
WHEN  confirmation dialog shown and confirmed
THEN  product.status = 'deleted' (soft delete)
AND   product hidden from storefront
AND   toast "Deleted. Undo?" with 5s timer
AND   Undo restores product.status to previous value
```

### AC-6: Stock Warning
```gherkin
GIVEN product stock = 0
THEN  red warning badge "Out of Stock" in list
AND   product still visible on storefront but "Add to Cart" disabled
```

### AC-7: Halal Certification (MY Market)
```gherkin
GIVEN product category is F&B or Beauty
WHEN  user toggles "Halal Certified" ON
THEN  upload field for Halal cert image appears (JAKIM certificate)
AND   uploaded cert shows ✅ Halal badge on product card in storefront
AND   if Halal toggled OFF → no badge shown
AND   badge text: "Halal Certified (JAKIM)"
```

## 5. Edge Cases

| Case | Decision |
|------|----------|
| Duplicate product name | Allowed (slug auto-increments: baju-kurung, baju-kurung-1) |
| Price = 0 | Allowed (free products) |
| No images uploaded | Use placeholder image |
| Category not in list | Allow custom category input |

## 6. 9-Point Done Checklist

- [ ] Loading State — Table skeleton during fetch
- [ ] Empty State — "No products yet" + CTA
- [ ] Error State — Toast + retry on save failure
- [ ] Form Validation — Name, price, stock required; inline Zod validation
- [ ] Button States — Save disabled during API call
- [ ] Toast Feedback — "Product saved!", "Deleted. Undo?"
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — Cards instead of table
- [ ] TypeScript Clean
