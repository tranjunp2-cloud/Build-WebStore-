# GH-1269: Reload After Save — Root Cause Report

**Date:** 2026-06-22
**Branch:** investigate/1190-gen-web-slow

---

## Executive Summary

The post-generation "page reload showing final website" is **NOT a `router.refresh()` call from a save/tracking API response.** It is caused by `BuilderPreviewSurface` switching from `LivePreview` (React children) to an **`<iframe>`** when `siteId` becomes available — which always happens at the same moment the `done` SSE event fires and sets `siteId`. The iframe load looks like a "reload" in the network tab but is actually the first render of the iframe.

**Secondary candidate** (lower confidence): `revalidateTag` inside `/api/sites/[siteId]/publish/route.ts` — but this is only called on explicit publish, not on save-draft, so it cannot explain the behavior after generation completes.

---

## Evidence Chain

### 1. Auto-save does NOT call `router.refresh()`

`AIBuilderPageClient.tsx:289-325` — the auto-save `useEffect` runs `fetch('/api/sites/${siteId}/save', PATCH)` and then only calls `setDraftSaveState('saved')` + `setLastSavedAt(Date.now())`. No `router.refresh()`, no navigation, no revalidation.

The BUG-F01-26 fix (`hasUserEditsRef.current`) means after generation the auto-save effect at line 291 returns early:
```ts
if (!hasUserEditsRef.current) {
    // Pages already persisted by gen route — mark as saved without hitting API
    setDraftSaveState('saved')
    setLastSavedAt(Date.now())
    return   // ← no API call at all
}
```
So the save-draft PATCH is **not even sent** after a fresh generation unless the user makes manual edits.

### 2. Analytics track does NOT cause reload

`/api/analytics/track/route.ts:15-60` — pure DB write + `{ success: true }`. No `revalidatePath`, no `revalidateTag`. The `trackBuilderEvent` call in `handleSSEEvent` case `'done'` (line 435) is `void trackBuilderEvent(...)` — fire-and-forget, no await, response never inspected.

### 3. `revalidateTag` exists only in publish route — not triggered here

`/api/sites/[siteId]/publish/route.ts:395-396` — `revalidateTag` is called only in `PATCH /publish` and `DELETE /publish`, not in `PATCH /save`. User describes behavior "after generation completes" before any publish action.

### 4. The real cause: iframe swap in `BuilderPreviewSurface`

`src/components/builder/BuilderPreviewPrimitives.tsx:114-120`:

```tsx
// Desktop with siteId (post-generation): use iframe so SiteRenderer rewrites nav links
const desktopContent = siteId ? (
    <iframe
        src={`/preview/${siteId}?v=${Date.now()}&builder=1`}
        className="h-full w-full border-0"
        title="Website preview"
    />
) : children  // ← during streaming: renders LivePreview (React children)
```

**Timeline:**
1. SSE stream running → `siteId = null` → `BuilderPreviewSurface` renders `children` (LivePreview inline React)
2. SSE `done` event fires → `setSiteId(data.siteId)` (line 429) → `siteId` is now truthy
3. React re-renders → `BuilderPreviewSurface` condition flips → `<iframe src="/preview/{siteId}?v=...">` mounts
4. Browser loads `/preview/{siteId}` in the iframe → appears in network tab as a new page load / navigation
5. User sees "final website shown" — this is the iframe painting the server-rendered site

This transition is instantaneous with the `done` event, **not delayed by a save/tracking API call completing.**

### 5. Why user thinks it correlates with an API call completing

The `trackBuilderEvent('builder_generation_completed', ...)` fetch fires at the same moment as `setSiteId()` (both in the `'done'` case at line 429-438). If the analytics call happens to return around the same time the iframe finishes loading (~500ms-2s), the network tab shows: (1) analytics POST completes, then (2) `/preview/{siteId}` load — making them appear correlated. They are coincidental.

---

## Competing Hypotheses — Tested and Ruled Out

| Hypothesis | Evidence | Verdict |
|---|---|---|
| Auto-save PATCH → `router.refresh()` in callback | Save route returns `{success, message}` only; client only calls `setDraftSaveState` on success | **ELIMINATED** |
| Analytics track → `router.refresh()` | Track route: pure DB write; client: `void trackBuilderEvent(...)` fire-and-forget | **ELIMINATED** |
| `revalidateTag` from save route causes Next.js router refresh | Save route has zero `revalidatePath`/`revalidateTag` calls | **ELIMINATED** |
| `revalidateTag` from publish route | Only called on explicit publish action, not on gen completion | **ELIMINATED** |
| `seo-queue.ts revalidatePath` | Called only from background SEO job on pages/products collections, not from client builder flow | **ELIMINATED** |
| `BuilderPreviewSurface` iframe mount triggered by `siteId` becoming truthy | Direct code path confirmed — `siteId` set by `done` SSE event, iframe renders immediately | **CONFIRMED** |

---

## Proposed Fix

This is **expected behavior**, not a bug — the iframe is intentional (see inline comment in `BuilderPreviewPrimitives.tsx:111-113`). However, if the user experience is jarring (sudden "flash" from LivePreview to iframe), the fix is to add a transition or keep LivePreview for a few more seconds before swapping:

**Option A (minimal, no behavior change):** Add CSS fade-in to the iframe:
```tsx
<iframe
    src={`/preview/${siteId}?v=${Date.now()}&builder=1`}
    className="h-full w-full border-0 animate-fade-in"
    ...
/>
```

**Option B (deferred swap):** Delay the iframe mount by 500-1000ms after `siteId` is set using a local state in `BuilderPreviewSurface`, so LivePreview stays visible while iframe loads in background, then cross-fade.

**Option C (if the reload itself is the actual bug):** If the concern is the `/preview/{siteId}` iframe triggering a full Next.js server component fetch every re-render (because `?v=${Date.now()}` creates a new URL each render) — move `Date.now()` to a `useRef` initialized once on mount, not on every render. This prevents iframe remounts on parent re-renders.

The `?v=${Date.now()}` cache-buster at lines 71 and 116 will cause the iframe to remount (and reload the preview) **on every parent re-render** because each render produces a different `v` query param. This is the most actionable bug.

**Fix for Option C:**
```tsx
// BuilderPreviewSurface — use a stable version ref
const vRef = useRef(Date.now())
// Use vRef.current instead of Date.now() in the src
src={`/preview/${siteId}?v=${vRef.current}&builder=1`}
```
This ensures the iframe only loads once when `siteId` first becomes truthy, not on every subsequent render.

---

## Unresolved Questions

1. Is the user seeing the iframe reload on EVERY re-render (caused by `Date.now()` in src), or only on the first mount after `done`? If the former, Option C is the primary fix. Confirm by checking network tab for repeated `/preview/{siteId}` requests after generation.
2. The `BuilderMobilePreviewShell` (line 71) has the same `Date.now()` pattern — should be fixed in parallel.
