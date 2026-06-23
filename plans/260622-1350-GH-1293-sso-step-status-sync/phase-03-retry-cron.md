---
title: "Phase 03 — Retry Cron"
effort: 1h
status: pending
dependsOn: [phase-01]
blocks: []
---

# Phase 03 — Retry Cron

## Overview

- Create `src/app/api/cron/process-sso-steps/route.ts` — polls `sso_step_events` table, retries failed SSO notifications
- Add cron entry to `vercel.json`

## Files to Modify/Create

| File | Change |
|------|--------|
| `src/app/api/cron/process-sso-steps/route.ts` | **NEW** — retry cron handler |
| `vercel.json` | Add cron entry `*/1 * * * *` |

---

## 1. `src/app/api/cron/process-sso-steps/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { notifyStepComplete } from '@/lib/sso/sso-api-client'

export const dynamic = 'force-dynamic'

const MAX_RETRIES = 5
const BATCH_SIZE = 20

/**
 * GET /api/cron/process-sso-steps
 *
 * Retries failed SSO step-status notifications.
 * Uses UPDATE...RETURNING with FOR UPDATE SKIP LOCKED to atomically claim rows —
 * prevents two concurrent cron instances from processing the same event.
 */
export async function GET(req: Request) {
    // Verify cron secret — same pattern as other cron routes
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const db = payload.db?.drizzle
    if (!db) {
        return NextResponse.json({ error: 'No DB connection' }, { status: 500 })
    }

    // Atomically claim pending rows: UPDATE...WHERE id IN (SELECT...FOR UPDATE SKIP LOCKED)
    // Two concurrent crons cannot claim the same row — SKIP LOCKED skips rows already locked.
    const claimed = await db.execute<{ id: number; user_id: number; step: number }>(sql`
        UPDATE sso_step_events
        SET status = 'processing', updated_at = now()
        WHERE id IN (
            SELECT id FROM sso_step_events
            WHERE status = 'pending' AND retry_count < ${MAX_RETRIES}
            ORDER BY created_at ASC
            LIMIT ${BATCH_SIZE}
            FOR UPDATE SKIP LOCKED
        )
        RETURNING id, user_id, step
    `)

    const events = claimed.rows ?? []
    let succeeded = 0
    let failed = 0

    for (const event of events) {
        try {
            await notifyStepComplete(payload, event.user_id, event.step as 1 | 2 | 3)

            await db.execute(sql`
                UPDATE sso_step_events
                SET status = 'completed', updated_at = now()
                WHERE id = ${event.id}
            `)
            succeeded++
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)

            // retry_count + 1 >= MAX_RETRIES → mark failed permanently
            await db.execute(sql`
                UPDATE sso_step_events
                SET retry_count = retry_count + 1,
                    status = CASE WHEN retry_count + 1 >= ${MAX_RETRIES} THEN 'failed' ELSE 'pending' END,
                    last_error = ${errMsg},
                    updated_at = now()
                WHERE id = ${event.id}
            `)
            failed++
        }
    }

    return NextResponse.json({
        processed: events.length,
        succeeded,
        failed,
        timestamp: new Date().toISOString(),
    })
}
```

---

## 2. `vercel.json` — add cron entry

In the `"crons"` array, add after the existing entries:

```json
{
    "path": "/api/cron/process-sso-steps",
    "schedule": "*/1 * * * *"
}
```

---

## Notes

- **`FOR UPDATE SKIP LOCKED`** — atomic claim: nếu 2 cron instances chạy song song, mỗi instance chỉ nhận các rows khác nhau. Không double-process.
- **`status = 'processing'`** cần thêm vào CHECK constraint của `sso_step_events` table trong phase-01:
  ```sql
  status varchar NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
  ```
- **Stuck 'processing' rows** — nếu cron crash giữa chừng, rows vẫn ở `processing` mãi. Tự reset khi `updated_at < now() - interval '5 minutes'` bằng cách thêm vào WHERE clause của SELECT trong `SKIP LOCKED`:
  ```sql
  WHERE (status = 'pending' OR (status = 'processing' AND updated_at < now() - interval '5 minutes'))
  AND retry_count < 5
  ```
- **MAX_RETRIES = 5, BATCH_SIZE = 20** — 20 events × ~500ms SSO call = ~10s, an toàn trong Vercel 60s timeout.
- **retry_count logic dùng SQL CASE** — tránh extra SELECT, atomic hơn.
- Users provisioned trước khi có `keyString`: `notifyStepComplete` log warning và skip — không tạo retry event.

## Verification

```bash
# Compile check
npx tsc --noEmit

# Test cron endpoint locally (dev server must be running)
curl -H "Authorization: Bearer dev-cron-secret" http://localhost:3000/api/cron/process-sso-steps

# Confirm vercel.json cron syntax
cat vercel.json | grep -A3 "process-sso-steps"
```
