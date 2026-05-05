---
title: "F08 #841 — Product Detail Page with Full Site Layout"
status: pending
branch: fix/F08-841-product-detail-site-layout
issue: 841
feature: F08
priority: P0
created: 2026-05-05
blockedBy: []
blocks: []
---

# F08 #841 — Product Detail Page + Fix Buttons

## Overview

Fixes two related problems:
1. **#841 core**: "View Details" / "Quick View" buttons có no action khi click
2. **Layout**: Product detail page không dùng site header/footer, màu hardcode → conflict với site theme

## Architecture Decision

Tạo `SiteLayoutShell` server component — wrapper dùng chung site header/footer/theme.
- `SiteRenderer` KHÔNG refactor (risky, marginal DRY gain)
- URL rewriting dùng existing `src/lib/navigation-url.ts`
- Product URL pattern: `${site.siteBasePath}/products/${slug}` (established pattern từ `blog-list/index.tsx`)

## Phases

| Phase | File | Status |
|-------|------|--------|
| [Phase 01](phase-01-site-layout-shell.md) | Create `SiteLayoutShell` component | pending |
| [Phase 02](phase-02-product-detail-page.md) | Rewrite product detail page | pending |
| [Phase 03](phase-03-fix-product-buttons.md) | Fix View Details + Quick View buttons | pending |

## Files Changed

| File | Action |
|------|--------|
| `src/components/site-renderer/SiteLayoutShell.tsx` | CREATE |
| `src/app/sites/[slug]/products/[productSlug]/_page.old.tsx` | CREATE (backup bản cũ) |
| `src/app/sites/[slug]/products/[productSlug]/page.tsx` | REWRITE |
| `src/blocks/products-featured/index.tsx` | FIX |
| `src/blocks/products-grid/index.tsx` | FIX |
| `src/blocks/product-quick-view/index.tsx` | OUT OF SCOPE (bỏ qua) |

## Key Technical Context

- `resolveTheme` + `generateThemeCSS` → `src/lib/theme/resolve.ts`
- `buildSlugCanonicalMap` + `rewriteLiveUrl` → `src/lib/navigation-url.ts`
- `getSiteBasePath` → `src/lib/site-base-path.ts`
- `site.siteBasePath` + `site.tenantSlug` injected by main page (line 344 `[[...path]]/page.tsx`)
- Storefront API returns `slug` field (`src/app/api/storefront/products/route.ts` line 49)
- URL pattern: `${site.siteBasePath ?? `/sites/${site.tenantSlug}`}/products/${productSlug}`

## Success Criteria

- [ ] Product detail page shows site header/footer matching other pages
- [ ] Site colorMode (dark/light), primaryColor, fonts apply correctly
- [ ] "View Details" click → navigate to `/products/[slug]`  
- [ ] "Quick View" modal OR navigate to product detail (both acceptable)
- [ ] No regression on main site pages (SiteRenderer unchanged)
- [ ] TypeScript compiles without errors
