---
title: "Fix editor re-publish flow for live sites"
description: "Add hasUnpublishedChanges flag so Update button stays visible after save on published sites"
status: completed
priority: P1
effort: 1.5h
branch: chore/cleanup-env-vars
tags: [bugfix, editor, publish, UX]
created: 2026-04-12
---

# Fix Editor Re-publish Flow

## Problem

Site đã LIVE → user sửa nội dung → auto-save chạy → nút "Update" biến mất → user không thể re-publish → subdomain hiện nội dung cũ.

Root cause: `hasUnsavedChanges` flag chỉ track save state, không track publish state. Sau save, flag = false → nút ẩn.

## Solution

Thêm flag `hasUnpublishedChanges` vào editor store:
- Set `true` khi save thành công trên published site
- Clear `false` chỉ sau khi publish thành công
- Toolbar hiện "Update" khi `hasUnsavedChanges || hasUnpublishedChanges`

## Phases

| Phase | Description | Status | Effort |
|-------|-------------|--------|--------|
| [Phase 01](./phase-01-unpublished-changes-flag.md) | Add hasUnpublishedChanges to store + toolbar | ✅ done | 1h |
| [Phase 02](./phase-02-visual-indicator.md) | Add visual "unsaved changes" indicator near LIVE badge | ✅ done | 30m |

## Research

- [Editor flow analysis](./research/researcher-01-editor-flow.md)

## Files to Change

1. `src/store/editorStore.ts` — add `hasUnpublishedChanges` flag
2. `src/components/editor/EditorToolbar.tsx` — update button condition
3. `src/app/(editor)/editor/[siteId]/page.tsx` — clear flag on publish success

## Validation Summary

**Validated:** 2026-04-12
**Questions asked:** 2

### Confirmed Decisions
- **Update button behavior**: Save + Publish trong 1 click. Nếu đã auto-save → chỉ publish.
- **Visual badge**: Cần — badge LIVE chuyển amber "Changes pending" khi có unpublished changes
