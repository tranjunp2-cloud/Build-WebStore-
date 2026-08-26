---
title: "Phase 04 — Subscription Endpoints + ETL Corrections"
effort: 2.5h
status: pending
dependsOn: [F34/#1187-merged]
blocks: []
sourceplan: |
  plans/260604-1103-sync-subscription/phase-04-pw2-renew-endpoint.md
  plans/260604-1103-sync-subscription/phase-05-pw2-etl-corrections.md
---

# Phase 04 — Subscription Endpoints + ETL Corrections

## Overview

3 tasks độc lập nhau, có thể làm song song:
- **4a:** Tạo `PUT /api/v1/sso/renew` endpoint
- **4b:** Fix auth bug trong `upgrade/route.ts` và `downgrade/route.ts`
- **4c:** ETL corrections trong `scripts/migrate-pw1-subscriptions.js`

---

## 4a — `PUT /api/v1/sso/renew`

**File:** `src/app/api/v1/sso/renew/route.ts` — CREATE

**Behavior:** Chỉ update `endsAt` của 'main' PlanSubscription — **không đổi plan code**.

**Key constraints:**
- Renew chỉ update `tenants[0]` — intentional MVP scope (multi-tenant deferred)
- Trả 404 nếu không tìm thấy 'main' subscription — không tạo mới
- SSO gửi MySQL format `'YYYY-MM-DD HH:MM:SS'` → normalize trước: `.replace(' ', 'T').split('T')[0]`
- `T23:59:59Z` với Z suffix (UTC) tránh UTC+7 offset làm sai ngày 7 giờ

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

export async function PUT(req: NextRequest) {
    try {
        const payload = await getPayload({ config })
        // [3-guard auth]
        const { email, expired_at } = await req.json()
        if (!email || !expired_at) {
            return NextResponse.json({ message: 'email and expired_at are required' }, { status: 400 })
        }

        const users = await payload.find({
            collection: 'users',
            where: { email: { equals: email } },
            limit: 1, depth: 1,
        })
        if (!users.docs.length) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 })
        }

        const user = users.docs[0]
        const tenantEntry = user.tenants?.[0]?.tenant
        const tenantId = typeof tenantEntry === 'string' ? tenantEntry : (tenantEntry as { id: string })?.id
        if (!tenantId) {
            return NextResponse.json({ message: 'User has no tenant' }, { status: 404 })
        }

        const subs = await payload.find({
            collection: 'plan-subscriptions',
            where: { and: [{ tenant: { equals: tenantId } }, { name: { equals: 'main' } }] },
            limit: 1,
        })
        if (!subs.docs.length) {
            return NextResponse.json({ message: 'Subscription not found' }, { status: 404 })
        }

        // SSO MySQL format → normalize → UTC endOfDay
        const dateOnly = expired_at.replace(' ', 'T').split('T')[0]
        const endsAt = new Date(`${dateOnly}T23:59:59Z`).toISOString()

        await payload.update({
            collection: 'plan-subscriptions',
            id: subs.docs[0].id,
            data: { endsAt, canceledAt: null, status: 'active' },
        })

        console.log(`[V2][SSO Renew] ${email} → endsAt=${endsAt}`)
        return NextResponse.json({ message: 'Subscription renewed' }, { status: 200 })
    } catch (error) {
        console.error('[V2][SSO Renew Error]', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
```

---

## 4b — Fix Auth Bug trong upgrade/downgrade

**Files:** `src/app/api/v1/sso/upgrade/route.ts`, `src/app/api/v1/sso/downgrade/route.ts` — UPDATE

**Bug:** `null?.roles?.includes('super-admin')` → `undefined` (falsy) → trả 403 thay vì 401 khi token absent.

**Fix:** Replace single-check với 3-guard pattern (consistent với tất cả SSO endpoints khác):

```typescript
// TRƯỚC (buggy):
const callerUser = await getCurrentUser(req)
if (!callerUser?.roles?.includes('super-admin')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
}

// SAU (3-guard):
const authHeader = req.headers.get('authorization')
if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Authorization required' }, { status: 401 })
}
const callerUser = await getCurrentUser(req)
if (!callerUser) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
}
if (!callerUser?.roles?.includes('super-admin')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
}
```

Apply cho cả `upgrade/route.ts` và `downgrade/route.ts`.

---

## 4c — ETL Script (CREATE full script)

**File:** `scripts/migrate-pw1-subscriptions.js` — CREATE (scope mở rộng: tạo toàn bộ script, không chỉ corrections)

**Source spec:** `plans/260604-1103-sync-subscription/phase-05-pw2-etl-corrections.md` + F34 PRD §8 ETL Join Path

**Prerequisites:** PW1 DB credentials trong env (`PW1_DB_*`), PW2 DB available, `plan_subscriptions` table tồn tại (F34 migration đã run).

### Script structure

```javascript
#!/usr/bin/env node
/**
 * Migrate PW1 plan_subscriptions → PW2 plan_subscriptions
 * Source: PW1 MySQL (plan_subscriptions JOIN plans JOIN users)
 * Target: PW2 Postgres (plan_subscriptions table)
 * Run: node scripts/migrate-pw1-subscriptions.js [--dry-run]
 */
const { Pool } = require('pg')
const mysql = require('mysql2/promise')

// Strip TM/non-TM suffix → raw pack code consistent với provision/upgrade/downgrade
function derivePackCode(planCode) {
    return planCode
        .replace(/_TM_USER$/, '')
        .replace(/_NON_TM_USER$/, '')
}

async function main() {
    const isDryRun = process.argv.includes('--dry-run')
    const pw1 = await mysql.createConnection({ /* PW1 creds from env */ })
    const pw2 = new Pool({ connectionString: process.env.DATABASE_URI })

    // PW1 query — F34 PRD §8 ETL Join Path
    // AND u.deleted_at IS NULL — filter soft-deleted PW1 users
    const [rows] = await pw1.execute(`
        SELECT
            ps.id         AS pw1_id,
            ps.starts_at,
            ps.ends_at,
            ps.canceled_at,
            ps.name,
            p.code        AS plan_code,
            u.email
        FROM plan_subscriptions ps
        JOIN plans p ON p.id = ps.plan_id
        JOIN users u ON u.store_id = ps.subscribable_id
                    AND u.is_store_owner = 1
                    AND u.deleted_at IS NULL
        WHERE ps.subscribable_type = 'App\\\\Models\\\\Store'
          AND ps.name = 'main'
        ORDER BY ps.id
    `)

    let migrated = 0, skipped = 0, errors = 0
    for (const row of rows) {
        try {
            // Find PW2 tenant by user email
            const tenantResult = await pw2.query(
                `SELECT t.id FROM tenants t
                 JOIN users u ON u.id = t.owner_id
                 WHERE u.email = $1 LIMIT 1`,
                [row.email]
            )
            if (!tenantResult.rows.length) { skipped++; continue }
            const tenantId = tenantResult.rows[0].id

            // Check for existing subscription (idempotent)
            const existing = await pw2.query(
                `SELECT id FROM plan_subscriptions WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
                [tenantId, row.name || 'main']
            )
            if (existing.rows.length) { skipped++; continue }

            if (!isDryRun) {
                await pw2.query(`
                    INSERT INTO plan_subscriptions
                        (tenant_id, name, plan, status, starts_at, ends_at, canceled_at, pack_code, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                `, [
                    tenantId,
                    row.name || 'main',
                    row.plan_code,                     // full plan code: PROFESSIONAL_TM_USER
                    row.canceled_at ? 'canceled' : (new Date(row.ends_at) < new Date() ? 'ended' : 'active'),
                    row.starts_at,
                    row.ends_at,
                    row.canceled_at || null,
                    derivePackCode(row.plan_code),      // stripped: PROFESSIONAL
                ])
            }
            migrated++
        } catch (err) {
            console.error(`[ETL] Error for ${row.email}:`, err.message)
            errors++
        }
    }

    console.log(`[ETL] Done — migrated: ${migrated}, skipped: ${skipped}, errors: ${errors}${isDryRun ? ' (DRY RUN)' : ''}`)
    await pw1.end()
    await pw2.end()
}

main().catch(err => { console.error(err); process.exit(1) })
```

**Key correctness rules:**
- `pack_code = derivePackCode(row.plan_code)` — stripped (`PROFESSIONAL`), consistent với provision/upgrade/downgrade
- `plan = row.plan_code` — full code (`PROFESSIONAL_TM_USER`) unchanged
- `AND u.deleted_at IS NULL` — filter soft-deleted PW1 users (~10-50 bản ghi bẩn)
- Idempotent: skip nếu `(tenant_id, name)` đã tồn tại
- `--dry-run` flag để test trước khi apply thật

## Todo

- [ ] Tạo `src/app/api/v1/sso/renew/route.ts`
- [ ] Read `src/app/api/v1/sso/upgrade/route.ts` — xác nhận vị trí auth check
- [ ] Read `src/app/api/v1/sso/downgrade/route.ts` — xác nhận vị trí auth check
- [ ] Fix 3-guard auth trong `upgrade/route.ts`
- [ ] Fix 3-guard auth trong `downgrade/route.ts`
- [ ] Tạo `scripts/migrate-pw1-subscriptions.js` (full script per spec trên)
- [ ] Test: `node scripts/migrate-pw1-subscriptions.js --dry-run` trước khi run thật
- [ ] `pnpm tsc --noEmit` passes (cho các TS files)

## Success Criteria

- `PUT /api/v1/sso/renew` với valid email + expired_at → 200, `plan_subscriptions.endsAt` updated
- Renew: plan code không đổi, chỉ `endsAt` + `canceledAt` + `status` thay đổi
- Renew: email không tồn tại → 404; 'main' sub không tồn tại → 404
- `upgrade/downgrade`: missing Bearer → 401 (không còn 403)
- ETL dry-run: log đúng số migrated/skipped/errors, không INSERT gì
- ETL real: `pack_code` = stripped (`PROFESSIONAL`), soft-deleted users bị filter, idempotent khi chạy lại
