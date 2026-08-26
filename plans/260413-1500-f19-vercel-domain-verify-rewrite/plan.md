---
title: "F19 Custom Domain — DO → Vercel API rewrite"
description: "Replace DigitalOcean app-spec calls with Vercel Domains REST API for tenant custom domain provisioning"
status: pending
priority: P0
effort: 9.3h
branch: fix/F19-vercel-domain-verify
tags: [F19, vercel-migration, domains, bug-fix, issue-558]
created: 2026-04-13
---

# F19 Custom Domain — DO → Vercel API rewrite

## Problem
Issue #558. Staging F19 verify fails: `"Domain verification is not available. Server configuration is missing (SERVER_IP)"`. Post-Vercel-migration the 5 server actions in `src/app/(dashboard)/settings/domains/actions.ts` still reference `SERVER_IP` + DO app-spec endpoints that no longer apply.

## Fix
Rewrite all DO call sites against Vercel Domains REST API (Pattern A — per-domain registration). Surface TXT challenges in UI. Drop `SERVER_IP` / `DO_*` envs.

## Inputs
- Research: `research/researcher-01-vercel-domains-api.md`, `research/researcher-02-multi-tenant-pattern.md`
- Audit: `scout/scout-01-f19-audit.md`
- Code: `src/app/(dashboard)/settings/domains/actions.ts` (375 lines)

## Related Docs (PHẢI ĐỌC trước khi implement)
- **PRD**: `docs/prd/F19-vercel-domain-migration.md` (16 FRs, 14 ACs, 8 risks, code examples)
- **UI Design Specs**: `docs/design/F19-vercel-domain-migration-design.md` (4 components, ASCII layouts, a11y matrix, Tailwind snippets)
- **QA Test Plan**: `docs/qa/F19-vercel-domain-migration.md` (42 TCs, 100% AC coverage, 3 traceability matrices)
- **Scenario report**: `plans/260413-1500-f19-vercel-domain-verify-rewrite/reports/ck-scenario-01-vercel-domain-rewrite.md` (59 scenarios)
- **PRD gốc F19**: `docs/prd/F19-store-configuration.md` (business spec, không sửa)
- **Design gốc F19**: `docs/design/F19-store-configuration-design.md` (parent design, đọc để hiểu pattern)
- **Architecture (sẽ rewrite trong Phase 07)**: `docs/architecture/F19-store-configuration.md`
- **Issue gốc**: https://github.com/primeproduction/ech-prime-web-v2/issues/558

⛔ **Cook PHẢI đọc PRD + UI Design + Test Plan trước khi code Phase 03+. Test Plan có 42 TCs phải pass.**

## Phases
| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 01 | [Vercel API client wrapper](./phase-01-vercel-api-client.md) | 1.5h | pending |
| 02 | [Payload schema migration](./phase-02-payload-schema.md) | 0.5h | pending |
| 03 | [Rewrite server actions](./phase-03-rewrite-server-actions.md) | 2.5h | pending |
| 04 | [Update DomainsClient UI](./phase-04-domains-client-ui.md) | 1h | pending |
| 05 | [Update test mocks](./phase-05-update-tests.md) | 1.5h | pending |
| 06 | [Env vars + deployment + backfill](./phase-06-env-deployment.md) | 1.5h | pending |
| 07 | [QA + cleanup](./phase-07-qa-cleanup.md) | 0.5h | pending |

> **Effort bumped 7.5h → 9.3h** sau scenario report (8 action items mới, xem cuối file).

## Key decisions
- **Pattern A** (per-tenant `addProjectDomain`) — confirmed by researcher-02. Pattern B impossible for tenant apex domains.
- **Plain `fetch`** wrapper, no `@vercel/sdk` dep — fewer transitive packages, full control of error handling.
- **Verify state machine** = `verified` bool + presence of `verification[]`. SSL ready inferred from `verified=true && !verification`. No explicit cert field.
- **SSL ready policy (LOCKED 2026-04-13):** Khi `verified=true && verification rỗng` → set `status='active'` ngay. UI hiển thị banner "SSL đang được phát hành, có thể mất vài phút". KHÔNG dùng HTTPS HEAD probe. Khớp pattern Vercel dashboard.
- **DNS constants** (`76.76.21.21`, `cname.vercel-dns.com`) injected via env, not hardcoded.

## Out of scope
- Vercel Integration OAuth (per-customer tokens) — single team-scoped token is sufficient for this product.
- Wildcard apex / Vercel nameservers — tenant DNS only.
- Cert misconfiguration webhook — polled in future phase, not this one.

## Definition of done
1. Issue #558 reproduces no more; verify on staging passes for new + existing tenant domain.
2. All `SERVER_IP` and `DO_*` references purged from F19 code paths.
3. Payload tenant `customDomains` row carries `vercelDomainId`.
4. CI green (typecheck, lint, tests).
5. Docs: `docs/architecture/F19-store-configuration.md` reflects Vercel provisioning.

## Validation Summary
**Validated:** 2026-04-13 (2 rounds) | **Questions asked:** 9

### Round 1 — Architecture decisions (LOCKED)
- **SSL ready policy**: Mark `status='active'` ngay khi `verified=true && verification rỗng`. UI banner "SSL provisioning, may take 1-2 min". KHÔNG dùng HTTPS HEAD probe.
- **Branch**: Tạo `fix/F19-vercel-domain-verify` mới từ `staging`, không stack trên `fix/F00-ci-deploy-target-staging`.
- **Backfill**: Phase 06 viết script + chạy trên staging.
- **Vercel-fail rollback**: Try-catch quanh `addProjectDomain`; fail → `payload.update` xóa domain row vừa thêm. Atomic-ish.
- **Apex/subdomain detect**: Dùng `psl` npm package (Public Suffix List). Phase 01 thêm dep + import server-only.

### Round 2 — Operational decisions (LOCKED)
- **Production cutover**: Run backfill ANYTIME, không cần maintenance window. Backfill là read-only đối với tenant traffic, không tạo downtime.
- **Legacy pending rows**: Backfill xử lý ALL rows (cả pending lẫn active). Mỗi row → `addProjectDomain` + `verifyProjectDomain`. Status tự động flip theo kết quả Vercel (active nếu DNS đúng, vẫn pending nếu cần TXT).
- **PR scope**: 1 PR duy nhất gộp 7 phase (atomic ship cho P0 bug). ~10 file changed.
- **TXT verify UX**: Manual click button "Verify Now" (KHÔNG auto-poll). Hiển thị "Last checked: X min ago" timestamp. Respect rate limit 50/hr.

### Action items cho phases (cập nhật trước /cook)
- [ ] Phase 01: thêm `psl` vào dependencies, import trong utility helper `isApexDomain(domain)`
- [ ] Phase 03: import `isApexDomain` thay split('.') naive; lock-in SSL policy theo Round 1 decision 1
- [ ] Phase 03: try-catch addProjectDomain → payload.update rollback nếu fail; document trong implementation steps
- [ ] Phase 04: implement "Verify Now" button + "Last checked Xm ago" timestamp; KHÔNG auto-poll (xóa open question)
- [ ] Phase 06: backfill xử lý CẢ pending rows (không skip); verify với từng row sau khi add; trước khi chạy real backfill thì query MongoDB count domains trên staging để estimate thời gian
- [ ] Phase 06: gỡ note "maintenance window" khỏi production cutover steps
- [ ] Phase 07: 1 PR duy nhất, không split
- [ ] plan.md: branch base = `staging`

## Scenario Report Findings
**Source:** `reports/ck-scenario-01-vercel-domain-rewrite.md` — **59 scenarios** trên 9 dimensions (14 Critical, 21 High, 14 Medium, 10 Low)

### Top 5 Critical scenarios MỚI phát hiện (chưa cover trong plan ban đầu)
1. **Vercel success → Payload write FAIL → orphan Vercel domain** (5.1)
2. **Cross-tenant verify call** — `verifyCustomDomain` cần query với `tenantId AND domain` (8.1)
3. **SSRF qua domain input** (`mystore.com#@evil.com`, etc.) (2.8)
4. **2 tenant đồng thời add cùng domain → race condition** (3.2)
5. **Backfill ghi đè array gây data loss** (9.7)

### 8 Action Items bổ sung (LOCKED) — tổng +1.8h

| # | Phase | Action | Effort |
|---|---|---|---|
| - [ ] | 03 | **Reverse rollback**: nếu Payload write FAIL sau khi Vercel addProjectDomain success → catch error → gọi `removeProjectDomain` cleanup. Tránh orphan Vercel domain (scenario 5.1) | +15m |
| - [ ] | 03 | **Cross-tenant guard audit**: confirm `verifyCustomDomain` query Payload với `tenantId AND customDomains.domain = X`, KHÔNG chỉ `domain = X`. Add unit test scenario 8.1 trong Phase 05 | +10m |
| - [ ] | 03 | **Vercel 409 friendly error mapping**: catch `VercelDomainsError.code = 'domain_already_in_use'` → trả "Domain already registered by another store" (scenario 3.2) | +10m |
| - [ ] | 03 | **IDN/punycode normalization**: trước khi gọi Vercel, convert unicode domain sang punycode bằng built-in `URL` API hoặc `punycode.toASCII`. Test với `münchen.de` (scenario 2.3, 2.4) | +20m |
| - [ ] | 03 | **removeProjectDomain 5xx graceful**: try-catch quanh remove call, log nhưng vẫn return success vì Payload đã clean (scenario 5.6) | +5m |
| - [ ] | 05 | **SSRF fuzz tests**: 5 payloads `mystore.com#@evil.com`, `mystore.com:8080`, `mystore.com/path`, `mystore.com?x=1`, `192.168.1.1`. Confirm regex L36 reject hết (scenario 2.8) | +15m |
| - [ ] | 05 | **Cross-tenant verify test**: tenant A gọi action với domain của tenant B → assert reject 401/404 (scenario 8.1) | +10m |
| - [ ] | 06 | **Selective array update + cursor stream**: backfill update từng element trong customDomains array bằng index, KHÔNG replace toàn bộ array. Stream tenants bằng cursor pagination thay vì load all (scenarios 9.7 + 7.7) | +35m |

### Scenarios đã có trong plan (verify nhưng không add work mới)
- 5.2 (Payload OK → Vercel fail rollback) — đã LOCK trong Round 1
- 5.5 (Remove → Vercel 404 swallow) — đã trong phase 03
- 7.7 OOM/scale — partially covered, nay được explicit hóa
- 10.1 (API version v9/v10) — đã hardcode trong phase 01

### Open question CẦN trả lời ở đầu Phase 03
**Q1**: `verifyCustomDomain` hiện đang query Payload bằng `tenantId AND customDomains.domain` HAY chỉ `customDomains.domain`?

→ Đây là attack vector security 8.1. Cook agent PHẢI grep trong actions.ts trước khi rewrite verify, confirm logic ownership check. Nếu CHƯA có → đây là pre-existing security bug, fix trong cùng PR.
