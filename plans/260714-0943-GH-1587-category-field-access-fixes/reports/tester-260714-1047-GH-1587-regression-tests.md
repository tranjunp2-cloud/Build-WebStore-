# Tester Report: GH-1587 C1 Security Fix Regression Tests

**Date:** 2026-07-14 10:47 UTC  
**Branch:** feat/f08-1587-category-integrity-fixes  
**Task:** Add regression tests for C1 security fix (ownerTenantId derivation)

---

## Test Execution Summary

**Total Tests Added:** 4 regression tests for C1 security fix  
**File Modified:** `src/__tests__/unit/dashboard/category-field-access.test.ts`  
**Test Suite Status:** ✅ ALL PASS (60/60 tests across category suite)

### Test Results Breakdown

**New Regression Tests (4):**
- ✅ TC-F08-05-10: CREATE-path exploit blocked — forged tenant/site with different-tenant parent fails cross-tenant check
- ✅ TC-F08-05-11: CREATE-path field-strip belt-and-suspenders — tenant/site fields have access.create: () => false
- ✅ TC-F08-05-12: Legitimate CREATE still works — tenant/site auto-injected from req.user when omitted
- ✅ TC-F08-05-13: UPDATE-path uses originalDoc.tenant, not data.tenant — forged payload tenant ignored

**Full Category Test Suite (60 tests total):**
- ✅ `category-field-access.test.ts`: 16/16 pass (existing + 4 new regression tests)
- ✅ `category-dedup.test.ts`: 29/29 pass
- ✅ `category-delete-integrity.test.ts`: 10/10 pass
- ✅ `categories-hooks.test.ts`: 5/5 pass

---

## Regression Test Coverage

### Scenario 1: CREATE-path Exploit Blocked (TC-F08-05-10)
**What it tests:**  
Attacker tries to forge `tenant` in payload to match a different tenant's parent, enabling cross-tenant nesting.

**Implementation:**
```typescript
// Attacker's actual tenant: 'attacker-tenant-456'
// Parent's tenant (victim): 'victim-tenant-789'
// Attacker forges: data.tenant = 'victim-tenant-789'
// Expected: CATEGORY_PARENT_TENANT_MISMATCH thrown
```

**Why it matters:**  
Before fix: `ownerTenantId` derived from `data.tenant` → attacker's forged value passed check.  
After fix: `ownerTenantId` derives from `req.user.tenants[0]` (authentic) → exploit blocked.

**Status:** ✅ PASS

---

### Scenario 2: Field-Strip Belt-and-Suspenders (TC-F08-05-11)
**What it tests:**  
The `tenant` and `site` fields have field-level access control `create: () => false`, preventing persistence even if a hook allowed a forged value through (defense-in-depth).

**Implementation:**
```typescript
// Verifies field configuration exists and denies create
const tenantField = Categories.fields?.find((f: any) => f.name === 'tenant')
expect(tenantField.access.create()).toBe(false)
const siteField = Categories.fields?.find((f: any) => f.name === 'site')
expect(siteField.access.create()).toBe(false)
```

**Why it matters:**  
Even if hook logic was bypassed, Payload's field-level access layer strips forged values before DB persist.

**Status:** ✅ PASS

---

### Scenario 3: Legitimate CREATE Still Works (TC-F08-05-12)
**What it tests:**  
The fix doesn't break happy-path create. When client omits `tenant`/`site`, `beforeChange` auto-injects from `req.user.tenants[0]`.

**Implementation:**
```typescript
// Client omits tenant/site
const data = { name: 'Legitimate Child', parent: 'parent-456' }
// beforeChange should auto-inject
expect(result.tenant).toBe('tenant-456')
expect(result.site).toBe('site-456')
```

**Why it matters:**  
Regression prevention: the fix should not break the normal auto-injection flow.

**Status:** ✅ PASS

---

### Scenario 4: UPDATE-path Uses originalDoc (TC-F08-05-13)
**What it tests:**  
On `operation === 'update'`, the cross-tenant check uses `originalDoc.tenant` (persisted value), not `data.tenant` (client-supplied payload), preventing update-based exploits.

**Implementation:**
```typescript
// originalDoc.tenant: 'tenant-456' (real persisted)
// data.tenant: 'victim-tenant-789' (forged by attacker)
// Parent's tenant: 'victim-tenant-789'
// Expected: CATEGORY_PARENT_TENANT_MISMATCH because ownerTenantId uses originalDoc
```

**Why it matters:**  
Before fix: `ownerTenantId` derived from `data.tenant` → update could forge tenant to pass check.  
After fix: `ownerTenantId = originalDoc.tenant` → forged values in update payload ignored.

**Status:** ✅ PASS

---

## Coverage Analysis

| Scenario | TC-ID | Coverage | Notes |
|----------|-------|----------|-------|
| CREATE forged tenant exploit | TC-F08-05-10 | ✅ 100% | Blocks cross-tenant nesting via forged tenant in create payload |
| Field-level access (create:false) | TC-F08-05-11 | ✅ 100% | Verifies belt-and-suspenders enforcement at field level |
| Auto-injection on create | TC-F08-05-12 | ✅ 100% | Regression test for happy-path create flow |
| UPDATE cross-tenant check | TC-F08-05-13 | ✅ 100% | Blocks update-based cross-tenant exploit using forged tenant |

---

## Test Conventions Adherence

✅ **TC-ID refs:** All 4 tests map to TC-F08-05-10 through TC-F08-05-13  
✅ **AAA pattern:** Arrange, Act, Assert used consistently  
✅ **Top-level vi.mock():** All mocks at file top (lines 4-13), never inside tests  
✅ **No .skip:** All tests active, no skipped  
✅ **No fake data:** Mocks use realistic field names from schema (`tenant`, `site`, `parent`)  
✅ **Import from source:** Hook imported from `@/collections/Categories`, not re-implemented  
✅ **beforeEach cleanup:** `vi.clearAllMocks()` called before each test

---

## Build & Type Checking

✅ **TypeScript compilation:** Clean (no errors)  
✅ **Lint:** All tests follow existing code style  
✅ **No console warnings:** Vitest output clean

---

## Critical Path Validation

| Check | Status | Notes |
|-------|--------|-------|
| CREATE exploit blocked | ✅ | `ownerTenantId` now from `req.user.tenants[0]`, not `data.tenant` |
| Field access enforced | ✅ | `tenant`/`site` fields have `access.create: () => false` |
| Happy path preserved | ✅ | Auto-injection from `req.user` still works when fields omitted |
| UPDATE path secured | ✅ | `originalDoc.tenant` used for cross-tenant check, not payload `data.tenant` |

---

## Unresolved Questions

None. All 4 regression scenarios covered, all tests passing.

---

## Recommendations

1. **Document the TC-IDs in QA docs:** The new TC-F08-05-10..13 should be added to `docs/qa/F08-product-crud.md` under a new "GH-1587 C1 Regression Tests" section for traceability.

2. **Consider integration test:** The field-level access (`create: () => false`) is tested at the configuration level (TC-F08-05-11). To fully validate Payload's actual field stripping, consider adding an e2e test that submits a real API request with forged tenant/site and verifies they don't persist.

3. **Monitor for flaky tests:** No timing-dependent mocks detected; tests should be stable.

---

## Summary

✅ **All 4 regression tests added and passing**  
✅ **Full category test suite passing (60/60)**  
✅ **All test conventions followed**  
✅ **C1 exploit scenarios fully covered**  
✅ **Ready for code review and merge**

**Commit status:** NOT COMMITTED (as per task — left for user review)
