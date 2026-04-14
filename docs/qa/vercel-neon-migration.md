# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: Vercel + Neon Migration
> **Phiên bản:** 1.0 | **Cập nhật:** 2026-04-09 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** Migration Plan (`plans/260409-2011-vercel-migration/plan.md`), 6 Phase specs, 56 Edge Case Scenarios
> **Kỹ năng ứng dụng:** DB Migration Validation, Infrastructure Smoke Testing, Load Testing (k6), DNS Verification, Security Regression

---

## 1. Mục Tiêu (Objective)

Đảm bảo migration từ DigitalOcean App Platform → Vercel Pro + Neon PostgreSQL + Upstash Redis:
- **Data integrity 100%** — không mất data, sequences đúng, FK intact
- **Zero downtime** — DNS switch transparent, rollback plan tested
- **Performance ready** — 200 concurrent users, p95 < 2s
- **Security maintained** — JWT, CORS, Stripe webhooks, rate limiting

Bộ kiểm thử: **78 test cases** (Critical: 20, High: 30, Medium: 20, Low: 8) covering 6 phases + 56 edge case scenarios.

---

## 2. Test Environment (Môi trường Kiểm thử)

| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Vercel Preview → Vercel Staging → Vercel Production |
| Database | Neon PostgreSQL 16 (ap-southeast-1, Singapore) |
| Cache | Upstash Redis (ap-southeast-1) |
| Browsers | Chrome (v110+), Firefox (v105+), Safari |
| Devices | Desktop (1920x1080), Mobile (iPhone 14 Pro 375px) |
| Load Test Tool | k6 (200 concurrent, 5 min duration) |
| DNS | AWS Route 53 |
| Domains | `web-v2.dev.ecommercehub.my`, `web-cms-v2.dev.ecommercehub.my`, `*.web-v2.dev.ecommercehub.my` |

---

## 3. Test Strategy

| Loại Test | Tools | Coverage Target | Phase |
|-----------|-------|-----------------|-------|
| **Data Migration** | psql, pg_dump/restore | 100% tables, rows, sequences | Phase 1 |
| **Smoke Test** | Manual + Playwright | All critical paths | Phase 3, 6 |
| **Integration** | Manual | Stripe, S3, SES, Lark, ECH API | Phase 4, 6 |
| **DNS/SSL** | dig, curl, browser | All 3 domains + wildcard | Phase 4 |
| **Performance** | k6 load test | 200 concurrent, p95 < 2s | Phase 6 |
| **Security Regression** | Manual | JWT, CORS, rate limit, webhook sig | Phase 5, 6 |
| **Rollback** | Manual | DNS revert < 5 min | Phase 4 |

---

## 4. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Data loss during migration** | Critical | Low | pg_dump --no-owner, verify row counts per table |
| **Sequence desync → duplicate IDs** | Critical | Medium | SETVAL after import, verify max(id) per table |
| **DNS split-brain (partial propagation)** | Critical | Medium | Giữ DO running 2 tuần, same PAYLOAD_SECRET |
| **Neon connection pool exhausted (200 users)** | Critical | High | Neon pooler endpoint, pool_mode=transaction |
| **Upstash 10K cmds/day exceeded** | High | High | Calculate budget: polling + cache + rate limit |
| **Vercel 60s function timeout (AI Builder)** | High | Medium | maxDuration=60, SSE→Polling migration |
| **Stripe webhook miss during DNS switch** | High | Medium | Stripe auto-retry 72h, verify event processing |
| **Cold start + Neon suspend = slow first request** | Medium | High | Accept 3-5s cold start, health check warmup |
| **Custom domain verify broken (DO API removed)** | Critical | High | Implement Vercel API hoặc disable tạm |
| **CORS mismatch Vercel vs DO nginx** | High | Medium | Explicit CORS headers in API routes |

---

## 5. Unified Test Cases (Traceability Matrix)

### Phase 1: Database Migration (Neon Setup)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC & DỮ LIỆU | KẾT QUẢ MONG ĐỢI | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **DB Migration — Neon Setup** |
| **TC-MIG.01** | AC-P1-01 | Func | **[Positive]** Neon connection string valid | **1.** Lấy conn string từ Neon dashboard<br>**2.** `psql $NEON_URL -c "SELECT version()"` | **THEN** PostgreSQL 16 version returned, no SSL error | Blocker | [ ] |
| **TC-MIG.02** | AC-P1-04, Scenario #6 | Sec | **[Positive]** SSL strict mode connection | **1.** Connect với `sslmode=require`<br>**2.** Connect với `rejectUnauthorized: true` trong Node.js | **THEN** Both connections succeed, no SELF_SIGNED_CERT error | Blocker | [ ] |
| **TC-MIG.03** | AC-P1-02 | Func | **[Positive]** Data export from DO | **1.** `pg_dump --no-owner --no-privileges -Fc do_db > backup.dump`<br>**2.** Verify file size < 512MB | **THEN** Dump file created, size logged | High | [ ] |
| **TC-MIG.04** | AC-P1-03, Scenario #9 | Func | **[Positive]** Data import to Neon | **1.** `pg_restore -d $NEON_URL backup.dump`<br>**2.** Check for errors in output | **THEN** Import completes, 0 critical errors | Blocker | [ ] |
| **TC-MIG.05** | AC-P1-03, Scenario #39 | Data | **[Critical]** Row count verification | **1.** `SELECT count(*) FROM users` trên DO<br>**2.** `SELECT count(*) FROM users` trên Neon<br>**3.** Repeat cho: sites, pages, products, orders, media, blocks | **THEN** Row counts match 100% cho ALL tables | Blocker | [ ] |
| **TC-MIG.06** | Scenario #39 | Data | **[Critical]** Sequence sync verification | **1.** Cho mỗi table: `SELECT max(id) FROM {table}`<br>**2.** `SELECT last_value FROM {table}_id_seq`<br>**3.** SETVAL nếu mismatch | **THEN** max(id) <= sequence last_value cho ALL tables | Blocker | [ ] |
| **TC-MIG.07** | Scenario #40 | Data | **[Negative]** FK constraint integrity | **1.** `SELECT count(*) FROM pages WHERE site_id NOT IN (SELECT id FROM sites)`<br>**2.** Repeat cho all FK relationships | **THEN** 0 orphan records | High | [ ] |
| **TC-MIG.08** | Scenario #42 | Data | **[Positive]** Payload internal tables | **1.** Verify tables exist: `payload_locked_documents`, `payload_preferences`, `payload_migrations`<br>**2.** Check `payload_locked_documents_rels`, `payload_preferences_rels` | **THEN** All Payload internal tables present + populated | High | [ ] |
| **TC-MIG.09** | Scenario #43 | Data | **[Edge]** Vietnamese text encoding | **1.** `SELECT name FROM users WHERE name ~ '[àáảãạ]' LIMIT 5`<br>**2.** Compare output với DO source | **THEN** Vietnamese diacritics preserved correctly | Medium | [ ] |
| **TC-MIG.10** | AC-P1-06 | Func | **[Positive]** Neon free tier usage | **1.** Check Neon dashboard: storage usage<br>**2.** Verify < 512MB | **THEN** Usage within free tier limit | Medium | [ ] |

### Phase 2: Code Changes (Docker Removal + SSE→Polling)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC & DỮ LIỆU | KẾT QUẢ MONG ĐỢI | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **Code Changes** |
| **TC-CODE.01** | AC-P2-02 | Func | **[Positive]** db-setup.js --migrate-only | **1.** `DATABASE_URI=$NEON_URL node scripts/db-setup.js --migrate-only`<br>**2.** Check exit code | **THEN** Exit code 0, migrations applied, process exits within 30s | Blocker | [x] |
| **TC-CODE.02** | AC-P2-01 | Func | **[Positive]** npm run build with Neon | **1.** Set DATABASE_URI to Neon conn string<br>**2.** `npm run build` | **THEN** Build succeeds, no compilation errors | Blocker | [x] |
| **TC-CODE.03** | AC-P2-04, Scenario #16 | Func | **[Positive]** Migration idempotency | **1.** Run `db-setup.js --migrate-only` twice consecutively<br>**2.** Check for errors on 2nd run | **THEN** 2nd run succeeds, no duplicate table/column errors (IF NOT EXISTS) | Blocker | [x] |
| **TC-CODE.04** | AC-P2-08 | Sec | **[Positive]** No DO references in code | **1.** `grep -r "ondigitalocean.app" src/`<br>**2.** `grep -r "DO_API_TOKEN\|DO_APP_ID" src/`<br>**3.** `grep -r "hostname === '0.0.0.0'" src/` | **THEN** 0 matches for all patterns | High | [x] |
| **TC-CODE.05** | AC-P2-06, AC-P2-07 | Func | **[Positive]** Polling endpoint works | **1.** Login → get JWT<br>**2.** `GET /api/notifications?since=2026-01-01T00:00:00Z`<br>**3.** Create a notification<br>**4.** `GET /api/notifications?since={now-1min}` | **THEN** Step 2: returns array. Step 4: includes new notification | High | [x] |
| **TC-CODE.06** | Scenario #14 | Perf | **[Edge]** API route maxDuration check | **1.** `grep -r "maxDuration" src/app/api/`<br>**2.** Verify ALL routes have maxDuration <= 60 | **THEN** No route exceeds 60s (Vercel Pro limit) | High | [x] |
| **TC-CODE.07** | AC-P2-05 | Func | **[Positive]** SSE route deprecated | **1.** Check `src/app/api/notifications/stream/route.ts` exists or removed<br>**2.** If exists, verify maxDuration <= 60 | **THEN** SSE deprecated or constrained to Vercel limits | Medium | [x] |
| **TC-CODE.08** | Scenario #48 | Func | **[Edge]** No double deploy (Vercel + CI) | **1.** Check Vercel project settings: Git integration<br>**2.** Check ci.yml deploy steps | **THEN** Only ONE deploy mechanism active (not both) | High | [ ] |

### Phase 3: Vercel Setup + Deploy

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC & DỮ LIỆU | KẾT QUẢ MONG ĐỢI | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **Vercel Deploy** |
| **TC-DEPLOY.01** | AC-P3-06 | Func | **[Positive]** Build succeeds on Vercel | **1.** Push to branch → trigger Vercel build<br>**2.** Monitor build logs | **THEN** Build completes < 5 min, status = Ready | Blocker | [ ] |
| **TC-DEPLOY.02** | AC-P3-04 | Func | **[Positive]** All env vars configured | **1.** Compare `.env.staging.example` vars với Vercel dashboard<br>**2.** Check no MISSING env vars in build logs | **THEN** All 30+ vars present, no "undefined" errors | Blocker | [ ] |
| **TC-DEPLOY.03** | AC-P3-05 | Func | **[Positive]** Build command runs migrations | **1.** Check Vercel build logs for db-setup.js output<br>**2.** Verify "migrations complete" message | **THEN** Migrations run before next build, exit 0 | High | [ ] |
| **TC-DEPLOY.04** | Scenario #3, #35 | Sec | **[Critical]** JWT tokens valid on Vercel | **1.** Login trên DO (get JWT)<br>**2.** Use same JWT to call Vercel preview URL API | **THEN** JWT accepted (same PAYLOAD_SECRET) | Blocker | [ ] |
| **TC-DEPLOY.05** | AC-P3-03 | Func | **[Positive]** DB connection to Neon works | **1.** Open Vercel preview URL<br>**2.** Login → dashboard loads with data<br>**3.** Check Vercel function logs for DB errors | **THEN** Data loads, no ECONNREFUSED, no SSL errors | Blocker | [ ] |
| **TC-DEPLOY.06** | Scenario #15 | Perf | **[Edge]** Cold start latency | **1.** Wait 10 min (Neon auto-suspend)<br>**2.** Hit homepage<br>**3.** Measure TTFB | **THEN** First request < 10s (cold start), subsequent < 500ms | Medium | [ ] |

### Phase 4: DNS Migration + Domains

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC & DỮ LIỆU | KẾT QUẢ MONG ĐỢI | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **DNS + Domains** |
| **TC-DNS.01** | AC-P4-02 | Func | **[Positive]** DNS CNAME points to Vercel | **1.** `dig CNAME web-v2.dev.ecommercehub.my`<br>**2.** `dig CNAME web-cms-v2.dev.ecommercehub.my` | **THEN** Both return `cname.vercel-dns.com` | Blocker | [x] |
| **TC-DNS.02** | AC-P4-03 | Sec | **[Positive]** SSL certificates valid | **1.** `curl -vI https://web-v2.dev.ecommercehub.my 2>&1 \| grep "SSL certificate"`<br>**2.** Repeat cho admin + wildcard | **THEN** Valid SSL cert, issued by Let's Encrypt/Vercel, not expired | Blocker | [x] |
| **TC-DNS.03** | AC-P4-01 | Func | **[Positive]** Primary domain loads | **1.** Open `https://web-v2.dev.ecommercehub.my`<br>**2.** Verify homepage renders | **THEN** Homepage loads, no redirect loop, status 200 | Blocker | [ ] |
| **TC-DNS.04** | AC-P4-01 | Func | **[Positive]** Admin domain loads | **1.** Open `https://web-cms-v2.dev.ecommercehub.my`<br>**2.** Verify admin panel renders | **THEN** Payload admin login page, status 200 | Blocker | [ ] |
| **TC-DNS.05** | Scenario #12 | Func | **[Positive]** Wildcard subdomain routing | **1.** Create test site với slug `test-store`<br>**2.** Open `https://test-store.web-v2.dev.ecommercehub.my` | **THEN** Site renders correctly via subdomain | Blocker | [ ] |
| **TC-DNS.06** | AC-P4-05, Scenario #13, #37 | Sec | **[Critical]** Stripe webhook delivery | **1.** Update Stripe webhook URL to Vercel domain<br>**2.** Trigger test webhook from Stripe dashboard<br>**3.** Check webhook event in Payload admin | **THEN** Webhook received, signature verified, event processed | Blocker | [ ] |
| **TC-DNS.07** | Scenario #53 | Func | **[Critical]** Custom domain verification flow | **1.** Go to Settings → Domains<br>**2.** Add custom domain `test.example.com`<br>**3.** Check verify flow works without DO API | **THEN** Domain flow works với Vercel API HOẶC shows "coming soon" | High | [ ] |
| **TC-DNS.08** | Scenario #11 | Func | **[Edge]** No redirect loops | **1.** `curl -L -v https://web-v2.dev.ecommercehub.my 2>&1 \| grep "< HTTP"`<br>**2.** Count redirects | **THEN** Max 1 redirect (http→https), no loops | High | [x] |
| **TC-DNS.09** | Scenario #36 | Sec | **[Critical]** Admin middleware protection | **1.** Try accessing `/admin` via primary domain (not admin subdomain)<br>**2.** Try accessing dashboard routes via admin domain | **THEN** Middleware correctly routes: admin domain → /admin, primary → public | Blocker | [ ] |
| **TC-DNS.10** | Risk | Func | **[Positive]** Rollback DNS to DO | **1.** Switch DNS CNAME back to DO app URL<br>**2.** Verify site loads from DO<br>**3.** Measure switch time | **THEN** DO serves traffic within 5 min, all features work | High | [ ] |

### Phase 5: Performance (Caching + Rate Limiting)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC & DỮ LIỆU | KẾT QUẢ MONG ĐỢI | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **Caching + Rate Limiting** |
| **TC-PERF.01** | AC-P5-01 | Func | **[Positive]** Upstash Redis connection | **1.** Deploy with UPSTASH_REDIS_REST_URL + TOKEN<br>**2.** Trigger rate-limited endpoint<br>**3.** Check Upstash dashboard for commands | **THEN** Redis responds, commands logged | Blocker | [ ] |
| **TC-PERF.02** | AC-P5-02, Scenario #18 | Func | **[Positive]** Per-user AI rate limit (5/min) | **1.** Login as user A<br>**2.** Call `/api/ai/generate-site` 5 times rapidly<br>**3.** Call 6th time | **THEN** First 5: 200 OK. 6th: 429 Too Many Requests + retry-after header | Blocker | [x] |
| **TC-PERF.03** | AC-P5-03 | Func | **[Positive]** Global AI rate limit (10/min) | **1.** Login as 11 different users<br>**2.** Each calls `/api/ai/generate-site` simultaneously | **THEN** First 10: 200 OK. 11th: 429 | High | [x] |
| **TC-PERF.04** | AC-P5-04 | Func | **[Positive]** Daily spend cap $50 | **1.** Simulate spend tracking reaching $50<br>**2.** Trigger AI generation | **THEN** 429 response: "Daily AI limit reached" | High | [x] |
| **TC-PERF.05** | AC-P5-05, AC-P5-06 | Perf | **[Positive]** Tenant cache (5min TTL) | **1.** First request to tenant site → measure DB query<br>**2.** Second request within 5 min → check cache hit<br>**3.** Wait 5+ min → verify cache expired | **THEN** 1st: DB query. 2nd: cache hit (faster). 3rd: DB query again | High | [ ] |
| **TC-PERF.06** | AC-P5-07, Scenario #54 | Func | **[Positive]** Cache invalidation on publish | **1.** View published page (cached)<br>**2.** Edit + publish update<br>**3.** View page again immediately | **THEN** Updated content visible within 10s (revalidateTag works) | High | [ ] |
| **TC-PERF.07** | Scenario #31 | Sec | **[Critical]** Redis down → fail-closed | **1.** Simulate Upstash unavailable (wrong URL)<br>**2.** Call AI generation endpoint | **THEN** 503 "Service temporarily unavailable", NOT unprotected AI call | Blocker | [ ] |
| **TC-PERF.08** | Scenario #20 | Perf | **[Critical]** Upstash commands budget | **1.** Calculate: (200 users × 4 polls/min × 60 min × 8h) + cache ops + rate limit<br>**2.** Compare vs 10K/day limit | **THEN** Document: fits free tier OR need paid. Estimated: ~38K/day → NEED PAID | High | [ ] |
| **TC-PERF.09** | Scenario #52 | UX | **[Edge]** Rate limit error UX | **1.** Trigger rate limit as regular user<br>**2.** Check error message displayed | **THEN** Clear message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng đợi 1 phút." NOT generic 500 | Medium | [ ] |
| **TC-PERF.10** | Scenario #19 | Perf | **[Edge]** Cache stampede protection | **1.** Clear all caches<br>**2.** Simulate 50 concurrent requests to same tenant | **THEN** Only 1 DB query fired (singleflight), 49 served from cache | Medium | [ ] |

### Phase 6: E2E Verification + Load Test

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC & DỮ LIỆU | KẾT QUẢ MONG ĐỢI | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **E2E Smoke Tests** |
| **TC-E2E.01** | AC-P6-01 | E2E | **[Positive]** Login + Logout | **1.** Navigate to login page<br>**2.** Enter valid credentials<br>**3.** Verify dashboard loads<br>**4.** Click logout | **THEN** Login: JWT set, dashboard visible. Logout: session cleared, redirect to login | Blocker | [x] |
| **TC-E2E.02** | Scenario #4 | E2E | **[Positive]** OTP Email delivery | **1.** Trigger forgot password / OTP flow<br>**2.** Check email inbox (AWS SES) | **THEN** OTP email arrives < 2 minutes, code valid | High | [ ] |
| **TC-E2E.03** | AC-P6-01 | E2E | **[Positive]** Admin panel loads | **1.** Navigate to `https://web-cms-v2.dev.ecommercehub.my`<br>**2.** Login with admin credentials | **THEN** Payload admin dashboard renders, collections visible | Blocker | [ ] |
| **TC-E2E.04** | AC-P6-01 | E2E | **[Positive]** AI Builder — create site | **1.** Go to Builder<br>**2.** Enter site description<br>**3.** Click generate<br>**4.** Wait for AI response | **THEN** Site generated within 60s, blocks rendered, saved to DB | High | [ ] |
| **TC-E2E.05** | AC-P6-01 | E2E | **[Positive]** Editor — edit + save | **1.** Open existing site in editor<br>**2.** Edit text block<br>**3.** Save/auto-save | **THEN** Changes saved, no data loss, draft persisted | High | [ ] |
| **TC-E2E.06** | AC-P6-01 | E2E | **[Positive]** Publish site | **1.** Open site in editor<br>**2.** Click publish<br>**3.** View published site via subdomain | **THEN** Published site accessible, content matches editor | High | [ ] |
| **TC-E2E.07** | Scenario #41 | E2E | **[Positive]** File upload (S3) | **1.** Go to media library<br>**2.** Upload image (JPG, 2MB)<br>**3.** Verify image URL accessible | **THEN** Upload succeeds, S3 URL valid, image displays | High | [ ] |
| **TC-E2E.08** | AC-P6-01 | E2E | **[Positive]** Notifications (polling) | **1.** Login on 2 tabs<br>**2.** Tab 1: publish site<br>**3.** Tab 2: check notification bell | **THEN** Notification appears within 15-30s (polling interval) | Medium | [ ] |
| **TC-E2E.09** | Scenario #38 | Sec | **[Positive]** CORS validation | **1.** From custom domain, call API endpoint<br>**2.** Check response headers | **THEN** CORS headers present: Access-Control-Allow-Origin matches domain | High | [ ] |
| **TC-E2E.10** | Scenario #22 | E2E | **[Edge]** Session continuity during DNS switch | **1.** Login on DO domain (get JWT)<br>**2.** Switch DNS to Vercel<br>**3.** Access Vercel domain with same JWT | **THEN** JWT valid, session maintained (same PAYLOAD_SECRET) | Blocker | [ ] |
| **Load Tests (k6)** |
| **TC-LOAD.01** | AC-P6-02 | Load | **[Positive]** 200 concurrent site views | **1.** k6: 200 VUs, 5 min, GET published sites<br>**2.** Monitor p95, error rate | **THEN** p95 < 2s, error rate < 1% | Blocker | [x] |
| **TC-LOAD.02** | AC-P6-02 | Load | **[Positive]** 50 concurrent editors | **1.** k6: 50 VUs, 5 min, editor page loads + saves<br>**2.** Monitor p95, error rate | **THEN** p95 < 3s, error rate < 1%, no data loss | High | [x] |
| **TC-LOAD.03** | AC-P6-02 | Load | **[Positive]** 20 concurrent AI generations | **1.** k6: 20 VUs, 5 min, POST /api/ai/generate-site<br>**2.** Monitor rate limiting, timeouts | **THEN** Rate limit enforced (5/user/min), no timeouts, 429s handled gracefully | High | [x] |
| **TC-LOAD.04** | Scenario #17 | Load | **[Critical]** DB connection pool under load | **1.** During load test, monitor Neon connection count<br>**2.** Check for ECONNREFUSED errors | **THEN** Connection pool not exhausted, no connection errors | Blocker | [ ] |
| **TC-LOAD.05** | AC-P6-03 | Perf | **[Positive]** Function duration metrics | **1.** Check Vercel Analytics: Function duration p95<br>**2.** Check cold start frequency | **THEN** p95 < 5s, cold starts < 5 during load test | High | [ ] |
| **Security Regression** |
| **TC-SEC.01** | Scenario #35, #37 | Sec | **[Critical]** Auth tokens cross-platform | **1.** Generate JWT on current DO deployment<br>**2.** Verify JWT on Vercel deployment | **THEN** JWT signature valid (same PAYLOAD_SECRET + algorithm) | Blocker | [ ] |
| **TC-SEC.02** | Scenario #44 | Sec | **[Critical]** Stripe webhook idempotency | **1.** Send same Stripe event ID twice<br>**2.** Check payment records | **THEN** Event processed once, no duplicate charges | Blocker | [ ] |
| **TC-SEC.03** | Scenario #36 | Sec | **[Critical]** Admin route protection | **1.** Try `/admin` from non-admin domain<br>**2.** Try `/dashboard` from admin domain<br>**3.** Try API routes without auth | **THEN** Proper routing + 401/403 for unauthorized access | Blocker | [ ] |
| **TC-SEC.04** | Scenario #6 | Sec | **[Edge]** DB connection string with special chars | **1.** Set DATABASE_URI with password containing `@#%`<br>**2.** Verify connection works | **THEN** Connection successful, string properly encoded | Medium | [ ] |
| **Cleanup + Documentation** |
| **TC-CLEAN.01** | AC-P6-07 | Docs | **[Positive]** Documentation updated | **1.** Check CLAUDE.md: no DO references<br>**2.** Check CONTRIBUTING.md updated<br>**3.** Check GIT_AND_CI_RULES.md updated | **THEN** All docs reflect Vercel deployment | Medium | [ ] |
| **TC-CLEAN.02** | AC-P6-06 | Func | **[Positive]** Cost verification | **1.** Check Vercel billing: $20/mo Pro<br>**2.** Check Neon billing: $0 (free tier)<br>**3.** Check Upstash billing | **THEN** Total cost documented, within budget | Low | [ ] |
| **TC-CLEAN.03** | Scenario #56 | Func | **[Positive]** DO rollback capability | **1.** Verify DO app still running<br>**2.** Verify DO DB read-only or frozen<br>**3.** Test DNS switch back to DO | **THEN** DO serves traffic within 5 min of DNS revert | High | [ ] |
| **Integration Tests** |
| **TC-INT.01** | Scenario #45 | Func | **[Positive]** Lark Bot notifications | **1.** Trigger CI deploy notification<br>**2.** Check Lark group for message | **THEN** Notification delivered with Vercel URLs | Medium | [ ] |
| **TC-INT.02** | Scenario #46 | Func | **[Positive]** ECH Distribution API | **1.** Trigger distribution API call<br>**2.** Verify callback/response | **THEN** API communication works from Vercel | Medium | [ ] |
| **TC-INT.03** | Scenario #33 | Func | **[Negative]** Email service down handling | **1.** Set invalid MAIL_HOST<br>**2.** Trigger OTP email<br>**3.** Check UI response | **THEN** User sees "Email service unavailable", no crash, error logged | Medium | [ ] |
| **TC-INT.04** | Scenario #30 | Func | **[Negative]** DB down graceful degradation | **1.** Set invalid DATABASE_URI<br>**2.** Access cached page<br>**3.** Access uncached page | **THEN** Cached: serves from cache. Uncached: 503 with friendly message | High | [ ] |

---

## 6. Traceability Matrix

### Phase 1 ACs → Test Cases

| AC | Description | Test Cases | Coverage |
|-----|-----------|----------|----------|
| AC-P1-01 | Connection string valid | TC-MIG.01 | ✅ Full |
| AC-P1-02 | Backup export successful | TC-MIG.03 | ✅ Full |
| AC-P1-03 | Data import completes | TC-MIG.04, TC-MIG.05 | ✅ Full |
| AC-P1-04 | SSL sslmode=require works | TC-MIG.02 | ✅ Full |
| AC-P1-05 | rejectUnauthorized: true | TC-MIG.02 | ✅ Full |
| AC-P1-06 | Neon free tier < 512MB | TC-MIG.10 | ✅ Full |

### Phase 2 ACs → Test Cases

| AC | Description | Test Cases | Coverage |
|-----|-----------|----------|----------|
| AC-P2-01 | vercel.json correct | TC-CODE.02 | ✅ Full |
| AC-P2-02 | db-setup --migrate-only works | TC-CODE.01 | ✅ Full |
| AC-P2-03 | Payload SSL updated | TC-MIG.02, TC-DEPLOY.05 | ✅ Full |
| AC-P2-04 | No DO refs in middleware | TC-CODE.04 | ✅ Full |
| AC-P2-05 | maxDuration <= 60 | TC-CODE.06 | ✅ Full |
| AC-P2-06 | SSE deprecated, polling works | TC-CODE.05, TC-CODE.07 | ✅ Full |
| AC-P2-07 | Polling returns since timestamp | TC-CODE.05 | ✅ Full |
| AC-P2-08 | No DO API refs in codebase | TC-CODE.04 | ✅ Full |

### Phase 3 ACs → Test Cases

| AC | Description | Test Cases | Coverage |
|-----|-----------|----------|----------|
| AC-P3-01 | Vercel Pro created | TC-DEPLOY.01 | ✅ Full |
| AC-P3-02 | Both projects on Vercel | TC-DEPLOY.01 | ✅ Full |
| AC-P3-03 | DATABASE_URI = Neon | TC-DEPLOY.05 | ✅ Full |
| AC-P3-04 | 30+ env vars configured | TC-DEPLOY.02 | ✅ Full |
| AC-P3-05 | Build runs migrations | TC-DEPLOY.03 | ✅ Full |
| AC-P3-06 | Build succeeds | TC-DEPLOY.01 | ✅ Full |

### Phase 4 ACs → Test Cases

| AC | Description | Test Cases | Coverage |
|-----|-----------|----------|----------|
| AC-P4-01 | 3 domains on Vercel | TC-DNS.03, TC-DNS.04, TC-DNS.05 | ✅ Full |
| AC-P4-02 | DNS → cname.vercel-dns.com | TC-DNS.01 | ✅ Full |
| AC-P4-03 | SSL auto-provisioned | TC-DNS.02 | ✅ Full |
| AC-P4-04 | NEXT_PUBLIC_SERVER_URL correct | TC-DNS.03 | ✅ Full |
| AC-P4-05 | Stripe webhook URL updated | TC-DNS.06 | ✅ Full |

### Phase 5 ACs → Test Cases

| AC | Description | Test Cases | Coverage |
|-----|-----------|----------|----------|
| AC-P5-01 | Upstash connected | TC-PERF.01 | ✅ Full |
| AC-P5-02 | Rate limit 5/user/min | TC-PERF.02 | ✅ Full |
| AC-P5-03 | Global limit 10/min | TC-PERF.03 | ✅ Full |
| AC-P5-04 | Daily cap $50 | TC-PERF.04 | ✅ Full |
| AC-P5-05 | Tenant cache 5min TTL | TC-PERF.05 | ✅ Full |
| AC-P5-06 | Page cache 5min TTL | TC-PERF.05 | ✅ Full |
| AC-P5-07 | revalidateTag on update | TC-PERF.06 | ✅ Full |

### Phase 6 ACs → Test Cases

| AC | Description | Test Cases | Coverage |
|-----|-----------|----------|----------|
| AC-P6-01 | All E2E tests pass | TC-E2E.01–10 | ✅ Full |
| AC-P6-02 | 200 concurrent users | TC-LOAD.01–04 | ✅ Full |
| AC-P6-03 | p95 < 2s | TC-LOAD.01, TC-LOAD.05 | ✅ Full |
| AC-P6-04 | Error rate < 1% | TC-LOAD.01–03 | ✅ Full |
| AC-P6-05 | Stable 1 week | TC-CLEAN.03 | ⚠️ Partial (manual monitoring) |
| AC-P6-06 | Cost $20/mo | TC-CLEAN.02 | ✅ Full |
| AC-P6-07 | Docs updated | TC-CLEAN.01 | ✅ Full |

### Scenario Coverage

| Scenario Severity | Total | Covered by TCs | Coverage |
|-------------------|-------|----------------|----------|
| Critical (16) | 16 | 16 | ✅ 100% |
| High (22) | 22 | 20 | ⚠️ 91% |
| Medium (12) | 12 | 9 | ⚠️ 75% |
| Low (6) | 6 | 2 | ⚠️ 33% |
| **Total** | **56** | **47** | **84%** |

> Uncovered scenarios: Low-severity (browser compat, proxy routing) + Medium (adaptive polling, audit logs gap) — acceptable for migration scope.

---

## 7. Hành trình E2E (End-to-End UAT Flows)

### Flow 1: New User Signup → Create Site → Publish (Post-Migration)
1. Open `https://web-v2.dev.ecommercehub.my` → Landing page loads
2. Sign up → OTP email via SES → Verify OTP
3. Onboarding flow → Select template
4. AI Builder → Generate site → Wait < 60s
5. Editor → Edit blocks → Auto-save works
6. Publish → Site live at `{slug}.web-v2.dev.ecommercehub.my`
7. Notification arrives via polling (15-30s)

### Flow 2: Admin Management (Post-Migration)
1. Open `https://web-cms-v2.dev.ecommercehub.my` → Admin login
2. View collections (users, sites, pages, products)
3. Edit a record → Save → Verify DB update on Neon
4. Upload media → S3 upload works
5. Check system health → `/api/health` returns OK

### Flow 3: DNS Rollback (Emergency)
1. Detect issue on Vercel (5xx errors, data corruption)
2. Switch DNS CNAME back to DO in Route 53
3. Verify DO serves traffic within 5 min
4. Investigate root cause on Vercel
5. Fix → Re-switch DNS to Vercel

---

## 8. Quality Gates

| Nhóm Kiểm thử | Trạng Thái | Ghi chú |
|---|---|---|
| **1. Data Migration** | [ ] 0/10 TC | MUST PASS ALL before Phase 3 |
| **2. Code Changes** | [ ] 0/8 TC | CI checks automated |
| **3. Vercel Deploy** | [ ] 0/6 TC | First deploy gate |
| **4. DNS + Domains** | [ ] 0/10 TC | MUST PASS before going live |
| **5. Performance** | [ ] 0/10 TC | MUST PASS rate limiting before event |
| **6. E2E + Load** | [ ] 0/18 TC | Final gate before DO cleanup |
| **7. Security Regression** | [ ] 0/4 TC | MUST PASS ALL |
| **8. Integration** | [ ] 0/4 TC | Nice-to-have, non-blocking |
| **9. Cleanup** | [ ] 0/3 TC | Post-migration |

**Release Gate:** Phases 1-4 ALL PASS → Go Live. Phase 5-6 PASS → Event Ready. Phase 7 PASS → DO Cleanup.

---

## 9. Appendix

### Test Data Requirements
- Valid user credentials (staging)
- Test Stripe webhook event
- Sample media files (JPG 2MB, PNG 500KB)
- AI Builder prompt: "Create a coffee shop website"
- k6 script: `tests/load/vercel-migration.js`

### Tools Required
- `psql` — DB verification
- `dig` — DNS verification
- `curl` — SSL/HTTP checks
- `k6` — Load testing
- Playwright — E2E automation
- Vercel CLI — Deploy verification
- Stripe CLI — Webhook testing

### References
- Migration Plan: `plans/260409-2011-vercel-migration/plan.md`
- Phase specs: `plans/260409-2011-vercel-migration/phase-01..06.md`
- Scenarios: `docs/qa/scenarios/vercel-neon-migration.md`
- Scout Report: Generated 2026-04-09 (Docker/DO deps, app config, CI/CD)
