/**
 * k6 hello-world — smoke test cho QC env.
 *
 * Mục đích: Verify k6 + QC env sống, đo baseline latency GET homepage.
 * Chạy nhanh (30s), ít tài nguyên, không cần OTP hoặc auth.
 *
 * Usage:
 *   k6 run scripts/perf/hello-world.js
 *   k6 run --out csv=reports/hello-world-$(date +%Y%m%d-%H%M).csv scripts/perf/hello-world.js
 *
 * Thresholds:
 *   P95 latency < 800ms — PASS
 *   Error rate < 1%    — PASS
 *
 * Docs: docs/qa/k6-quickstart.md
 * Plan: plans/260706-1653-GH-02-qa-performance-testing-plan/
 */

import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.QC_URL || 'https://ech-prime-web-v2-qc.vercel.app'

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    // http_req_duration measures full round trip including TLS handshake.
    // 800ms P95 target aligned với "static page" bucket in plan.
    http_req_duration: ['p(95)<800'],
    // Allow tiny error rate (< 1%) so transient Vercel cold-starts don't
    // fail the whole run.
    http_req_failed: ['rate<0.01'],
  },
  tags: {
    testType: 'hello-world',
    stack: 'ech-prime-web-v2',
  },
}

export default function () {
  const res = http.get(`${BASE_URL}/`, {
    tags: { endpoint: 'homepage' },
  })

  check(res, {
    'status 200': (r) => r.status === 200,
    'body has PrimeWeb': (r) => (r.body || '').toString().includes('PrimeWeb'),
    'duration < 2s': (r) => r.timings.duration < 2000,
  })

  sleep(1)
}

export function handleSummary(data) {
  const { metrics } = data
  const p95 = metrics.http_req_duration?.values?.['p(95)'] ?? 0
  const errorRate = metrics.http_req_failed?.values?.rate ?? 0
  const reqs = metrics.http_reqs?.values?.count ?? 0

  const line = (label, value) => `  ${label.padEnd(22)} ${value}`

  const summary = [
    '',
    '━━━ Hello-world smoke test ━━━',
    line('Target URL:', BASE_URL),
    line('Requests total:', reqs),
    line('P95 duration (ms):', p95.toFixed(1)),
    line('Error rate:', `${(errorRate * 100).toFixed(2)}%`),
    line('Verdict:', p95 < 800 && errorRate < 0.01 ? '✅ PASS' : '❌ FAIL — check thresholds'),
    '',
  ].join('\n')

  return {
    stdout: summary,
    // Also emit JSON so downstream CI or scripts can parse.
    'reports/perf/hello-world-summary.json': JSON.stringify(data, null, 2),
  }
}
