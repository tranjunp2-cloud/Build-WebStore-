# Phase 02 — Admin CMS Config + Validation

**Priority:** P1 · **Status:** pending · **Effort:** 4h · **Blocks on:** 01

Make the Discounts collection usable in the Payload admin: list columns, search/filter, field-level
validation (percentage 0–100, fixed ≥ 0, date range coherence, unique code per tenant, uppercase code).

## Gap-audit fixes applied here (2026-05-29)

From `plans/reports/audit-260529-1543-f33-discount-gaps.md`. Phase 03's `resolveDiscount` DEPENDS on these:

- **(H) Date normalization to day boundaries in the store timezone (Asia/Kuala_Lumpur, UTC+8).** The admin
  date picker yields a midnight timestamp; left as-is, `expiresAt = 2026-08-31` would expire at the START of
  Aug 31 (and even earlier in UTC), silently dropping the final day. `validateDiscount` MUST normalize
  `startsAt → start-of-day (00:00:00.000)` and `expiresAt → end-of-day (23:59:59.999)` in store tz before
  save. Phase 03 then compares `now` against the stored timestamps directly — no boundary math at read time.
- **(K) Code normalization runs on BOTH create and update** (Payload `beforeChange` does by default) so the
  canonical `UPPER(TRIM(code))` invariant always holds — this is what makes the unique index + the Phase 03
  `resolveDiscount` lookup (which also `UPPER(TRIM)`s the buyer input) agree. Keep both sides identical.
- **(J) Soft-delete only.** Phase 01 set `access.delete: false`, so the admin row-action Delete is hidden.
  "Removing" a discount = set `status: 'inactive'`. Do NOT add a custom delete control in this phase.

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
  - **Normalize dates (gap H):** `startsAt → start-of-day`, `expiresAt → end-of-day`, both in store tz
    (`Asia/Kuala_Lumpur`). Run AFTER the `startsAt < expiresAt` check (use the raw dates for the comparison,
    persist the normalized ones).
  - `code` non-empty, normalized to UPPERCASE + trimmed (on create AND update).
  - Friendly error if duplicate code within tenant (pre-check before DB index throws).

**Non-functional:** validation hook file < 120 lines; pure function exported for unit test.

## Architecture

```
Discounts.beforeChange → validateDiscount(data, { req, originalDoc })
   ├─ normalize code (upper/trim)              ← create + update (gap K)
   ├─ assert value bounds by type  → throw Error(msg) on fail
   ├─ assert date range (raw)      → throw Error(msg) on fail
   ├─ normalize startsAt→start-of-day, expiresAt→end-of-day (store tz)  ← gap H
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
   - Normalize `data.code = String(data.code).trim().toUpperCase()` (runs on create + update).
   - Type-dependent bounds check → throw `Error('Percentage must be between 0 and 100')` / `Error('Fixed amount must be ≥ 0')`.
   - Date coherence on the RAW dates → throw `Error('Start date must be before expiry date')`.
   - **Normalize dates (gap H):** if `data.startsAt` → set to start-of-day; if `data.expiresAt` → set to end-of-day, in `Asia/Kuala_Lumpur`. Keep a small pure helper (e.g. `startOfDayKL` / `endOfDayKL`) so Phase 05 can unit-test the boundary. Prefer the repo's existing date util / `Intl` over adding a new dep.
   - Uniqueness: `payload.find({ collection:'discounts', where:{ and:[{code:{equals}}, {tenant:{equals}}, {id:{not_equals:originalDoc?.id}}] }, limit:1 })` → throw if found.
3. Wire hook in Discounts.ts.
4. `npx tsc --noEmit`.

## Todo

- [ ] admin block (columns + search) added
- [ ] validate-discount.ts created + exported
- [ ] hook wired into Discounts.ts
- [ ] type-bound, date-range, uniqueness checks implemented
- [ ] **date normalization: startsAt→start-of-day, expiresAt→end-of-day (Asia/Kuala_Lumpur) — gap H**
- [ ] code normalized on create AND update (gap K)
- [ ] no custom delete control (soft-delete via status — decision J)
- [ ] tsc clean

## Success criteria

- Admin list shows configured columns + search works by code.
- Creating `percentage` value 150 → rejected with message.
- Creating `fixed` value -5 → rejected.
- `startsAt > expiresAt` → rejected.
- Duplicate code in same tenant → friendly error (not raw 23505).
- Same code in DIFFERENT tenant → allowed.
- **Saving `expiresAt = 2026-08-31` persists `2026-08-31T23:59:59.999+08:00` (end-of-day) → code stays valid through all of Aug 31 (gap H).**
- `startsAt = 2026-06-01` persists `2026-06-01T00:00:00.000+08:00` (start-of-day).
- Stored `code` is always `UPPER(TRIM)` after both create and update (gap K).

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Uniqueness check race (TOCTOU) | M×M | DB partial unique index (Phase 01) is the real guard; hook is UX layer |
| Hook throws break super-admin edits | L×M | Tenant resolved from data/originalDoc, not req.user; super-admin still scoped by record's tenant |
| value semantics confusion (pct vs sen) | M×M | `admin.description` on `value` field states unit per type |
| expiry off-by-one / tz drift (gap H) | M×M | normalize to start/end-of-day in store tz on save; unit-test the boundary helper in Phase 05 |
| server tz ≠ store tz (Vercel UTC) | M×M | normalize explicitly to `Asia/Kuala_Lumpur`, never rely on `new Date()` local tz |

## Security considerations

- Uniqueness query scoped to the record's tenant — no cross-tenant code enumeration.
- Validation server-side (hook) — cannot be bypassed by crafted admin API calls.

## Next steps

Unblocks Phase 03 (checkout apply relies on validated, normalized `code` + bounds).
