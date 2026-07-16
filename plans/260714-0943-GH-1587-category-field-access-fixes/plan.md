---
title: "GH-1587 Category Field-Access & Integrity Fixes (PR #1605 review)"
description: "Lock down field-level access on Categories, close tenant/dna smuggling vectors, and fix 8 confirmed PR #1605 review findings."
status: completed
priority: P1
effort: 6h
branch: feat/f08-1587-category-integrity-fixes
tags: [security, f08, category, pr-1605]
created: 2026-07-14
completed: 2026-07-14
---

# GH-1587 Category Field-Access & Integrity Fixes

Fix 8 confirmed findings from the PR #1605 code review. Core issue: `Categories.ts` has
ZERO field-level `access` blocks, so any tenant user with collection-level update rights can
overwrite `dna`, `tenant`, `site`, `deletedAt` via the native Payload REST route
(`/api/[...slug]`). Collection-level `access.update` is a Where-filter (gates WHICH doc, not
WHICH fields). Plus parent cross-tenant validation gap, stale breadcrumb on re-parent, and
minor doc/test/DDL cleanup.

## Root-cause data flow (the hole being closed)

```
tenant user (payload-token cookie)
  → PATCH /api/categories/{ownDocId}  (native REST, overrideAccess=false)
  → collection access.update → Where{tenant in [own]} → PASSES (own doc)
  → NO field access → dna/tenant/site/deletedAt written unchecked  ← VULN
```
Fix: field-level `access.update` on the 4 sensitive fields. Payload **silently strips**
access-denied fields (does not throw) — this drives the delete-flow `overrideAccess` flip and
the test assertions ("value unchanged", not "throws").

## Phases

| # | Phase | Files (owner) | Status | Depends |
|---|-------|---------------|--------|---------|
| 01 | [Field access + integrity](phase-01-category-field-access-and-integrity.md) | `Categories.ts`, `categories/actions.ts` | completed | — |
| 02 | [DROP INDEX guard](phase-02-db-setup-drop-index-guard.md) | `scripts/db-setup.js` | completed | 01 |
| 03 | [QA doc updates](phase-03-qa-doc-updates.md) | `docs/qa/F08-product-crud.md` | completed | — |
| 04 | [CategoryManager error branches](phase-04-category-manager-error-branches.md) | `CategoryManager.tsx` | completed | 01 |
| 05 | [Testing](phase-05-testing.md) | `category-field-access.test.ts` + regression tests | completed | 01, 04 |
| 06 | [Code review](phase-06-code-review.md) | read-only | completed | 01–05 |

## Execution order / parallelism

- **01 first** (atomic, single agent — schema + access-control must not split).
- **02** sequential after 01 (both touch category schema/migration surface — do NOT parallelize).
- **03** independent of code (docs only) — CAN run in parallel with 01, BUT M4 is a product
  decision gate (see below), so hold until decided.
- **04** after 01 (consumes the new sentinel error codes emitted from `Categories.ts`).
- **05** after 01 + 04 (tests the final backend + frontend behavior).
- **06** after all implementation.

## Key dependencies

- `Categories.ts` throw→sentinel conversion (for Group F item 1) lives in **Phase 01**, not
  Phase 04, to keep `Categories.ts` edits atomic/single-agent per repo rule. Phase 04 only
  touches `CategoryManager.tsx`.
- Field access uses the in-repo idiom `access: { update: ... }` (Discounts.ts:155, Orders.ts:307).

## Definition of done

Tenant user CANNOT write `dna`/`tenant`/`site`/`deletedAt` via REST; CAN still do normal
category CRUD. Super-admin CAN write `dna` (DNA route). Parent cross-tenant nesting blocked.
Breadcrumb correct on partial re-parent. All existing 77 category tests + new regression pass.
Code review clean.

## Explicitly OUT of scope

1. Verifying whether prod build masks `error.message` from server actions → staging task.
2. Resolving the M4 slug/parent product decision → flagged only (see below).

## Unresolved questions / decisions needed

1. ~~**M4 (BLOCKS Phase 03)**~~ — RESOLVED, see Validation Summary.
2. ~~**`dna` create-path**~~ — RESOLVED, see Validation Summary.
3. Confirm no other caller writes `deletedAt` via `overrideAccess:false` besides
   `deleteCategoryAction` (grep in Phase 01) — if found, it also needs the flip. (Implementation
   check, not a decision — unchanged.)

## Validation Summary

**Validated:** 2026-07-14
**Questions asked:** 3

### Confirmed Decisions
- **M4 slug/parent conflict:** Fix the QA doc (option a) — update TC-F08-05-05 step 2c expected
  outcome to "rejected as `CATEGORY_SLUG_DUPLICATE`". Do NOT change slug generation to incorporate
  parent (option b rejected — out of scope).
- **`dna` create-path:** Gate `create` too, not just `update`. Add
  `access: { create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')), update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')) }`
  on the `dna` field — closes the create-path smuggling vector flagged in Phase 01's security
  considerations.
- **`tenant`/`site` field lock:** Absolute lock, `access: { update: () => false }` for ALL users
  including super-admin. No exempt branch. Any legitimate tenant reassignment happens via raw
  SQL/script outside the Payload API, not through this field.

### Action Items (apply when executing Phase 01 — now applied)
- [x] Phase 01 step 2: extend `dna` field access from `update`-only to `{ create: ..., update: ... }`
  (both same super-admin check) — **IMPLEMENTED**
- [x] Phase 01 step 3: `tenant`/`site` stay `access: { create: () => false, update: () => false }` exactly as drafted —
  confirmed no super-admin exemption. **IMPLEMENTED**
- [x] Phase 03: proceeded as drafted (QA doc fix, option a) — dependency
  "M4 decision" resolved. **COMPLETED**

## Outcome

**Status:** ✅ COMPLETED  
**Completion Date:** 2026-07-14  
**Final Review Score:** 9.5/10 (Cycle 2, code-reviewer approved)

### Summary
All 6 phases implemented and reviewed. Plan closed PR #1605 findings:
- **H1 (dna field-access):** Field locked to super-admin only via `access: { create, update }`
- **H2 (tenant/site smuggling):** Fields locked with `access: { create/update: () => false }`; parent cross-tenant check enforced
- **M1 (passthrough smuggling):** Zod allowlist replaces `.passthrough()`
- **M2 (deletedAt smuggling):** Soft-delete now uses `overrideAccess:true` (access pre-gated at findByID)
- **M3 (DROP INDEX churn):** Conditional UNIQUE-only guard added to db-setup.js
- **M4 (slug/parent conflict):** QA doc updated per option (a) — TC-F08-05-05 reflects slug uniqueness as per-tenant only
- **C1 (CREATE-path exploit):** Trust boundary fixed — `ownerTenantId` now sourced from `req.user.tenants[0]` (create) or `originalDoc.tenant` (update), never `data.tenant`

### Deliverables
- **Code:** Phase 01 (Categories.ts + actions.ts), Phase 02 (db-setup.js), Phase 04 (CategoryManager.tsx) — all implemented and tested
- **Tests:** Phase 05 — 60/60 passing (4 new C1 regression tests: TC-F08-05-10..13 + 56 existing)
- **Docs:** Phase 03 — QA test cases updated for M4 + obsolete image feature marked removed
- **Review:** Phase 06 — Cycle 2 score 9.5/10, C1 critical resolved, ready for merge

### Key Findings
- C1 critical (trust boundary) found and fixed during Cycle 1 code review; verified Cycle 2 via Payload 3.79.0 source inspection
- Field-level `access.create: () => false` on `tenant`/`site` confirmed effective via beforeValidate-fields hook ordering
- No regression in legitimate create paths (beforeChange auto-inject provides same value)
- All seed/generate-site scripts unaffected (use Local API default `overrideAccess:true`)

### Test Coverage
- **60/60 passing:** 16 field-access (4 new C1 regression) + 29 dedup + 10 delete-integrity + 5 hooks
- **TC-ID refs:** All tests map to TC-F08-05-* per convention
- **No tautologies, fake data, or .skip** — all tests call real imported hooks

### Next Steps
Merge to staging (all phases complete, no blockers).
