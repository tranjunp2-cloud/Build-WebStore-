# Phase 01 — Bug A: Cross-Tenant Parent IDOR in `Categories.ts` hooks

**PR:** this branch · **Migration:** No · **Priority:** P0 · **Status:** done

## Context

- Research: `research/researcher-bug-a-parent-idor.md` (hook order, code sketch, tenant timing).
- Source: `src/collections/Categories.ts` — `beforeValidate` (L71–108, ancestor/cycle walk) + `beforeChange` (L109–149, breadcrumb-gen). Both call `req.payload.findByID({collection:'categories', id})` with **no tenant gate**.
- Structural precedent: `plans/260710-1625-f08-category-integrity/phase-03-cycle-prevention.md` (same hook, cycle walk).

## Overview

A non-admin user can set `parent` to another tenant's category id. `findByID()` bypasses the collection `read` access (Local API defaults `overrideAccess:true`), so the ancestor walk and breadcrumb-gen happily read the foreign doc — leaking the other tenant's breadcrumb string into the attacker's category. Fix: replace both `findByID()` call sites with tenant-scoped `find({where:{id, tenant}})`; empty result = validation error.

## Key Insights

- **Hook order & tenant availability** (from research):
  - `beforeValidate` runs BEFORE tenant auto-inject (which happens in `beforeChange` L112–117). So on **create**, `data.tenant` is not yet set → derive tenant from `req.user.tenants[0].tenant`. On **update**, `originalDoc.tenant` is the persisted, unspoofable source-of-truth.
  - `beforeChange` runs AFTER inject → `data.tenant` IS set there; use it directly for the breadcrumb lookup.
- **No `user`-arg pattern in hooks** (grep: zero matches). Use compound `where` (explicit tenant gate) with `overrideAccess:true` (default) — the `where` is the gate, not user trust.
- **Cheapest lookup:** `limit:1, depth:0` (walk only needs `id` + `parent` + `tenant`).
- Client dropdown needs **no** change — `parentOptions` already sourced from tenant-scoped `getCategoriesAction()` (see research §5).

## Resolved decisions (were "Unresolved Questions" in research)

1. **Tenant extraction `operation==='update' ? originalDoc?.tenant : req.user.tenants[0].tenant` — CORRECT.** Rationale: on update the persisted doc's tenant cannot be spoofed by request body; on create the value isn't injected yet in `beforeValidate`, so the user's own tenant is the only trustworthy source. **Edge case — super-admin:** super-admins legitimately span tenants and have `req.user.tenants` empty → if `req.user.roles?.includes('super-admin')`, SKIP the tenant gate and fall back to plain `findByID` (preserves existing admin behavior). If a non-super-admin cannot resolve any tenantId → throw (fail-safe, do not run unscoped query).
2. **Empty tenant-scoped result = validation error (throw) — CORRECT UX.** Matches cycle-prevention. A cross-tenant parent is invalid input; fail loudly rather than silently orphan the breadcrumb.
3. **Vietnamese-only hook error strings — ACCEPTABLE, not a blocker.** Consistent with existing hook errors (L90, L103). Client `CategoryManager.tsx` falls through to a generic toast for unknown messages. Log i18n refactor as future tech-debt; do NOT block this security fix on it.

## Requirements

- Functional: setting `parent` to a category NOT in the actor's tenant → rejected with validation error; same-tenant parent still succeeds; breadcrumb still generated correctly from same-tenant parent.
- Preserve: depth≤3 check, cycle check, breadcrumb format `"<parent.breadcrumbs> > <name>"`, super-admin cross-tenant ability.
- Non-functional: no extra queries vs today (replace `findByID` 1:1 with `find` limit:1); no schema change.

## Architecture / Data Flow

```
beforeValidate(data, req, operation, originalDoc):
  if data.parent:
    tenantId = resolveTenant(operation, originalDoc, req.user)   // see decision 1
    isSuperAdmin = req.user?.roles?.includes('super-admin')
    walk candidateId = data.parent, hops≤5:
      if selfId && candidateId===selfId -> throw cycle error (unchanged)
      doc = isSuperAdmin
              ? findByID({categories, id:candidateId})            // admin passthrough
              : find({categories, where:{id:eq candidateId, tenant:eq tenantId}, limit:1, depth:0}).docs[0]
      if !doc -> throw 'Danh mục cha phải thuộc cùng thương hiệu' (cross-tenant/not-found)
      candidateId = doc.parent id or null
    if depth>=3 -> throw depth error (unchanged)

beforeChange(data, req, operation):
  ...tenant/site auto-inject unchanged...
  if data.parent:
    tenantId = data.tenant (already injected here)               // decision 1, create-safe
    isSuperAdmin = ...
    parentDoc = isSuperAdmin ? findByID(...) : find({where:{id:eq data.parent, tenant:eq tenantId}, limit:1, depth:0}).docs[0]
    if !parentDoc -> throw same cross-tenant error
    breadcrumbs = parentDoc.breadcrumbs ? `${parentDoc.breadcrumbs} > ${data.name}` : data.name
```

## Related Code Files

**Modify (single file, this phase owns it exclusively until Phase 02 layers the `read` change):**
- `src/collections/Categories.ts`
  - `beforeValidate` L86–100: replace the in-loop `findByID` with tenant-scoped `find`; add `resolveTenant` helper + super-admin branch; add cross-tenant throw.
  - `beforeChange` L136–144: replace breadcrumb `findByID` with same tenant-scoped `find` + super-admin branch + throw.

**Read for context:** `Categories.ts` full; `actions.ts:218–223` (`overrideAccess:false` pattern reference); research report.

**No migration, no delete, no client change.**

## Implementation Steps

1. Add a small local `resolveTenantId(operation, originalDoc, user)` helper at top of the hook module (or inline) returning the tenant id string per decision 1; return `undefined` for super-admin (signals passthrough).
2. `beforeValidate`: inside the walk, compute `isSuperAdmin`. If super-admin → keep `findByID`. Else → `find({collection:'categories', where:{ id:{equals:candidateId}, tenant:{equals:tenantId} }, limit:1, depth:0})`; if `docs.length===0` throw `new Error('Danh mục cha phải thuộc cùng thương hiệu')`; set `candidateDoc = docs[0]`. Keep cycle + depth logic identical.
3. Guard: if NOT super-admin and `tenantId` unresolved → `throw new Error('Không thể xác định thương hiệu (tenant) của danh mục')` before the walk (fail-safe).
4. `beforeChange`: reuse the same pattern for the breadcrumb parent lookup using `data.tenant` as tenantId (already injected above at L112–117). Same super-admin branch + throw.
5. `npm run build` (or `tsc --noEmit`) → confirm no type errors (note `find` returns `{docs}` vs `findByID` returns doc — adjust `.parent` access accordingly).

## Todo

- [x] `resolveTenantId` helper (update→originalDoc.tenant, create→user.tenants[0], super-admin→undefined)
- [x] `beforeValidate` walk: tenant-scoped `find` + super-admin passthrough + cross-tenant throw
- [x] Fail-safe throw when non-admin tenantId unresolved
- [x] `beforeChange` breadcrumb lookup: tenant-scoped `find` + super-admin passthrough + throw
- [x] Preserve cycle + depth≤3 + breadcrumb format
- [x] Compile check passes

## Success Criteria

- Non-admin `payload.update({collection:'categories', id:own, data:{parent:foreignTenantCatId}})` → rejected (cross-tenant error). Verified in Phase 03 (TC-F08-05-14).
- Same-tenant parent set → succeeds; breadcrumb correct.
- Super-admin can still set any parent.
- Existing `src/__tests__/unit/collections/categories-hooks.test.ts` still green (no regression in cycle/depth/breadcrumb).

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Break create flow (tenant not resolvable in beforeValidate) | Med×High | Derive from `req.user.tenants[0].tenant`; fail-safe throw only when truly unresolved + non-admin; covered by test |
| Super-admin regression (empty tenants → false-throw) | Med×High | Explicit super-admin passthrough branch keeps `findByID` |
| `find` vs `findByID` return-shape type error | Med×Low | Compile check; access `docs[0].parent` |
| Foreign parent that is ALSO a valid same-tenant id collision | Low×Med | Compound `where` on numeric/uuid id+tenant makes collision impossible |
| Extra latency from `find` vs `findByID` | Low×Low | `limit:1, depth:0`; same 1 query/hop as before |

## Security Considerations

- Closes IDOR: parent must belong to the actor's tenant; enforced in the authoritative hook (covers admin panel, Local API, bulk import — all write paths).
- Compound `where` is the tenant gate; `overrideAccess` default retained intentionally (internal hook, no user-trust surface).
- Fail-safe: unresolved tenant for non-admin → hard error, never an unscoped query.

## Next Steps

- Phase 02 layers the `access.read` anonymous-block onto the SAME file (`Categories.ts`) — do Phase 01 first, then Phase 02, same agent, to avoid churn.
- Phase 03 adds TC-F08-05-14 (Bug A) into existing `categories-hooks.test.ts`.
