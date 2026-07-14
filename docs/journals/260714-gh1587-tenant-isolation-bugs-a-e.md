# GH-1587: Five Cross-Tenant Security Bugs (A–E) — The Hook Loop-Hole Pattern

**Date**: 2026-07-14 11:05  
**Severity**: Critical (5 IDOR + anonymous data leaks verified live)  
**Component**: Payload CMS `beforeChange`/`access` hooks, Collections: Categories, Products, Blogs, BlogCategories  
**Status**: Fixed + 31 unit tests added  
**Related**: Bug 0 documented in `260713-gh1587-category-list-cross-tenant-disclosure.md`

## Executive Summary

After fixing Bug 0 (`getCategoriesAction` missing `overrideAccess:false`), three rounds of adversarial code review surfaced five additional critical vulnerabilities across four collections. All five were verified as live exploits against real Postgres data before fixing. The fixes revealed a **recurring architectural gap** in Payload CMS 3's access-control model: the `access.update` Where-filter gates **row selection only**, not **what the write body can change**. This forced a common fix pattern: **independently re-validate tenant-scoped fields in `beforeChange` hooks**, independent of parent checks or form filters.

The same gap exists (unfixed) in Orders, Customers, Sites, and PushSubscriptions — a critical follow-up explicitly deferred from this PR's scope.

## Bug A: Parent-Field Cross-Tenant IDOR (Categories)

**What it was**: `beforeChange` hook in `Categories.ts` only validated tenant when `data.parent` was present.  
**Live exploit**: Tenant A, with real user object against live DB, could create a category as a *child of* a Tenant B category by simply setting `parent_id` to Tenant B's category ID.  
**The footgun**: `access.update` Where-filter matched the category to update, but Payload doesn't prevent the write body from *changing* which parent it points to. The hook had to re-validate.

**Fix**: New guard block in the hook: always re-check tenant ownership of `data.parent` against the acting user's tenant list. Super-admin passthrough preserved (existing behavior).

**Tests**: TC-F08-05-14 (4 scenarios: cross-tenant parent rejected, same-tenant parent allowed, fail-safe throw when tenant unresolvable, super-admin passthrough).

## Bug C: Bare Tenant/Site Field Spoof (Categories)

**What it was**: The parent-field guard only ran when `data.parent` was set. A bare `{tenant: <Tenant B's ID>}` or `{site: <Tenant B's site>}` PATCH, with no `parent` key, bypassed the guard entirely.  
**Live exploit**: Tenant A could directly reassign themselves into Tenant B by PATCH-ing just the `tenant` field.  
**Root cause**: `access.update`'s Where-filter gates row *selection*, not field re-assignment. The hook had to independently validate ALL tenant/site mutations regardless of parent presence.

**Fix**: New guard block (independent of parent logic): every non-super-admin write forces `data.tenant` to the actor's real tenant. Site handling re-assigns to the same value if omitted (immutable), or validates a client-supplied site against the actor's tenant (no naive lookup — naive site-lookup was itself found to corrupt multi-site-per-tenant in a third review pass, fixed).

**Tests**: TC-F08-05-16 (bare field spoof, validates tenant + site safety).

## Bug B: Anonymous REST Read Bypass (Categories, Products, Blogs, BlogCategories)

**What it was**: Four collections' `access.read` function never blocked anonymous (unauthenticated) traffic.  
**Live exploit**: Anonymous visitor could call REST endpoints to enumerate entire product catalogs, blog posts, and category hierarchies across all tenants.  
**Root cause**: Payload's "check first, ask forgiveness" mental model; collections inherit permissive defaults.

**Fix**: Add guard at top of `access.read`: `if (!req.user) return false`. CORS is locked to `NEXT_PUBLIC_SERVER_URL`; no documented external consumer; storefront uses custom `/api/storefront/*` routes with explicit auth and data filtering — zero regression.

**Tests**:  
- TC-F08-05-15 (Categories)  
- TC-F09-SEC-01 (Products)  
- TC-F17-SEC-01 (Blogs)  
- TC-F17-SEC-02 (BlogCategories) — noted as the "worst leak" (returned `true` unconditionally)

## Bug D: Tenant/Site Field Spoof (Products)

**Identical to Bug C**, discovered via adversarial review of the Categories fix. `saveProductAction` calls `payload.update(..., overrideAccess: false)` but its `.passthrough()` Zod schema let `tenant`/`site` flow through unfiltered. Same fix pattern applied to `beforeChangeHook` in `Products.ts`.

**Tests**: TC-F09-SEC-02.

## Bug E: saveBlogAction Cross-Tenant Update IDOR

**What it was**: The `saveBlogAction` update branch had **no tenant-ownership check** (unlike sibling functions `updateBlogStatusAction`, `deleteBlogAction`, `updateBlogCategoryAction`).  
**Live exploit**: Any authenticated user (Tenant A) could overwrite any tenant's blog post (Tenant B) by calling `saveBlogAction(data, Tenant_B_blog_ID)` directly, bypassing the form's access gates.  
**Root cause**: `payload.update()` on the update branch had no `overrideAccess:false` and no manual check, so it ran with Payload's default `overrideAccess:true` — Payload's own access control never ran. Every sibling function in the same file (`updateBlogStatusAction`, `deleteBlogAction`, `updateBlogCategoryAction`) has an explicit `findByID(id) + tenant-ownership` check; this was the one exception.

**Fix**: Added same `findByID(blogId) + tenant-comparison` guard as siblings — returns `{error: 'Unauthorized update access'}` if the blog's tenant doesn't match the actor's (matches the function's existing `{error}`-return convention, not a throw).

**Tests**: TC-F17-SEC-03.

## The Recurring Pattern (The Real Problem)

Every fix followed the same shape:

```
if (!is_super_admin) {
  // Validate tenant-scoped fields INDEPENDENTLY
  // (don't rely on access.update's Where-filter or form UI)
  
  if (data.parent) {
    // Re-check parent's tenant
  }
  
  if (data.tenant) {
    // Force tenant to actor's own (unspoofable)
  }
  
  if (data.site) {
    // Validate against actor's tenant
  }
  
  if (action === 'update') {
    // Verify doc ownership before allowing edit
    const original = await findByID(id);
    if (original.tenant !== actor.tenant) throw 403;
  }
}
```

**Why it recurs**: Payload CMS 3's `access.update` Where-filter (e.g., `{ tenant: { in: actorTenants } }`) gates *which rows can be selected for update*, not *what the write body can contain*. A malicious or naive client can:
- PATCH a selected row with cross-tenant field values
- Bypass form validation via Local API
- `overrideAccess: true` (the default!) makes the problem worse

The team has hit this before: `Discounts.ts` already has the correct guard pattern (confirming it's a known class of bug). The other collections (Orders, Customers, Sites) have the same gap live.

## Known Follow-Up (Explicitly Deferred)

Final review pass round 3 identified the same `beforeChange` guard gap in:
- `Orders.ts` — `paymentConfig`, `shippingAddress` potentially relocated to wrong tenant via field-spoof
- `Customers.ts` — `tenant` field unsafely reassignable
- `Sites.ts` — **worst exposure**: `headerBlock`/`footerBlock`/`globalBlocks` swappable across tenants, plus payment details
- `PushSubscriptions.ts` — milder (milder scope, not as sensitive)

**Not fixed here** — user chose to note and defer (decision logged in plan.md's "Unresolved questions" § 2). Scope of this PR kept focused on Categories/Products/Blogs/BlogCategories to avoid exponential diff growth. Estimated 6–8 hours of follow-up work if tackled in next cycle.

## Live Reproduction Protocol (Validation Before Fix)

All five bugs were verified as exploitable via live Payload Local API script against real Postgres data *before* the fix was applied, then re-tested after to confirm the fix blocks the attack:

1. **Pre-fix**: Exploit succeeds (data inserted/updated with cross-tenant values)
2. **Post-fix**: Same exploit rejected (access denied, data unchanged)
3. **DB inspection**: Confirm row's `tenant`/`site`/`parent` remained unchanged or re-scoped to actor's tenant

31 persisted unit tests now cover these scenarios across:
- `src/__tests__/unit/collections/categories-hooks.test.ts`
- `src/__tests__/unit/collections/products-hooks.test.ts`
- `src/__tests__/unit/collections/products-config.test.ts`
- `src/__tests__/unit/actions/blog-actions-f17-fixes.test.ts`

Full test suite: 587 files / 10284 tests (10253 before the 31 new tests were added), 100% pass after each round.

## QA Test Case Registration

| Collection | Bug | TC-ID | Status |
|-----------|-----|-------|--------|
| Categories | A (parent IDOR) | TC-F08-05-14 | ✓ Added |
| Categories | B (anon read) | TC-F08-05-15 | ✓ Added |
| Categories | C (tenant/site spoof) | TC-F08-05-16 | ✓ Added |
| Products | B (anon read) | TC-F09-SEC-01 | ✓ Added |
| Products | D (tenant/site spoof) | TC-F09-SEC-02 | ✓ Added |
| Blogs | B (anon read) | TC-F17-SEC-01 | ✓ Added |
| BlogCategories | B (anon read) | TC-F17-SEC-02 | ✓ Added |
| Blogs | E (cross-tenant update) | TC-F17-SEC-03 | ✓ Added |

All test cases marked `AUTO [x]` — unit tests written, live reproduction scripts in plan directory.

## Lessons Learned

1. **Payload's access-control is two-layer, not one**: `access.read` + `access.update` gate visibility, but don't gate write-body mutations. Always re-validate in hooks.
2. **Forms lie**: Client-side form validation + UI access gates are theater. Adversarial code review finds what forms hide.
3. **Three rounds of review, three new bugs**: Classic sign of a systemic pattern, not isolated mistakes. A linter rule enforcing explicit tenant-re-validation in every `beforeChange` hook would have caught all three in the first pass.
4. **The "worst leak" reminder**: `BlogCategories.ts` returning `true` unconditionally for `access.read` was found because someone *actually tested* it, not because code review spotted `return true`. Manual QA + live Postgres testing saved this one.

## Next Steps

1. **Immediate** (this branch): Ship 6 bugs + 34 tests + TC-IDs + this journal + updated CHANGELOG.
2. **Follow-up PR** (later, user's discretion): Fix Orders/Customers/Sites/PushSubscriptions using same pattern. Estimated scope: 50+ lines per collection, ~6 hours dev + test. Lower priority (paymentConfig/header-block moves are rarer than category/product mutations in typical workflows).
3. **Long-term** (design discussion, not committing): Consider lint rule or Payload wrapper enforcing explicit tenant-re-validation in every `beforeChange` hook across codebase, to prevent this pattern from re-surfacing.

## Addendum — Round 4 (`/code-review` formal 3-stage pass)

After the 5 bugs above shipped, the user ran a formal `/code-review` (Stage 1 spec-compliance → Stage 2 quality → Stage 3 adversarial) as an independent final gate. This surfaced 3 more issues, all fixed:

- **Stage 2 (quality):** two `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments in `Categories.ts` referenced a rule this repo's ESLint config doesn't register — `npm run lint` was failing (exit 1), would have blocked CI. Removed (bare `any` is the actual codebase convention).
- **Stage 3 (adversarial), in-scope fix:** the Bug E fix (`saveBlogAction` ownership check) copied the sibling functions' `if (tenantId && blogTenantId && mismatch)` pattern — which fails **open** when `tenantId` is falsy. Verified reachable in production: `Users.ts` has a member-removal mutation, `getCurrentUser()` re-fetches fresh on every request, so a user just removed from their only tenant has a still-valid session with `tenants:[]`, and the old guard would let them update ANY tenant's blog. Fixed to fail closed with an explicit super-admin passthrough (2 new tests: TC-F17-SEC-03b/c).
- **Stage 3 (adversarial), out-of-scope but critical — Bug F:** `Users.ts`'s `tenants` field (every fix above trusts this as the "unspoofable" tenant source) had **no field-level access restriction**, unlike the sibling `roles` field. Verified live: any authenticated user could self-grant `owner` membership in any tenant via a plain `PATCH /api/users/<own-id>`, which would have made every tenant-force-guard in Bugs C/D moot (attacker just adds the victim tenant to their own list first). Fixed same session, same branch, per user decision — added `access.update: super-admin only` to the field, mirroring `roles`. Confirmed all internal invite/remove/role-change endpoints in `Users.ts` already use `overrideAccess:true` (unaffected). New test: TC-F02-SEC-01.

**Lesson reinforced:** the "unspoofable tenant" assumption baked into Bugs A-E's fixes was itself spoofable at the root, one layer up. Adversarial review of a fix should periodically ask "what does this fix ASSUME is trustworthy, and is that assumption itself protected?" — not just "does this specific code path have a hole."

## Addendum — Round 5 (`/code-review` re-review of round-4 fix)

The user ran `/code-review` again immediately after round 4, per the skill's own "re-review cycle" guidance — verify the fix, check for regressions, don't just trust it shipped clean. This surfaced one more issue, fixed:

- **The round-4 `saveBlogAction` fix was incomplete.** It patched the ONE function being reviewed but left the IDENTICAL fail-open pattern (`if (tenantId && blogTenantId && mismatch)`) live in 5 sibling functions in the same file: `deleteBlogAction`, `updateBlogStatusAction`, `updateBlogCategoryAction`, `deleteBlogCategoryAction`, `getBlogByIdAction`. Worse: `bulkDeleteBlogsAction` didn't even attempt a tenant filter when `tenantId` was falsy (`if (tenantId) where.tenant = {...}` — simply omitted, not fail-open-guarded) — a mass delete-by-ID-list with zero tenant scoping, the single worst finding across all 5 review rounds.
- **Fix:** added a shared `isSuperAdmin(user)` helper (replacing the round-4 fix's inline one-off check, now reused everywhere); applied the fail-closed pattern to all 5 single-record functions; made `bulkDeleteBlogsAction` refuse the entire operation outright (return `{deleted:0, error:...}`) rather than silently proceed unscoped. 8 new regression tests (TC-F17-SEC-04 through 09c) — each verified to fail against the pre-fix code by tracing through the mock behavior (e.g. a function expected to `throw` would instead resolve normally against unconfigured mocks pre-fix).
- Verified live via Payload Local API script (not just unit tests) and full `npm test`: 587 files / 10297 tests green.

**Lesson reinforced (again):** when a fix closes ONE instance of a copy-pasted pattern, grep the same file for every OTHER instance before calling it done — the round-4 fix had all the information needed to find these 5 siblings (it even quoted "matches sibling functions" in its own comment) but didn't check whether the siblings had the SAME bug it was fixing, only that they had SOME check.

---

**Status**: DONE  
**Summary**: Fixed 6 root bugs (A-F) plus a 7-function fail-open sibling-pattern cleanup in `blog/actions.ts`, across Categories/Products/Blogs/BlogCategories/Users. All verified live before fix. Root cause: Payload's `access.update` gates row selection, not write-body mutations; hooks/field-access/manual ownership checks must independently re-validate tenant-scoped data, and every instance of a copy-pasted check must be re-verified, not just the one being edited. Same gap exists (deferred) in Orders/Customers/Sites. 42 unit tests + TC-IDs added across 5 review rounds.
