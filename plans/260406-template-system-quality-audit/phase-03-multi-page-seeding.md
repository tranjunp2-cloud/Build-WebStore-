---
parent: plan.md
phase: 3
---

# Phase 3: Multi-Page Template Seeding

## Context
- Parent: [plan.md](plan.md)
- Dependencies: None (parallel with Phase 1 & 2)
- Docs: Templates collection, seed endpoint, apply-template endpoint

## Overview
- **Date:** 2026-04-06
- **Description:** Fix Professional/Premium templates to create 3-5 pages instead of just 1 homepage
- **Priority:** P1
- **Implementation status:** pending
- **Review status:** not started

## Key Insights

### Current Flow (BROKEN for multi-page)
```
composeTemplate() → { pages: [home, about, contact, services, blog] }
         ↓
seed endpoint → defaultBlocks: pages[0].layout ← ONLY HOMEPAGE SAVED
         ↓
apply-template → creates 1 Homepage + 1 404 ← ALL OTHER PAGES LOST
```

### Target Flow
```
composeTemplate() → { pages: [home, about, contact, services, blog] }
         ↓
seed endpoint → pages: JSON (all pages stored)
         ↓
apply-template → creates N pages from template
```

## Requirements
1. Templates collection: add `pages` JSON field (array of page objects)
2. Seed endpoint: store all pages from composeTemplate output
3. Apply-template: create all pages when applying template
4. Backward compatible: existing templates with only `defaultBlocks` still work

## Architecture

### Templates Collection Change
```typescript
// Add relationship field to Templates.ts:
{
  name: 'templatePages',
  type: 'array',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true },
    { name: 'layout', type: 'json' },
  ],
}
// Keep defaultBlocks for backward compat (homepage shortcut)
```

**DB: Normalized `templates_pages` table** (validated decision #2):
```sql
CREATE TABLE IF NOT EXISTS templates_template_pages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  _order integer NOT NULL DEFAULT 0,
  _parent_id integer NOT NULL,
  _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
  title varchar NOT NULL,
  slug varchar NOT NULL,
  layout jsonb
);
```

### Seed Endpoint Change
```typescript
// After creating template, insert pages:
for (const [i, page] of seed.pages.entries()) {
  // Payload auto-handles array sub-table via templatePages field
}
// defaultBlocks still set for backward compat
```

### Apply-Template Change (với transaction + delete)
```typescript
// Current: chỉ update homepage layout — KHÔNG delete
// New: DELETE existing pages → CREATE mới từ template, bọc transaction

const req = payload.db.beginTransaction();
try {
  // 1. Delete existing pages for this site
  const existingPages = await payload.find({ collection: 'pages', where: { site: { equals: siteId } } });
  for (const page of existingPages.docs) {
    await payload.delete({ collection: 'pages', id: page.id });
  }

  // 2. Create new pages from template
  const pages = template.templatePages?.length
    ? template.templatePages
    : [{ title: 'Home', slug: 'home', layout: template.defaultBlocks }];
  for (const page of pages) {
    await payload.create({ collection: 'pages', data: { site: siteId, ...page } });
  }

  await req.commitTransaction();
} catch (err) {
  await req.rollbackTransaction();
  throw err;
}
```

### EditorTemplateModal Warning (UX)
```typescript
// Thêm warning text trong confirmation dialog:
// "Thay đổi template sẽ xóa toàn bộ nội dung hiện tại của website.
//  Bạn có chắc chắn muốn tiếp tục?"
// [Hủy] [Xác nhận thay đổi]
```

## Related Code Files
| File | Purpose | Action |
|------|---------|--------|
| `src/collections/Templates.ts` | Templates collection | ADD pages field |
| `src/app/api/templates/seed/route.ts` | Seed endpoint | UPDATE to store all pages |
| `src/app/api/ai/apply-template/route.ts` | Apply template | UPDATE to create multi-page |
| `src/lib/ai/template-composer.ts` | Composer output | READ (already outputs pages[]) |
| `scripts/db-setup.js` | DB migrations | ADD migration for templates_template_pages table |

## Implementation Steps

1. Add `templatePages` array field to `src/collections/Templates.ts` (with title, slug, layout sub-fields)
2. Add CREATE TABLE migration for `templates_template_pages` in `scripts/db-setup.js` (varchar id, _order, _parent_id, _uuid, title, slug, layout jsonb)
3. Update seed endpoint: use Payload API to create template with `templatePages` array — Payload auto-inserts into sub-table
4. Update apply-template: **DELETE existing site pages first**, then loop through `template.templatePages` and create each page
5. Handle backward compat: if `templatePages` is empty, fall back to `[{ title: 'Home', slug: 'home', layout: template.defaultBlocks }]`
6. Test: seed → apply → verify 5 pages created for Premium template
7. Test: re-apply different template → verify old pages deleted, new pages created

## Todo List
- [ ] Add `templatePages` array field to Templates collection
- [ ] Add CREATE TABLE migration cho `templates_template_pages` trong db-setup.js
- [ ] Update seed endpoint: store all pages qua Payload API (auto-insert sub-table)
- [ ] Update apply-template: DELETE existing pages + CREATE mới, bọc `payload.db.beginTransaction()`
- [ ] Thêm warning text trong EditorTemplateModal confirmation dialog
- [ ] Test backward compatibility: templates cũ không có `templatePages` vẫn hoạt động
- [ ] Test: apply Premium template → verify 5 pages created
- [ ] Test: re-apply template → verify pages cũ bị xóa, pages mới tạo đúng
- [ ] Test: transaction rollback khi 1 page create fail

## Success Criteria
- [ ] Premium template → 5 pages (Home, About, Contact, Services, Blog)
- [ ] Professional template → 3 pages (Home, About, Contact)
- [ ] Starter template → 1 page (Home)
- [ ] Existing templates without `pages` field still work
- [ ] DB migration passes CI check-migrations.js

## Risk Assessment
- **Medium**: DB schema change — cần migration trong db-setup.js (established pattern)
- **Low**: Backward compatible — `templatePages` nullable, fallback về `defaultBlocks`
- **High**: DELETE + CREATE pages không bọc transaction → partial failure = orphan pages hoặc mất data. **PHẢI dùng `payload.db.beginTransaction()`**
- **Medium**: Race condition nếu 2 request apply-template cùng lúc cho 1 site → dùng optimistic locking hoặc check site.updatedAt

## Security Considerations
- `pages` JSON validated by Zod before storing
- Page slugs sanitized (no path traversal)
- No user input in this flow (all from template configs)

## Next Steps
→ Phase 4 (smoke test) validates multi-page creation works
