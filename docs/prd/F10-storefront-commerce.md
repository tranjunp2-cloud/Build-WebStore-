# PRD: Storefront Commerce (F-10)
> **Version:** 2.0 | **Updated:** 2026-03-13 | **Agent:** `project-planner`  
> **Priority:** P0 🌟 | **Sprint:** Wave 5 | **Size:** XL  
> **Depends on:** F-08 Products CRUD ✅, F-09 Orders ✅ | **Blocks:** F16 Payment Gateway, F17 Shipping  
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §6 Trust Signals, §4 Payment

---

## 1. Problem Statement

PrimeWeb has Products CRUD and Orders management in the dashboard, but **no public-facing storefront**. Site visitors cannot browse products, add to cart, or place orders. Without a storefront, the e-commerce features built in Wave 4 are unusable by end customers.

## 2. Target User

- **Primary:** Site visitor (customer of the SME using PrimeWeb)
- **Technical level:** Non-technical, browsing on mobile phone
- **Language:** English or Bahasa Melayu
- **Device:** 70% mobile (375px-428px), 30% desktop

## 3. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Product page load time (p95) | < 2s | Lighthouse |
| Cart → Checkout conversion | > 40% | Analytics events |
| Order placement success rate | > 95% | API success/error ratio |
| Mobile usability score | > 90 | Lighthouse |

## 4. User Stories

### US-10A: Browse Products
```
AS A site visitor
I WANT TO browse products on the storefront
SO THAT I can find items I want to purchase
```

### US-10B: Add to Cart + Checkout
```
AS A site visitor
I WANT TO add products to cart and complete checkout
SO THAT I can place an order without creating an account
```

### US-10C: Order Confirmation
```
AS A customer who placed an order
I WANT TO receive a confirmation with my order number
SO THAT I know my order was received
```

### US-10D: Analytics Tracking
```
AS A site owner
I WANT TO see page views and shopping events on my dashboard
SO THAT I can understand customer behavior
```

## 5. Screen Layouts

### Product Listing (`/sites/[slug]/products`)
```
┌─ Nav ──────────────────────────────┐
│  [SiteName]        [Home] [Products]│
├────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐    │
│  │ IMG  │  │ IMG  │  │ IMG  │    │
│  │ Cat  │  │ Cat  │  │SALE! │    │
│  │ Name │  │ Name │  │ Name │    │
│  │ RM29 │  │ RM49 │  │RM19  │    │
│  └──────┘  └──────┘  └──────┘    │
│                                    │
│  Mobile: 1-col stack               │
└────────────────────────────────────┘
```

### Product Detail (`/sites/[slug]/products/[slug]`)
```
┌─ Nav ──────────────────────────────┐
├─ Breadcrumb: Products / [Name] ────┤
│  ┌──────────┐  ┌─────────────┐    │
│  │           │  │ Category     │    │
│  │  MAIN     │  │ Product Name │    │
│  │  IMAGE    │  │ RM 29.90     │    │
│  │           │  │ ✓ In Stock   │    │
│  ├──────────┤  │              │    │
│  │ 🖼  🖼  🖼│  │ [Add to Cart]│    │
│  └──────────┘  │──────────────│    │
│                 │ Description  │    │
│                 │ ...          │    │
│                 └─────────────┘    │
│  Mobile: single column stacked     │
└────────────────────────────────────┘
```

### Checkout (`/sites/[slug]/checkout`)
```
┌─ ← Back to Products ──────────────┐
│  ┌─ FORM ──────┐ ┌─ SUMMARY ────┐│
│  │ Contact Info │ │ Item × qty   ││
│  │  Name*       │ │ Item × qty   ││
│  │  Email*      │ │──────────────││
│  │  Phone       │ │ Subtotal     ││
│  │              │ │ SST (6%)     ││
│  │ Shipping     │ │ Total: RM XX ││
│  │  Address     │ │              ││
│  │  City        │ └──────────────┘│
│  │  State ▼     │                  │
│  │  Postcode    │                  │
│  │              │                  │
│  │ [Place Order]│                  │
│  └──────────────┘                  │
│  Mobile: summary on top, form below│
└────────────────────────────────────┘
```

## 6. Acceptance Criteria

### AC-1: Product Listing
```gherkin
GIVEN a published site with active products
WHEN a visitor navigates to /sites/[slug]/products
THEN products display in a responsive grid (3-col desktop, 1-col mobile)
AND each card shows: image, category, name, price
AND products with compareAtPrice show "SALE" badge
AND only status='active' products are visible
AND page has SEO metadata (title, description, OG tags)
```

### AC-2: Product Detail
```gherkin
GIVEN a visitor clicks on a product card
WHEN the detail page loads
THEN main image displays with thumbnail gallery below
AND product name, price, category, stock status are visible
AND JSON-LD Product schema is in page <head>
AND "Add to Cart" button is enabled (if in stock)
AND "Out of Stock" shown when inventory <= 0
AND breadcrumb navigation shows: Products / [Name]
```

### AC-3: Add to Cart
```gherkin
GIVEN a visitor clicks "Add to Cart" on a product
WHEN the item is added
THEN cart drawer slides in from the right
AND item appears with quantity controls (+/-)
AND subtotal updates in real-time
AND cart persists across page navigation (localStorage)
AND adding same product increases quantity (not duplicate)
```

### AC-4: Checkout — Happy Path
```gherkin
GIVEN a visitor has items in cart and clicks "Proceed to Checkout"
WHEN they fill in: name*, email*, phone, address, city, state (MY dropdown), postcode
AND clicks "Place Order"
THEN order is created in Payload CMS with status='pending'
AND order number is generated (format: ORD-XXXXXXXX)
AND product inventory is decremented
AND success screen shows: order number + total + "Continue Shopping" link
AND SST (6%) is calculated: subtotal × 0.06
```

### AC-5: Checkout — Guest (No Login Required)
```gherkin
GIVEN a visitor who is NOT logged in
WHEN they access /sites/[slug]/checkout
THEN checkout form is accessible without authentication
AND order is linked to site/tenant (not to a user account)
```

### AC-6: Checkout — Validation
```gherkin
GIVEN a visitor submits checkout with missing fields
WHEN name or email is empty
THEN red error message: "Name and email are required"
AND form does NOT submit
```

### AC-7: Cart — Empty State
```gherkin
GIVEN a visitor with empty cart navigates to checkout
THEN empty cart message with shopping bag icon
AND link: "← Browse Products" back to product listing
```

### AC-8: Analytics Tracking
```gherkin
GIVEN a published site with analytics enabled
WHEN a visitor views a page
THEN a pageview event is recorded via POST /api/analytics/track
AND IP is hashed (SHA-256) for anonymization
AND event silently fails if API errors (never blocks page)
```

### AC-9: Analytics Dashboard
```gherkin
GIVEN a site owner on /dashboard/analytics
WHEN they select a site and period (7d / 30d)
THEN stat cards show: Total Views, Unique Visitors, Add to Cart, Purchases
AND daily bar chart shows views per day
AND top pages table shows most visited URLs
```

### AC-10: Mobile Responsive (375px)
```gherkin
GIVEN screen width < 768px on any storefront page
THEN product grid stacks to 1 column
AND product detail stacks image above info
AND checkout stacks summary above form
AND all buttons are min 44px tap target
```

### AC-11: WhatsApp Floating Button (MY Market)
```gherkin
GIVEN a published storefront
WHEN  site owner has set WhatsApp number in settings
THEN  floating WhatsApp button (green, bottom-right) appears on all pages
AND   click opens https://wa.me/60XXXXXXXXX with pre-filled message
AND   message: "Hi, saya berminat dengan produk di [StoreName]"
```

### AC-12: Trust Signals Footer (MY Market)
```gherkin
GIVEN a published storefront
WHEN  footer renders
THEN  shows: Halal badge (if any products halal), SSM number (from tenant settings),
       business address, WhatsApp contact, accepted payment icons, shipping carriers
AND   SSM format: "SSM: 123456-X"
```

### AC-13: Language Switcher (MY Market)
```gherkin
GIVEN a storefront with locale setting
WHEN  user clicks language toggle (BM/EN)
THEN  UI labels switch language (Product names stay as-is)
AND   default language = site.locale set during onboarding
AND   toggle saved in localStorage
```

### AC-14: Shipping by State (MY Market)
```gherkin
GIVEN buyer at checkout selects state
WHEN  state is in Semenanjung (West MY)
THEN  shipping = flat rate RM 8
WHEN  state is Sabah or Sarawak
THEN  shipping = flat rate RM 15
AND   shipping fee shows in order summary before Place Order
```

## 7. Edge Cases & Recommendations

| Case | Decision |
|------|----------|
| SST Tax | Fixed 6% (Malaysian SST) applied at checkout |
| Shipping fee | West MY: RM 8 flat, East MY: RM 15 flat. See AC-14 |
| Guest checkout | ✅ Yes — no login required for buyers |
| Max quantity per product | Limited by inventory stock |
| Currency | MYR (Malaysian Ringgit) — format: `RM XX.XX` |
| Out of stock product | "Add to Cart" button disabled, shows "Out of Stock" |
| Email confirmation | Dev mode: console log. Prod: Resend API (configured later) |

## 8. API Contracts

### POST /api/orders/create
```
Request: {
  siteId: string,
  items: [{ productId: string, quantity: number }],
  customer: {
    name: string,        // required
    email: string,       // required
    phone?: string,
    address?: {
      line1: string,
      line2?: string,
      city: string,
      state: string,     // Malaysian state from dropdown
      postcode: string,
      country: "Malaysia"
    }
  }
}

Response (201): {
  success: true,
  data: {
    orderId: string,
    orderNumber: "ORD-XXXXXXXX",
    total: number,
    currency: "MYR",
    status: "pending"
  }
}

Errors:
  422 — VALIDATION_ERROR (missing fields / no valid products)
  404 — NOT_FOUND (site not found)
  500 — INTERNAL_ERROR
```

### POST /api/analytics/track
```
Request: {
  siteId: string,
  event: "pageview" | "click" | "add_to_cart" | "checkout" | "purchase",
  pageUrl: string,
  referrer?: string,
  sessionId?: string,
  metadata?: object
}

Response (200): { success: true }
Auth: None (public endpoint)
```

## 9. Dependencies

| Dependency | Status | Action |
|-----------|--------|--------|
| Products collection | ✅ Ready | Built in Wave 4 |
| Orders collection | ✅ Ready | Built in Wave 4 |
| Analytics collection | ✅ Ready | Built in Wave 5 (existing) |
| Zustand | ✅ In package.json | — |
| Lucide React | ✅ In package.json | — |
| RESEND_API_KEY | ⬜ Not needed now | Dev mode uses console.log, configure for prod later |
| OpenAI API | ✅ Configured | For AI features only, not needed for storefront |

## 10. 9-Point Done Checklist

- [ ] Loading State — Skeleton cards on product listing
- [ ] Empty State — "No products available" + shopping bag icon
- [ ] Error State — "Failed to load" + retry on product pages, "Order failed" + retry on checkout
- [ ] Form Validation — Name + Email required on checkout
- [ ] Button States — "Add to Cart" disabled when out of stock, "Place Order" shows spinner
- [ ] Toast Feedback — N/A (uses inline messages instead)
- [ ] Auth Redirect — N/A (storefront is public, no auth required)
- [ ] Mobile 375px — 1-col grid, stacked layout, 44px tap targets
- [ ] TypeScript Clean — `tsc --noEmit` pass

## 11. Definition of Ready

- [ ] This PRD reviewed and approved by Product Owner
- [ ] Architecture doc exists (`docs/architecture/storefront-commerce.md`)
- [ ] API contract defined (§8 above)
- [ ] Products collection has real data to display

## 12. Definition of Done

- [ ] All 10 ACs pass
- [ ] 9-Point Checklist all pass
- [ ] QA report written (`docs/qa/storefront-commerce.md`)
- [ ] Mobile tested on 375px
- [ ] JSON-LD validates on Google Rich Results Test
