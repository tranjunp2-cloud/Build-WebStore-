---
type: baseline-interpretation
phase: 02
date: 2026-07-07
tester: em (anh Phuong review)
qc-url: https://ech-prime-web-v2-qc.vercel.app
---

# Phase 02 Baseline — Interpretation Report

Baseline runs trên QC env với Vercel Preview scope + branch=qc-test. Kết quả
cho Ngân (Ary) tham khảo trước khi cầm script chạy Phase 04 load test 200 VU.

## Runs summary

| Script | VU × Duration | Total requests | P95 (ms) | Error rate | Verdict |
|--------|--------------|----------------|----------|-----------|---------|
| `hello-world.js` | 10 × 30s | 225 | **594** | 0% | ✅ PASS |
| `baseline-unauth-endpoints.js` | 30 × 3m30s | 3696 | **232** | 0% | ✅ PASS |
| `login-flow-baseline.js` | 50 × 5m | — | — | — | ⏸ WAITING PR #1513 |

## Per-endpoint P95 (30 VU × 3m30s)

| Endpoint | P95 (ms) | Verdict vs plan target |
|----------|----------|-----------------------|
| `GET /` (landing) | 250 | < 400ms static target ✅ |
| `GET /login` | 232 | < 400ms static target ✅ |
| `GET /api/health` | 161 | < 800ms API target ✅ |

## Interpretation cho Ngân

### 1. Static pages nhanh (P95 ~250ms)

Landing + login page P95 ~250ms → **Vercel edge cache work tốt**. 200 concurrent
sẽ không problem cho static routes. Đây là baseline "green" để so sánh Phase 04.

### 2. API health rất nhanh (P95 161ms)

`/api/health` chỉ trả `{"status":"ok"}` — không hit DB, không auth. 161ms là round-
trip từ máy Ngân → Vercel Singapore → response. Baseline network + Vercel warm start.

### 3. Aggregate P95 232ms < threshold 1000ms

Threshold set 1000ms cho baseline unauth. Actual 232ms → **buffer 4x cho load
tăng lên**. Có headroom cho Phase 04 200 VU.

### 4. Hello-world P95 594ms > baseline unauth P95 250ms

Hai runs khác nhau, hello-world chạy cold (không prewarm), unauth có 30s prewarm.
Chênh 344ms = **cold start signature Vercel serverless** (đã ghi cheat sheet
`perf-testing-concepts.md` §5).

**Kết luận:** Phase 04 load test PHẢI có prewarm phase 5-10 phút. Không thì
metric bị polluted bởi cold start data.

### 5. Login flow chưa test được

Login flow baseline (`login-flow-baseline.js`) đang **waiting on PR #1513**
merge để env-driven OTP bypass live trên qc-test.

**Lý do:**
Current QC deploy dùng SQL-injected OTP hash single-use (cleared sau successful
verify). Load test 50 VU × 5 min = 3000+ iterations → sau iteration 10 đầu tiên,
tất cả 10 hashes bị clear → tất cả tiếp theo fail.

PR #1513 (Phase 01 tooling) ship env var `QC_OTP_BYPASS_ENABLED=true` — khi active,
handler /request-otp trả về code `123456` cố định và /verify-otp accept không giới
hạn. Load test sẽ work sau merge.

**Timeline:**
- Merge PR #1513 to staging
- Merge staging → qc-test branch
- Wait ~8 min CI deploy
- Verify: `curl POST /api/users/verify-otp` với qc-owner-1 chạy 2 lần liên tiếp không cần SQL re-inject
- Restore step 2 (/request-otp) trong `login-flow-baseline.js` (TODO comment inline)
- Re-run baseline

## Analysis chi tiết

### Cold start impact (từ hello-world data)

Hello-world CSV (225 requests) — first 30s no prewarm:
- Request 1-20: P50 400-800ms (cold)
- Request 20-100: P50 200-400ms (warming)
- Request 100+: P50 100-200ms (fully warm)

→ **Rule of thumb Phase 04:** skip first 60-90s data khi analyze CSV.

### Neon connection pool status

Baseline unauth không hit DB → pool không được stress. Phase 04 login flow sẽ
verify pool.max=25 (bumped trong PR #1513) đủ cho 200 VU.

**Watch metric Phase 04:**
- P95 spike đột ngột từ ~300ms → 2000ms khi VU vượt ngưỡng nào đó = pool exhaustion signature
- Neon dashboard connection count = sát 25 = phải upgrade Launch $15/mo

### Storefront routes 404 (side finding)

Trong lúc test phát hiện `/sites/qc-shop-1` + `/sites/qc-shop-1/products` cả 2
trả 404. Có thể:
1. Sites route mapping dùng `sites.domain` field không phải `tenant.slug`
2. Cần custom domain resolve
3. Seeded sites chưa published

→ Log GH issue `qa-baseline` P2 (không block event nhưng ảnh hưởng Phase 03
functional test suite). Ngân verify manually trong Phase 03 exploratory Session
3 (Builder canvas / Publish flow).

## Deliverables cho Ngân

Files ready trong repo (branch `feat/qc-02-baseline-scripts-and-docs`):

| File | Purpose |
|------|---------|
| `scripts/perf/hello-world.js` | Smoke test 30s — Ngân run Day 1 để verify k6 setup |
| `scripts/perf/baseline-unauth-endpoints.js` | 3-endpoint baseline 30 VU × 3m30s — Ngân run để reference |
| `scripts/perf/login-flow-baseline.js` | Ready for post-PR-#1513 (currently waiting on env bypass) |
| `docs/qa/perf-testing-concepts.md` | Ngân đọc trước khi cầm script (30 phút) |
| `docs/qa/k6-quickstart.md` | Ngân đọc song song hoặc khi cần |
| `docs/qa/exploratory-checklist-baseline.md` | 7-area manual test template |

CSVs:
- `reports/perf/baseline-unauth-260707-0958.csv` — raw data 3696 requests
- Hello-world CSV không save (chỉ smoke test, không cần archive)

## Gate check to Phase 03

**PASS criteria đã đạt:**
- k6 install v2.1.0 verified (Phase 01 output)
- 2 baseline scripts chạy được PASS (hello-world + unauth-endpoints)
- 1 interpretation report với concrete numbers
- 3 reference docs published

**Còn open:**
- Ngân verify tự chạy được scripts (không blocking em ship — Ngân có docs
  đầy đủ)
- Login flow baseline (deferred, non-blocking Phase 03)

## Next steps

1. **PR merge #1513** → env bypass live trên qc-test
2. **Sync qc-test branch** với staging mới
3. **Re-run login-flow-baseline.js** post-merge, add kết quả vào report này
4. **Ngân start Phase 02 async:**
   - Đọc `perf-testing-concepts.md` (30 phút)
   - Chạy `k6 run scripts/perf/hello-world.js` (verify local setup)
   - Chạy `k6 run scripts/perf/baseline-unauth-endpoints.js` (reproduce baseline)
   - So sánh kết quả local với report này (cùng ballpark → OK; khác nhiều → escalate anh)
5. **Ngân start Phase 03 song song:** exploratory manual từ
   `exploratory-checklist-baseline.md` Session 1

## Unresolved questions

1. Sites route 404 root cause — Ngân check Phase 03 Session 3-5 hay dev đào ngay?
2. Login flow baseline P95 target — plan set < 1200ms nhưng chưa có data confirm. Sau PR #1513 merge sẽ có real number.
3. Neon Free tier connection limit — actual capacity 200 VU chưa test. Phase 04 sẽ discover.
