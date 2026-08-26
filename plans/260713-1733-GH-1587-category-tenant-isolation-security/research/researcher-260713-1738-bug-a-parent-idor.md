# Research: Cross-Tenant IDOR in Categories.ts Parent Lookup

**Confirmed Bug:** `beforeValidate` + `beforeChange` hooks fetch candidate parent categories with NO tenant scoping, allowing non-super-admin users to set a category parent to another tenant's category ID.

## Hook Execution Order (Finding #3)

**Payload CMS 3 order:** `beforeValidate` → `beforeChange` → persist → `afterChange`

**CREATE:** `data.tenant` NOT SET when `beforeValidate` runs; auto-injected by `beforeChange` (line 113-116).
**UPDATE:** `originalDoc.tenant` IS AVAILABLE in `beforeValidate` (passed as hook arg); not modified in `beforeChange`.

**Impact:** For CREATE, must use `originalDoc` context or defer tenant check to `beforeChange`. For UPDATE, can safely check `originalDoc.tenant` in `beforeValidate`.

---

## Reusable Pattern (Finding #2)

**Existing pattern in `deleteCategoryAction` (line 218-222):**
```typescript
await payload.findByID({
    collection: 'categories',
    id,
    user,
    overrideAccess: false,
})
```

**NOT found in hooks elsewhere in codebase** (Products.ts, Tenants.ts, other collections). This is intentional: hooks run in full-access context (`req.payload` defaults `overrideAccess: true`). Passing `user` + `overrideAccess: false` inside a hook is non-standard and contradicts Payload's hook-as-internal-operation model.

**Better approach for hooks:** Use compound WHERE clause + `req.user.tenants` extraction, since `req.user` IS available in hooks.

---

## Recommended Fix (Finding #4)

**Option A (Preferred — compound WHERE + overrideAccess:true):**
```typescript
// In beforeValidate, line 93-96, replace:
const candidateDoc = await req.payload.findByID({
    collection: 'categories',
    id: candidateId,
});

// With:
const tenantIds = req.user?.tenants?.map((t: any) => 
    typeof t.tenant === 'object' ? t.tenant.id : t.tenant
) ?? [];
if (!tenantIds.length) {
    throw new Error('Bạn không có quyền thao tác danh mục');
}
const result = await req.payload.find({
    collection: 'categories',
    where: { 
        id: { equals: candidateId },
        tenant: { in: tenantIds }
    },
    limit: 1,
});
const candidateDoc = result.docs[0];
if (!candidateDoc) {
    throw new Error('Danh mục cha không hợp lệ hoặc thuộc nhóm khác');
}
```

**For beforeChange (line 137-140):** Apply same compound WHERE pattern before accessing breadcrumbs.

**Rationale:** Hooks have `req.user` available. Extracting tenant IDs from `req.user.tenants` is the established pattern in this codebase (see Categories.ts access rules, line 33-37). Using `{tenant: {in: tenantIds}}` is a native Payload WHERE clause, familiar to team.

---

## Error Message i18n (Finding #5)

**Current pattern in same hook (line 90):**
```typescript
throw new Error('Không thể đặt danh mục làm cha của chính nó hoặc của danh mục con/cháu của nó');
```

**Suggested new error (Vietnamese, consistent with existing):**
```typescript
throw new Error('Danh mục cha không hợp lệ hoặc thuộc nhóm khác');
// (Parent category is invalid or belongs to a different group)
```

**No i18n.json update needed:** Errors thrown from hooks are caught by server actions (`saveCategoryAction`), which display them via `toast.error(message)` in UI (CategoryManager.tsx line 317). The UI does NOT map hook error strings to i18n keys — it shows the raw Error message. Existing cycle + depth errors also use raw Vietnamese strings, not i18n lookups.

**Alternative:** If team prefers i18n in future, use an error code (e.g., `throw new Error('CATEGORY_PARENT_WRONG_TENANT')`) and map in CategoryManager.tsx at line 310 (alongside `CATEGORY_NAME_DUPLICATE` handler).

---

## Client-Side Dropdown (Finding #6)

**Status:** No separate fix needed.

**Reason:** `parentOptions` built from `categories` state (CategoryManager.tsx line 227-235), which is populated via `getCategoriesAction()`. That action already calls `payload.find(..., overrideAccess: false, user)` (actions.ts line 20-27), so `categories` array contains ONLY current user's tenant categories. Dropdown naturally never offers cross-tenant options.

**Proof:** If user A (tenant X) and user B (tenant Y) both build the dropdown, user A's `categories` array contains only tenant X categories, user B's only tenant Y — even if another tenant's category ID were somehow in the form state, it wouldn't appear in the dropdown's `parentOptions` filter (line 229 checks `categories` array, which is tenant-scoped).

---

## Unresolved Questions

1. Should super-admin be allowed to cross-tenant parent (i.e., set tenant-X category's parent to tenant-Y category)? Assume **NO** — each category stays within its tenant namespace, even for super-admin. Confirm in Phase 02 implementation if needed.

2. Does the compound WHERE `{id: {equals:X}, tenant:{in:Y}}` return an empty array (no match) or throw an error when X exists but tenant mismatch? Payload behavior: returns empty array (safe for our use case). Confirm by quick local test before commit.

3. Should `beforeChange` receive the tenant value for UPDATE operations, or is skipping tenant-check in `beforeChange` for update safe (only `beforeValidate` checks)? Current approach: `beforeChange` doesn't validate tenant on update, only `beforeValidate` does. This is safe because access control layer already gates whether the update is allowed.

