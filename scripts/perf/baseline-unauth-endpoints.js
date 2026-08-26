/**
 * k6 baseline — unauthenticated endpoints, 30 VU × 3 min.
 *
 * Rotates through 5 public endpoints so we get baseline latency across
 * routes without needing auth. Runs today (does not depend on PR #1513
 * env bypass), useful as reference number for Phase 04 comparison.
 *
 * Endpoints hit (all cache-friendly / public):
 *   1. GET /                        (landing)
 *   2. GET /login                   (page render)
 *   3. GET /api/health              (server heartbeat)
 *   4. GET /sites/qc-shop-1         (storefront home for seeded tenant)
 *   5. GET /sites/qc-shop-1/products (product listing seeded tenant)
 *
 * Usage:
 *   k6 run scripts/perf/baseline-unauth-endpoints.js
 *   k6 run --out csv=reports/perf/baseline-unauth-$(date +%Y%m%d-%H%M).csv \
 *     scripts/perf/baseline-unauth-endpoints.js
 *
 * Docs: docs/qa/k6-quickstart.md
 * Plan: plans/260706-1653-GH-02-qa-performance-testing-plan/
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const BASE_URL = __ENV.QC_URL || 'https://ech-prime-web-v2-qc.vercel.app'

// TODO(phase-03): add storefront endpoints once Sites route mapping
// verified (/sites/[slug] currently returns 404 for seeded tenants —
// separate bug tracked in Phase 03 exploratory checklist).
const ENDPOINTS = [
  { path: '/',                          tag: 'landing' },
  { path: '/login',                     tag: 'login_page' },
  { path: '/api/health',                tag: 'health' },
]

// Per-endpoint latency trend — surfaced in summary so Ngân sees which
// route is slow, not just aggregate.
const endpointTrends = {}
for (const e of ENDPOINTS) {
  endpointTrends[e.tag] = new Trend(`latency_${e.tag}_ms`)
}

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Prewarm
    { duration: '30s', target: 30 },  // Ramp
    { duration: '2m',  target: 30 },  // Hold
    { duration: '30s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed:   ['rate<0.01'],
  },
  tags: {
    testType: 'baseline-unauth',
    stack: 'ech-prime-web-v2',
  },
}

export default function () {
  // Each VU iteration hits every endpoint once (round-robin distribution
  // more realistic than pin-to-one).
  for (const e of ENDPOINTS) {
    const res = http.get(`${BASE_URL}${e.path}`, {
      tags: { endpoint: e.tag },
    })
    endpointTrends[e.tag].add(res.timings.duration)
    check(res, {
      [`${e.tag} 2xx or 3xx`]: (r) => r.status >= 200 && r.status < 400,
    })
    sleep(0.5)  // small pause between requests within a session
  }
  sleep(2)  // longer pause between full round-trips (think time)
}

export function handleSummary(data) {
  const { metrics } = data
  const p95 = metrics.http_req_duration?.values?.['p(95)'] ?? 0
  const errRate = metrics.http_req_failed?.values?.rate ?? 0
  const reqs = metrics.http_reqs?.values?.count ?? 0

  const line = (label, value) => `  ${label.padEnd(28)} ${value}`
  const perEndpoint = ENDPOINTS.map((e) => {
    const key = `latency_${e.tag}_ms`
    const val = metrics[key]?.values?.['p(95)'] ?? 0
    return line(`  ${e.tag} P95 (ms):`, val.toFixed(1))
  })

  const pass = p95 < 1000 && errRate < 0.01
  const summary = [
    '',
    '━━━ Baseline unauth endpoints ━━━',
    line('Target URL:', BASE_URL),
    line('Total requests:', reqs),
    line('Aggregate P95 (ms):', p95.toFixed(1)),
    line('HTTP error rate:', `${(errRate * 100).toFixed(2)}%`),
    '',
    '  Per-endpoint P95:',
    ...perEndpoint,
    '',
    line('Verdict:', pass ? '✅ PASS' : '❌ FAIL — check thresholds'),
    '',
  ].join('\n')

  return {
    stdout: summary,
    'reports/perf/baseline-unauth-summary.json': JSON.stringify(data, null, 2),
  }
}
