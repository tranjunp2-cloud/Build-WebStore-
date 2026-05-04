# Test Plan: Monitoring & Error Tracking (Sentry)
> **Updated:** 2026-05-04 | **Role:** Test Engineer
> **Scope:** Sentry SDK integration — span helpers, error capture, environment tagging

---

## 1. Traceability Matrix

| Area | Coverage | TCs |
|:-----|:---------|----:|
| Sentry span helper (`withSentrySpan`) | Unit | 3 |
| Error capture (server/client/edge) | Manual staging | 4 |
| Environment tagging | Manual staging | 1 |

---

## 2. Unit Test Cases

| ID | Type | Title | Steps | Expected | Priority |
|:---|:-----|:------|:------|:---------|:--------:|
| **TC-MONITORING-01** | Unit | `withSentrySpan` returns inner function result | 1. Call `withSentrySpan('test', async () => 42)`<br>2. Await result | Result is `42`; `Sentry.startSpan` called with `{ name: 'test', op: 'ai' }` | High |
| **TC-MONITORING-02** | Unit | `withSentrySpan` propagates errors without swallowing | 1. Call `withSentrySpan('test', async () => { throw err })`<br>2. Await | Rejects with same error reference; no swallowing | High |
| **TC-MONITORING-03** | Unit | `withSentrySpan` passes correct name and op to Sentry | 1. Call `withSentrySpan('ai.generateSite', async () => null)`<br>2. Check `Sentry.startSpan` args | Called with `{ name: 'ai.generateSite', op: 'ai' }` | Medium |

---

## 3. Manual Staging Test Cases

| ID | Type | Title | Steps | Expected | Priority |
|:---|:-----|:------|:------|:---------|:--------:|
| **TC-MONITORING-04** | Manual | Server error captured in Sentry | 1. `GET /api/sentry-test` on staging<br>2. Check Sentry dashboard within 60s | HTTP 500 returned; Sentry event appears with `environment=staging` | High |
| **TC-MONITORING-05** | Manual | Source maps not exposed in production bundle | 1. `curl -I <staging-url>/_next/static/chunks/main-app.js.map` | HTTP 404 — no source map leaked | High |
| **TC-MONITORING-06** | Manual | Tunnel route proxies events | 1. POST to `<staging-url>/sentry-tunnel` with valid envelope | HTTP 200 or 400; no 3xx redirect | Medium |
| **TC-MONITORING-07** | Manual | AI generate span visible in Sentry Performance | 1. Trigger AI site generation on staging<br>2. Check Sentry Performance tab | Trace contains `ai.generateSite` span under the request | Medium |

---

## 4. Notes

- `/api/sentry-test` route is **temporary** — remove before merge to `main`
- `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` must be set in Vercel Dashboard for events to appear
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT` must match `SENTRY_ENVIRONMENT` for consistent tagging across server/client
