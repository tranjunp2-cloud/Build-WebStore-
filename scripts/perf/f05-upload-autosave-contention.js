/**
 * GH-1640 PERF-01 / PERF-02 — legacy media upload + autosave contention.
 *
 * Reproduces the reported F05 failure mode: concurrent binary uploads to the
 * legacy Payload fallback route run at the same time as editor autosaves for
 * one site. The normal editor path is direct S3 upload (presign -> S3 ->
 * register), so this is a regression test for the historical GH-1640 route,
 * not an end-user direct-upload benchmark.
 *
 * This script writes test media and updates the configured QC site. Never run
 * it against staging or production.
 *
 * Required:
 *   QC_SITE_ID=<QC site id>
 * Optional authentication (the token is never printed):
 *   QC_AUTH_TOKEN=<Payload or QC OTP JWT>
 * Or let setup obtain a QC OTP JWT:
 *   QC_EMAIL=qc-owner-1@primeweb.local QC_OTP_CODE=123456
 *
 * Run:
 *   QC_SITE_ID=123 k6 run scripts/perf/f05-upload-autosave-contention.js
 *
 * The default fixture is a real PNG committed in public/. It is about 31 KB,
 * close enough to exercise the reported 48 KB-logo path without adding a
 * generated binary fixture to the repository.
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

const BASE_URL = (__ENV.QC_URL || 'https://ech-prime-web-v2-qc.vercel.app').replace(/\/$/, '')
const SITE_ID = __ENV.QC_SITE_ID || ''
const QC_EMAIL = __ENV.QC_EMAIL || 'qc-owner-1@primeweb.local'
const OTP_CODE = __ENV.QC_OTP_CODE || '123456'
const PROVIDED_TOKEN = __ENV.QC_AUTH_TOKEN || ''
const IMAGE_BYTES = open('../../public/assets/builder/builder-logo.png', 'b')

const uploadDuration = new Trend('upload_duration_ms', true)
const autosaveDuration = new Trend('autosave_duration_ms', true)
const uploadSuccessRate = new Rate('upload_success_rate')
const autosaveSuccessRate = new Rate('autosave_success_rate')
const autosaveConflictResponses = new Counter('autosave_conflict_responses')
const autosaveRateLimitResponses = new Counter('autosave_rate_limit_responses')
const serverErrorResponses = new Counter('server_error_responses')

function isSafeTarget(url) {
  // k6's JavaScript runtime does not expose the browser URL global.
  const hostname = url.replace(/^https?:\/\//, '').split('/')[0].split(':')[0]
  return hostname === 'ech-prime-web-v2-qc.vercel.app'
    || hostname === 'localhost'
    || hostname === '127.0.0.1'
}

if (!SITE_ID) {
  throw new Error('QC_SITE_ID is required. Use a disposable site owned by QC_EMAIL.')
}

if (!isSafeTarget(BASE_URL)) {
  throw new Error('Refusing a non-QC target. Only the QC alias and localhost are permitted.')
}

export const options = {
  stages: [
    { duration: '15s', target: 15 },
    { duration: '2m', target: 15 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    upload_duration_ms: ['p(95)<3000'],
    autosave_duration_ms: ['p(95)<3000'],
    upload_success_rate: ['rate>0.99'],
    autosave_success_rate: ['rate>0.99'],
  },
  tags: {
    testType: 'f05-upload-autosave-contention',
    ticket: 'GH-1640',
  },
}

export function setup() {
  if (PROVIDED_TOKEN) return { token: PROVIDED_TOKEN }

  const response = http.post(
    `${BASE_URL}/api/users/verify-otp`,
    JSON.stringify({ email: QC_EMAIL, otp: OTP_CODE }),
    { headers: { 'Content-Type': 'application/json' }, tags: { step: 'authenticate' } },
  )

  let token = ''
  try {
    token = response.json('token') || ''
  } catch {
    // The error below intentionally avoids logging response content or credentials.
  }

  if (response.status !== 200 || typeof token !== 'string' || token.length < 20) {
    throw new Error(`QC authentication failed (${response.status}). Check the QC OTP bypass and account.`)
  }

  return { token }
}

export default function ({ token }) {
  // Both routes currently authenticate via the Payload cookie, rather than the
  // Authorization header, so use the same cookie shape as the browser client.
  // A cookie-authenticated write also needs the same-host Origin a browser sends (TC-PERF-162).
  const headers = { Cookie: `payload-token=${token}`, Origin: BASE_URL }
  const file = http.file(IMAGE_BYTES, `gh-1640-vu-${__VU}-iter-${__ITER}.png`, 'image/png')
  const uploadBody = { file, alt: `GH-1640 VU ${__VU} iteration ${__ITER}` }
  const autosaveBody = JSON.stringify({
    theme: { primaryColor: __VU % 2 === 0 ? '#0f766e' : '#1d4ed8' },
  })

  // Batch starts both writes together. This is the intentional contention that
  // PERF-02 describes; do not serialize these requests.
  const [uploadResponse, autosaveResponse] = http.batch([
    ['POST', `${BASE_URL}/api/media/upload`, uploadBody, {
      headers,
      tags: { endpoint: 'media_upload', operation: 'upload' },
    }],
    ['PATCH', `${BASE_URL}/api/sites/${SITE_ID}/save`, autosaveBody, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      tags: { endpoint: 'site_autosave', operation: 'autosave' },
    }],
  ])

  const uploadOK = check(uploadResponse, {
    'upload returns 2xx': (response) => response.status >= 200 && response.status < 300,
  })
  const autosaveOK = check(autosaveResponse, {
    'autosave returns 2xx': (response) => response.status >= 200 && response.status < 300,
  })

  uploadDuration.add(uploadResponse.timings.duration)
  autosaveDuration.add(autosaveResponse.timings.duration)
  uploadSuccessRate.add(uploadOK ? 1 : 0)
  autosaveSuccessRate.add(autosaveOK ? 1 : 0)
  if (autosaveResponse.status === 409) autosaveConflictResponses.add(1)
  if (autosaveResponse.status === 429) autosaveRateLimitResponses.add(1)
  if (uploadResponse.status >= 500) serverErrorResponses.add(1)
  if (autosaveResponse.status >= 500) serverErrorResponses.add(1)

  // One shared QC identity is used so every VU can access the same disposable
  // site. At 21 seconds, 15 VUs make at most 45 saves/minute, below the route
  // limit of 60 saves/minute/user while retaining concurrent writes.
  sleep(21)
}

export function handleSummary(data) {
  const metrics = data.metrics
  const p95 = (metric) => (metrics[metric]?.values?.['p(95)'] ?? 0).toFixed(1)
  const rate = (metric) => `${((metrics[metric]?.values?.rate ?? 0) * 100).toFixed(2)}%`
  const count = (metric) => metrics[metric]?.values?.count ?? 0
  const pass = Number(p95('upload_duration_ms')) < 3000
    && Number(p95('autosave_duration_ms')) < 3000
    && (metrics.upload_success_rate?.values?.rate ?? 0) > 0.99
    && (metrics.autosave_success_rate?.values?.rate ?? 0) > 0.99

  return {
    stdout: [
      '',
      '━━━ GH-1640 F05 upload/autosave contention ━━━',
      `  Target URL:                 ${BASE_URL}`,
      `  Upload P95 (ms):            ${p95('upload_duration_ms')}`,
      `  Autosave P95 (ms):          ${p95('autosave_duration_ms')}`,
      `  Upload success rate:        ${rate('upload_success_rate')}`,
      `  Autosave success rate:      ${rate('autosave_success_rate')}`,
      `  Autosave 409 conflicts:     ${count('autosave_conflict_responses')}`,
      `  Autosave 429 rate limits:   ${count('autosave_rate_limit_responses')}`,
      `  HTTP 5xx responses:         ${count('server_error_responses')}`,
      `  Verdict:                    ${pass ? '✅ PASS' : '❌ FAIL — inspect 4xx/5xx and Vercel logs'}`,
      '',
    ].join('\n'),
    'reports/perf/f05-upload-autosave-summary.json': JSON.stringify(data, null, 2),
  }
}
