# Phase 01 — LLM image-keyword extraction + wire into route imagePool path

## Context links
- Task brief (issue #1185 comment 4851557786), PR #1481 (prior fix, merged).
- Verified: `src/app/api/ai/generate-site/route.ts:443-474`, `src/lib/ai/image-pool.ts` (`buildPoolQuery`, `BuildPoolCtx`), `src/lib/ai/generate-meta.ts` (cheap-model call pattern), `src/lib/ai/config.ts` (models), `src/lib/ai/image-keywords.ts` (`deriveKeywords`, `englishKeywords`).

## Overview
- **Date**: 2026-07-09 · **Priority**: P1 · **Status**: completed
- Add a small LLM call that extracts 2-4 Pixabay-ready keywords from business info (name+industry+shortDescription+products) in the user's input language, merged into `rawKeywords` (products first). Fixes Issue 1: generic industry-level images when products empty/thin.

## Key insights
- `rawKeywords` (route.ts:456) feeds BOTH: (a) pool `products[]` via `buildImagePool`, and (b) `englishKeywords` returned from the IIFE → threaded to `deriveKeywords` legacy path in media-injector. One merge point covers both.
- `imagePoolPromise` (route.ts:454-473) already runs **concurrent** with AI gen (GH-1190); `sampleProducts` starts only after it resolves. A ~2-3s `gpt-4.1-nano` call lands within the 30-77s AI window → ~0ms added wall-clock.
- Pixabay `q` is AND-matched; `buildPoolQuery` joins `products[]` (max 3) with spaces. So keep merged `rawKeywords` capped at 3 (products first, extracted fills remaining). The existing relaxed + VN-category fallback ladder already handles tight-query underfill — no new fallback needed.
- `generate-meta.ts` hardcodes its model (`gpt-4o-mini`) directly — precedent to hardcode `gpt-4.1-nano` (cheapest tier, matches `seo-generation`/`url-extraction`) without touching config.ts's five `Record<AITask>` maps (KISS).

## Requirements
**Functional**
- `extractImageKeywords({ businessName, industry, shortDescription, products, language })` → `Promise<string[]>` (2-4 short keywords/phrases, user-input language).
- Merge extracted into `rawKeywords` at route.ts:456: dedup (case-insensitive), products first, `.slice(0,3)`.
- Graceful degradation: no `OPENAI_API_KEY` / timeout / malformed JSON / any throw → return `[]` → `rawKeywords` = products-only (current behavior).

**Non-functional**
- New file <200 lines, kebab-case. Timeout ~10s (fail-fast, like generate-meta's 15s). No new required env var. No schema change.

## Architecture
Data flow (added step in **bold**):
```
businessInfo ─▶ imagePoolPromise IIFE (concurrent w/ AI gen)
                 ├─ parseProductsString(products) ─┐
                 ├─ **extractImageKeywords(...) → [kw]** (nano LLM, ≤10s, []-on-fail)
                 │                                  ▼
                 │        mergeKeywords(products, extracted) dedup, products-first, slice(0,3)
                 │                                  ▼ rawKeywords
                 ├─ buildImagePool({ products: rawKeywords, topProduct: rawKeywords[0], ... })
                 └─ return { pool, englishKeywords: rawKeywords }
                                                     ▼
                            media-injector: pool path + deriveKeywords legacy path (englishKeywords)
```
Extraction prompt: system = "Return JSON `{keywords:[...]}` of 2-4 concrete visual image-search terms for a stock-photo search, in the SAME language as the business inputs. Prefer concrete nouns/scenes over abstract words." user = business fields. `response_format: json_object`, `max_tokens: ~120`, `temperature: 0.4`.

## Related code files
- **Create**: `src/lib/ai/extract-image-keywords.ts` (extraction fn + `mergeKeywords` dedup helper).
- **Modify**: `src/app/api/ai/generate-site/route.ts` (lines ~454-473: call extraction inside IIFE, merge into `rawKeywords`). Verify `businessInfo` exposes `shortDescription` in scope (via `business-info-mapper`) — if absent, thread it through or use `''`.
- **Delete**: none.

## Implementation steps
1. Create `extract-image-keywords.ts`: `getOpenAI()` (copy generate-meta pattern), `extractImageKeywords(input)` returning `string[]` — null client/empty inputs/error → `[]`. Export `mergeKeywords(base: string[], extra: string[], cap=3): string[]` (case-insensitive dedup, base first).
2. In route IIFE, after `_parsedProductsForPool`, `await extractImageKeywords({...}).catch(()=>[])`; `const rawKeywords = mergeKeywords(_parsedProductsForPool, extracted).slice(0,3).filter(Boolean)`.
3. Keep `buildImagePool` call + return shape unchanged (still `englishKeywords: rawKeywords`).
4. Run `npx tsc --noEmit` (or project typecheck) — confirm no type errors.

## Todo list
- [x] `extract-image-keywords.ts` created (<200 lines, graceful fallback)
- [x] `mergeKeywords` dedup + cap implemented
- [x] route.ts merge wired at IIFE (concurrent path, no sampleProducts delay regression)
- [x] `shortDescription` field name confirmed in route scope
- [x] typecheck clean

## Success criteria
- With products empty, `rawKeywords` contains business-specific extracted terms (not `CATEGORY_BASE_KEYWORDS`) → pool query business-level.
- With products present, products occupy first slots; extracted only fills remainder.
- API key removed / LLM error → identical output to pre-fix (products-only). Observable via unit test (phase-03) + staging manual gen.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| LLM returns off-language/English terms → Pixabay lang mismatch | M×M | Prompt pins output language; downstream `detectQueryLang` still routes; fallback ladder covers underfill |
| Extraction latency delays sampleProducts | L×M | nano ~2-3s inside 30-77s AI window; timeout 10s caps worst case |
| Too many/long terms → AND-match zero results | L×M | cap 3, products-first; existing relaxed + VN-category fallback |
| Added cost per gen | L×L | nano ~4x cheaper than 4o-mini, ~120 tokens |

## Security considerations
- Business inputs already sanitized upstream (`sanitize-user-input.ts`). No secrets in prompt. Reuse `OPENAI_API_KEY` (existing). No new external host.

## Next steps
- Independent of phase-02. Feeds phase-03 (extraction unit test + TC-F38 additions).

## Rollback
- Revert route.ts merge line to `_parsedProductsForPool.slice(0,3)` and delete new file → exact pre-fix behavior.
