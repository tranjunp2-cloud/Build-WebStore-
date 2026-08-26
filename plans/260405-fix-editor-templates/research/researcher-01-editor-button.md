---
title: Editor Templates Button Research
---

## Current State
- EditorToolbar has "Templates" button → calls `onOpenTemplates` prop
- Editor page (line 667): `onOpenTemplates={() => toast.info('Template gallery will be connected in the next step.')}`
- **Placeholder only** — no modal, no template picker

## Template Gallery (standalone page /templates)
- Fetches from `/api/templates/list?limit=50&sort=sortOrder`
- Displays TemplateCard grid with search/filter/category
- TemplatePreviewModal: iframe preview + "Use Template" button
- `handleUseTemplate` → POST `/api/ai/apply-template` → creates NEW site → redirect to editor

## apply-template API
- **Only creates NEW sites** from templates
- Schema has `siteId: string.optional()` but NEVER used (dead code)
- No logic to apply template to existing site

## Key Components (reusable)
- `TemplateCard` — displays template with preview
- `TemplatePreviewModal` — full preview + use button
- `/api/templates/list` — fetches all templates
- `/api/templates/preview?id=X` — renders HTML preview
