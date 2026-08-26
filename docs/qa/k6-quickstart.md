---
owner: QC
audience: Ngân (Ary) + QA future hires
last_updated: 2026-07-07
---

# k6 Quickstart cho QC env

Hướng dẫn cài, chạy, đọc kết quả 2 k6 scripts đã có sẵn trong repo. Không
cần code từ đầu — chỉ chạy + đọc + hiểu.

**Prereq đã đọc:** [`perf-testing-concepts.md`](./perf-testing-concepts.md) — P50/P95/P99, error rate, cold start.

## 1. Cài k6 (5 phút)

### macOS
```bash
brew install k6
k6 version  # verify v0.50+
```

### Docker fallback (nếu brew fail)
```bash
docker pull grafana/k6:latest
docker run --rm grafana/k6 version
```

Sau bước này, chạy `k6 run script.js` là được.

## 2. Chạy hello-world (30 giây)

Script GET homepage đơn giản, 10 VU × 30s.

```bash
cd ~/ech-prime-web-v2
git checkout staging  # hoặc branch có scripts/perf/*
k6 run scripts/perf/hello-world.js
```

Terminal sẽ hiện progress bar rồi output block metrics cuối cùng.

**Cần chú ý 3 dòng:**
```
http_req_duration...: avg=250ms  ... p(95)=680ms  ← Đây là P95
http_req_failed.....: 0.00%   ✓ 0    ✗ 300       ← Error rate
http_reqs...........: 300    10/s                 ← Throughput
```

**Verdict:** Nếu P95 < 800ms và error 0% → env ổn, sẵn sàng cho login flow test.

## 3. Chạy login flow baseline (5 phút)

Script mô phỏng: POST /request-otp → POST /verify-otp → GET /dashboard.

Trước khi chạy, verify OTP bypass hoạt động:

```bash
curl -sS -X POST "https://ech-prime-web-v2-qc.vercel.app/api/users/request-otp" \
  -H "Content-Type: application/json" \
  -d '{"email":"qc-owner-1@primeweb.local"}'
# Expect: {"message":"If the email exists, an OTP has been sent."}

curl -sS -X POST "https://ech-prime-web-v2-qc.vercel.app/api/users/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"email":"qc-owner-1@primeweb.local","otp":"123456"}'
# Expect: {"message":"Auth Passed","user":{...},"token":"..."}
```

Nếu 2 curl trên trả OK → chạy k6 script:

```bash
k6 run scripts/perf/login-flow-baseline.js
```

Script sẽ:
1. Prewarm 1 phút (5 VU) để function ấm
2. Ramp 30s lên 50 VU
3. Hold 3 phút ở 50 VU
4. Ramp down 30s

Tổng ~5 phút.

**Verdict criteria:**
| Metric | PASS | CONCERN | FAIL |
|--------|------|---------|------|
| P95 login flow | < 800ms | 800-1500ms | > 1500ms |
| Error rate | < 1% | 1-3% | > 3% |
| Throughput | > 10 req/s | 5-10 req/s | < 5 req/s |

Nếu FAIL → ping anh Phuong Lark. Nếu CONCERN → save CSV, tiếp Phase 04.

## 4. Save CSV để track baseline

```bash
mkdir -p reports/perf
k6 run --out csv=reports/perf/baseline-$(date +%Y%m%d-%H%M).csv \
  scripts/perf/login-flow-baseline.js
```

CSV format:
```
metric_name,timestamp,metric_value,check,error,error_code,expected_response,group,method,name,proto,scenario,service,status,subproto,tls_version,url,vu,extra_tags
http_req_duration,1783350120,245.6,,,,true,,POST,http://.../request-otp,HTTP/2,default,,200,,tls1.3,https://.../request-otp,3,
...
```

Mỗi row = 1 measurement. Có thể mở Excel/Numbers xử lý.

## 4.1. Re-test GH-1640 PERF-01 / PERF-02 (Upload + autosave)

Script `scripts/perf/f05-upload-autosave-contention.js` tái hiện hai request
ghi chạy đồng thời trên **QC**: legacy fallback `POST /api/media/upload` và
`PATCH /api/sites/[siteId]/save`. Đây là regression test cho lỗi lịch sử trong
ticket #1640. Luồng editor hiện tại dùng `presign → S3 → register`; browser E2E
cho luồng đó nằm ở `tests/gh-1640-performance.spec.ts`.

Script tạo media test và cập nhật theme của site QC đã chọn. Nó từ chối mọi URL
khác QC alias hoặc localhost, vì vậy không thể chạy staging/production.

Chuẩn bị một site disposable thuộc về `qc-owner-1@primeweb.local`, lấy ID của
site đó, rồi chạy:

```bash
QC_SITE_ID=123 \
k6 run --out csv=reports/perf/f05-gh-1640-$(date +%Y%m%d-%H%M).csv \
  scripts/perf/f05-upload-autosave-contention.js
```

Mặc định script xác thực bằng QC OTP bypass (`qc-owner-1@primeweb.local` +
`123456`). Nếu bypass không sẵn sàng, truyền JWT tạm thời qua biến môi trường
`QC_AUTH_TOKEN`; không ghi token vào file hoặc commit. Script chạy 15 VU, hold
2 phút, và sleep 21 giây giữa các lượt để giữ một QC account dưới autosave rate
limit (60 request/phút/user).

**PASS:** upload P95 < 3s, autosave P95 < 3s, và cả hai success rate > 99%.
Summary tách riêng số HTTP 409, 429 và 5xx. HTTP 409 là contention có retry
được nhưng vẫn cần ghi lại để Dev kiểm tra Vercel/Neon logs; HTTP 429 nghĩa là
test bị rate-limit và phải chạy lại sau khi reset thời gian; HTTP 500 là tái
hiện lỗi ticket. Sau batch, reset/reseed QC để xóa media và thay đổi test:

```bash
set -a && . .env.qc-test && set +a
npm run db:reset-qc && npm run db:seed-qc
```

## 5. Đọc CSV đơn giản (không cần code)

```bash
# Xem tổng số requests
wc -l reports/perf/baseline-*.csv

# Filter chỉ dòng http_req_duration
grep "^http_req_duration" reports/perf/baseline-*.csv | wc -l

# Extract cột metric_value (3rd column) cho http_req_duration
grep "^http_req_duration" reports/perf/baseline-*.csv | awk -F',' '{print $3}' | head -20
```

Muốn tính P95 nhanh:

```bash
grep "^http_req_duration" reports/perf/baseline-*.csv | \
  awk -F',' '{print $3}' | sort -n | \
  awk 'BEGIN{c=0} {a[c++]=$1} END{print "P95:", a[int(c*0.95)]}'
```

**Đơn giản hơn:** Mở CSV trong Excel/Numbers → PivotTable → Percentile.INC(range, 0.95).

## 6. Cấu trúc script k6 (đọc để hiểu, không cần viết ngay)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

// 1. Options: cấu hình test scenario
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp-up
    { duration: '3m',  target: 50 },   // Hold
    { duration: '30s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],  // P95 phải < 800ms
    http_req_failed:   ['rate<0.01'],  // Error rate < 1%
  },
};

// 2. Setup: chạy 1 lần trước khi VUs start
export function setup() {
  console.log('Warming up...');
}

// 3. Default function: mỗi VU chạy hàm này lặp lại
export default function () {
  const res = http.get('https://ech-prime-web-v2-qc.vercel.app/');
  check(res, {
    'status 200': (r) => r.status === 200,
    'body has PrimeWeb': (r) => r.body.includes('PrimeWeb'),
  });
  sleep(3);  // Think time 3s
}

// 4. Teardown: chạy 1 lần sau khi VUs stop
export function teardown() {
  console.log('Done.');
}
```

## 7. Khi nào bị stuck — escalate

| Vấn đề | Tự fix trước | Escalate anh Phuong |
|--------|--------------|---------------------|
| `k6: command not found` | brew install k6 | Sau 15 min brew vẫn fail |
| Script chạy nhưng P95 tăng đột ngột | Restart QC deploy (push commit trống) | Sau 30 min vẫn tăng |
| Error rate > 10% | Check `/api/health` trả gì; verify OTP curl | Sau 15 min không hiểu |
| CSV file rỗng | Check `k6 run` exit code, tail stderr | Sau 10 min không parse được |
| Not sure PASS/FAIL | Tự đọc CSV, chạy awk P95 command | Confidence < 70% |

**Nguyên tắc:** stuck 15-30 min → ping anh Phuong Lark DM. Không tự cày 2 giờ mất thời gian cả team.

## 8. Reference

- k6 official docs: https://grafana.com/docs/k6/latest/
- Cheat sheet concepts: [`perf-testing-concepts.md`](./perf-testing-concepts.md)
- Runbook: [`qc-test-runbook.md`](./qc-test-runbook.md)
- Env setup: [`jmeter-qc-env.md`](./jmeter-qc-env.md)
- Plan: [`plans/260706-1653-GH-02-qa-performance-testing-plan/`](../../plans/260706-1653-GH-02-qa-performance-testing-plan/)
