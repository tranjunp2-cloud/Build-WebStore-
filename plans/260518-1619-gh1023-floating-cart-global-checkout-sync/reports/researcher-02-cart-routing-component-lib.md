# Cart Routing & Component Library Metadata Research

## 1. Cart State Management
**File:** `src/store/cartStore.ts` (lines 1–106)

- **Store Type:** Zustand (client-side only)
- **Persistence:** localStorage key `'primeweb-cart'` (lines 36, 41–48)
- **Key Structure:** `CartItem[]` with: `productId`, `productSlug`, `name`, `price`, `imageUrl`, `quantity`, `inventory`
- **Actions:** `addItem()`, `removeItem()`, `updateQuantity()`, `clearCart()`, `toggleCart()`, `openCart()`, `closeCart()`
- **State Scope:** `isOpen` (drawer toggle), `items[]`, `siteSlug` (tenant identifier)
- **Computed:** `itemCount()`, `subtotal()`
- **SSR Note:** Defers to client-only; server loads empty cart (see CartWidget line 25–30)

## 2. Cart Routing & Page Linking
**Files:** 
- `src/app/sites/[slug]/checkout/page.tsx` (lines 1–121)
- `src/blocks/cart-widget/index.tsx` (lines 1–80+)

- **Checkout Route:** `/sites/[slug]/checkout` (server component, `force-dynamic`)
- **Cart Linking:** CartWidgetBlock does NOT directly href to `/cart`; instead:
  - Line 45–46: `onClick={callback ? undefined : openCart}` — toggles drawer instead of navigation
  - Line 64: Renders `<CartDrawer siteSlug={siteSlug} siteId={site?.id} />` inline
  - No `href` attribute found; cart is modal/drawer pattern
- **Checkout Flow:** Checkout page is server-side fetch-heavy (resolves tenant, site, theme at build time)
- **No Auto-Wire:** Cart button toggles Zustand state directly; no auto-navigation to `/cart` route

## 3. Component Library & Metadata
**File:** `src/blocks/registry.ts` (lines 1–100+)

- **Block Registry Pattern:** Central imports of component + config/schema pairs
- **Meta Structure:** Each block has a `{Name}Meta` export (e.g., `navigationMeta`, `cartWidgetMeta`)
  - Example: Line 26 imports `CartWidgetBlock`; line 80 imports `CartWidgetConfigSchema, cartWidgetMeta`
- **Config/Schema:** Each block has a corresponding `{Name}ConfigSchema` (Zod)
  - Example: Line 80 imports `CartWidgetConfigSchema` from `./cart-widget/config`
- **No "Scope" Field Observed:** Registry doesn't explicitly categorize blocks by scope (e.g., "storefront" vs "admin")
- **Component Count:** 50+ blocks registered (hero, cta, products-grid, cart-widget, etc.)

## 4. Component Metadata Interface
**File Location:** `src/blocks/cart-widget/config.ts` (referenced but not fully read)

- **Pattern:** Each block has a config file exporting `{Name}Meta` and `{Name}ConfigSchema`
- **Cart Widget:** `CartWidgetConfigSchema` and `cartWidgetMeta` (line 80)
- **Likely Interface:** BlockMeta type (imported line 1 from `./types`)
  - Contains: `label`, `description`, `icon`, `category` (inferred from patterns)

## 5. Checkout Flow Routing
**Server-Side Fetch (lines 36–109):**
- Resolves `tenant` by `slug` or custom domain (lines 42–59)
- Resolves `site` by tenant ID (lines 62–67)
- Fetches theme, payment config, shipping config at server time
- Passes `initialSiteData` to `<CheckoutClient>` component
- **No Manual Page Transitions:** Checkout is a single server-rendered page; client side likely handles form submission

**Lack of Explicit Routing Chain:** 
- `/cart` route NOT found in grep
- Checkout flow is `/sites/[slug]/checkout`; no visible `/payment` or `/thank-you` sub-routes

## Key Findings
1. **Cart is modal drawer**, not a routed page — uses Zustand + localStorage
2. **No `/cart` route** — clicking cart icon opens inline drawer via state toggle
3. **Checkout is single-page** server component fetching tenant/site/theme data
4. **Component registry** uses `{Name}Meta` + `{Name}ConfigSchema` pattern; no explicit "scope" categorization
5. **siteSlug injected dynamically** into cart store (line 23–35, CartWidget)
6. **No auto-wire routing** between cart → checkout; transitions likely manual form submission

## Unresolved Questions
- Where is `BlockMeta` interface defined? (referenced in registry.ts line 1)
- Does CheckoutClient handle `/payment` and `/thank-you` subpages, or are they separate routes?
- Is there a cart icon in Navigation block that links to checkout, or only drawer toggle?
- What does `useBlockEditCallback()` (CartWidget line 18) do in edit mode?

---

**Status:** DONE
**Summary:** Cart uses Zustand + localStorage with drawer UI (not routed page); checkout is server-rendered single page; component library uses {Name}Meta pattern without explicit scope categorization.
