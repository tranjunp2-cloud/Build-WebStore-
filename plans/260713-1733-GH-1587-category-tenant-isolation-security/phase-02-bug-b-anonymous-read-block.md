# Phase 02 — Bug B: Block Anonymous REST Read on 4 Collections (Option A)

**PR:** this branch · **Migration:** No · **Priority:** P0 · **Status:** done (code only; access-log grep is required pre-merge gate)

## Context

- Research: `research/researcher-bug-b-public-rest-leak.md` (Option A rationale, consumer analysis, systemic scope).
- Confirmed via live `curl` on `/api/categories` (no auth) → multi-tenant categories returned.
- User decision: fix **all 4** collections in this branch using **Option A** (`if (!req.user) return false`).
- Independently re-validated: CORS in `src/payload.config.ts` locked to `NEXT_PUBLIC_SERVER_URL` only (no cross-origin); no documented external consumer in `docs/`; storefront uses `/api/storefront/*` custom routes with `overrideAccess:true` + manual site/tenant filtering → **zero regression**.

## Overview

Four collections currently return unscoped/fully-open data to anonymous callers via Payload's generic REST API. Replace each anonymous branch with `return false`. Authenticated branches (super-admin `true`, tenant-scoped `{tenant:{in:tenantIds}}`) stay untouched.

## Key Insights

- Access functions receive only `{req}` (user context), never query params — cannot enforce "require `site=X`" at this layer. Blocking anonymous entirely is the correct minimal gate (Option A); scoped public reads, if ever needed, belong in a custom `/api/storefront/*` route (GH-1588 will add `/api/storefront/categories`).
- Each of the 4 collections has a DIFFERENT current anonymous branch (see table) — do NOT copy-paste; edit the specific branch in each file.
- **Storefront-consumer verification (per collection):** all real storefront reads go through `/api/storefront/*` with `overrideAccess:true`, which bypasses collection access entirely → collection-level block is invisible to them. This is the zero-regression assumption; it MUST be validated by running the FULL existing test suite (not just category tests) after the edits, because `Products.ts` / `Blogs.ts` / `BlogCategories.ts` carry their own test coverage this plan did not analyze in depth.

## Per-collection change map

| Collection | File | Current anonymous branch | Change |
|-----------|------|--------------------------|--------|
| Categories | `src/collections/Categories.ts` | L28–31: `{ deletedAt: { exists:false } }` | replace with `if (!req.user) return false` |
| Products | `src/collections/Products.ts` | L256–260: `{ status:'active', deletedAt:false }` | `if (!req.user) return false` |
| Blogs | `src/collections/Blogs.ts` | L36–38: `{ status:'published' }` | `if (!req.user) return false` |
| BlogCategories | `src/collections/BlogCategories.ts` | L12: `return true` (worst — all docs) | `if (!req.user) return false` |

### Existing legitimate storefront consumer? (required note per collection)

| Collection | Legit consumer calling collection WITHOUT `overrideAccess:true`? | Regression risk |
|-----------|--------------------------------------------------------------|-----------------|
| Categories | NO — storefront category route never implemented; dashboard uses `getCategoriesAction` (auth'd) | none |
| Products | NO — `/api/storefront/products` uses `overrideAccess:true` + `site` filter; raw-REST storefront page is `.disabled` | none |
| Blogs | NO — `/api/storefront/blogs` uses `overrideAccess:true` + `tenant` filter | none |
| BlogCategories | NO — no public route consumes it; leaked ALL tenants unconditionally | none |

## Requirements

- Functional: anonymous (`!req.user`) read on all 4 collections → denied (empty/forbidden). Authenticated tenant-scoped + super-admin reads unchanged.
- Non-functional: no schema change; ≤4 LOC changed per file.

## Architecture / Data Flow

```
read({ req }):
-  if (!req.user) return <unscoped-or-open-filter>   // OLD: leaks cross-tenant
+  if (!req.user) return false                        // NEW: deny anonymous
   if (super-admin) return true
   return { tenant: { in: tenantIds } }               // unchanged
```

## Related Code Files

**Modify:**
- `src/collections/Categories.ts` — `access.read` anonymous branch (this phase layers onto Phase 01's edits to the same file; regions are disjoint — hooks vs read).
- `src/collections/Products.ts` — `access.read` anonymous branch only.
- `src/collections/Blogs.ts` — `access.read` anonymous branch only.
- `src/collections/BlogCategories.ts` — `access.read` anonymous branch only.

**Read for context:** `src/payload.config.ts` CORS block; `src/app/api/storefront/*` (confirm `overrideAccess:true`); research report.

**No migration, no delete. `Where` import may become unused in a file — remove the import if the linter flags it (Categories.ts still uses `Where` elsewhere? check; Blogs.ts/Products.ts cast `as Where` in the removed branch — drop the now-unused import to keep lint clean).**

## Implementation Steps

1. `Categories.ts`: replace L28–31 anon branch with `if (!req.user) return false`. Verify `Where` import still used elsewhere; if not, remove it.
2. `Products.ts`: replace L256–260 anon branch with `if (!req.user) return false`. Drop unused `Where` cast/import if orphaned.
3. `Blogs.ts`: replace L36–38 with `if (!req.user) return false`. Drop unused `Where` if orphaned.
4. `BlogCategories.ts`: replace L12 `if (!req.user) return true` with `if (!req.user) return false`.
5. `npm run build` / `tsc --noEmit` → no type/lint errors.
6. **MANDATORY:** run the FULL existing suite `npm test` (not just category tests) → confirm no `Products` / `Blogs` / `BlogCategories` test regressed. If any storefront/collection test relied on anonymous read, STOP and report (would indicate an undocumented consumer — reassess before proceeding).
7. **MANDATORY (per plan validation, promoted from "recommended" to a required pre-merge gate):** grep production/staging access logs (Betterstack — see `.github/GIT_AND_CI_RULES.md` §7 for the live-tail link) for any real anonymous traffic hitting `/api/categories`, `/api/products`, `/api/blogs`, `/api/blog-categories` in a recent window before merging/deploying this fix. If any such traffic is found, STOP and investigate the caller before merging (do not silently deploy the block).

## Todo

- [x] Categories.ts anon read → `return false`
- [x] Products.ts anon read → `return false`
- [x] Blogs.ts anon read → `return false`
- [x] BlogCategories.ts anon read → `return false`
- [ ] Access-log grep for real anonymous traffic on all 4 endpoints (required pre-merge gate, not optional)
- [x] Remove orphaned `Where` imports; compile clean
- [x] FULL `npm test` green (verify no cross-collection regression)

## Success Criteria

- `curl <server>/api/{categories,products,blogs,blog_categories}` with no auth → `403`/empty (no docs). Verified in Phase 03 (TC-F08-05-15, TC-F09-SEC-01, TC-F17-SEC-01, TC-F17-SEC-02).
- Authenticated dashboard reads still tenant-scoped; super-admin still full.
- FULL existing test suite green.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Undocumented external REST consumer breaks | Low×High | Research + CORS re-validation found none; full-suite run catches internal ones; recommend access-log grep pre-merge |
| Products/Blogs/BlogCategories own tests assume anon read | Low×Med | MANDATORY full `npm test`; STOP-and-report if red |
| Orphaned `Where` import → lint failure blocks CI | Med×Low | Remove unused imports in step 5 |
| GH-1588 storefront category route expects public read | Low×Low | GH-1588 will add its own `/api/storefront/categories` with `overrideAccess:true` — independent of collection access |

## Security Considerations

- Deny-by-default posture: sensitive multi-tenant data (pricing, SKUs, inventory, tenant names, content) no longer readable unauthenticated.
- Public reads, if needed later, only via explicit scoped custom routes — never the generic REST API.
- BlogCategories was the worst leak (`return true`, ALL tenants unconditionally) — now closed.

## Next Steps

- Phase 03 adds 4 anon-read TC-IDs (one per collection).
- Phase 04 notes GH-1588 as the follow-up that re-adds scoped public category reads.
