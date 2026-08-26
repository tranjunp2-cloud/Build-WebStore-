---
title: "Unified in-iframe media upload overlay (GH-1381)"
description: "Retire parent-frame ImageToolbar + handleImageReplace cascade; migrate every image/video block onto one shared MediaUploadOverlay extracted from HeroMediaOverlay."
status: pending
priority: P2
effort: 14h
branch: investigate/1381-gallery-change-image
tags: [editor, upload, refactor, GH-1381, F05]
created: 2026-06-25
---

# Unified Media Upload Overlay (GH-1381)

## Problem

Two upload systems → inconsistent UX:
- **Path A** (in-iframe overlay): `HeroMediaOverlay`, `LogoImageOverlay` — XHR progress bar, button top-right, in-place re-render via `BLOCK_FIELD_CHANGED`.
- **Path B** (parent-frame): click `<img>`/`data-image-index` → `IMAGE_EDITING_STARTED` → `ImageToolbar` (no spinner) → `handleImageReplace` 7-strategy cascade → `uploadMediaAction` (no progress).

Goal: ONE mechanism — the Path A overlay — for every block. Retire Path B.

## Target pattern

Extract `MediaUploadOverlay` from `HeroMediaOverlay` (src/blocks/hero/hero-media-overlay.tsx). Configurable: field path, image/video buttons, alt, button position. Wire via `callback.onFieldChange(field, value)` → `BLOCK_FIELD_CHANGED` handler (`PreviewFrame.tsx:668-690`) which already supports nested array paths (`images.2.image`) with NO new infra.

## Phases

| # | Phase | Status | Effort | Ship-independent? | Blocks |
|---|-------|--------|--------|-------------------|--------|
| 0 | [Reconcile uncommitted changes](phase-00-reconcile-uncommitted.md) | pending | 0.5h | yes | — |
| 1 | [Extract shared MediaUploadOverlay + i18n](phase-01-extract-shared-overlay.md) | pending | 3h | yes (hero parity) | P0 |
| 2 | [Single-image blocks](phase-02-single-image-blocks.md) | pending | 3h | yes (per block) | P1 |
| 3 | [Array-image blocks (~8)](phase-03-array-image-blocks.md) | pending | 4h | yes (per block) | P1 |
| 4 | [Video blocks + YouTube URL UX](phase-04-video-blocks.md) | pending | 2h | yes (per block) | P1 |
| 5 | [Retire Path B (ImageToolbar + cascade)](phase-05-retire-path-b.md) | pending | 2h | NO — after 2,3,4 | P2,P3,P4 |
| 6 | [Tests + verification](phase-06-tests-verification.md) | pending | 1.5h | per-phase | all |

## Dependency graph

```
P0 (reconcile) ──┐
                 ▼
P1 (extract overlay) ──┬──► P2 (single-image) ──┐
                       ├──► P3 (array-image)  ──┼──► P5 (retire Path B) ──► P6 (final tests)
                       └──► P4 (video)        ──┘
```

P2/P3/P4 are independent of each other (disjoint block files) → parallelizable after P1.
P5 MUST be last — removing Path B before a block is migrated leaves it non-editable.

## Critical architectural decisions (CONFIRMED from code)

1. **`BLOCK_FIELD_CHANGED` already handles nested array paths.** `field="images.2.image"` → split on `.`, numeric→index, `updateValueAtPath` → `updateBlock` + `UPDATE_BLOCK_DATA` + `performSave(true)`. No new plumbing for array blocks. (PreviewFrame.tsx:674-689)

2. **UPLOAD_FIELDS gap — per-field decision matrix** (`src/lib/block-normalization.ts:12`). `UPLOAD_FIELDS = [image, backgroundImage, logo, avatar, ogImage]`. Save route extracts `.id` from objects for these, root + nested-array. For each migrated field:

   | Field | Block | Pages.ts type | In UPLOAD_FIELDS? | Action |
   |-------|-------|---------------|-------------------|--------|
   | `image` | about, property-card, gallery[], carousel[], team[], portfolio-grid[] | upload→media | YES | none — works |
   | `avatar` | testimonials[], social-proof[] | upload→media | YES | none |
   | `logo` | logo-cloud[] | upload→media | YES | none (reconcile dup) |
   | `beforeImage`/`afterImage` | before-after | **group {url,alt,label}** | N/A | **send bare `{url, alt}` group — NOT `{id,url}`. URL persists as-is. Do NOT add to UPLOAD_FIELDS (it's not a media relation).** |
   | `posterImage` | video, video-background | **upload→media** | **NO** | **add `posterImage` to UPLOAD_FIELDS** (it IS a media relation; object would fail/mis-save otherwise). No DB migration — column already exists. |
   | `videoUrl` | hero, video, video-showcase[] | text | N/A | send string URL — works (hero proves it) |
   | `thumbnailUrl` | video-showcase[] | **text** | N/A | send string URL — NOT a media relation |

   **DANGER:** `normalizeUploadField` nulls any *string* value for a UPLOAD_FIELDS field. Never add a bare-URL/text field (videoUrl, thumbnailUrl, before/afterImage.url) to UPLOAD_FIELDS — it would null the data on save.

3. **`value` must pass `isAllowedValue`** (string | number | non-array object). `{id,url,alt}` and `{url,alt,label}` both pass. (PreviewFrame.tsx:671-673)

4. **Overlay upload mechanism:** Hero uses `useUploadProgress()` XHR (progress %). `LogoImageOverlay` uses `uploadMediaAction` (no progress). Shared overlay should use `useUploadProgress` (the better UX) for all.

## Backwards-compat / migration

- No data migration. Existing saved pages keep working (bare-id hydration on read is unchanged).
- Path B kept as live fallback during P2–P4 (each block ships migrated; Path B still catches un-migrated clicks). P5 removes Path B only after all blocks done.
- `posterImage` → UPLOAD_FIELDS is additive; existing rows already store integer ids → normalize is a no-op for them.

## Rollback

Each phase is a separate commit. P1 is hero-parity-only (revertable with zero block impact). P2–P4 per-block reverts leave Path B fallback intact. P5 revert restores ImageToolbar+cascade wholesale (keep the deleted code in one commit for clean revert).

## File ownership (no overlap across parallel phases)

- P1: `src/blocks/shared/media-upload-overlay.tsx` (new), `hero-media-overlay.tsx`, `i18n/locales/*.json`
- P2: `src/blocks/{about,property-card,before-after,video}/index.tsx`
- P3: `src/blocks/{gallery,gallery-masonry,carousel,team,testimonials,social-proof,portfolio-grid,logo-cloud}/index.tsx`
- P4: `src/blocks/{video,video-showcase}/index.tsx`, `split-video.tsx`
- P5: `PreviewFrame.tsx`, `ImageToolbar.tsx` (delete), `PreviewScripts.tsx`, `block-normalization.ts` (posterImage)
- P6: `src/__tests__/unit/editor/*`, `src/__tests__/unit/blocks/*`

⚠ P2 and P4 both touch `src/blocks/video/index.tsx` (poster=image, videoUrl=video). Assign `video/index.tsx` to **P4 only** (do both image+video buttons there). P2 covers about, property-card, before-after only.

## Key risks

| Risk | L×I | Mitigation |
|------|-----|------------|
| `posterImage` added to UPLOAD_FIELDS nulls a string-URL field elsewhere | L×H | grep all blocks: `posterImage` is upload-relation everywhere it appears; confirm no string usage before adding |
| before-after sends `{id,url}` → save nulls it (group has no id) | M×H | send `{url, alt}` only; add explicit test |
| Removing Path B breaks an un-migrated block | M×H | P5 gated on P2–P4 done; checklist of every block in P5 acceptance |
| Per-array-item overlay needs `relative` container → layout shift | M×M | wrap each item, reuse existing wrapper where present; visual check per block |
| YouTube URL entry lost when overlay only does file upload | M×M | P4 keeps URL text input (dual mode) for video/video-showcase |

## Unresolved questions (confirm with user)

See bottom of each phase + planner report.
