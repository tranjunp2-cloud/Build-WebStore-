# Phase 03 — Fix Product Buttons (#841 core)

**Status:** pending  
**Can run parallel with:** Phase 01 (no shared files)

## Scope

2 block components cần fix (product-quick-view bỏ qua):
1. `products-featured`: "View Details" → `<button>` không có `onClick`/`href`
2. `products-grid`: "Quick View" overlay → `<button>` không có `onClick`

> `product-quick-view` block: "Quick View" mở modal — đã hoạt động. Bỏ qua trong phase này.

## URL Construction Pattern (established pattern)

Dựa theo `src/blocks/blog-list/index.tsx`:
```tsx
const siteRec = site as Record<string, unknown>
const siteBasePath = typeof siteRec?.siteBasePath === 'string'
    ? (siteRec.siteBasePath as string)
    : (siteRec?.tenantSlug ? `/sites/${siteRec.tenantSlug as string}` : '')
const productUrl = `${siteBasePath}/products/${productSlug}`
```

---

## Fix 1: `src/blocks/products-featured/index.tsx`

### Problem
- `FeaturedProduct` interface không có `slug`
- API response có `slug` nhưng không map
- "View Details" button: `<button type="button" ...>View Details</button>` — no action

### Fix

**Step 1 — Add `slug` to interface:**
```tsx
interface FeaturedProduct {
    id: string
    slug: string    // ADD
    name: string
    price: string
    description: string
    image: string | null
    tags: string[]
}
```

**Step 2 — Map `slug` from API response (in `useEffect` `.then`):**
```tsx
return {
    id: String(doc.id),
    slug: String(doc.slug || ''),    // ADD
    name: String(doc.name || ''),
    // ... rest unchanged
}
```

**Step 3 — Compute `siteBasePath` before JSX:**
```tsx
const siteRec = site as Record<string, unknown>
const siteBasePath = typeof siteRec?.siteBasePath === 'string'
    ? (siteRec.siteBasePath as string)
    : (siteRec?.tenantSlug ? `/sites/${siteRec.tenantSlug as string}` : '')
```

**Step 4 — Replace "View Details" button with Link:**
```tsx
// BEFORE
<button type="button" className={`px-8 py-4 rounded-full font-bold text-lg ...`}>
    View Details
</button>

// AFTER
import Link from 'next/link'
...
{product.slug && (
    <Link
        href={`${siteBasePath}/products/${product.slug}`}
        className={`px-8 py-4 rounded-full font-bold text-lg transition-colors inline-block text-center ${TOUCH_TARGET.min}`}
        style={{ border: `2px solid rgba(var(--brand-primary-rgb), 0.314)`, color: theme.colorMode === 'dark' ? '#fff' : '#000' }}
    >
        View Details
    </Link>
)}
```

---

## Fix 2: `src/blocks/products-grid/index.tsx`

### Problem
- `ProductItem` interface không có `slug`
- API response có `slug` nhưng không map
- "Quick View" overlay: `<button>` không có `onClick`

### Fix

**Step 1 — Add `slug` to interface:**
```tsx
interface ProductItem {
    id: string
    slug: string    // ADD
    name: string
    price: string
    image: string | null
}
```

**Step 2 — Map `slug` from API:**
```tsx
return {
    id: String(doc.id),
    slug: String(doc.slug || ''),    // ADD
    name: String(doc.name || ''),
    // ... rest unchanged
}
```

**Step 3 — Compute `siteBasePath` + add router import:**
```tsx
import { useRouter } from 'next/navigation'
// Inside component:
const router = useRouter()
const siteRec = site as Record<string, unknown>
const siteBasePath = typeof siteRec?.siteBasePath === 'string'
    ? (siteRec.siteBasePath as string)
    : (siteRec?.tenantSlug ? `/sites/${siteRec.tenantSlug as string}` : '')
```

**Step 4 — Add `onClick` to "Quick View" button:**
```tsx
// BEFORE
<button type="button" className={`px-6 py-2 bg-white text-black font-semibold rounded-full ...`}>
    Quick View
</button>

// AFTER
<button
    type="button"
    onClick={() => product.slug && router.push(`${siteBasePath}/products/${product.slug}`)}
    className={`px-6 py-2 bg-white text-black font-semibold rounded-full transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 ${TOUCH_TARGET.min}`}
>
    Quick View
</button>
```

> Note: `products-grid` không có modal state — navigate to detail page là đơn giản nhất (KISS).

---

## Verification

```bash
npx tsc --noEmit
```

Manual test:
1. Add product block to a site page
2. Hover over product card trong `products-grid` → "Quick View" button appears → click → navigate to product detail page
3. Click "View Details" trên `products-featured` → navigate to product detail page
4. Product detail page shows site header + footer (after Phase 02)
