# Phase 01 — Tenant Access Refactor

## Context links
- Plan: [plan.md](./plan.md)
- Pattern source: `src/collections/Sites.ts:13-41`, `src/collections/Tenants.ts:31-55`
- Touched collections: `src/collections/ContactSubmissions.ts`, `src/collections/Subscribers.ts`

## Overview
- Date: 2026-04-29
- Description: Extract repeated tenant-scope access logic into shared helper. Relax `read` on ContactSubmissions + Subscribers from super-admin-only to "super-admin OR site belongs to user's tenant". Allow tenant-owner to update ContactSubmission `status` only.
- Priority: P2 (blocker for phase-02)
- Implementation status: pending
- Review status: pending

## Key insights
- Pattern in Sites/Tenants/Users is duplicated 3× — DRY win to extract.
- Submissions reference `site` (not `tenant`); helper must support `site → tenant` indirection via Payload `where` 2-hop: `{ site: { tenant: { in: tenantIds } } }`. Verify Payload 3.79 nested-relationship `where` resolution; if unsupported, fall back to pre-fetching `siteIds` for tenant then `{ site: { in: siteIds } }`.
- Field-level access (`fields[].access.update`) lets us lock down everything except `status` for non-super-admin.

## Requirements
**Functional**
1. Helper `siteScopedRead({ req })` returns `true` for super-admin, `{ site: { in: siteIds } }` for tenant member, `false` for unauth.
2. Helper `tenantSiteIds(req)` resolves tenant memberships → site ids (cached per request via WeakMap on `req`).
3. ContactSubmissions: `read` uses helper; `update` uses helper; field access locks all fields except `status` for non-super-admin.
4. Subscribers: `read` uses helper. `update`/`delete` stay super-admin only (no tenant write use case identified).

**Non-functional**
- Helper file ≤100 LOC.
- Zero new DB queries on hot path beyond what existing pattern does.

## Architecture
```
src/access/tenant-scope.ts          ← new helper module
  ├─ isSuperAdmin(user)             pure
  ├─ tenantIds(user)                pure (reads user.tenants[])
  ├─ tenantSiteIds(req)             async, cached, queries sites collection
  └─ siteScopedRead({ req })        access fn, returns bool|Where

src/collections/ContactSubmissions.ts
  └─ access.read    = siteScopedRead
  └─ access.update  = siteScopedRead
  └─ fields[].access.update locks non-status fields for non-super-admin

src/collections/Subscribers.ts
  └─ access.read    = siteScopedRead
```

Data flow (read by tenant-owner):
```
req → siteScopedRead → tenantSiteIds(req) → query sites where tenant IN userTenants
   → returns siteIds → returns Where { site: { in: siteIds } }
   → Payload applies where → returns scoped docs
```

## Related code files
**READ**
- `src/collections/Sites.ts` (pattern reference)
- `src/collections/Tenants.ts` (pattern reference)
- `src/collections/Users.ts:915-967` (tenants array shape)

**MODIFY**
- `src/collections/ContactSubmissions.ts`
- `src/collections/Subscribers.ts`

**CREATE**
- `src/access/tenant-scope.ts`

**DELETE**
- none

## Implementation steps
1. Create `src/access/tenant-scope.ts` exporting `isSuperAdmin`, `tenantIds`, `tenantSiteIds`, `siteScopedRead`.
2. `tenantSiteIds(req)` implementation:
   - If super-admin: return `null` (sentinel for "all").
   - Resolve `tenantIds(req.user)`; if empty: return `[]`.
   - `req.payload.find({ collection: 'sites', where: { tenant: { in: tenantIds } }, limit: 1000, depth: 0 })` → map `id`.
   - Cache on `req` via `req.__tenantSiteIds` (no WeakMap needed — req is per-request).
3. `siteScopedRead`:
   ```ts
   if (!req.user) return false
   if (isSuperAdmin(req.user)) return true
   const ids = await tenantSiteIds(req)
   if (!ids || ids.length === 0) return false
   return { site: { in: ids } }
   ```
4. Update `ContactSubmissions.access.read` + `update` to use `siteScopedRead`. Keep `delete` super-admin only.
5. Add field-level access on ContactSubmissions: every field EXCEPT `status` gets `access: { update: ({ req }) => isSuperAdmin(req.user) }`.
6. Update `Subscribers.access.read` to use `siteScopedRead`. Leave update/delete unchanged.
7. Run `npm run build` (or `pnpm build`) — confirm Payload type generation succeeds, no TS errors.
8. Manual smoke: hit `/api/contact-submissions?depth=0` as tenant-owner via REST → verify only own-tenant rows return. As super-admin → all rows.

## Todo
- [ ] Create `src/access/tenant-scope.ts`
- [ ] Verify nested-relationship `where` works on Payload 3.79; else use pre-resolved siteIds
- [ ] Wire ContactSubmissions read/update + field-level access
- [ ] Wire Subscribers read
- [ ] Build passes (`tsc`/`payload generate:types` clean)
- [ ] REST smoke as 2 different users

## Success criteria
- Tenant-owner GET `/api/contact-submissions` returns only their site's rows.
- Tenant-owner PATCH submission `status` succeeds; PATCH `email` returns 403.
- Super-admin retains full read/write/delete.
- Subscribers tenant-owner GET returns scoped rows.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|------------|
| Nested `where` (`site.tenant.in`) unsupported | M×M | Pre-resolve siteIds (already in plan, step 2) |
| Field-level access misconfigured → tenant-owner edits message body | L×H | Manual REST PATCH test in step 8 |
| Cached `req.__tenantSiteIds` collides with another module | L×L | Use namespaced key `__customerTrackingTenantSiteIds` |
| User has 0 tenants but is authenticated | L×M | Return `false` explicitly in helper |

## Security considerations
- Helper MUST default-deny (return `false` on missing user / empty tenants).
- Field-level access locks PII fields (`email`, `phone`, `message`, `ipAddress`) from tenant-owner mutation.
- No new logging of PII.
- Re-confirm `req.user.roles` is populated in admin context (Payload populates it via auth strategy).

## Next steps
- Phase 02 consumes the relaxed read for aggregation queries.
