---
title: "Phase 06 — Audit Trail (createdBy / updatedBy)"
effort: 0.5h
status: done
dependsOn: [phase-01]
blocks: []
---

# Phase 06 — Audit Trail (createdBy / updatedBy)

## Overview

Thêm `createdBy` và `updatedBy` vào Users collection để track nguồn tạo/cập nhật user — parity với PW1 `created_by`/`updated_by` columns.

**Lý do:** Nhiều nguồn tạo user (SSO provision API, invite-staff, super-admin tay) → cần audit trail để trace origin.

**Approach:** `beforeChange` hook tự động set từ `req.user` — không cần caller set thủ công.

## Files to Modify

| File | Change |
|------|--------|
| `src/collections/Users.ts` | Thêm `createdBy` + `updatedBy` fields + `beforeChange` hook |
| `scripts/db-setup.js` | Thêm 2 migration entries (`created_by_id`, `updated_by_id`) |

## Schema Additions — `src/collections/Users.ts`

### Fields (thêm vào `fields` array, sau `customerIdNumber`)

```typescript
{
    name: 'createdBy',
    type: 'relationship',
    relationTo: 'users',
    admin: {
        hidden: true,
        description: 'User who created this record (audit trail)',
    },
    access: {
        update: () => false, // readonly after creation
    },
},
{
    name: 'updatedBy',
    type: 'relationship',
    relationTo: 'users',
    admin: {
        hidden: true,
        description: 'User who last updated this record (audit trail)',
    },
},
```

### beforeChange hook (thêm vào `hooks.beforeChange` array)

```typescript
const setAuditFields: CollectionBeforeChangeHook = ({ data, operation, req }) => {
    const callerId = req.user?.id ?? null
    if (!callerId) return data

    if (operation === 'create') {
        data.createdBy = callerId
    }
    data.updatedBy = callerId
    return data
}
```

Thêm vào `hooks`:
```typescript
hooks: {
    beforeChange: [setAuditFields],
    afterChange: [sendWelcomeEmailHook],
},
```

## Migration — `scripts/db-setup.js`

Thêm 2 entries vào `MIGRATIONS` array (sau entries của Phase 01):

```javascript
{
    name: 'users.add_created_by_id',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_id integer;`,
},
{
    name: 'users.add_updated_by_id',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by_id integer;`,
},
```

**Convention:** Payload tự map `createdBy` → `created_by_id` (relationship field → `{field}_id integer`).

## Implementation Steps

1. Read `src/collections/Users.ts` — xác nhận vị trí chèn fields + import `CollectionBeforeChangeHook`
2. Add `setAuditFields` hook function (sau `sendWelcomeEmailHook`)
3. Add `createdBy` + `updatedBy` fields vào `fields` array
4. Update `hooks` object: thêm `beforeChange: [setAuditFields]`
5. Read `scripts/db-setup.js` — thêm 2 migration entries vào `MIGRATIONS` array
6. Run `npx tsc --noEmit` — confirm no type errors

## Todo

- [ ] Read `Users.ts` — confirm `CollectionBeforeChangeHook` đã import chưa, locate insertion points
- [ ] Add `setAuditFields` hook
- [ ] Add `createdBy` + `updatedBy` fields
- [ ] Update `hooks` object (add `beforeChange`)
- [ ] Add 2 migration entries vào `scripts/db-setup.js`
- [ ] `npx tsc --noEmit` passes

## Success Criteria

- TypeScript compile clean
- `scripts/check-migrations.js` passes
- `createdBy` không thể update sau khi tạo (access.update = false)
- `updatedBy` auto-set mỗi lần save khi `req.user` có giá trị
- Existing user records không bị ảnh hưởng (fields nullable, không có default)

## Risk Assessment

- **Low risk:** Fields nullable → no impact on existing records
- **Edge case:** Operations với `overrideAccess: true` (provision, invite-staff) vẫn có `req.user` = SSO service user → `createdBy` = SSO user ID ✓
- **Edge case:** Nếu `req.user` null (system ops không có auth) → skip, không set field → intentional

## Security Considerations

- Fields hidden trong admin UI (`admin.hidden: true`) — không expose ra UI
- `createdBy` readonly sau creation (`access.update: () => false`)
- Chỉ track user ID, không store sensitive data
