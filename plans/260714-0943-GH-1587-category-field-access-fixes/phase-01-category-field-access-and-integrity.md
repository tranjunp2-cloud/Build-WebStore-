# Phase 01 — Category Field Access + Integrity (Groups A + B + C)

## Context links
- Plan: [plan.md](./plan.md)
- Review source: PR #1605 findings H1, H2, M1, M2
- Idiom refs: `src/collections/Discounts.ts:155`, `src/collections/Orders.ts:307`
- DNA route: `src/app/api/admin/categories/[id]/dna/route.ts` (uses `withSuperAdmin`; calls
  `payload.update` with default `overrideAccess:true` → bypasses field access, so unaffected)
- Super-admin idiom: `src/lib/admin/api-utils.ts:29` (`user.roles?.includes('super-admin')`)

## Overview
- **Priority:** P1 (security). **Status:** pending.
- Single agent, sequential, ATOMIC — schema/access-control changes to `Categories.ts` +
  `actions.ts` must not split across parallel agents (repo CLAUDE.md rule).

## Key insights
- Collection-level `access.update` = Where-filter → gates WHICH doc, not WHICH fields. Field
  values are unguarded today.
- Payload field `access.update` returning false **silently strips** the field from the write
  (no throw). Consequences:
  - Normal `saveCategoryAction` update re-sends `data.tenant` (same value) → silently stripped → harmless.
  - `deleteCategoryAction` writes `deletedAt` with `overrideAccess:false` → would be stripped →
    soft-delete would silently no-op. **Must flip to `overrideAccess:true`** (access already
    checked at top of fn).
- `site` IS a real required field (`Categories.ts:160-167`). `description` IS a real field
  (`Categories.ts:196-200`) → belongs in allowlist.
- `actions.ts` already force-sets `tenant` and strips `site` (L149-154); allowlist replaces the
  fragile `.passthrough()` and additionally blocks `dna`/`deletedAt` smuggling.

## Requirements
### Functional
1. Field-level `access.update` on `dna` → super-admin only.
2. Field-level `access.update` on `tenant`, `site`, `deletedAt` → `() => false` (client-blocked;
   set via hook on create / internal writes via `overrideAccess:true`).
3. Parent cross-tenant validation: when `data.parent` set, parent's `tenant` must equal
   `data.tenant` (or current user's tenant for non-super-admin) else throw sentinel error.
4. Pass `user: req.user, overrideAccess: false` to the 3 existing `findByID`/`find` calls in
   hooks (defense-in-depth).
5. Breadcrumb fallback: `const name = data.name ?? originalDoc?.name` before building breadcrumbs.
6. `actions.ts`: replace `.passthrough()` with explicit allowlist `{name, slug, parent, depth,
   description}`; exclude `dna, tenant, site, deletedAt`.
7. `deleteCategoryAction`: flip `overrideAccess:false → true` on the child re-parent update
   (~L249-255) and the final `deletedAt` update (~L258-266). Leave the top `findByID`
   access-check (~L212-217) as `overrideAccess:false`.
8. Convert the two hook throws (cycle ~L90, depth ~L103) to sentinel codes
   `CATEGORY_CYCLE_ERROR` / `CATEGORY_MAX_DEPTH_ERROR` (kept HERE for atomic `Categories.ts`
   ownership; Phase 04 adds the frontend branches). Match existing `CATEGORY_*_DUPLICATE` style.

### Non-functional
- KISS: reuse `access: { update: ... }` idiom; no new helper unless ≥2 fields share non-trivial logic.
- Files stay under 200 lines where practical.

## Architecture / data flow
```
CREATE (tenant user): access.create OK → beforeChange injects tenant/site → field update-access N/A on create
UPDATE via REST (tenant user): collection access → field access.update strips dna/tenant/site/deletedAt
UPDATE dna via DNA route (super-admin): overrideAccess=true → field access bypassed → writes dna
DELETE (deleteCategoryAction): findByID(overrideAccess:false) gate → internal writes overrideAccess:true
```

## Related code files
- Modify: `src/collections/Categories.ts`
- Modify: `src/app/(dashboard)/products/categories/actions.ts`
- Read-only context: `src/lib/admin/api-utils.ts`, `src/collections/Discounts.ts`, `src/collections/Orders.ts`

## Implementation steps
1. Read current `Categories.ts` for exact line numbers (may have shifted).
2. Add `access: { update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')) }` to
   `dna` field. (Optional hardening, flag to lead: add matching `create` gate — see plan Q2.)
3. Add `access: { update: () => false }` to `tenant`, `site`, `deletedAt` fields.
4. In `beforeValidate` cycle hook: add `user: req.user, overrideAccess: false` to the `findByID`
   at ~L93-96. Convert throws at ~L90 / ~L103 to `new Error('CATEGORY_CYCLE_ERROR')` /
   `new Error('CATEGORY_MAX_DEPTH_ERROR')`.
5. Add parent cross-tenant check: after resolving `data.parent`, fetch parent doc (reuse the
   hook's existing findByID result if available) and assert
   `String(parentDoc.tenant?.id ?? parentDoc.tenant) === String(data.tenant ?? currentUserTenant)`;
   else `throw new Error('CATEGORY_PARENT_TENANT_MISMATCH')`. Super-admin exempt.
6. In `beforeChange`: add `user: req.user, overrideAccess: false` to the breadcrumb `findByID`
   (~L137-140) and the site-lookup `find` (~L119-123). Add breadcrumb name fallback
   `const name = data.name ?? originalDoc?.name;` and use `name` in place of `data.name`.
7. In `actions.ts`: rewrite `CategoryServerSchema` as explicit `z.object({...}).strict()` or drop
   `.passthrough()` with only the 5 allowlisted keys. Keep existing tenant force / site strip
   (now redundant belt-and-suspenders — retain for safety).
8. Flip the two internal-write `overrideAccess:false → true` in `deleteCategoryAction`.
9. `grep -rn "collection: 'categories'" src/ | grep deletedAt`-style check for other
   `deletedAt` writers using `overrideAccess:false` (plan Q3).
10. Compile: `npx tsc --noEmit` (or project build check).

## Todo list
- [x] dna field super-admin update access (extended to create+update per plan.md Validation Summary)
- [x] tenant/site/deletedAt update:false access
- [x] cycle/depth throws → sentinel codes
- [x] parent cross-tenant validation
- [x] user/overrideAccess on 3 hook DB calls
- [x] breadcrumb name fallback
- [x] actions.ts allowlist (no passthrough)
- [x] deleteCategoryAction overrideAccess flips (2)
- [x] grep other deletedAt writers
- [x] tsc compile clean

## Success criteria
- `npx tsc --noEmit` passes.
- Manual reasoning: tenant REST PATCH of dna/tenant/site/deletedAt → stripped (unchanged).
- `deleteCategoryAction` still soft-deletes (deletedAt set) despite new field access.
- Normal create/update via `saveCategoryAction` unaffected.
- Parent from another tenant → throws `CATEGORY_PARENT_TENANT_MISMATCH`.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Field access silently breaks soft-delete | Med×High | overrideAccess flip (step 8) + Phase 05 regression test |
| tenant update-strip breaks legit tenant change | Low×Med | tenant never changes post-create by design; forced value = same |
| Allowlist drops a field UI still sends | Low×Med | UI sends only name/slug/parent/description (CategoryManager.tsx:292-298) — verified |
| Parent check false-positive on super-admin cross-tenant ops | Low×Med | super-admin exempt branch |
| Sentinel rename breaks any existing consumer | Low×Med | grep for raw VN string consumers before converting |

## Security considerations
- Closes H1 (dna), H2 (tenant/site/parent cross-tenant), M1 (passthrough smuggling).
- DNA route stays super-admin-only (unchanged) and functional via overrideAccess bypass.
- Create-path dna smuggling remains open under approved scope — flagged (plan Q2).

## Next steps
- Blocks Phase 02, 04, 05. Phase 04 consumes the new sentinel codes.
