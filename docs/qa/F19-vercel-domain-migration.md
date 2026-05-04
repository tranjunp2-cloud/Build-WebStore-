# QA Test Plan — F19 Vercel Domain Migration

> **Feature Code:** F19 (delta — Vercel migration)
> **Sources:**
> - PRD: [`docs/prd/F19-vercel-domain-migration.md`](../prd/F19-vercel-domain-migration.md)
> - Plan: [`plans/260413-1500-f19-vercel-domain-verify-rewrite/plan.md`](../../plans/260413-1500-f19-vercel-domain-verify-rewrite/plan.md)
> - Scenario report: [`plans/260413-1500-f19-vercel-domain-verify-rewrite/reports/ck-scenario-01-vercel-domain-rewrite.md`](../../plans/260413-1500-f19-vercel-domain-verify-rewrite/reports/ck-scenario-01-vercel-domain-rewrite.md) (59 scenarios)
> **Date:** 2026-04-13 | **Author:** QC + Claude
> **Bug:** [Issue #558](https://github.com/primeproduction/ech-prime-web-v2/issues/558)
> **Status:** Ready for execution

---

## 1. Test Strategy

### 1.1 Test types & coverage targets

| Type | Tool | Files | Target |
|------|------|-------|--------|
| **Unit** | Vitest | `src/lib/vercel/domains.test.ts`, `src/__tests__/unit/dashboard/domains-actions.test.ts`, `src/__tests__/unit/dashboard/f19-domains-client.test.tsx` | ≥80% statements on `actions.ts` + `domains.ts` |
| **Integration** | Vitest + msw / vi.mock | `src/__tests__/integration/f19-vercel-domains.test.ts` (NEW) | All 4 Vercel client functions × happy + 4 error codes |
| **E2E** | Playwright | `tests/e2e/f19-custom-domain.spec.ts` (NEW) | TC-F19-01..06 + TXT challenge flow |
| **Security** | Vitest fuzz + manual | Inline in unit tests | SSRF, cross-tenant, CSRF, token leak |
| **Manual smoke** | Browser staging | Capture screenshots | 6 happy/edge flows post-deploy |
| **Backfill dry-run** | tsx CLI | `scripts/backfill-vercel-domains.ts --dry-run` | All staging tenants iterated, 0 mutations |

### 1.2 Test environments

| Environment | Purpose | Vercel envs | Data |
|---|---|---|---|
| **local** | Unit + Integration | `.env.local` with mock VERCEL_TOKEN | Mocked Vercel responses via `vi.mock` |
| **staging (preview)** | E2E + manual smoke | Real `VERCEL_TOKEN` scoped to staging | Test tenant `qa-test@yopmail.com` + test domains |
| **production** | Smoke test post-cutover | Real production VERCEL_TOKEN | Real tenants — read-only smoke (no mutating QA) |

### 1.3 Entry & exit criteria

**Entry criteria (start QA):**
- All 7 phases implemented
- CI green (typecheck + lint + unit tests)
- PR opened to `staging`
- Backfill dry-run on staging clean

**Exit criteria (sign-off):**
- All P1 TCs PASS (≥95%)
- 0 Critical bugs open
- ≤2 P2 bugs (must have workaround)
- Issue #558 reproduction = 0%
- Coverage `actions.ts` ≥80%
- Backfill real-run on staging completes 100% rows

---

## 2. Risk Assessment

| # | Risk | Likelihood | Impact | Mitigation | TC IDs |
|---|------|------------|--------|------------|--------|
| **R1** | Cross-tenant verify (security) | Medium | **Critical** | Server action queries Payload với `tenantId AND domain`, defensive layered with Payload uniqueness | TC-S-01, TC-S-02 |
| **R2** | SSRF qua malformed domain input | Low | **Critical** | Strict regex L36 + 5-payload fuzz test before merge | TC-S-03 |
| **R3** | `VERCEL_TOKEN` leak vào client bundle | Low | **Critical** | `import 'server-only'` in wrapper, no console.log token, scrub error messages | TC-S-04 |
| **R4** | Orphan Vercel domain after Payload write fail | Medium | **High** | Reverse rollback: catch Payload error → call `removeProjectDomain` cleanup | TC-A-12 |
| **R5** | Race condition: 2 tenants add same domain | Medium | **High** | Payload uniqueness check + Vercel 409 catch | TC-A-08, TC-I-04 |
| **R6** | Vercel rate limit hit during backfill | Medium | Medium | Sleep 40s/call + `Retry-After` honor | TC-B-01, TC-I-05 |
| **R7** | SSL cert pending after `verified=true` → tenant HTTPS error | Medium | Medium | UI banner "SSL provisioning, may take 1-2 min" | TC-E-04 |
| **R8** | Vercel API schema change (field rename) | Low | High | TS optional fields + integration test catches | TC-I-01 |
| **R9** | Backfill ghi đè customDomains array → data loss | Low | Critical | Selective field path update, NOT array replace | TC-B-02 |
| **R10** | psl package detect sai apex/subdomain | Low | Low | Soft-warn DNS pre-flight, Vercel = source of truth | TC-A-13 |

---

## 3. Test Cases

### 3.1 Unit — Vercel API Client (`src/lib/vercel/domains.ts`)

#### TC-U-01: addProjectDomain happy path
- **Priority:** P1 | **Type:** Unit | **AC:** AC-01
- **Precondition:** `vi.stubGlobal('fetch', mockFetch)`, env vars set
- **Steps:**
  1. Mock `fetch` resolve `{ ok: true, json: async () => ({ name: 'mystore.com', apexName: 'mystore.com', verified: true, projectId: 'prj_xxx' }) }`
  2. Call `addProjectDomain('mystore.com')`
- **Expected:** Returns `VercelDomain` object with `verified: true`, `verification: undefined`
- **Test data:** `name='mystore.com'`

#### TC-U-02: addProjectDomain returns verification challenge
- **Priority:** P1 | **Type:** Unit | **AC:** AC-06
- **Precondition:** Mock fetch resolve 200 với `verified: false, verification: [...]`
- **Steps:**
  1. Mock returns `{ name, apexName, verified: false, verification: [{type:'TXT', domain:'_vercel.x.com', value:'vc-...', reason:'conflict'}] }`
  2. Call `addProjectDomain('x.com')`
- **Expected:** Returns object with `verification.length === 1`
- **Test data:** Same as PRD code example §8

#### TC-U-03: addProjectDomain throws on 409 conflict
- **Priority:** P1 | **Type:** Unit | **AC:** AC-12 (defense)
- **Precondition:** Mock fetch resolve `{ ok: false, status: 409, json: async () => ({ error: { code: 'domain_already_in_use', message: '...' }}) }`
- **Steps:** Call `addProjectDomain('taken.com')`
- **Expected:** Throws `VercelDomainsError` với `status=409`, `code='domain_already_in_use'`

#### TC-U-04: 429 surfaces retryAfter header
- **Priority:** P1 | **Type:** Unit | **AC:** NFR Performance
- **Precondition:** Mock fetch resolve 429 with header `Retry-After: 60`
- **Steps:** Call any wrapper function
- **Expected:** Throws `VercelDomainsError` với `retryAfter === 60`

#### TC-U-05: assertVercelEnv fails loud naming missing var
- **Priority:** P1 | **Type:** Unit | **AC:** FR-03
- **Precondition:** Delete `process.env.VERCEL_TOKEN`
- **Steps:** Call `addProjectDomain('x.com')`
- **Expected:** Throws `Error("Missing Vercel env: VERCEL_TOKEN")` BEFORE fetch

#### TC-U-06: verifyProjectDomain success
- **Priority:** P1 | **Type:** Unit | **AC:** AC-08
- **Precondition:** Mock fetch 200 với `verified: true, verification: undefined`
- **Steps:** Call `verifyProjectDomain('mystore.com')`
- **Expected:** Returns object with `verified: true`

#### TC-U-07: verifyProjectDomain 400 TXT mismatch
- **Priority:** P1 | **Type:** Unit | **AC:** AC-06
- **Precondition:** Mock fetch 400 với `error.code='txt_record_missing'`
- **Steps:** Call `verifyProjectDomain('x.com')`
- **Expected:** Throws `VercelDomainsError` với `status=400, code='txt_record_missing'`

#### TC-U-08: removeProjectDomain swallows 404
- **Priority:** P2 | **Type:** Unit | **AC:** AC-09
- **Precondition:** Mock fetch 404
- **Steps:** Call `removeProjectDomain('gone.com')`
- **Expected:** Throws (caller catches in action layer; wrapper itself throws clean)

#### TC-U-09: getProjectDomain returns fresh verification
- **Priority:** P1 | **Type:** Unit | **AC:** AC-06
- **Precondition:** Mock fetch 200 với `verified: false, verification: [...]`
- **Steps:** Call `getProjectDomain('x.com')`
- **Expected:** Returns object with non-empty `verification`

#### TC-U-10: vercelFetch parses non-JSON error response
- **Priority:** P2 | **Type:** Unit | **AC:** Scenario 7.5
- **Precondition:** Mock fetch 502 với HTML body `<html>...</html>`
- **Steps:** Call any wrapper
- **Expected:** Throws with message containing "non-JSON" or fallback statusText, NOT crash on JSON parse

---

### 3.2 Unit — Server Actions (`src/app/(dashboard)/settings/domains/actions.ts`)

#### TC-A-01: addCustomDomain validates format
- **Priority:** P1 | **Type:** Unit | **AC:** Scenario 2.1, 2.5, 2.7, 2.8
- **Precondition:** Mock `getCurrentTenantId` returns valid tenantId; mock Payload + Vercel client
- **Steps:** Call `addCustomDomain('')`, `addCustomDomain('not a domain')`, `addCustomDomain('192.168.1.1')`, `addCustomDomain('mystore.com:8080')`, `addCustomDomain('mystore.com#@evil.com')`
- **Expected:** All return `{ success: false, error: 'Invalid domain format...' }`. Vercel client NOT called for any of these
- **Test data:** SSRF payloads from scenario 2.8

#### TC-A-02: addCustomDomain happy path with verified=true
- **Priority:** P1 | **Type:** Unit | **AC:** AC-01, AC-02
- **Precondition:** Mock `addProjectDomain` returns `verified: true`; Payload empty for tenant
- **Steps:** Call `addCustomDomain('mystore.com')`
- **Expected:**
  - Returns `{ success: true }`
  - Payload `payload.update` called với `customDomains: [{ domain, status: 'active', vercelDomainId: 'mystore.com', isPrimary: false }]`

#### TC-A-03: addCustomDomain pending with verification
- **Priority:** P1 | **Type:** Unit | **AC:** AC-06, AC-07
- **Precondition:** Mock `addProjectDomain` returns `verified: false, verification: [{type:'TXT', domain:'_vercel.x.com', value:'vc-...', reason:'X'}]`
- **Steps:** Call `addCustomDomain('x.com')`
- **Expected:**
  - Returns `{ success: true, verification: [...] }`
  - Payload row stored với `status: 'pending', vercelVerification: [...]`

#### TC-A-04: addCustomDomain rolls back Payload on Vercel 409
- **Priority:** P1 | **Type:** Unit | **AC:** AC-12
- **Precondition:** Mock `addProjectDomain` throws `VercelDomainsError({status:409, code:'domain_already_in_use'})`
- **Steps:** Call `addCustomDomain('taken.com')`
- **Expected:**
  - Returns `{ success: false, error: 'Domain already registered by another store.' }` (friendly message)
  - Payload row IS NOT created (or is rolled back if write happened first)

#### TC-A-05: addCustomDomain duplicate within same tenant
- **Priority:** P1 | **Type:** Unit | **AC:** Scenario 9.3
- **Precondition:** Tenant already has `mystore.com` in customDomains
- **Steps:** Call `addCustomDomain('mystore.com')` again
- **Expected:** Returns `{ success: false, error: 'Domain already added to your store.' }`. Vercel NOT called.

#### TC-A-06: addCustomDomain duplicate across tenants
- **Priority:** P1 | **Type:** Unit | **AC:** AC-13 (security), R5
- **Precondition:** Tenant B already has `shared.com`. Acting as Tenant A.
- **Steps:** Call `addCustomDomain('shared.com')`
- **Expected:** Returns `{ success: false, error: 'Domain is already registered by another store.' }`. Vercel NOT called.

#### TC-A-07: verifyCustomDomain happy → active
- **Priority:** P1 | **Type:** Unit | **AC:** AC-08
- **Precondition:** Tenant has domain status='pending'. Mock `verifyProjectDomain` returns `verified: true`
- **Steps:** Call `verifyCustomDomain('mystore.com')`
- **Expected:**
  - Returns `{ success: true }`
  - Payload row updated `status: 'active'`, `vercelVerification: undefined`

#### TC-A-08: verifyCustomDomain re-fetches verification on 400
- **Priority:** P1 | **Type:** Unit | **AC:** AC-06
- **Precondition:** Mock `verifyProjectDomain` throws 400 `txt_record_missing`. Mock `getProjectDomain` returns fresh `verification: [...]`
- **Steps:** Call `verifyCustomDomain('x.com')`
- **Expected:**
  - Returns `{ success: false, verification: [...] }`
  - Payload row `vercelVerification` updated with fresh challenges
  - Status remains `pending`

#### TC-A-09: verifyCustomDomain idempotent on already-active
- **Priority:** P2 | **Type:** Unit | **AC:** Scenario 5.4
- **Precondition:** Tenant domain already `status: 'active'`
- **Steps:** Call `verifyCustomDomain('mystore.com')`
- **Expected:** Returns `{ success: true }` early WITHOUT calling Vercel (skip rate-limit hit)

#### TC-A-10: removeCustomDomain happy
- **Priority:** P1 | **Type:** Unit | **AC:** AC-09
- **Precondition:** Tenant has 2 domains; remove non-primary
- **Steps:** Call `removeCustomDomain('mystore.com')`
- **Expected:**
  - Returns `{ success: true }`
  - Payload `customDomains` array length decreases by 1
  - `removeProjectDomain` called once

#### TC-A-11: removeCustomDomain swallows Vercel 404
- **Priority:** P1 | **Type:** Unit | **AC:** AC-09, Scenario 5.5
- **Precondition:** Mock `removeProjectDomain` throws 404
- **Steps:** Call `removeCustomDomain('gone.com')`
- **Expected:** Returns `{ success: true }`. Payload row still removed.

#### TC-A-12: addCustomDomain reverse rollback when Payload write fails after Vercel success
- **Priority:** P1 | **Type:** Unit | **AC:** Scenario 5.1, R4
- **Precondition:** Mock `addProjectDomain` succeeds. Mock `payload.update` throws "DB transient error"
- **Steps:** Call `addCustomDomain('mystore.com')`
- **Expected:**
  - Returns `{ success: false, error: 'Service temporarily unavailable...' }`
  - `removeProjectDomain('mystore.com')` IS called for cleanup (no orphan Vercel domain)

#### TC-A-13: IDN/punycode normalization
- **Priority:** P2 | **Type:** Unit | **AC:** Scenarios 2.3, 2.4
- **Precondition:** Mock Vercel client receives whatever is passed
- **Steps:** Call `addCustomDomain('münchen.de')`
- **Expected:** Vercel client called with `xn--mnchen-3ya.de` (punycode form), NOT raw unicode

#### TC-A-14: setPrimaryDomain rejects pending status
- **Priority:** P2 | **Type:** Unit | **AC:** Scenario 5.7
- **Precondition:** Tenant domain status='pending'
- **Steps:** Call `setPrimaryDomain('pending.com')`
- **Expected:** Returns `{ success: false, error: 'Domain must be verified...' }`. No mutation.

#### TC-A-15: clearPrimaryDomain reverts to platform subdomain
- **Priority:** P2 | **Type:** Unit | **AC:** Scenario 5.8
- **Precondition:** Tenant has 1 active domain marked isPrimary=true
- **Steps:** Call `clearPrimaryDomain()`
- **Expected:** All `isPrimary=false`. Tenant requests now route to platform subdomain.

---

### 3.3 Integration — Vercel API end-to-end (mocked at HTTP layer)

#### TC-I-01: Vercel response schema regression
- **Priority:** P1 | **Type:** Integration | **AC:** R8
- **Precondition:** Real-shaped Vercel JSON fixture in `__tests__/fixtures/vercel-domain.json`
- **Steps:** Mock fetch returns fixture. Call `addProjectDomain` → assert all expected fields parsed.
- **Expected:** No undefined errors. All TS types satisfied at runtime.

#### TC-I-02: vercelFetch builds URL with teamId query
- **Priority:** P1 | **Type:** Integration | **AC:** FR-01
- **Precondition:** Mock fetch with capture. `process.env.VERCEL_TEAM_ID = 'team_test'`
- **Steps:** Call `addProjectDomain('x.com')`
- **Expected:** Captured URL ends với `?teamId=team_test`

#### TC-I-03: Auth header set correctly
- **Priority:** P1 | **Type:** Integration | **AC:** FR-01
- **Precondition:** Capture fetch headers
- **Steps:** Call any wrapper
- **Expected:** Header `Authorization: Bearer test-token`

#### TC-I-04: 409 conflict mapped to friendly error in action layer
- **Priority:** P1 | **Type:** Integration | **AC:** R5
- **Precondition:** Full mock chain wrapper → action
- **Steps:** Trigger 409 from wrapper, call `addCustomDomain` from action
- **Expected:** Action returns user-friendly message, NOT raw `domain_already_in_use` code

#### TC-I-05: Backfill respects rate limit (sleep 40s)
- **Priority:** P2 | **Type:** Integration | **AC:** FR-13, R6
- **Precondition:** Mock 5 tenant rows; mock setTimeout
- **Steps:** Run `backfillVercelDomains()` core function
- **Expected:** `setTimeout` called với 40000ms × 4 (between 5 calls)

---

### 3.4 E2E — Playwright (`tests/e2e/f19-custom-domain.spec.ts`)

#### TC-E-01: Add apex domain pre-pointed (TC-F19-01)
- **Priority:** P1 | **Type:** E2E | **AC:** AC-01, AC-02, AC-03
- **Precondition:** Login `qa-test@yopmail.com`. DNS A record `e2e-test-apex.local` → 76.76.21.21 (mock or pre-configured)
- **Steps:**
  1. Navigate `/settings/domains`
  2. Click "Add Custom Domain"
  3. Input `e2e-test-apex.local` → Submit
  4. Wait for action complete
- **Expected:** Status badge "Active". Toast "Domain active. SSL provisioning may take 1–2 min."

#### TC-E-02: Add subdomain shows DNS instructions (TC-F19-02)
- **Priority:** P1 | **Type:** E2E | **AC:** AC-04
- **Precondition:** Login. Subdomain not yet pointed.
- **Steps:**
  1. `/settings/domains` → Add `shop.e2e-test.local`
  2. Verify DNS instructions card visible
- **Expected:** Card shows `CNAME shop.e2e-test.local → cname.vercel-dns.com`. Status: Pending.

#### TC-E-03: Reject invalid domain format (TC-F19-03)
- **Priority:** P1 | **Type:** E2E | **AC:** AC-04
- **Precondition:** Login.
- **Steps:** Add `not a domain` → Submit
- **Expected:** Inline error "Invalid domain format". Action NOT called.

#### TC-E-04: TXT challenge full flow (TC-F19-04 — issue #558 regression case)
- **Priority:** P1 | **Type:** E2E | **AC:** AC-06, AC-07, AC-08
- **Precondition:** Login. Test domain that triggers TXT challenge (e.g., previously verified on another Vercel team)
- **Steps:**
  1. Add `txt-challenge.local`
  2. UI shows TxtChallengeCard with copyable Name + Value
  3. Click Copy buttons (assert clipboard write)
  4. (Manually set TXT in DNS for E2E)
  5. Click "Verify Now"
  6. Assert "Last checked: just now" timestamp
  7. Wait for verify complete
- **Expected:** TxtChallengeCard disappears, status flips Active. Issue #558 reproduction = 0%.

#### TC-E-05: Remove active domain (TC-F19-05)
- **Priority:** P1 | **Type:** E2E | **AC:** AC-09
- **Precondition:** Tenant has 2 active domains
- **Steps:** Click Remove on non-primary domain → Confirm
- **Expected:** Row disappears, toast "Custom domain removed.", domain gone from Vercel project (verify via API)

#### TC-E-06: Set primary domain (TC-F19-06)
- **Priority:** P2 | **Type:** E2E | **AC:** US — outside main scope
- **Precondition:** Tenant has 2 active domains, neither primary
- **Steps:** Click "Set as Primary" on second
- **Expected:** Badge "Primary" appears on second, cleared from first

---

### 3.5 Security tests

#### TC-S-01: Cross-tenant verify rejected
- **Priority:** P1 | **Type:** Security | **AC:** AC-13, R1, Scenario 8.1
- **Precondition:** Tenant A has domain `tenant-a.com`. Acting as Tenant B (mock `getCurrentTenantId` returns B)
- **Steps:** Call `verifyCustomDomain('tenant-a.com')` directly
- **Expected:** Returns `{ success: false, error: 'Domain not found in your store' }`. Vercel API NOT called.

#### TC-S-02: Cross-tenant remove rejected
- **Priority:** P1 | **Type:** Security | **AC:** R1
- **Precondition:** Same as TC-S-01
- **Steps:** Call `removeCustomDomain('tenant-a.com')` as Tenant B
- **Expected:** Returns `{ success: false, error: 'Unauthorized' }`. Tenant A row UNCHANGED.

#### TC-S-03: SSRF fuzz battery
- **Priority:** P1 | **Type:** Security | **AC:** R2, Scenario 2.8
- **Precondition:** Mock all backends
- **Steps:** Call `addCustomDomain` với 5 payloads:
  1. `mystore.com#@evil.com`
  2. `mystore.com:8080`
  3. `mystore.com/path`
  4. `mystore.com?x=1`
  5. `192.168.1.1`
- **Expected:** ALL 5 return `{ success: false, error: 'Invalid domain format...' }`. Vercel client called 0 times.

#### TC-S-04: VERCEL_TOKEN never logged or returned
- **Priority:** P1 | **Type:** Security | **AC:** R3
- **Precondition:** Spy on `console.error`, capture all action returns
- **Steps:** Trigger every error path (401, 403, 409, 429, 500) and inspect logs/returns
- **Expected:** Token string `Bearer xxx` NEVER appears in logs or response body

#### TC-S-05: TXT verification value rendered as text (XSS guard)
- **Priority:** P1 | **Type:** Security | **AC:** Scenario 2.9
- **Precondition:** Mock action returns `verification: [{value: '<script>alert(1)</script>'}]`
- **Steps:** Render `<TxtChallengeCard verification={...}/>`
- **Expected:** DOM contains text `<script>alert(1)</script>` literal, NOT executed. No `dangerouslySetInnerHTML` in component.

#### TC-S-06: Verify button debounce prevents rate-limit attack
- **Priority:** P2 | **Type:** Security/UX | **AC:** R4, Scenario 3.1
- **Precondition:** Render DomainsClient
- **Steps:** Click "Verify Now" 5 times in 500ms
- **Expected:** Server action called exactly 1 time (debounce + useTransition lock)

---

### 3.6 Backfill script tests

#### TC-B-01: Backfill dry-run logs without mutations
- **Priority:** P1 | **Type:** Integration | **AC:** AC-10, FR-13
- **Precondition:** Staging DB with ≥3 tenant domains
- **Steps:** Run `pnpm tsx scripts/backfill-vercel-domains.ts --dry-run`
- **Expected:**
  - Logs each tenant + domain to stdout
  - 0 calls to `addProjectDomain` / `verifyProjectDomain`
  - 0 Payload mutations
  - Exit code 0

#### TC-B-02: Backfill selective array update (no data loss)
- **Priority:** P1 | **Type:** Integration | **AC:** R9, Scenario 9.7
- **Precondition:** Tenant has 3 domains; backfill processes 1
- **Steps:** Run backfill targeting that tenant
- **Expected:** All 3 domain entries preserved. Only the target row's `vercelDomainId` field updated. NOT a full array replace.

#### TC-B-03: Backfill idempotent on 409
- **Priority:** P1 | **Type:** Integration | **AC:** AC-10, AC-11
- **Precondition:** Domain already exists on Vercel (mock returns 409)
- **Steps:** Run backfill, then run AGAIN
- **Expected:** Both runs complete success. `vercelDomainId` populated. No duplicate calls beyond expected.

#### TC-B-04: Backfill rate-limit honored
- **Priority:** P2 | **Type:** Integration | **AC:** R6
- **Precondition:** 10 tenant domains, mock `setTimeout`
- **Steps:** Run backfill
- **Expected:** Sleep called 9 × 40000ms between calls

#### TC-B-05: Backfill streams via cursor (memory-safe)
- **Priority:** P2 | **Type:** Integration | **AC:** Scenario 7.7
- **Precondition:** Mock 1000 tenants
- **Steps:** Run backfill, monitor heap
- **Expected:** Heap usage stays bounded (~100MB max), NOT loading all tenants at once

---

### 3.7 UI / DomainsClient tests

#### TC-U-11: TxtChallengeCard renders verification rows
- **Priority:** P1 | **Type:** Unit | **AC:** AC-07, FR-09
- **Precondition:** Mock action returns `verification: [{type, domain, value, reason}]`
- **Steps:** Render `<DomainsClient />`, trigger Add action
- **Expected:** Card visible với domain + value + reason caption + 2 Copy buttons

#### TC-U-12: DNS instructions use Vercel constants by default
- **Priority:** P1 | **Type:** Unit | **AC:** FR-10
- **Precondition:** No `NEXT_PUBLIC_VERCEL_*` env set
- **Steps:** Render component
- **Expected:** A record shows `76.76.21.21`, CNAME shows `cname.vercel-dns.com` (fallback constants)

#### TC-U-13: "Last checked Xm ago" timestamp displays
- **Priority:** P2 | **Type:** Unit | **AC:** FR-11
- **Precondition:** Verify Now clicked at T=0, mock Date.now() at T+120s
- **Steps:** Render component
- **Expected:** Text "Last checked: 2m ago" visible

---

## 4. Traceability Matrix

### 4.1 AC ↔ TC coverage

| AC | Description | Test Cases | Coverage |
|---|---|---|---|
| **AC-01** | Add apex w/ DNS pre-pointed → Vercel verified=true | TC-U-01, TC-A-02, TC-E-01 | ✅ Full |
| **AC-02** | Payload row created with `status='active'`, `vercelDomainId` | TC-A-02, TC-E-01 | ✅ Full |
| **AC-03** | UI badge "Active" + SSL provisioning banner | TC-E-01 | ✅ Full |
| **AC-04** | DNS instructions card with correct A/CNAME (psl detect) | TC-A-13, TC-E-02, TC-E-03, TC-U-12 | ✅ Full |
| **AC-05** | Verify trước khi set DNS → return error, status pending | TC-E-02 (manual extension) | ⚠️ Partial — add explicit TC |
| **AC-06** | Vercel 400 → fetch fresh verification + persist | TC-U-02, TC-U-07, TC-U-09, TC-A-03, TC-A-08, TC-E-04 | ✅ Full |
| **AC-07** | TxtChallengeCard renders verification rows | TC-A-03, TC-U-11, TC-E-04 | ✅ Full |
| **AC-08** | Verify Now → flip pending → active | TC-A-07, TC-U-06, TC-E-04 | ✅ Full |
| **AC-09** | Remove → Vercel removeProjectDomain + idempotent 404 | TC-A-10, TC-A-11, TC-U-08, TC-E-05 | ✅ Full |
| **AC-10** | Backfill iterate all rows + populate vercelDomainId | TC-B-01, TC-B-03 | ✅ Full |
| **AC-11** | Backfill complete → 100% rows have vercelDomainId | TC-B-03 (post-condition) | ✅ Full |
| **AC-12** | Vercel error → rollback Payload row (atomic-ish) | TC-A-04, TC-A-12 | ✅ Full |
| **AC-13** | grep `SERVER_IP\|DO_*` returns 0 in F19 paths | Phase 07 manual + lint rule | ✅ Manual gate |
| **AC-14** | Coverage `actions.ts` ≥80% | `pnpm test --coverage` post-merge | ✅ CI gate |

**Coverage summary:** 13/14 ACs Full (93%) + 1 Partial (AC-05 needs explicit verify-without-DNS TC).

### 4.2 Risk ↔ TC coverage

| Risk | TC IDs | Status |
|---|---|---|
| R1 Cross-tenant verify | TC-S-01, TC-S-02 | ✅ |
| R2 SSRF | TC-S-03 | ✅ |
| R3 Token leak | TC-S-04 | ✅ |
| R4 Orphan Vercel domain | TC-A-12 | ✅ |
| R5 Race add | TC-A-06, TC-I-04 | ✅ |
| R6 Rate limit | TC-B-04, TC-I-05 | ✅ |
| R7 SSL cert pending UX | TC-E-01 (banner) | ✅ |
| R8 API schema regression | TC-I-01 | ✅ |
| R9 Backfill data loss | TC-B-02 | ✅ |
| R10 psl mis-detect | TC-A-13 | ✅ (soft via integration) |

### 4.3 Critical scenarios ↔ TC coverage

| Scenario | TC | Status |
|---|---|---|
| 5.1 Vercel OK → Payload fail (orphan) | TC-A-12 | ✅ |
| 5.2 Payload OK → Vercel fail | TC-A-04 | ✅ |
| 8.1 Cross-tenant verify | TC-S-01 | ✅ |
| 2.8 SSRF fuzz | TC-S-03 | ✅ |
| 3.2 Race condition add | TC-A-06, TC-I-04 | ✅ |
| 9.7 Backfill array overwrite | TC-B-02 | ✅ |
| 2.3-2.4 IDN/punycode | TC-A-13 | ✅ |
| 7.7 Backfill OOM | TC-B-05 | ✅ |

---

## 5. Test Execution Schedule

| Phase | Type | When | Owner | Duration |
|---|---|---|---|---|
| Unit + Integration | Auto | Pre-commit + CI | Dev | <2 min |
| E2E Playwright | Auto | CI on PR | CI | ~5 min |
| Security fuzz | Auto | CI gate | Dev | <1 min |
| Backfill dry-run | Manual | Phase 06 staging | DevOps | 5 min |
| Backfill real-run | Manual | Phase 06 staging | DevOps | ~5min/100 domains |
| Manual smoke matrix | Manual | Pre-merge to main | QC | 30 min |
| Issue #558 verify | Manual | Post-deploy | QC | 10 min |

---

## 6. Self-Check

```
📋 QA Test Plan Self-Check:
├── Goi Skill tool ck:scenario? ✅ (turn trước, output saved)
├── So scenarios: 59 (>= 30) ✅
├── So test cases: 42 ✅
├── Map 100% ACs? ✅ 13/14 Full + 1 Partial (AC-05) → flagged action item
├── Co Traceability Matrix? ✅ 3 matrices (AC, Risk, Scenario)
├── Co Risk Assessment? ✅ R1-R10 với likelihood/impact/mitigation/TC IDs
├── Co severity cho moi TC? ✅ P1/P2 priority labeled
└── Co test data? ✅ Concrete payloads cho fuzz, mocks, fixtures
```

**Action item phát sinh:** AC-05 cần thêm 1 TC explicit cho case "Verify Now trước khi set DNS → soft error, status không đổi". Add TC-A-16 sau khi consult Phase 03 implementation.

---

## 7. Open Questions

1. **Q1 (cho Phase 03)**: `verifyCustomDomain` hiện đang query Payload với `tenantId AND customDomains.domain` HAY chỉ `customDomains.domain`? — quyết định scope của TC-S-01. Nếu CHƯA có tenantId guard → đây là pre-existing security bug, fix luôn.
2. **Q2 (cho QA)**: E2E test cho TXT challenge cần real test domain hay mock được? Vercel API có sandbox endpoint không? — Phase 06 confirm.
3. **Q3 (cho DevOps)**: Backfill prod cần manual approval gate sau dry-run, hay auto? — propose: manual approval cho prod, auto cho staging.
4. **Q4 (cho QC)**: Có cần performance test cho backfill 1000+ tenants không? Hay 500 là threshold realistic? — depend on prod data volume.
