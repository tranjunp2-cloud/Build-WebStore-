# GH-1269 — AI Gen Web: Page Auto-Reload After Layout Shown

**Date:** 2026-06-22  
**Branch:** investigate/1190-gen-web-slow  
**Investigator:** debugger

---

## Root Cause

**Double `done` SSE event** introduced by commit `45efd2ae` (GH-1190 real SSE streaming fix).

`openai-generator.ts` now emits its own `done` event via `onEvent` forwarding (line 665-672), which gets sent to the client immediately when AI generation finishes. Then `route.ts` sends a second `done` event after image pipeline + DB writes complete (line 1334).

The frontend `handleSSEEvent` processes **both** `done` events identically, causing two distinct state transitions 5–60 seconds apart.

---

## Evidence Chain

### 1. The double `done` origin

**`src/lib/ai/openai-generator.ts`, lines 95–104:**
```js
// GH-1190 F3: override push so every event is forwarded to onEvent in real-time.
if (onEvent) {
    const _push = events.push.bind(events)
    events.push = (...items: SSEEvent[]) => {
        const n = _push(...items)
        items.forEach(e => onEvent(e))   // ← forwards EVERY event including 'done'
        return n
    }
}
```

**`src/lib/ai/openai-generator.ts`, lines 665–672:**
```js
events.push({
    event: 'done',
    data: {
        totalBlocks: validBlocks.length,
        timeMs: 0,         // ← no siteId, no siteName, timeMs=0
        warnings: report.warnings,
    },
})
```
This event is pushed at the end of AI generation — BEFORE image pipeline and DB writes. It is immediately forwarded to the client via `onEvent`.

**`src/app/api/ai/generate-site/route.ts`, lines 1334–1344:**
```js
const doneData =
    `event: done\ndata: ${JSON.stringify({
        siteId: _pipeSite.id,       // ← real siteId
        pageId: (homepagePage as { id: unknown }).id,
        siteName: result.siteName,  // ← real siteName
        siteLanguage: result.language || language,
        totalBlocks: result.blocks.length,
        totalPages: createdPages.length,
        timeMs,                     // ← real elapsed time
    })}\n\n`
controller.enqueue(_encoder.encode(doneData))
```
This second `done` is sent only AFTER image pipeline + DB writes complete (5–60s after first `done`).

### 2. Frontend processes both identically

**`src/app/(builder)/builder/new/AIBuilderPageClient.tsx`, lines 426–449:**
```js
case 'done':
    setStatus('done')                          // fires on BOTH done events
    setGenerationTimeMs(data.timeMs || 0)     // 0 on first event
    setSiteId(data.siteId)                     // undefined on first event!
    setSiteName(data.siteName)                 // undefined on first event!
    hasUserEditsRef.current = false
    void trackBuilderEvent(data.siteId, 'builder_generation_completed', ...)  // undefined siteId
    addMessage({ role: 'assistant', content: `✅ ...` })    // fires TWICE total
    break
```

### 3. Timeline of events

| t (approx.) | Backend | Client |
|---|---|---|
| 0 | AI call starts | Streaming begins |
| +5–20s | AI streams blocks | `block_complete` events → blocks rendered, `shouldShowPreviewScreen=true` → **Layout shown** |
| +20–40s | `generateSiteWithAI` finishes → pushes `done` (no siteId) | **First `done`**: `setStatus('done')`, `setSiteId(undefined)`, `setSiteName(undefined)`, `addMessage(...)` → completion view re-renders with undefined data |
| +20–80s | Image pipeline (5–30s) + DB writes (10–40s) | Waiting. `siteId=undefined`, editor button disabled |
| +40–120s | Route.ts sends second `done` (with real siteId) | **Second `done`**: `setSiteId(realId)`, `setSiteName(realName)`, another `addMessage(...)` → second re-render |

The "5–8s after layout shown → reload" corresponds to the gap between first block arriving and the first `done` event firing (AI finishes generating). This gap is ~5–30s depending on AI response time.

### 4. What the user sees (the "reload")

The completion view (`BuilderCompletionView`) renders when `status === 'done'` (after first `done`). At this point:
- `siteId = undefined` — "Open Editor" and "Publish" buttons are non-functional
- `siteName = undefined` — falls back to `businessInfo.businessName`
- Auto-save effect runs: `if (!siteId || status !== 'done' ...) return` → marks 'saved' without actual API call

5–60s later, second `done` arrives:
- `setSiteId(realId)` + `setSiteName(realName)` → React re-renders `BuilderCompletionView` with real data
- `addMessage(...)` fires again → duplicate completion message appears
- `trackBuilderEvent(realId, ...)` fires (double-tracked)

The "page reload" perception: the large React re-render triggered by the second `done` (siteName changing from undefined→real value, siteId changing, new message added) causes a noticeable visual jump/flicker of the completion view. On slower devices or connections, the gap between first `done` (broken state) and second `done` (real state) can be 5–60 seconds.

---

## Competing Hypotheses — Ruled Out

| Hypothesis | Status | Evidence |
|---|---|---|
| Frontend polls status and triggers `router.refresh()` | **Eliminated** | No `router.refresh()` in builder flow. No polling. Only SSE. |
| Backend emits `success` early → frontend re-renders on second signal | **Confirmed (variant)** | Two `done` events, not `success` event. Frontend processes both as identical `done`. |
| SSE retry (`sseRetryCountRef`) fires and resets state | **Eliminated** | Retry only fires in `catch` block (network error). Normal stream close → no retry. |
| `router.push` or `window.location.reload()` called | **Eliminated** | Not present in builder page flow. Only in editor page for template apply error. |
| Double-submit from BusinessInfoForm | **Eliminated** | `isGenerating` guard prevents this. |
| Next.js revalidation of `/builder/new` | **Eliminated** | No `revalidatePath('/builder')`. No `router.refresh()` in flow. |

---

## Proposed Minimal Fix

**File:** `src/lib/ai/openai-generator.ts`

The `done` event in `openai-generator.ts` should NOT be forwarded to the client via `onEvent`. It's an internal generator signal used to bundle the result back to the caller (`route.ts`). The `route.ts` already sends the authoritative `done` event with all required data.

### Option A — Filter `done` from forwarded events (minimal, safest)

```diff
// src/lib/ai/openai-generator.ts, lines 98-104

if (onEvent) {
    const _push = events.push.bind(events)
    events.push = (...items: SSEEvent[]) => {
        const n = _push(...items)
-       items.forEach(e => onEvent(e))
+       // Do not forward the internal 'done' event — route.ts sends the authoritative
+       // done after image pipeline + DB writes with correct siteId, pageId, siteName.
+       items.forEach(e => { if (e.event !== 'done') onEvent(e) })
        return n
    }
}
```

This ensures:
- All `step`, `theme_set`, `block_complete` events stream in real-time (GH-1190 benefit preserved)
- The internal generator `done` is NOT sent to the client
- Route.ts's `done` (with `siteId`, `pageId`, `siteName`, real `timeMs`) remains the only `done` the client sees

### Option B — Rename internal done event

Rename the internal `done` to `generation_complete` inside `openai-generator.ts` (lines 666, 761, 784). Then `handleSSEEvent` only handles the external `done` from `route.ts`. Requires touching the fallback path too.

**Recommendation: Option A** — one-line diff, zero risk to the SSE pipeline architecture.

---

## Risk / Side Effects

**Fix risk:** Very low.
- Only change is filtering `event.event !== 'done'` before forwarding to client
- All other events (step, theme_set, block_complete, products_generated) still stream in real-time
- The fallback path in `generateSiteWithAI` also pushes `done` events (lines 761, 784) — these are also blocked from reaching the client, which is correct since route.ts sends the authoritative done

**Secondary effects of the double-done bug (also fixed by Option A):**
1. `addMessage(...)` fires twice — duplicate completion message in messages panel
2. `trackBuilderEvent(undefined, ...)` fires with undefined siteId — corrupts analytics
3. `setSiteId(undefined)` → editor/publish buttons non-functional until second done arrives
4. Auto-save marks as 'saved' without API call on first done (correct behavior skipped)

---

## Unresolved Questions

1. **Fallback `done` events**: `generateSiteWithAI`'s fallback path also emits `done` (lines 761, 784 in openai-generator.ts). Option A filters these too. Need to confirm the fallback path's `done` data has same shape as AI path (no `siteId`) — likely yes, but should verify.

2. **`sseRetryCountRef` not reset after successful generation**: After SSE completes successfully, `sseRetryCountRef` is not reset to 0. If user generates again without a page refresh, retries could exhaust faster. Minor bug, separate issue.

3. **Exact timing of "5–8s"**: The issue title says "5–8s after layout shown." This matches the time between first block arriving and AI generation finishing (when first done fires). The exact timing depends on AI response speed and block count. Could be 5–40s in practice.
