# Code Review — Phase 06: GH-1587 Category Field-Access & Integrity Fixes

**Reviewer:** code-reviewer (read-only) · **Scope:** working-tree diff, Phases 01–05 (uncommitted)
**Branch:** `feat/f08-1587-category-integrity-fixes`

## Score: 6.0 / 10

**Success criteria (score ≥9.0 OR all critical/high resolved): NOT MET.** One unresolved
Critical finding (C1) directly undermines the H2 fix this phase set out to deliver. All other
checklist items pass cleanly.

## Files reviewed (diff)
- `src/collections/Categories.ts` (+80/-8)
- `src/app/(dashboard)/products/categories/actions.ts` (+37/-31, incl. -14 net)
- `src/app/(dashboard)/products/categories/components/CategoryManager.tsx` (+6)
- `src/i18n/locales/{en,ms}.json` (+3/-2 each)
- `scripts/db-setup.js` (+18/-3)
- `docs/qa/F08-product-crud.md` (+2/-2)
- Tests: `categories-hooks.test.ts`, `category-dedup.test.ts`, `category-delete-integrity.test.ts`
  (modified), `category-field-access.test.ts` (new)
- Verified out of scope (untouched by these phases, present in working tree): `docker-compose.yml`,
  `scripts/db-migrate-dev.js`, `docker-compose.worktree.yml` — unrelated to GH-1587, flagged below.

Verified: `npx vitest run` on the 4 category test files → **56/56 pass**. `npx tsc --noEmit` →
no errors touching Categories files.

---

## Critical

### C1. Parent cross-tenant check trusts client-supplied `data.tenant` — H2 fix is bypassable

`src/collections/Categories.ts:113-121` (inside `beforeValidate`, the very hook added to close
H2):

```js
const dataTenantId = data.tenant
    ? (typeof data.tenant === 'object' ? (data.tenant as { id: string | number }).id : data.tenant)
    : undefined
const tenantIds = req.user?.tenants?.map(...) ?? []
const ownerTenantId = dataTenantId ?? tenantIds[0]
if (parentTenantId == null || ownerTenantId == null || String(parentTenantId) !== String(ownerTenantId)) {
    throw new Error('CATEGORY_PARENT_TENANT_MISMATCH');
}
```

`ownerTenantId` prefers `data.tenant` (raw client input) over the authoritative source
(`req.user`'s real tenant on create, `originalDoc.tenant` on update). Combined with the `tenant`
field having **no `create` access lock** (`Categories.ts:189-198` only sets
`access: { update: () => false }`, nothing for `create`), this is fully exploitable on **CREATE**,
with certainty, independent of any Payload internals assumption:

1. A tenant user (any authenticated user passing the existing `access.create` subscription check —
   this check never inspects `data`, see `Categories.ts:13-26`) sends a raw
   `POST /api/categories` with `{ name, parent: <victim-tenant-category-id>, tenant:
   <victim-tenant-id>, site: <victim-site-id> }`.
2. `beforeValidate` reads `data.tenant` = victim tenant → `ownerTenantId` = victim tenant →
   matches `parentTenantId` (the parent really does belong to that tenant) → the very check meant
   to block this **passes**.
3. `tenant`/`site` field access only blocks `update`, not `create`, so the forged values are
   **not stripped** and persist to the DB as-is.
4. Result: attacker plants an arbitrary category into another tenant's category tree/site,
   fully bypassing the H2 fix this phase exists to deliver. `beforeChange`'s auto-inject
   (`Categories.ts:141-146`) never fires because it's guarded by `if (!data.tenant …)` — it only
   helps the legitimate case where the client omits `tenant`.

A second, related variant likely also applies on **UPDATE**: `access.update: () => false` on
`tenant` silently strips the forged value from the persisted write, but only at the field-access
enforcement stage, which — per Payload's documented hook order (`beforeValidate` → field
access/validation → `beforeChange`) — runs *after* the collection's `beforeValidate` hook where
this check lives. If that ordering holds (consistent with why `beforeChange`'s `!data.tenant`
auto-inject only works when the client omits the field, i.e. `data.tenant` is not pre-stripped
before hooks run), an attacker can PATCH one of their **own** categories with a forged `tenant`
matching a foreign category, satisfy the cross-tenant check, and have `parent` (which carries no
field access at all) persist pointing at the foreign tenant's node — while the real `tenant`
column silently stays unchanged. This variant is slightly less certain without a live Payload
integration test (flagged as unresolved question below), but the CREATE-path exploit in steps 1-4
above is proven purely by static reading of the code and does not depend on that assumption.

**Fix direction (KISS, consistent with the rest of this phase):** never derive `ownerTenantId`
from `data.tenant`. On create, use the authenticated user's own tenant
(`req.user.tenants` — same source `access.create` already trusts). On update, use
`originalDoc?.tenant` (the already-persisted, authoritative value), never the incoming payload.
Additionally lock `tenant`/`site` field `access.create` the same way `update` is already locked
(`access: { create: () => false, update: () => false }`), relying on the existing
`beforeChange` auto-inject to populate them post-strip — mirrors the pattern already used for
`dna` (create+update locked together) elsewhere in this same file.

**This is the same vulnerability class the PR's own root-cause statement describes** ("any tenant
user … overwrite dna/tenant/site … via the native REST route") — CREATE is a native REST route
too, and the parent-check trusting `data.tenant` reopens the door the field-level lock was meant
to close.

---

## High
None beyond C1.

## Medium
None.

## Low

1. **`docs/qa/F08-product-crud.md` TC-F08-05-07`** (`REMOVED` row) still shows `Priority: High`
   and an unchecked `[ ]` box. Harmless (row content clearly states REMOVED), but a stray
   leftover — cosmetic only.
2. **Unrelated uncommitted changes in the working tree**: `docker-compose.yml`,
   `scripts/db-migrate-dev.js` (modified), `docker-compose.worktree.yml` (untracked) are not
   touched by any of Phases 01–05 and appear to be local dev/worktree setup, not GH-1587 work.
   Flag to avoid accidentally bundling them into this PR's commit.
3. **`src/app/(dashboard)/products/actions.ts:192`** still uses `.passthrough()` on its Zod
   schema — same vulnerability class (M1) this phase closed for Categories, left open for
   Products. Out of scope for GH-1587 but worth a follow-up ticket given the precedent just set
   here.

---

## Checklist results (phase-06 requirements)

1. **Access control correctness** — PASS with caveat. `dna` create+update super-admin-only
   confirmed (`Categories.ts:267-270`); `tenant`/`site`/`deletedAt` `update: () => false`
   confirmed (`Categories.ts:197,207,253`). DNA route (`src/app/api/admin/categories/[id]/dna/route.ts:55-59`)
   uses `payload.update` with no explicit `overrideAccess` → Local API default `true` → bypasses
   field access as designed, gated by `withSuperAdmin` (`src/lib/admin/api-utils.ts:19-35`,
   verified: checks `req.user` exists AND `roles.includes('super-admin')` — both identity and
   permission). `deleteCategoryAction`'s top `findByID` gate remains `overrideAccess: false`
   (`actions.ts:213-219`); the 2 internal writes correctly flipped to `overrideAccess: true`
   (`actions.ts:255-260, 271-278`) and do not broaden anything beyond what the top gate already
   authorized. **Caveat: see C1** — `tenant`/`site` create-path is NOT locked, unlike `dna`.
2. **No new smuggling vector (allowlist)** — PASS. `CategoryServerSchema` (`actions.ts:69-76`)
   allowlists exactly `{name, slug, parent, depth, description}`; `dna`/`tenant`/`site`/`deletedAt`
   absent → Zod's default (non-strict) object mode strips them. `grep -rn "passthrough"` confirms
   zero residue in `actions.ts` (only in an explanatory comment). `saveCategoryAction` additionally
   force-sets `writeData.tenant = tenantId` server-side and deletes `writeData.site`
   (`actions.ts:135-142`) as defense-in-depth for its own code path — but this app-layer guard
   does not protect the native REST route, which is exactly C1's exploit surface.
3. **Parent cross-tenant logic / object-vs-id handling** — Tenant-shape handling itself is
   correct (`Categories.ts:110-115` handles both raw-id and populated-object relationship
   shapes via `typeof … === 'object'` checks) and the check runs unconditionally whenever
   `data?.parent` is set, on both `create` and `update` (no operation-gated skip — confirmed, only
   `selfId`/cycle-check is operation-gated). **But the check's trust anchor (`data.tenant`) is
   wrong — see C1.**
4. **Breadcrumb fallback** — PASS. `const name = data.name ?? originalDoc?.name` (`Categories.ts:168`);
   `originalDoc` is a standard Payload `beforeChange` hook argument, populated on update
   operations (undefined on create, where `data.name` is required anyway) — correctly used.
5. **Sentinel codes consistency** — PASS. All 3 emit sites (`Categories.ts:95,121,132`) match all
   3 handle sites (`CategoryManager.tsx:316-321`) exactly. i18n keys verified to resolve:
   `dashboard.products.categories.toast.{cycleError,maxDepthError,parentTenantMismatch}` present
   in both `en.json` and `ms.json` at matching paths. No other consumer of these sentinel strings
   found in the codebase (`grep` confirms only `Categories.ts` emits, only `CategoryManager.tsx`
   handles) — no leak to an untranslated surface.
6. **db-setup.js DO-block** — PASS. Guarded by `pg_indexes.indexdef LIKE 'CREATE UNIQUE%'` per
   index name, wrapped in `DO $$ … END $$` (valid, idempotent Postgres syntax; a single statement,
   safe for the migration runner). `categories_tenant_slug_uniq` entry (`db-setup.js:4989` onward)
   untouched. Migration `name` key unchanged (`categories.drop_global_slug_unique`), so
   `check-migrations.js` tracking is unaffected.
7. **Tests** — PASS. 56/56 pass across the 4 files (verified by running). No tautologies
   reintroduced; the dedup test additions (`category-dedup.test.ts`) assert on actual SQL text
   content (`parent_id`/`tenant_id` presence), not vacuous truths. New
   `category-field-access.test.ts` exercises real smuggling attempts (`dna`, `tenant`, `site`,
   `deletedAt` in the create payload) against the real `saveCategoryAction`/`Categories`
   hook, not reimplemented logic. TC-IDs referenced throughout. No `.skip`, no fake data.
8. **Docs (Phase 03)** — PASS. TC-F08-05-05 step 2c now correctly documents
   `CATEGORY_SLUG_DUPLICATE` (option a, per Validation Summary), matches actual enforced behavior
   (slug generation is name-only, not parent-scoped). TC-F08-05-07 marked REMOVED as decided.
9. **Standards** — PASS. File sizes reasonable (`Categories.ts` 274 lines, `actions.ts` 279 —
   both grew modestly, no runaway growth; `CategoryManager.tsx` pre-existing 742 lines, only +6
   net from this PR, not a new concern). Error handling consistent with the repo's existing
   sentinel-string idiom (`CATEGORY_NAME_DUPLICATE`, `CATEGORY_HAS_PRODUCTS:`, etc.). No
   `.passthrough()` residue in Categories-related code. No `--no-verify` usage found.

---

## Adversarial checks (explicit)

- **Does `dna` field access block ALL write paths?** Yes — grepped every `collection:
  'categories'` write site (`generate-site/route.ts`, `seed-storefront.ts`, `actions.ts`, DNA
  route) plus every `dna:` write; only the DNA route touches `dna`, and it intentionally bypasses
  via default `overrideAccess: true`, gated by `withSuperAdmin`. No residual unguarded path found.
- **Does the parent cross-tenant check run on both create and update?** Yes, confirmed no
  operation-based skip on the tenant-check branch itself.
- **Could `tenant`/`site` ever be silently stripped in a corrupting way?** No — both are
  `required: true` and populated at creation only; since `update` access is permanently `false`
  for everyone, no path can ever leave them empty post-creation.
- **Sentinel leak to an unmapped surface?** No other consumer found; safe fallback
  (`toast.error(message || …saveError)`) exists in `CategoryManager.tsx` for any future
  unmapped code.
- **Residual dna/tenant/site/deletedAt smuggling path?** **Yes — see C1**, on `tenant`/`site`
  create (proven), and possibly on update via the parent-check's use of unstripped
  pre-hook `data.tenant` (likely, needs integration-level confirmation).

---

## Positive observations

- The `dna` field's create+update lock (`Categories.ts:267-270`) is done correctly and is exactly
  the pattern C1 is asking to be applied to `tenant`/`site` too — the PR got this right for one
  field and not the other.
- `deleteCategoryAction`'s `overrideAccess: true` flips are precisely scoped, well-commented, and
  correctly preserve the upstream `findByID` gate.
- Sentinel-code conversion + i18n wiring is clean and complete, no loose ends.
- Test additions are genuinely adversarial (smuggling attempts against real code paths), not
  rubber-stamp assertions.

---

## Recommended actions (priority order)

1. **Block C1 from merge.** Fix the trust-boundary bug: source `ownerTenantId` from
   `req.user`'s tenant (create) / `originalDoc.tenant` (update) — never `data.tenant`. Add
   `access: { create: () => false }` to `tenant` and `site` fields (mirroring `dna`'s pattern),
   relying on the existing `beforeChange` auto-inject for legitimate creates.
2. Add a regression test proving a forged `data.tenant` in the create/update payload cannot (a)
   satisfy the cross-tenant parent check nor (b) persist to the DB — extend
   `category-field-access.test.ts`.
3. Confirm via a live/integration-level check (not just the unit-mocked hook tests) whether
   `beforeValidate` genuinely sees pre-field-access-stripped `data` in this Payload version
   (3.79.0), to close out the UPDATE-path variant with certainty.
4. (Low priority, non-blocking) Clean up the QA doc's stray `[ ]`/`High` on the REMOVED
   TC-F08-05-07 row; flag `products/actions.ts`'s `.passthrough()` as a follow-up ticket.

---

## Unresolved questions

1. Does Payload 3.79.0's `create`/`update` operation run field-level `access` enforcement before
   or after the collection-level `beforeValidate` hook? This determines whether the UPDATE-path
   variant of C1 (forging `data.tenant` to fool the parent-tenant check while the real column
   stays unchanged, but `parent` still writes cross-tenant) is exploitable today, or only the
   CREATE-path is exploitable. Recommend a live/integration test rather than static reasoning to
   close this out before deciding fix scope.
2. Was the CREATE-path `tenant`/`site` gap in C1 discussed and consciously deferred during
   planning, or missed? The plan's Validation Summary only reasons about `dna`'s create path
   (Q2) — `tenant`/`site` create-path exposure isn't mentioned, suggesting it was likely an
   oversight rather than a deliberate scope cut.
