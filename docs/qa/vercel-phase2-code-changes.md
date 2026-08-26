# Quyết Định Kiểm Thử: Phase 2 — Vercel Migration Code Changes
> **Phiên bản:** 1.0 | **Cập nhật:** 2026-04-09 | **Thực hiện:** QA Team
> **Nguồn:** Phase 2 Plan (`plans/260409-2011-vercel-migration/phase-02-code-changes.md`), 35 Scenarios
> **Parent:** [Migration QA Master](vercel-neon-migration.md)

---

## 1. Mục Tiêu

Verify Phase 2 code changes: vercel.json, db-setup migration mode, payload SSL, middleware cleanup, SSE→Polling, CI cleanup, domain actions disable. **12 ACs, 35 scenarios → 42 test cases.**

---

## 2. Test Environment

| Variable | Requirement |
|---|---|
| Env | Local dev + Vercel Preview |
| DB | Neon PostgreSQL 17.8 (ap-southeast-1) |
| Node | 18+ (match Vercel runtime) |
| Browser | Chrome 110+, Safari (polling test) |

---

## 3. Test Strategy

| Type | Tools | Target |
|------|-------|--------|
| Unit | Vitest | db-setup --migrate-only, polling logic |
| Integration | Manual + curl | API endpoints, middleware routing |
| Regression | grep + tsc | No DO refs, no type errors |
| Security | Manual | Auth on polling, cross-tenant |

---

## 4. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Middleware redirect loop | Critical | Medium | Test all hostname patterns locally |
| Polling auth bypass | Critical | Low | Copy auth from SSE stream route |
| Cross-tenant notification leak | Critical | Low | WHERE clause review |
| db-setup.js process hang | High | Medium | pool.end() + timeout |
| Double deploy (Vercel + CI) | High | Medium | Disable one before merge |
| Polling overlap (slow network) | Medium | High | AbortController per fetch |

---

## 5. Test Cases

### Group A: vercel.json + Build Config (AC-P2-01)

#### TC-P2.01: vercel.json file structure
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-P2-01
- **Steps:**
  1. Read `vercel.json`
  2. Verify `buildCommand` contains `db-setup.js --migrate-only && next build`
  3. Verify `framework` = `nextjs`
  4. Verify `regions` includes `sin1`
  5. Verify `functions.*.maxDuration` = 60
- **Expected:** All fields present and correct
- **Test Data:** `cat vercel.json | jq .`

#### TC-P2.02: vercel.json maxDuration global enforcement
- **Priority:** P1
- **Type:** Regression
- **AC Reference:** AC-P2-05
- **Steps:**
  1. `grep -r "maxDuration" src/app/api/`
  2. Check every API route file
- **Expected:** No route has maxDuration > 60
- **Test Data:** `grep -rn "maxDuration.*[0-9]" src/app/api/`

### Group B: db-setup.js --migrate-only (AC-P2-02)

#### TC-P2.03: --migrate-only runs and exits
- **Priority:** P1 (Blocker)
- **Type:** Integration
- **AC Reference:** AC-P2-02
- **Precondition:** DATABASE_URI set to Neon
- **Steps:**
  1. `DATABASE_URI=$NEON_URL node scripts/db-setup.js --migrate-only`
  2. Measure execution time
  3. Check exit code
- **Expected:** Exit code 0, completes < 30s, prints "Migrations complete"
- **Test Data:** Neon staging connection string

#### TC-P2.04: --migrate-only idempotent (Scenario #5)
- **Priority:** P1 (Blocker)
- **Type:** Integration
- **AC Reference:** AC-P2-02
- **Steps:**
  1. Run `db-setup.js --migrate-only` first time
  2. Run `db-setup.js --migrate-only` second time immediately
- **Expected:** Both succeed, no duplicate table/column errors
- **Test Data:** Same Neon URL

#### TC-P2.05: --migrate-only pool cleanup (Scenario #11)
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-P2-02
- **Steps:**
  1. Run with `--migrate-only`
  2. Check process exits (not hanging)
  3. Verify no open handles (node --detect-open-handles)
- **Expected:** Clean exit, pool.end() called, no hanging connections

#### TC-P2.06: --migrate-only with unreachable DB (Scenario #17)
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-P2-02
- **Steps:**
  1. Set DATABASE_URI to invalid host
  2. Run `db-setup.js --migrate-only`
- **Expected:** Error message within 15s, exit code 1, no infinite hang

#### TC-P2.07: Without --migrate-only flag (Scenario #14)
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-P2-02
- **Steps:**
  1. Run `node scripts/db-setup.js` (no flag)
- **Expected:** Default Docker mode (start server), backward compatible

### Group C: payload.config.ts SSL + Docker removal (AC-P2-03)

#### TC-P2.08: SSL strict connection
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-P2-03
- **Steps:**
  1. Read `payload.config.ts` SSL config
  2. Verify `rejectUnauthorized: true`
  3. `npm run build` with Neon DATABASE_URI
- **Expected:** Build succeeds, no SSL errors in logs

#### TC-P2.09: No Docker HOSTNAME check
- **Priority:** P1
- **Type:** Regression
- **AC Reference:** AC-P2-04
- **Steps:**
  1. `grep -n "HOSTNAME.*0.0.0.0" src/payload.config.ts`
  2. `grep -n "hostname.*0.0.0.0" src/payload.config.ts`
- **Expected:** 0 matches

#### TC-P2.10: No DigitalOcean Spaces URL detection
- **Priority:** P2
- **Type:** Regression
- **AC Reference:** AC-P2-04
- **Steps:**
  1. `grep -n "digitaloceanspaces" src/payload.config.ts`
- **Expected:** 0 matches (or commented out)

### Group D: middleware.ts cleanup (AC-P2-04, AC-P2-12)

#### TC-P2.11: No DO hostname references
- **Priority:** P1 (Blocker)
- **Type:** Regression
- **AC Reference:** AC-P2-04
- **Steps:**
  1. `grep -n "ondigitalocean.app" src/middleware.ts`
  2. `grep -n "0.0.0.0" src/middleware.ts`
- **Expected:** 0 matches for both

#### TC-P2.12: Middleware — platform domain routing
- **Priority:** P1 (Blocker)
- **Type:** Integration
- **AC Reference:** AC-P2-12
- **Precondition:** Local dev server running
- **Steps:**
  1. Request with Host: `web-v2.dev.ecommercehub.my` → expect homepage
  2. Request with Host: `web-cms-v2.dev.ecommercehub.my` → expect /admin
  3. Request with Host: `test-store.web-v2.dev.ecommercehub.my` → expect /sites/test-store
  4. Request with Host: `localhost:3000` → expect normal routing
- **Expected:** All routes resolve correctly, no redirect loops

#### TC-P2.13: Middleware — no redirect loop (Scenario #1, #20)
- **Priority:** P1 (Blocker)
- **Type:** Integration
- **AC Reference:** AC-P2-12
- **Steps:**
  1. `curl -L -v http://localhost:3000 2>&1 | grep "< HTTP"`
  2. Count redirect hops
- **Expected:** Max 1 redirect (http→https), no infinite loops

#### TC-P2.14: Middleware — custom domain lookup cached (Scenario #20)
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-P2-12
- **Steps:**
  1. Request with unknown Host header (custom domain)
  2. Check if DB query fires
  3. Repeat same Host within 5s
- **Expected:** Second request uses cached result, not another DB query

### Group E: SSE → Polling (AC-P2-06, AC-P2-07)

#### TC-P2.15: Polling endpoint returns notifications
- **Priority:** P1 (Blocker)
- **Type:** Integration
- **AC Reference:** AC-P2-07
- **Precondition:** Authenticated user with notifications
- **Steps:**
  1. `GET /api/notifications?since=2026-01-01T00:00:00Z` with JWT
  2. Check response shape
- **Expected:** `{ unreadCount: N, items: [...] }`, status 200

#### TC-P2.16: Polling endpoint auth required (Scenario #22)
- **Priority:** P1 (Blocker)
- **Type:** Security
- **AC Reference:** AC-P2-06
- **Steps:**
  1. `GET /api/notifications` without Authorization header
  2. `GET /api/notifications` with expired JWT
- **Expected:** 401 Unauthorized for both

#### TC-P2.17: Polling endpoint tenant isolation (Scenario #23)
- **Priority:** P1 (Blocker)
- **Type:** Security
- **AC Reference:** AC-P2-06
- **Precondition:** User A (tenant 1) and User B (tenant 2) with notifications
- **Steps:**
  1. Login as User A → `GET /api/notifications`
  2. Verify only tenant 1 notifications returned
- **Expected:** Zero notifications from tenant 2

#### TC-P2.18: Polling since timestamp UTC (Scenario #25)
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-P2-07
- **Steps:**
  1. `GET /api/notifications?since=2026-04-09T15:00:00Z` (UTC)
  2. `GET /api/notifications?since=2026-04-09T22:00:00+07:00` (same time, VN timezone)
- **Expected:** Both return same results (server normalizes to UTC)

#### TC-P2.19: Polling since future date (Scenario #26)
- **Priority:** P3
- **Type:** Unit
- **AC Reference:** AC-P2-07
- **Steps:**
  1. `GET /api/notifications?since=2030-01-01T00:00:00Z`
- **Expected:** Returns recent notifications (fallback to now - 60s), not empty forever

#### TC-P2.20: NotificationProvider polling lifecycle
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** AC-P2-06
- **Steps:**
  1. Login → open dashboard
  2. Wait 15-30s
  3. Create notification (from another tab/user)
  4. Wait for poll cycle
- **Expected:** Notification appears within 15-30s, toast shown

#### TC-P2.21: Polling overlap prevention (Scenario #6)
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-P2-06
- **Steps:**
  1. Simulate slow network (3s response time)
  2. Check polling doesn't fire concurrent requests
- **Expected:** Previous fetch aborted or skipped before new one starts

#### TC-P2.22: Tab visibility polling pause (Scenario #10, #16)
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-P2-06
- **Steps:**
  1. Open dashboard → polling active
  2. Switch to another tab (hidden)
  3. Wait 30s → check no fetch calls
  4. Switch back → polling resumes immediately
- **Expected:** No polling when hidden, immediate fetch on visible

#### TC-P2.23: Polling error backoff (Scenario #18)
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-P2-06
- **Steps:**
  1. Simulate 500 error from API
  2. Check next poll interval
  3. Simulate consecutive 500s
- **Expected:** Backoff: 15s → 30s → 60s. Reset to 15s after success.

#### TC-P2.24: SSE stream route deprecated
- **Priority:** P2
- **Type:** Regression
- **AC Reference:** AC-P2-05
- **Steps:**
  1. Check `src/app/api/notifications/stream/route.ts` maxDuration
  2. Verify <= 60
- **Expected:** maxDuration = 60 (was 300)

#### TC-P2.25: BroadcastChannel cross-tab sync (Scenario #21)
- **Priority:** P3
- **Type:** Unit
- **AC Reference:** AC-P2-06
- **Steps:**
  1. Open 2 tabs → both logged in
  2. Tab 1 receives polling update → unreadCount changes
  3. Check Tab 2 unreadCount
- **Expected:** Both tabs sync via BroadcastChannel

### Group F: Environment Files (AC-P2-09)

#### TC-P2.26: DO vars removed from env examples
- **Priority:** P1
- **Type:** Regression
- **AC Reference:** AC-P2-09
- **Steps:**
  1. `grep "DO_API_TOKEN\|DO_APP_ID\|SERVER_IP" .env.example .env.staging.example .env.production.example`
- **Expected:** 0 matches

#### TC-P2.27: DATABASE_URI updated to Neon format
- **Priority:** P2
- **Type:** Regression
- **AC Reference:** AC-P2-09
- **Steps:**
  1. Check `.env.example` DATABASE_URI placeholder
- **Expected:** Contains Neon-style URL: `postgresql://...@ep-xxx.neon.tech/...`

#### TC-P2.28: No DO env refs in active code (Scenario #28)
- **Priority:** P1
- **Type:** Regression
- **AC Reference:** AC-P2-08
- **Steps:**
  1. `grep -rn "process.env.DO_API_TOKEN\|process.env.DO_APP_ID\|process.env.SERVER_IP" src/`
  2. Exclude commented lines
- **Expected:** 0 active references (comments/TODOs OK)

### Group G: CI Cleanup (AC-P2-10)

#### TC-P2.29: No DO deploy jobs in ci.yml
- **Priority:** P1
- **Type:** Regression
- **AC Reference:** AC-P2-10
- **Steps:**
  1. `grep -n "digitalocean\|doctl\|sync-do-envs" .github/workflows/ci.yml`
  2. `grep -n "DIGITALOCEAN_ACCESS_TOKEN" .github/workflows/ci.yml`
- **Expected:** 0 matches

#### TC-P2.30: CI dependency chain intact (Scenario #30)
- **Priority:** P1
- **Type:** Regression
- **AC Reference:** AC-P2-10
- **Steps:**
  1. Parse ci.yml `needs:` fields
  2. Verify no dangling references to removed jobs
- **Expected:** All `needs:` reference existing jobs

#### TC-P2.31: CI lint + typecheck + test still work
- **Priority:** P1 (Blocker)
- **Type:** Integration
- **AC Reference:** AC-P2-10, AC-P2-11
- **Steps:**
  1. `npm run lint`
  2. `npm run typecheck` (tsc --noEmit)
  3. `npm run test`
- **Expected:** All pass

#### TC-P2.32: No double deploy risk (Scenario #29)
- **Priority:** P1
- **Type:** Review
- **AC Reference:** AC-P2-10
- **Steps:**
  1. Check Vercel project settings: auto-deploy enabled?
  2. Check ci.yml: any remaining deploy steps?
- **Expected:** Only ONE deploy mechanism (Vercel GitHub integration OR CI, not both)

### Group H: Domain Actions (AC-P2-08)

#### TC-P2.33: DO API calls disabled in domain actions
- **Priority:** P1
- **Type:** Regression
- **AC Reference:** AC-P2-08
- **Steps:**
  1. Read `src/app/(app)/settings/domains/actions.ts`
  2. Verify DO API calls commented/removed in addCustomDomain, removeCustomDomain, verifyCustomDomain
- **Expected:** No active `fetch` to `api.digitalocean.com`

#### TC-P2.34: Domain add shows unavailable message (Scenario #13)
- **Priority:** P2
- **Type:** E2E
- **AC Reference:** AC-P2-08
- **Steps:**
  1. Go to Settings → Domains
  2. Try to add new domain
- **Expected:** User-friendly message: "Domain management temporarily unavailable"

#### TC-P2.35: Domain API server-side protected (Scenario #24)
- **Priority:** P1
- **Type:** Security
- **AC Reference:** AC-P2-08
- **Steps:**
  1. Call addCustomDomain server action directly (POST)
- **Expected:** Returns error (not just UI disabled), server rejects

#### TC-P2.36: Existing custom domains still route (Scenario #35)
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-P2-08
- **Steps:**
  1. Check middleware handles existing custom domains in DB
  2. Request with custom domain Host header
- **Expected:** Routes to correct tenant site (middleware DB lookup intact)

### Group I: Cleanup + Build (AC-P2-11)

#### TC-P2.37: sync-do-envs.py deleted
- **Priority:** P2
- **Type:** Regression
- **Steps:**
  1. `ls .github/scripts/sync-do-envs.py`
- **Expected:** File not found

#### TC-P2.38: npm run build succeeds
- **Priority:** P1 (Blocker)
- **Type:** Integration
- **AC Reference:** AC-P2-11
- **Precondition:** DATABASE_URI set to Neon
- **Steps:**
  1. `DATABASE_URI=$NEON_URL npm run build`
- **Expected:** Build succeeds, no compilation errors

#### TC-P2.39: Full codebase DO reference scan
- **Priority:** P1
- **Type:** Regression
- **AC Reference:** AC-P2-04, AC-P2-08
- **Steps:**
  1. `grep -rn "ondigitalocean.app" src/`
  2. `grep -rn "hostname.*0\.0\.0\.0" src/`
  3. `grep -rn "DO_API_URL" src/`
- **Expected:** 0 active matches (TODOs/comments acceptable)

### Group J: Integration Checks

#### TC-P2.40: Lark notification URLs updated (Scenario #31)
- **Priority:** P3
- **Type:** Regression
- **Steps:**
  1. `grep -rn "ondigitalocean.app" .github/`
- **Expected:** 0 matches in action.yml files

#### TC-P2.41: TypeScript clean
- **Priority:** P1
- **Type:** Regression
- **AC Reference:** AC-P2-11
- **Steps:**
  1. `npx tsc --noEmit`
- **Expected:** 0 errors

#### TC-P2.42: Notification toast still works
- **Priority:** P2
- **Type:** E2E
- **AC Reference:** AC-P2-06
- **Steps:**
  1. Login → dashboard
  2. Trigger notification from admin
  3. Wait for poll cycle (15s)
- **Expected:** Toast appears bottom-right, notification bell updates count

---

## 6. Traceability Matrix

| AC | Description | Test Cases | Coverage |
|-----|-----------|----------|----------|
| AC-P2-01 | vercel.json correct | TC-P2.01 | ✅ Full |
| AC-P2-02 | db-setup --migrate-only works | TC-P2.03, .04, .05, .06, .07 | ✅ Full |
| AC-P2-03 | payload SSL rejectUnauthorized:true | TC-P2.08 | ✅ Full |
| AC-P2-04 | No DO/Docker refs in src/ | TC-P2.09, .10, .11, .39 | ✅ Full |
| AC-P2-05 | maxDuration <= 60 all routes | TC-P2.02, .24 | ✅ Full |
| AC-P2-06 | SSE deprecated, polling works | TC-P2.15–.25, .42 | ✅ Full |
| AC-P2-07 | Polling returns since timestamp | TC-P2.15, .18, .19 | ✅ Full |
| AC-P2-08 | No active DO API refs | TC-P2.28, .33, .35 | ✅ Full |
| AC-P2-09 | env examples updated | TC-P2.26, .27 | ✅ Full |
| AC-P2-10 | CI no DO deploy jobs | TC-P2.29, .30, .31, .32 | ✅ Full |
| AC-P2-11 | npm run build succeeds | TC-P2.38, .41 | ✅ Full |
| AC-P2-12 | Middleware no redirect loop | TC-P2.12, .13, .14 | ✅ Full |

## Scenario Coverage

| Severity | Total | Covered | % |
|----------|-------|---------|---|
| Critical (6) | 6 | 6 | 100% |
| High (13) | 13 | 13 | 100% |
| Medium (12) | 12 | 9 | 75% |
| Low (4) | 4 | 2 | 50% |
| **Total** | **35** | **30** | **86%** |

---

## 7. Quality Gates

| Gate | TCs | Requirement |
|------|-----|-------------|
| **Build** | TC-P2.03, .38, .41 | MUST PASS before any other test |
| **Security** | TC-P2.16, .17, .35 | MUST PASS — auth + tenant isolation |
| **Middleware** | TC-P2.11, .12, .13 | MUST PASS — no redirect loops |
| **Regression** | TC-P2.02, .09, .26, .28, .29, .39 | MUST PASS — no DO refs |
| **Polling** | TC-P2.15, .20 | MUST PASS — notifications work |
| **Nice-to-have** | TC-P2.14, .19, .21–25, .40 | Can defer |

---

## 8. References

- Phase 2 Plan: `plans/260409-2011-vercel-migration/phase-02-code-changes.md`
- Scenarios: `docs/qa/scenarios/vercel-phase2-code-changes.md`
- Parent QA: `docs/qa/vercel-neon-migration.md`
