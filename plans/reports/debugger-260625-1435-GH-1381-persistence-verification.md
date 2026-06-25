# GH-1381 Persistence Verification — Gallery "Change Image" Contradiction

**Date:** 2026-06-25
**Scope:** READ-ONLY static analysis, no runtime execution
**Question:** Does Strategy 6 (gallery `handleImageReplace`) cause data loss, a preview-only bug, or broken UX due to reload/populate failure?

---

## Evidence Chain

### Step 1 — What Strategy 6 writes to Zustand (`PreviewFrame.tsx:953`)

```ts
currentImages[idx] = { ...currentImages[idx], image: newMediaId }
updateBlock(blockIndex, { images: currentImages })
```

`newMediaId` is the **integer** Payload media ID (e.g. `456`). The slot object becomes:
```js
{ image: 456, caption: "..." }
```

The comment at line 937-938 explicitly acknowledges this: *"Must use newMediaId (numeric Payload media ID) — normalizeUploadField strips objects without .id to null before persistence."*

Contrast with Strategy 7 (all other array blocks, line 989):
```ts
currentArray[idx] = { ...existingItem, [arrayConfig.imageSubField]: { id: newMediaId, url: newUrl, alt: existingAlt } }
```
Strategy 7 stores a **populated object** `{ id, url, alt }` so the preview renders immediately. Gallery (Strategy 6) stores only the bare integer.

### Step 2 — Save path: does bare integer `456` survive to DB?

`save/route.ts:128`:
```ts
const normalizedBlocks = blocks ? normalizeBlocksForPersistence(blocks as Record<string, unknown>[]) : undefined
```

`block-normalization.ts` line 138-153 — the nested-array normalization loop:
```ts
for (const [key, val] of Object.entries(b)) {
    if (Array.isArray(val)) {
        b[key] = (val as unknown[]).map((item: unknown) => {
            if (item && typeof item === 'object') {
                const obj = { ...item as Record<string, unknown> }
                for (const field of UPLOAD_FIELDS) {
                    if (field in obj) {
                        obj[field] = normalizeUploadField(obj[field])
                    }
                }
                return obj
            }
            return item
        })
    }
}
```

`normalizeUploadField` (line 52-66) on an integer:
```ts
if (typeof value === 'number') return value  // line 55 — keeps it as-is
```

**Verdict Step 2:** A bare integer `456` in `images[idx].image` PASSES through `normalizeUploadField` unchanged and reaches `payload.update({ data: { layout: normalizedBlocks } })`. The DB write stores `image_id = 456` in `pages_blocks_gallery_images`. **No data loss at the persistence layer.**

Additionally, `stripOrphanMediaRefs` (`save/route.ts:243`) validates the media ID — if `456` is a valid, fully-uploaded media row (filename + mimeType + filesize all non-null), the ID is kept; only genuinely orphaned half-written rows are stripped.

### Step 3 — Reload path: is `images[].image` populated on editor reload?

`editor-data/route.ts` fetches pages at lines 90-94 and 108-127:
```ts
requestedPage = await payload.findByID({
    collection: 'pages',
    id: pageId,
    draft: true,
    // NO depth parameter
})
// ...
pagesResult = await payload.find({
    collection: 'pages',
    where: { site: { equals: numericSiteId }, isHomepage: { equals: true } },
    limit: 1,
    draft: true,
    // NO depth parameter
})
```

**No explicit `depth` is passed. Payload CMS default depth = 2.** For a `pages` document with `layout` (blocks) containing `images[].image` (type: `upload`, relationTo: `media`):
- `depth: 0` → `image_id` returned as bare integer
- `depth: 1` → `image` populated as `{ id, url, filename, mimeType, ... }`
- `depth: 2` (default) → same as depth:1 for this relation depth

Since `depth: 2` is applied by default, Payload DOES populate `images[].image` as a full media object `{ id: 456, url: "https://...", ... }` on reload.

### Step 4 — Render logic: does a populated object on reload show the new image?

`gallery/index.tsx` line 162-172:
```ts
const images = Array.from({ length: slotCount }, (_, i) => {
    const item = rawImages[i] as Record<string, unknown> | undefined
    const img = item?.image
    if (img && typeof img === 'object' && (img as Record<string, unknown>)?.url) {
        return item as GalleryConfig['images'][number]  // ← uses real image
    }
    return {
        image: { url: fallbackUrls[i % fallbackUrls.length]!, ... },  // ← fallback
        caption: (item?.caption as string) || '',
    }
})
```

The gate is: `img && typeof img === 'object' && img?.url`.

After reload with Payload depth:2 populated data: `item.image = { id: 456, url: "https://s3.../photo.jpg", ... }` → the condition is TRUE → new image renders. ✓

**BUT during the in-memory editor session BEFORE save/reload:** Strategy 6 writes `image: 456` (a number, not object). The gate `typeof img === 'object'` is FALSE → the component falls through to the fallback URL → **old/stock image renders in the iframe preview**.

The iframe postMessage at `PreviewFrame.tsx:1005-1009` pushes this corrupted-looking state to the iframe immediately after Strategy 6 sets the bare integer, so the preview will show the OLD image the moment the replacement is applied.

### Step 5 — The contradiction resolution

| Claim | Verdict | Evidence |
|-------|---------|----------|
| "DB save SUCCEEDS with bare integer 456" | **TRUE** | `normalizeUploadField` line 55: integer passes through. `payload.update` receives valid `image_id`. |
| "On reload Payload returns populated `{ id: 456, url: "..." }`" | **TRUE** | `editor-data` uses default depth:2; Payload populates upload relations. |
| "New image renders correctly after reload" | **TRUE** — *only IF the save completed before reload* | `gallery/index.tsx:165` gate passes when `img.url` exists (populated object). |
| QC report: "reload still shows old image" | **PARTIALLY TRUE but misattributed** | The preview shows the old image **during the current session** (before save) because Strategy 6 stores a bare integer (`typeof 456 === 'number'`, not object) and the render gate at line 165 fails. If the user saves first and THEN reloads, the new image DOES appear. |

---

## Root Cause

**Strategy 6 is a session-preview bug, NOT a data persistence bug.**

The defect path:
1. User clicks "Change Image" on a gallery slot → Strategy 6 fires → `currentImages[idx].image = 456` (bare int)
2. `updateBlock()` → Zustand state updated → iframe postMessage pushes `image: 456` to preview
3. `gallery/index.tsx:165` — `typeof 456 === 'number'`, not object → gate FAILS → fallback/stock image renders
4. User sees old/stock image in preview → success toast appears → user thinks it failed → **may not save**
5. If user saves: bare int `456` persists correctly to DB; on reload, depth:2 populates it; new image renders. Session UX is broken but data is fine.
6. If user DOESN'T save (because preview showed wrong image making them think it failed), then reloads: old image persists correctly (no change was persisted). This looks like "reload shows old image" — but the root cause is the user never saved.

**QC's observation "after success toast, reload shows old image" requires a save to have been triggered.** The save toast fires when `handleSave` completes. If autosave ran between the replace and the reload, the new image should appear on reload. If the user manually triggered save and reloaded, it should also show the new image. The QC scenario where old image persists after a save + reload cannot be explained by this code path alone.

**One potential exception:** if the fallback path in `cleanupNonNumericImageFields` (save/route.ts:281) is triggered (i.e., a FK error on a different block causes the fallback to wipe ALL numeric image IDs from the gallery `images` array), the new ID would be deleted from `normalizedBlocks` before the retry save. Evidence at `save/route.ts:290-299`:
```ts
for (const arrayField of ['images', 'projects', 'members', ...]) {
    for (const item of arr) {
        for (const f of ['image', 'logo', 'avatar']) {
            if (typeof item[f] === 'number') delete item[f]  // ← nukes gallery image IDs
        }
    }
}
```
This would cause genuine data loss — the numeric ID is deleted in-memory before the retry `payload.update`. This is a second, less likely scenario that WOULD match QC's description.

---

## Definitive Answer

**Neither the prior debugger report NOR the QC report is fully correct.** The correct picture is:

- **Prior report: correct on persistence** — bare integer `456` does survive to DB; Payload populates on reload; new image renders after save+reload.
- **QC report: correct on symptoms but wrong on mechanism** — the old image IS visible after the user clicks replace, but this is a **session-preview rendering failure** (not a DB persistence failure). The gallery render gate `typeof img === 'object' && img?.url` (line 165) rejects the bare integer, falling back to stock/old image. This broken preview may cause the user to navigate away without saving.
- **A secondary real data-loss path exists** via `cleanupNonNumericImageFields` FK-error fallback that would nuke the numeric gallery image IDs during a retry save — but this is conditional on an unrelated FK error occurring simultaneously.

---

## Fix Direction

**Primary fix (required):** Change Strategy 6 to store a populated object like Strategy 7:
```ts
// Instead of:
currentImages[idx] = { ...currentImages[idx], image: newMediaId }
// Use:
currentImages[idx] = { ...currentImages[idx], image: { id: newMediaId, url: newUrl, alt: '' } }
```
`normalizeUploadField` at line 61-63 handles objects with `.id` — it extracts the numeric id before persistence. This matches Strategy 7's approach and fixes the session-preview failure.

**Secondary concern (risk):** The FK-error fallback at `save/route.ts:290-299` that wipes ALL numeric gallery image IDs (including newly set ones) before the retry save is a genuine potential data-loss path. It is only triggered when a FK error occurs on save, but when it does fire it will destroy gallery image replacements. This should be hardened to preserve valid media IDs.

---

## Unresolved Questions

1. Can the QC reporter confirm whether the success toast fired before they reloaded? If the toast didn't fire (i.e., they reloaded without saving), the "old image on reload" is expected.
2. Were there any 500/409 errors in Vercel logs coincident with the QC-reported reproducing steps? A FK-triggered fallback wipe would explain complete data loss after a toast.
3. Does the storefront (non-editor) rendering path have the same `typeof img === 'object' && img?.url` gate, or does it handle bare integers differently? (Not investigated in this analysis.)
