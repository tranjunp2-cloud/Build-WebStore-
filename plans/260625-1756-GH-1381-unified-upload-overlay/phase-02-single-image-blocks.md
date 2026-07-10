# Phase 02 — Single-image blocks

**Priority:** P1 · **Status:** pending · **Effort:** 3h · **Depends:** P1 · **Parallel with:** P3, P4

## Overview

Wrap the media element in single-image blocks with `MediaUploadOverlay`. Each block ships independently; Path B remains as fallback until P5.

## Scope (this phase)
| Block | File | Field | valueShape | UPLOAD_FIELDS? | Notes |
|-------|------|-------|-----------|----------------|-------|
| about | `src/blocks/about/index.tsx` | `image` | media | YES | root `<img>` (lines ~84, ~407) |
| property-card | `src/blocks/property-card/index.tsx` | `image` | media | YES | `<Image>` root |
| before-after | `src/blocks/before-after/index.tsx` | `beforeImage` + `afterImage` | **url-group** | N/A (group) | TWO overlays, two fields |

> **`video` block poster+videoUrl handled in P4, NOT here** (avoids file-ownership overlap on `video/index.tsx`).

## Key decision — before-after (CONFIRMED schema)

`beforeImage`/`afterImage` are Payload `type: 'group'` with `{url:text, alt:text, label:text}` (Pages.ts:1441-1455). They are **NOT media relations**. Therefore:
- Overlay sends `onFieldChange('beforeImage', {url, alt})` — populates `.url` so render gate (`beforeImage?.url`) shows new image immediately.
- **Do NOT** send `{id,...}` and **do NOT** add to UPLOAD_FIELDS (normalizeUploadField would null a non-id object / a string).
- The uploaded media's `.url` (CDN URL) persists directly as the group's `url` text field. The Media row still gets created by the upload endpoint; we just don't reference it by id. Acceptable (matches how before-after already stores URLs).
- Each image wrapped in its own overlay with `field="beforeImage"` / `field="afterImage"`, `valueShape="url-group"`.

## Pattern per block

```tsx
<MediaUploadOverlay field="image" altText={headline} valueShape="media">
  <Image src={image?.url} ... />
</MediaUploadOverlay>
```
- Block render must already gate on `image?.url` (object) — verify each. about/property-card likely render `image.url`; if they render a bare string, adjust to object-or-string tolerant (most already are post-GH-1381).
- Container: overlay adds `relative` wrapper (`positionClass` default). Ensure no layout break (image was likely already in a relative parent).
- `useIsOwner` gating is inside the overlay — safe to always render; collapses to children for public view.

## Files
- **Modify:** `src/blocks/about/index.tsx`, `src/blocks/property-card/index.tsx`, `src/blocks/before-after/index.tsx`
- **Read:** `src/blocks/shared/media-upload-overlay.tsx` (P1 output), each block's config.ts to confirm field types.

## Implementation steps
1. about: wrap the main `<img>`/`<Image>` (and any secondary image with its own field) in `MediaUploadOverlay field="image"`.
2. property-card: wrap root image, `field="image"`.
3. before-after: wrap before image `field="beforeImage" valueShape="url-group"`; after image `field="afterImage" valueShape="url-group"`. Confirm render reads `beforeImage.url`/`afterImage.url`.
4. Leave existing `data-image-index`/plain `<img>` in place (Path B fallback still active). Overlay button is the new primary path.
5. Typecheck.

## Acceptance criteria
- [ ] about/property-card: hover → overlay button top-right → upload → image swaps in-place, persists after reload (id-based).
- [ ] before-after: each image independently replaceable; both persist via group `.url`; reload keeps both.
- [ ] before-after does NOT null on save (regression guard — explicit P6 test).
- [ ] Public (non-owner) render unchanged (no overlay, no extra DOM).
- [ ] Typecheck clean.

## Risks
| Risk | L×I | Mitigation |
|------|-----|------------|
| before-after sent as `{id,url}` → save nulls (group has no id col) | M×H | enforce `valueShape="url-group"`; P6 asserts `{url,alt}` payload + non-null after normalize |
| about secondary images missed | M×M | grep all `<img`/`<Image` in about/index.tsx; wrap each editable one |
| Double overlay + Path B both fire → double save | L×M | overlay click is `data-editor-control` (PreviewScripts ignores), `<img>` click still Path B — distinct; fine during transition |

## Unresolved questions
- Q2.1: about block — are there multiple editable images (e.g. team/gallery sub-images) or just one root `image`? Confirm field count before wrapping.
- Q2.2: before-after — confirm render currently reads `beforeImage.url` (not a bare string). If bare string, value shape stays `{url,alt}` but render gate may need a tolerant read.
