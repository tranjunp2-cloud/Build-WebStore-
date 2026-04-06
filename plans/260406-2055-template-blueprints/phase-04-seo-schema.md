---
parent: plan.md
phase: 4
---

# Phase 4: SEO Layer — JSON-LD, Heading Hierarchy, Meta Template

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Phase 2 (composer rewrite)
- Reference: `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` Section 3

## Overview
- **Description:** Inject SEO best practices vào template rendering: JSON-LD per page, heading hierarchy, meta tags
- **Priority:** P0 (SEO là chuẩn bắt buộc 2026, không phải nice-to-have)
- **Implementation status:** pending

## Key Insight (từ research)
- Google AI Overviews + Perplexity + ChatGPT search dùng structured data để chọn sources
- FAQPage schema → FAQ rich snippets trong SERP (click-through rate boost 20-30%)
- Organization schema → Knowledge Panel
- BreadcrumbList → breadcrumb links trong SERP
- **Nếu templates có sẵn schema → user websites SEO tốt hơn đối thủ từ ngày đầu**

## Requirements

### 1. JSON-LD Schema per Page Type
```typescript
// Template composer tự inject schema vào mỗi page
const PAGE_SCHEMAS = {
  home: ['Organization', 'WebSite', 'BreadcrumbList'],
  about: ['Organization', 'BreadcrumbList'],
  services: ['Service', 'Offer', 'BreadcrumbList'],
  contact: ['LocalBusiness', 'BreadcrumbList'],
  blog: ['Blog', 'BreadcrumbList'],
  faq: ['FAQPage', 'BreadcrumbList'],
  menu: ['Restaurant', 'Menu', 'BreadcrumbList'],
  pricing: ['Offer', 'BreadcrumbList'],
  team: ['Organization', 'BreadcrumbList'],
  gallery: ['ImageGallery', 'BreadcrumbList'],
  portfolio: ['CreativeWork', 'BreadcrumbList'],
  properties: ['RealEstateAgent', 'BreadcrumbList'],
  classes: ['EducationalOrganization', 'BreadcrumbList'],
}
```

### 2. Heading Hierarchy Enforcement
- Hero block H1 = page title (1 per page, no exceptions)
- Section titles = H2
- Card/item titles = H3
- Composer validates: exactly 1 H1, no skipped levels

### 3. Meta Tags Template per Page
```typescript
{
  title: `${pageTitle} — ${businessName}`,  // 50-60 chars
  description: `${pageDescription}`,         // 150-160 chars
  canonical: `${siteUrl}/${pageSlug}`,
  ogTitle: `${pageTitle}`,
  ogDescription: `${pageDescription}`,
  ogImage: `${heroImage || siteImage}`,
}
```

### 4. Image SEO in Blocks
- All `<img>` have `width`, `height`, `alt` attributes
- Below-fold images: `loading="lazy"`
- Hero image: `loading="eager"`, `fetchpriority="high"`

## Related Code Files
- `src/lib/ai/template-composer.ts` — inject schema + meta per page
- `src/components/site-renderer/SiteRenderer.tsx` — render JSON-LD in `<head>`
- `src/blocks/hero/index.tsx` — H1 enforcement
- `src/blocks/*/index.tsx` — H2/H3 hierarchy

## Implementation Steps

### Step 1: Create `src/lib/seo/schema-builder.ts`
- `buildOrganizationSchema(biz)` → Organization JSON-LD
- `buildBreadcrumbSchema(pages, currentPage)` → BreadcrumbList
- `buildFAQSchema(faqItems)` → FAQPage (from FAQ block data)
- `buildLocalBusinessSchema(biz)` → LocalBusiness (contact page)

### Step 2: Update composer to attach schema per page
```typescript
// In composeFromBlueprint():
pages: preset.pages.map(page => ({
  ...pageData,
  seo: {
    schemas: buildSchemasForPage(page.slug, biz, blocks),
    meta: buildMetaForPage(page, biz),
  }
}))
```

### Step 3: Update SiteRenderer to output JSON-LD
- Render `<script type="application/ld+json">` in page head
- Multiple schemas per page (array of JSON-LD objects)

### Step 4: Heading audit
- Hero block: ensure H1 tag
- All other blocks: H2 for section title, H3 for items
- NO H1 in non-hero blocks

## Todo
- [ ] Create schema-builder.ts with 5 schema builders
- [ ] Update composer to attach seo object per page
- [ ] Update SiteRenderer to render JSON-LD
- [ ] Audit hero block H1
- [ ] Audit all blocks heading levels
- [ ] Add meta tags template per page

## Success Criteria
- [ ] Every generated page has ≥2 JSON-LD schemas (BreadcrumbList + page-specific)
- [ ] Homepage has Organization + WebSite + BreadcrumbList
- [ ] FAQ pages have FAQPage schema
- [ ] Contact pages have LocalBusiness schema
- [ ] 1 H1 per page, no skipped heading levels
- [ ] All images have alt, width, height attributes
- [ ] Meta title ≤60 chars, meta description ≤160 chars

## Risk Assessment
- LOW: Schema injection is additive, no breaking changes
- MEDIUM: Heading hierarchy audit may require minor block changes
