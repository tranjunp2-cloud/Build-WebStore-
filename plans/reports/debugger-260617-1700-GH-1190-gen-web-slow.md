# RCA: AI Website Generation >100s — GH-1190

**Date:** 2026-06-17  
**Branch:** investigate/1190-gen-web-slow  
**Investigator:** debugger agent

---

## Executive Summary

The "Analyzing business information" step (Step 1 UI label) maps to **progress < 20** server-side. The entire server pipeline — auth, rate-limit checks, DB queries, AI generation, image pipeline, DB writes — is executed **before** any SSE event is sent to the client. The client receives nothing until the server's `POST /api/ai/generate-site` call completes (or the first event fires for the streaming path).

**Root cause:** The generation pipeline is predominantly sequential. The main OpenAI call (`gpt-4.1-mini`, 10,000 max tokens, ~60-100s at p95) is the single largest blocking operation, and it runs AFTER ~3-6 DB round trips on the hot path. Once the AI call completes, a second sequential LLM call (`translateToEnglishKeywords` via `gpt-4o-mini`) is made before the Unsplash image pipeline. The SSE events emitted inside `generateSiteWithAI` are buffered in an array and only replayed to the client AFTER the entire pipeline (AI + images + all DB writes) finishes — making the streaming setup cosmetic for latency purposes.

---

## Call Chain Diagram

```
POST /api/ai/generate-site?stream=true
│
├── [SEQUENTIAL pre-flight — ~1-3s total]
│   ├── getCurrentUser()                 ← JWT decode (fast, ~1ms)
│   ├── getPayload({ config })           ← singleton, warm ~5ms
│   ├── checkTwoTierRateLimit()          ← Redis/DB read
│   ├── payload.find(tenants)            ← DB read (if no tenantId)
│   ├── payload.create(plan-subscriptions) ← DB write (new user only)
│   ├── getActivePlanSubscription()      ← DB read
│   ├── canUse()                         ← DB read
│   ├── payload.findByID(tenants)        ← DB read (slug sync)
│   └── checkBusinessInfoSafety()        ← pure fn, ~0ms
│
├── [PARALLEL — fire-and-forget]
│   └── generateSampleProducts()         ← spawned, not awaited yet
│
├── [OPTIONAL — AI-first path only]
│   └── payload.find(templates)          ← DB read for blockPromptOverrides
│
├── [THE MAIN BOTTLENECK] ─────────────────────────────── ~60-100s
│   └── generateSiteWithAI()             ← src/lib/ai/openai-generator.ts:80
│       │
│       ├── startCapture()               ← DB write (payload.create)
│       │
│       ├── [TEMPLATE-FIRST PATH — default for English EN input]
│       │   └── Promise.allSettled([
│       │       ├── composeTemplateResult()   ← ~0.5s (sync, library lookup)
│       │       └── personalizeWithGPT()      ← gpt-4.1-nano, 10s timeout ~3-8s
│       │   ])
│       │
│       └── [AI-FIRST PATH — non-EN or extraInstructions present]
│           └── openai.chat.completions.create()  ← gpt-4.1-mini, 10K tokens
│               SEQUENTIAL: no streaming; awaits full JSON response
│               p50 ~60s, p95 ~100s, p99 >120s
│
├── [SEQUENTIAL after AI — ~5-15s]
│   ├── translateToEnglishKeywords()     ← gpt-4o-mini, 8s timeout ← HIDDEN LLM CALL
│   ├── buildImagePool()                 ← Unsplash API search (2 calls)
│   └── fulfillImageNeeds()             ← batchFetchFromPool() → Promise.all uploads
│       └── stripOrphanMediaRefs()       ← DB verify query per bucket
│
├── [SEQUENTIAL DB writes — ~5-20s depending on page count]
│   ├── payload.find(sites)
│   ├── payload.update/create(sites)     ← site row
│   ├── for (page of pageDefinitions)    ← SEQUENTIAL loop (3-5 pages × ~2-4s each)
│   │   └── withPayloadRetry(payload.create(pages))
│   ├── payload.create(pages)            ← 404 page
│   └── payload.update(sites)            ← generationStatus = completed
│
├── [AWAIT previously-parallel]
│   └── sampleProductsPromise            ← for loop writing products sequentially
│
└── [ONLY NOW] SSE stream opened and events replayed
    └── for (event of events) { enqueue + sleep 100ms }
```

---

## Step-by-Step: What Triggers "Analyzing Business Information"

**UI mapping** (`BuilderGenerationView.tsx:51-55`):
```
progress < 20  → Step 0 "Analyzing business information"  (active spinner)
20 ≤ progress < 60  → Step 1 "Generating content & design"
progress ≥ 60  → Step 2 "Preparing preview"
```

The first SSE event with `progress: 10` (`step: 'analyzing'`) is emitted inside `generateSiteWithAI` at `openai-generator.ts:168`. But **the client never receives this event** until after the entire server pipeline completes, because:

1. `generateSiteWithAI()` collects all events into an in-memory array (`events: SSEEvent[]`)
2. The route awaits `generateSiteWithAI()` completely (`await trackPhase('ai', ...)`)
3. Then runs the full image + DB pipeline
4. **Only then** opens the SSE `ReadableStream` and replays events with 100ms delays

So the client shows "Analyzing business information" (Step 0, progress 8 set locally at `AIBuilderPageClient.tsx:406`) the entire time until the server responds. The 73s observation is consistent with a p95 AI-first path run.

---

## Sequential vs Parallel Breakdown

| Phase | Sequential? | Estimated Time | Notes |
|-------|------------|---------------|-------|
| Pre-flight DB checks | Sequential | 1-3s | 4-6 DB round trips |
| `generateSampleProducts` | Parallel (fire-and-forget) | concurrent | Does NOT block |
| `generateSiteWithAI` (template-first) | `composeTemplateResult` + `personalizeWithGPT` parallel | 3-8s | Only for English EN input |
| `generateSiteWithAI` (AI-first) | Sequential (single await) | 60-100s | **PRIMARY BOTTLENECK** |
| `translateToEnglishKeywords` | Sequential (after AI) | 2-8s | Second hidden LLM call |
| `buildImagePool` | Sequential (after translate) | 1-3s | 2 Unsplash API calls |
| `fulfillImageNeeds` | Internal `Promise.all` | 5-15s | Parallel uploads, but waits for all |
| `stripOrphanMediaRefs` | Sequential (after fulfill) | 1-3s | DB verify per bucket |
| DB writes (pages loop) | Sequential per page | 5-20s | 3-5 pages × 2-4s each |
| `sampleProductsPromise` await | Sequential (products loop) | 3-10s | Each product create sequential |

**Total worst-case: 90-160s (AI-first path)**  
**Total template-first path: 25-60s**

---

## Identified Bottlenecks

### BN-1: Main LLM call is non-streaming, fully sequential (PRIMARY)
**File:** `src/lib/ai/openai-generator.ts:236-250`

```typescript
completion = await openai.chat.completions.create({
    model: modelName,        // 'gpt-4.1-mini'
    max_tokens: 10000,       // large output cap
    response_format: { type: 'json_object' },
    // NO stream: true
})
```

`gpt-4.1-mini` with 10K max tokens and `json_object` mode does not stream. The server waits for the entire JSON blob (~5,000-7,000 tokens) before processing. p50 ~60s, p95 ~100s.

### BN-2: SSE events are buffered, not truly streamed (STRUCTURAL)
**File:** `src/app/api/ai/generate-site/route.ts:1246-1291`

The SSE `ReadableStream` is opened and events replayed ONLY AFTER the full pipeline completes. The "streaming" UI is fake — every block appears at once, 100ms apart. The client sees 0 events during the entire 60-100s AI call.

### BN-3: Hidden second LLM call (`translateToEnglishKeywords`) after main AI
**File:** `src/app/api/ai/generate-site/route.ts:511-526`

```typescript
const aiTranslation = await translateToEnglishKeywords({...}) // gpt-4o-mini, 8s timeout
```

This runs SEQUENTIALLY after `generateSiteWithAI` returns. For non-English input (Vietnamese/Malay businesses), this adds 2-8s on top of the main call. It creates a new OpenAI client instance on every call (`new OpenAI({ apiKey: key })`) rather than reusing one.

### BN-4: Page creation loop is sequential
**File:** `src/app/api/ai/generate-site/route.ts:820-947`

```typescript
for (const pageDefinition of pageDefinitions) {     // 3-5 pages
    createdPage = await withPayloadRetry(            // sequential per page
        () => payload.create({ collection: 'pages', ... })
    )
}
```

3-5 pages created one by one. Each `payload.create` for a page with many blocks (layout with 8-12 blocks, each with sub-arrays) can take 2-5s due to Drizzle's FK-cascade writes. This adds 6-20s after the AI finishes.

### BN-5: `startCapture` DB write before main AI call
**File:** `src/lib/ai/capture-generation.ts:141`

```typescript
const record = await payload.create({ collection: ... })
```

A DB write happens before the main OpenAI call inside `generateSiteWithAI`. While small (~50ms), it is in the critical path.

---

## Timing Instruments Already Present

The route has `phaseTimings` tracking (route.ts:335-341):
```typescript
const phaseTimings: Record<string, number> = {}
const trackPhase = <T>(name: string, fn: () => Promise<T>): Promise<T> => { ... }
```

These phases are tracked: `ai`, `media`, `db`, `other`. The final log line:
```
[generate-site] DONE total=Xms ai=Yms media=Zms db=Wms other=Vms ...
```

To see actual timing in Vercel logs, search for: `[generate-site] DONE`

---

## Quick Wins (Prioritized)

### QW-1: Emit initial SSE "ping" before AI call (immediate UX win, 0 risk)
Send the first SSE event before `generateSiteWithAI()` is called. Open the stream early, send a `step` event with `progress: 5, label: 'Analyzing...'`, then continue. This requires refactoring the route to open the stream before the pipeline starts.

**Impact:** Client sees response immediately. "Analyzing" step animates for real instead of being stuck at 8%.

### QW-2: Move `translateToEnglishKeywords` to run in parallel with AI call
Currently: `generateSiteWithAI()` completes → `translateToEnglishKeywords()` starts.  
Fix: Start translation in parallel with the main AI call, since it only needs `businessInfo.industry` and `businessInfo.products` which are known before `generateSiteWithAI` is called.

**File:** `src/app/api/ai/generate-site/route.ts` — start before line 410.  
**Impact:** Saves 2-8s on non-English path. Zero risk (already gracefully falls back).

### QW-3: Parallelize page creation loop
Replace sequential `for` loop with `Promise.allSettled` for sub-pages (homepage must remain first since site ID is required).

**File:** `src/app/api/ai/generate-site/route.ts:820`  
**Impact:** Saves 4-15s on 4-page sites. Risk: FK race conditions exist (noted in code comments), but `withPayloadRetry` handles them.

### QW-4: Enable OpenAI streaming for AI-first path + true SSE flush
Stream the OpenAI JSON response using `stream: true` + structured output streaming, parse partial JSON, and flush blocks to the client as they arrive.  
**Impact:** Client starts seeing blocks at ~5-10s instead of 60-100s. High complexity, highest UX impact.

### QW-5: Reuse OpenAI client in `translateToEnglishKeywords`
Currently creates `new OpenAI({ apiKey: key })` on every call. Should accept the existing `openai` instance from the caller.  
**Impact:** Minor (saves ~5ms connection overhead) but a code quality fix.

---

## Environmental Factors

- `GEN_MODE` env var: if not set or not `'ai-first'`, template-first path is default for EN input (~3-8s for personalization). AI-first activates for non-EN input or `extraInstructions`. Most user-reported slowness likely hits the AI-first path (non-English business names).
- `ENABLE_DALLE_HERO=true` would add DALL-E image generation in parallel with main AI (but it's off by default).
- Vercel `maxDuration=300` — raised from 60s to accommodate this latency, confirming this is a known issue.
- Comment at `route.ts:2-6` explicitly documents: "Real-world timing sits around 60-120s".

---

## Unresolved Questions

1. What percentage of users hit AI-first vs template-first? If most users are Vietnamese/Malay businesses, AI-first dominates.
2. Are there Vercel logs with `[generate-site] DONE` showing actual `ai=Xms media=Yms db=Zms` breakdown for recent slow runs?
3. Does the 73s reported observation include the frontend's own elapsed timer (starts at request send) or the server's start time? They diverge by the pre-flight DB check time (~2-5s).
4. Is `gpt-4.1-mini` the actual model in staging, or has it been overridden via `AI_MODEL_SITEGEN` env var?
