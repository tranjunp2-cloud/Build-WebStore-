# C1 Security Fix — Regression Test Report
**Date:** 2026-07-14 | **Task:** GH-1587 C1 Security Regression Testing  
**Branch:** `feat/f08-1587-category-integrity-fixes`  
**Tester:** QA Lead  
**Status:** ✅ ALL PASS

---

## Executive Summary

Added 4 critical regression tests verifying the C1 security fix (GH-1587) in `Categories.ts`:
- **ownerTenantId** derivation: now uses `req.user.tenants[0]` (authenticated source) on create; `originalDoc.tenant` (persisted) on update — NOT client-supplied `data.tenant`
- **Field-level access:** `tenant` & `site` fields locked with `access: { create: () => false, update: () => false }`

All 4 regression tests + existing 12 tests = **16/16 PASS**.  
Full category test suite = **60/60 PASS** (dashboard + hooks + dedup + delete integrity).

---

## Test Execution Results

### Regression Tests Added (TC-F08-05-10..13)

| TC-ID | Title | Status | Notes |
|-------|-------|--------|-------|
| **TC-F08-05-10** | CREATE-path exploit blocked: forged tenant/site with different-tenant parent fails cross-tenant check | ✅ PASS | Attacker forges `data.tenant` to match victim parent's tenant; hook correctly uses `req.user.tenants[0]` → CATEGORY_PARENT_TENANT_MISMATCH thrown |
| **TC-F08-05-11** | CREATE-path field-strip belt-and-suspenders: tenant/site fields have `access.create: () => false` | ✅ PASS | Verifies field configuration prevents forged values from persisting; both `tenant` & `site` fields correctly configured with `access: { create: () => false, update: () => false }` |
| **TC-F08-05-12** | Legitimate CREATE still works: tenant/site auto-injected from req.user when omitted | ✅ PASS | Happy-path regression: client omits `tenant`/`site`; `beforeChange` hook auto-injects from `req.user.tenants[0]` correctly; no regression to legitimate flow |
| **TC-F08-05-13** | UPDATE-path uses originalDoc.tenant, not data.tenant: forged payload tenant ignored | ✅ PASS | On update, `ownerTenantId` derives from `originalDoc.tenant` (persisted), not `data.tenant`; forged payload value cannot fool cross-tenant check |

### Full Test Suite Results

**File:** `src/__tests__/unit/dashboard/category-field-access.test.ts`
- **Total Tests:** 16 (12 existing + 4 new)
- **Passed:** 16 ✅
- **Failed:** 0
- **Duration:** 381ms

**Category Suite (all related tests):**
- `src/__tests__/unit/collections/categories-hooks.test.ts` — 5 tests ✅
- `src/__tests__/unit/dashboard/category-delete-integrity.test.ts` — 10 tests ✅
- `src/__tests__/unit/dashboard/category-dedup.test.ts` — 29 tests ✅
- `src/__tests__/unit/dashboard/category-field-access.test.ts` — 16 tests ✅
- **Total Suite:** 60 tests ✅ | 0 failed | 2.00s

---

## Regression Scenarios Covered

### 1. CREATE-Path Exploit Blocked (TC-F08-05-10)
**Scenario:** Attacker attempts to forge `tenant` in create payload to match a different tenant's parent category.

**Before Fix:** Vulnerability — `ownerTenantId` read from `data.tenant` (client-controlled) → attacker could forge `data.tenant=victim-tenant`, making cross-tenant parent check pass incorrectly.

**After Fix:** ✅ Fixed — `ownerTenantId` now uses `req.user.tenants[0]` (authenticated user's real tenant) → forged `data.tenant` value ignored → cross-tenant check fails correctly with `CATEGORY_PARENT_TENANT_MISMATCH`.

**Assertion:**
```
Hook throws CATEGORY_PARENT_TENANT_MISMATCH when:
  - attacker_tenant = 'attacker-tenant-456'
  - parent.tenant = 'victim-tenant-789'
  - forged data.tenant = 'victim-tenant-789' (attacker tries this)
  - ownerTenantId derived from req.user.tenants[0] = 'attacker-tenant-456'
  - Check: parentTenantId ('victim-789') !== ownerTenantId ('attacker-456') → throw error ✓
```

### 2. Field-Level Access Belt-and-Suspenders (TC-F08-05-11)
**Scenario:** Verify field-level `access: { create: () => false, update: () => false }` is configured as second enforcement layer.

**Design:** Even if hook mistakenly allowed forged `tenant`/`site`, field-level access strips them before persisting. This test verifies the configuration is correct.

**Assertion:**
```
Categories collection fields:
  - tenant field: access.create() === false ✓
  - tenant field: access.update() === false ✓
  - site field: access.create() === false ✓
  - site field: access.update() === false ✓
```

### 3. Legitimate Create Path Still Works (TC-F08-05-12)
**Scenario:** Verify no regression to happy path — client omits `tenant`/`site`, and `beforeChange` hook auto-injects from authenticated user.

**Before Fix:** Working as designed.

**After Fix:** ✅ No regression — `beforeChange` hook still auto-injects `tenant` from `req.user.tenants[0]` and looks up `site` when omitted from payload.

**Assertion:**
```
For create with parent='parent-456' (same-tenant) and tenant/site omitted:
  - beforeValidate: passes (parent tenant matches user's real tenant)
  - beforeChange: injects data.tenant = 'attacker-tenant-456' ✓
  - beforeChange: injects data.site = 'site-456' (looked up) ✓
  - result has correct auto-injected values with no forged data ✓
```

### 4. UPDATE-Path Uses Persisted Tenant (TC-F08-05-13)
**Scenario:** On update, verify `ownerTenantId` comes from `originalDoc.tenant` (persisted), not `data.tenant` (payload).

**Before Fix:** Vulnerability — could use forged `data.tenant` during re-parent operation to pass cross-tenant check incorrectly.

**After Fix:** ✅ Fixed — cross-tenant check uses `originalDoc.tenant` (authoritative persisted value) → forged `data.tenant` in payload cannot fool the check.

**Assertion:**
```
For update with:
  - originalDoc.tenant = 'attacker-tenant-456' (persisted, user's real tenant)
  - data.tenant = 'victim-tenant-789' (forged in payload)
  - parent = 'parent-in-victim-tenant' (victim's parent)
  - Hook derives ownerTenantId from originalDoc.tenant = 'attacker-456'
  - Check: parentTenantId ('victim-789') !== ownerTenantId ('attacker-456') → throw CATEGORY_PARENT_TENANT_MISMATCH ✓
```

---

## Code Coverage

**File Modified:** `src/collections/Categories.ts`
- **beforeValidate hook (L107-134):** ✅ Covered by TC-F08-05-10, TC-F08-05-12, TC-F08-05-13
  - `ownerTenantId` derivation from `req.user.tenants[0]` on create ✓
  - `ownerTenantId` derivation from `originalDoc.tenant` on update ✓
  - Cross-tenant parent check using authentic tenant ✓
- **tenant field access (L199-211):** ✅ Covered by TC-F08-05-11, existing TC-F08-05-05
  - `access: { create: () => false }` configured ✓
  - `access: { update: () => false }` configured ✓
- **site field access (L212-221):** ✅ Covered by TC-F08-05-11, existing TC-F08-05-05
  - `access: { create: () => false }` configured ✓
  - `access: { update: () => false }` configured ✓
- **beforeChange hook (L148-194):** ✅ Covered by TC-F08-05-12, existing tests
  - Auto-inject `tenant` from `req.user` when omitted ✓
  - Auto-inject `site` from tenant lookup when omitted ✓

---

## Test Convention Compliance

✅ **All tests follow project standards** (`.claude/rules/testing.md`, `docs/TEST_CONVENTION.md`):
- TC-ID refs present for all 4 tests (TC-F08-05-10..13)
- AAA (Arrange-Act-Assert) pattern used consistently
- `vi.mock()` at top of file (no new mocks added for these tests)
- Imports from source — no logic re-implementation
- No `.skip`, `.only`, fake data, or weakened assertions
- Top-level test names match TC-ID pattern

**Import Source Verification:**
```typescript
// Directly imports & tests Categories hook from source
const { Categories } = await import('@/collections/Categories')
const hook = Categories.hooks?.beforeValidate?.[0] as any
// No re-implementation of hook logic in test
```

---

## Unresolved Questions

1. **TC-ID Documentation:** Tests TC-F08-05-10..13 are new. Should these be documented in `docs/qa/F08-product-crud.md`? Currently mapped to F08-05 series (based on existing TC-F08-05-05/06/09 pattern). **Flagged for docs-manager follow-up.**

2. **Field Access Configuration Reflection:** TC-F08-05-11 directly calls `field.access.create()` on the configured field. This works for functions but may not catch edge cases in Payload's runtime field access layer. **Test assumes field config is sufficient; actual Payload runtime enforcement not directly tested here.** (Acceptable because `TC-F08-05-05` already tested real action-layer stripping via mocked `mockCreate`.)

---

## Test Command Reference

```bash
# Run only new regression tests
npm run test -- src/__tests__/unit/dashboard/category-field-access.test.ts

# Run full category test suite
npm run test -- \
  src/__tests__/unit/dashboard/category-*.test.ts \
  src/__tests__/unit/collections/categories-hooks.test.ts

# Run with coverage
npm run test:coverage -- src/__tests__/unit/dashboard/category-field-access.test.ts
```

---

## Summary

**✅ All 4 C1 regression tests PASS** — `ownerTenantId` derivation fix verified across create/update paths, field-level access belt-and-suspenders confirmed, happy path regression cleared.

**✅ Full category suite: 60/60 PASS** — no regressions to existing functionality.

**Ready for:** Code review (no uncommitted tests; staged changes ready).

---

**Next:** Code review of `src/collections/Categories.ts` security fix implementation.
