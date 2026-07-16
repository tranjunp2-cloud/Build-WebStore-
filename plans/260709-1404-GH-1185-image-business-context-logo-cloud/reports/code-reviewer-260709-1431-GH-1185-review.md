# Code Review — GH-1185 (business-context image keywords + logo-cloud monogram)

Branch: `fix/GH-1185-pixabay-raw-keyword-lang-vi` (uncommitted working tree)
Plan: `plans/260709-1404-GH-1185-image-business-context-logo-cloud/`
Reviewer: code-reviewer | Date: 2026-07-09

## Scope
- NEW `src/lib/ai/extract-image-keywords.ts` (131 lines)
- MOD `src/app/api/ai/generate-site/route.ts` (+19)
- MOD `src/lib/ai/media-injector.ts` (+8)
- MOD `src/blocks/logo-cloud/index.tsx` (120 lines total)
- Tests: `extract-image-keywords.test.ts` (new, 15), `logo-cloud-placeholder.test.tsx` (new, 15), `media-injector.test.ts` (+1), `media-injector-hydrate.test.ts` (+2), `setup.ts` (IntersectionObserver stub)
- Docs: `docs/qa/F38` (TC-F38-RAW-18..22), `docs/qa/F04` (TC-F04.LC1..LC3)

## Verification run
- `tsc --noEmit` — clean
- 4 affected suites: **69/69 pass**
- `next lint` — fails on pre-existing worktree lockfile/eslintrc plugin conflict (project-wide, not this changeset; matches phase-02 note)
- `git diff` contains no `Closes #`

## Critical Issues
None.

## High Priority
None.

## Medium Priority

1. **Wasted LLM call + worst-case 10s chain delay when products already yield ≥3 keywords** — `route.ts:464-473`. `mergeKeywords` is base-first + cap 3, so when `_parsedProductsForPool.length >= 3` every extracted term is provably discarded, yet the call still runs and (worst case, timeout) delays `imagePoolPromise` → `sampleProductsPromise` chain start by up to 10s. Common case (~1-3s nano) is absorbed by the 30-77s AI-gen window, so no expected wall-clock regression — but the "no sampleProducts delay" criterion holds in expectation only. Plan unresolved-Q3 chose "always call"; that made sense before the cap-3 base-first merge made the ≥3 case a guaranteed no-op. **Fix (2 lines):** `const extractedKeywords = _parsedProductsForPool.length >= 3 ? [] : await extractImageKeywords({...}).catch(() => [])`. Non-blocking — safe to ship as-is, but the guard is free latency/cost insurance.

2. **`Language: auto` passed verbatim to the LLM** — `route.ts:469` + `extract-image-keywords.ts:72`. `language` defaults to `'en'` and can be `'auto'` (route.ts:120); the user prompt then contains the literal line `Language: auto`, which can bias output toward English. Mitigated by the system prompt ("SAME language as the business inputs") — plan unresolved-Q1 anticipated this. **Suggest:** omit the `Language:` line when value is `'auto'` (or absent). Non-blocking.

## Low Priority

3. `route.ts:471-473` — `.slice(0, 3).filter(Boolean)` after `mergeKeywords` is redundant (merge already caps 3 and filters empties). Harmless; keep or drop.
4. `logo-cloud/index.tsx:52,55` — `slice(0, 2)` / `w[0]` operate on UTF-16 code units; a brand name starting with an astral char (emoji, CJK-ext surrogate pair) yields a mojibake half-char. `Array.from(w)` would fix; realistically negligible for brand names. Common non-Latin (Vietnamese, standard CJK) is fine — verified BMP-safe.
5. `extract-image-keywords.test.ts` — `OPENAI_API_KEY='test-key'` set in tests is never deleted in `afterEach` (only in `beforeEach`); `console.warn` spy never `mockRestore`d. Contained by vitest per-file isolation (default `isolate: true`), but add teardown for hygiene.
6. `logo-cloud-placeholder.test.tsx:66-72` — "single letter name as-is uppercased" uses `'X'` (already uppercase), so uppercasing isn't actually exercised; use `'x'`.
7. `logo-cloud-placeholder.test.tsx:14-20` — next/image mock spreads boolean `fill` onto `<img>` → React non-boolean-attribute warning in stderr (test still green). Strip `fill`/`sizes` in the mock to silence.
8. Timeout test (`RAW-19`) asserts the rejection path but not that `{ timeout: 10000 }` is actually passed to `create` — an assertion on the second arg would lock the contract. Informational.

## Review-focus verdicts

| Focus | Verdict |
|---|---|
| 1. Graceful degradation | PASS — double containment: internal try/catch returns `[]` (extract-image-keywords.ts:103-109) + belt-and-braces `.catch(() => [])` at route.ts:470; missing-key and empty-input early returns; timeout enforced via OpenAI SDK per-request option `{ timeout: 10000 }` (aborts request — same pattern as generate-meta.ts:74, generate-blog-seeds.ts:70). No dangling promise, no unhandled-rejection path. Failure yields exact pre-fix products-only `rawKeywords`. |
| 2. route.ts placement | PASS — extraction runs inside `imagePoolPromise` IIFE, concurrent with `generateSiteWithAI` (awaited line 511). Return shape `{pool, englishKeywords}` unchanged; `buildImagePool` failure isolation preserved. Residual: see Medium #1 (chain-start delay bounded at 10s worst-case, absorbed in common case). |
| 3. media-injector | PASS — `NO_STOCK_BLOCKS` skip at planImageNeeds:175, before any need emission or array mutation; logo-cloud spec has no `minCount` so no padding behavior lost. `BLOCK_IMAGE_SPEC['logo-cloud']` retained (line 51); hydrate/cleanup/strip iterate the spec directly (lines 255/316/403/692) — unaffected, and regression-tested (RAW-22 ×2). Skip is unconditional (even `PIXABAY_BLOCKS=all`) — intended per plan decision 2, tested (RAW-21). No other block affected. |
| 4. logo-cloud monogram | PASS — empty/undefined/whitespace → `?`; single-word → first 2 chars; 1-char name → itself; multi-word → ≤3 initials; extra whitespace handled by `split(/\s+/).filter(Boolean)`. `data-image-index` present on both placeholder (index.tsx:72) and image (index.tsx:89) paths, incl. mixed layouts (tested). Monogram rendered as JSX text node → auto-escaped, no XSS. Tile style reuses existing `--brand-primary-rgb` convention (matches LogoFrame). Astral-char edge: Low #4. |
| 5. Tests | PASS — all import from source (`@/lib/ai/extract-image-keywords`, `@/blocks/logo-cloud`, `@/lib/ai/media-injector`); no re-implemented logic; `vi.mock` top-level; AAA followed. TC-IDs verified present in docs/qa (RAW-18..22 in F38, LC1..LC3 in F04 — section renumber 4→5→6→7 links intact). No mock-to-pass cheating: mocks are boundary-only (OpenAI SDK, next/image, fetch/payload). `setup.ts` IntersectionObserver stub is conditional (`typeof === 'undefined'`) and no existing test asserts its absence — safe for other suites. `PIXABAY_BLOCKS` env has beforeEach/afterEach cleanup. |
| 6. Security | PASS — prompt-injection surface exists (business inputs → user prompt) but blast radius is keyword steering only; response parsing is defensive (JSON.parse in try, `Array.isArray`, per-item `typeof === 'string'`, trim, cap 4), output never rendered/executed. No secrets logged (`err.message` only, no key material). Monogram XSS-safe. |
| 7. Project rules | PASS — no new required env var (`OPENAI_API_KEY` pre-existing), no schema change (no MIGRATIONS entry needed), files <200 lines (131/120), kebab-case, no `Closes #`, no AI attribution. All phase TODO checkboxes marked and verified accurate. |

## Positive Observations
- Excellent header comment in `extract-image-keywords.ts` explaining the Pixabay AND-match constraint driving cap-3 — future maintainers won't "helpfully" raise the cap.
- Hardcoded `gpt-4.1-nano` with cited precedent (`generate-meta.ts`) instead of new config surface — correct YAGNI call.
- RAW-22 tests specifically pin the hydrate/cleanup behavior that the NO_STOCK_BLOCKS comment promises — comment and test lock each other.
- `hasContent` guard avoids the LLM call entirely on empty input, with a test asserting `create` is NOT called.

## Recommended Actions (all non-blocking)
1. Add `_parsedProductsForPool.length >= 3` early-skip guard (Medium #1).
2. Omit `Language:` prompt line when `'auto'` (Medium #2).
3. Test hygiene: env/spy teardown, `'x'` uppercase case, mock `fill` strip (Low #5-7).

## Metrics
- Typecheck: clean | Affected suites: 69/69 pass | Lint: pre-existing worktree config failure (not changeset)
- New TC coverage: 8 TC-IDs, all present in docs/qa

## Score: 9/10
Deductions: always-call extraction when result is provably discarded (cost/latency), `Language: auto` prompt leak. No correctness or security defects found.

## Unresolved Questions
1. Confirm with QC that 3-char monogram cap is visually acceptable (plan unresolved-Q2 — still open, needs staging screenshot).
2. Should the ≥3-products early-skip land in this PR or a follow-up? (2-line change, zero risk.)
