# GH-1381 — Gallery "Change Image" Root Cause Analysis

**Block:** Gallery #6, variant: Carousel  
**Date:** 2026-06-25  
**Investigator:** debugger agent

---

## Executive Summary

Two distinct failure modes exist. **Case 1** (silent data loss) is caused by a structural mismatch: Strategy 6 stores `newMediaId` (a bare integer) into `images[idx].image`, but the iframe preview gets the populated object `{ id, url, alt }` from the postMessage — so preview looks updated, toast fires, but after `onImageReplaced → handleSave`, `normalizeBlocksForPersistence` iterates the `images` array and processes its nested `image` field. The problem is that `normalizeUploadField` IS called for nested upload fields, but ONLY for fields whose key is in `UPLOAD_FIELDS`. In the gallery's structure, the nested `image` key IS in `UPLOAD_FIELDS`, so a bare integer ID should be fine. However, the Gallery has a **per-slot fallback rendering layer** (`getGalleryImages` in `gallery/index.tsx:160-172`) that means even if DB saved correctly, on reload the component re-hydrates from `rawImages` and uses its fallback if `rawImages[i].image?.url` is falsy — the bare ID stored in DB (not populated) will be `{ id: N }` on read, which lacks `.url`, so the image appears unchanged.

**Case 2** (red toast) happens when `uploadMediaAction` throws — most likely the Payload media creation fails due to file validation, auth, or the save endpoint rate limit on `/api/sites/[siteId]/save` (though that's the save step, not upload).

---

## Case 1: Silent Data Loss — Root Cause

### Primary Cause: Strategy 6 stores bare `newMediaId` (number) — blocks iframe preview from seeing the new image URL and crucially does NOT store `url` in the Zustand state

**Flow:**
1. User clicks image in Carousel variant → `PreviewScripts.tsx:596` computes `totalImagesInBlock = blockContainer.querySelectorAll('[data-image-index]').length`
2. For Carousel: `GalleryImageCard` renders with `data-image-index={slideIdx * CAROUSEL_ITEMS_PER_SLIDE + itemIdx}` (`gallery/index.tsx:286`). But the Carousel renders ALL slides in the DOM simultaneously (they're just offset via `motion.div translate`). So `totalImagesInBlock` counts images across ALL slides — correct absolute indices.
3. `IMAGE_EDITING_STARTED` message received → `PreviewFrame.tsx:651` → sets `imageClickData`
4. User picks file → `handleImageReplace` fires (`PreviewFrame.tsx:790`)
5. `uploadMediaAction` succeeds → `newMediaId = uploadedMedia.id` (integer), `newUrl = uploadedMedia.url`
6. `gallery` not in `ARRAY_BLOCK_TYPES` (`PreviewFrame.tsx:809`) → `hasArrayIndex = false`
7. Strategy 1: `findStringFieldPath` tries to match `src` (URL string) in block data. Gallery images rendered from FALLBACK URLs (Unsplash/S3) — these fallback URLs are never stored in `blocks[blockIndex].images`. The block's raw `images` array in Zustand likely has `null` entries for stock images. **Strategy 1 finds no match.**
8. Strategies 2–5 run. Strategy 2 looks for named upload fields at block root — gallery block has no root-level `image` field. Strategy 4 deep-searches for objects with `.url` matching `src` — but the image URL is a fallback/Unsplash URL never in block state. **All miss.**
9. Strategy 6 fires (`PreviewFrame.tsx:939`): correct path for gallery. Sets `currentImages[idx] = { ...currentImages[idx], image: newMediaId }` (bare integer).
10. `updateBlock(blockIndex, { images: currentImages })` — Zustand updated with bare integer ID.
11. **postMessage `UPDATE_BLOCK_DATA`** sent to iframe (`PreviewFrame.tsx:1004-1008`). The iframe receives `{ images: [{ image: 456, caption: '' }, ...] }`. The Gallery component renders: `item.image?.url` is undefined on a bare integer → **falls back to Unsplash URL**. Preview visually STILL shows old image.
12. `toast.success(...)` fires at `PreviewFrame.tsx:1010`. **Toast fires here unconditionally after `updateBlock`, regardless of whether persist will succeed or iframe preview updated correctly.**
13. `onImageReplaced()` → `handleSave({ showToast: false, refreshPreview: false })`
14. `handleSave` → `getDisplayBlocks()` → `normalizeBlocksForPersistence`
15. In `block-normalization.ts:138-153`: iterates `images` array, calls `normalizeUploadField` on each item's `image` field. `normalizeUploadField(456)` → returns `456`. **Save sends bare integer ID to Payload — technically correct for persistence.**
16. Payload saves `images[idx].image = 456` as a media relation.
17. **On reload:** Payload returns `{ images: [{ image: { id: 456, url: "https://..." }, caption: "" }] }`. Gallery component: `item.image?.url` = populated URL → renders correctly.

**BUT** — the bug manifests differently: the preview never updates (step 11), user sees no change in the editor preview. User may think save failed. If user reloads, they DO see the new image — it was persisted correctly. So the "silent" part is the **iframe preview not refreshing** after image replace.

### Secondary Cause (Preview Not Updating): `UPDATE_BLOCK_DATA` with bare integer, no URL for rendering

At `PreviewFrame.tsx:1003-1008`, the updated block data (with `image: 456`, bare integer) is pushed to iframe. The `GalleryBlock` receives `images[idx].image = 456` (a number), which does NOT have `.url` property → `item.image?.url` evaluates to `undefined` → component falls through to fallback image. The preview shows the fallback/Unsplash image, not the newly uploaded one. **User sees success toast but preview looks unchanged.**

After full reload (which `refreshPreview: false` prevents), Payload returns the media populated, and the image appears. This matches the exact symptom: "success toast shows → reload → image persisted correctly."

### Wait — the isSaving mutex also matters

If a concurrent save is in-flight when `onImageReplaced` fires (`page.tsx:417-428`), `isSavingRef.current = true` causes the save to be queued in `pendingSaveRef`. The queued save DOES fire after the current save completes (line 530-535), so persistence is NOT lost by the mutex. However, if another rapid action triggers a save that reads `getDisplayBlocks()` BEFORE `updateBlock` propagates to the Zustand snapshot used by `getDisplayBlocks`, then the gallery slot could be saved with the OLD value.

This is unlikely but worth noting: `updateBlock` is synchronous in Zustand (`PreviewFrame.tsx:1001` comment confirms this), so `getState()` reads the latest value immediately.

---

## Case 2: "Failed to replace image" Red Toast — Root Cause

The try/catch in `handleImageReplace` (`PreviewFrame.tsx:1013-1016`) catches any error and shows the red toast.

**Possible throw sites:**

1. **`uploadMediaAction` throws (`PreviewFrame.tsx:799`)** — most likely cause:
   - Payload `payload.create({ collection: 'media' ... })` fails
   - Sharp image processing rejects invalid format → `media.ts:40-42` throws `"Invalid image file..."`
   - Auth failure: `getCurrentUser()` returns null → throws `"Unauthorized"`
   - Payload server error (DB connection, Neon cold start, timeout)
   - **The thrown error is caught at `PreviewFrame.tsx:1013-1015`** — error is logged but NOT shown in the toast (toast only shows generic "Failed to replace image"). This hides the actual cause.

2. **`updateBlock` / state mutation throws** — unlikely since it's pure Zustand state.

3. **`JSON.stringify` / `JSON.parse` clone at Strategy 4 throws** — only if block data has circular refs (practically impossible).

**No error detail is surfaced to the user** — `toast.error(t.editor.preview.imageReplaceFailed)` shows fixed string with no diagnostic.

---

## Evidence: File:Line References

| Observation | File:Line |
|---|---|
| Strategy 6 sets `image: newMediaId` (bare int) | `PreviewFrame.tsx:953` |
| postMessage sends block with bare int to iframe | `PreviewFrame.tsx:1003-1008` |
| Toast fires unconditionally before `onImageReplaced` | `PreviewFrame.tsx:1010` |
| `onImageReplaced` calls `handleSave(refreshPreview:false)` | `page.tsx:2312-2318` |
| Gallery renders fallback when `item.image?.url` falsy | `gallery/index.tsx:163-172` |
| `normalizeUploadField` on nested `images[]` items | `block-normalization.ts:138-153` |
| `normalizeUploadField(number) → number` (correct) | `block-normalization.ts:55` |
| Error toast catches any throw, no detail shown | `PreviewFrame.tsx:1013-1016` |
| `totalImagesInBlock` from DOM querySelectorAll | `PreviewScripts.tsx:596` |
| Carousel absolute image index formula | `gallery/index.tsx:286` |
| Strategy 7 (correct for other blocks — stores `{id,url,alt}`) | `PreviewFrame.tsx:989` |

---

## Affected Files

- `src/components/editor/PreviewFrame.tsx` (Strategy 6, toast, postMessage)
- `src/blocks/gallery/index.tsx` (fallback rendering, no URL → no display)
- `src/lib/block-normalization.ts` (normalizeUploadField on nested arrays)
- `src/app/(editor)/editor/[siteId]/page.tsx` (onImageReplaced, handleSave)
- `src/app/(dashboard)/actions/media.ts` (uploadMediaAction, error paths)
- `src/components/editor/PreviewScripts.tsx` (totalImagesInBlock count, imageIndex)

---

## Root Cause Summary

**Case 1 (silent data loss appearance):**
- Strategy 6 stores `image: newMediaId` (bare integer) in Zustand → correct for DB persistence
- But `UPDATE_BLOCK_DATA` postMessage also sends bare integer to iframe
- `GalleryBlock` checks `item.image?.url` — integer has no `.url` → uses fallback Unsplash image
- Result: preview shows unchanged image; toast fires success at `PreviewFrame.tsx:1010` (before or independent of iframe visual update); user thinks save failed but data IS persisted
- Fix: Strategy 6 should store `{ id: newMediaId, url: newUrl, alt: '' }` (like Strategy 7 does for other blocks), so iframe preview shows new image immediately. `normalizeUploadField` will extract `.id` before persistence.

**Case 2 (red toast):**
- `uploadMediaAction` throws (most common: Sharp rejects file, Payload down, auth expired)
- Caught at `PreviewFrame.tsx:1013` → generic error toast, no detail
- Secondary possibility: save endpoint 429 rate-limit would NOT hit here (happens in `handleSave` called AFTER toast fires), so rate limit does not explain Case 2 directly

---

## Open Questions

1. Does the user in GH-1381 actually see the image after page reload (confirming persistence worked), or does it truly not persist? This would confirm Case 1 is "preview-only bug" vs actual data loss.
2. For Case 2: are there Vercel function logs showing the actual exception thrown by `uploadMediaAction`? The error is logged at `media.ts:43` (`console.error('[uploadMediaAction] Failed to create media:', msg)`) — check Vercel logs.
3. Is the `isSaving` mutex ever blocking the save triggered by `onImageReplaced`? If a concurrent auto-save is in-flight at that moment, the save is queued but does fire — but the queued save uses `getDisplayBlocks()` at time of execution, which should be post-`updateBlock`. Low risk, but worth confirming.
4. `totalImagesInBlock` from Carousel: in the Carousel variant, images not visible in the current slide are still in the DOM (CSS `translate` not `display:none`). Does this cause `totalImagesInBlock` to double-count (e.g. 6 images rendered as 2 slides of 3 each — count is 6, correct). Index math at `gallery/index.tsx:286`: `slideIdx * 3 + itemIdx` — appears correct for absolute slot targeting.
