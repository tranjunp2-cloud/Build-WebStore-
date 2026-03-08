# Architecture: Storefront Commerce
> **Version:** 1.0 | **Created:** 2026-03-08 | **Agent:** `frontend-specialist` + `backend-specialist`  
> **PRD:** [`docs/prd/storefront-commerce.md`](../prd/storefront-commerce.md)

---

## 1. Overview

Storefront Commerce adds the public-facing shopping experience to PrimeWeb tenant sites. Visitors can browse products, add to cart, and checkout as guests. Orders are created in Payload CMS with automatic inventory management. Analytics events are tracked for site owner insights.

## 2. System Context

```
Visitor Browser
    │
    ├── /sites/[slug]/products          → SSR Product Listing
    ├── /sites/[slug]/products/[slug]   → SSR Product Detail + JSON-LD
    ├── /sites/[slug]/checkout          → CSR Checkout Form
    │        │
    │        └── POST /api/orders/create → Payload CMS (Orders + Products)
    │                    │
    │                    └── sendEmail() → Console (dev) / Resend (prod)
    │
    └── POST /api/analytics/track       → Payload CMS (Analytics)
```

## 3. Component Tree

```
/sites/[slug]/products/page.tsx (SSR)
├── Nav (site name + links)
├── Header (title + product count)
└── ProductGrid
    └── ProductCard × N (image, name, price, SALE badge)

/sites/[slug]/products/[productSlug]/page.tsx (SSR)
├── Nav
├── Breadcrumb
├── ProductImages (main + thumbnails)
├── ProductInfo (name, price, stock, description)
├── AddToCartButton → triggers CartStore.addItem()
└── <script type="application/ld+json"> (JSON-LD Product)

/sites/[slug]/checkout/page.tsx (CSR - 'use client')
├── Nav (← Back to Products)
├── CheckoutForm (contact + shipping fields)
│   ├── ContactSection (name*, email*, phone)
│   └── ShippingSection (line1, city, state dropdown, postcode)
├── OrderSummary (sticky sidebar)
│   ├── CartItemList (name × qty = total per item)
│   └── TotalSection (subtotal + SST 6% + total)
├── PlaceOrderButton → POST /api/orders/create
└── OrderSuccessScreen (order number + total + continue link)

CartDrawer.tsx (CSR - 'use client')
├── Backdrop (click to close)
├── ItemList (image, name, price, qty +/-)
└── Footer (subtotal + checkout link)
```

### Component Files

| Component | File | Type | Responsibility |
|-----------|------|------|---------------|
| ProductListingPage | `src/app/sites/[slug]/products/page.tsx` | SSR | Fetch products, render grid |
| ProductDetailPage | `src/app/sites/[slug]/products/[productSlug]/page.tsx` | SSR | Fetch product, render detail + JSON-LD |
| CheckoutPage | `src/app/sites/[slug]/checkout/page.tsx` | CSR | Form + order summary + order creation |
| CartDrawer | `src/components/storefront/CartDrawer.tsx` | CSR | Slide-in cart panel |
| AnalyticsDashboard | `src/app/(dashboard)/dashboard/analytics/page.tsx` | CSR | Stats, chart, top pages |
| cartStore | `src/store/cartStore.ts` | — | Zustand + localStorage |

## 4. Data Flow

### Add to Cart → Checkout → Order

```
[Add to Cart] → cartStore.addItem()
                    │
                    └── localStorage.setItem('primeweb-cart', JSON.stringify(items))
                    └── CartDrawer opens (isOpen=true)
                            │
                            └── [Proceed to Checkout]
                                    │
                                    └── /sites/[slug]/checkout
                                            │
                                            └── [Place Order] → POST /api/orders/create
                                                    │
                                                    ├── Validate products exist + active
                                                    ├── Calculate: subtotal + SST (6%) = total
                                                    ├── Generate orderNumber: ORD-{base36 timestamp}
                                                    ├── Decrement product inventory
                                                    ├── Create Order in Payload CMS
                                                    ├── sendEmail() (order confirmation)
                                                    └── Return { orderId, orderNumber, total }
                                                            │
                                                            └── cartStore.clearCart()
                                                            └── Show OrderSuccessScreen
```

### Analytics Flow

```
Visitor loads page → POST /api/analytics/track
                        │
                        ├── Get siteId → find tenantId
                        ├── Hash IP (SHA-256 + siteId salt)
                        ├── Truncate userAgent (200 chars)
                        └── Create analytics doc in Payload
                            │
                            └── ⚠ Silently fail on error (never block page)
```

## 5. State Management

| State | Location | Type | Description |
|-------|----------|------|-------------|
| `items` | Zustand + localStorage | `CartItem[]` | Cart contents |
| `isOpen` | Zustand | `boolean` | Cart drawer open/close |
| `form` | useState (checkout) | `CheckoutForm` | Customer info fields |
| `isPlacing` | useState (checkout) | `boolean` | Order submit loading |
| `orderResult` | useState (checkout) | `OrderResult \| null` | Success data |
| `data` | useState (analytics) | `AnalyticsSummary` | Processed analytics |

## 6. API Design

### POST /api/orders/create

```typescript
// Request
{
  siteId: string,                    // required
  items: [{
    productId: string,               // required
    quantity: number                  // required, min 1
  }],
  customer: {
    name: string,                    // required
    email: string,                   // required
    phone?: string,
    address?: {
      line1: string, line2?: string,
      city: string, state: string,   // Malaysian state
      postcode: string,
      country: "Malaysia"
    }
  }
}

// Response (success)
{ success: true, data: { orderId, orderNumber, total, currency, status } }

// Response (error)
{ success: false, error: { code: "VALIDATION_ERROR", message: "..." } }
```

### POST /api/analytics/track

```typescript
// Request
{
  siteId: string,                    // required
  event: "pageview" | "click" | "add_to_cart" | "checkout" | "purchase",
  pageUrl: string,                   // required
  referrer?: string,
  sessionId?: string,
  metadata?: object
}

// Response (always 200)
{ success: true }
```

## 7. Database / Collection Changes

| Collection | Change | Notes |
|-----------|--------|-------|
| `Products` | READ only | Fetch active products for storefront |
| `Products` | UPDATE inventory | Decrement on order |
| `Orders` | CREATE | New order from checkout |
| `Analytics` | CREATE | New event from tracking |

> No new collections needed — all exist from Wave 4.

## 8. Error Handling Matrix

| Error | HTTP | User Message | Recovery |
|-------|------|-------------|----------|
| Missing name/email | 422 | "Name and email are required" | Inline form error |
| No valid products | 422 | "Cart contains invalid products" | Clear cart, re-add |
| Site not found | 404 | N/A (should not happen) | — |
| Product out of stock | 422 | "Product is out of stock" | Remove from cart |
| API timeout | 500 | "Failed to place order. Try again." | Retry button |
| Analytics fail | — | (silent) | Never shown to user |

## 9. Security Considerations

- [x] Auth required? → **NO** — storefront is public, checkout is guest
- [x] Tenant-scoped? → Products/Orders scoped by `site` field
- [x] Input validation → Name + Email required, product exists check
- [x] Rate limiting → NOT YET (add in Wave 6)
- [x] IP anonymization → SHA-256 hash for analytics

## 10. Performance

- [x] SSR for product listing + detail → Fast FCP, SEO crawlable
- [x] CSR for checkout → Interactive form, no SEO needed
- [x] Cart in localStorage → Instant access, no API call
- [x] Analytics POST is fire-and-forget → Never blocks rendering
- [x] Images → Use Payload media URL (optimize later with next/image)

## 11. Testing Strategy

| Type | What | Tool |
|------|------|------|
| Manual | Browse products → add to cart → checkout → order success | Browser |
| Manual | Mobile 375px layout check | Chrome DevTools |
| Manual | JSON-LD validation | Google Rich Results Test |
| Build | TypeScript compilation | `tsc --noEmit` |
