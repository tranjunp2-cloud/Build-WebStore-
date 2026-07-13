# Phase 04 — Dedup Name + Slug Scope (#14)

**PR:** 1 · **Migration:** No (app-layer; DB index from Phase 01) · **Priority:** P1 · **Status:** pending · **Depends:** Phase 01

## Context

- `Categories.ts` slug field (`:161-166`) has `unique: true` (global). Phase 01 replaces the DB constraint with per-tenant composite; THIS phase removes `unique: true` from the field so Payload stops re-creating the global index.
- No current dedup on **name**. Two categories can share a name in the same level/tenant.
- Save path: `CategoryManager.tsx handleSave` (`:216-253`) → `saveCategoryAction` (`actions.ts:76-104`).

## Overview

Two dedup rules, both **tenant-scoped**:
1. **Slug** unique per tenant — enforced at DB (Phase 01) + friendly app-layer error (catch DB unique violation OR pre-check).
2. **Name** unique per `(parent, tenant)` — app-layer validation in backend (hook/action) + client async check showing inline red error.

## Key Insights

- **Field edit is load-bearing for Phase 01**: remove `unique: true` (keep `index: true`) from slug field, else Payload's pushDevSchema re-adds the global unique index, defeating the migration. Ship in same PR-1.
- Name uniqueness scope = `(parent, tenant)` = "same level under same parent". Top-level nodes compared against other top-level (`parent IS NULL`) in the tenant.
- **Name compare is case-insensitive + trimmed. [CONFIRMED by user 2026-07-10.]** "Áo" ≡ "áo" ≡ " Áo " collide. Backend query compares `lower(trim(name))`; trim the stored value on save too (so " Áo " is persisted as "Áo").
- Backend is the source of truth (hook or action). Client async check is UX polish only — must tolerate races (two rapid submits) because backend + DB still guard.
- Slug per-tenant: rely on DB unique index (Phase 01) as the hard guard; translate the Postgres unique-violation error into a friendly message in `saveCategoryAction` catch. Optionally pre-check for nicer UX, but DB is authoritative.

## Requirements

- Functional:
  - Creating/updating a category whose (name, parent, tenant) matches an existing active category (excluding self on update) → rejected, inline error "Category name already exists in this level."
  - Duplicate slug within tenant → rejected with friendly message (DB-enforced).
- i18n: `nameDuplicateError`, `slugDuplicateError` EN + MS.

## Architecture / Data Flow

```
saveCategoryAction(data, id):
  resolve tenantId (from user, same logic as Categories beforeChange)
  // name dedup
  existing = payload.find categories where
      name == data.name AND parent == (data.parent ?? null) AND tenant == tenantId
      AND deletedAt exists:false AND id != id
  if existing.docs.length > 0: throw 'CATEGORY_NAME_DUPLICATE'
  try create/update
  catch pgUniqueViolation(categories_tenant_slug_uniq): throw 'CATEGORY_SLUG_DUPLICATE'
```

Client async name-check: on name blur / debounced change, call a lightweight server action `checkCategoryNameAvailable(name, parentId, excludeId)` → show inline red error, disable save.

## Related Code Files

**Modify:**
- `src/collections/Categories.ts` — remove `unique: true` from slug field (`:163`), keep `index: true`. (Coordinates with Phase 01.) **Also remove the unused `image` upload field (`:189-194`)** — YAGNI decision 2026-07-12 (stored but never displayed). Migration to drop `image_id` column is in Phase 01.
- `src/app/(dashboard)/products/categories/actions.ts` — in `saveCategoryAction`: add name-dedup pre-check query (scoped parent+tenant, exclude self); wrap create/update in try/catch to map Postgres unique-violation (code `23505`, constraint `categories_tenant_slug_uniq`) → structured `CATEGORY_SLUG_DUPLICATE`. Add exported `checkCategoryNameAvailable(...)` server action for the async client check.
- `src/app/(dashboard)/products/categories/components/CategoryManager.tsx` — `handleSave` (`:216-253`): map thrown `CATEGORY_NAME_DUPLICATE`/`CATEGORY_SLUG_DUPLICATE` to inline errors; add debounced async name check state on the Name `<Input>` (`:528-541`) rendering red helper text `nameDuplicateError`.
- `src/i18n/locales/en.json` / `ms.json` — `dashboard.products.categories.form.errors`: `nameDuplicate` = "Category name already exists in this level.", `slugDuplicate` = "This URL slug is already used in your store."

**Read for context:** `Categories.ts:95-135` (tenant resolution in beforeChange), `actions.ts:76-104`.

**No migration (Phase 01 owns the index), no delete.**

## Implementation Steps

1. Remove `unique: true` from slug field; keep `index: true`. Confirm with Phase 01 owner (same PR).
2. In `saveCategoryAction`, resolve tenantId (mirror `beforeChange` tenant logic, or query current user's first tenant).
3. Name pre-check query (**case-insensitive + trimmed**): compare `lower(trim(name))` against the trimmed input. Payload `where` has no `lower()`, so either (a) use `name: { like: <trimmed> }` then filter exact-ci in JS, or (b) run a small Drizzle raw query `WHERE lower(trim(name)) = lower(trim($1)) AND tenant_id=$t AND (parent_id=$p OR ($p IS NULL AND parent_id IS NULL)) AND deleted_at IS NULL AND id <> $id` (preferred — exact + ci at DB). Scope `(parent, tenant)`. If found → throw `new Error('CATEGORY_NAME_DUPLICATE')`. Also **trim `data.name` before persist**.
4. Wrap `payload.create/update` in try/catch; detect unique violation (`err?.cause?.code === '23505'` or message includes `categories_tenant_slug_uniq`) → throw `CATEGORY_SLUG_DUPLICATE`.
5. Add `checkCategoryNameAvailable(name, parentId, excludeId)` server action (thin wrapper over the step-3 query returning boolean).
6. Client: debounce name input (~400ms), call check, store `nameError`; disable Save while error present. Map save-time thrown errors to toast + inline.
7. i18n keys EN + MS.

## Todo

- [ ] Remove `unique:true` from slug field (keep index) — coordinate w/ Phase 01
- [ ] tenantId resolution in `saveCategoryAction`
- [ ] Name pre-check query (parent+tenant scoped, exclude self)
- [ ] Map Postgres 23505 slug violation → friendly error
- [ ] `checkCategoryNameAvailable` server action
- [ ] Client debounced async name check + inline red error
- [ ] i18n `nameDuplicate` + `slugDuplicate` EN + MS

## Success Criteria

- Two active categories with same name under same parent in same tenant → blocked (backend), inline red error shown before submit. **Case/whitespace variants ("áo", " Áo ") also collide.**
- Same name allowed under a different parent, or in a different tenant.
- Duplicate slug within tenant → blocked with friendly message; same slug across tenants → allowed (verifies Phase 01).
- Update keeping own name/slug unchanged → allowed (self excluded).

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Async name check race (two fast submits) | Med×Low | DB unique (slug) + backend pre-check (name) are authoritative; client check is UX only |
| Phase 01 not landed → 23505 catch never fires / global index still there | Med×High | Same PR; test both together |
| Name compare case/whitespace mismatch ("Áo " vs "Áo") | Med×Med | **Decided: case-insensitive + trim** (`lower(trim())`); trim on persist. Documented in QA Phase 06 |
| parent null comparison in query | Med×Med | Use `{exists:false}` for null parent branch explicitly |

## Security

- All queries `overrideAccess:false` / user-scoped → tenant isolation preserved. Per-tenant slug uniqueness prevents cross-tenant enumeration.

## Next Steps

- Phase 06 updates QA TC-05-05 / TC-05-12 (dedup per tenant). Phase 07 unit-tests dedup logic.
