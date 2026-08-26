# GH-1587 Cross-Tenant Security Fixes — Regression Test Suite Report

**Date:** 2026-07-14 10:36  
**Branch:** `fix/category-tenant-isolation-security`  
**Status:** ✅ ALL TESTS PASSING

## Executive Summary

Added 31 persisted regression tests for 5 cross-tenant security fixes (Bugs A, B, C, D, E). Tests follow `.claude/rules/testing.md` patterns: TC-ID naming, AAA structure, top-level mocks, source imports (no re-implementation). All 10,284 tests in suite green.

## Test Files Modified

| File | TC-IDs | New Tests | Status |
|------|--------|-----------|--------|
| `src/__tests__/unit/collections/categories-hooks.test.ts` | F08-05-14, 15, 16 | 20 | ✅ PASS |
| `src/__tests__/unit/collections/products-hooks.test.ts` | F09-SEC-02 | 4 | ✅ PASS |
| `src/__tests__/unit/collections/products-config.test.ts` | F09-SEC-01 | 3 | ✅ PASS |
| `src/__tests__/unit/actions/blog-actions-f17-fixes.test.ts` | F17-SEC-03 | 4 | ✅ PASS |
| (categories-hooks re-used for anonymous blocks) | F08-05-15, F17-SEC-01, F17-SEC-02 | 9* | ✅ PASS |
| **Total** | **8 TC-IDs** | **31** | ✅ ALL PASS |

*Anonymous read tests added to categories-hooks.test.ts for all 4 collections (Categories, Products, Blogs, BlogCategories) via shared test patterns.

## Coverage by Bug

### Bug A: Parent Field Cross-Tenant IDOR (TC-F08-05-14)

**File:** `src/__tests__/unit/collections/categories-hooks.test.ts`

**Tests Added (4):**
1. ✅ Non-admin cross-tenant parent rejected with "thuộc cùng thương hiệu" error
2. ✅ Non-admin same-tenant parent succeeds
3. ✅ Non-admin with no resolvable tenant throws fail-safe error (no lookup executed)
4. ✅ Super-admin passthrough (uses `findByID`, not tenant-scoped `find`)

**Assertion Patterns:**
- Mock `payload.find({where:{id, tenant}})` for non-admin lookup
- Mock `payload.findByID()` for super-admin passthrough
- Verify error on empty docs array (cross-tenant rejection)
- Verify hook calls correct lookup shape (compound `where`)

### Bug B: Anonymous Read Block (4 Collections)

**Tests Added (12):**

**Categories (TC-F08-05-15):**
- ✅ `access.read` returns `false` for `req.user = undefined`
- ✅ `access.read` returns `false` for `req.user = null`
- ✅ Authenticated user gets tenant-scoped Where clause

**Products (TC-F09-SEC-01):**
- ✅ `access.read` returns `false` for anonymous
- ✅ `access.read` returns `false` for null user
- ✅ Authenticated user gets tenant-scoped access

**Blogs (TC-F17-SEC-01):**
- ✅ `access.read` returns `false` for anonymous
- ✅ `access.read` returns `false` for null user
- ✅ Authenticated user gets tenant-scoped access

**BlogCategories (TC-F17-SEC-02):**
- ✅ `access.read` returns `false` for anonymous
- ✅ `access.read` returns `false` for null user
- ✅ Authenticated user gets tenant-scoped access

**Assertion Pattern:**
- Direct call to `Collection.access.read({req})` with synthetic `req`
- Assert `false` (not object, not `true`) for anonymous
- Assert tenant-scoped Where clause for authenticated

### Bug C: Tenant/Site Field Spoof (TC-F08-05-16)

**File:** `src/__tests__/unit/collections/categories-hooks.test.ts`

**Tests Added (7):**
1. ✅ Non-admin `{tenant:<victim>}` PATCH forced back to original tenant on update
2. ✅ Non-admin update without spoof preserves own tenant
3. ✅ Multi-site preservation: no site change keeps `originalDoc.site`
4. ✅ Multi-site preservation: same site ID (no lookup called)
5. ✅ Multi-site validation: new site in same tenant accepted
6. ✅ Multi-site validation: cross-tenant site rejected, reverts to original
7. ✅ Super-admin passthrough: tenant/site unchanged

**Assertion Patterns:**
- Mock `payload.find({where:{id, tenant}})` for site validation
- Assert `result.tenant === safeTenantId` (forced back)
- Assert site validation only called when `data.site !== originalSiteId`
- Verify spoof rejection returns original site, not spoofed value

### Bug D: Products Tenant/Site Field Spoof (TC-F09-SEC-02)

**File:** `src/__tests__/unit/collections/products-hooks.test.ts`

**Tests Added (4):**
1. ✅ Non-admin `{tenant:<victim>}` PATCH forced to own tenant on update
2. ✅ Multi-site validation: new site in same tenant accepted
3. ✅ Multi-site validation: cross-tenant site rejected, reverts to original
4. ✅ Super-admin passthrough: tenant/site unchanged

**Note:** Mirror pattern to Categories Bug C; verifies hook applies to all write paths via beforeChangeHook.

### Bug E: saveBlogAction Cross-Tenant Update IDOR (TC-F17-SEC-03)

**File:** `src/__tests__/unit/actions/blog-actions-f17-fixes.test.ts`

**Tests Added (4):**
1. ✅ Non-admin updating blog owned by different tenant rejected with "Unauthorized update access"
2. ✅ Non-admin updating own tenant's blog succeeds; `payload.update` called
3. ✅ Tenant as object (`{id:'tenant-2'}`) correctly compared (string coercion works)
4. ✅ Tenant/object format handling: extraction and comparison on polymorphic tenant field

**Assertion Patterns:**
- Mock `payload.findByID()` returning blog with different tenant
- Assert `error: 'Unauthorized update access'` returned
- Assert `mockUpdate.not.toHaveBeenCalled()`
- Verify same-tenant update proceeds to `payload.update`
- Test polymorphic tenant formats (string vs `{id}` object)

## Test Quality Metrics

### Coverage Pattern
- ✅ **Happy path:** Authorized writes, same-tenant lookups, valid data
- ✅ **Attack paths:** Cross-tenant parent, field spoof, anonymous read, cross-tenant update
- ✅ **Edge cases:** No tenant, empty results, polymorphic tenant formats
- ✅ **Super-admin:** Passthrough behavior verified for all hooks

### Mock Strategy
- ✅ **Top-level mocks:** All `vi.mock()` at file scope (no describe/it nesting)
- ✅ **Source imports:** Directly import `Categories`, `Products`, `Blogs`, `BlogCategories`, action functions
- ✅ **No re-implementation:** Tests call actual hook/access functions, mock only Payload methods
- ✅ **AAA structure:** Arrange (mock setup), Act (call hook/access), Assert (verify behavior)

### TC-ID Traceability
All tests include TC-ID in describe/it names:
- `TC-F08-05-14`: Parent IDOR
- `TC-F08-05-15`: Categories anonymous read
- `TC-F08-05-16`: Categories tenant/site spoof
- `TC-F09-SEC-01`: Products anonymous read
- `TC-F09-SEC-02`: Products tenant/site spoof
- `TC-F17-SEC-01`: Blogs anonymous read
- `TC-F17-SEC-02`: BlogCategories anonymous read
- `TC-F17-SEC-03`: saveBlogAction cross-tenant IDOR

## Build & Test Results

### TypeScript Compilation
```
npx tsc --noEmit
(no output — clean)
```

### Full Test Suite
```
Test Files  587 passed (587)
Tests       10284 passed (10284)
```

### Specific Test File Results
```
categories-hooks.test.ts:      25 tests (was 5, +20)
products-hooks.test.ts:        23 tests (was 19, +4)
products-config.test.ts:       13 tests (was 10, +3)
blog-actions-f17-fixes.test.ts: 9 tests (was 5, +4)
```

## Implementation Notes

### Decisions Made

1. **Anonymous read tests location:** Added to existing test files (`categories-hooks.test.ts`, `products-config.test.ts`) rather than creating new files. Keeps related tests together; follows pattern of accessing `Collection.access.read()` directly.

2. **Multi-site scenario testing (Bug C/D):** Included comprehensive site validation tests (same-site, new site, cross-tenant spoof, revert logic) to guard against the naive "first-match lookup" bug mentioned in plan.md § Bug C. Tests verify the "preserve original OR validate new" logic, not just tenant-spoof rejection.

3. **Blog action tests (Bug E):** Reused existing mocks from `blog-actions-f17-fixes.test.ts` setup; added 4 specific cross-tenant scenarios. No new mock setup needed beyond mock `findByID` call.

4. **Super-admin passthrough tests:** Added to all hook tests (Bugs A, C, D) to ensure regression doesn't creep in. Matches existing Categories test pattern for cycle prevention.

### Test Independence
- All tests use `beforeEach(() => vi.clearAllMocks())` (mock resets)
- No test interdependencies; each test sets up its own mocks
- Tests isolated to single TC-ID concern (no multi-bug tests)

## Unresolved Questions

None. All tests execute cleanly against actual fixes already merged to this branch.

## Recommendations

1. **Access log validation (Phase 02 recommended gate):** Plan.md § Confirmed Decisions notes mandatory access-log check for 4 REST endpoints before merge. Consider adding an integration test or manual runbook verification step to confirm zero anonymous traffic on:
   - `GET /api/categories` (REST)
   - `GET /api/products` (REST)
   - `GET /api/blogs` (REST)
   - `GET /api/blog_categories` (REST)

2. **Live reproduction audit:** All 5 bugs were verified against live Payload Local API + real Postgres before fixing (per plan.md). Tests now provide regression guard; consider saving throwaway reproduction scripts in `docs/journals/` for future cross-tenant audits.

3. **Multi-site edge cases:** Bug C's site-handling logic is subtle (preserve on update, first-match on create). Consider adding doc comment in `Categories.ts` + `Products.ts` explaining the branching logic for future maintainers.

---

**Status:** ✅ Ready for review + merge. All tests passing, no regressions, full coverage of 8 TC-IDs across 5 bugs.
