# Deep-dive Investigation — GH-1190: Gen Web >100s

**Date:** 2026-06-17
**Branch:** investigate/1190-gen-web-slow

---

## 1. SSE Buffering Pattern (`route.ts:1246-1291`)

**Confirmed:** SSE `ReadableStream` opens ONLY after the full pipeline completes.

```typescript
// route.ts:410 — entire pipeline blocks here
const { result, events } = await trackPhase('ai', () =>
    withSentrySpan('ai.generateSite', () => generateSiteWithAI(...)),
)
// ... image pool, DB writes, page creation loop ...

// route.ts:1246 — THEN SSE stream opens
if (isStreaming) {
    const stream = new ReadableStream({
        start(controller) {
            const emitEvents = async () => {
                for (const event of events) {       // replay buffered events
                    controller.enqueue(encoder.encode(...))
                    await new Promise(r => setTimeout(r, 100))  // 100ms artificial delay
                }
            }
            emitEvents().catch(() => controller.close())
        },
    })
    return new Response(stream, { ... })
}
```

**Can be refactored to real streaming?** Yes. No Vercel Edge constraint (route.ts không có `export const runtime = 'edge'`). No body-size issue. Fix pattern:
1. Open `ReadableStream` + grab `controller` BEFORE pipeline
2. Thread `enqueue` function into `generateSiteWithAI`
3. Generator calls `enqueue(event)` directly instead of `events.push(event)`

**Complexity:** Medium — requires changing `generateSiteWithAI` signature to accept a callback/emitter, and updating all inner event pushes (~20 call sites inside openai-generator.ts).

---

## 2. `translateToEnglishKeywords` (`dynamic-translator.ts` + `route.ts:511`)

**Input:** `{ industry, products }` — both known at route entry from `businessInfo`.

**Does NOT depend on `generateSiteWithAI` output.** Confirmed — function only needs industry + product string for Unsplash keyword translation. Returns `string[] | null`.

```typescript
// route.ts:510-520 — CURRENTLY sequential, after generateSiteWithAI completes
const aiTranslation = await translateToEnglishKeywords({
    industry: businessInfo.industry,
    products: businessInfo.products
})
```

**Model used:** `gpt-4o-mini`, max_tokens=30, 8s timeout — fast call.

**Problem:** `dynamic-translator.ts:29` creates a new `OpenAI` client on every call (trivial waste, ~5ms).

**Fix:** Start parallel with `generateSiteWithAI`:
```typescript
const [{ result, events }, aiTranslation] = await Promise.all([
    trackPhase('ai', () => generateSiteWithAI(...)),
    translateToEnglishKeywords({ industry: businessInfo.industry, products: businessInfo.products })
        .catch(() => null),
])
```
**Savings: 2-8s, zero risk** — function already has graceful null fallback to dictionary.

**NOT tracked in phaseTimings** — sits in `other` bucket. Real contribution invisible to logs.

---

## 3. Page Creation Loop (`route.ts:820-947`)

**Confirmed sequential:** `for...of` with `await withPayloadRetry(payload.create(...))` inside.

```typescript
// route.ts:820
for (const pageDefinition of pageDefinitions) {
    // ...sanitize layout...
    createdPage = await withPayloadRetry(() => payload.create({ collection: 'pages', ... }))
    // ...error handling...
}
```

**FK dependency analysis:**
- Homepage: MUST be first — failure is fatal (rethrow at line 942)
- Sub-pages: reference the same `site.id` but NOT each other → **no inter-dependency**
- Nav/footer blocks reference all pages, but these are already computed in `normalizedPageLinks` before the loop

**Can parallelize sub-pages:** Safe to `Promise.all` all non-homepage pages after homepage succeeds:
```typescript
// Create homepage first
const homepage = await withPayloadRetry(() => payload.create({ ... homepage ... }))
// Sub-pages in parallel
const subPageResults = await Promise.allSettled(
    subPageDefinitions.map(p => withPayloadRetry(() => payload.create({ ... p ... })))
)
```

**Savings:** 3-5 pages × ~2-5s each → sequential ~6-20s, parallel → max(~2-5s). **Saves ~4-15s, low risk.**

---

## 4. Template-First Path Timing

**Composer + GPT run in PARALLEL** (line 2075 — already optimized):
```typescript
const [composerSettled, personalizeSettled] = await Promise.allSettled([
    composeTemplateResult(...)    // ~0.5s synchronous
    personalizeWithGPT(...)       // ~3-8s, 10s timeout, 300 max_tokens
])
```

**`personalizeWithGPT`:** 10s AbortController timeout, `gpt-4.1-nano`/small model, returns hero headline + subheadline + SEO title + description.

**Template-first wall time (before route.ts DB phase):**
- `loadDisabledVariants()` ~5ms DB
- `Promise.allSettled([composer, GPT])` ~3-10s (GPT is bottleneck)
- Structure enforcement ~0ms synchronous
- Back in route.ts: `translateToEnglishKeywords` ~2-8s (sequential, see §2)
- `buildImagePool` + `fulfillImageNeeds` ~8-18s
- Pages loop sequential ~6-20s
- **Total: ~19-56s** — much better than AI-first (60-100s for single GPT call)

**Same fake-SSE issue:** template-first also collects events in `events[]` array (openai-generator.ts:2166-2174) which are replayed AFTER route.ts finishes DB writes. User still sees progress bar stuck at "Analyzing" for the full ~19-56s.

---

## 5. Existing Timing Logs

**Format** (`route.ts:1242`):
```
[generate-site] DONE total=Xms ai=Yms media=Zms db=Wms other=Vms pages=N failures=N gen_mode=template-first unsplash_rl=false images_failed=0 products_no_image=0
```

**Fields:**
| Key | Measured by | Covers |
|-----|-------------|--------|
| `ai` | `trackPhase('ai', ...)` | `generateSiteWithAI` wall time |
| `media` | `trackPhase('media', ...)` | `fulfillImageNeeds` (S3 uploads + Unsplash) |
| `db` | manual `Date.now()` diff line 1080 | page creation loop |
| `other` | computed: total − ai − media − db | pre-flight DB queries + site row create + translateToEnglishKeywords + buildImagePool |

**`translateToEnglishKeywords` (2-8s) is hidden in `other`** — not broken out. To observe it specifically, add a dedicated `trackPhase('translate', ...)` wrapper.

**Extracting from Vercel logs:** Filter by `[generate-site] DONE` — one line per generation. All `console.info` — appears in Vercel function log stream. Key=value format is greppable:
```bash
grep '\[generate-site\] DONE' vercel-logs.txt | awk '{for(i=1;i<=NF;i++) if($i~/^ai=/) print $i}'
```

---

## Summary: Fix Feasibility Matrix

| Fix | File:line | Actual Savings | Perceived UX Improvement | Complexity | Risk |
|-----|-----------|---------------|--------------------------|------------|------|
| **F1: Parallel translateToEnglishKeywords** | `route.ts:511` | 2-8s | None (fake SSE still hides it) | Trivial | Zero |
| **F2: Parallel sub-page DB creates** | `route.ts:820` | 4-15s | None (fake SSE still hides it) | Low | Low |
| **F3: Open SSE stream before pipeline** | `route.ts:410`, `openai-generator.ts` | 0ms actual | **Critical** — progress bar moves in real-time | Medium | Medium |
| **F4: OpenAI stream:true in main AI call** | `openai-generator.ts:248` | 50-90s perceived | High (needs F3 first) | Very high | High |
| **F5: Reuse OpenAI client in translator** | `dynamic-translator.ts:29` | ~5ms | None | Trivial | Zero |

**Key insight:** F1 + F2 reduce actual latency by ~6-23s but the user experience will NOT improve until F3 is done — progress bar is still frozen until server finishes because of fake SSE buffering.

**Recommended order:**
1. **F3 first** — unblocks all perceived improvement. Even without F4, user sees live steps (template composing → personalizing → saving).
2. **F1** — trivial, ship with F3.
3. **F2** — parallel sub-pages, low risk.
4. **F4** — separate ticket; requires streaming JSON parser and is high complexity.

---

## Unresolved Questions

1. Does Vercel function log retention cover enough traffic to confirm `ai=` split between template-first vs AI-first paths? (Need to filter by `gen_mode=`)
2. `withPayloadRetry` — what's the retry delay? If it retries on transient errors, sequential pages could spike. Should verify.
3. Is `GEN_MODE` env var set on staging? Log line shows `gen_mode=${process.env.GEN_MODE?.trim() || 'template-first'}` — if unset, always shows `template-first` even if AI-first ran.
