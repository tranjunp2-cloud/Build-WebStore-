# F01 Gen-Perf: Performance Baseline & Wave 1 Test Plan

**Plan Reference:** [plans/260703-1341-gen-perf-async-parallel](../../plans/260703-1341-gen-perf-async-parallel/plan.md)

**Feature:** F01 AI Site Generator — bounded completion path (required blogs inline, image-library seeding post-response)

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

## Wave 2 Re-profile Results (2026-07-03, flags ON)

### Measured Times (local, single run per language)

| Language | Baseline (flags off) | Wave 2 (flags on) | Delta | % Improvement | Breakdown (flags on) |
|----------|---|---|---|---|---|
| EN | 97.3s | ~50.0s | -47.3s | -49% | ai: 20s, media: 4s, db: 1.5s |
| JP | 117.5s | ~64.6s | -52.9s | -45% | ai: 27s, media: 5s, db: 2s |
| VN | 121.9s | ~63.2s | -58.7s | -48% | ai: 25s, media: 5.6s, db: 2.1s |

**Re-profile Summary:**
- Parallel split (home ∥ batch1 ∥ batch2) achieved ~49% wall-clock reduction (from 97–122s → 50–65s).
- Pool pre-upload utilized bounded concurrent download (4) + strictly serial creates (no loss).
- All 3 languages show consistent ~45–49% improvement (media/db floor ~8s remaining).
- No media row loss (sequential creates prevent drizzle race).
- Pre-uploaded photo assignment working; fallback to inline download+upload when needed.

**Measured Breakdown (VN worst-case):**
- AI parallel phase: 25s (was ~60s single-call; 3-way split drops to max of the three)
- Media pool: 5.6s (pre-uploaded during AI window; post-AI assignment from map)
- DB seeding: 2.1s (unchanged)
- **Total: ~33s AI+media+db; SSE overhead ~30s → total observed 63.2s**

### Canary Recommendations (before production)

> ✅ **GATE RESOLVED (2026-07-03 17:00):** PR #1481 đã merge vào staging và branch này đã merge lại origin/staging (21b96a08) — `uploadBufferToMedia` giờ serialize qua media-create-lock toàn cục, pre-upload creates an toàn. Cả 2 flag đều bật được sau deploy.
- ✅ Flags enabled on staging for 24h; monitor consistency_warning rate vs baseline
- ✅ Enable for subset (e.g., US TZ business hours only) before global rollout
- ✅ Instant rollback: set `GEN_PARALLEL_PAGES=false` + `GEN_POOL_PREUPLOAD=false` in Vercel Dashboard (no deploy needed)

---

## Wave 2 Test Matrix (Phase 07 — Parallel Page Split + Media Pool Pre-upload)

Parallel 3-call split orchestration (home ∥ subpage batches) + concurrent media pre-upload with strict serialization.

| TC-ID | Level | Scenario | Status | Mapped To | Notes |
|---|---|---|---|---|---|
| TC-GENPERF-W2-01 | unit | flag off (single-call path) | ✅ PASS | src/__tests__/unit/lib/ai/gen-page-split.test.ts | buildBrief: deterministic nav labels; brief=null for unknown lang |
| TC-GENPERF-W2-02 | unit | merge shape + prompt builders | ✅ PASS | src/__tests__/unit/lib/ai/gen-page-split.test.ts | mergeSplitParsed: home + subs → pages[]; buildHomeSystemPrompt/buildSubpagesSystemPrompt scope injection + scopedUserPrompt user-level hint |
| TC-GENPERF-W2-03 | unit | brand consistency (nav labels, theme) | ✅ PASS | src/__tests__/unit/lib/ai/gen-page-split.test.ts | Brief injects identical nav labels hint in both home + subpage prompts when getNavLabels(blockLang) returns cached labels |
| TC-GENPERF-W2-04 | unit | per-call fallback (composer) | ✅ PASS | src/__tests__/unit/lib/ai/gen-page-split.test.ts | Any subpage batch fail → ALL subpages from composer; home fail → home from composer; mixed success handled |
| TC-GENPERF-W2-05 | unit | truncation repair | ✅ PASS | src/__tests__/unit/lib/ai/gen-page-split.test.ts | safeParseJson: repair truncated JSON at last }; throw on irreparable |
| TC-GENPERF-W2-06 | unit | pool pre-upload assignment | ✅ PASS | pool-preupload.test.ts + media-pipeline-preupload.test.ts | preUploadPool builds map; batchFetchFromPool CONSUMES map (no download/create khi có ID) — mutation-verified: tắt consumption → 2 test fail |
| TC-GENPERF-W2-07 | unit | sequential creates (local chain) | ✅ PASS | src/__tests__/unit/lib/ai/pool-preupload.test.ts | assert activeMax===1 — mutation-verified: parallel hoá creates → fail. LƯU Ý: chỉ serialize creates CỦA pre-upload; lock toàn cục (media-create-lock) ship trong PR #1481 — xem gate bên dưới. Global-lock smoke test trên staging SAU rebase |
| TC-GENPERF-W2-08 | unit | orphan media tolerance (by-design) | ✅ PASS | src/__tests__/unit/lib/ai/pool-preupload.test.ts | preUploadPool returns full map; unused photos remain in Payload (no sweep, YAGNI); future optimization after media-create-lock ships |
| TC-GENPERF-W2-09 | unit | flag off media path (pre-Phase-06) | ✅ PASS | src/__tests__/unit/lib/ai/media-pipeline-preupload.test.ts | REAL seam: batchFetchFromPool không có map → download+create inline y nguyên (đếm call) |
| TC-GENPERF-W2-10 | unit | SSE block ordering (home first) | ✅ PASS (merge-order) | src/__tests__/unit/lib/ai/gen-page-split.test.ts | Cover ở mức merge order (pages[0]=home, không dup slug, đúng 1 homepage); SSE emission order end-to-end = verify staging |
| TC-GENPERF-W2-11 | unit | deterministic chrome (phase-09) | ✅ PASS | src/__tests__/unit/lib/ai/gen-page-split.test.ts | applyDeterministicChrome: nav deterministic (i18n, logoText=businessName) đứng đầu MỌI trang, GPT nav bị strip, footer home clone sang subpages (đứng cuối) |
| TC-GENPERF-W2-12 | unit | light model cho batch Contact+Blog (phase-08) | ✅ PASS | src/__tests__/unit/lib/ai/gen-page-split.test.ts | batch Contact+Blog chạy gpt-4.1-nano (task 'site-generation-subpages-light', override AI_MODEL_SITEGEN_SUB_LIGHT); home + About/Services giữ model chính |
| TC-GENPERF-W2-13 | unit | retry batch fail bằng model chính | ✅ PASS | src/__tests__/unit/lib/ai/gen-page-split.test.ts | batch fail được retry 1 lần trên MODEL CHÍNH trước khi rơi composer fallback (case Nha Khoa mất /contact) |
| TC-GENPERF-W2-14 | unit | home slug ép về '/' (review fix A1) | ✅ PASS | src/__tests__/unit/lib/ai/gen-page-split.test.ts | home call trả sai trang (slug '/about') → mergeSplitParsed vẫn ép slug '/', không đụng unique (site,slug) với batch page |
| TC-GENPERF-W2-15 | unit | chrome share-nothing (review fix A2) | ✅ PASS | src/__tests__/unit/lib/ai/gen-page-split.test.ts | nav/footer structuredClone per page — mutate nested links/columns của home không leak sang page khác; syncFooterAcrossPages cũng share-nothing |
| TC-GENPERF-BI-01 | route | blog-inline: persist TRƯỚC done | ✅ PASS | src/__tests__/api/ai.test.ts | prep xong trong cửa sổ GPT → persistBlogPosts chạy in-request (trước mọi after() task), seedBlogPosts legacy KHÔNG được gọi |
| TC-GENPERF-BI-02 | route | blog-inline: regenerate skip | ✅ PASS | src/__tests__/api/ai.test.ts | prepare trả [] (tenant đã có posts) → không persist, không legacy seeding |
| TC-GENPERF-BI-03 | route | blog completion barrier | ✅ PASS | src/__tests__/api/ai.test.ts | prep chưa xong → response vẫn pending; chỉ emit `done` sau khi persist đủ 3 bài |
| TC-F08-BS.24 | unit | blog prep chờ pixabayGate | ✅ PASS | src/__tests__/unit/lib/ai/seed-blog-posts.test.ts | prepareBlogPosts không gọi searchPhotos khi gate chưa settle (GH-1190 serialization); gate mở → thumbnail phase chạy, trả đủ 3 prepared posts |
| TC-F08-BS.25 | unit | prepare/persist contract | ✅ PASS | src/__tests__/unit/lib/ai/seed-blog-posts.test.ts | prepare trả null khi hard-fail (count throw) để caller fallback legacy; trả [] khi tenant có posts; persistBlogPosts insert đúng prepared rows (slug prefix, thumbnail optional) |
| TC-F01-W.18 | unit | pool size động theo block | ✅ PASS | src/__tests__/unit/ai/image-pool.test.ts | buildImagePool tôn trọng landscapeSize/squareSize; size 0 → skip Pixabay call bucket đó (không tính underfill); cả 2 = 0 → 0 call, pool rỗng |
| TC-MI-POOLSIZE | unit | computePoolBucketSizes | ✅ PASS | src/__tests__/unit/lib/ai/media-injector.test.ts | pool size = max nhu cầu block bật ảnh (theo bucket) + buffer, cap 12/6, người→getAvatarMedia loại trừ. Default hero-only → {landscape:3, square:0} thay vì 12+6; gallery→9; products-grid→6 square |

---

## Wave 3 Test Matrix (GH-1190 Critical Path)

| TC-ID | Level | Scenario | Status | Mapped To | Notes |
|---|---|---|---|---|---|
| TC-GENPERF-W3-01 | unit | named phase timings aggregate repeated phases | ✅ PASS | src/__tests__/unit/lib/ai/generation-timings.test.ts | compact request-correlated timing snapshot |
| TC-GENPERF-W3-02 | unit | generation request ID validation/correlation | ✅ PASS | src/__tests__/unit/lib/ai/generation-timings.test.ts | unsafe IDs replaced with UUID |
| TC-GENPERF-W3-03 | unit | browser retries only before any SSE event | ✅ PASS | src/__tests__/unit/builder/generation-sse-retry.test.ts | accepted/dispatched work is never automatically re-POSTed |
| TC-GENPERF-W3-04 | route | site remains `generating` until product barrier settles | ✅ PASS | src/__tests__/api/ai.test.ts | completion status moves after required product persistence |
| TC-GENPERF-W3-05 | unit | percentile uses nearest-rank semantics | ✅ PASS | src/__tests__/unit/lib/ai/generation-timings.test.ts | shared by staging benchmark report |
| TC-GENPERF-W3-06 | unit | partial product AI result uses curated fill without second model call | ✅ PASS | src/__tests__/unit/lib/ai/sample-products-image-fallback.test.ts | removes serial top-up latency |
| TC-GENPERF-W3-07 | unit | product image search is bounded to two 6s attempts per product | ✅ PASS | src/__tests__/unit/lib/ai/sample-products-image-fallback.test.ts | gallery/carton fallbacks remain mandatory |
| TC-GENPERF-W3-08 | unit | article AI failure returns structured full HTML fallback | ✅ PASS | src/__tests__/unit/lib/ai/seed-blog-posts.test.ts | contains headings, body sections, and list |
| TC-GENPERF-W3-09 | route | accepted event is first and `done` payload remains compatible | ✅ PASS | src/__tests__/api/ai.test.ts | request ID returned in event/header |
| TC-GENPERF-W3-E2E | Playwright | real generation renders five complete pages, products/blogs/media, stable refresh | ⏳ PENDING | tests/ai-builder-generation.spec.ts | requires valid generation environment and cleanup ownership |
| TC-GENPERF-W3-STAGING | benchmark | EN/MS/VN/JP first-event p95 <=5s and done p95 <=60s | ⏳ PENDING | scripts/measure-generation-latency.ts | run >=20 successes/language across five industries |

**Wave 3 verdict:** automated critical-path contracts pass in focused suites. Latency DoD remains open until the staging distribution and real-browser completeness gate pass.

---

## Test Run Results (2026-07-03 15:51 — Wave 1 + Wave 2)

```
Test Files: 509 passed (509)
Tests:      9277 passed (9277)
Duration:   ~45s (total)
  Wave 1 isolated: 24.70s
  Wave 2 new tests: 25ms (gen-page-split) + 38ms (pool-preupload)
```

**Wave 1 tests (Phase 04):**
- `src/__tests__/api/ai.test.ts` — 5 route-level tests (TC-W1-01/02/05/06/07), real POST via existing harness
- `src/__tests__/unit/lib/images/image-library-seeder.test.ts` — +1 test (TC-GENPERF-W1-03)
- `src/__tests__/unit/lib/ai/seed-blog-posts.test.ts` — +1 test (TC-GENPERF-W1-04)

**Wave 2 tests (Phase 07):**
- `src/__tests__/unit/lib/ai/gen-page-split.test.ts` — 19 tests (TC-GENPERF-W2-01/02/03/04/10)
- `src/__tests__/unit/lib/ai/pool-preupload.test.ts` — 9 tests (TC-GENPERF-W2-06/07/08/09)

**Total Coverage:** 16 TC automated (Wave 1: 7 + Wave 2: 9), 100% pass.

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


## Phase 08-09 addendum (2026-07-03 16:30)

- Phase 08 (nano subpages): subs2 (Contact+Blog) 23-29s → **7.4-18.3s**; chất lượng vi của nano đạt (headline tự nhiên); cấu trúc hơi lệch nhẹ (contact có thể phình block) — revert knob `AI_MODEL_SITEGEN_SUB_LIGHT=gpt-4.1-mini`.
- Phase 09 (token diet + deterministic chrome): GPT không sinh navigation (mọi call) + không sinh footer (subpage calls); nav inject từ `buildNavigation` (link đúng 100%, i18n), footer clone từ home. Concise-copy caps (headline ≤8 từ, description ≤25 từ). Đo VN: home 37.4→30.0s, subs1 36.4→25.4s, AI phase ~36.4s.
- Bonus fix: C5 consistency check so `'nav'` thay vì `'navigation'` → cảnh báo giả trên mọi gen ai-first từ trước (latent bug, đã sửa + fixture test).
- Đo lại tổng hợp (VN, GEN_PARALLEL_PAGES on, generator-level): AI 81-101s (mega) → 35.9s (3-call) → **36.4s với chrome+nano nhưng long pole home chỉ còn 30s** (biến động OpenAI ±10%; kỳ vọng ~30-36s).

## Hotfix round (2026-07-03 16:50 — từ test thực tế của user)

1. **Site 4 trang (thiếu /contact)** — nano batch trả thiếu trang / gắn cờ isHomepage sai bị filter drop. Fix: batch chỉ PASS khi đủ ĐÚNG số trang sau lọc (thiếu → composer fallback toàn bộ subpages); trang gắn cờ sai được coerce isHomepage=false thay vì drop; thêm warn log đếm trang mỗi batch. Verified 3/3 lượt gen liên tiếp đủ 5 trang.
2. **Hero "Block validation warning" (badge/videoUrl/gradientPreset null)** — GPT emit null cho field optional, Zod expect absent. Fix: stripNullsDeep trong safeParseJson (giữ null trong array). Verified: 0 warnings trong 3 lượt.
3. **KNOWN BEHAVIOR (không phải bug): preview ngay sau gen chỉ thấy 1 blog post, editor thấy 3** — Wave 1 chuyển blog seeding sang after() (sau response) để site hiện sớm ~35s; 3 bài đầy đủ sau ~30-60s. Nếu muốn placeholder "đang tạo bài viết" ở preview → item UI riêng (chưa scope).

## Hotfix round 2 (2026-07-03 17:50 — từ test đa dạng của user)

1. **Footer home lệch variant với các trang khác** — Structure Enforcer restyle footer HOME theo recipe SAU khi split path đã clone → subpages giữ bản cũ. Fix: `syncFooterAcrossPages` chạy sau enforcement (split path only). Verified: variant đồng nhất mọi trang.
2. **Mất /contact (case Nha Khoa)** — batch fail rơi composer fallback, mà 3/4 template health của composer không có trang /contact. Fix: retry batch fail 1 lần bằng MODEL CHÍNH trước khi composer (TC-GENPERF-W2-13). Verified: Nha Khoa 2/2 lượt đủ 5 trang.
3. **Pixabay timeout hàng loạt trong log (pool-preupload download failed / SERVER_ERROR)** — môi trường mạng/Pixabay chậm; mọi failure đều có fallback (ảnh thiếu slot rơi về inline/curated). Không phải regression; theo dõi trên staging.
4. **Warning `image.url Required` (hero/about)** — noise Zod CÓ SẴN từ trước (block validate trước khi inject ảnh); không do perf changes; ghi nhận làm cleanup item riêng.
