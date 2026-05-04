# Phase 05 — Fallback rewire + try/catch + synthetic events

## Context links
- Parent plan: `./phase-06-fallback-composer-unify.md`
- Depends on: Phase 01, Phase 02, Phase 03, Phase 04
- Blocks: Phase 06 (test + e2e verify)
- Research: `./research/researcher-04-fallback-streaming-tests.md` Q1, Q5

## Overview
- Date: 2026-04-14
- Description: Replace the body of `generateWithFallback()` in `openai-generator.ts` so it calls `composeFallbackResult` from Phase 04, emits SSE `step` events that match the happy-path cadence, wraps the composer call in try/catch, and falls back to the legacy `generateBlocks` path as a second-tier safety net.
- Priority: P1
- Status: pending
- Review status: not reviewed

## Key Insights
- Current `generateWithFallback` (openai-generator.ts:249-266) emits only 4 events: `step(fallback, 50)`, `theme_set`, N × `block_complete`, `seo_generated`, `done`. Happy path emits `analyzing`, `generating`, `parsing`, `theme_set`, per-block `step`, `block_complete`, `seo_generated`, `saving`, `done`.
- Route handler is shape-agnostic — both paths return `{ result, events }`. No route changes required.
- Route already emits its own terminal `done` event after the generator's `done` (route.ts:478), resulting in a double-`done`. This refactor is a good moment to drop the generator-level `done` and let the route be the single source — but only if Phase 06 confirms frontend does not depend on two `done`s. Safer default: keep the generator `done` unchanged and leave the double-done alone (already shipped behavior).
- `parseIntent().language` exists already — reuse to set `GenerationResult.language`.
- Composer failure must NOT crash the route. Wrap in try/catch. On throw, log + call `generateBlocks(prompt, seed)` as the existing legacy fallback.

## Requirements
- New body for `generateWithFallback`.
- Synthetic `step` events at progress 50, 60, 75, 85, 95 so the progress bar animates smoothly.
- Try/catch: composer failure triggers legacy `generateBlocks` path.
- When composer succeeds, `result.blocks` preserves the composer's rich content (Phase 04 adapter).
- When legacy path fires, emit a distinct `step({ step: 'fallback_legacy', ... })` so we can tell from logs which tier fired.

## Architecture
```
generateWithFallback(prompt, seed, language, extractedName?)
    │
    ├─ events.push(step:'fallback_analyzing', progress:50)
    ├─ events.push(step:'fallback_composing', progress:60)
    │
    ├─ try:
    │     result = composeFallbackResult(prompt, seed, language, extractedName)   // Phase 04
    │     events.push(step:'fallback_validating', progress:75)
    │     events.push(theme_set, {theme: result.theme})
    │     for block in result.blocks:
    │         events.push(step:'fallback_block_${i}', progress: 75 + i*ratio)
    │         events.push(block_complete, {block, index})
    │     events.push(seo_generated, result.seo)
    │     events.push(step:'saving', progress:95)
    │     events.push(done, {totalBlocks})
    │     return {result, events}
    │
    ├─ catch (composerError):
    │     events.push(step:'fallback_legacy', progress:55)
    │     result = generateBlocks(prompt, seed)                                   // legacy
    │     (repeat theme_set + block_complete + seo_generated + done as today)
    │     return {result, events}
```

## Related code files
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/openai-generator.ts` (lines 249-266 target function, lines 36-239 happy-path reference for event cadence)
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/fallback-adapter.ts` (NEW, from Phase 04)
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/generate-blocks.ts` (legacy safety net — unchanged)
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/app/api/ai/generate-site/route.ts` (lines 247-489 consumer — unchanged)

## Implementation Steps
1. Import `composeFallbackResult` from `./fallback-adapter` at the top of `openai-generator.ts`.
2. Identify what `extractedName` data is available to `generateWithFallback`. It is called from `generateSiteWithAI` catch block (line ~244). Pass the `businessInfo.name` (or whatever the existing AI path uses as the canonical business name) down through a new optional param.
3. Replace function body with the architecture pseudocode above.
4. For the synthetic per-block step events, use a helper: `progress = 75 + Math.round((i / total) * 15)` so we land at 90 before `saving`.
5. In the catch branch, call the existing `generateBlocks(prompt, seed)` and loop events exactly as today — this preserves the current behavior as a last-resort safety net.
6. Add a `console.warn('[Fallback] composer failed, using legacy generateBlocks', err)` in the catch.
7. Run `pnpm tsc --noEmit` and the openai-generator unit tests.

## Todo list
- [ ] Import `composeFallbackResult`
- [ ] Plumb `extractedName` param through `generateSiteWithAI` → `generateWithFallback`
- [ ] Rewrite function body with composer-first + legacy safety net
- [ ] Emit synthetic `step` events (50, 60, 75, per-block, 95)
- [ ] Try/catch around composer call, legacy `generateBlocks` on throw
- [ ] `tsc --noEmit` clean
- [ ] Existing openai-generator test still parseable (will adapt in Phase 06)

## Success Criteria
- `tsc --noEmit` clean.
- Unit: `generateWithFallback("coffee shop", 1234, "en")` returns a result with `result.blocks.length >= 5` and events containing at least one `theme_set` and one `seo_generated`.
- Unit: when `composeFallbackResult` is mocked to throw, `generateWithFallback` still returns a result via the legacy path and emits a `step:'fallback_legacy'` event.
- Manual verification: trigger an AI failure in dev (`OPENAI_API_KEY=bad`) for the prompt `"Italian restaurant in district 3"`, watch the client SSE stream, confirm the progress bar animates smoothly and the rendered site has `menu-display` + `booking-widget` blocks instead of placeholder content.

## Risk Assessment
| Risk | Likelihood | Mitigation |
|---|---|---|
| Synthetic step events conflict with frontend progress bar expectations | Medium | Mirror happy-path event names/progress scale as closely as possible |
| `extractedName` plumbing touches too many callers | Low | Optional param with default `undefined` |
| Catch branch swallows an error the caller wanted to see | Medium | Re-log with `console.warn`, never swallow silently; preserve stack |
| Double-done from route still present and confuses clients | Low (pre-existing) | Not in scope here — document in Phase 07 for later cleanup |
| Composer path works locally but throws on staging due to missing category content file | Medium | Phase 06 smoke test covers all 14 categories |

## Security Considerations
No new user-input surface — `prompt` and `extractedName` were already flowing through the legacy path. Sanitization stays in the route layer as today.

## Next steps
Phase 06 runs the full test suite, fixes breakages, and performs e2e verification on staging-like environment.
