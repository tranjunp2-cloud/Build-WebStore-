---
title: "Phase 02 — Simple Endpoints"
effort: 2h
status: pending
dependsOn: [phase-01]
blocks: []
sourceplan: |
  plans/260604-1103-sync-ban-user/phase-03
  plans/260604-1103-sync-unban-user/phase-03
  plans/260604-1103-sync-change-email/phase-03
  plans/260604-1103-check-email-exists/phase-02
note: "session-check update moved to Phase 03 (needs F34 to create the file first)"
---

# Phase 02 — Simple Endpoints

## Overview

Tạo 4 endpoint mới. Tất cả dùng cùng auth pattern (3-guard). Có thể implement song song nhau sau khi Phase 01 done. Session-check update chuyển sang Phase 03 (phụ thuộc F34).

## Auth Pattern (3-guard — áp dụng cho tất cả endpoints)

```typescript
const authHeader = req.headers.get('authorization')
if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Authorization required' }, { status: 401 })
}
const callerUser = await getCurrentUser(req)
if (!callerUser) return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
if (!callerUser?.roles?.includes('super-admin')) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 })
}
```

---

## 2a — `POST /api/v1/sso/ban-user`

**File:** `src/app/api/v1/sso/ban-user/route.ts` — CREATE

**Behavior:**
- Parse `{ email }` từ body
- Find user by email → get ALL tenant IDs từ `user.tenants` array
- Update mỗi tenant: `status: 'suspended'`
- Idempotent: ban user đã suspended → trả 200 (không error)
- Fire-and-forget từ SSO — SSO không retry (BanProductUser không phải JobBase)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
    try {
        const payload = await getPayload({ config })
        // [3-guard auth — xem pattern trên]
        const { email } = await req.json()
        if (!email) return NextResponse.json({ message: 'email is required' }, { status: 400 })

        const userResult = await payload.find({
            collection: 'users',
            where: { email: { equals: email } },
            limit: 1, depth: 1,
        })
        if (userResult.docs.length === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 })
        }

        const user = userResult.docs[0]
        const tenantEntries = user.tenants as Array<{ tenant: string | { id: string } }> | undefined
        const tenantIds = (tenantEntries || [])
            .map(t => typeof t.tenant === 'string' ? t.tenant : t.tenant?.id)
            .filter(Boolean)

        let updated = 0
        for (const tenantId of tenantIds) {
            await payload.update({ collection: 'tenants', id: tenantId, data: { status: 'suspended' } })
            updated++
        }
        console.log(`[V2][SSO BanUser] Suspended ${updated} tenant(s) for ${email}`)
        return NextResponse.json({ message: 'User banned', tenantsUpdated: updated }, { status: 200 })
    } catch (error) {
        console.error('[V2][SSO BanUser Error]', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
```

**Key:** `depth: 1` để resolve tenant relation. Ban ALL tenants của user (không chỉ first).

---

## 2b — `POST /api/v1/sso/unban-user`

**File:** `src/app/api/v1/sso/unban-user/route.ts` — CREATE

Cùng structure với ban-user, chỉ đổi `status: 'suspended'` → `status: 'active'` và log prefix `[V2][SSO UnbanUser]`.

**Key difference:** `UnBanProductUser` extends `JobBase` — **có retry**. Endpoint phải idempotent: unban user đã active → vẫn trả 200.

Restore về `'active'` — không phải previous status (SSO không track PW2 status trước ban).

---

## 2c — `POST /api/v1/sso/change-email`

**File:** `src/app/api/v1/sso/change-email/route.ts` — CREATE

**Behavior:**
- Parse `{ email, new_email }` — `email` = old email (field name là `email`, không phải `old_email`)
- **`ChangeEmailProductUser` có retry (JobBase)** → bắt buộc idempotent:
  - Nếu old email không tìm thấy → check xem `new_email` đã tồn tại chưa
  - Nếu `new_email` tồn tại → `200` (đã apply trước đó trên retry lần trước)
  - Nếu `new_email` cũng không tồn tại → `404`

```typescript
// Idempotency guard (sau khi email-not-found):
const alreadyApplied = await payload.find({
    collection: 'users',
    where: { email: { equals: new_email } },
    limit: 1,
})
if (alreadyApplied.docs.length > 0) {
    return NextResponse.json({ message: 'Email already updated', userId: alreadyApplied.docs[0].id }, { status: 200 })
}
return NextResponse.json({ message: 'User not found' }, { status: 404 })
```

- Check conflict: nếu `new_email` đã tồn tại với user khác → `409 'Email already in use'`
- Update: `payload.update({ collection: 'users', id, data: { email: new_email } })`

---

## 2d — `GET /api/v1/sso/check-email`

**File:** `src/app/api/v1/sso/check-email/route.ts` — CREATE

**Behavior:**
- `email` từ query param: `req.nextUrl.searchParams.get('email')`
- Response: `{ exists: boolean }` — không expose user data
- GET method (không phải POST)

```typescript
const email = req.nextUrl.searchParams.get('email')
if (!email) return NextResponse.json({ message: 'email query param is required' }, { status: 400 })
const result = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
})
return NextResponse.json({ exists: result.docs.length > 0 }, { status: 200 })
```

---

## 2e — Update `session-check/route.ts`

**File:** `src/app/api/auth/session-check/route.ts` — UPDATE (F34 #1187 tạo file này)

**Add:** Sau khi confirm user vẫn còn trong tenant, fetch tenant và check suspension.

**Verify first:** `src/lib/subscriptions/feature-guard.ts` (F34) — đảm bảo không import cycle.

```typescript
// Thêm sau step "user vẫn còn trong tenant" (APPEND, không replace existing logic):
const tenant = await payload.findByID({
    collection: 'tenants',
    id: activeTenantId,
    depth: 0,
})
if (tenant?.status === 'suspended') {
    return NextResponse.json(
        { action: 'force_logout', reason: 'Account suspended' },
        { headers: { 'Cache-Control': 'no-store' } },
    )
}
```

**Note:** `Cache-Control: no-store` cho suspended response (không cache force_logout). Response `{ok: true}` giữ nguyên `max-age=30` — ban propagation delay up to 30s là acceptable.

## Todo

- [ ] Tạo `src/app/api/v1/sso/ban-user/route.ts`
- [ ] Tạo `src/app/api/v1/sso/unban-user/route.ts`
- [ ] Tạo `src/app/api/v1/sso/change-email/route.ts`
- [ ] Tạo `src/app/api/v1/sso/check-email/route.ts`
- [ ] `pnpm tsc --noEmit` passes tất cả files

## Success Criteria

- `POST /api/v1/sso/ban-user` với valid email → 200, tenant.status = 'suspended'
- `POST /api/v1/sso/unban-user` với email đã banned → 200, tenant.status = 'active'
- `POST /api/v1/sso/change-email` idempotent: retry cùng request → 200
- `GET /api/v1/sso/check-email?email=x` → `{ exists: true/false }`
- Tất cả endpoints: missing Bearer → 401, non-admin → 403
