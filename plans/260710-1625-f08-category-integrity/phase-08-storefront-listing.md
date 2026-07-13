# Phase 08 — Storefront Product Listing + Sidebar Filter (#8)

**PR:** 2 · **Migration:** No · **Priority:** P1 · **Status:** pending · **Depends:** PR-1 merged

## Context

- Storefront product listing is DISABLED: `src/app/sites/[slug]/products/_page.disabled.tsx` (351 lines). It already imports `PlpSidebar` (`src/components/storefront/PlpSidebar.tsx` — EXISTS) and does `getSiteAndProducts(slug, searchParams)` fetching products + extracting categories/prices/attributes.
- Active renderer: `src/app/sites/[slug]/[[...path]]/page.tsx` handles catch-all paths; currently filters category only for blog, NOT products.
- Product DETAIL page works: `src/app/sites/[slug]/products/[productSlug]/page.tsx` (renders breadcrumbs fine).

## Overview

Re-enable the product listing page (PLP) with a working 3-level category sidebar filter that passes `categoryId` (or category slug) to the product query. First AUDIT the disabled file against current schema before restoring — it predates recent Products/Categories changes.

## Key Insights

- **Do NOT blindly rename `_page.disabled.tsx` → `page.tsx`.** It may reference removed fields, stale query shapes, or conflict with the `[[...path]]` catch-all route (route collision: `/products` could match both the explicit `products/page.tsx` and the catch-all). Investigate routing precedence first.
- Category filter must include descendants: selecting an L1 category should show products in it AND its L2/L3 children (use the descendant-id expansion already in `getCategoriesAction:23-31`).
- Reuse `PlpSidebar` (already built for this). Confirm its props match what the restored page provides.
- Storefront read access for categories/products is public (Categories `read` allows anon with `deletedAt exists:false` — `Categories.ts:27-31`).

## Requirements

- Functional: `/sites/[slug]/products` lists published products for the site; sidebar filters by category (3 levels, descendant-inclusive); URL carries `?category=<slug|id>` for shareable/filtered state.
- Non-functional: SSR (`force-dynamic` already set), no N+1 (batch category descendant expansion).

## Architecture / Data Flow

```
/sites/[slug]/products?category=<slug>
  → resolve tenant+site by slug
  → resolve category by slug (tenant-scoped) → expand to [self + descendant ids]
  → payload.find products where site + status published + category in [ids]
  → render grid + PlpSidebar(categories tree, activeCategory)
```

## Related Code Files

**Investigate first (read):**
- `src/app/sites/[slug]/products/_page.disabled.tsx` (full 351 lines) — validate every field/query against current `Products.ts` / `Categories.ts`.
- `src/app/sites/[slug]/[[...path]]/page.tsx` — check route collision with an explicit `products/page.tsx`; decide whether PLP lives as explicit route or a branch inside catch-all.
- `src/components/storefront/PlpSidebar.tsx` — props contract.
- `src/app/sites/[slug]/products/[productSlug]/page.tsx` — reuse product-card/query patterns.

**Modify / Create (decision pending audit):**
- Restore `src/app/sites/[slug]/products/page.tsx` from the disabled file (audited + fixed), OR add a product branch in `[[...path]]/page.tsx`.
- Possibly update `PlpSidebar` to emit `categoryId`/slug query param + 3-level drill.
- Add category→products query util (descendant expansion) — reuse logic from `getCategoriesAction`.

**No migration, no i18n (unless new empty-state copy).**

## Implementation Steps

1. **Audit** disabled file: list every product/category field it reads; diff vs current collections; flag stale references.
2. **Resolve routing**: confirm whether `/products` collides with `[[...path]]`. If Next resolves explicit static segment before catch-all (it does), an explicit `products/page.tsx` wins — safe. Verify with a quick route test.
3. Fix stale queries; wire category filter: read `searchParams.category`, resolve to category (tenant-scoped, respect Phase 01 per-tenant slug), expand descendants, filter products.
4. Integrate `PlpSidebar` with active-category highlight + links carrying `?category=`.
5. Empty state when no products / no category match.
6. Manual visual QA on a seeded tenant.

## Todo

- [ ] Audit `_page.disabled.tsx` vs current schema (report stale refs)
- [ ] Resolve route collision decision (explicit vs catch-all branch)
- [ ] Category slug/id resolution + descendant expansion in query
- [ ] Restore/enable PLP page with fixes
- [ ] Sidebar filter wired to `?category=` (3 levels)
- [ ] Empty states
- [ ] Visual QA seeded tenant

## Success Criteria

- `/sites/[slug]/products` renders published products.
- Selecting any category level filters correctly, including descendants.
- Filter state reflected in URL; back/share works.
- No route conflict / no build error.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Disabled file stale → runtime errors | High×High | Mandatory audit step 1 before enabling |
| Route collision `/products` vs catch-all | Med×High | Verify Next precedence (step 2); pick one owner route |
| N+1 on descendant category expansion | Med×Med | Single find + in-memory descendant map (reuse getCategoriesAction pattern) |
| Public read leaking soft-deleted | Low×Med | `deletedAt exists:false` + status published filters |

## Security

- Anonymous read only published products + non-deleted categories, tenant/site scoped. No write surface.

## Next Steps

- Phase 10 adds tests + visual QA sign-off.
