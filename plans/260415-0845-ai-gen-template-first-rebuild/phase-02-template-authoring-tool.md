# Phase 02 — Template Authoring Tool (Admin UI)

## Context links
- **Parent**: [plan.md](./plan.md)
- **Depends on**: Phase 01 (schema + taxonomy locked)
- **Related**: existing editor UI at `src/app/(builder)/*` (reuse block rendering)

## Overview
- **Date**: 2026-04-15
- **Description**: Build admin UI cho designer create/edit/preview/publish `TemplateEntry` without engineer involvement. Reuse existing block renderer. Gate behind super-admin role. Support version history + draft/publish workflow.
- **Priority**: P0 (blocks Phase 03 library population)
- **Implementation status**: pending
- **Review status**: not reviewed
- **Effort**: 2 weeks (8-10 working days)

## Key Insights
- **Designer must be unblocked on engineer** — without tool, every new template requires manual TS editing + deploy. Tool removes bottleneck for 100+ templates.
- **Reuse editor's block rendering** — don't rebuild renderer. Template authoring tool is admin wrapper around existing builder editor.
- **Versioning matters early** — editing published template without version = can break user sites. Start with version field + migration history from day 1.

## Requirements
- New admin route: `/admin/templates-v2/new`, `/admin/templates-v2/[id]/edit`
- List view: `/admin/templates-v2` — filter by category/sub-niche/status
- Form fields match TemplateEntry schema (Phase 01 output)
- Inline block editor — reuse existing `BlockEditor` component from builder
- Live preview pane — renders template exactly as end-user sees
- Draft/publish toggle — drafts invisible to end users
- Version bumping — publishing increments version, old version archived
- Access control: super-admin only (via Payload role check)
- Audit log: who edited, when, what changed

## Architecture

### New files
```
src/app/(admin)/admin/templates-v2/page.tsx               # list
src/app/(admin)/admin/templates-v2/new/page.tsx           # create
src/app/(admin)/admin/templates-v2/[id]/edit/page.tsx     # edit
src/app/(admin)/admin/templates-v2/[id]/preview/page.tsx  # full-page preview
src/components/admin/TemplateAuthoringForm.tsx            # form shell
src/components/admin/TemplateBlockEditor.tsx              # wraps builder editor
src/components/admin/TemplateVersionHistory.tsx           # version list + diff
src/collections/TemplatesV2.ts                            # Payload collection
```

### Reused components
- `src/app/(builder)/builder/[siteId]/BuilderClient.tsx` — block editor core
- `src/components/blocks/*` — existing block renderer
- `src/lib/payload/auth.ts` — role check helpers

### Data flow
```
Designer opens form
  → select category + sub-niche
  → fill metadata (name, tags, tier, preview image upload)
  → drag-drop blocks (reuse builder)
  → live preview pane renders TemplateEntry.pages
  → save draft OR publish
  → Payload create/update TemplatesV2
  → publish triggers version bump + archives old version
```

## Related code files
- `src/collections/Pages.ts` — reference for Payload collection pattern
- `src/app/(builder)/builder/[siteId]/BuilderClient.tsx` — block editor to reuse
- `src/components/blocks/index.ts` — block renderer components
- `src/lib/payload/auth.ts` — auth patterns
- Phase 01 `reports/template-entry-schema.md` — data model

## Implementation Steps
1. Create Payload collection `TemplatesV2.ts` (1 day):
   - Schema matches Phase 01 TemplateEntry
   - Access control: super-admin only
   - Hooks for version bump on publish
2. Build list view page (1 day):
   - Filter by category/sub-niche/status
   - Pagination + search
3. Build create form (2 days):
   - Metadata inputs (name, slug, tags, tier, etc.)
   - Category + sub-niche selects (from Phase 01 taxonomy)
   - Preview image upload
   - Save as draft button
4. Integrate block editor (3 days):
   - Reuse `BuilderClient` as embedded component
   - Bind to template.pages[] instead of site.pages[]
   - Add/remove/reorder pages within template
5. Build live preview pane (1 day):
   - Side-by-side layout: form left, preview right
   - Renders TemplateEntry.pages exactly as end-user sees
   - Desktop + mobile viewport toggle
6. Publish workflow (1 day):
   - Confirm modal: "publish affects users choosing this template"
   - Version bump + archive old draft
   - Audit log entry
7. Version history page (1 day):
   - List all versions of a template
   - Diff viewer between versions
8. Migration import (1 day):
   - Script to import existing SEED_TEMPLATES into new collection as v1
   - Validates against TemplateEntry schema
9. Review gate with anh (30min): designer walkthrough + feedback before Phase 03 starts

## Todo list
- [ ] Create Payload TemplatesV2 collection
- [ ] Admin list page + filters
- [ ] Create form shell
- [ ] Embed block editor
- [ ] Live preview pane
- [ ] Publish workflow + versioning
- [ ] Version history view
- [ ] Migration import script for SEED_TEMPLATES → v1
- [ ] Designer walkthrough + feedback

## Success Criteria
- Designer can create 1 complete template end-to-end in ≤15 minutes
- Preview pane matches end-user render 1:1
- Publish workflow blocks accidental production changes (confirmation modal)
- Version history allows rollback
- 25 existing SEED_TEMPLATES migrate to TemplatesV2 cleanly
- Super-admin access control verified (403 for non-admin users)

## Risk Assessment
- **Block editor reuse is complex** — existing editor is tied to site/page context. Decoupling for template context may break assumptions. Mitigation: spike 1 day to validate reuse pattern before committing.
- **Payload collection migration** — new collection means DB migration. Must go through `scripts/db-setup.js` MIGRATIONS array per repo convention.
- **Preview fidelity** — preview rendering may not match end-user output exactly (SSR vs client-side hydration). Mitigation: iframe preview rendering production route.

## Security Considerations
- Super-admin only — verify via Payload role check on every route
- Audit log entries include userId + before/after diffs
- Template content user-uploaded — sanitize via existing content-rules.ts
- Preview image upload — use existing media pipeline + size limits

## Next steps
- Phase 03 uses tool to author 100 templates
- Phase 07 (rollout) uses version history to feature-flag template changes
