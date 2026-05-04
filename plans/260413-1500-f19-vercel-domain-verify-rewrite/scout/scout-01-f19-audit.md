# F19 Domain Code Audit
> Date: 2026-04-13
> Scope: ech-prime-web-v2, F19 Custom Domain touchpoints
> Thoroughness: Medium

---

## 1. Server actions (actions.ts)

**File:** `/src/app/(dashboard)/settings/domains/actions.ts` (375 lines)

**Exported functions:**
- L26–138 `addCustomDomain(rawDomain)` — Validates format, checks uniqueness, adds to Payload, calls DO GET/PUT
- L140–215 `removeCustomDomain(domain)` — Removes from Payload, calls DO GET/PUT to remove from spec
- L217–319 `verifyCustomDomain(domain)` — DNS A record lookup, checks DO SSL phase, updates status to 'active'
- L321–351 `setPrimaryDomain(domain)` — Sets isPrimary flag on active domain only, clears others
- L354–374 `clearPrimaryDomain()` — Resets all isPrimary to false → platform subdomain becomes primary

**DO API call sites:**
- L79–85: GET `/api/v2/apps/{DO_APP_ID}` (addCustomDomain, fetch app spec)
- L105–117: PUT `/api/v2/apps/{DO_APP_ID}` (addCustomDomain, update spec with new domain)
- L168–174: GET `/api/v2/apps/{DO_APP_ID}` (removeCustomDomain, fetch spec)
- L183–195: PUT `/api/v2/apps/{DO_APP_ID}` (removeCustomDomain, remove domain from spec)
- L256–258: GET `/api/v2/apps/{DO_APP_ID}` (verifyCustomDomain, check SSL phase)

**TODO comment:** L8 — "Replace with Vercel Domains API in Phase 4"

**Env var guards:** L74–77, L164–166, L253–255 — All DO calls gated by `if (DO_API_TOKEN && DO_APP_ID)`. If missing, domain added to Payload but DO spec skipped with warning.

---

## 2. DomainsClient.tsx

**File:** `/src/app/(dashboard)/settings/domains/DomainsClient.tsx` (~600 lines)

**Actions called:**
- L6: imports all 5 actions
- L213: `addCustomDomain(domainValue)`
- L233: `verifyCustomDomain(domain)`
- L248: `removeCustomDomain(domain)`
- L269: `clearPrimaryDomain()`
- L275: `setPrimaryDomain(selected)`

**Error UI strings with SERVER_IP reference:**
- L9: `DNS_A_RECORD = process.env.NEXT_PUBLIC_SERVER_IP ?? '162.159.140.98'`
- L10: `DNS_CNAME = process.env.NEXT_PUBLIC_CNAME_TARGET ?? process.env.NEXT_PUBLIC_PLATFORM_DOMAIN`
- Toast messages: L221 "Domain added successfully!", L237 "Domain verified successfully!", L255 "Custom domain removed.", L278 `"${selected}" is now your Primary Domain.`

**No direct SERVER_IP error strings in DomainsClient UI** — error details come from action responses.

---

## 3. Tests

**Test file 1:** `/src/__tests__/unit/dashboard/domains-actions.test.ts` (268 lines)
- L44–46: Mocks `DO_API_TOKEN=mock-token`, `DO_APP_ID=mock-app-id`, `SERVER_IP=162.159.140.98,172.66.0.96`
- L74–101: Tests addCustomDomain with mock DO GET/PUT
- L105–129: Tests removeCustomDomain with mock DO GET/PUT
- L178–267: Tests verifyCustomDomain with DNS mock + DO API phase checks

**Test file 2:** `/src/__tests__/unit/dashboard/f19-domains-client.test.tsx` (150+ lines)
- L30–32: Mock domains array
- L108–118: Tests DNS instructions show `NEXT_PUBLIC_SERVER_IP` and CNAME
- References to `NEXT_PUBLIC_SERVER_IP` in expectations (L115)

**Test file 3:** `/src/__tests__/unit/actions/domains-actions.test.ts` (100 lines)
- Similar addCustomDomain/removeCustomDomain tests

---

## 4. Middleware & routing

**File:** `/src/middleware.ts` (263 lines)

**Custom domain routing (REQ-F19-06):**
- L156–184: If hostname is not platform/admin/local, rewrite to `/sites/custom{pathname}`
- L158–174: Before rewrite, call `/api/domain-primary?host=hostname` to check if domain is primary
- L181: Sets `x-tenant-hostname` header

**Tenant lookup:** `/src/app/api/domain-primary/route.ts` (51 lines)
- L20–28: Queries Payload `tenants` where `customDomains.domain equals host`
- **Does NOT check Vercel project registration** — only Payload collection

---

## 5. Payload tenant schema

**File:** `/src/collections/Tenants.ts` (200+ lines)

**L88–98: `customDomains` array:**
- L94: `domain` (text, required, indexed)
- L95: `status` (select: 'pending' | 'active')
- L96: `isPrimary` (checkbox, default false)

**Missing for Vercel:**
- ❌ `vercelDomainId` (Vercel domain resource ID)
- ❌ `vercelDeploymentStatus` (SSL/verification status)

---

## 6. Env var usage

| Var | File | Lines | Count |
|-----|------|-------|-------|
| `SERVER_IP` | actions.ts | 225, 243 | 2 |
| `NEXT_PUBLIC_SERVER_IP` | DomainsClient.tsx | 9 | 1 |
| `DO_API_TOKEN` | actions.ts | 74, 164, 253 | 3 |
| `DO_APP_ID` | actions.ts | 75, 165, 254 | 3 |
| `VERCEL_TOKEN` | *not found* | — | 0 |
| `VERCEL_PROJECT_ID` | *not found* | — | 0 |

**Env files:** No DO_API_TOKEN, DO_APP_ID, SERVER_IP, or VERCEL_* vars declared in .env*.example files.

---

## 7. Existing Vercel client

**Search results:** 0 dedicated Vercel API client in src/
- Only `/src/app/api/webhooks/vercel/route.ts` (webhook handler)
- No `@vercel/sdk` or Vercel Domains API wrapper found

---

## 8. Env files

- `.env.example`: No DO/Vercel domain vars
- `.env.staging.example`: Only `VERCEL_WEBHOOK_SECRET` (webhook consumption)
- `.env.production.example`: Same

---

## Files that will need to change

**Critical:**
1. `/src/app/(dashboard)/settings/domains/actions.ts` — Replace all DO GET/PUT (L79–195, L256–258)
2. `/src/collections/Tenants.ts` — Add `vercelDomainId`, `vercelDeploymentStatus` fields
3. `.env.example`, `.env.staging.example`, `.env.production.example` — Add DO_API_TOKEN (deprecated), VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID, SERVER_IP

**Tests:**
4. `/src/__tests__/unit/dashboard/domains-actions.test.ts` — Update DO mocks → Vercel API mocks
5. `/src/__tests__/unit/dashboard/f19-domains-client.test.tsx` — Update DNS expectations
6. `/src/__tests__/unit/actions/domains-actions.test.ts` — Update mocks

**UI (optional):**
7. `/src/app/(dashboard)/settings/domains/DomainsClient.tsx` — Update DNS_A_RECORD if Vercel uses CNAME-only

**Middleware:** No change needed — still routes by host → Payload lookup.

---

## Summary

**Total changeset:** ~10 files. Most impactful: actions.ts (all DO API calls) + Tenants schema + 3 test files. No existing Vercel integration — build from scratch.

