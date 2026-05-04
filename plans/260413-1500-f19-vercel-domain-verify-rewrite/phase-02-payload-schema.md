# Phase 02 — Payload schema migration

## Context
- Parent: [plan.md](./plan.md)
- Depends on: none (parallel with phase 01)
- Payload docs: https://payloadcms.com/docs/fields/array

## Overview
- Date: 2026-04-13
- Description: Add `vercelDomainId` and `vercelVerification` fields to the `customDomains` array on `Tenants` collection so phase 03 can persist Vercel resource handles + outstanding TXT challenges.
- Priority: P0
- Implementation status: pending
- Review status: pending

## Key insights
- Payload v3 array fields are schemaless on the storage side (Mongo or Postgres JSONB) — adding optional fields requires no SQL/Mongo migration. Existing rows simply have the new keys absent.
- Storing `vercelVerification` (the TXT challenge array) lets the UI re-display instructions across page reloads without re-calling Vercel.
- We do NOT add `vercelDeploymentStatus` (originally proposed in scout) — `status: 'pending' | 'active'` already covers this and we read live SSL state on demand via `getProjectDomain`.

## Requirements
- Two new optional fields on `customDomains` array.
- No change to existing `domain`, `status`, `isPrimary` fields (preserves backward compat).
- Admin UI label/description so non-engineers know these fields are managed by automation.

## Architecture
```
Tenants.customDomains (array)
├── domain          text, required, indexed     (existing)
├── status          select, pending|active      (existing)
├── isPrimary       checkbox                    (existing)
├── vercelDomainId  text, optional              (NEW)  — stable Vercel handle (== domain name today, futureproof)
└── vercelVerification  json, optional          (NEW)  — array of { type, domain, value, reason }
```

`vercelDomainId` is stored even though it currently equals the domain name — it gives us a stable join key if Vercel ever introduces opaque IDs for project-domain resources.

## Related code files
- Modify: `src/collections/Tenants.ts` L88–L98 (the `customDomains` array definition)

## Implementation steps
1. Open `src/collections/Tenants.ts`, locate `customDomains` array (L88–98 per scout).
2. Append `vercelDomainId: { type: 'text', admin: { description: 'Vercel project-domain handle. Auto-managed.', readOnly: true } }`.
3. Append `vercelVerification: { type: 'json', admin: { description: 'Outstanding TXT challenges from Vercel verify. Auto-managed.', readOnly: true } }`.
4. Run `pnpm payload generate:types` to refresh `payload-types.ts`.
5. Verify `tsc --noEmit` — confirm new fields appear on `Tenant['customDomains'][number]` type.
6. Smoke-test in Payload admin: load any tenant → confirm new fields render read-only and don't break the row.

## Todo
- [ ] Edit `src/collections/Tenants.ts` — add `vercelDomainId`
- [ ] Edit `src/collections/Tenants.ts` — add `vercelVerification`
- [ ] Run `pnpm payload generate:types`
- [ ] `tsc --noEmit` clean
- [ ] Manual admin UI sanity check on staging dev DB

## Success criteria
- `payload-types.ts` exports the two new optional fields on `Tenant['customDomains']`.
- Existing tenant rows load without error (fields are absent → `undefined`, valid).
- Phase 03 can read/write both fields via Payload local API.

## Risk assessment
- Very low. Optional additive fields on a JSON-storage array. No data migration.
- Edge: if Postgres adapter is ever switched to a relational table for arrays, we'd need a migration — currently fine.

## Security considerations
- `vercelVerification` exposes TXT challenge values to anyone who can read the tenant doc. These are not secrets (TXT records are public DNS by design once set), but ensure `customDomains` field-level access on Tenants doesn't accidentally expose them across tenants. Confirm existing `access.read` on Tenants is owner-scoped.

## Next steps
- Phase 03 consumes these fields. Phase 06 backfill script populates `vercelDomainId` for existing rows.

## Open questions
- None.
