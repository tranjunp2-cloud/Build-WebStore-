# F19 Custom Domain Flow — Full Technical Reference

**Last updated:** 2026-05-13  
**Branch:** `staging`  
**Sessions:** 2026-05-11 (initial audit), 2026-05-13 (dead-code cleanup + HTTPS probe + code review fixes)

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
| `src/lib/vercel/dns-check.ts` | DNS routing check (Cloudflare DoH) + HTTPS connectivity probe |
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
    │       - verified=true + verification=[] → domain đã trong team (ownership OK, DNS chưa chắc)
    │       - verified=false + verification=[{TXT}] → cần thêm TXT record
    ├─ Final write: status='pending' LUÔN LUÔN (kể cả Vercel trả verified=true)
    │    + lưu vercelDomainId, vercelVerification[]
    └─ Rollback nếu Vercel fail AFTER optimistic write
```

**UI sau add:**
- Domain hiện trạng thái **Pending Verification** (cam/amber)
- Hiện DNS instruction card: A record (`76.76.21.21`) cho apex, CNAME (`cname.vercel-dns.com`) cho subdomain
- Nếu Vercel trả `verification[]` → hiện thêm **TXT Challenge Card** (ownership verification)
- Nút **Verify Connection** luôn hiện

> **Tại sao luôn pending?** `verified=true` từ Vercel chỉ có nghĩa ownership đã confirm (domain trong cùng Vercel team), KHÔNG có nghĩa DNS đã trỏ và HTTPS accessible. Phải verify đầy đủ mới mark active.

---

### 2. Verify domain

```
User click "Verify Connection" → handleVerify(domain) [debounce 1s]
    │
    ▼
verifyCustomDomain(domain) [server action]
    ├─ Ownership check: domain phải thuộc tenant này
    ├─ Idempotent: nếu đã active → return success luôn
    ├─ POST /v9/projects/{id}/domains/{domain}/verify  (Vercel API)
    │    ├─ verified=false + verification[] → FAIL
    │    │    └─ Persist fresh TXT challenges, return { success: false, error, verification[] }
    │    ├─ 400 error → GET domain để lấy fresh challenges → return { success: false, error, verification[] }
    │    └─ verified=true → bước tiếp theo ↓
    │
    ├─ [Ownership confirmed] Write 1 to Payload:
    │    └─ vercelVerification=null (clear TXT card), status vẫn 'pending'
    │
    ├─ checkDnsRouting(domain, isApex) via Cloudflare DoH  ← lớp 2 DNS check
    │    ├─ Fail → return { success: false, error: "DNS not pointing...", ownershipConfirmed: true }
    │    └─ Pass → bước tiếp theo ↓
    │
    ├─ checkHttpsConnectivity(domain)  ← lớp 3: HTTPS probe
    │    ├─ Fail (SSL provisioning) → return { success: false, error: "SSL certificate...", ownershipConfirmed: true }
    │    ├─ Fail (timeout/network) → return { success: false, error: "Domain not yet accessible...", ownershipConfirmed: true }
    │    └─ Pass (any HTTP response, even 4xx/5xx = SSL up + Vercel serving) → bước tiếp theo ↓
    │
    ├─ Write 2 to Payload: status='active'
    └─ revalidatePath('/settings/domains') → return { success: true }
```

**UI sau verify — từng case:**

| Kết quả | UI hiện |
|---------|---------|
| **Success** | Domain chuyển card "Connected & Secured" (xanh), toast "Domain connected! https://... is now live." |
| **Fail — TXT chưa set** | TXT Challenge Card cập nhật với token mới nhất, error message |
| **Fail — DNS chưa trỏ** | Error banner đỏ với "A record not pointing to Vercel. Expected: X — currently: Y", TXT card biến mất (ownershipConfirmed=true) |
| **Fail — SSL provisioning** | Error banner "SSL certificate is being provisioned. Please try again in 1–2 minutes.", TXT card biến mất |
| **Fail — không accessible** | Error banner "Domain is not yet accessible. Please try again in a few minutes.", TXT card biến mất |
| **Fail — timeout** | Error banner "DNS routing check timed out. Please try again." |

**`ownershipConfirmed` flag (trong `DomainActionResult`):**
- Khi Vercel xác nhận ownership nhưng DNS/HTTPS chưa pass, client nhận `ownershipConfirmed: true`
- Client dùng để xóa TXT card khỏi state local (`setVerifications(prev => { delete next[domain]; return next })`)
- Tránh stale TXT card khi user đã prove ownership rồi nhưng DNS còn chờ propagate

---

### 3. DNS check logic chi tiết

**Lớp 2 — DNS routing check (Cloudflare DoH):** `src/lib/vercel/dns-check.ts`

```
Cloudflare DNS-over-HTTPS: https://cloudflare-dns.com/dns-query
→ Global distributed resolvers, không bị single-region bias

Apex domain (isApex=true):
  GET ?name=example.com&type=A
  Answer[] phải chứa VERCEL_APEX_A_RECORD (default: "76.76.21.21")
  Multi-IP: VERCEL_APEX_A_RECORD="76.76.21.21,76.76.21.22" → any match = pass
  Empty → "none", Sai IP → "A record not pointing to Vercel. Expected: X — currently: Y"

Subdomain (isApex=false):
  Bước 1: GET ?name=shop.example.com&type=CNAME
  Answer[] phải chứa VERCEL_CNAME_TARGET (default: "cname.vercel-dns.com")
  Normalize: strip trailing dot, lowercase
  Pass → done

  Bước 2 (fallback): Nếu CNAME empty → GET ?name=shop.example.com&type=A
  Một số registrar không support CNAME ở apex-equivalent → dùng A record
  Answer[] phải chứa VERCEL_APEX_A_RECORD
  Pass → done

  Cả 2 fail → "DNS not pointing to Vercel. Expected CNAME: X — currently: Y"

Timeout: 5s per query → "DNS routing check timed out. Please try again."
DoH HTTP error → "DNS routing check failed. Please try again."
Network error → "DNS routing check failed. Please try again."
```

**Lớp 3 — HTTPS connectivity probe:** `checkHttpsConnectivity()` trong `dns-check.ts`

```
HEAD https://{domain} redirect=manual timeout=10s

Bất kỳ HTTP response nào (kể cả 3xx/4xx/5xx) = SSL đã provision + Vercel đang serve → ok: true
  - redirect=manual: 3xx cũng trả response.ok=false nhưng không throw → catch không chạy → ok: true
  - Đây là intentional: SSL handshake thành công = chứng tỏ cert đã issue

Throw AbortError → "Domain connection timed out. Please try again in a few minutes."
Throw với SSL indicators (message/cause/code chứa: certificate, ssl, tls, cert, eproto, ERR_TLS_*):
  → "SSL certificate is being provisioned. Please try again in 1–2 minutes."
Throw khác (ECONNREFUSED, network error):
  → "Domain is not yet accessible. Please try again in a few minutes."
```

---

### 4. Remove domain

```
User click "Remove" → confirm modal → handleRemoveConfirm()
    │
    ▼
removeCustomDomain(domain) [server action]
    ├─ Ownership check: domain thuộc tenant này
    ├─ Block: không xóa primary domain (user phải đổi primary trước)
    ├─ Update Payload: filter domain ra khỏi customDomains[]  ← source of truth
    └─ Best-effort: DELETE /v9/projects/{id}/domains/{domain}  (Vercel API)
         ├─ 404 → idempotent → OK
         └─ 5xx → log, không fail user (Payload đã xóa, Vercel là secondary)
```

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

## Case map đầy đủ — trạng thái UI hợp lệ

### Add domain

| Input | Kết quả |
|-------|---------|
| Có `http://` prefix | Client-side error inline (không gửi action) |
| Empty string | Client-side error inline |
| Có khoảng trắng (`my store.com`) | Client-side error inline |
| Domain đã có trong tenant | Server error "Domain already added to this store." |
| Domain đã có ở tenant khác | Server error "Domain already registered by another store." |
| Domain hợp lệ chưa có | Pending card hiện với DNS instruction + Verify button |
| Vercel trả `verification[]` | Pending card + TXT Challenge Card thêm vào |
| Vercel trả `verified=true` (same team) | Pending card (không TXT card), user vẫn phải verify |

### Verify domain

| Trạng thái DNS/HTTPS | Kết quả UI |
|---------------------|-----------|
| TXT record chưa set | Error + TXT Challenge Card update với token mới |
| Vercel ownership fail (400) | Error + TXT Challenge Card (fresh challenges) |
| Ownership OK, DNS chưa trỏ | Error "A record not pointing to Vercel...", TXT card biến mất |
| Ownership OK, DNS đúng, SSL chưa issue | Error "SSL certificate is being provisioned..." |
| Ownership OK, DNS đúng, không accessible | Error "Domain is not yet accessible..." |
| Ownership OK, DNS đúng, HTTPS accessible | Card chuyển "Connected & Secured", toast success |
| Domain đã active (idempotent) | Return success ngay, không gọi API |
| DNS check timeout | Error "DNS routing check timed out..." |
| DoH request fail | Error "DNS routing check failed..." |

### Remove domain

| Trạng thái | Kết quả |
|-----------|---------|
| Domain là primary | Block "Cannot remove primary domain. Please change your primary domain first." |
| Domain không phải primary | Xóa khỏi Payload + best-effort Vercel cleanup |
| Domain đã xóa khỏi Vercel rồi | Idempotent OK (404 từ Vercel = OK) |

### Primary domain

| Trạng thái | Kết quả |
|-----------|---------|
| Chọn domain pending | Không hiện trong SelectPrimaryPanel (chỉ active domains) |
| Chọn active custom domain | isPrimary=true, middleware redirect các domain khác về đây |
| Clear primary | Tất cả isPrimary=false, platform subdomain là entry point mặc định |

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
| DNS check timeout | "DNS routing check timed out. Please try again." |
| DoH HTTP error | "DNS routing check failed. Please try again." |
| HTTPS SSL handshake fail | "SSL certificate is being provisioned. Please try again in 1–2 minutes." |
| HTTPS timeout | "Domain connection timed out. Please try again in a few minutes." |
| HTTPS connection refused | "Domain is not yet accessible. Please try again in a few minutes." |

---

## Local dev mock mode

Tự động bật khi `VERCEL_TOKEN` không có + `NODE_ENV=development`.

```typescript
function isMockMode(): boolean {
    return !process.env.VERCEL_TOKEN && process.env.NODE_ENV === 'development'
}
```

| `VERCEL_MOCK_MODE` | Hành vi |
|--------------------|---------|
| `pending` (default) | addProjectDomain → pending (hiện TXT challenge) |
| `active` | addProjectDomain → active ngay |
| *(unset)* | default = pending |

`verifyProjectDomain` trong mock mode → `verified=true` → skip DNS + HTTPS check → active.  
`docker-compose.yml` set `VERCEL_MOCK_MODE=pending`.

---

## Bugs đã fix

### [Session 2026-05-11] Bug 1: Domain tự hiện "Connected & Secured" ngay khi add
- **Root cause:** Code cũ check `vercel.verified === true` và mark active. Vercel trả `verified=true` cho domain đã trong team — nhưng DNS chưa trỏ.
- **Fix:** Bỏ `isActive` branch. Luôn `status='pending'`. Active chỉ sau `verifyCustomDomain` thành công.

### [Session 2026-05-11] Bug 2: Verify pass dù DNS chưa trỏ (round 1 — PR #975)
- **Root cause:** DNS check cũ chỉ `console.warn`. Vercel verify thành công (ownership) → mark active dù DNS chưa trỏ.
- **Fix (PR #975):** DNS pre-flight hard fail trước khi gọi Vercel.
- **Revert (PR #980):** Hard pre-flight gây false-negative: single serverless region resolve fail trong khi DNS propagated. Đổi thành soft warning.

### [Session 2026-05-11] Bug 3: False negative sau revert #980 — DNS đúng bị block
- **Root cause:** Hard pre-flight dùng Node.js `dns` module bị single-region bias. DNS đã propagate nhưng region serverless chưa thấy → user blocked dù đúng.
- **Fix (PR #980):** Soft pre-flight — log warn, không block. Để Vercel `/verify` quyết định.

### [Session 2026-05-13] Bug 4: False positive — domain mark active khi HTTPS chưa accessible
- **Root cause:** Sau soft pre-flight, Vercel `/verify` `verified=true` → system mark active ngay. Nhưng Vercel ownership ≠ HTTPS accessible. Traffic vẫn lỗi dù UI nói "Connected".
- **Fix:** Thêm 2 gate sau `verified=true`:
  1. **DNS routing check** via Cloudflare DoH (`checkDnsRouting`) — global resolvers, tránh single-region bias
  2. **HTTPS probe** (`checkHttpsConnectivity`) — `HEAD https://{domain}` xác nhận SSL issued và Vercel serving
  - Domain chỉ mark `active` khi cả 3 pass: Vercel ownership + DNS routing + HTTPS accessible

### [Session 2026-05-13] Bug 5: Stale TXT card sau ownership confirmed
- **Root cause:** Khi Vercel xác nhận ownership nhưng DNS chưa trỏ, server trả error nhưng không xóa TXT card → user thấy TXT card dù không cần thêm TXT nữa.
- **Fix:** 
  - Server: Write 1 to Payload xóa `vercelVerification` ngay khi `verified=true` (trước DNS check)
  - Client: `ownershipConfirmed: true` trong response → xóa TXT card khỏi local state

### [Session 2026-05-13] Bug 6: SSL redirect chain bypass HTTPS probe
- **Root cause:** `redirect: 'follow'` theo redirect đến HTTP endpoint → không có SSL handshake → probe pass sai.
- **Fix:** `redirect: 'manual'` — 3xx trả response object (không throw) → probe nhận response = SSL confirmed.

---

## Dead code đã xóa (session 2026-05-13)

| Thứ gì bị xóa | Lý do |
|---------------|-------|
| `import { promises as dns } from 'dns'` trong `actions.ts` | Soft pre-flight đã thay bằng DoH check |
| `VERCEL_APEX_IP`, `VERCEL_CNAME` module-level constants trong `actions.ts` | DoH check dùng env vars trực tiếp trong `dns-check.ts` |
| Soft DNS pre-flight block trong `verifyCustomDomain` | Chỉ log warn, không bao giờ block — code unreachable về effect. Thay bằng DoH check thực sự |
| `SslProvisioningBanner` component trong `DomainsClient.tsx` | Messaging sai sau khi có HTTPS probe (probe đã confirm SSL up trước khi mark active) |
| `sslProvisioningDomains` state trong `DomainsClient.tsx` | Không còn được set sau khi bỏ SSL banner |
| `dnsSetupDomains` state trong `DomainsClient.tsx` | Dead state — không bao giờ được set đúng cách |
| Dead DNS setup panel trong active card | Render của `dnsSetupDomains.has(domain)` — không bao giờ true |
| `setSslProvisioningDomains` trong remove handler | Không còn state này |

---

## Env vars liên quan

| Var | Scope | Mô tả |
|-----|-------|-------|
| `VERCEL_TOKEN` | Server | Auth token Vercel API |
| `VERCEL_TEAM_ID` | Server | `team_H3WAlHhz2xqvIFRcxfWevPTs` |
| `VERCEL_PROJECT_ID` | Server | `prj_84DQ47BSv2hBX28w0FzjFScfbuRr` |
| `VERCEL_APEX_A_RECORD` | Server | IP cho A record check, comma-separated multi-IP. Default: `76.76.21.21` |
| `VERCEL_CNAME_TARGET` | Server | CNAME target check. Default: `cname.vercel-dns.com` |
| `NEXT_PUBLIC_VERCEL_APEX_IP` | Client | IP hiển thị trong DNS instruction UI |
| `NEXT_PUBLIC_VERCEL_CNAME_TARGET` | Client | CNAME hiển thị trong DNS instruction UI |
| `VERCEL_MOCK_MODE` | Server | `pending` \| `active` — chỉ có tác dụng khi mock mode |
| `VERCEL_GIT_COMMIT_REF` | Server | Branch name inject bởi Vercel build |

---

## Tests

`src/__tests__/unit/lib/vercel/dns-check.test.ts` — 20 tests, tất cả pass.

| TC | Scenario | Expected |
|----|----------|----------|
| TC-F19.12 | Apex A record = Vercel IP | ok: true |
| TC-F19.12 | Multi-IP VERCEL_APEX_A_RECORD | ok: true nếu match bất kỳ |
| TC-F19.16 | Apex A record sai IP | ok: false, message có expected và actual |
| TC-F19.11 | Apex không có record | ok: false, message có "none" |
| TC-F19.12 | Subdomain CNAME → Vercel | ok: true |
| TC-F19.12 | CNAME có trailing dot | normalize → ok: true |
| TC-F19.12 | CNAME uppercase | normalize → ok: true |
| TC-F19.12 | CNAME empty + A record = Vercel IP | ok: true (A fallback) |
| TC-F19.16 | CNAME sai + A record sai | ok: false |
| TC-F19.11 | Không có CNAME và A | ok: false, message có "none" |
| — | DoH AbortError | ok: false, message có "timed out" |
| — | DoH HTTP 500 | ok: false, message có "failed" |
| — | Network error | ok: false, message có "failed" |
| TC-F19.12 | HTTPS domain responds 200 | ok: true |
| TC-F19.12 | HTTPS domain responds 404 | ok: true (SSL up = any HTTP response) |
| TC-F19.13 | SSL certificate error | ok: false, message có "SSL" |
| TC-F19.13 | Error cause CERT_UNTRUSTED | ok: false, message có "SSL" |
| TC-F19.12 | HTTPS AbortError | ok: false, message có "timed out" |
| TC-F19.12 | HTTPS ECONNREFUSED | ok: false, message có "accessible" |
| TC-F19.17 | First fail (wrong IP), second pass (correct IP) | first: false, second: true |
