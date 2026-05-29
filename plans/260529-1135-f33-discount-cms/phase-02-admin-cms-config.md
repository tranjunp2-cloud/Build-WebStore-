# Phase 02 — Admin CMS Config + Validation

**Priority:** P1 · **Status:** pending · **Effort:** 4h · **Blocks on:** 01

Make the Discounts collection usable in the Payload admin: list columns, search/filter, field-level
validation (percentage 0–100, fixed ≥ 0, date range coherence, unique code per tenant, uppercase code).

## Context links

- Pattern: `src/collections/Customers.ts` admin block (`defaultColumns`, `listSearchableFields`)
- Pattern: `src/collections/Tenants.ts` `hooks.beforeChange` (slug validation throws Error)
- Field-level validate fn precedent: Payload `validate` callback returning string|true

## Key insights

- Payload 3.79 `admin.listSearchableFields` enables free-text search in list view (used in Customers).
- `admin.defaultColumns` controls visible columns (search/filter UX requirement from §2.7).
- Cross-field validation (date range, type-dependent value bounds) belongs in a `beforeChange` hook,
  not per-field `validate` (which can't see siblings reliably for this case). Single-responsibility hook
  file under `src/collections/discounts-hooks/` mirrors `src/collections/orders-hooks/` layout.
- Unique-per-tenant code: DB partial index (Phase 01) is the hard guard; the beforeChange hook gives a
  friendly error message + normalizes case before the insert.

## Requirements

**Functional**
- List view columns: `code`, `type`, `value`, `status`, `usageCount`, `expiresAt`.
- Search by `code` + `description`. Filterable by `status`, `type` (Payload list filters use indexed fields).
- Validation:
  - `type=percentage` → `0 < value ≤ 100`.
  - `type=fixed` → `value ≥ 0` (sen, integer).
  - If both `startsAt` and `expiresAt` set → `startsAt < expiresAt`.
  - `code` non-empty, normalized to UPPERCASE + trimmed.
  - Friendly error if duplicate code within tenant (pre-check before DB index throws).

**Non-functional:** validation hook file < 120 lines; pure function exported for unit test.

## Architecture

```
Discounts.beforeChange → validateDiscount(data, { req, originalDoc })
   ├─ normalize code (upper/trim)
   ├─ assert value bounds by type  → throw Error(msg) on fail
   ├─ assert date range            → throw Error(msg) on fail
   └─ assert code unique in tenant → payload.find({code, tenant, id!=self}) → throw if hit
```

## Related code files

**Create**
- `src/collections/discounts-hooks/validate-discount.ts` (exported `validateDiscount` beforeChange hook)

**Modify**
- `src/collections/Discounts.ts` — add `admin: { useAsTitle: 'code', defaultColumns, listSearchableFields }`,
  wire `hooks.beforeChange: [validateDiscount]`, add field-level `min`/`max` where trivially expressible.

**Delete:** none

## Implementation steps

1. Add `admin` block to Discounts.ts: `useAsTitle: 'code'`, `defaultColumns`, `listSearchableFields: ['code','description']`, `description`.
2. Create `validate-discount.ts`:
   - Normalize `data.code = String(data.code).trim().toUpperCase()`.
   - Type-dependent bounds check → throw `Error('Percentage must be between 0 and 100')` / `Error('Fixed amount must be ≥ 0')`.
   - Date coherence → throw `Error('Start date must be before expiry date')`.
   - Uniqueness: `payload.find({ collection:'discounts', where:{ and:[{code:{equals}}, {tenant:{equals}}, {id:{not_equals:originalDoc?.id}}] }, limit:1 })` → throw if found.
3. Wire hook in Discounts.ts.
4. `npx tsc --noEmit`.

## Todo

- [ ] admin block (columns + search) added
- [ ] validate-discount.ts created + exported
- [ ] hook wired into Discounts.ts
- [ ] type-bound, date-range, uniqueness checks implemented
- [ ] tsc clean

## Success criteria

- Admin list shows configured columns + search works by code.
- Creating `percentage` value 150 → rejected with message.
- Creating `fixed` value -5 → rejected.
- `startsAt > expiresAt` → rejected.
- Duplicate code in same tenant → friendly error (not raw 23505).
- Same code in DIFFERENT tenant → allowed.

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Uniqueness check race (TOCTOU) | M×M | DB partial unique index (Phase 01) is the real guard; hook is UX layer |
| Hook throws break super-admin edits | L×M | Tenant resolved from data/originalDoc, not req.user; super-admin still scoped by record's tenant |
| value semantics confusion (pct vs sen) | M×M | `admin.description` on `value` field states unit per type |

## Security considerations

- Uniqueness query scoped to the record's tenant — no cross-tenant code enumeration.
- Validation server-side (hook) — cannot be bypassed by crafted admin API calls.

## Next steps

Unblocks Phase 03 (checkout apply relies on validated, normalized `code` + bounds).
