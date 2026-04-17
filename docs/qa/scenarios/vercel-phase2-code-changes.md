# Scenario Report: Phase 2 — Vercel Migration Code Changes

> **Generated:** 2026-04-09 | **Source:** ck:scenario (9/12 dimensions)
> **Plan:** `plans/260409-2011-vercel-migration/phase-02-code-changes.md`

**Dimensions analyzed:** User Types, Timing, State Transitions, Environment, Error Cascades, Authorization, Data Integrity, Integration, Business Logic
**Dimensions skipped:** Input Extremes (no new user input), Scale (Phase 6), Compliance (no data/privacy changes)

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|-----------|----------|----------|-------------------|
| 1 | User Types | Admin dùng /admin khi middleware deploy — routing thay đổi | High | Session giữ nguyên, no redirect loop |
| 2 | User Types | Bot hit SSE stream sau deprecation (maxDuration 300→60) | Medium | Timeout gracefully sau 60s |
| 3 | User Types | Service account gọi polling endpoint | Medium | Filtered correctly, no cross-tenant |
| 4 | Timing | db-setup.js --migrate-only timeout trong Vercel build | High | Complete < 30s, exit 0 |
| 5 | Timing | 2 Vercel instances chạy migrations cùng lúc | Critical | Idempotent (IF NOT EXISTS) |
| 6 | Timing | Polling 15s + slow network → overlapping fetches | High | Debounce/skip nếu previous chưa done |
| 7 | Timing | Notification delay up to 15s (SSE→polling trade-off) | Medium | Acceptable, document |
| 8 | Timing | Old client cached SSE code → EventSource reconnect | High | Stream route vẫn work (maxDuration=60) |
| 9 | State Transitions | Notification dropdown open khi polling refresh → flicker | Medium | No re-render nếu data unchanged |
| 10 | State Transitions | Tab hidden→visible → stale notification burst | High | Fetch latest on visibility, skip stale |
| 11 | State Transitions | --migrate-only xong nhưng pool not closed → process hang | Critical | pool.end() trước exit, timeout 10s |
| 12 | State Transitions | Build fail sau migrations → re-run safe? | High | Idempotent migrations → safe |
| 13 | State Transitions | Domain actions disabled → user try add domain | High | Clear "temporarily unavailable" message |
| 14 | Environment | Local dev no vercel.json → db-setup.js default mode | Medium | Without --migrate-only = Docker mode |
| 15 | Environment | output: 'standalone' still in next.config.ts | Low | Vercel overrides, no conflict |
| 16 | Environment | Mobile polling 15s drain battery | Medium | Pause when tab hidden |
| 17 | Error Cascades | Neon unreachable during --migrate-only → build fail | Critical | Retry 3x hoặc clear error |
| 18 | Error Cascades | Polling 500 error → setInterval keeps firing | High | Exponential backoff |
| 19 | Error Cascades | SSL strict + Neon cert rotation | High | Monitor post-deploy |
| 20 | Error Cascades | Middleware bỏ DO check → every request = DB domain lookup | High | Cache domain lookup |
| 21 | Error Cascades | BroadcastChannel error during tab close | Medium | try-catch, fallback local |
| 22 | Authorization | Polling endpoint no auth check → leak | Critical | JWT verify mandatory |
| 23 | Authorization | Cross-tenant notification leak | Critical | WHERE user_id AND tenant_id |
| 24 | Authorization | Domain API route still accessible after UI disable | High | Server-side check |
| 25 | Data Integrity | since timestamp timezone mismatch | High | Always UTC ISO |
| 26 | Data Integrity | since = future date → 0 notifications forever | Medium | Validate, fallback now-60s |
| 27 | Data Integrity | pg_notify fires with no SSE listener | Low | No-op, safe |
| 28 | Data Integrity | env.example remove DO vars but code still references | High | Grep verify |
| 29 | Integration | Vercel + CI both deploy → double deploy | Critical | Only one active |
| 30 | Integration | CI needs: dependency chain broken | High | Update ci.yml graph |
| 31 | Integration | Lark notify references DO staging URL | Medium | Update action.yml |
| 32 | Integration | Stripe webhook still DO URL | Medium | Phase 4 handles DNS |
| 33 | Business Logic | Polling 200 users = 384K invocations/day | High | Within Vercel Pro budget |
| 34 | Business Logic | Toast count mismatch with server | Medium | Sync unreadCount on poll |
| 35 | Business Logic | Domain disable → existing custom domains still work? | Medium | Yes, middleware routes OK |

## Summary
- Critical: 6 | High: 13 | Medium: 12 | Low: 4
- Total: 35 scenarios across 9 dimensions
