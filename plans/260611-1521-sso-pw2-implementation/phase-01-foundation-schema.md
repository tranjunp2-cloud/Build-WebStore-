---
title: "Phase 01 — Foundation Schema"
effort: 1h
status: pending
dependsOn: []
blocks: [phase-02, phase-03]
sourceplan: plans/260604-1103-sso-pw2-foundation/phase-03-pw2-schema.md
---

# Phase 01 — Foundation Schema

## Overview

Thêm `migrationStatus` + `customerIdNumber` vào schema PW2. Đây là prerequisite cho hầu hết các phase còn lại (except phase-04, phase-05).

**Key finding từ audit:** `Tenants.ts` line 204 đã có `status: 'suspended'` — không cần migration cho ban/unban. Chỉ cần thêm các fields dưới đây.

## Files to Modify

| File | Change |
|------|--------|
| `src/collections/Users.ts` | Add `migrationStatus` (select) + `customerIdNumber` (text) |
| `src/collections/Tenants.ts` | Add `migrationStatus` (select) |
| `scripts/db-setup.js` | Add migration entries (CI hard-gate) |

## Schema Additions

### `src/collections/Tenants.ts`

```typescript
{
    name: 'migrationStatus',
    type: 'select',
    defaultValue: 'migrated',
    options: [
        { label: 'Migrated', value: 'migrated' },
        { label: 'Pending', value: 'pending' },
        { label: 'Failed', value: 'failed' },
    ],
    admin: { description: 'Migration status from legacy SSO system' },
},
```

**SKIP:** `limits` group (ADR-01 — dùng `PlanFeatures.canUse()`), `subscriptionHistory` (non-goal sprint này).

### `src/collections/Users.ts`

```typescript
{
    name: 'migrationStatus',
    type: 'select',
    defaultValue: 'migrated',
    options: [
        { label: 'Migrated', value: 'migrated' },
        { label: 'Pending', value: 'pending' },
        { label: 'Failed', value: 'failed' },
    ],
    admin: { description: 'Migration status from legacy SSO system', position: 'sidebar' },
},
{
    name: 'customerIdNumber',
    type: 'text',
    admin: { description: 'TM customer ID — composite key với email' },
},
```

`customerIdNumber` là PII — `access` hooks của Payload đã cover (admin-only access).

### `scripts/db-setup.js` MIGRATIONS array

Thêm entries cho cả 3 fields mới. Dùng `CREATE TABLE IF NOT EXISTS` pattern (NEVER DROP TABLE).

## Implementation Steps

1. Read `src/collections/Tenants.ts` — xác nhận vị trí thêm field, confirm `status` field đã có `'suspended'`
2. Read `src/collections/Users.ts` — xác nhận `migrationStatus` và `customerIdNumber` chưa tồn tại
3. Add `migrationStatus` vào `Tenants.ts` nếu chưa có
4. Add `migrationStatus` + `customerIdNumber` vào `Users.ts` nếu chưa có
5. Read `scripts/db-setup.js` — thêm migration entries cho 3 fields mới vào `MIGRATIONS` array
6. Run `pnpm tsc --noEmit` — fix TypeScript errors
7. Run `pnpm payload migrate:create` — generate SQL migration
8. Review migration file output

## Todo

- [ ] Read `Tenants.ts` — confirm `status.suspended` tồn tại, list current fields
- [ ] Read `Users.ts` — confirm `migrationStatus`/`customerIdNumber` chưa có
- [ ] Add `migrationStatus` to `Tenants.ts`
- [ ] Add `migrationStatus` + `customerIdNumber` to `Users.ts`
- [ ] Update `scripts/db-setup.js` MIGRATIONS array (CI hard-gate)
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm payload migrate:create` — review generated migration

## Success Criteria

- TypeScript compile clean
- `scripts/check-migrations.js` passes (CI hard-gate)
- Migration applies without error
- Existing records unaffected (all new fields have defaults)
