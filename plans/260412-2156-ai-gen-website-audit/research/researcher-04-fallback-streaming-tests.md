# Researcher 02 — Streaming Pipeline & Test Impact

Source files inspected:
- `src/lib/ai/openai-generator.ts` (SSEEvent type + `generateSiteWithAI` + `generateWithFallback` + `enforceMinContent`)
- `src/lib/ai/template-composer.ts` (`composeTemplate`, `composeFromBlueprint`)
- `src/app/api/ai/generate-site/route.ts` (API entry + SSE stream)

## Q1: Streaming event sequence

`SSEEvent` type (`openai-generator.ts:27-34`):
```ts
event: 'step' | 'theme_set' | 'block_complete' | 'seo_generated' | 'error' | 'done'
data: Record<string, unknown>
```

### AI happy path — `generateSiteWithAI` (openai-generator.ts:36-239)
| # | event | data shape | line |
|---|---|---|---|
| 1 | `step` | `{ step:'analyzing', label, progress:10 }` | 57 |
| 2 | `step` | `{ step:'generating', label, progress:20 }` | 62 |
| 3 | `step` | `{ step:'parsing', label, progress:60 }` | 80 |
| 4 | `theme_set` | `{ theme }` | 111 |
| 5a (multi-page) | `step` | `{ step:'page_${p}', label, progress:60-90 }` | 169 |
| 5b (multi-page) | `block_complete` | `{ block, index }` | 191 |
| 5c (flat) | `step` | `{ step:'block_${i}', label, progress }` | 213 |
| 5d (flat) | `block_complete` | `{ block, index }` | 214 |
| 6 | `seo_generated` | `seo` (flattened record) | 225 |
| 7 | `step` | `{ step:'saving', label, progress:95 }` | 226 |
| 8 | `done` | `{ totalBlocks, timeMs:0 }` | 238 |

On exception: pushes `error` `{ code:'ai_fallback', message, retryable:false }` (line 244) then calls `generateWithFallback` which appends its own events on top.

### Fallback path — `generateWithFallback` (openai-generator.ts:249-266)
| # | event | data shape | line |
|---|---|---|---|
| 1 | `step` | `{ step:'fallback', label, progress:50 }` | 250 |
| 2 | `theme_set` | `{ theme: result.theme }` | 258 |
| 3..N | `block_complete` | `{ block, index }` (loop over `result.blocks`) | 261 |
| N+1 | `seo_generated` | `result.seo` | 264 |
| N+2 | `done` | `{ totalBlocks, timeMs:0 }` | 265 |

### Divergences
1. Fallback has NO `analyzing` / `generating` / `parsing` / per-page / per-block `step` events — frontend progress bar jumps 50 → done with no intermediate feedback.
2. Fallback never emits `step: 'saving'`.
3. Fallback skips all step-progress numbers after 50.
4. Fallback calls `generateBlocks(prompt, Date.now())` — no pages structure, flat block list.
5. When fallback is reached via AI error, it receives the same `events[]` array that already contains analyzing/generating/parsing/error, so the final stream is a concatenation.
6. Both paths return `{ result: GenerationResult; events: SSEEvent[] }` — shape contract is consistent.

## Q2: API route consumption

File: `src/app/api/ai/generate-site/route.ts:247`
```ts
const { result, events } = await generateSiteWithAI(businessInfo, extraInstructions, language, referencePrompt)
```

After generation the route performs NON-streamed work on `result` BEFORE any SSE bytes are written to the client:
- theme override from `visualStyle` (route.ts:250-268)
- `heroImagePromise` resolved + injected into hero block; mutates matching `block_complete` event in-place (route.ts:355-367)
- Site create/update in Payload (route.ts:281-346)
- Sanitize blocks, apply `VARIANT_ALIASES`, re-validate variants against `blockRegistry` (route.ts:348-393)
- `buildGeneratedPages` + loop `payload.create({ collection:'pages' })` per page (route.ts:395-434)
- Increment `aiGenerationsCount` (route.ts:439-445)

Streaming (route.ts:449-489):
```ts
if (isStreaming) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        start(controller) {
            const emitEvents = async () => {
                for (const event of events) {
                    const sseData = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
                    controller.enqueue(encoder.encode(sseData))
                    await new Promise(r => setTimeout(r, 100))
                }
                const doneData = `event: done\ndata: ${JSON.stringify({ siteId, pageId, siteName, siteLanguage, totalBlocks, totalPages, timeMs })}\n\n`
                controller.enqueue(encoder.encode(doneData))
                controller.close()
            }
            emitEvents().catch(() => controller.close())
        },
    })
    return new Response(stream, { headers: { 'Content-Type':'text/event-stream', ... } })
}
// JSON fallback (route.ts:492+): NextResponse.json({ success:true, siteId, pageId, ... })
```

Behavior:
- Events are buffered in memory, then replayed to the client with a 100 ms delay per event after all DB writes finish — it is NOT true live streaming, just fake-streamed playback.
- The route emits its OWN terminal `done` event that OVERRIDES the generator's `done` (with siteId, pageId, totalPages). The generator-emitted `done` (at position 8 above) is still streamed first — effectively the client sees two `done` events.
- One unified handler for both happy + fallback — no branching. That's why the shape contract `{ result, events }` is critical.
- `result` is consumed for DB writes regardless of streaming mode.

## Q3: Test files affected

Grep hits for `generateSiteWithAI | generateBlocks | generateWithFallback | composeTemplate`:

| File | Uses | Status | Reason |
|---|---|---|---|
| `src/__tests__/unit/lib/ai/openai-generator.test.ts` | `generateSiteWithAI` (likely) | ADAPTS | Will need event-count / fallback assertions updated if fallback path emits more/different `step` events. |
| `src/__tests__/unit/lib/ai/generate-blocks.test.ts` | `generateBlocks` direct | UNAFFECTED | Tests the underlying function; still used internally by composer fallbacks & by any legacy path. |
| `src/__tests__/unit/lib/ai/content-rules-integration.test.ts` | content-rules | UNAFFECTED | Independent of generator wiring. |
| `src/__tests__/unit/builder/ai-variety-fallback.test.ts` | fallback | ADAPTS/BREAKS | Name implies it asserts on `generateWithFallback` events; will need update for composer-driven events. |
| `src/__tests__/unit/builder/ai-variety-sanitizer.test.ts` | sanitizer | UNAFFECTED | Tests `sanitizeBlockData`. |
| `src/__tests__/unit/builder/ai-variety-composer.test.ts` | composer variety | ADAPTS | Composer API may change (see Q4). |
| `src/__tests__/api/ai.test.ts` | route | ADAPTS | Asserts on streaming response; shape stays same but event counts differ. |
| `src/__tests__/unit/templates/template-composer.test.ts` | `composeTemplate` | ADAPTS/BREAKS | Direct composer tests — sensitive to signature/import-cycle fix. |
| `src/__tests__/integration/template-smoke.test.ts` | composer seed path | UNAFFECTED | Runs against seed route, not AI route. |
| `src/__tests__/api/templates.test.ts` | seed route | UNAFFECTED | Seed endpoint untouched. |

Classification exact line numbers not fetched (grep file-match only) to stay within tool budget — flagged as BREAKS only when function name or shape likely changes.

## Q4: Circular dep solution

Current (template-composer.ts:5):
```ts
import { enforceMinContent } from './openai-generator'
```
Used at `template-composer.ts:920`:
```ts
const finalTestimonialsVariant = enforceMinContent('testimonials', testimonialsVariant, content.testimonials.length)
```

`enforceMinContent` definition (`openai-generator.ts:607-626`): pure function, depends only on module-local `VARIANT_MIN_CONTENT` lookup table and `console.warn`. No other openai-generator internals touched. Zero Payload/AI deps. Perfectly isolatable.

### Recommended fix (ranked)
1. **Move `enforceMinContent` + `VARIANT_MIN_CONTENT` constant into a neutral file** (e.g. `src/lib/ai/variant-validation.ts` or `src/lib/ai/variant-min-content.ts`).
   - Both `openai-generator.ts` and `template-composer.ts` re-import from the neutral file.
   - No behavior change, no duplication, trivial edit.
   - Effort: ~10 min. Risk: near-zero (pure function).
2. Alternative: re-implement locally in composer — rejected (duplication, single source of truth broken).
3. Alternative: dynamic `await import()` inside composer — rejected (hides dep, hurts tree-shaking, async surface for a pure fn).

**Choose option 1.** This MUST land before or with the refactor PR because as soon as `openai-generator.ts` adds `import { composeTemplate } from './template-composer'`, the circular cycle would be live.

## Q5: Side effects in composer

Inspected `template-composer.ts` (imports at lines 1-6, builder dispatch 1059-1161, `composeTemplate` 1213-1266, `composeFromBlueprint` 1168-1208) and seed route context.

| Concern | Present? | Location | Notes |
|---|---|---|---|
| DB writes (Payload/SQL) | No | — | Composer builds plain JS objects only. |
| File system access | No | — | No `fs` / `path` usage. |
| Network (fetch/OpenAI/Unsplash/DALL-E) | No | — | Content comes from static `getCategoryContent()` (`src/lib/ai/content/*.ts`). |
| Payload media upload | No | — | Hero image upload stays in route.ts via `generateAndUploadHeroImage`; composer doesn't touch media at all. |
| Logging | Yes, low severity | `template-composer.ts:1158` `console.warn('[Composer] Unknown blockType: ...')` + indirect `console.warn` via `applyContentValidation` and `enforceMinContent` | Only warnings — will surface in server logs but not in streamed payload. Safe, but noisy if fallback fires frequently. |
| CPU heavy | No | — | Pure synchronous object construction + `applyContentValidation` (regex-level checks). O(pages × blocks), microseconds in practice. |
| Throws | Yes | `composeTemplate` throws on unknown category / out-of-range businessIndex (lines 1216, 1220) | Fallback must guard: route passes business prompt string, NOT a curated category/businessIndex. Need mapping layer. |

### Context comparison with seed route
Seed route (`/api/templates/seed`) feeds composer with curated `TemplatePreset` objects — known `category`, known `businessIndex`, known `themePreset`. The AI fallback path currently receives a free-form `prompt: string`. Therefore the refactor must:
- Map prompt → `{ category, businessIndex, themePreset, variant }` (mirror whatever `generateBlocks` did — inspect category inference in `generate-blocks.ts`).
- Wrap composer call in try/catch to protect against `throw new Error('Unknown category...')` — otherwise fallback crashes the API and user gets 500.
- Emit step events (`fallback-analyzing`, `fallback-composing`, per-block) to match the happy-path cadence so the progress bar doesn't jump.

### Recommendation
Safe to call from fallback WITH guards:
1. Category/businessIndex resolver (fallback input is a prompt string, not curated input).
2. Try/catch → if composer throws, fall back to current `generateBlocks` as a second-tier safety net (double fallback) or return a hardcoded safe template.
3. Optionally suppress composer `console.warn` in fallback (route-level log filter) to avoid log noise on every AI failure.
4. Emit synthetic `step` events around the composer call so UX parity with happy path is preserved.

## Unresolved questions
1. **Category inference**: how does `generateBlocks(prompt)` currently map free-form prompt → category? Need to read `src/lib/ai/generate-blocks.ts` to confirm whether composer can consume the same resolver or needs new logic. (Not inspected due to tool-call budget.)
2. **`GenerationResult` shape vs `TemplateSeed` shape**: composer returns `TemplateSeed` `{ name, description, category, tier, isPremium, theme, pages }` while the happy path returns `GenerationResult` (imported from `./generate-blocks`). Adapter layer needed — shapes are NOT identical (TemplateSeed has no `siteType`, `siteName`, `seo` top-level, while route.ts reads `result.siteName`, `result.seo.title`, `result.siteType`, `result.language`). This is a meaningful integration cost and may also affect DB-write code in route.ts lines 298-311.
3. **Double `done` event**: route already emits its own `done` after the generator's `done`. With composer fallback, should the generator still emit `done` at all, or should route be the single source? Worth aligning as part of this refactor.
4. **`composeTemplate` vs `composeFromBlueprint`**: `composeTemplate` is marked `@deprecated` (line 1212) in favor of `composeFromBlueprint(preset: TemplatePreset)`. The plan says to use `composeTemplate(...)` — confirm intent; `composeFromBlueprint` is the richer blueprint-driven path and is probably what we actually want for the "rich content layer" goal.
