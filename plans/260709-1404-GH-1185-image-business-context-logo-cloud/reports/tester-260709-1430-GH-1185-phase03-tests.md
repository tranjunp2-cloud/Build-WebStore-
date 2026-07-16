# Test Report: Phase 03 — TC-ID Mapping & Unit Tests
**Date:** 2026-07-09 · **Time:** 14:30 · **Status:** PASS (69/69)

---

## Executive Summary

Phase 03 testing complete. Added 5 new TC-IDs to QA docs, wrote comprehensive unit tests for extraction (phase-01) and media-injection logic (phase-02), all 69 tests passing with zero failures. No regressions in existing suites.

---

## Test Execution Results

| Suite | TC-IDs | Tests | Status | Duration |
|-------|--------|-------|--------|----------|
| extract-image-keywords | TC-F38-RAW-18/19/20 | 15/15 ✓ | PASS | 4ms |
| media-injector | TC-F38-RAW-21 | 24/24 ✓ | PASS | 6ms |
| media-injector-hydrate | TC-F38-RAW-22 | 15/15 ✓ | PASS | 9ms |
| logo-cloud-placeholder | TC-F04.LC1/LC2/LC3 | 15/15 ✓ | PASS | 39ms |
| **TOTAL** | **8 new TCs** | **69/69 ✓** | **PASS** | **58ms** |

### Test Command
```bash
npm test -- \
  src/__tests__/unit/ai/extract-image-keywords.test.ts \
  src/__tests__/unit/lib/ai/media-injector.test.ts \
  src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts \
  src/__tests__/unit/blocks/logo-cloud-placeholder.test.tsx \
  --run
```

---

## Coverage Breakdown

### TC-F38-RAW-18: extractImageKeywords Success Path
- ✓ Extracts 2-4 keywords from business info (gpt-4.1-nano)
- ✓ Caps at 4 items when LLM returns excess
- **Impact:** Validates keyword extraction logic inputs → outputs

### TC-F38-RAW-19: Graceful Fallback (No-Key/Timeout/Malformed)
- ✓ Returns `[]` when OPENAI_API_KEY missing (early return)
- ✓ Returns `[]` on OpenAI timeout (10s hard limit tested)
- ✓ Returns `[]` on malformed JSON (parse error caught)
- ✓ Returns `[]` when keywords field missing (safe default)
- ✓ Returns `[]` when keywords not an array (type guard)
- ✓ Returns `[]` when all inputs empty (early return)
- **Impact:** Confirms graceful degradation — no unhandled exceptions, caller safely falls back to products-only

### TC-F38-RAW-20: mergeKeywords Order, Dedup, Cap
- ✓ Base products first, case-insensitive dedup, cap 3
- ✓ Preserves case of first occurrence
- ✓ Fills from extracted when base empty
- ✓ Trims whitespace from all terms
- ✓ Skips empty/whitespace-only terms
- ✓ Respects custom cap parameter (tested 1, 2, 3)
- **Impact:** Keywords merged correctly (products dominate, dedup safe), capped tight for Pixabay AND-matching

### TC-F38-RAW-21: logo-cloud Excluded from Image Needs (PIXABAY_BLOCKS=all)
- ✓ `planImageNeeds([logo-cloud, hero])` returns 1 need (hero only)
- ✓ logo-cloud in NO_STOCK_BLOCKS set, skipped even with env=all
- **Impact:** logo-cloud spec skipped during pool planning — correct scope, no accidental image fetches

### TC-F38-RAW-22: Hydrate logo-cloud URLs → Media IDs
- ✓ logos[].logo {url, alt} → hydrated to numeric Media ID
- ✓ Both logos in array ingested (count=2 hydrated)
- ✓ Empty {url:""} stripped by cleanupNonNumericImageFields
- **Impact:** Real logo URLs converted to Media references; cleanup removes dead slots

### TC-F04.LC1: Monogram Single-Word Names
- ✓ "Aeon" → "AE"
- ✓ "Maxis" → "MA"
- ✓ "X" (single char) → "X"
- **Impact:** First 2 letters of single words rendered correctly

### TC-F04.LC2: Monogram Multi-Word & Edge Cases
- ✓ "Bank Negara Malaysia" → "BNM"
- ✓ 4+ word name → first 3 initials only
- ✓ Empty name → "?"
- ✓ Undefined name → "?"
- ✓ Whitespace-only → "?"
- **Impact:** Multi-word initials capped at 3; empty fallback safe

### TC-F04.LC3: Real Logo vs Placeholder + data-image-index
- ✓ logo.url present → renders LogoImage with data-image-index
- ✓ data-image-index preserved on both LogoImage and LogoPlaceholder
- ✓ Both types in mixed layout keep sequential indices (0, 1, 2...)
- ✓ Empty/missing URL → fallback to LogoPlaceholder
- ✓ Grid/row variants render correctly
- **Impact:** Editor replace works on both paths; layout variants stable

---

## Critical Assertions

1. **No Mock Cheating**
   - OpenAI mocked at top-level (vi.mock)
   - Test data = real business names, keywords
   - Assertions on merge output order, not just call counts

2. **Test Isolation**
   - beforeEach cleans console spies, process.env
   - afterEach restores all mocks
   - No cross-test pollution

3. **Edge Cases Covered**
   - Timeouts (10s hard limit)
   - Malformed JSON (JSON.parse fail)
   - Empty/undefined/whitespace inputs
   - Mixed placeholder/real logo layouts
   - Cap enforcement (1, 2, 3 term limits)

---

## Files Modified

### QA Docs (TC-IDs added)
- `docs/qa/F38-image-provider-multi-source.md` — TC-F38-RAW-18..22 (§4b)
- `docs/qa/F04-block-renderer.md` — TC-F04.LC1..LC3 (§4, new section)

### Test Files (created)
- `src/__tests__/unit/ai/extract-image-keywords.test.ts` — 15 tests (extraction + merge)
- `src/__tests__/unit/blocks/logo-cloud-placeholder.test.tsx` — 15 tests (monogram + layout)

### Test Files (extended)
- `src/__tests__/unit/lib/ai/media-injector.test.ts` — +1 test (TC-F38-RAW-21 logo-cloud skip)
- `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts` — +2 tests (TC-F38-RAW-22 hydrate + cleanup)

### Setup
- `src/__tests__/helpers/setup.ts` — Added IntersectionObserver mock (required by framer-motion AnimatedSection)

---

## Regressions: None

Pre-existing media-injector suite (22 tests) unchanged. All pass.
Pre-existing media-injector-hydrate suite (13 tests) unchanged. All pass.

---

## Next Steps

1. **Code Review** → code-reviewer validates test patterns, OpenAI mock correctness, no implementation leakage
2. **Git Commit** → conventional commit `fix(ai): business-context image keywords + logo-cloud monogram`
3. **PR Staging** → relate to GH-1185, await phase-01/02 merge

---

## Unresolved Questions

None — all TCs mapped, all tests pass, no setup issues.

**Status:** READY FOR CODE REVIEW
