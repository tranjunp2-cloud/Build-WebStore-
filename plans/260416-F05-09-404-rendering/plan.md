---
title: "BUG-F05-09: 404 page hiển thị sai — render như page bình thường"
description: "Fix 404 page rendering: empty layout shows as blank page, missing draft:true query, no 404 content block"
status: pending
priority: P1
effort: 1.5h
branch: fix/F05-09-404-page-rendering
issue: 656
tags: [editor, 404, F05, rendering]
created: 2026-04-16
---

# BUG-F05-09: 404 Page hiển thị sai

## Problem
Khi truy cập URL không tồn tại, trang hiện ra nav + footer trống (như page bình thường) thay vì "Page Not Found".

## Root Cause (3 issues)

### 1. 404 page có `layout: []` (empty)
Generate-site tạo 404 page với `layout: []`. SiteRenderer render ra nav + footer + empty content → trông như page bình thường.

### 2. Query 404 page không dùng `draft: true`
`not-found.tsx` line 62-77 query pages **không có** `draft: true`. Nếu 404 page ở trạng thái draft → query trả empty → fallback404 render NHƯNG không có site theme/branding.

### 3. Không có 404 content block
Không có block nào render "Page Not Found" message. 404 page cần content hiển thị rõ ràng cho user.

## Fix Plan

### Phase 1: Fix not-found.tsx rendering (30m)
**File:** `src/app/sites/[slug]/not-found.tsx`

1. Add `draft: true` to 404 page query
2. When 404 page has empty layout OR doesn't exist → render **themed 404** (not plain Fallback404)
3. Themed 404 = site nav + "Page Not Found" message + footer, using site's theme

```tsx
// Instead of plain SiteRenderer with empty layout:
if (page404 && page404.layout?.length > 0) {
    return <SiteRenderer site={site} page={page404} pages={navPages} />
}

// Themed 404 fallback — shows site nav/footer + centered "404" message
return <Themed404 site={site} pages={navPages} />
```

### Phase 2: Create Themed404 component (30m)
**File:** `src/app/sites/[slug]/not-found.tsx` (inline component)

Renders:
- Site navigation (from headerBlock)
- Centered "404 — Page Not Found" with site theme colors
- "Go Home" button linking to `/`
- Site footer (from footerBlock)

Uses site's theme CSS vars for consistent branding.

### Phase 3: Fix generate-site 404 page creation (15m)
**File:** `src/app/api/ai/generate-site/route.ts` + `src/app/api/ai/apply-template/route.ts`

Add default 404 layout blocks when creating 404 page:
```typescript
layout: [
    { blockType: 'navigation', ...siteNav },
    { blockType: 'hero', variant: 'centered', headline: '404', subheadline: 'Page Not Found' },
    { blockType: 'footer', ...siteFooter },
]
```

## Success Criteria
- Visit non-existent URL → see themed "404 Page Not Found" with site nav/footer
- 404 page with custom layout → renders that layout (user can customize)
- 404 page with empty layout → renders themed fallback
- Works for both published and draft sites (owner preview)

## Risk: Low
- Only changes 404 rendering path — no impact on normal page rendering
- Backward compatible — existing 404 pages with custom layouts still work
