---
status: completed
feature: GH-12 / F30 Hero media overlay
branch: fix/F05-12-image-upload-ai-gen
created: 2026-04-21
---

# Hero Media Overlay — Inline Image & Video Editing

Inline click-to-edit overlay for hero blocks: click trực tiếp vào ảnh/video trong preview để thay đổi mà không cần mở sidebar.

## Design

**Option A (approved):** `BlockEditCallbackContext` + `HeroMediaOverlay` component

- Context cung cấp `{ blockIndex, onFieldChange }` — null khi ngoài editor
- Overlay hiện khi `isOwner && context !== null` — hover → show 2-3 action buttons
- Buttons: Change Image (upload file) | AI Generate (F05 pipeline) | Change Video (video variants)
- Video input: popover inline với 2 tab — URL paste + file upload

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| [01](./phase-01-context-and-overlay.md) | Shared infra: compress-image util, BlockEditCallbackContext, HeroMediaOverlay, VideoInputPopover | completed |
| [02](./phase-02-wiring.md) | SiteRenderer prop extension + wire overlay into 6 hero variants | completed |
| [03](./phase-03-qa-tests.md) | QA doc TC-IDs + unit tests | completed |

## Key files

- `src/lib/media/compress-image.ts` — NEW (extracted from BlockImageEditor)
- `src/components/site-renderer/BlockEditCallbackContext.tsx` — NEW
- `src/blocks/hero/shared.tsx` — MODIFY (add HeroMediaOverlay + VideoInputPopover)
- `src/components/site-renderer/SiteRenderer.tsx` — MODIFY (add onBlockFieldChange prop)
- 6 variants: split, magazine, cards-overlay, slideshow, video, split-video — MODIFY
- `docs/qa/F30-hero-media-overlay.md` — NEW

## Dependencies

- `uploadMediaAction` từ `src/app/(dashboard)/actions/media.ts`
- `useIsOwner()` từ `OwnerContext` (pattern to mirror)
- F05 AI gen pipeline (`ingestUrlToMediaIfNeeded`) — AI Generate button stubs stub nếu chưa implement

## Constraints

- YAGNI: không add overlay vào các variants không có image/video (fullscreen, minimal, centered)
- Overlay chỉ render khi `isOwner && context !== null` — zero cost trên public sites
- VideoInputPopover là plain div popover, không dùng Radix/Dialog để giữ bundle nhỏ
