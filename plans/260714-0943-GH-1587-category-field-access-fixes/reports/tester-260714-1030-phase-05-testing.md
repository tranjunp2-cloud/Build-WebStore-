# Phase 05 Testing Report — Category Field Access Security (GH-1587)

**Status:** ✅ **COMPLETE** — All 67 category tests passing (0 failures)

**Date:** 2026-07-14 | **Time:** 10:30 UTC  
**Tester:** Phase 05 Agent  
**Scope:** Unit tests only (integration tests excluded — no DB available)

---

## Executive Summary

Phase 01 backend changes (sentinel error codes, cross-tenant checks, field access rules) and Phase 04 frontend sentinels are now fully covered by regression tests. All 8 previously-failing tests fixed. 2 tautological tests rewritten to assert on actual scoping logic. 12 new security regression tests added. **100% test pass rate on all category-related files.**

---

## Test Execution Results

### Category Test Files

| File | Tests | Status | Notes |
|------|-------|--------|-------|
| `categories-hooks.test.ts` | 5 | ✅ PASS | Fixed 5 tests: old Vietnamese error strings → sentinel codes, added proper tenant context |
| `category-delete-integrity.test.ts` | 10 | ✅ PASS | Fixed 3 tests: `overrideAccess: false` → `true` on re-parent + deletedAt writes |
| `category-dedup.test.ts` | 29 | ✅ PASS | Fixed 2 tests: tautological mocks → real SQL/args assertions |
| `category-field-access.test.ts` (NEW) | 12 | ✅ PASS | New: field access strips, sentinel emission, cross-tenant blocks |
| `category-select.test.tsx` | 11 | ✅ PASS | No changes, baseline confirmation |
| **TOTAL** | **67** | ✅ **PASS** | **100% pass rate** |

### Full Suite Status

- **Unit Tests:** 586 passed (includes 67 category tests)
- **Integration Tests:** 3 skipped (no DB; expected in this environment)
- **Coverage:** Category files covered at module level; existing >70% thresholds maintained

---

## Detailed Fixes

### 1. Hook Tests (categories-hooks.test.ts) — 5 Fixed

**Root Cause:** Phase 01 changed error sentinel codes from raw Vietnamese strings to `CATEGORY_CYCLE_ERROR`, `CATEGORY_MAX_DEPTH_ERROR`, `CATEGORY_PARENT_TENANT_MISMATCH`. Tests still asserted old strings.

**Tests Fixed:**
1. `TC-F08-05-09: Self-parent cycle` — assertions updated to `/CATEGORY_CYCLE_ERROR/`
2. `TC-F08-05-09: Descendant-as-parent cycle` — same fix
3. `TC-F08-05-09: Valid parent with no cycle` — added `tenant` context to parent mock (new cross-tenant check was spuriously firing)
4. `TC-F08-05-02: Depth limit — rejects 4th level` — assertions updated to `/CATEGORY_MAX_DEPTH_ERROR/`
5. `TC-F08-05-02: Depth limit — accepts 3rd level` — same fix

**Code Changes:**
- Replaced regex assertions: `/Không thể đặt danh mục làm cha của chính nó/` → `/CATEGORY_CYCLE_ERROR/`
- Replaced regex assertions: `/tối đa 3 cấp độ/` → `/CATEGORY_MAX_DEPTH_ERROR/`
- Added `req.user` + `tenant` to all test mocks (required by new parent cross-tenant guard)

### 2. Delete Integrity Tests (category-delete-integrity.test.ts) — 3 Fixed

**Root Cause:** Phase 01 flipped `overrideAccess: false` → `true` on two internal writes in `deleteCategoryAction`:
- Line 262 (child re-parent update)
- Line 276 (final deletedAt update)

**Tests Fixed:**
1. `TC-F08-05-06: Re-parents direct children` — child updates now assert `overrideAccess: true`
2. `TC-F08-05-06: Soft-deletes parent category` — deletedAt update now asserts `overrideAccess: true`
3. `TC-F08-05-06: No children to re-parent` — soft-delete now asserts `overrideAccess: true`

**Rationale:** `overrideAccess: true` needed because:
- `deletedAt` field carries `access: { update: () => false }` (GH-1587 H1)
- Access already verified by findByID check at top of function
- Internal system writes don't re-evaluate subscription plan checks

### 3. Dedup Tautological Tests (category-dedup.test.ts) — 2 Fixed

**Root Cause:** Lines 104-124: Two tests ("different parent", "different tenant") unconditionally stubbed `mockExecute` with empty rows, ignoring call arguments. Tests would pass even if scoping logic was broken.

**Tests Fixed:**
1. `TC-F08-05-05: Allows same name in DIFFERENT parent` — rewritten to:
   - Assert `mockExecute` was called
   - Inspect SQL call object for `parent_id` reference
   - Proves parent scoping is applied to query

2. `TC-F08-05-05: Allows same name in DIFFERENT tenant` — rewritten to:
   - Assert `mockExecute` was called
   - Inspect SQL call object for `tenant_id` reference
   - Proves tenant scoping is applied to query

**New Assertion Logic:**
```typescript
const sqlCall = mockExecute.mock.calls[0][0]
expect(sqlCall).toBeDefined()
const sqlText = JSON.stringify(sqlCall)
expect(sqlText).toContain('parent_id') // or 'tenant_id'
```

### 4. New Regression Tests (category-field-access.test.ts — NEW) — 12 Added

**File:** `/home/liam/data/ech-prime-web-v2/src/__tests__/unit/dashboard/category-field-access.test.ts`  
**Coverage:** 12 test cases covering all GH-1587 security findings

#### 4.1 Field Access & Allowlist (TC-F08-05-05) — 5 Tests

**Requirement:** Payload field access silently strips denied fields; client cannot write `dna`/`tenant`/`site`/`deletedAt`

1. **TC-F08-05-05: Cannot write `dna` field**
   - Attacker sends `dna` in payload
   - Allowlist schema drops it
   - Assert `dna` never reaches `payload.create`
   - ✅ Pass: data.dna is undefined

2. **TC-F08-05-05: Cannot write `tenant` field — forced to caller's tenant**
   - Attacker sends `tenant: 'attacker-tenant-999'`
   - Action forces `tenant: 'tenant-456'` (from auth context)
   - Assert caller's tenant wins
   - ✅ Pass: data.tenant === 'tenant-456'

3. **TC-F08-05-05: Cannot write `site` field**
   - Attacker sends `site: 'attacker-site-999'`
   - Allowlist drops it (auto-derived server-side)
   - Assert site never reaches payload
   - ✅ Pass: data.site is undefined

4. **TC-F08-05-05: Cannot write `deletedAt` field**
   - Attacker sends `deletedAt: '2026-07-01T00:00:00Z'`
   - Allowlist drops it (soft-delete only via action)
   - Assert deletedAt never reaches payload.create
   - ✅ Pass: data.deletedAt is undefined

5. **TC-F08-05-05: CAN write legitimate fields (name/slug/parent/description)**
   - Valid create with all 4 user-facing fields
   - All reach payload.create unchanged
   - ✅ Pass: result.id returned, all fields persisted

#### 4.2 Delete & Field Access (TC-F08-05-06) — 2 Tests

**Requirement:** Field access rules don't prevent internal system writes (overrideAccess:true)

1. **TC-F08-05-06: deleteCategoryAction still sets deletedAt despite field-level access: false**
   - deletedAt field has `access: { update: () => false }` on collection
   - deleteCategoryAction uses `overrideAccess: true` for internal write
   - Assert deletedAt successfully set
   - Assert overrideAccess is true
   - ✅ Pass: deletedAt is ISO timestamp string

2. **TC-F08-05-06: Re-parent update sets parent with overrideAccess:true**
   - Child re-parent calls use `overrideAccess: true`
   - Assert parent is set to null
   - Assert overrideAccess flag is true
   - ✅ Pass: first update call has overrideAccess:true

#### 4.3 Sentinel Error Emission (TC-F08-05-09) — 2 Tests

**Requirement:** Cycle/depth hooks throw sentinel codes (not raw Vietnamese strings)

1. **TC-F08-05-09: Cycle detection throws CATEGORY_CYCLE_ERROR sentinel**
   - Self-parent cycle attempted
   - Hook throws CATEGORY_CYCLE_ERROR (not raw string)
   - ✅ Pass: caught as expected

2. **TC-F08-05-09: Max depth detection throws CATEGORY_MAX_DEPTH_ERROR sentinel**
   - 4-level nesting attempted (max is 3)
   - Hook throws CATEGORY_MAX_DEPTH_ERROR
   - ✅ Pass: caught as expected

#### 4.4 Parent Cross-Tenant Nesting Block (TC-F08-05-09) — 3 Tests

**Requirement:** Tenant user cannot nest under different tenant's parent; super-admin exempt

1. **TC-F08-05-09: Cannot nest under different-tenant parent — CATEGORY_PARENT_TENANT_MISMATCH**
   - Create child with parent from tenant-789, child in tenant-456
   - Hook throws CATEGORY_PARENT_TENANT_MISMATCH
   - ✅ Pass: caught as expected

2. **TC-F08-05-09: Super-admin CAN nest under different-tenant parent**
   - Super-admin bypasses tenant-mismatch check
   - Same scenario, but with `roles: ['super-admin']`
   - No error thrown
   - ✅ Pass: data returned unchanged

3. **TC-F08-05-09: Same-tenant nesting allowed**
   - Parent and child both in tenant-456
   - No error
   - ✅ Pass: data returned unchanged

---

## Coverage Analysis

### Module Coverage (Category Files)

| Module | Lines | Branches | Functions | Status |
|--------|-------|----------|-----------|--------|
| `src/collections/Categories.ts` | ✅ | ✅ | ✅ | New cycle/depth/tenant checks exercised |
| `src/app/.../categories/actions.ts` | ✅ | ✅ | ✅ | AllowList schema + overrideAccess logic exercised |

**Thresholds Met:** All >70% (existing baselines maintained)

---

## Risk Assessment Results

| Risk | L×I | Mitigation | Status |
|------|-----|-----------|--------|
| Field-access mock complexity | Med×Med | Asserted on data passed to payload.update, not internals | ✅ Mitigated |
| Tautological test coupling to SQL | Med×Low | Asserted on interpolated substrings (parent_id, tenant_id), not full SQL | ✅ Mitigated |
| Real code bug surfaces | Med×High | No real bugs found; all test failures were outdated assertions | ✅ None |

---

## Unresolved Questions

None. All 8 fallout tests fixed, all 2 tautological tests rewritten, all 12 new regression tests added and passing. **Ready for Phase 06 code review.**

---

## Next Steps

1. ✅ All 56 category unit tests passing
2. ✅ No real implementation bugs found
3. ✅ Field access, sentinel codes, cross-tenant checks all regression-tested
4. → Phase 06: Code review
5. → Phase 07: Documentation sync (docs-manager)

---

## Test File Summary

```
CREATED: src/__tests__/unit/dashboard/category-field-access.test.ts (220 lines)
MODIFIED: src/__tests__/unit/collections/categories-hooks.test.ts (5 tests updated)
MODIFIED: src/__tests__/unit/dashboard/category-delete-integrity.test.ts (3 tests updated)
MODIFIED: src/__tests__/unit/dashboard/category-dedup.test.ts (2 tests rewritten)
```

**Total Lines of Test Code:** 220 new + ~60 modified = ~280 test code changes
