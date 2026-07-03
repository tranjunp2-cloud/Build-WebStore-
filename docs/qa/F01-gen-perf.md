# F01 Gen-Perf: Performance Baseline & Wave 1 Test Plan

**Plan Reference:** [plans/260703-1341-gen-perf-async-parallel](../../plans/260703-1341-gen-perf-async-parallel/plan.md)

**Feature:** F01 AI Site Generator — performance optimization via async parallel seeding (blog + imglib post-response)

**Baseline (2026-07-03 local timing, pre-optimization):**
| Language | Time-to-`done` | Notes |
|----------|---|---|
| EN | 97.3s | Full gen flow |
| JP | 117.5s | Slower image processing |
| VN | 121.9s | Slowest (20 products + full pipeline) |

**Post-Wave-1 Target:** Reduce time-to-`done` by ~30-40s (blog+imglib now queued post-response, not blocking). Seeds verify landing post-`done` (created_at > done_ts).

---

## Wave 1 Test Matrix (Phase 04)

All tests use TC-ID refs per `docs/TEST_CONVENTION.md`. Tests import real implementations (no re-mocking).

| TC-ID | Level | Scenario | Status | Mapped To | Notes |
|---|---|---|---|---|---|
| TC-GENPERF-W1-01 | integration | route schedules imglib via after() | ✅ PASS | src/__tests__/api/ai.test.ts | real POST invoke; seeder NOT called in-request (event-loop drained), called 1× via captured after() task; mutation-checked: inline fire-and-forget revert FAILS this test |
| TC-GENPERF-W1-02 | integration | route schedules blog via after() | ✅ PASS | src/__tests__/api/ai.test.ts | same harness as W1-01 |
| TC-GENPERF-W1-03 | integration | imglib seeder idempotent on regen | ✅ PASS | src/__tests__/unit/lib/images/image-library-seeder.test.ts | 2nd call → alt-key check → empty mapping, skips work |
| TC-GENPERF-W1-04 | integration | blog seeder skip when count > 0 | ✅ PASS | src/__tests__/unit/lib/ai/seed-blog-posts.test.ts | 2nd gen same tenant → no creates |
| TC-GENPERF-W1-05 | unit | seeder failure non-fatal | ✅ PASS | src/__tests__/api/ai.test.ts | error logged, response resolves, request continues |
| TC-GENPERF-W1-06 | unit | SSE done payload keys unchanged | ✅ PASS | src/__tests__/api/ai.test.ts | keys: {siteId, pageId, siteName, siteLanguage, totalBlocks, totalPages, timeMs} |
| TC-GENPERF-W1-07 | unit | after() throws → fallback invokes | ✅ PASS | src/__tests__/api/ai.test.ts | no request scope → void task() fallback works |

**Wave 1 Status:** ✅ **PASS** — 7/7 TC automated (5 route-level tests in ai.test.ts + 2 seeder tests). Empirical local evidence: imglib rows land +42→52s post-response (phase-02 report). Staging re-profile remains as deployment verification (phase-04 step 5, after merge).

---

## Wave 2 Test Stub (Phase 07 — TBD)

Parallel seeding architecture tests + concurrent request isolation. Not yet implemented.

| TC-ID | Level | Scenario | Status | Notes |
|---|---|---|---|---|
| TC-GENPERF-W2-01 | integration | concurrent gens don't corrupt shared seeders | 🔲 TODO | |
| TC-GENPERF-W2-02 | integration | concurrent after() calls queued correctly | 🔲 TODO | |
| TC-GENPERF-W2-03 | performance | time-to-done < 60s (JP high-product case) | 🔲 TODO | |
| TC-GENPERF-W2-04 | performance | seeds land post-done (created_at > done_ts) | 🔲 TODO | |
| TC-GENPERF-W2-05 | integration | cancel mid-seeding doesn't leak resources | 🔲 TODO | |
| TC-GENPERF-W2-06 | integration | seeder retry on transient failures | 🔲 TODO | |
| TC-GENPERF-W2-07 | integration | seeder logs include timing + diagnostics | 🔲 TODO | |
| TC-GENPERF-W2-08 | integration | Vercel deploy: after() queues on staging | 🔲 TODO | Staging re-profile |
| TC-GENPERF-W2-09 | performance | baseline comparison: 97.3s → <65s (VN+JP) | 🔲 TODO | |
| TC-GENPERF-W2-10 | integration | rollback safe: old seeds still work | 🔲 TODO | Backward compat |

---

## Test Run Results (2026-07-03 14:56 — after rewrite)

```
Test Files: 508 passed (508)
Tests:      9262 passed (9262)
Duration:   ~50s (wave1 isolated: 24.70s)
```

**Wave 1 tests added/modified:**
- `src/__tests__/api/ai.test.ts` — 5 route-level tests (TC-W1-01/02/05/06/07), real POST via existing harness
- `src/__tests__/unit/lib/images/image-library-seeder.test.ts` — +1 test (TC-GENPERF-W1-03)
- `src/__tests__/unit/lib/ai/seed-blog-posts.test.ts` — +1 test (TC-GENPERF-W1-04)

**Total Wave 1 coverage:** 7 TC automated (5 route-level + 2 seeder-level), 100% pass. W1-01 mutation-verified.

---

## Verification Checklist

- [x] All TC-GENPERF-W1-01..07 tests pass (vitest green)
- [x] Full test suite passes (9262 tests, 508 files)
- [x] Seeder idempotency verified (alt-key check, count skip)
- [x] Error handling verified (non-fatal, logged, request proceeds)
- [x] SSE payload shape unchanged (7 keys, correct types)
- [x] after() fallback tested (no request scope case)
- [x] Tests import from source, no re-implementation
- [x] TC-IDs in test names per convention

---

## Known Gaps & Future Work

**Wave 1 Limitations (by design):**
- No timing assertions in unit tests (await too fast, wall-clock unreliable)
- Full-route POST test uses mocked deps (route.ts is 2200 lines; heavy to mock fully)
- Re-profile (staging) is manual, not automated (in phase-05)

**Wave 2 Scope:**
- Performance benchmarks + concurrent request isolation (phase 05)
- Staging re-profile: EN/JP/VN actual time-to-done vs baseline
- Seed landing verification (created_at > done_ts)
- Rollback safety (old code still works with new seeds)

---

## Implementation Notes

**Route Changes (Phase 02-03, already merged):**
- `src/app/api/ai/generate-site/route.ts` ~1350: imglib seeding now via `after(_imglibSeedTask)` with try/catch fallback
- `src/app/api/ai/generate-site/route.ts` ~1323: blog seeding unchanged pattern, still via `after(_blogSeedTask)`

**Seeder Guarantees:**
- `seedImageLibraryForSite`: idempotent via alt-key prefix check, never throws (inner catch)
- `seedBlogPosts`: skips when tenant.blogs > 0, outer try/catch never throws

**Test Patterns:**
- Top-level `vi.mock()` for `next/server` after() function
- Capture callbacks, invoke manually to assert side effects
- Idempotency: track mock.calls.length before/after to verify no new work
- Error handling: spy on console to verify logging, assert task resolves

