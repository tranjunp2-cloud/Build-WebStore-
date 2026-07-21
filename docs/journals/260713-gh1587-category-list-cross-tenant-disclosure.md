# GH-1587: Cross-Tenant Data Disclosure in Category List

**Date**: 2026-07-13 17:14
**Severity**: High (security — IDOR/data leakage)
**Component**: Dashboard category management (`src/app/(dashboard)/products/categories/actions.ts`, `getCategoriesAction`)
**Status**: Resolved + regression test added

## What Happened

Manual QA testing of the F08 category management dashboard (`/products/categories`) built for GH-1587, user `baotest70@yopmail.com` (tenant 81, owns 6 real products) observed the category list displaying 25+ categories and 312+ aggregate products — all data belongs to OTHER tenants. Direct verification: Payload Local API replication with real user object + DB queries confirmed tenant 81 should have exactly 4 categories. Categories visible in UI (e.g. "Fesyen Wanita", "Pakaian", "Kasut") clearly belong to unrelated seed accounts in Malay.

## The Brutal Truth

This is a real cross-tenant data disclosure vulnerability **live in production/staging before this fix**. Any logged-in dashboard user, regardless of actual tenant, could enumerate all other tenants' complete category hierarchies and product counts via a single API call. The bug existed in pre-GH-1587 code; the feature work merely exposed it via dogfooding. It's the kind of oversight that slips past code review because reviewers assume "this file was already deployed, so access control must work" — but Payload CMS 3's dangerous default (`overrideAccess: true` when omitted) silently breaks that assumption.

## Technical Details

**Root cause**: `getCategoriesAction` in `src/app/(dashboard)/products/categories/actions.ts:42` called:
```ts
payload.find({ collection: 'categories', user, where: {...}, depth: 1, limit: 1000 })
```

Missing `overrideAccess: false` flag. Payload CMS 3's Local API defaults `overrideAccess: true` when omitted — **completely bypasses** the `Categories` collection's tenant-scoped `read` access-control function (defined in `src/collections/Categories.ts`, applies `{tenant: {in: tenantIds}}` Where-filter).

**Concrete evidence**:
- Pre-fix Payload query: tenant 81 receives 25 categories, 312 products (actual: 4 categories, 6 products)
- Post-fix Payload query: tenant 81 receives 4 categories, 6 products ✓
- Test confirms: reverting the fix causes new regression test to fail

## What We Tried

1. **Script verification** (throwaway Payload Local API replication): Replicated exact action logic with real `baotest70` user object, queried real DB state before/after. Proved access control was indeed bypassed.
2. **Regression test** (`src/__tests__/unit/dashboard/category-list-tenant-scope.test.ts`): Added test that fails without the fix, passes with it — not a tautological test.
3. **Diff audit**: Confirmed all OTHER Payload calls in same file (`saveCategoryAction`, `deleteCategoryAction`, `checkCategoryNameAvailable`) already had `overrideAccess: false` — this was simply an oversight, not a pattern.

## Root Cause Analysis

This is not a GH-1587 regression (phases 01-07 never touched `getCategoriesAction` — only modified save/delete/check-name functions). It's a pre-existing footgun: Payload CMS 3's Local API defaults to **bypass all access control** when `overrideAccess` is omitted. This same dangerous default caused at least one other tenant-isolation gap earlier in this PR (adversarial code review found `saveCategoryAction` had client-supplied `tenant`/`site` field-stripping, caught before shipping).

## Fixes Applied

**One-line change**: Added `overrideAccess: false` to the `payload.find` call in `getCategoriesAction`.

**Regression test** (TC-F08-05-13): `src/__tests__/unit/dashboard/category-list-tenant-scope.test.ts` — verifies that when fetching categories as tenant 81, response includes only tenant 81's categories (4 total), not cross-tenant data.

**QA doc update**: Added TC-F08-05-13 IDOR/tenant-isolation test case to `docs/qa/F08-product-crud.md`.

**Full validation**: 79 tests across 6 category test files pass, `tsc --noEmit` clean, `check-migrations.js` clean.

## Lessons Learned

1. **Payload CMS 3 access-control is sharp by default**: `overrideAccess: true` (bypass) is the default. This is a dangerous footgun. Every Local API call in server actions **must** explicitly state `overrideAccess: false` OR have a documented reason why bypassing is intentional (e.g., admin bulk operations). Code review alone doesn't catch omissions; manual QA on adjacent features can.

2. **Dogfooding surfaces gaps code review misses**: This bug wasn't visible in the GH-1587 diff review (it's in pre-existing code). It only emerged because actual QA testing exercised the exact page the feature built around.

3. **Shared patterns prevent repetition**: All other Payload calls in this file already had the guard. One omission slipped through. Worth considering a lint rule or Payload wrapper to enforce explicit `overrideAccess` on every Local API call site across the codebase (currently ~30+ server actions).

## Next Steps

1. **Immediate**: This fix ships with GH-1587 PR-1.
2. **Follow-up (optional, lower priority)**: Audit remaining `src/app/**/actions.ts` server actions for the same missing-`overrideAccess` pattern. Files to check: any file with `payload.find()`, `payload.update()`, `payload.delete()`, `payload.create()` calls.
3. **Long-term (design decision, not committing here)**: Discuss team consensus on whether to introduce a lint rule or Payload wrapper that enforces explicit `overrideAccess` on every Local API call, to prevent this class of bug recurring.

---

**Status**: DONE  
**Summary**: Fixed cross-tenant data disclosure in `getCategoriesAction` (missing `overrideAccess: false`). Payload CMS 3's bypass-by-default is a sharp footgun; added regression test + TC-ID. One-line fix, high security impact.
