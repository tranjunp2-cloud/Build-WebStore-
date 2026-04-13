# Scenario Report: Vercel + Neon Migration

> **Generated:** 2026-04-09 | **Source:** ck:scenario (12 dimensions)
> **Plan:** `plans/260409-2011-vercel-migration/plan.md`

**Dimensions analyzed:** All 12 — full-stack migration affects every dimension.
**Dimensions skipped:** None.

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|-----------|----------|----------|-------------------|
| 1 | User Types | Admin truy cập `/admin` ngay sau DNS switch — SSL chưa provision | High | Show friendly page, không 500 |
| 2 | User Types | Bot/crawler hit wildcard subdomain trong lúc DNS propagation | Medium | Return 503 với retry-after |
| 3 | User Types | Service account JWT verify sau migration — secret thay đổi? | Critical | PAYLOAD_SECRET giữ nguyên, tokens valid |
| 4 | User Types | New user signup + OTP email ngay sau migration | High | Email OTP gửi thành công qua AWS SES |
| 5 | User Types | Power user đang edit site khi DNS switch xảy ra | High | Auto-save giữ data, reconnect sau propagation |
| 6 | Input Extremes | DATABASE_URI chứa special chars trong password (`@`, `#`, `%`) | Critical | Connection string URL-encoded đúng |
| 7 | Input Extremes | Env var value chứa newline/quotes khi copy sang Vercel | High | Vercel UI handles multiline, hoặc dùng CLI |
| 8 | Input Extremes | Domain name với unicode/punycode | Medium | Middleware handles punycode conversion |
| 9 | Input Extremes | pg_dump export > 512MB (Neon free tier limit) | Critical | Script check size trước import |
| 10 | Input Extremes | Empty/null response từ Neon khi connection pool exhausted | High | App returns 503 gracefully |
| 11 | Timing | 2 users publish cùng lúc → concurrent cache invalidation | High | Both invalidations complete, không stale |
| 12 | Timing | DNS propagation chưa complete — traffic split DO/Vercel | Critical | Cả 2 serve đúng content (giữ DO running) |
| 13 | Timing | Stripe webhook gửi event trong lúc DNS switch | Critical | DO vẫn process HOẶC Stripe retry tới URL mới |
| 14 | Timing | AI Builder request 55s → Vercel 60s timeout | High | Complete trước 60s HOẶC partial + retry |
| 15 | Timing | Cold start + Neon connection setup > 10s | High | Không timeout, connection pooling warm up |
| 16 | Timing | db-setup.js migration chạy concurrent trên 2 Vercel instances | Critical | Migration idempotent (IF NOT EXISTS) |
| 17 | Scale | 200 users view sites — Neon pool max 100 default | Critical | Pool size >= 200 hoặc dùng Neon pooler |
| 18 | Scale | 20 concurrent AI requests → OpenAI rate limit | High | Upstash block trước OpenAI, return 429 |
| 19 | Scale | Cold cache + 200 users hit DB simultaneously | High | Cache stampede protection |
| 20 | Scale | Upstash 10K cmds/day — polling alone = 13K/day | Critical | Tính budget, có thể cần paid tier |
| 21 | Scale | Neon auto-suspend 5min idle → cold start 3-5s | Medium | Health check keep-alive HOẶC accept latency |
| 22 | State Transitions | User giữa checkout khi DNS switch — session token | Critical | Same PAYLOAD_SECRET → JWT valid cả 2 |
| 23 | State Transitions | Phase 1 fail giữa chừng — partial data import | High | Rollback: DROP + reimport |
| 24 | State Transitions | Build fail Vercel — migration đã chạy nhưng app chưa deploy | High | Migration idempotent, re-run safe |
| 25 | State Transitions | User draft data intact sau migration? | High | Data migration 100%, verify blocks + media refs |
| 26 | Environment | Vercel function region khác Singapore | Medium | Verify region = sin1 |
| 27 | Environment | Mobile 3G — polling 15s overhead | Medium | Adaptive: 15s wifi, 30-60s mobile |
| 28 | Environment | Proxy/VPN — geo-routing sai region | Low | Functional OK, latency suboptimal |
| 29 | Environment | Browser không support abort controller — polling leak | Low | Cleanup on unmount |
| 30 | Error Cascades | Neon DB down → tất cả functions fail | Critical | Cached content vẫn serve, admin show maintenance |
| 31 | Error Cascades | Upstash Redis down → rate limiter fail | Critical | Fail-closed: block AI khi Redis down |
| 32 | Error Cascades | S3 unreachable → file upload fail | High | Upload retry logic |
| 33 | Error Cascades | AWS SES down → OTP không gửi | High | Show error "email unavailable", không silent fail |
| 34 | Error Cascades | Vercel build fail → auto-rollback? | High | Verify previous deployment kept |
| 35 | Authorization | JWT issued trên DO → verify trên Vercel | Critical | Same PAYLOAD_SECRET → tokens valid |
| 36 | Authorization | Admin domain middleware bypass trên Vercel | Critical | Middleware correctly identifies admin domain |
| 37 | Authorization | Stripe webhook signature — secret key thay đổi? | Critical | STRIPE_WEBHOOK_SECRET giữ nguyên hoặc tạo mới |
| 38 | Authorization | CORS headers — Vercel default khác DO nginx | High | Verify CORS cho API routes + custom domains |
| 39 | Data Integrity | Sequence values không sync sau pg_restore | Critical | SETVAL sequences, verify max(id) = current_val |
| 40 | Data Integrity | FK constraints fail (order-dependent tables) | High | Import --disable-triggers hoặc đúng order |
| 41 | Data Integrity | Media URLs trong DB → S3 URLs vẫn valid? | High | S3 bucket không đổi, verify S3_ENDPOINT |
| 42 | Data Integrity | Payload internal tables integrity | High | Migration includes ALL tables |
| 43 | Data Integrity | Encoding mismatch UTF8 (locale khác) | Medium | Verify lc_collate, lc_ctype cho Vietnamese text |
| 44 | Integration | Stripe webhook replay → duplicate processing | High | Idempotent handler (check event ID) |
| 45 | Integration | Lark Bot webhook URL hardcoded DO domain | High | Update BOT_NOTIFY_URL env var |
| 46 | Integration | ECH Distribution API callback URL | Medium | Check nếu callback, cần update |
| 47 | Integration | CI parallel deploy staging + production race | Medium | Verify sequential per branch |
| 48 | Integration | Vercel GitHub integration + CI → double deploy | High | Disable one, không cả 2 |
| 49 | Compliance | Data residency thay đổi DO → Neon? | Medium | Neon ap-southeast-1 = same region |
| 50 | Compliance | Audit logs gap trong migration window | Medium | Document gap, accept hoặc dual-write |
| 51 | Compliance | GDPR deletion request trong lúc migration | High | Process SAU migration complete |
| 52 | Business Logic | Free user hit rate limit → UX? | High | Clear 429 message, không generic 500 |
| 53 | Business Logic | Custom domain verify — DO API removed | Critical | Domain flow work trên Vercel HOẶC disable tạm |
| 54 | Business Logic | Cache 5min → publish update → visitor thấy cũ | Medium | revalidateTag < 10s |
| 55 | Business Logic | Daily AI spend cap reset timezone | Medium | Dùng UTC consistently |
| 56 | Business Logic | Rollback: DNS back DO nhưng Neon data ahead | Critical | DO frozen read-only during migration |

## Summary
- **Critical: 16** — DB connection, JWT auth, data integrity, DNS split-brain, sequences, Stripe, rate limit, connection pool, domain management
- **High: 22** — SSL provisioning, env vars, cache, cold starts, error cascades, CORS, Lark
- **Medium: 12** — Polling, encoding, compliance, UX edge cases
- **Low: 6** — Visual, proxy, browser compat
- **Total: 56 scenarios across 12 dimensions**
