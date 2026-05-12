# F19 Custom Domain Flow — Full Technical Reference

**Date:** 2026-05-11
**Branch:** `investigate/F19-domain-ui-flow`
**Scope:** End-to-end custom domain lifecycle — routing, provisioning, verification, primary selection, removal

---

## Tổng quan kiến trúc

Tenant có 2 loại domain:
- **Platform subdomain** — `{slug}.primeweb.app` — luôn active, không cần config.
- **Custom domain** — domain riêng của tenant (e.g. `shop.example.com`) — phải add → trỏ DNS → verify.

Dữ liệu domain lưu tại `tenants.customDomains[]` (Payload CMS), không phải bảng riêng.

```
User Browser
    │
    ▼
Next.js Middleware (src/middleware.ts)
    │  Detect hostname
    │  ├─ {slug}.primeweb.app  → rewrite /sites/{slug}/...
    │  └─ custom domain        → rewrite /sites/custom/...
    │                            + check redirect /api/domain-primary
    ▼
Server Actions (src/app/(dashboard)/settings/domains/actions.ts)
    │  addCustomDomain / verifyCustomDomain / removeCustomDomain
    │  setPrimaryDomain / clearPrimaryDomain
    │  └─ gọi Vercel Domains API (src/lib/vercel/domains.ts)
    ▼
Payload CMS → PostgreSQL (tenants.customDomains[])
```

---

## File map

| File | Vai trò |
|------|---------|
| `src/middleware.ts` | Routing theo hostname, 301 redirect non-primary → primary |
| `src/app/(dashboard)/settings/domains/actions.ts` | Server Actions: CRUD domain + DNS check + Vercel API calls |
| `src/app/(dashboard)/settings/domains/DomainsClient.tsx` | UI: add modal, pending card (DNS + Verify), active card, primary panel |
| `src/app/(dashboard)/settings/domains/page.tsx` | RSC: load tenant domains từ Payload → hydrate DomainsClient |
| `src/lib/vercel/domains.ts` | Vercel REST API wrapper (addProjectDomain, verifyProjectDomain, getProjectDomain, removeProjectDomain) |
| `src/lib/vercel/domains.types.ts` | Types: VercelDomain, VercelDomainVerification, VercelDomainsError |
| `src/app/api/domain-primary/route.ts` | API: trả về `{ isPrimary, primaryDomain }` — dùng bởi middleware redirect logic |

---

## User flow chi tiết

### 1. Add domain

```
User nhập domain → handleAddDomain() [client-side validation]
    │
    ▼
addCustomDomain(domain) [server action]
    ├─ Sanitize: trim, lowercase, strip http://, trailing /
    ├─ IDN → punycode
    ├─ Regex validate
    ├─ Cross-tenant uniqueness check (query Payload)
    ├─ In-tenant dup check
    ├─ Optimistic write: status='pending' vào Payload (user thấy phản hồi ngay)
    ├─ POST /v10/projects/{id}/domains  (Vercel API)
    │    └─ Vercel trả về: { verified, verification[] }
    │       - verified=true + verification=[] → domain đã trong team (nhưng DNS chưa trỏ)
    │       - verified=false + verification=[{TXT}] → cần thêm TXT record
    ├─ Final write: status='pending' LUÔN LUÔN (kể cả Vercel trả verified=true)
    │    + lưu vercelDomainId, vercelVerification[]
    └─ Rollback nếu Vercel fail AFTER optimistic write
```

**UI sau add:**
- Domain hiện trạng thái **Pending Verification** (cam)
- Hiện A record (`76.76.21.21`) và CNAME record (`cname.vercel-dns.com`) để user trỏ
- Nếu Vercel trả `verification[]` → hiện thêm **TXT Challenge Card** (ownership verification)
- Nút **Verify Connection** luôn hiện

> **Tại sao luôn pending?** Vercel trả `verified=true` chỉ có nghĩa ownership đã confirm (domain trong cùng Vercel team), KHÔNG có nghĩa DNS đã trỏ. Nếu tự mark active thì user truy cập domain sẽ 404.

---

### 2. Verify domain

```
User click "Verify Connection" → handleVerify(domain) [debounce 1s]
    │
    ▼
verifyCustomDomain(domain) [server action]
    ├─ Ownership check: domain phải thuộc tenant này
    ├─ Idempotent: nếu đã active → return success luôn
    ├─ Hard DNS pre-flight (bỏ qua khi mock mode)
    │    ├─ Apex domain (example.com):
    │    │    └─ dns.resolve4(domain) phải chứa 76.76.21.21
    │    └─ Subdomain (shop.example.com):
    │         └─ dns.resolveCname(domain) phải chứa cname.vercel-dns.com
    │    → Nếu fail: trả error message cụ thể (expected vs actual IP/CNAME)
    │    → Nếu DNS chưa tồn tại: trả "DNS records not detected yet..."
    ├─ POST /v9/projects/{id}/domains/{domain}/verify  (Vercel API)
    │    ├─ verified=true + verification=[] → SUCCESS
    │    │    └─ Update Payload: status='active', vercelVerification=null
    │    ├─ verified=false + verification[] → FAIL: persist fresh TXT challenges
    │    └─ 400 error → GET /v9/projects/{id}/domains/{domain} lấy fresh challenges
    └─ revalidatePath('/settings/domains')
```

**UI sau verify:**
- **Success:** domain chuyển **Connected & Secured** (xanh), SSL provisioning banner hiện 60s
- **Fail - DNS chưa trỏ:** error banner đỏ với IP/CNAME expected vs actual
- **Fail - TXT chưa set:** TXT Challenge Card cập nhật với token mới nhất

---

### 3. DNS check logic chi tiết

```
isApexDomain("example.com")   → true  (subdomain === null via psl.parse)
isApexDomain("shop.example.com") → false

Apex domain:
  dns.resolve4("example.com") phải include "76.76.21.21"
  Error "ENOTFOUND" → "DNS records not detected yet..."
  Resolve nhưng IP sai → "Expected A record: 76.76.21.21 — currently: x.x.x.x"

Subdomain:
  dns.resolveCname("shop.example.com") phải include "cname.vercel-dns.com"
  Normalize: strip trailing dot, lowercase trước khi so sánh
```

DNS values đọc từ env:
- `VERCEL_APEX_A_RECORD` (default: `76.76.21.21`)
- `VERCEL_CNAME_TARGET` (default: `cname.vercel-dns.com`)
- `NEXT_PUBLIC_VERCEL_APEX_IP` — client hiển thị trong DNS instruction card
- `NEXT_PUBLIC_VERCEL_CNAME_TARGET` — client hiển thị trong DNS instruction card

---

### 4. Remove domain

```
User click "Remove" → confirm modal → handleRemoveConfirm()
    │
    ▼
removeCustomDomain(domain) [server action]
    ├─ Ownership check: domain thuộc tenant này
    ├─ Block: không xóa primary domain (user phải đổi primary trước)
    ├─ Update Payload: filter domain ra khỏi customDomains[]
    └─ Best-effort: DELETE /v9/projects/{id}/domains/{domain}  (Vercel API)
         ├─ 404 → domain đã xóa khỏi Vercel rồi, idempotent → OK
         └─ 5xx → log, không fail user (Payload đã xóa, Vercel là secondary)
```

Payload là source of truth. Vercel cleanup là best-effort.

---

### 5. Primary domain

```
User click "Select primary domain" → SelectPrimaryPanel (slide-in từ phải)
    │  Hiện: platform subdomain + tất cả active custom domains
    │
    ▼
setPrimaryDomain(domain) [server action]
    ├─ Domain phải active
    └─ Update Payload: isPrimary=true trên domain đó, false tất cả còn lại

clearPrimaryDomain() [server action]
    └─ isPrimary=false tất cả → platform subdomain trở thành primary mặc định
```

**Middleware redirect** (REQ-F19-06):
- Request vào custom domain → middleware gọi `/api/domain-primary?host={hostname}`
- Nếu `isPrimary=false` và có `primaryDomain` khác → 301 redirect `https://{primaryDomain}{pathname}`
- Nếu fetch fail / timeout (2s) → serve normally, không block traffic

---

### 6. Middleware routing

```
Request hostname
    │
    ├─ {slug}.primeweb.app → rewrite /sites/{slug}/... + x-tenant-type: subdomain
    │
    ├─ Custom domain (không phải platform/admin/local/.vercel.app)
    │    ├─ Check /api/domain-primary → 301 nếu non-primary
    │    └─ Rewrite /sites/custom/... + x-tenant-hostname + x-tenant-type: custom-domain
    │
    └─ Platform domain (primeweb.app, admin.echprime.com, localhost) → normal routing
```

---

## Error handling & rollback

| Scenario | Xử lý |
|----------|-------|
| Payload optimistic write fail | Return error trước khi gọi Vercel |
| Vercel fail AFTER optimistic write | Rollback Payload về state cũ |
| Payload final write fail AFTER Vercel registered | DELETE domain khỏi Vercel, return error |
| Vercel 409 domain_already_in_use | Map → "Domain already registered by another store." |
| Vercel 429 rate limit | Map → "Too many requests. Please wait {n}s and try again." |
| Vercel 5xx | Map → "Provider is temporarily unavailable." |
| DNS ENOTFOUND | "DNS records not detected yet. DNS changes can take a few minutes to propagate." |
| DNS wrong value | "Expected A record: {expected} — currently resolves to: {actual}" |

---

## Local dev mock mode

Tự động bật khi `VERCEL_TOKEN` không có + `NODE_ENV=development`.

```typescript
// domains.ts
function isMockMode(): boolean {
    return !process.env.VERCEL_TOKEN && process.env.NODE_ENV === 'development'
}
```

| `VERCEL_MOCK_MODE` | Hành vi |
|--------------------|---------|
| `pending` (default) | addProjectDomain → pending (hiện TXT challenge) |
| `active` | addProjectDomain → active ngay |
| *(unset)* | default = pending |

`verifyProjectDomain` trong mock mode luôn trả `verified=true` → domain chuyển active.
DNS pre-flight bị bỏ qua trong mock mode (không có DNS thật local).

`docker-compose.yml` set `VERCEL_MOCK_MODE=pending`.

---

## Bugs đã fix (session 2026-05-11)

### Bug 1: Domain tự hiện "Connected & Secured" ngay khi add
- **Root cause:** Code cũ check `vercel.verified === true` và mark active nếu true. Vercel trả `verified=true` cho domain đã có trong Vercel team — nhưng DNS chưa trỏ → truy cập fail.
- **Fix:** Bỏ `isActive` branch. Luôn `status='pending'`. Active chỉ sau `verifyCustomDomain` thành công.

### Bug 2: Verify không báo lỗi dù DNS chưa trỏ
- **Root cause:** DNS check cũ chỉ `console.warn` rồi continue. Vercel verify có thể thành công (ownership OK) ngay cả khi DNS chưa trỏ đúng → domain mark active nhưng không accessible.
- **Fix:** DNS pre-flight là **hard fail**. Trả error message rõ ràng với expected vs actual values trước khi gọi Vercel.

---

## Env vars liên quan

| Var | Scope | Mô tả |
|-----|-------|-------|
| `VERCEL_TOKEN` | Server | Auth token Vercel API |
| `VERCEL_TEAM_ID` | Server | `team_H3WAlHhz2xqvIFRcxfWevPTs` |
| `VERCEL_PROJECT_ID` | Server | `prj_84DQ47BSv2hBX28w0FzjFScfbuRr` |
| `VERCEL_APEX_A_RECORD` | Server | IP cho A record check (default: `76.76.21.21`) |
| `VERCEL_CNAME_TARGET` | Server | CNAME target check (default: `cname.vercel-dns.com`) |
| `NEXT_PUBLIC_VERCEL_APEX_IP` | Client | IP hiển thị trong DNS instruction UI |
| `NEXT_PUBLIC_VERCEL_CNAME_TARGET` | Client | CNAME hiển thị trong DNS instruction UI |
| `VERCEL_MOCK_MODE` | Server | `pending` \| `active` — chỉ có tác dụng khi mock mode |
| `VERCEL_GIT_COMMIT_REF` | Server | Branch name inject bởi Vercel build (dùng gitBranch routing) |
