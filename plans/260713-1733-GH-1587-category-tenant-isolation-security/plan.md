---
title: "Category & multi-collection cross-tenant isolation security fixes (GH-1587)"
description: "Fix 3 confirmed cross-tenant leaks: parent IDOR in Categories hooks + unscoped anonymous REST reads on 4 collections (Bug 0 already fixed)."
status: in-progress
priority: P0
effort: 6.5h
branch: fix/category-tenant-isolation-security
tags: [security, multi-tenant, idor, payload, access-control, F08]
created: 2026-07-13
---

# GH-1587 — Cross-Tenant Isolation Security Fixes

3 confirmed cross-tenant security bugs from adversarial review (Bug 0 already remediated). All fixes are access-control / hook logic only — **no DB schema change, no `db-setup.js` migration entry**.

## Branch / PR base (decide at PR-open time — do NOT resolve now)

Branch built on top of `feat/f08-1587-category-integrity-fixes` (PR #1605) because `Categories.ts` + `actions.ts` are heavily modified there. At PR-open: either (a) wait for PR #1605 → merge to `staging`, then base this PR on `staging`; or (b) set this PR's base to `feat/f08-1587-category-integrity-fixes`. Pick whichever is un-merged least. Just a note — implementer does not resolve during phases.

### ⚠️ IMPORTANT — discovered 2026-07-14 afternoon, NOT resolved, resolve at PR-open time

`feat/f08-1587-category-integrity-fixes` (PR #1605) gained 3 NEW commits this same day (`aa6c8318`, `09dcf032`, `63af1949`, plan at `plans/260714-0943-GH-1587-category-field-access-fixes/`, completed, code-reviewed 9.5/10) that **independently fix Bug A (parent cross-tenant IDOR) and Bug C (tenant/site field-spoof) on `Categories.ts`** — via a DIFFERENT, arguably cleaner mechanism: absolute field-level locks (`access: { create: super-admin-only, update: () => false }`) on the `tenant`/`site`/`dna`/`deletedAt` fields, plus a similar `beforeValidate` parent-tenant guard, plus replacing `.passthrough()` with an explicit Zod allowlist in `categories/actions.ts` (their M1, closes the same smuggling vector our Bug D fix addresses differently for Products).

**Impact:**
- `Categories.ts` will have a SEVERE merge conflict on rebase — not just textual, two different architectures for the same problem.
- Bug 0 fix (`getCategoriesAction` `overrideAccess:false`) is untouched by their diff — safe, no conflict there.
- Bugs B/D/E/F remain unique to this branch (Products.ts, Blogs.ts, BlogCategories.ts, Users.ts untouched by their work) — these merge cleanly regardless.
- **Recommendation for PR-open time:** likely DROP this branch's Bug A/C changes to `Categories.ts` (superseded by the cleaner field-lock approach already merged upstream) and rebase the Bug B/D/E/F work on top of the updated `Categories.ts`/`actions.ts`. Needs careful side-by-side reconciliation, not a blind rebase — user explicitly deferred this decision, do NOT attempt without asking first.

## Prerequisites (checklist — before implementation starts)

- [x] Open a GitHub issue for this work — done: [#1626](https://github.com/primeproduction/ech-prime-web-v2/issues/1626), created after implementation per validation decision. PR should use `Relates to #1626` (and `#1587` for the original parent story), never `Closes`.
- [ ] Confirm PR #1605 status to decide PR base (see above).

## Phases

| # | Phase | File | Prio | Migration | Status |
|---|-------|------|------|-----------|--------|
| 0 | Bug 0 — `getCategoriesAction` missing `overrideAccess:false` | — (DONE, reference only) | P0 | No | done |
| 1 | Bug A — parent-field cross-tenant IDOR in `Categories.ts` hooks | [phase-01](phase-01-bug-a-parent-idor.md) | P0 | No | done |
| 1b | Bug C — bare `tenant`/`site` field spoof in `Categories.ts` (no `parent` needed) — found by adversarial review of Phase 1 | — (see below) | P0 | No | done |
| 2 | Bug B — block anonymous REST read on 4 collections (Option A) | [phase-02](phase-02-bug-b-anonymous-read-block.md) | P0 | No | done |
| 1c | Bug D — same tenant/site field-spoof class in `Products.ts` `beforeChangeHook` — found by adversarial review of Bug C fix | — (see below) | P0 | No | done |
| 1d | Bug E — `saveBlogAction` update branch: no `overrideAccess:false` + no tenant-ownership check at all (any user can edit any tenant's blog by ID) — found by same review pass | — (see below) | P0 | No | done |
| 3 | Tests — Bug A/B/C/D/E (8 TC-IDs) | [phase-03](phase-03-tests.md) | P0 | No | done |
| 4 | Docs — QA TC-IDs, journal, PR description prep | [phase-04](phase-04-docs-and-pr-prep.md) | P1 | No | pending |

### Bug C, D, E — added mid-implementation (not in original research)

Two rounds of adversarial `code-reviewer` passes on Phase 1/2's diff surfaced 3 additional real, live-reproduced vulnerabilities, all confirmed via Payload Local API scripts against local Postgres (not just static analysis) before fixing:

- **Bug C** (`src/collections/Categories.ts`, `beforeChange`): both hooks' tenant checks only ran when `data.parent` was present. A bare `{tenant:<victim-id>}` PATCH with no `parent` bypassed them entirely — `access.update`'s `Where` filter only gates row *selection*, not what the body writes. Fix: new guard block forces `data.tenant`/`data.site` to the actor's real tenant for every non-super-admin write, independent of `parent`. Site handling preserves the existing value on update (or validates a client-requested new site against the actor's tenant) rather than blindly re-deriving via first-match lookup — a naive version of this fix was itself found (by a THIRD review pass) to silently corrupt category→site assignment for any tenant with 2+ sites (`Sites.ts` explicitly supports multi-site-per-tenant); corrected before landing.
- **Bug D** (`src/collections/Products.ts`, `beforeChangeHook`): identical bug/fix to Bug C — `saveProductAction`'s `.passthrough()` Zod schema let `tenant`/`site` flow through unfiltered to `payload.update(...,overrideAccess:false)` on update. Same hook-level guard pattern applied (covers ALL write paths, not just this one action).
- **Bug E** (`src/app/(dashboard)/blog/actions.ts`, `saveBlogAction`): update branch was the ONE function in this file with no tenant-ownership check AND no `overrideAccess:false` — every sibling function (`updateBlogStatusAction`, `deleteBlogAction`, `updateBlogCategoryAction`) has one. Any authenticated user could overwrite any tenant's blog post by ID. Fix: added `findByID` + tenant-comparison check.
  - **Amendment (round-4 `/code-review` adversarial pass):** the first version of this fix copied the sibling functions' `if (tenantId && blogTenantId && mismatch)` pattern, which fails OPEN when `tenantId` is falsy — reachable in production for a user just removed from their only tenant (confirmed: `Users.ts` has a member-removal mutation that splices `tenants`, and `getCurrentUser()` does a fresh DB fetch every request, so the removed user's still-valid session immediately reflects `tenants:[]`). Fixed to fail CLOSED (`if (!tenantId || !blogTenantId || mismatch) return error`) with an explicit `isSuperAdmin` passthrough (was previously relying on the fail-open bug as an accidental, undocumented super-admin bypass). 2 new regression tests added (TC-F17-SEC-03b/c). Verified live before/after.
  - **Amendment (round-5 `/code-review`, re-review of round-4 fix):** the round-4 fix only patched `saveBlogAction`. A re-review found the IDENTICAL fail-open pattern still live in 5 sibling functions in the same file — `deleteBlogAction`, `updateBlogStatusAction`, `updateBlogCategoryAction`, `deleteBlogCategoryAction`, `getBlogByIdAction` — plus a WORSE variant in `bulkDeleteBlogsAction`, which didn't even attempt a tenant filter when `tenantId` was falsy (`if (tenantId) where.tenant = {...}`), meaning an unresolvable-tenant actor could mass-delete blogs by ID across every tenant with zero scoping. Fixed all 6: added a shared `isSuperAdmin(user)` helper, applied the same fail-closed pattern to the 5 single-record functions, and made `bulkDeleteBlogsAction` refuse the entire operation (not silently unscope it) when a non-admin's tenant is unresolvable. 8 new regression tests (TC-F17-SEC-04 through 09c). Verified live + full `npm test` (587/587, 10297 tests).

Also found in round 4: two `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments in `Categories.ts` referenced a rule not registered in this repo's ESLint config (`next/core-web-vitals` only) — `npm run lint` exited 1, would have blocked CI. Removed (bare `any` is this codebase's actual convention). `npm run lint` now exits 0.

All 5 bugs verified fixed via live reproduction (not just unit-test mocks) before/after, across 4 rounds of adversarial review (3 during implementation + 1 formal `/code-review`). Full `npm test`: 587 files / 10286 tests green (10253 baseline + 31 Phase-3 tests + 2 round-4 regression tests).

## Phase 0 (DONE — reference only)

`getCategoriesAction` (`src/app/(dashboard)/products/categories/actions.ts`) lacked `overrideAccess:false` → every dashboard user saw all tenants' categories + aggregated product counts. Fixed + tested (`src/__tests__/unit/dashboard/category-list-tenant-scope.test.ts`, TC-F08-05-13) + documented (`docs/qa/F08-product-crud.md`) + journaled (`docs/journals/260713-gh1587-category-list-cross-tenant-disclosure.md`). No new work.

## Dependency graph

```
Phase 0 (done)
Phase 1 (Categories.ts hooks) ─┐
                               ├─► Phase 3 (tests) ─► Phase 4 (docs/PR)
Phase 2 (4 collections read) ──┘
```
- Phase 1 & 2 both edit `Categories.ts` (disjoint regions: P1=hooks L70–150, P2=`access.read` L27–31) → **same agent, sequential, do P1 then P2**. Not parallelizable.
- Phase 3 depends on Phase 1 + 2 (tests the shipped code). Phase 4 depends on Phase 3.

## Cross-cutting decisions (locked)

- **Bug B fix = Option A** (block anon read: `if (!req.user) return false`) on all 4 collections. Re-validated: CORS locked to `NEXT_PUBLIC_SERVER_URL`; no documented external consumer; storefront uses `/api/storefront/*` custom routes with `overrideAccess:true` + manual filtering → zero regression.
- **Bug A tenant source:** update → `originalDoc.tenant` (persisted, unspoofable); create → `req.user.tenants[0].tenant` (tenant not yet injected in `beforeValidate`). Super-admin passthrough preserved. See phase-01.
- **Empty tenant-scoped lookup = validation error** (throw, Vietnamese), matching existing cycle-prevention UX.
- **Vietnamese-only hook error strings = acceptable**, not a blocker (consistent with existing hook errors); i18n refactor = future tech-debt.

## TC-ID allocation (per owning feature doc)

| Bug | Collection | TC-ID | QA doc |
|-----|-----------|-------|--------|
| A | Categories (parent IDOR) | TC-F08-05-14 | `docs/qa/F08-product-crud.md` |
| B | Categories (anon read) | TC-F08-05-15 | `docs/qa/F08-product-crud.md` |
| B | Products (anon read) | TC-F09-SEC-01 | `docs/qa/F09-products-crud.md` |
| B | Blogs (anon read) | TC-F17-SEC-01 | `docs/qa/F17-blog-management.md` |
| B | BlogCategories (anon read) | TC-F17-SEC-02 | `docs/qa/F17-blog-management.md` |
| C | Categories (tenant/site field spoof, no `parent`) | TC-F08-05-16 | `docs/qa/F08-product-crud.md` |
| D | Products (tenant/site field spoof) | TC-F09-SEC-02 | `docs/qa/F09-products-crud.md` |
| E | Blogs (`saveBlogAction` cross-tenant update IDOR) | TC-F17-SEC-03 | `docs/qa/F17-blog-management.md` |
| E (amendment) | Blogs (`saveBlogAction` fail-open when actor tenant unresolvable) | TC-F17-SEC-03b/c | `docs/qa/F17-blog-management.md` |
| F | Users (`tenants` field self-write, no field-level access) | TC-F02-SEC-01 | `docs/qa/F02-auth.md` |
| E (round-5 amendment) | Blogs — 5 sibling functions + `bulkDeleteBlogsAction` fail-open/unscoped | TC-F17-SEC-04..09c | `docs/qa/F17-blog-management.md` |

**Very minor, NOT fixed, noted only:** `getCategoryPublishedPostCountAction` (`blog/actions.ts`) has the same "no tenant filter if `tenantId` falsy" shape, but only leaks a published-post *count* (no content) and is read-only, not part of the write-path pattern this round targeted. Not flagged by either review round; too low-severity to warrant another fix/test/verify cycle on its own.

## Unresolved questions

1. PR base (PR #1605 vs staging) — deferred to PR-open by design.
2. **Known follow-up, NOT fixed in this branch (noted, decide scope/timing later):** final adversarial review pass (round 3) found the same tenant/site force-guard gap (fixed here for Categories/Products) is still live in `Orders.ts`, `Customers.ts`, `Sites.ts` (worst — `paymentConfig`/bank details, `headerBlock`/`footerBlock`/`globalBlocks` could be relocated into a victim tenant), and a milder version in `PushSubscriptions.ts`. `Discounts.ts` already has the correct guard (pre-existing, confirms the team has hit this class before). Not fixed here — user chose to note only, decide scope/timing later, to keep this PR's already-substantial diff scoped to Categories/Products/Blogs/BlogCategories.
3. **CRITICAL, CONFIRMED LIVE — FIXED (Bug F).** `/code-review` (round 4, formal 3-stage) adversarial pass found that `src/collections/Users.ts`'s `tenants` array field (the user's own tenant-membership list — the "unspoofable source of truth" every fix in this plan relies on) had **no field-level `access` restriction** (unlike the sibling `roles` field, which is explicitly `update: super-admin only`). Collection-level `access.update` allows self-update (`{id:{equals:req.user.id}}`), which only gates row selection, not field mutation — same root-cause class as Bug C/D. **Verified live via Payload Local API before fix**: an authenticated non-admin user could `payload.update({collection:'users', id:<own-id>, data:{tenants:[{tenant:<victim-tenant-id>, role:'owner', status:'active'}]}, overrideAccess:false})` and successfully self-grant ownership membership in ANY tenant — exploitable via a plain authenticated `PATCH /api/users/<own-id>` (Payload's REST PATCH defaults `overrideAccess:false`, so real access control applies there). This would have made every "force tenant to actor's real tenant" guard in this plan (Bug C/D) moot — an attacker could just add the victim's tenant to their own membership first. **Fix:** added `access: { update: super-admin only }` to the `tenants` field, mirroring `roles`. Verified safe: all internal invite/remove/role-change flows in `Users.ts` already call `payload.update(..., overrideAccess:true)`, which bypasses field access entirely, so this restriction only closes the generic REST/Local-API write path — confirmed via live reproduction (self-grant now rejected, super-admin passthrough intact) and full `npm test` (587/587, 10289 tests). New test: TC-F02-SEC-01 in `src/__tests__/unit/collections/all-collections-config.test.ts`.

## Validation Summary

**Validated:** 2026-07-13
**Questions asked:** 4

### Confirmed Decisions
- **GH issue timing:** create the GitHub issue AFTER implementation is done, not before (updated Prerequisites checklist accordingly).
- **Access-log check:** promoted from "recommended, not a blocker" to a **required pre-merge gate** — Phase 02 now has this as a mandatory implementation step + Todo item (grep Betterstack access logs for real anonymous traffic on all 4 REST endpoints before merge/deploy; STOP if any found).
- **Timing/priority:** user chose to SCHEDULE this for later, NOT implement immediately following validation. Plan is complete and ready to execute whenever picked up; no phases were started.
- **Super-admin scope (Bug A):** confirmed — super-admin keeps unrestricted cross-tenant `parent` access (existing `findByID` passthrough retained in Phase 01's design), matching current `access.read`'s super-admin behavior. No change needed to Phase 01's already-locked design.

### Action Items
- [x] Phase 02 + plan.md updated to reflect the access-log check is now mandatory, not optional.
- [x] Plan.md's Prerequisites checklist updated: issue creation moved to post-implementation.
- [ ] When implementation is picked up later: create branch is already done (`fix/category-tenant-isolation-security`, checked out); start at Phase 1.
