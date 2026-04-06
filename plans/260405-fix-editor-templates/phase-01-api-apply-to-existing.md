---
parent: plan.md
status: pending
priority: P1
---

# Phase 1: API — Apply template to existing site

## Context
API `/api/ai/apply-template` hiện chỉ tạo site mới. Cần thêm logic apply vào site hiện có khi `siteId` được truyền vào.

## Overview
- Schema đã có `siteId: string.optional()` (dead code) → activate nó
- Khi `siteId` provided: update site theme + replace page blocks
- Khi không có `siteId`: giữ nguyên behavior cũ (create new site)

## Related Files
- `src/app/api/ai/apply-template/route.ts` (lines 14-128)
- `src/lib/validations/ai.ts` (line 30-33, schema)

## Implementation Steps

### 1. Update apply-template route
```typescript
// After template fetch (line 40), add branch:
if (body.siteId) {
  // === APPLY TO EXISTING SITE ===

  // Verify site belongs to user's tenant
  const site = await payload.findByID({ collection: 'sites', id: body.siteId })
  if (!site || site.tenant !== tenantId) return 403

  // Update site theme
  await payload.update({
    collection: 'sites',
    id: body.siteId,
    data: {
      theme: {
        primaryColor: template.defaultTheme.primaryColor,
        secondaryColor: template.defaultTheme.secondaryColor,
        fontHeading: template.defaultTheme.fontHeading,
        fontBody: template.defaultTheme.fontBody,
        colorMode: template.defaultTheme.colorMode,
      }
    }
  })

  // Find homepage of this site
  const homepage = await payload.find({
    collection: 'pages',
    where: { site: { equals: body.siteId }, isHomepage: { equals: true } },
    limit: 1,
  })

  if (homepage.docs[0]) {
    // Replace homepage blocks with template blocks
    await payload.update({
      collection: 'pages',
      id: homepage.docs[0].id,
      data: { layout: blocks }
    })
  }

  // Increment usage
  await payload.update({ collection: 'templates', id: template.id, data: { usageCount: (template.usageCount || 0) + 1 } })

  return { success: true, siteId: body.siteId, siteName: site.name, templateName: template.name, applied: true }
} else {
  // === EXISTING: CREATE NEW SITE ===
  // ... keep current code
}
```

### 2. Optional: Add `pageId` param
- If user is on a non-homepage, apply template to that specific page
- Schema: `pageId: z.string().optional()`

## Success Criteria
- [x] `POST /api/ai/apply-template { templateId, siteId }` updates existing site
- [x] Site theme updated with template theme
- [x] Homepage blocks replaced with template blocks
- [x] Ownership verification (tenant check)
- [x] Existing behavior (no siteId) unchanged

## Risk
- **Data loss**: Replacing blocks is destructive → handled by confirmation UI in Phase 2
