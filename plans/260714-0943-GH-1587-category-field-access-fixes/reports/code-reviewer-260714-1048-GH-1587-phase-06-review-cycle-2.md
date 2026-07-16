# Code Review — Phase 06 Cycle 2: GH-1587 C1 Fix Verification

**Reviewer:** code-reviewer (read-only) · **Scope:** `src/collections/Categories.ts` diff since Cycle 1
**Branch:** `feat/f08-1587-category-integrity-fixes`
**Prior report:** `code-reviewer-260714-1032-GH-1587-phase-06-category-field-access-review.md` (score 6.0/10, C1 Critical)

## Score: 9.5 / 10

**Verdict: C1 is RESOLVED.** Success criteria (score ≥9.0 OR all critical/high resolved) **MET**.
Both the primary trust-boundary fix (hook logic) and the belt-and-suspenders field lock are
correct and independently verified against Payload 3.79.0's actual hook-execution order (not
just static reading). One new Low/informational finding (dead code, no functional/security
impact).

---

## C1 re-verification

### 1. `ownerTenantId` no longer reads `data.tenant`

`src/collections/Categories.ts:119-129` — confirmed `data.tenant` is not referenced anywhere in
the `beforeValidate` hook anymore (`grep -n "data.tenant" Categories.ts` → zero hits inside the
hook body). On `create`: `ownerTenantId = req.user?.tenants[0]` (mapped through the same
object/id-shape handling used everywhere else in the file). On `update`:
`ownerTenantId = originalDoc?.tenant`. Both are authoritative, non-client-controlled sources.

### 2. `tenant`/`site` locked on both `create` and `update`

`Categories.ts:210` and `:220`: `access: { create: () => false, update: () => false }` on both
fields, unconditional (no super-admin exemption, matching the file's own `dna`-field pattern).

### 3. Happy path — traced against Payload's actual hook order, not assumed

This required resolving Cycle 1's open question about hook ordering. I fetched Payload 3.79.0's
actual source (`collections/operations/create.ts`, `fields/hooks/beforeValidate/promise.ts`) to
confirm the real sequence, rather than trusting the unit tests (which mock `payload.create` and
never exercise Payload's internal field-access enforcement layer at all):

```
1. collection access.create check
2. beforeValidate — FIELDS first (field.access.create evaluated HERE; if overrideAccess=false
   and access.create() returns false, the field is unconditionally deleted from data/siblingData,
   regardless of what value was set or by whom)
3. beforeValidate — COLLECTION (our cross-tenant hook)
4. beforeChange   — COLLECTION (our auto-inject hook)   ← order reversed vs beforeValidate:
5. beforeChange   — FIELDS (no further access stripping found in this file)
6. DB insert
```

Key consequence: field-level `access.create` stripping happens **once, early** (step 2), before
both our `beforeValidate` and `beforeChange` collection hooks run. So:

- **Legitimate create via `saveCategoryAction`** (`overrideAccess: false`, explicitly sets
  `writeData.tenant = tenantId` at `actions.ts:155-156`): step 2 strips that explicit value
  unconditionally (the lock doesn't special-case "correct" values) → `data.tenant` is `undefined`
  by the time our `beforeChange` auto-inject hook runs → `!data.tenant` is true → auto-inject sets
  it from `req.user.tenants[0]`, the same authoritative source `actions.ts` was deriving
  `tenantId` from — **same final value, different mechanism**. Category creation is not broken.
- **Native REST `POST /api/categories` (no `overrideAccess`, real request)**: same stripping
  applies at step 2 regardless of what the client sent; auto-inject fills in the real tenant at
  step 4. Confirmed no `required: true` validation failure risk (field ends up populated either
  way).
- **Seed/generate-site scripts** (`scripts/seed.ts`, `src/scripts/seed-storefront.ts`,
  `src/app/api/ai/generate-site/route.ts`): none pass `overrideAccess` or a `req`/`user`-bearing
  context — Local API default is `overrideAccess: true`, which per the fetched source
  (`overrideAccess ? true : await field.access[operation](...)`) bypasses the check entirely at
  step 2 → their explicit `tenant`/`site` values pass through unmodified. Confirmed via `grep` for
  `overrideAccess` in these files (none found) → not broken by this fix.

### 4. Exploit walkthrough against new code

- **CREATE** (attacker POSTs `{parent: victimParentId, tenant: victimTenant, site: <forged>}`):
  field lock strips `tenant`/`site` at beforeValidate-fields (step 2, `overrideAccess=false` for
  a real HTTP request) → our `beforeValidate` hook computes `ownerTenantId` from
  `req.user.tenants[0]` (attacker's real tenant), compares to `parentTenantId` (victim's) →
  mismatch → `CATEGORY_PARENT_TENANT_MISMATCH` thrown. **Blocked**, and blocked twice over
  (hook logic + field lock independently).
- **UPDATE** (attacker PATCHes own category with forged `tenant: victimTenant` to fool the
  check while re-parenting under a victim node): our hook now uses `originalDoc?.tenant` (the
  real persisted value), completely ignoring the forged payload → mismatch → blocked. Field lock
  also independently strips the forged value (falls back to the doc's own persisted value per
  `getFallbackValue`), so even if the hook were bypassed the column can't be corrupted.

Both variants flagged in Cycle 1 (the certain CREATE path and the "likely" UPDATE path,
previously marked as needing integration-level confirmation) are now closed, and the ordering
uncertainty from Cycle 1's unresolved question #1 is resolved (confirmed via source, not
assumption).

---

## Regression tests — genuinely real, not tautological

Read `src/__tests__/unit/dashboard/category-field-access.test.ts:345-489` (TC-F08-05-10..13).
All four call into the real `Categories` collection config (`await import('@/collections/Categories')`,
then `Categories.hooks.beforeValidate[0]` / `Categories.hooks.beforeChange[0]`) — not a
reimplementation.

- **TC-10** (CREATE exploit): attacker's `req.user.tenants=[attacker]`, forges
  `data.tenant=victim` matching the parent's real tenant. Asserts `rejects.toThrow`. Verified by
  hand this would **not** have thrown under the pre-fix code (`ownerTenantId = dataTenantId ??
  tenantIds[0]` prefers `data.tenant` → matches parent → passes) — genuine regression test.
- **TC-11**: direct assertion on `tenantField.access.create()` / `siteField.access.create()`
  returning `false` — straightforward config check, not vacuous (would fail pre-fix, since
  `access.create` was undefined on both fields then).
- **TC-12** (happy path): omits `tenant`/`site`, runs both `beforeValidate` then `beforeChange`
  hooks in sequence, asserts auto-injected values. Confirms the fix doesn't break legitimate
  creates.
- **TC-13** (UPDATE exploit): `originalDoc.tenant` real, `data.tenant` forged to victim's tenant.
  Asserts throw. Verified this would **not** have thrown under pre-fix code — genuine regression
  test for the previously-uncertain UPDATE variant.

None of the four re-implement the hook's cross-tenant logic inline; all call the real exported
hook function. TC-ID references present and correctly scoped to GH-1587 C1.

---

## New issues introduced by this fix

### Checked: does locking `tenant`/`site` on `create` break other write paths?

Re-grepped every `collection: 'categories'` create site: `scripts/seed.ts`,
`src/scripts/seed-storefront.ts`, `src/app/api/ai/generate-site/route.ts`,
`src/app/(dashboard)/products/categories/actions.ts` (`saveCategoryAction`). All either rely on
Local API's default `overrideAccess: true` (scripts/generate-site — bypasses the lock entirely,
unaffected) or go through the `beforeChange` auto-inject as traced above
(`saveCategoryAction` — still produces the correct value). **No broken write path found.**

### Low — informational only

**`src/app/(dashboard)/products/categories/actions.ts:144-159`** — `writeData.tenant = tenantId`
(create) is now dead code for the `create()` call specifically: Payload's field lock strips
whatever value this line sets (unconditionally, at beforeValidate-fields, before Payload ever
looks at whether the value is "correct") and the `Categories.ts` `beforeChange` auto-inject
supplies the actual persisted value instead. Both derive from the same `req.user`/`tenantId`
source, so the *result* is identical and nothing is broken — but the comment at
`actions.ts:147-152` ("Always force the server-derived tenant... this is defense-in-depth, not
the primary guard") is now slightly inaccurate for the create path: this line has zero effect on
what's persisted for `create`, the field-level lock's own fallback (auto-inject) is now the sole
effective source. Non-blocking; a future cleanup could drop the now-redundant assignment or
update the comment to note it's fully superseded on create. `delete writeData.site` is
similarly redundant now (site's create access is also unconditionally locked) but equally
harmless.

No other new findings.

---

## Test suite — independently re-run

```
npx vitest run src/__tests__/unit/collections/categories-hooks.test.ts \
  src/__tests__/unit/dashboard/category-field-access.test.ts \
  src/__tests__/unit/dashboard/category-dedup.test.ts \
  src/__tests__/unit/dashboard/category-delete-integrity.test.ts
```
→ **4 files, 60/60 passed** (matches the 60/60 claim; note `categories-hooks.test.ts` lives at
`src/__tests__/unit/collections/`, not `unit/dashboard/` — file-location detail only, no impact).

```
npx tsc --noEmit
```
→ **No errors.**

---

## Checklist items re-verified (unchanged by this fix, spot-checked for regression)

1. **Access control correctness** — still PASS, caveat from Cycle 1 now closed (`tenant`/`site`
   create-path locked, matching `dna`'s pattern).
2. **Allowlist (Zod)** — `actions.ts` untouched by this fix; `CategoryServerSchema` unchanged.
3. **Parent cross-tenant logic** — now PASS without caveat (previously "trust anchor wrong").
4. **Breadcrumb fallback** — unchanged, `Categories.ts:178` untouched.
5. **Sentinel codes** — unchanged, all 3 emit sites still match handle sites.
6. **db-setup.js** — untouched by this fix (only `Categories.ts` changed).
7. **Tests** — PASS, 60/60 independently confirmed, 4 new tests are real (see above).
8. **Docs** — unchanged by this fix.
9. **Standards** — `Categories.ts` now 287 lines (was 274), modest growth from the fix + comments,
   no runaway growth concern. No `--no-verify` usage.

Nothing regressed. Full checklist detail available in Cycle 1's report; not re-litigated here.

---

## Recommended actions

1. None blocking — ready to proceed past Phase 06.
2. (Optional, non-blocking, future cleanup) Simplify or re-comment
   `actions.ts:144-159`'s now-redundant `writeData.tenant = tenantId` force-set for create, since
   the field lock + `beforeChange` auto-inject in `Categories.ts` is now the sole effective
   mechanism.
3. Carry forward Cycle 1's Low findings (stray QA doc checkbox, unrelated docker-compose files in
   working tree, `products/actions.ts` `.passthrough()` follow-up) — none touched by this fix,
   still applicable if not already addressed elsewhere in the plan.

## Unresolved questions

None. Cycle 1's hook-ordering question is resolved (confirmed via Payload 3.79.0 source:
`beforeValidate` runs fields-then-collection with field-access stripping happening once at the
fields stage; `beforeChange` runs collection-then-fields, so the collection hook's auto-inject
always executes after any stripping and is never re-stripped).
