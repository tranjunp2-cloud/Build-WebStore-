# IDOR Bug Fix Research: Cross-Tenant Parent Category Reference

**Bug**: `Categories.ts` hooks (`beforeValidate` ancestor-walk, `beforeChange` breadcrumb-gen) call `findByID()` without `user`/`overrideAccess` args, bypassing tenant isolation. Non-admin can set a category's parent to another tenant's category ID, leaking the other tenant's breadcrumb into their own data.

---

## 1. Hook Execution Order (CRITICAL)

**Payload CMS 3 standard order:**
1. `beforeValidate` — runs BEFORE data validation
2. `beforeChange` — runs AFTER validation, BEFORE persistence
3. `afterChange` — runs AFTER persistence

**Tenant value availability:**
- **CREATE**: `data.tenant` is **NOT YET SET** in `beforeValidate` (injected in line 113-116 of `beforeChange`). Access via `req.user.tenants[0]` instead.
- **UPDATE**: `originalDoc.tenant` **IS AVAILABLE** in `beforeValidate` (the existing persisted doc, retrieved before hook runs). Use this as source-of-truth.

---

## 2. Reusable Pattern — NOT Found in Hooks

**deleteCategoryAction pattern** (`actions.ts:218–223`):
```typescript
await payload.findByID({
    collection: 'categories',
    id,
    user,
    overrideAccess: false,
})
```

**Finding**: This `user` + `overrideAccess: false` pattern is NOT used in any collection hooks in the codebase (grep: zero matches). Hooks don't pass `user` to their internal Payload queries. **Solution: Use compound WHERE instead.**

---

## 3. Recommended Fix Approach

**For both `beforeValidate` (ancestor-walk) and `beforeChange` (breadcrumb-lookup):**

Replace each `findByID()` with `find({where: {id: {equals: X}, tenant: {equals: Y}}})`:

```typescript
// Get tenant value
const tenantId = operation === 'update' 
    ? originalDoc?.tenant 
    : (typeof req.user?.tenants?.[0]?.tenant === 'object'
        ? req.user.tenants[0].tenant.id
        : req.user.tenants?.[0]?.tenant);

if (!tenantId) {
    // CREATE with no tenant resolved — should not happen post-auto-inject,
    // but fail safe to avoid letting unscoped queries run
    throw new Error('Không thể xác định thương hiệu (tenant) của danh mục');
}

// Tenant-scoped lookup
const candidateDoc = await req.payload.find({
    collection: 'categories',
    where: {
        id: { equals: candidateId },
        tenant: { equals: tenantId }
    },
    limit: 1,
    depth: 0
});

if (candidateDoc.docs.length === 0) {
    // Treat as "not found" — catches cross-tenant references
    throw new Error('Không thể đặt danh mục làm cha của chính nó hoặc của danh mục con/cháu của nó');
}
const candidateDoc = candidateDoc.docs[0];
```

**Rationale:**
- No need for `user` arg (compound WHERE is explicit tenant gate).
- `overrideAccess: true` (hooks are internal, no user trust issue).
- `limit: 1, depth: 0` (ancestor-walk only needs id+tenant, not full populate).
- Empty result = cross-tenant ref = validation error (mimics "not found" UX).

---

## 4. Error Message & i18n

**Existing pattern** (`Categories.ts:90, 103`):
- Inline Vietnamese strings thrown as `Error()`
- Client catches `.message` and displays via toast
- Example: `'Không thể đặt danh mục làm cha của chính nó hoặc của danh mục con/cháu của nó'`

**New error for cross-tenant parent:**
```typescript
throw new Error('Không thể đặt danh mục khác thương hiệu làm cha');
// Or more verbose: 'Danh mục cha phải thuộc cùng thương hiệu'
```

**No i18n lookup required:** Vietnamese strings are hard-coded in hooks; English users see Vietnamese errors (non-critical, hooks rarely execute on public APIs). Frontend `CategoryManager.tsx` (line 309–317) has error-message mapping logic but only for known codes (`CATEGORY_NAME_DUPLICATE`, `CATEGORY_SLUG_DUPLICATE`). New `Error()` from hook will fall through to line 317: generic toast.

**Recommendation:** Keep Vietnamese string in hook for consistency; if multi-lang support needed later, refactor all hook errors to use error codes + i18n lookup in client.

---

## 5. Client-Side Dropdown — NO SEPARATE FIX NEEDED

**Analysis:**
- `parentOptions` built from `categories` array (line 227–235)
- `categories` fetched via `getCategoriesAction()` with `overrideAccess: false` (actions.ts:26)
- Categories.ts `read` access (line 37) returns `{ tenant: { in: tenantIds } }`
- **Result**: Only current user's tenant categories are in the array; dropdown naturally only offers same-tenant parents

**Conclusion:** Client-side data source is already tenant-scoped. No dropdown filter needed.

---

## 6. Implementation Checklist

- [ ] **beforeValidate**: Replace `findByID()` loop (line 93–96) with tenant-scoped `find()`.
- [ ] **beforeValidate**: Extract `tenantId` from `originalDoc.tenant` (UPDATE) or `req.user.tenants` (CREATE); throw if unresolvable.
- [ ] **beforeChange**: Replace `findByID()` (line 137–140) for breadcrumb-lookup with tenant-scoped `find()`.
- [ ] **beforeChange**: Reuse same tenant extraction; propagate to breadcrumb lookup.
- [ ] **Error message**: Use Vietnamese string matching existing hook error style.
- [ ] **Test**: Verify cross-tenant parent set via `payload.update()` is rejected; existing tenant parent succeeds.

---

## Unresolved Questions

1. **Does `operation === 'update' ? originalDoc?.tenant : data.tenant` safely cover both flows?** Current code extracts tenant AFTER auto-inject happens, but beforeValidate runs BEFORE it. Confirm that extracting from `req.user.tenants[0]` is the right fallback for CREATE on line 113–116 timing.

2. **Should `payload.find()` with empty result be an error, or silently treat as "not found" and skip breadcrumb?** Current fix throws error (matches cycle prevention). Confirm this is desired UX (user sees error) vs. silently orphaning breadcrumb (rare edge case).

3. **Does the "no i18n lookup in hooks" conclusion hold for future multi-language support?** If Vietnamese errors are a planned localization debt, consider refactoring now or document as tech-debt.
