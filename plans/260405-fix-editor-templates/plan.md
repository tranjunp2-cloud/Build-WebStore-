---
title: "Fix Editor Templates — Enable template picker in editor"
description: "Connect Templates button in editor toolbar to a modal that lets users apply templates to existing sites"
status: done
priority: P2
effort: 4h
branch: feat/rebuild-user-flow
tags: [editor, templates, ui]
created: 2026-04-05
---

# Fix Editor Templates

## Problem
Nút "Templates" trong Editor toolbar chỉ show toast placeholder: *"Template gallery will be connected in the next step."*. User không thể chọn template khi đang ở trong editor.

## Root Cause
1. Editor page (line 667) dùng `toast.info()` thay vì mở modal
2. Không có `EditorTemplateModal` component
3. API `apply-template` chỉ tạo site MỚI, không apply vào site hiện có

## Solution Overview
Tạo template picker modal trong editor + API apply template vào existing site.

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | API: Apply template to existing site | done | [phase-01](./phase-01-api-apply-to-existing.md) |
| 2 | UI: EditorTemplateModal component | done | [phase-02](./phase-02-editor-template-modal.md) |
| 3 | Integration: Connect modal to editor | done | [phase-03](./phase-03-integration.md) |

## Architecture

```
Editor Page
  └── EditorToolbar (Templates button)
        └── onClick → setIsTemplateModalOpen(true)

EditorTemplateModal (NEW)
  ├── Fetch /api/templates/list
  ├── Grid: TemplateCard (reuse existing)
  ├── Search + Category filter
  ├── Preview: TemplatePreviewModal (reuse existing)
  └── "Use Template" → confirm dialog → PATCH /api/ai/apply-template

API: /api/ai/apply-template (UPDATED)
  ├── If siteId provided → apply to existing site
  │   ├── Update site.theme with template.defaultTheme
  │   ├── Replace current page layout with template.defaultBlocks
  │   └── Return updated siteId
  └── If no siteId → create new site (existing behavior)
```

## Key Files
- `src/app/(editor)/editor/[siteId]/page.tsx` — Editor page (connect modal)
- `src/app/api/ai/apply-template/route.ts` — API (add existing site support)
- `src/components/editor/EditorTemplateModal.tsx` — NEW modal component
- `src/components/frontend/TemplateCard.tsx` — Reuse
- `src/components/frontend/TemplatePreviewModal.tsx` — Reuse

## Risks
- **Destructive action**: Applying template replaces ALL blocks on current page → need confirmation dialog
- **Undo**: After template apply, user loses previous blocks → consider saving snapshot for undo
