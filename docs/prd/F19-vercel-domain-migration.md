# PRD — F19 Vercel Domain Migration (Bug #558 Fix)

> **Document Status:** Approved (validated 2026-04-13, 9 decisions LOCKED)
> **Feature Code:** F19 — delta of [F19-store-configuration.md](./F19-store-configuration.md)
> **Author:** PM (haynoikonike + Claude)
> **Date:** 2026-04-13
> **Sprint Target:** Current sprint (P0 hotfix)
> **Ticket:** [issue #558](https://github.com/primeproduction/ech-prime-web-v2/issues/558)
> **Implementation Plan:** [plans/260413-1500-f19-vercel-domain-verify-rewrite/plan.md](../../plans/260413-1500-f19-vercel-domain-verify-rewrite/plan.md)
> **Effort:** 7.5h (7 phases, 1 PR)

---

## 1. Problem Statement

**What broke.** Sau khi platform migration từ DigitalOcean → Vercel (PR #56, 2026-04-12), tính năng F19 Custom Domain trên staging hoàn toàn không sử dụng được. Khi tenant click "Verify domain", server action trả ra lỗi:

```
Domain verification is not available. Server configuration is missing (SERVER_IP).
Please contact support.
```

**Tại sao xảy ra.** Server action `verifyCustomDomain` ở `src/app/(dashboard)/settings/domains/actions.ts:225-234` đang hard-block khi `process.env.SERVER_IP` không set. Trên Vercel, env này không tồn tại (DigitalOcean-specific). Sâu hơn nữa — toàn bộ phase check SSL của 5 server actions (L74-117, L164-195, L253-292) gọi DigitalOcean App Spec API qua `DO_API_TOKEN` + `DO_APP_ID`, mà cả 2 env này đã bị purge khỏi Vercel project.

**Ai bị ảnh hưởng.**
- **Tenants (Sellers)** không thể connect custom domain → mất khả năng brand store với apex domain riêng → mất doanh thu.
- **QA team** không pass được TC-F19-04 → blocker cho release v1.0 Phase 1.
- **CSM team** phải trả lời ticket support thủ công, không có self-serve flow.

**Tại sao quan trọng.** Custom domain là feature billing-critical. Tenants paying for Business tier expect to bring their own domain. Bug này phá scope core của F19 PRD gốc (F19-store-configuration.md §3 In Scope) trên môi trường staging và sẽ phá production ngay khi migration tới prod nếu không fix.

**Bằng chứng:**
- Issue #558 reported by Ary (Phạm Thị Thảo Ngân — QC) ngày 2026-04-13.
- Screenshot lỗi trong issue body (2 ảnh từ user-attachments).
- Code grep: `SERVER_IP` xuất hiện 32 file paths (theo audit scout-01).

---

## 2. Goals & Success Metrics

| # | Goal | Metric | Target |
|---|------|--------|--------|
| G1 | Restore F19 custom domain verification trên staging | Issue #558 reproduction | **0% reproduction** sau deploy |
| G2 | Purge tất cả DigitalOcean references khỏi F19 code path | `grep -rn 'SERVER_IP\|DO_API_TOKEN\|DO_APP_ID\|DigitalOcean' src/app/(dashboard)/settings/domains/` | **0 matches** |
| G3 | Tenants có thể self-serve add + verify domain mới | Manual smoke test (1 apex + 1 subdomain + 1 TXT-challenge case) | **3/3 pass** |
| G4 | Existing tenant domains tiếp tục hoạt động sau cutover | Backfill script staging run | **100% rows có `vercelDomainId`** |
| G5 | Test coverage cho F19 actions giữ ≥80% | `pnpm test --coverage src/app/(dashboard)/settings/domains/` | **≥80% statements** |
| G6 | TC-F19-01 đến TC-F19-06 pass | QA matrix Phase 07 | **6/6 green** |

---

## 3. Non-Goals (Out of Scope)

- **OAuth Vercel Integration cho per-customer token.** 1 team-scoped `VERCEL_TOKEN` đã đủ — single point of credential.
- **Wildcard apex domain support.** Wildcard chỉ áp dụng cho subdomain dưới root anh control (`*.platform.com`), không cover tenant apex (`*.mystore.com` không khả thi với Let's Encrypt).
- **Cert misconfiguration webhook.** Vercel không document webhook cho event "domain misconfigured" — defer làm follow-up issue.
- **HTTPS HEAD probe để verify cert thực sự issued.** LOCKED decision: trust Vercel `verified=true` flag, show banner provisioning thay vì add probe latency.
- **Auto-poll TXT verification.** LOCKED: manual click "Verify Now" button, không background poll.
- **UI cho phép tenant chọn region SSL hay edge config.** Vercel auto.
- **Migration của F19 RBAC/Staff features.** Outside scope, không liên quan DO migration.
- **Đổi schema `customDomains.status` enum.** Giữ `pending | active`, không thêm `vercel_error` (rollback policy là xóa row chứ không leave error state).

---

## 4. User Stories

### US-1 — Tenant add apex domain đã trỏ DNS sẵn
```
Là Store Owner đang sở hữu mystore.com với A record đã trỏ về Vercel,
Tôi muốn add domain vào store + click verify trong 1 lần,
Để brand store ngay lập tức không phải chờ TXT challenge.
```

### US-2 — Tenant add domain mới chưa setup DNS
```
Là Store Owner mới mua newshop.io,
Tôi muốn add domain vào store và nhận hướng dẫn cụ thể về DNS records cần set,
Để biết chính xác phải làm gì ở registrar (GoDaddy, Namecheap, AWS Route 53).
```

### US-3 — Tenant add domain cần TXT ownership challenge
```
Là Store Owner add domain đã từng dùng cho project Vercel khác,
Tôi muốn thấy TXT record name + value để paste vào DNS,
Sau khi propagate DNS thì click "Verify Now" để confirm sở hữu.
```

### US-4 — Tenant remove domain không còn dùng
```
Là Store Owner đã đổi brand,
Tôi muốn remove old-store.com khỏi store,
Để Vercel không còn route traffic và domain available cho tenant khác.
```

### US-5 — Migration backfill cho tenants existing
```
Là Platform Engineer (haynoikonike),
Tôi muốn chạy 1 lệnh script để register lại tất cả existing tenant domains lên Vercel,
Để không có tenant nào bị mất khả năng verify sau cutover.
```

### Acceptance Criteria

**US-1: Add apex domain đã trỏ DNS**
- [ ] **AC-01** Given DNS A record của `mystore.com` → `76.76.21.21`, when tenant add `mystore.com` qua UI, then server action gọi `addProjectDomain('mystore.com')` và Vercel trả `verified: true` + `verification: undefined`.
- [ ] **AC-02** Given AC-01, when action complete, then Payload `tenants.customDomains` row được tạo với `{ domain, status: 'active', vercelDomainId: 'mystore.com' }`.
- [ ] **AC-03** Given AC-02, when UI re-render, then status badge hiện "Active" + banner "SSL provisioning, may take 1–2 min".

**US-2: Add domain chưa setup DNS**
- [ ] **AC-04** Given DNS chưa trỏ, when tenant add `newshop.io`, then UI hiển thị DNS instructions card với A record `76.76.21.21` (apex) HOẶC CNAME `cname.vercel-dns.com` (subdomain), detect bằng `psl` package.
- [ ] **AC-05** Given AC-04, when tenant click "Verify Now" trước khi set DNS, then action trả `{ ok: false, error: 'DNS records not found...' }` và UI giữ status `pending`.

**US-3: TXT ownership challenge**
- [ ] **AC-06** Given Vercel trả 400 với reason `txt_record_missing`, when verifyCustomDomain xử lý, then action call `getProjectDomain` để fetch fresh `verification[]` và persist vào `tenants.customDomains[].vercelVerification`.
- [ ] **AC-07** Given AC-06, when UI render lại, then `<TxtChallengeCard>` xuất hiện với `verification[].domain` + `verification[].value` trong copyable code blocks.
- [ ] **AC-08** Given tenant đã set TXT record, when click "Verify Now", then verifyProjectDomain succeed, `verification` clear, status flip → active.

**US-4: Remove domain**
- [ ] **AC-09** Given domain `mystore.com` status active, when tenant click Remove, then `removeProjectDomain` được gọi và Payload row bị xóa, không error nếu Vercel trả 404 (idempotent).

**US-5: Backfill**
- [ ] **AC-10** Given staging Payload có N rows tenant.customDomains, when chạy `pnpm tsx scripts/backfill-vercel-domains.ts`, then mỗi row được gọi `addProjectDomain` + `verifyProjectDomain` với rate limit 1 call/40s, idempotent (409 swallow), populate `vercelDomainId`.
- [ ] **AC-11** Given backfill complete, when query Payload, then 100% rows có `vercelDomainId !== null`.

**Cross-cutting (security + reliability)**
- [ ] **AC-12** Given Vercel `addProjectDomain` throw error sau Payload write, when action handle, then Payload row vừa tạo bị rollback (xóa) và error message friendly trả về tenant — **không leave orphan row**.
- [ ] **AC-13** Given grep `'SERVER_IP\|DO_API_TOKEN\|DO_APP_ID'` trong `src/app/(dashboard)/settings/domains/`, when CI run, then **0 matches**.
- [ ] **AC-14** Given test suite run, when `pnpm test`, then 100% F19 tests pass + coverage `actions.ts` ≥80%.

---

## 5. Functional Requirements

| ID | Requirement | Priority | Phase |
|----|-------------|----------|-------|
| **FR-01** | Tạo Vercel API client wrapper `src/lib/vercel/domains.ts` với 4 functions: `addProjectDomain`, `verifyProjectDomain`, `getProjectDomain`, `removeProjectDomain`. Sử dụng plain `fetch`, no SDK, server-only. | Must | 01 |
| **FR-02** | Wrapper phải throw `VercelDomainsError` typed class với fields `{ status, code, message, retryAfter? }`, parse Vercel error JSON, propagate `Retry-After` header trên 429. | Must | 01 |
| **FR-03** | Wrapper phải gọi `assertVercelEnv()` lazy mỗi function — fail loud nếu thiếu `VERCEL_TOKEN` / `VERCEL_TEAM_ID` / `VERCEL_PROJECT_ID`, naming missing var. | Must | 01 |
| **FR-04** | Schema Payload `Tenants.customDomains` array thêm 2 field optional: `vercelDomainId: text` + `vercelVerification: json`. Không SQL/Mongo migration vì JSON storage. | Must | 02 |
| **FR-05** | `addCustomDomain` server action rewrite: validate format (existing) → write Payload row pending → call `addProjectDomain` → on success persist `vercelDomainId` + status='active'/'pending' theo `verified` flag → on error rollback Payload row. | Must | 03 |
| **FR-06** | `verifyCustomDomain` rewrite: state machine 3-state. `verified=true && !verification` → active. `verified=false` HOẶC error 400 → fetch fresh `verification[]` qua `getProjectDomain`, persist, return tới UI. Other 4xx/5xx → return error message friendly. | Must | 03 |
| **FR-07** | `removeCustomDomain` rewrite: remove Payload row → call `removeProjectDomain` → swallow 404 (idempotent). | Must | 03 |
| **FR-08** | DNS pre-flight: dùng `psl` package detect apex vs subdomain (handle ccTLD như .co.uk, .com.vn). Apex → check `dns.resolve4` includes `76.76.21.21`. Subdomain → check `dns.resolveCname` ends với `.vercel-dns.com`. Soft-warn, không hard-fail. | Must | 03 |
| **FR-09** | UI `DomainsClient.tsx` thêm component `<TxtChallengeCard>` render khi action return `verification[]`. Mỗi row có copy button cho `domain` + `value`, caption từ `reason`. | Must | 04 |
| **FR-10** | UI swap env constants: `NEXT_PUBLIC_SERVER_IP` → `NEXT_PUBLIC_VERCEL_APEX_IP`, `NEXT_PUBLIC_CNAME_TARGET` → `NEXT_PUBLIC_VERCEL_CNAME_TARGET`, fallback hardcoded `76.76.21.21` / `cname.vercel-dns.com`. | Must | 04 |
| **FR-11** | "Verify Now" button có debounce 1s + `useTransition` lock + display "Last checked: Xm ago" timestamp. KHÔNG auto-poll. | Must | 04 |
| **FR-12** | Test mocks: 3 file `__tests__/` swap DO env stubs → `vi.mock('@/lib/vercel/domains')` factory. Cover happy path + 409 conflict + 400 TXT missing + 404 remove + verify → active flip. | Must | 05 |
| **FR-13** | Backfill script `scripts/backfill-vercel-domains.ts`: load Payload local API → query all tenants với customDomains.length>0 → call `addProjectDomain` + `verifyProjectDomain` mỗi row, sleep 40s giữa các call, log progress, idempotent. Hỗ trợ `--dry-run`. | Must | 06 |
| **FR-14** | `.env.example` + `.env.staging.example` + `.env.production.example` thêm 7 vars mới (5 server + 2 NEXT_PUBLIC), mark old vars `# REMOVED 2026-04-13`. | Must | 06 |
| **FR-15** | Update `docs/architecture/F19-store-configuration.md` provisioning section: replace DO app-spec flow → Vercel addProjectDomain/verify state machine, update env-var table. | Should | 07 |
| **FR-16** | Issue #558 close-out: post staging screenshots gallery + production smoke test result + reference PR number. | Should | 07 |

---

## 6. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| **Performance** | `addCustomDomain` action latency (server-side) | **<2s p95** (Vercel API ~500ms + Payload write ~300ms) |
| **Performance** | `verifyCustomDomain` latency | **<3s p95** (Vercel verify call có thể chậm 1–2s) |
| **Performance** | Backfill throughput | **1 domain / 40s** (rate limit 100/hr per team) |
| **Reliability** | Action error rate | **<1%** trong 24h sau deploy (excluding tenant DNS misconfig) |
| **Reliability** | Backfill idempotency | **100% re-runnable** không tạo duplicate, 409 swallow |
| **Security** | `VERCEL_TOKEN` exposure | **0 references** trong client bundle, log, error message |
| **Security** | Tenant isolation | Tenant A KHÔNG add được domain owned by Tenant B (defense in depth: Payload uniqueness + Vercel 409) |
| **Security** | TXT challenge XSS | Render `verification.value` as text content, không HTML inject |
| **Test coverage** | `actions.ts` statements coverage | **≥80%** (existing baseline) |
| **Accessibility** | TxtChallengeCard | WCAG 2.1 AA — copy button có aria-label, code blocks có role=code |
| **Backward compat** | Existing tenant rows | Load không error, optional fields = undefined hợp lệ |
| **Observability** | Vercel API errors | Logged via `console.error` với `code` field, không log token |

---

## 7. UI/UX Requirements

**Figma:** N/A — UI delta nhỏ, inline trong existing `DomainsClient.tsx`. Thiết kế follows existing settings page pattern.

**Key user flows:**

### Flow A — Apex domain pre-pointed (happy path)
```
1. Tenant ở /settings/domains
2. Click "Add Custom Domain"
3. Nhập "mystore.com" → Submit
4. Server: addProjectDomain → verified=true (DNS already correct)
5. UI: status badge "Active" + toast "Domain active. SSL provisioning may take 1–2 min."
```

### Flow B — Subdomain chưa setup (DNS instructions)
```
1. Tenant nhập "shop.mystore.com" → Submit
2. Server: addProjectDomain → verified=false, không có verification[] (chưa conflict)
3. UI: status "Pending" + DnsInstructionsCard hiện "CNAME shop.mystore.com → cname.vercel-dns.com"
4. Tenant set CNAME ở registrar
5. Tenant click "Verify Now"
6. Server: verifyProjectDomain → verified=true → flip 'active'
```

### Flow C — TXT challenge (domain conflict / advanced)
```
1. Tenant nhập "premium.com" → Submit
2. Server: addProjectDomain → verified=false, verification: [{type:'TXT', domain:'_vercel.premium.com', value:'vc-domain-verify=...'}]
3. UI: status "Pending" + DnsInstructionsCard + TxtChallengeCard mới
4. TxtChallengeCard hiển thị:
   "Add this TXT record to prove ownership:
    Name: _vercel.premium.com  [Copy]
    Value: vc-domain-verify=...   [Copy]
    Reason: Domain previously verified on another Vercel team"
5. Tenant paste TXT vào registrar
6. Click "Verify Now" → 'Last checked: just now'
7. Server: verifyProjectDomain → verified=true → active
```

**Visual changes vs existing:**
- DNS_A_RECORD: `162.159.140.98` (Cloudflare) → `76.76.21.21` (Vercel)
- DNS_CNAME: thay đổi tùy env
- New: `<TxtChallengeCard>` (chỉ render khi có verification)
- New: "Last checked: Xm ago" timestamp dưới Verify button
- Updated toast copy: 4 strings (success/pending-with-txt/already-active/error)

---

## 8. Technical Notes

### Architecture — Vercel verify state machine (Phase 03)

```
┌─────────────────────────────────────────────────────────┐
│  verifyCustomDomain(domain)                              │
└─────────────────────────────────────────────────────────┘
              │
              ▼
   ┌──────────────────────┐
   │ verifyProjectDomain  │
   └──────────────────────┘
              │
       ┌──────┴──────┐
       │             │
       ▼             ▼
   ┌────────┐   ┌─────────┐
   │ 200 ok │   │ 4xx err │
   └───┬────┘   └────┬────┘
       │             │
       ▼             ▼
  verified?    ┌──────────────┐
   ┌──┴──┐     │ getProjDomain│
   yes  no     └──────┬───────┘
   │     │            │
   ▼     ▼            ▼
 active  persist  persist
         verification verification
         return    return
```

### Code examples

**Vercel client wrapper (Phase 01):**
```ts
// src/lib/vercel/domains.ts
import 'server-only';
import type { VercelDomain } from './domains.types';

const BASE = 'https://api.vercel.com';

function assertVercelEnv() {
  const missing = ['VERCEL_TOKEN', 'VERCEL_TEAM_ID', 'VERCEL_PROJECT_ID']
    .filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing Vercel env: ${missing.join(', ')}`);
}

async function vercelFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertVercelEnv();
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}teamId=${process.env.VERCEL_TEAM_ID}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new VercelDomainsError({
      status: res.status,
      code: body?.error?.code ?? 'unknown',
      message: body?.error?.message ?? res.statusText,
      retryAfter: Number(res.headers.get('Retry-After')) || undefined,
    });
  }
  return res.json() as Promise<T>;
}

export async function addProjectDomain(name: string): Promise<VercelDomain> {
  return vercelFetch<VercelDomain>(
    `/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains`,
    { method: 'POST', body: JSON.stringify({ name }) },
  );
}
```

**Type definitions (Phase 01):**
```ts
// src/lib/vercel/domains.types.ts
export interface VercelDomain {
  name: string;
  apexName: string;
  projectId: string;
  verified: boolean;
  verification?: VercelDomainVerification[];
  createdAt: number;
  updatedAt: number;
}

export interface VercelDomainVerification {
  type: 'TXT';
  domain: string;
  value: string;
  reason: string;
}

export class VercelDomainsError extends Error {
  status: number;
  code: string;
  retryAfter?: number;
  constructor(args: { status: number; code: string; message: string; retryAfter?: number }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.retryAfter = args.retryAfter;
  }
}
```

**Payload schema delta (Phase 02):**
```ts
// src/collections/Tenants.ts (insert into customDomains array fields)
{
  name: 'vercelDomainId',
  type: 'text',
  admin: { description: 'Vercel project-domain handle. Auto-managed.', readOnly: true },
},
{
  name: 'vercelVerification',
  type: 'json',
  admin: { description: 'Outstanding TXT challenges from Vercel verify. Auto-managed.', readOnly: true },
},
```

### Database changes
- **None at SQL/Mongo level.** Payload v3 array fields stored as JSON → adding optional fields = additive, no migration.
- Existing rows simply have `vercelDomainId === undefined` until backfill populates them.

### Third-party integrations
- **Vercel REST API v9/v10** — endpoints documented in research/researcher-01-vercel-domains-api.md.
- **`psl` npm package** — Public Suffix List for apex/subdomain detection. New dep, ~50KB, server-only.

### Migration considerations
- **Backfill script** chạy idempotent, safe to re-run.
- **Cutover anytime** — không cần maintenance window (LOCKED Round 2 decision).
- **Rollback insurance:** giữ DO env vars trong Vercel project 24h post-deploy (mark as deprecated), xóa sau khi prod smoke test xanh.

### Env vars matrix

| Var | Server | Client | Default | Required |
|-----|--------|--------|---------|----------|
| `VERCEL_TOKEN` | ✅ | ❌ | none (secret) | Yes |
| `VERCEL_TEAM_ID` | ✅ | ❌ | none | Yes |
| `VERCEL_PROJECT_ID` | ✅ | ❌ | none | Yes |
| `VERCEL_APEX_A_RECORD` | ✅ | ❌ | `76.76.21.21` | No |
| `VERCEL_CNAME_TARGET` | ✅ | ❌ | `cname.vercel-dns.com` | No |
| `NEXT_PUBLIC_VERCEL_APEX_IP` | ✅ | ✅ | `76.76.21.21` | No |
| `NEXT_PUBLIC_VERCEL_CNAME_TARGET` | ✅ | ✅ | `cname.vercel-dns.com` | No |

**REMOVED:** `SERVER_IP`, `NEXT_PUBLIC_SERVER_IP`, `DO_API_TOKEN`, `DO_APP_ID`, `NEXT_PUBLIC_CNAME_TARGET`

---

## 9. Dependencies

**Blocked by:**
- ❌ None — issue #558 hiện tại đang block QA, không có upstream block.

**Blocks:**
- F19 v1.0 release acceptance (TC-F19-04 phải pass)
- Production cutover lên Vercel (hiện đang dùng staging cho QC, prod chưa migrate)
- Các tenant Business tier muốn connect custom domain (revenue impact)

**External dependencies:**
- Vercel team account access (haynoikonike) để generate `VERCEL_TOKEN`
- Vercel REST API availability (Vercel uptime SLA 99.99%)
- `psl` npm package (well-maintained, ~10M downloads/week)

---

## 10. Risk Assessment

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| **R1** | `VERCEL_TOKEN` leak (full team scope = wide blast radius) | Low | Critical | Token chỉ store trong Vercel envs + 1Password. Never log. `import 'server-only'` chặn client bundle. Rotate immediately if leaked. Audit Vercel team logs sau deploy. |
| **R2** | Rate limit 100/hr/team trong backfill cho prod nếu >100 domains | Medium | Medium | Backfill sleep 40s/call → 90/hr. Idempotent (409 swallow) → re-runnable. Pre-flight check count tenant rows trước khi run real backfill. |
| **R3** | Vercel API schema thay đổi (undocumented field rename) | Low | High | TS types treat unknown fields optional. Không destructure beyond cần thiết. Phase 01 unit tests catch regression sớm. |
| **R4** | Race condition khi tenant click Verify 2 lần nhanh → hit rate limit 50/hr | Medium | Low | Client-side debounce + `useTransition` lock. Server: early return nếu status đã active. |
| **R5** | Rollback Payload row sau Vercel error fail (DB transient) → orphan row | Low | Medium | Try-catch quanh rollback, log error, surface "Domain saved nhưng provisioning fail, please contact support". Manual cleanup script nếu cần. |
| **R6** | SSL cert vẫn pending sau khi mark active → tenant truy cập HTTPS bị error | Medium | Medium | UI banner "SSL provisioning, may take 1–2 min". Document trong help center. Tenant retry sau 2 phút. |
| **R7** | `psl` package detect sai apex/subdomain (rare TLDs không trong PSL) | Low | Low | Soft-warn DNS pre-flight, không hard-fail. Vercel là source of truth. |
| **R8** | Backfill chạy production trùng giờ peak → tenant action conflict | Low | Low | LOCKED: backfill anytime safe, read-only đối với tenant traffic. Backfill chỉ ghi `vercelDomainId` field, không touch business state. |

---

## 11. Timeline

| Milestone | Owner | Effort | Target Date |
|-----------|-------|--------|-------------|
| PRD approved (this doc) | PM | — | 2026-04-13 ✅ |
| Plan validated (9 decisions LOCKED) | PM + Dev | — | 2026-04-13 ✅ |
| Phase 01 — Vercel client | Dev | 1.5h | 2026-04-14 |
| Phase 02 — Schema migration | Dev | 0.5h | 2026-04-14 |
| Phase 03 — Server actions rewrite | Dev | 2h | 2026-04-14 |
| Phase 04 — UI updates | Dev | 1h | 2026-04-14 |
| Phase 05 — Test mocks | Dev | 1h | 2026-04-14 |
| Phase 06 — Env + backfill | Dev + DevOps | 1h | 2026-04-15 |
| Phase 07 — QA + cleanup | QC + Dev | 0.5h | 2026-04-15 |
| PR review + merge to staging | Reviewer | — | 2026-04-15 |
| Production cutover | DevOps | — | 2026-04-16 |
| Issue #558 closed | PM | — | 2026-04-16 |

**Total dev effort:** 7.5h (1 sprint day)

---

## 12. Open Questions

| # | Question | Owner | Due | Answer |
|---|----------|-------|-----|--------|
| Q1 | Có cần feature flag `F19_USE_VERCEL_DOMAINS=true` cho safer rollback không? | Dev | Plan stage | **No.** DO is already broken, không có gì để fall back. LOCKED. |
| Q2 | Backfill report có cần upload Lark wiki không? | DevOps | Phase 06 | Recommended yes — one-time artifact lưu trên Lark. Non-blocking. |
| Q3 | Vercel có webhook "domain misconfigured" không? | Dev | Future | Không document. Defer follow-up issue cho polling-based detection. |
| Q4 | Token rotation policy? | DevOps | Post-launch | TBD — propose 90-day rotation, document trong runbook. |
| Q5 | Có cần admin tool để CSM xem trạng thái Vercel domain của tenant không? | PM | Future | Out of scope this PR. Có thể add admin column trong Payload UI. |

---

## 13. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-13 | PM (haynoikonike + Claude) | Initial draft, validated 2 rounds, 9 decisions LOCKED, plan + research linked |

---

## Appendix — PRD Quality Self-Check

```
📋 PRD Quality Check:
├── Functional Requirements:  16 ✅ (FR-01 → FR-16)
├── Acceptance Criteria:      14 ✅ (AC-01 → AC-14, all GIVEN/WHEN/THEN)
├── User Stories:             5 ✅ (US-1 → US-5)
├── Non-functional Reqs:      12 ✅ (perf, reliability, security, coverage, a11y, etc.)
├── Problem Statement:        6 bullets ✅ (what broke, why, who, evidence, references, scope)
├── Out of Scope:             8 items ✅
├── Data Model Changes:       ✅ (Tenants.customDomains thêm 2 field optional)
├── Dependencies:             ✅ (blocked-by, blocks, external)
├── Risk Assessment:          8 risks ✅ (R1-R8 với likelihood/impact/mitigation)
├── Architecture Diagram:     ✅ (state machine ASCII)
├── Code Examples:            ✅ (vercel client, types, payload schema delta)
└── Phase Breakdown:          7 phases ✅ (linked to plan files)
```

**Status:** ALL CHECKS PASS — ready for /cook.
