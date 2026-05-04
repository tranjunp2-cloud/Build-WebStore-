# Phase 01: Add `generationStatus` Field + Migration

> Parent: [plan.md](plan.md)

## Overview

- **Priority:** P0
- **Status:** done
- **Effort:** 30m

## Context

Sites collection hiện có `status` field (draft/published/archived) — đây là lifecycle status, không phải generation status. Cần field riêng để track AI generation state.

## Key Insights

- Sites collection dùng Payload CMS schema → field define ở `src/collections/Sites.ts`
- DB migration bắt buộc qua `scripts/db-setup.js` (CLAUDE.md rule)
- Naming convention: column name = field name, snake_case trong DB
- Tất cả site hiện tại đều generate thành công → default migration value = `completed`

## Related Files

- `src/collections/Sites.ts` — schema definition
- `scripts/db-setup.js` — migration executor

## Implementation Steps

### Step 1: Add field to Sites.ts

Thêm `generationStatus` select field vào Sites collection, đặt sau field `status`:

```typescript
{
  name: 'generationStatus',
  type: 'select',
  defaultValue: 'none',
  admin: {
    position: 'sidebar',
    readOnly: true,
  },
  options: [
    { label: 'None', value: 'none' },
    { label: 'Generating', value: 'generating' },
    { label: 'Completed', value: 'completed' },
    { label: 'Failed', value: 'failed' },
  ],
},
```

**Notes:**
- `readOnly: true` — chỉ system set, user không edit
- `defaultValue: 'none'` — cho site tạo manual (không qua AI)
- `admin.position: 'sidebar'` — không chiếm main content area

### Step 2: Add migration to db-setup.js

```javascript
{
  name: 'sites.generation_status',
  sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS generation_status varchar DEFAULT 'none';
        UPDATE sites SET generation_status = 'completed' WHERE generation_status = 'none' OR generation_status IS NULL;`,
},
```

**Notes:**
- `IF NOT EXISTS` — safe re-run
- Backfill existing sites → `completed` (tất cả đều đã generate thành công)

## Success Criteria

- [ ] Field hiện trong Payload admin panel (sidebar, readonly)
- [ ] Migration chạy không lỗi: `node scripts/db-setup.js`
- [ ] Existing sites có `generation_status = 'completed'`
- [ ] `scripts/check-migrations.js origin/staging` pass

## Risk Assessment

- **Low risk** — chỉ thêm column mới, không đụng data cũ
- Backfill UPDATE chạy 1 lần, idempotent
