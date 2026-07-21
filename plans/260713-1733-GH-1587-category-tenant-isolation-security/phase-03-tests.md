# Phase 03 — Tests for Bug A + Bug B

**PR:** this branch · **Migration:** No · **Priority:** P0 · **Status:** done

## Context

- Test rules: `.claude/rules/testing.md` + `docs/TEST_CONVENTION.md` — TC-ID required, AAA, `vi.mock()` top-level, import real source (never re-implement), `beforeEach` cleanup.
- Gold pattern for this feature: `src/__tests__/unit/dashboard/category-list-tenant-scope.test.ts` (Bug 0, TC-F08-05-13) + existing `src/__tests__/unit/collections/categories-hooks.test.ts`.
- Depends on Phase 01 + 02 shipped (tests verify the merged code).

## Overview

Two test surfaces:
1. **Bug A** — hook rejects cross-tenant parent (add to existing `categories-hooks.test.ts`). TC-F08-05-14.
2. **Bug B** — each collection's `access.read` returns `false` for anonymous (new single cross-cutting file). TC-F08-05-15, TC-F09-SEC-01, TC-F17-SEC-01, TC-F17-SEC-02.

## Key Insights

- **Bug B tests are pure-function** — import the collection config, call `Collection.access.read({ req:{ user: undefined } })`, assert `=== false`. Also assert authenticated branch still returns a tenant filter (regression guard). No payload mock needed → cheap, deterministic, AAA-clean.
- **Bug A test** needs `req.payload.find` / `req.payload.findByID` mocked (async hook). Follow the mock shape already in `categories-hooks.test.ts`. Assert: (a) cross-tenant parent (`find` returns `{docs:[]}`) → hook throws; (b) same-tenant parent (`find` returns `{docs:[{...}]}`) → resolves; (c) super-admin path uses `findByID` (passthrough).
- Import REAL functions: `Categories.hooks.beforeValidate[0]`, `Categories.access.read`, etc. Never re-implement the tenant logic in the test.

## Requirements

- Every test references its TC-ID in the `describe`/`it` title.
- Cover both positive (allowed) and negative (blocked) paths for each bug.
- No fake-passing: assertions must exercise the real access/hook functions.

## Related Code Files

**Create/modify (test files only — this phase owns tests, never edits `src/collections/*`):**
- MODIFY `src/__tests__/unit/collections/categories-hooks.test.ts` — add `describe('parent cross-tenant IDOR (TC-F08-05-14)')` block for Bug A.
- CREATE `src/__tests__/unit/collections/anonymous-read-tenant-isolation.test.ts` — Bug B, all 4 collections' `access.read` anon-block + auth-branch regression.

**Read for context:** the 4 collection configs; existing `categories-hooks.test.ts` mock scaffold; `category-list-tenant-scope.test.ts` (TC-ID style).

## Implementation Steps

1. **Bug A (TC-F08-05-14)** in `categories-hooks.test.ts`:
   - Arrange: mock `req.payload.find` → `{docs:[]}` (cross-tenant miss); `req.user` non-admin with `tenants:[{tenant:'A'}]`; `data:{parent:'foreign-id', name:'x'}`, `operation:'update'`, `originalDoc:{id:'self', tenant:'A'}`.
   - Act+Assert: `await expect(beforeValidate({...})).rejects.toThrow(/cùng thương hiệu/)`.
   - Positive: `find` → `{docs:[{id:'p', tenant:'A', parent:null, breadcrumbs:'P'}]}` → resolves; assert `find` called with `where.tenant.equals === 'A'`.
   - Super-admin: `req.user.roles:['super-admin']` → asserts `findByID` used (passthrough), not blocked.
   - `beforeChange` breadcrumb: cross-tenant parent → throws; same-tenant → `data.breadcrumbs === 'P > x'`.
2. **Bug B** new file `anonymous-read-tenant-isolation.test.ts`:
   - `import { Categories } from '@/collections/Categories'` (+ Products, Blogs, BlogCategories).
   - Per collection, 2 tests:
     - `TC-xxx: anonymous read denied` → `expect(Coll.access.read({ req:{} }))` (or `{user:undefined}`) `.toBe(false)`.
     - `TC-xxx: authenticated tenant-scoped read still applies` → `req.user` with tenants → returns `{tenant:{in:[...]}}` (regression guard that Option A didn't break auth path).
   - TC-IDs: Categories→TC-F08-05-15, Products→TC-F09-SEC-01, Blogs→TC-F17-SEC-01, BlogCategories→TC-F17-SEC-02.
3. Run `npm test` → all green. Run targeted: `npm test -- categories-hooks anonymous-read-tenant-isolation`.

## Todo

- [x] Bug A cross-tenant reject test (TC-F08-05-14) in categories-hooks.test.ts
- [x] Bug A same-tenant allow + `where.tenant` assertion
- [x] Bug A super-admin passthrough test
- [x] Bug A beforeChange breadcrumb (cross-tenant throw + same-tenant format)
- [x] Bug B anon-denied ×4 collections (TC-F08-05-15, TC-F09-SEC-01, TC-F17-SEC-01, TC-F17-SEC-02)
- [x] Bug B auth-branch regression guard ×4
- [x] Full `npm test` green

## Success Criteria

- All new tests pass; import real source (no re-implemented logic).
- Each TC-ID present in a test title and matches the QA doc (added in Phase 04).
- Full suite green (also satisfies Phase 02's mandatory full-run gate).

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Access fn signature differs (`{req}` shape) | Med×Low | Copy exact call shape from source; `req:{user:undefined}` |
| Hook mock drift vs real `find`/`findByID` shapes | Med×Med | Reuse existing `categories-hooks.test.ts` mocks; assert on `where` arg |
| Async-branch (super-admin) return-shape mismatch | Low×Low | Assert which method called, not deep result |

## Security Considerations

- These tests are the regression guard: any future edit re-opening anon read or dropping the tenant gate fails CI. Keep them.

## Next Steps

- Phase 04 registers all 5 TC-IDs in the owning QA docs.
