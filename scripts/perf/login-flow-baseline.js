/**
 * k6 login flow baseline — 50 VU × ~5 min.
 *
 * ⚠ WAITING ON PR #1513 (env-driven OTP bypass) — do NOT run against
 *   qc-test yet.
 *
 * Current QC deploy uses SQL-injected OTP hashes that are single-use
 * (`otp_hash` cleared after first successful verify). Load test needs
 * env-driven bypass where /request-otp returns the fixed code every
 * time and /verify-otp accepts it repeatedly. That behaviour ships with
 * PR #1513 → staging → merged into qc-test.
 *
 * Once PR #1513 lands:
 *   1. Sync qc-test branch: `git checkout qc-test && git merge staging && git push`
 *   2. Wait ~8 min for CI deploy
 *   3. Verify env: curl POST /api/users/verify-otp works twice in a row
 *      for the same qc-owner-1 without SQL re-inject
 *   4. Restore step 2 (/request-otp) — see TODO(post-#1513) below
 *   5. Run: `k6 run scripts/perf/login-flow-baseline.js`
 *
 * Flow mô phỏng real user (after PR #1513):
 *   1. GET /login (page load)
 *   2. POST /api/users/request-otp
 *   3. POST /api/users/verify-otp (dùng bypass code 123456)
 *   4. GET /api/health với JWT (verify token work)
 *
 * VU ramp: prewarm 5 VU × 1 min → ramp 30s tới 50 VU → hold 3 min → ramp down 30s.
 *
 * Usage:
 *   k6 run scripts/perf/login-flow-baseline.js
 *   k6 run --out csv=reports/perf/login-baseline-$(date +%Y%m%d-%H%M).csv scripts/perf/login-flow-baseline.js
 *
 * Env vars:
 *   QC_URL         — override target (default https://ech-prime-web-v2-qc.vercel.app)
 *   QC_OTP_CODE    — override OTP (default 123456)
 *
 * Thresholds (verdict PASS):
 *   Login flow P95 < 1200ms
 *   Error rate < 1%
 *
 * Docs: docs/qa/k6-quickstart.md
 * Plan: plans/260706-1653-GH-02-qa-performance-testing-plan/
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.QC_URL || 'https://ech-prime-web-v2-qc.vercel.app'
const OTP_CODE = __ENV.QC_OTP_CODE || '123456'

// Rotate through the 10 seeded QC accounts. Uses VU index modulo so each
// concurrent VU picks a different account and we don't hammer OTP rate
// limits on a single user.
const QC_ACCOUNTS = [
  'qc-admin-1@primeweb.local',
  'qc-admin-2@primeweb.local',
  'qc-owner-1@primeweb.local',
  'qc-owner-2@primeweb.local',
  'qc-owner-3@primeweb.local',
  'qc-owner-4@primeweb.local',
  'qc-owner-5@primeweb.local',
  'qc-staff-1@primeweb.local',
  'qc-staff-2@primeweb.local',
  'qc-staff-3@primeweb.local',
]

// Custom metrics — visible in k6 summary block for easier debugging.
const loginFlowDuration = new Trend('login_flow_duration_ms')
const loginSuccessRate  = new Rate('login_success_rate')

export const options = {
  stages: [
    { duration: '1m',  target: 5 },   // Prewarm — ấm Vercel functions
    { duration: '30s', target: 50 },  // Ramp up
    { duration: '3m',  target: 50 },  // Hold
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    // Full login flow (3 sequential requests) should complete P95 < 1200ms.
    login_flow_duration_ms: ['p(95)<1200'],
    // Individual HTTP requests should stay under 800ms P95.
    http_req_duration: ['p(95)<800'],
    // Error rate strictest — auth failures leak session tokens.
    http_req_failed: ['rate<0.01'],
    // Login success is the higher-level SLO.
    login_success_rate: ['rate>0.99'],
  },
  tags: {
    testType: 'login-flow-baseline',
    stack: 'ech-prime-web-v2',
  },
}

export default function () {
  const email = QC_ACCOUNTS[__VU % QC_ACCOUNTS.length]
  const flowStart = Date.now()
  let ok = true

  group('login flow', () => {
    // Step 1 — page load (measures cold TTFB + JS bundle)
    const loginPage = http.get(`${BASE_URL}/login`, {
      tags: { step: 'get-login-page' },
    })
    ok = ok && check(loginPage, {
      'login page 200': (r) => r.status === 200,
    })

    // Step 2 — request OTP (SKIPPED until PR #1513 merges).
    //
    // Current QC deploy still has SQL-injected OTP hash on all
    // qc-*@primeweb.local users (expires_at = now+24h). Hitting
    // /request-otp regenerates a random OTP and updates the hash,
    // invalidating our fixed "123456" bypass code. Once the env-driven
    // bypass ships (`QC_OTP_BYPASS_ENABLED=true` — PR #1513), the
    // request-otp handler will return the fixed code and this step
    // becomes safe to enable again.
    //
    // For today's baseline, skip step 2 and call verify-otp directly.
    //
    // TODO(post-#1513): restore full 3-step flow when env bypass live.

    // Step 3 — verify OTP with bypass code
    const verifyRes = http.post(
      `${BASE_URL}/api/users/verify-otp`,
      JSON.stringify({ email, otp: OTP_CODE }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { step: 'verify-otp' },
      },
    )
    ok = ok && check(verifyRes, {
      'verify-otp 200': (r) => r.status === 200,
      'has JWT token':  (r) => {
        try {
          const body = r.json()
          return body && typeof body.token === 'string' && body.token.length > 20
        } catch (e) {
          return false
        }
      },
    })

    // Extract token (best-effort — if verify failed, skip step 4)
    let token = ''
    try {
      token = (verifyRes.json() || {}).token || ''
    } catch { /* ignore */ }

    // Step 4 — authed health check (verify JWT parses)
    if (token) {
      const healthRes = http.get(`${BASE_URL}/api/health`, {
        headers: { Authorization: `JWT ${token}` },
        tags: { step: 'authed-health' },
      })
      ok = ok && check(healthRes, {
        'health 200': (r) => r.status === 200,
      })
    }
  })

  const flowDuration = Date.now() - flowStart
  loginFlowDuration.add(flowDuration)
  loginSuccessRate.add(ok ? 1 : 0)

  // Real user think time between logins.
  sleep(3)
}

export function handleSummary(data) {
  const { metrics } = data
  const p95Flow  = metrics.login_flow_duration_ms?.values?.['p(95)'] ?? 0
  const p95Http  = metrics.http_req_duration?.values?.['p(95)'] ?? 0
  const errRate  = metrics.http_req_failed?.values?.rate ?? 0
  const successR = metrics.login_success_rate?.values?.rate ?? 0
  const reqs     = metrics.http_reqs?.values?.count ?? 0

  const line = (label, value) => `  ${label.padEnd(28)} ${value}`
  const pass = p95Flow < 1200 && errRate < 0.01 && successR > 0.99

  const summary = [
    '',
    '━━━ Login flow baseline ━━━',
    line('Target URL:', BASE_URL),
    line('Total requests:', reqs),
    line('P95 login flow (ms):', p95Flow.toFixed(1)),
    line('P95 individual HTTP (ms):', p95Http.toFixed(1)),
    line('HTTP error rate:', `${(errRate * 100).toFixed(2)}%`),
    line('Login success rate:', `${(successR * 100).toFixed(2)}%`),
    line('Verdict:', pass ? '✅ PASS' : '❌ FAIL — check thresholds'),
    '',
  ].join('\n')

  return {
    stdout: summary,
    'reports/perf/login-flow-summary.json': JSON.stringify(data, null, 2),
  }
}
