# Phase 03 — Tests (TC-ID mapped) + QA doc TC additions

## Context links
- Verified test homes: `src/__tests__/unit/lib/ai/media-injector.test.ts`, `media-injector-hydrate.test.ts`, `pixabay-client.test.ts`, `src/__tests__/unit/ai/image-pool.test.ts`, `content-injection-client-logos.test.ts`.
- QA docs: `docs/qa/F38-image-provider-multi-source.md` (TC-F38-RAW-01..17), `docs/qa/F04-block-renderer.md` (TC-F04.*).
- Rule: every test → TC-ID from `docs/qa/F*.md` (`.claude/rules/testing.md`). Import from source, no re-implementation, no mock-to-pass.

## Overview
- **Date**: 2026-07-09 · **Priority**: P1 · **Status**: completed
- Add unit tests for extraction (phase-01), injection-exclusion + monogram (phase-02). **TC-IDs must be added to QA docs FIRST** — none exist for these scenarios.

## Key insights
- No existing TC covers LLM keyword extraction, logo-cloud injection-exclusion, or monogram → new TC-IDs required before writing tests.
- F38 already owns Pixabay/keyword scenarios (extend `TC-F38-RAW-*`). F04 owns block-render (extend `TC-F04.*` for monogram).
- Extraction test must NOT hit real OpenAI — mock the client (top-level `vi.mock`), assert graceful `[]` on no-key/timeout/malformed, and merge-order (products first).

## Requirements
**QA doc additions (do first)**
- `docs/qa/F38-image-provider-multi-source.md` §4b: add
  - `TC-F38-RAW-18` [Positive] `extractImageKeywords` returns 2-4 keywords in input language from business info.
  - `TC-F38-RAW-19` [Negative] no `OPENAI_API_KEY` / timeout / malformed JSON → `[]` (graceful).
  - `TC-F38-RAW-20` [Positive] `mergeKeywords` products-first, case-insensitive dedup, cap 3; empty products → extracted fills.
  - `TC-F38-RAW-21` [Positive] `planImageNeeds` skips `logo-cloud` even when `PIXABAY_BLOCKS=all` (no image need emitted).
  - `TC-F38-RAW-22` [Positive] `hydrateUrlUploadsToMedia`/`cleanupNonNumericImageFields` still process logo-cloud spec (real uploaded logo URL → Media; empty `{url:''}` stripped).
- `docs/qa/F04-block-renderer.md`: add
  - `TC-F04.LC1` [Positive] `LogoPlaceholder` monogram: single-word "Aeon"→"AE", "Maxis"→"MA".
  - `TC-F04.LC2` [Positive] multi-word "Bank Negara Malaysia"→"BNM" (≤3); empty→"?".
  - `TC-F04.LC3` [Positive] real logo (`logo.url` present / numeric) → `LogoImage` renders; `data-image-index` preserved on both paths.

**Tests**
- New `src/__tests__/unit/ai/extract-image-keywords.test.ts` → TC-F38-RAW-18/19/20 (mock OpenAI).
- Extend `src/__tests__/unit/lib/ai/media-injector.test.ts` → TC-F38-RAW-21; extend `media-injector-hydrate.test.ts` → TC-F38-RAW-22.
- New `src/__tests__/unit/blocks/logo-cloud-placeholder.test.ts` (or nearest block test dir) → TC-F04.LC1/LC2/LC3 (render via testing-library, assert monogram text + `data-image-index`).

## Related code files
- **Modify**: `docs/qa/F38-image-provider-multi-source.md`, `docs/qa/F04-block-renderer.md`, `src/__tests__/unit/lib/ai/media-injector.test.ts`, `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts`.
- **Create**: `src/__tests__/unit/ai/extract-image-keywords.test.ts`, `src/__tests__/unit/blocks/logo-cloud-placeholder.test.ts`.
- **Delete**: none.

## Implementation steps
1. Add TC-IDs to F38 §4b and F04 (tables, `[ ]` status).
2. Write extraction unit test (mock `openai`): success shape, `[]` on no-key/timeout/malformed, `mergeKeywords` order/dedup/cap.
3. Extend media-injector tests: `planImageNeeds([logo-cloud block])` with `PIXABAY_BLOCKS=all` → 0 needs for logo-cloud; hydrate test → logo-cloud logo URL ingested.
4. Write logo-cloud placeholder render test: monogram cases + real-image path + `data-image-index`.
5. Run `npm test` for touched files → 100% pass. No fake data/mocks-to-pass.

## Todo list
- [x] TC-F38-RAW-18..22 added to F38
- [x] TC-F04.LC1..LC3 added to F04
- [x] extraction test (3 TCs) green (15 tests pass)
- [x] media-injector exclusion + hydrate tests green (24 + 15 tests pass)
- [x] logo-cloud placeholder test green (15 tests pass)
- [x] full `npm test` on touched suites passes (69/69 tests)

## Success criteria
- All new TCs pass; each test references its TC-ID (comment/describe). No regression in existing F38/F04 suites.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Test mocks OpenAI incorrectly → false green | L×M | Assert on merge output + fallback path, not just call; top-level `vi.mock` |
| Block test env lacks CSS-var/theme provider | L×L | Assert text content + `data-image-index` attr, not computed styles |
| TC-ID collision with existing numbering | L×L | Use next free RAW-18+ / LC suffix; grep before adding |

## Security considerations
- Tests use synthetic business data only. No real API keys committed. Mock network.

## Next steps
- After green: code-reviewer → git-manager (`fix(ai): business-context image keywords + logo-cloud monogram`, `Relates to #1185`, PR → staging). Depends on phase-01 + phase-02 merged into working tree.
