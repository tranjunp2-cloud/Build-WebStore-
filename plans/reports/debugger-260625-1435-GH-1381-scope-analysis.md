# GH-1381 Scope Analysis — Gallery "Change Image" Bug

**Date:** 2026-06-25
**Investigator:** debugger agent
**Scope:** READ-ONLY — no code changes

---

## Executive Summary

The bug has two distinct failure modes:
- **Case 1 (silent fail / fallback stays):** Strategy 6 stores `newMediaId` (integer) at `images[idx].image`, but the gallery component checks `img && typeof img === 'object' && img?.url` at line 165 — integer fails that check → slot falls through to Unsplash/S3 fallback URL. Preview never updates.
- **Case 2 (toast "Failed to replace image"):** Image upload or block-state lookup throws before any strategy matches.

All 6 gallery variants share the same `GalleryBlock` component entry point and the same `images[]` normalization at lines 162–172, so **all 6 variants are equally affected by Case 1.**

The bug is exclusive to `blockType: 'gallery'`. All array-image blocks in `ARRAY_BLOCK_TYPES` are handled by Strategy 7 (correct `{id,url,alt}` object). Hero and About blocks use a different code path (`HeroMediaOverlay` / inline `onFieldChange`) that bypasses the Strategy cascade entirely.

---

## Q1 — Gallery Variants: Fallback vs Real URL

All 6 variants share a single entry point: `GalleryBlock` in `src/blocks/gallery/index.tsx`.

The `images` array used by every variant is built at lines 158–172:

```tsx
// gallery/index.tsx:162–172
const images = Array.from({ length: slotCount }, (_, i) => {
    const item = rawImages[i] as Record<string, unknown> | undefined
    const img = item?.image
    if (img && typeof img === 'object' && (img as Record<string, unknown>)?.url) {
        return item as GalleryConfig['images'][number]   // ← real image
    }
    return {                                              // ← fallback
        image: { url: fallbackUrls[i % fallbackUrls.length]!, alt: `Gallery image ${i + 1}` },
        caption: (item?.caption as string) || '',
    }
})
```

After Strategy 6 fires, it stores: `currentImages[idx] = { ...currentImages[idx], image: newMediaId }` (line 953), where `newMediaId` is an integer. On next render, `img` is the integer → fails `typeof img === 'object'` → fallback URL is used.

| Variant | Renders from | After Strategy 6 fires | Case 1 bug? |
|---------|-------------|------------------------|-------------|
| Grid (default) | `images[]` processed at L162–172 | Integer fails object check → fallback URL shown | **YES** |
| Masonry | Same shared `images[]` array | Same | **YES** |
| Carousel | Same shared `images[]` array | Same | **YES** |
| Lightbox | Same shared `images[]` array | Same | **YES** |
| Filmstrip | Same shared `images[]` array | Same | **YES** |
| Justified | Same shared `images[]` array | Same | **YES** |

Evidence: `gallery/index.tsx:154–212` — all 6 variants receive the same `images` variable computed at L162–172. No variant constructs its own image-fetch logic.

---

## Q2 — Strategy Mapping per Block Type

`src/components/editor/PreviewFrame.tsx:809`:
```tsx
const ARRAY_BLOCK_TYPES = new Set(['carousel', 'portfolio-grid', 'team', 'testimonials', 'social-proof', 'logo-cloud'])
```

`gallery` is NOT in this set → `hasArrayIndex = false` for gallery even though `imageIndex` is present.

The strategy waterfall when a gallery image is clicked (has `imageIndex`, `blockType === 'gallery'`):

| Strategy | Condition | Result for gallery |
|----------|-----------|-------------------|
| 1 — URL string match | `fieldPath && !hasArrayIndex` | Falls through: gallery slots with fallback URLs won't have a matching string field path in `rawImages` (they're fabricated at render). |
| 2–3 — Field name match | `!hasArrayIndex && IMAGE_FIELD_NAMES` | `images` is an array, not a direct field name like `image`/`logo` → no match. |
| 4 — Deep nested URL match | `!hasArrayIndex`, finds object with `.url` matching `src` | Falls through: fallback URL is not stored in block data → not found. |
| 5 — Partial URL match | Skipped explicitly for gallery+imageIndex | `PreviewFrame.tsx:907`: `if (!matched && !(imageClickData.blockType === 'gallery' && imageClickData.imageIndex !== undefined))` — **hardcoded skip**. |
| **6 — Gallery fallback** | `!matched && imageIndex !== undefined && blockType === 'gallery'` | **FIRES. Stores bare integer `newMediaId` at `images[idx].image`.** `PreviewFrame.tsx:939–956` |
| 7 — Universal array handler | `!matched && imageIndex !== undefined` | Never reached (Strategy 6 sets `matched = true`). |

**Root cause of Case 1:** Strategy 6 (L953) stores an integer. The gallery component at L165 checks `typeof img === 'object' && img?.url` — integer fails → fallback shown. Strategy 7 would store `{ id, url, alt }` which passes the object check. Gallery should use Strategy 7 or Strategy 6 should store `{ id: newMediaId, url: newUrl, alt: '' }`.

| Block type | Strategy hit | Stores what | Preview updates? |
|-----------|-------------|-------------|-----------------|
| `gallery` (all 6 variants) | 6 | `integer` (bare `newMediaId`) | NO — fails `object&&.url` check |
| `carousel` | 7 | `{id, url, alt}` | YES |
| `portfolio-grid` | 7 | `{id, url, alt}` | YES |
| `team` | 7 | `{id, url, alt}` | YES |
| `testimonials` | 7 | `{id, url, alt}` | YES |
| `social-proof` | 7 | `{id, url, alt}` | YES |
| `logo-cloud` | 7 | `{id, url, alt}` | YES |

---

## Q3 — Other Image Blocks: Same Bug?

### Blocks using `data-image-index` (overlay-triggered replace):

Only 6 blocks have `data-image-index` on their rendered images (plus `shared/decorative.tsx` which is used by `team` and `social-proof`):

```
src/blocks/gallery/index.tsx        ← affected (Q2)
src/blocks/carousel/index.tsx       ← Strategy 7, correct
src/blocks/portfolio-grid/index.tsx ← Strategy 7, correct
src/blocks/team/index.tsx           ← Strategy 7, correct
src/blocks/logo-cloud/index.tsx     ← Strategy 7, correct
src/blocks/social-proof/index.tsx   ← Strategy 7, correct (via decorative.tsx)
```

### Hero block:

Hero does NOT use `data-image-index` at all. Evidence: `grep -rn "data-image-index" src/blocks/hero/` → **zero results**.

Hero uses `HeroMediaOverlay` (`hero-media-overlay.tsx:112`):
```tsx
callback.onFieldChange(imageField, { id: uploaded.id, url: uploaded.url, alt: altText })
```
This directly calls the block edit callback with a hydrated `{id, url, alt}` object — completely bypasses the Strategy 1–7 cascade. **Not affected.**

### About block:

About block has no `data-image-index` either (`grep` → zero results). It reads from `block.image?.url` (L132, L400), with `getAboutImage` fallback. Image replacement would go through Strategies 1–5 (URL-based, field-name-based). No array indexing involved. **Not affected by Case 1** (integer-stored-as-image does not apply here).

### Gallery-Masonry block (`gallery-masonry`):

`src/blocks/gallery-masonry/index.tsx` — renders `img.url` directly (L42, L60), no `data-image-index` on any element, no fallback injection logic. **"Change Image" overlay is not triggered** on `gallery-masonry` — the block's images have no `data-image-index` attribute, so `imageIndex` is never sent in `IMAGE_EDITING_STARTED`. Not affected by this bug.

### Summary table — all image blocks:

| Block | data-image-index? | "Change Image" overlay available? | Strategy | Bug? |
|-------|------------------|----------------------------------|----------|------|
| `gallery` (all 6 variants) | YES (L69–169) | YES | 6 (buggy) | **YES — Case 1** |
| `carousel` | YES (L112,163,213) | YES | 7 (correct) | NO |
| `portfolio-grid` | YES (L53) | YES | 7 (correct) | NO |
| `team` | YES (L85,109,511,524) | YES | 7 (correct) | NO |
| `logo-cloud` | YES (L40,69,91) | YES | 7 (correct) | NO |
| `social-proof` | YES (shared/decorative L241) | YES | 7 (correct) | NO |
| `hero` (all variants) | NO | NO (uses HeroMediaOverlay) | HeroMediaOverlay | NO |
| `about` | NO | NO (no data-image-index) | 1/2/3 (URL-based) | NO |
| `gallery-masonry` | NO | NO (no data-image-index) | N/A | NO |
| `products-featured` | YES | **BLOCKED** (imageReadOnlyBlockTypes) | N/A | N/A |
| `products-grid` | YES | **BLOCKED** (imageReadOnlyBlockTypes) | N/A | N/A |

---

## Q4 — Where "Change Image" Overlay Is Wired

`src/components/editor/PreviewScripts.tsx:577–605` — the click handler fires `IMAGE_EDITING_STARTED` when:

1. A clicked element is an `<img>` OR has `data-image-index` attribute (line 579)
2. The block container is NOT in `excludedBlockTypes = ['navigation', 'footer', 'breadcrumb']` (L31, L589)
3. The block is NOT in `imageReadOnlyBlockTypes = new Set(['products-featured', 'products-grid'])` (L37, L590)

The message carries `blockType`, `imageIndex`, `totalImagesInBlock`, `src`.

`src/components/editor/PreviewFrame.tsx:649` receives `IMAGE_EDITING_STARTED` → `setImageClickData` → opens overlay → user picks file → `handleImageReplace` fires Strategy cascade.

**Gallery IS wired** — all 6 variants render images with `data-image-index={i}` on the `<Image>` element (e.g., `GalleryImageCard` at L82, L98, L103; also the fallback placeholder div at L131 has `data-image-index={index}` but no `<img>` tag → click on placeholder fires via the `data-image-index` detection path). So overlay is available on all 6 gallery variants.

---

## Evidence Chain

| Fact | File:Line |
|------|-----------|
| Gallery NOT in ARRAY_BLOCK_TYPES → hasArrayIndex=false | `PreviewFrame.tsx:809` |
| Strategy 5 explicitly skipped for gallery+imageIndex | `PreviewFrame.tsx:907` |
| Strategy 6 fires, stores bare integer | `PreviewFrame.tsx:939–953` |
| Component checks `typeof img === 'object' && img?.url` | `gallery/index.tsx:165` |
| Integer fails object check → fallback URL used | `gallery/index.tsx:168–171` |
| Strategy 7 stores `{id, url, alt}` object (correct path) | `PreviewFrame.tsx:989` |
| Hero uses HeroMediaOverlay, bypasses strategies entirely | `hero-media-overlay.tsx:112` |
| Only 6 blocks have data-image-index (excluding read-only) | `grep -rln data-image-index src/blocks/` |
| imageReadOnlyBlockTypes blocks overlay | `PreviewScripts.tsx:37, 590` |

---

## Minimal Fix (not implemented — scope only)

Strategy 6 at `PreviewFrame.tsx:953` should store `{ id: newMediaId, url: newUrl, alt: '' }` instead of `newMediaId`:

```tsx
// BUGGY (L953):
currentImages[idx] = { ...currentImages[idx], image: newMediaId }

// FIXED:
currentImages[idx] = { ...currentImages[idx], image: { id: newMediaId, url: newUrl, alt: '' } }
```

This is identical to what Strategy 7 does at L989. The `normalizeUploadField` function correctly handles `{id, url}` objects by extracting `id` (L61–62 in `block-normalization.ts`), so persistence is safe. The gallery component's object check at L165 would then pass, showing the new image immediately.

Alternatively: add `'gallery'` to `ARRAY_BLOCK_TYPES` (L809) so `hasArrayIndex=true`, then add a `gallery` entry to `ARRAY_IMAGE_CONFIG` in Strategy 7 with `arrayField: 'images', imageSubField: 'image'`. This would also fix the bug and unify gallery with other array-image blocks.

---

## Unresolved Questions

1. **gallery-masonry image replace:** The `gallery-masonry` block has no `data-image-index`, so users cannot replace images via the editor overlay at all. Is this intentional? The block is marked `aiVisible: false` and "hidden" in meta, but still appears in `BLOCK_TYPES` (`types.ts:65`). Should it be wired up?

2. **Filmstrip main-panel vs thumbnail:** The filmstrip variant at L543 has `data-image-index={activeIndex}` on the main `<Image>` (only the currently-visible slide), and at L591 has `data-image-index={i}` on thumbnails. When user clicks the main panel, the `imageIndex` sent is `activeIndex`, which may not match the loop index expected by the fallback. This is a separate edge-case worth verifying.

3. **Case 2 "Failed to replace image" toast:** This report confirms Case 1 (silent fail). Case 2 could be a network error in `uploadMediaAction` or a thrown exception in any strategy. Separate investigation needed if both cases are reported.

---

**Status:** DONE
**Summary:** All 6 gallery variants (Grid, Masonry, Carousel, Lightbox, Filmstrip, Justified) are affected — Strategy 6 stores a bare integer where the gallery component expects `{id,url}`, causing all variants to silently revert to fallback URLs. No other block type is affected (carousel/portfolio-grid/team/testimonials/social-proof/logo-cloud use Strategy 7 correctly; hero uses HeroMediaOverlay, bypassing the cascade).
**Report:** `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/plans/reports/debugger-260625-1435-GH-1381-scope-analysis.md`
