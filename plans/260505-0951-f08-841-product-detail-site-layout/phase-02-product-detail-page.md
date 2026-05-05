# Phase 02 — Rewrite Product Detail Page

**Status:** pending  
**Depends on:** Phase 01 (SiteLayoutShell)

## Context

`/src/app/sites/[slug]/products/[productSlug]/page.tsx` hiện tại:
- Có custom nav riêng (hardcode), không có footer
- Hardcode màu (`#111`, `#f8f8f8`, `#eee`) → conflict dark theme
- **Cần backup bản cũ** trước khi rewrite (đặt thành `_page.old.tsx` cùng thư mục)
- Không dùng site CSS variables

## Files

| File | Action |
|------|--------|
| `src/app/sites/[slug]/products/[productSlug]/_page.old.tsx` | CREATE — copy của bản hiện tại (backup) |
| `src/app/sites/[slug]/products/[productSlug]/page.tsx` | REWRITE |

## Changes Required

### 0. Backup bản cũ

Copy toàn bộ nội dung `page.tsx` → `_page.old.tsx` trong cùng thư mục.  
File này không được import hay export gì — chỉ để tham chiếu, không ảnh hưởng routing.

### 1. Add imports

```tsx
import { SiteLayoutShell } from '@/components/site-renderer/SiteLayoutShell'
import { getSiteBasePath } from '@/lib/site-base-path'
import type { NavPage } from '@/components/site-renderer/SiteRenderer'
```

### 2. Extend `getProductData` to also fetch navigation pages

```tsx
const getProductData = cache(async function getProductData(slug: string, productSlug: string) {
    // ... existing tenant + site + product fetch ...

    // Also fetch nav pages for SiteLayoutShell header/footer URL rewriting
    const pagesResult = await payload.find({
        collection: 'pages',
        where: {
            and: [
                { site: { equals: site.id } },
                { deletedAt: { exists: false } },
            ],
        },
        limit: 100,
        sort: 'createdAt',
    })

    return { tenant, site, product, pages: pagesResult.docs }
})
```

### 3. Replace return statement

Remove: custom `<nav>`, `<OwnerProvider>`, inline `<TrackingManager>` (move inside SiteLayoutShell children)

```tsx
const base = await getSiteBasePath(slug)
const { tenant, site, product, pages } = data

// Pass tenantSlug + siteBasePath same as [[...path]]/page.tsx (line 344)
const siteWithContext = { ...site, tenantSlug: slug, siteBasePath: base }

return (
    <SiteLayoutShell
        site={siteWithContext as SiteRendererProps['site']}
        pages={pages as unknown as NavPage[]}
        siteId={String(site.id)}
        isOwner={isOwner}
    >
        <TrackingManager siteId={String(site.id)} isOwner={isOwner} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        {/* Breadcrumb */}
        <div style={{ padding: '16px 32px', fontSize: '13px', maxWidth: '1200px', margin: '0 auto', ... }}>
            ...
        </div>

        {/* Product Detail grid */}
        <div style={{ ... }}>
            ...
        </div>

        <CartDrawer siteSlug={slug} siteId={String(site.id)} />
    </SiteLayoutShell>
)
```

### 4. Replace hardcoded colors with CSS variables

| Hardcoded | CSS Variable |
|-----------|-------------|
| `color: '#111'` | `color: 'var(--text)'` |
| `background: '#f8f8f8'` | `background: 'var(--brand-surface, #f8f8f8)'` |
| `border: '1px solid #eee'` | `border: '1px solid rgba(var(--brand-primary-rgb), 0.125)'` |
| `color: '#999'` | `color: 'var(--text-muted, #999)'` |
| `color: '#666'` | `color: 'var(--text-muted)'` |
| `color: '#bbb'` | `opacity: 0.5` on existing text |
| `background: '#fef2f2'` (discount badge) | keep as-is (semantic red) |
| `color: '#ef4444'` (discount %) | keep as-is (semantic red) |
| `background: '#fafafa'` (attr table) | `background: 'rgba(var(--brand-primary-rgb), 0.03)'` |

Stock colors (`#22c55e`, `#f59e0b`, `#ef4444`) → keep as-is (semantic meaning).

### 5. Remove SiteTheme interface (move inline to usage)

The `SiteTheme` interface defined inside the function body can be removed since we'll get fonts via `SiteLayoutShell`'s `GoogleFontsLoader`. Remove:
- `interface SiteTheme` declaration inside function body
- `fontFamily` inline style on root `<div>` (SiteLayoutShell handles via `var(--font-body)`)

### 6. Remove generateMetadata tenant hostname hack (optional, out of scope)

Keep existing `generateMetadata` unchanged to avoid regression.

## Verification

```bash
npx tsc --noEmit
# Visit /sites/[slug]/products/[productSlug] and verify:
# - Site nav appears (same as homepage)
# - Site footer appears
# - Colors match site theme (dark/light mode)
# - Product data displays correctly
```
