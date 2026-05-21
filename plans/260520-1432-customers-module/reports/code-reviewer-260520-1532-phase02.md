# Code Review — Phase 02 (Customers Collection Schema)

- Commit: `e57bc4fe92ca1cdde5d80077edee46e74787e215`
- Branch: `feat/F25-customers-module`
- Files: `src/collections/Customers.ts` (NEW, 135 LOC), `scripts/db-setup.js` (+44), `src/payload.config.ts` (+2)
- Reviewer: code-reviewer agent
- Date: 2026-05-20 15:32

## Scope
- LOC: 181 total insertions across 3 files
- Focus: phase-02 spec compliance (locked PM decisions), schema rules, access pattern parity

## Overall Assessment

Implementation faithfully follows the phase-02 spec. Access control is a verbatim copy of `Sites.ts:13-41`. Migrations follow Payload Drizzle convention (varchar id + `_parent_id` + `_order` + `_uuid` for the array sub-table). Expression unique index uses the correct shape `(tenant_id, LOWER(TRIM(email)))` with NO `site_id`. `delete: () => false` matches `Orders.ts:91`. Email normalizer is null-safe. All 7 migration entries present + `'customers'` slug appended to `COLLECTION_SLUGS[]`.

## Scoring

### Correctness — 10/10

1. **Schema rule compliance** — PASS
   - `customers_addresses`: `id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text`, `_order integer`, `_parent_id integer`, `_uuid varchar` — all underscore-prefixed per `.claude/rules/database-schema.md` array convention.
   - `customers`: `id serial PRIMARY KEY` — correct for main table.
   - All migrations use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`. No `DROP TABLE`. Idempotent.
   - `payload_locked_documents_rels.customers_id` + `payload_preferences_rels.customers_id` ALTERs both present (db-setup.js:4020, 4023).
   - `COLLECTION_SLUGS[]` includes `'customers'` at line 4060.
2. **Identity uniqueness** — PASS. Expression unique index on `(tenant_id, LOWER(TRIM(email)))` exactly as specified. No `site_id` in identity key. No raw-email unique. Honors locked PM decision #1.
3. **Access control** — PASS. `read` and `update` are verbatim copies of `Sites.ts:13-41` (same defensive `if (!req.user) return false`, super-admin short-circuit, tenant filter with `in: tenantIds`, empty-tenants → deny). `delete: () => false` matches `Orders.ts:91`. Honors locked decision #3.
4. **beforeChange normalizer** — PASS. `if (typeof data.email === 'string')` is null/undefined safe; `trim().toLowerCase()` mirrors the expression index normalization so DB-level uniqueness aligns with stored values.
5. **Field types** — PASS. All field types and required flags match the spec:
   - `tenant` rel→tenants required+index ✓
   - `email` type='email' required+index ✓
   - `name` text required ✓
   - `phone` text optional, no unique index ✓ (honors locked decision #2)
   - `rank` select with exactly 4 options (`bronze|silver|gold|vip`) — honors locked decision #4
   - `addresses` array maxRows=10, `line1` required, `country` defaultValue `'Malaysia'` ✓
   - `notes` textarea ✓
   - `firstOrderAt` date with `admin.readOnly: true` ✓
   - `timestamps: true` ✓

### Code quality — 10/10

6. **LOC** — Customers.ts = 135 LOC, well under 200 target.
7. **Style consistency** — Indentation (4-space), import order, `import type { CollectionConfig } from 'payload'`, and field admin descriptions all mirror `Sites.ts`/`Subscribers.ts`/`Orders.ts`. Migration entry format matches subscribers/contact_submissions precedent (single-key object, inline SQL template literal).
8. **No dead code** — No commented stubs, no TODOs, no `console.log`. Comments are purposeful (e.g., `// Hard-delete forbidden; GDPR/anonymize handled in a separate plan`).
9. **Migration naming** — Consistent with subscribers pattern: `customers.create_table`, `customers.tenant_email_lower_unique`, `customers.tenant_index`, `customers_addresses.create_table`, `customers_addresses.parent_index`, `payload_locked_documents_rels.customers_id`, `payload_preferences_rels.customers_id`. No conflict with pre-existing `tenants.customer_id` (singular, different table) at db-setup.js:1623.

### Security — 10/10

10. **No PII logging** — Normalizer hook does not log email/phone. No `console.log` anywhere in the new file.
11. **No `overrideAccess` usage** — Phase 02 has no hooks needing it; bypass risk = N/A.
12. **Tenant leak prevention** — Access read/update filters use `{ tenant: { in: tenantIds } }`. Empty-tenants user gets `return false` (denied), not `return {}` (which would leak all rows). Super-admin gated explicitly via roles check. Identical hardening to `Sites.ts`.

Bonus: expression unique index on `LOWER(TRIM(email))` combined with the `beforeChange` lowercase normalizer means duplicate detection works both when written via Payload API and when written via raw SQL (defense in depth).

### Anti-scope adherence — 10/10

13. **No Orders.ts changes** — diff confirms only 3 files touched.
14. **No UI/admin components** — Customers.ts is collection config only.
15. **No tests** — Phase 05 owns; correctly deferred.
16. **No ETL/backfill code** — None present.

### Overall: 10.0 / 10

## Critical Issues

None.

## Major Issues

None.

## Minor Issues / Observations (non-blocking)

- `notes` textarea has no field-level access restriction. Spec line 256 anticipates this and explicitly defers ("whole collection already tenant-scoped; revisit if PW1 had per-staff hide"). Acceptable as-is.
- Cached stats columns (`order_count`, `total_spent`, `last_order_at`) deliberately omitted — phase-04 will compute on-the-fly. YAGNI honored.
- `_order integer NOT NULL DEFAULT 0` on `customers_addresses` works but if two addresses share `_order=0` ordering is implementation-defined. Payload manages this column server-side; non-issue for Phase 02 scope.
- Risk register R1 (expression index syntax on Neon) — not validated in this review since `npm run build` + smoke are deferred to cook validation. Phase 02 spec's "Implementation steps 6/7/8" cover this.

## Positive Observations

- Verbatim access-control copy from `Sites.ts` avoids divergence drift; identical type signature `(t: { tenant: string | { id: string } })` (better than `Orders.ts`'s `(t: any)` — actually a small improvement over precedent).
- Migration entries grouped under a clear `// ── F25: Shop Customers collection ──` banner matching prior section conventions.
- `_uuid varchar NOT NULL DEFAULT gen_random_uuid()::text` extra column is included in the array sub-table per the rule (some legacy F-tables omit it; this one gets it right).
- `gen_random_uuid()::text` cast preserves varchar type while leveraging pgcrypto/pg13+ built-in (no extension dependency assumed at write-time).

## Edge Cases Reviewed

- Empty `req.user.tenants` → access returns `false` (not `{}`). Correct — prevents all-tenants leak.
- Non-string `data.email` (e.g., undefined on partial update) → normalizer no-ops. Correct.
- Duplicate email differing only by casing/whitespace within same tenant → unique expression index catches at DB layer even if normalizer is bypassed (e.g., direct SQL). Defense in depth.
- Cross-tenant duplicate email (same email, different tenants) → permitted by `(tenant_id, ...)` composite. Honors omnichannel-per-tenant decision.
- `delete: () => false` returns falsy → Payload returns 403 (per Orders precedent). Spec success criteria match.

## Metrics

- TypeScript: types imported (`CollectionConfig`); no `any` introduced (improves on Orders.ts which uses `t: any`).
- Lint risk: low — style matches surrounding files; no unused imports.
- Test coverage: N/A — phase 05 owns.

## Unresolved Questions

None. All locked PM decisions are honored in code; all anti-scope boundaries respected; all schema rules followed.

---

**RECOMMENDATION: AUTO-APPROVE — proceed to Phase 03**
