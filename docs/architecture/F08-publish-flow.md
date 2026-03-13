# Architecture: Publish Flow (F08)

> **Version:** 1.0 | **PRD:** [F08-publish-flow.md](../prd/F08-publish-flow.md)  
> **Tech:** Next.js 15 + Payload CMS 3

---

## 1. Publish Flow

```
User clicks "Publish"
       ↓
Pre-publish checklist (modal)
  ✅ Has ≥1 page with content
  ⚠️ SEO score <60 (warning only)
  ℹ️ URL: {slug}.primeweb.app
       ↓
User clicks "Publish ngay"
       ↓
API: POST /api/sites/[siteId]/publish
       ↓
  1. Update site.status = 'published'
  2. Update site.publishedAt = Date.now()
  3. Generate SEO meta (if not set) via OpenAI
  4. Invalidate ISR cache for storefront pages
  5. Generate sitemap.xml
       ↓
Success toast: "Site is live! 🎉" + URL + "View Store" button
```

## 2. API Route

```typescript
// POST /api/sites/[siteId]/publish
export async function POST(req, { params }) {
  // 1. Verify ownership
  // 2. Validate min content (≥1 page with blocks)
  // 3. Generate missing SEO meta via OpenAI
  // 4. Update Payload CMS: status → 'published'
  // 5. Trigger ISR revalidation: revalidatePath(`/sites/${slug}`)
  // 6. Return { url, publishedAt }
}
```

## 3. State Transitions

```
DRAFT ──→ PUBLISHED ──→ DRAFT (unpublish)
  │           │
  └─── Edit while published (changes are live on next publish)
```

## 4. Component: PublishButton

```
PublishButton
├── onClick → open PublishModal
├── PublishModal
│   ├── PrePublishChecklist
│   ├── SEO warning (if score < 60)
│   ├── "Publish ngay" CTA
│   └── Loading state during publish
└── SuccessToast (URL + "View Store")
```

## 5. Error Handling

| Error | Action |
|-------|--------|
| Missing content | Block publish, show checklist |
| SEO score low | Warning only, allow publish |
| API failure | Toast error + retry button |
| Payload CMS error | Log to Sentry, toast "Thử lại" |
