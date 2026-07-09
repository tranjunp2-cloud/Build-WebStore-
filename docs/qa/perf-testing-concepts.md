---
owner: QC
audience: Ngân (Ary) + QA future hires
last_updated: 2026-07-07
---

# Performance Testing Concepts — Cheat sheet

Tài liệu tham khảo tự đọc (30 phút) trước khi cầm k6 script. Nội dung áp dụng
trực tiếp cho stack ech-prime-web-v2 (Next.js + Payload + Neon serverless).

## 1. Bốn loại test (test type)

| Loại | Mục đích | Thời lượng | Ví dụ ECH |
|------|---------|-----------|-----------|
| **Load** | Đo hệ thống chịu được bao nhiêu user "bình thường" | 5-15 phút | 200 user đồng thời chạy login → dashboard trong 10 phút |
| **Stress** | Đẩy tới giới hạn để tìm điểm gãy (breaking point) | Ramp 50→500 users | Bao nhiêu VU thì error rate > 5% hoặc P95 > 2s? |
| **Soak (Endurance)** | Chạy load steady dài để tìm memory leak / DB bloat | 30 phút – 2 giờ | 150 VU × 90 phút, watch RAM Vercel + Neon connections |
| **Spike** | Traffic burst đột ngột (marketing campaign) | 30s ramp | 0 → 500 VU trong 30s (rồi hold 2 phút) |

**Beta event 200 user 1 ngày → chủ yếu Load + Soak.** Stress + Spike làm buffer safety, không phải target.

## 2. Metric quan trọng

### Response time (latency)

Thời gian server trả kết quả 1 request. Đo bằng millisecond (ms).

- **P50 (median)** — 50% requests dưới ngưỡng này. "Trung bình experience."
- **P95** — 95% requests dưới ngưỡng. "Trải nghiệm xấu nhưng chưa tệ." **← metric quan trọng nhất**
- **P99** — 99% requests dưới ngưỡng. "Trải nghiệm tệ nhất chấp nhận được."
- **Max** — worst case, thường có outlier (cold start, GC pause) → không quá lo

**Target ECH:**
- API endpoints: P95 < 800ms, P99 < 1500ms
- Static pages: P95 < 400ms
- DB-heavy (gen site, product listing): P95 < 1200ms

### Error rate

% requests trả HTTP 4xx/5xx hoặc timeout.

- **Target:** < 1% acceptable, < 0.1% ideal
- **0% không thực tế** — có OTP expire, session timeout, upstream flake

### Throughput (RPS — requests per second)

Số request server xử lý mỗi giây. Đo capacity.

- 200 VU × avg 3s think time = ~66 req/s
- Static homepage ~2000 req/s Vercel edge
- API auth endpoint ~200 req/s baseline (Neon Free tier)

### Concurrent users (VU — Virtual Users)

k6 khái niệm: mỗi VU là 1 người dùng ảo, mỗi VU tại 1 thời điểm thực hiện 1 request. VU ≠ req/s.

## 3. Thuật ngữ hay nhầm

| Thuật ngữ | Nghĩa | Ví dụ |
|-----------|------|-------|
| **Ramp-up** | Thời gian tăng dần số VU từ 0 → target | 30s ramp-up 200 VU = mỗi giây thêm ~7 VU |
| **Hold / Sustain** | Giữ mức VU cố định | 10 phút hold ở 200 VU |
| **Ramp-down** | Giảm dần VU về 0 | Tránh cắt đột ngột (skewed final metrics) |
| **Think time** | Thời gian VU chờ giữa 2 requests | Real user click → đọc → click tiếp = ~3-5s |
| **Cold start** | Vercel function lần đầu invoke sau idle → chậm | Thường 200-800ms extra ở request đầu |
| **Warmup** | Trước test chính, gửi requests dummy để function ấm | 5-10 phút prewarm 5 VU |
| **Baseline** | Kết quả run "state ổn định" để so sánh sau | Baseline P95 = 400ms → nếu tăng > 600ms sau fix code = regression |
| **Breaking point** | Điểm hệ thống bắt đầu fail (error > 5% hoặc P95 > 2s) | 350 VU |

## 4. Áp dụng flow ECH — 4 định nghĩa nhanh

### Load
> "200 concurrent user chạy login → dashboard trong 10 phút, giữ steady, đo P95 và error rate."

Verdict: PASS nếu P95 < 800ms API, error rate < 1%.

### Stress
> "Ramp 50 → 100 → 200 → 350 → 500 VU, mỗi mức 3 phút. Tìm mức nào error rate > 5% hoặc P95 > 2s = breaking point."

Verdict: Ghi lại breaking point số. Beta event 200 → chỉ cần breaking point > 300 (buffer 50%).

### Soak
> "150 VU × 90 phút (75% target load) — quan sát Neon connection count, Vercel function memory, Upstash Redis eviction."

Verdict: RAM Vercel không tăng monotonic, Neon connections không exhaust pool, Redis miss rate ổn định.

### Spike
> "0 → 500 VU trong 30s, hold 2 phút, ramp down 30s. Đo error spike + recovery time."

Verdict: Error rate spike acceptable trong 30s đầu, phải recover < 1% trong 60s.

## 5. Cold start — Vercel serverless gotcha

Vercel functions auto-suspend sau idle (~5 phút không traffic). Request đầu sau suspend = cold start (200-800ms extra).

**Baseline test workflow:**
1. **Prewarm 5-10 phút** với 5 VU trước main run — đảm bảo function ấm
2. Chạy main test — data đã reflect steady state
3. Ignore first 10-15s data (still ramping)

**KHÔNG làm:** Chạy cold, đo cả cold + warm, cãi nhau về P99. Waste time.

## 6. Neon serverless pool

Neon Postgres serverless mở connection pool ~20 (Free) hoặc 50+ (Launch).

- **Pool exhaustion signature:** P95 jump từ 200ms → 2000ms đột ngột khi VU tăng
- **Fix:** Bump `pool.max` trong `src/payload.config.ts` (đã bump 10 → 25 trong PR #1513) OR upgrade Launch $15/mo

## 7. Đọc kết quả k6 CLI output

Khi `k6 run` xong, terminal hiện block metrics:

```
     data_received..................: 12 MB   1.2 MB/s
     data_sent......................: 156 kB  16 kB/s
     http_req_blocked...............: avg=1.85ms  min=1µs   med=6µs   max=800ms  p(90)=13µs   p(95)=14µs
     http_req_connecting............: avg=800µs   ...
     http_req_duration..............: avg=250ms   min=45ms  med=210ms max=2.3s   p(90)=450ms  p(95)=680ms   ← ĐÂY
     http_req_failed................: 0.20%   ✓ 3     ✗ 1497                                                ← ĐÂY
     http_req_receiving.............: avg=1ms     ...
     http_req_sending...............: avg=100µs   ...
     http_req_tls_handshaking.......: avg=2ms     ...
     http_req_waiting...............: avg=245ms   ...
     http_reqs......................: 1500    150/s                                                          ← ĐÂY
     iteration_duration.............: avg=1.25s   ...
     iterations.....................: 1500    150/s
     vus............................: 10      min=10  max=10
     vus_max........................: 10      min=10  max=10
```

3 dòng quan trọng nhất:
- **`http_req_duration` p(95)** → latency P95
- **`http_req_failed`** → error rate
- **`http_reqs`** → throughput RPS

## 8. Tài nguyên đọc thêm (optional)

- k6 official docs: https://grafana.com/docs/k6/latest/ — bookmark, chỉ đọc khi cần
- YouTube "Load Testing k6 Tutorial" — 30-45 phút intro video (dùng subtitle nếu tiếng Anh)
- ARDURA 2026 Load Testing Guide — https://ardura.consulting/blog/load-testing-complete-guide-2026/ (bản giới thiệu concepts)

**Đừng đọc quá 1 giờ.** Ngân cứ chạy `scripts/perf/hello-world.js` (Phase 02 deliverable) sẽ hiểu nhanh hơn đọc lý thuyết.

## Related

- Runbook: [`qc-test-runbook.md`](./qc-test-runbook.md)
- Setup env: [`jmeter-qc-env.md`](./jmeter-qc-env.md)
- k6 quickstart: [`k6-quickstart.md`](./k6-quickstart.md)
- Plan: [`plans/260706-1653-GH-02-qa-performance-testing-plan/`](../../plans/260706-1653-GH-02-qa-performance-testing-plan/)
