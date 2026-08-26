# Phase 04 — CSV Export

**Priority:** P2 · **Status:** pending · **Effort:** 2h · **Blocks on:** 01 (parallel with 02)

Stream a tenant-scoped CSV export of discounts in a **self-contained new route**. Use the existing,
hardened customers export route as a structural reference (same security posture) but DO NOT extract a
shared helper and DO NOT touch the customers route.

**Decision 4 (confirmed):** New `/api/v1/discounts/export` route contains its OWN CSV serialization. No
shared `csv.ts` helper extraction; the existing customers export route is left untouched. Small,
intentional duplication of the CSV-escaping helpers is acceptable per KISS/YAGNI — a one-off second
consumer does not justify a shared abstraction yet.

## Context links

- Structural reference (read-only, copy the pattern): `src/app/api/v1/customers/export/route.ts`
  (auth, tenant scoping, CSV escaping, formula-injection guard, row cap, streaming, super-admin ?tenantId)
- Auth helper: `@/lib/auth` `getCurrentUser`
- DB: `payload.db.drizzle.execute(sql\`...\`)` with `ANY(${tenantIds}::integer[])` parameterization

## Key insights

- The customers export already solves: auth (401), tenant resolution (owner vs super-admin), 10k row cap
  (413), CSV field escaping + CRLF strip + formula-injection prefix, `private, no-store` (PII), streaming.
  Copy these patterns INTO the new route (its own local `csvField`/`toCsvLine`/`sanitizeFilenameSegment`
  + tenant-resolution logic).
- DECISION (4): self-contained — no `src/lib/export/csv.ts`, no edits to the customers export route. The
  minor duplication is the cheaper, lower-risk path (no regression surface on the working customers export).

## Requirements

**Functional**
- `GET /api/v1/discounts/export` → text/csv attachment.
- Columns: `code,type,value,status,usageLimit,usageCount,startsAt,expiresAt,createdAt`.
- Tenant-owner scoped to own tenants; super-admin optional `?tenantId=`.
- 10k row cap → 413.

**Non-functional:** route < 200 lines (keep local helpers terse; they are small).

## Related code files

**Create**
- `src/app/api/v1/discounts/export/route.ts` — self-contained: own `csvField`/`toCsvLine`/`sanitizeFilenameSegment` + tenant-resolution + query + stream

**Modify:** none (customers export route deliberately untouched — decision 4)

**Delete:** none

## Implementation steps

1. Create `src/app/api/v1/discounts/export/route.ts`: copy the structure (auth, tenant resolution, cap, escaping, streaming, headers) from the customers export route, INLINING its own local CSV helpers. Swap table to `discounts`, columns per spec, filename `discounts-{label}-{date}.csv`.
2. Count query + data query over `discounts` with `tenant_id = ANY(...)`.
3. `npx tsc --noEmit`.

## Todo

- [ ] discounts/export route created, self-contained (auth + scoping + cap + stream + local CSV helpers)
- [ ] columns + filename correct
- [ ] customers export route NOT modified
- [ ] tsc clean

## Success criteria

- Authenticated tenant-owner downloads CSV of only their discounts.
- Anonymous → 401. Super-admin `?tenantId=N` → scoped; invalid id → 400.
- >10k rows → 413. Cells starting with `= + - @` prefixed with `'`.
- `Cache-Control: private, no-store` header present.

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Touching customers export regresses it | n/a | Eliminated — decision 4: route is self-contained, customers export untouched |
| SQL injection via tenantId | L×H | Reuse positive-int validation + parameterized `ANY(::integer[])` |
| PII/code leakage cross-tenant | L×H | Server-side tenant filter, ?tenantId only honoured for super-admin |

## Security considerations

- No anonymous access. Tenant filter enforced server-side. Formula-injection guard retained.
- `no-store` since discount codes are sensitive marketing assets.

## Next steps

Export covered by Phase 05 route test (auth + scoping + CSV escaping).
