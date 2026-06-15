---
title: "Phase 03 — Provision Fix + Session-Check Update"
effort: 4h
status: pending
dependsOn: [phase-01, F34/#1187-merged]
blocks: []
sourceplan: |
  plans/260604-1103-sso-pw2-foundation/phase-04-pw2-provision-composite-key.md
  plans/260604-1103-sso-pw2-foundation/phase-05-pw2-plan-subscription-bridge.md
  plans/260604-1103-sync-ban-user/phase-04-pw2-session-check.md
---

# Phase 03 — Provision Fix

## Overview

Fix `src/app/api/v1/sso/provision/route.ts` để:
1. Composite key check `(email + customerIdNumber)` thay vì email-only
2. Set `customerIdNumber` + `migrationStatus = 'migrated'` khi tạo User
3. Tạo `PlanSubscription` record sau provision + sync `Tenants.plan`
4. Update response 201 bao gồm `planSubscription`

**Prerequisite check trước khi bắt đầu:**
- `src/lib/subscriptions/plan-subscription.ts` tồn tại (F34 phase-03)
- Export: `upsertPlanSubscription`, `getPlanCode`, `mapPlanCodeToTier`
- `src/collections/PlanSubscriptions.ts` đã register trong `payload.config.ts`

## Part A — Composite Key Fix

**Step 1:** Parse `customer_id` từ request body (thêm vào cùng chỗ với `subscription_code`):

```typescript
const customerId = rawPayload.customer_id ?? rawPayload.customer_id_number ?? null
```

**Step 2:** Thay email-only check bằng composite key logic:

```typescript
const whereClause = customerId
    ? {
          and: [
              { email: { equals: email } },
              { customerIdNumber: { equals: String(customerId) } },
          ],
      }
    : { email: { equals: email } }

const existing = await payload.find({
    collection: 'users',
    where: whereClause,
    limit: 1,
})
if (existing.docs.length > 0) {
    return NextResponse.json({ message: 'User already provisioned' }, { status: 409 })
}
```

**Composite key logic:**
```
customer_id present?
  YES → check (email + customerIdNumber) composite
        found → 409 'User already provisioned'
        not found → create (kể cả khi email alone exists — AC-09)
  NO  → check email only (backward compat)
        found → 409
        not found → create
```

**Edge case — null customerIdNumber:** User cũ không có `customerIdNumber` sẽ không khớp WHERE composite → attempt create → Payload DB unique constraint on email → catch và trả 409 thay vì 500.

**Step 3:** Thêm fields vào `payload.create({ collection: 'users', ... })`:

```typescript
customerIdNumber: customerId ? String(customerId) : undefined,
migrationStatus: 'migrated',
```

## Part B — PlanSubscription Bridge

Thêm sau khi Tenant + User đã được tạo và linked. Failure **không block** provision — wrap trong try/catch riêng.

**Imports thêm vào:**

```typescript
import { getPlanCode, upsertPlanSubscription, mapPlanCodeToTier } from '@/lib/subscriptions/plan-subscription'
```

**Implementation:**

```typescript
// --- PlanSubscription bridge (non-blocking) ---
const packCode = rawPayload.subscription_code || 'freemium'
const planCode = getPlanCode(packCode, rawPayload.subscription_type ?? null)

// SSO gửi MySQL datetime ('YYYY-MM-DD HH:MM:SS') — normalize về ISO
const toIso = (d: string) => d.replace(' ', 'T')
const startsAt = rawPayload.start_date
    ? new Date(toIso(rawPayload.start_date)).toISOString()
    : new Date().toISOString()
const endDateOnly = rawPayload.end_date ? toIso(rawPayload.end_date).split('T')[0] : null
// T23:59:59Z — Z suffix để tránh UTC+7 server offset làm sai ngày
const endsAt = endDateOnly
    ? new Date(`${endDateOnly}T23:59:59Z`).toISOString()
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

let planSubscription: { id: string | number; plan: string } | null = null
try {
    // upsertPlanSubscription hardcodes name='main' — không pass name vào data
    const sub = await upsertPlanSubscription(payload, newTenant.id, {
        plan: planCode,
        startsAt,
        endsAt,
        packCode: packCode.toUpperCase(),
    })
    // Sync Tenants.plan — dùng tại ai/generate-site:246 để gate AI generation
    await payload.update({
        collection: 'tenants',
        id: newTenant.id,
        data: { plan: mapPlanCodeToTier(planCode) },
    })
    planSubscription = { id: sub.id, plan: sub.plan as string }
    console.log(`[Provision] PlanSub + Tenants.plan synced: tenant=${newTenant.id} plan=${planCode}`)
} catch (err) {
    console.error('[Provision] PlanSubscription/Tenants.plan sync failed (non-blocking):', err)
}
```

**QUAN TRỌNG:** `upsertPlanSubscription()` hardcodes `name = 'main'` — **không pass `name` vào data arg** (TypeScript sẽ báo lỗi).

## Part C — Update Response 201

```typescript
return NextResponse.json(
    {
        message: 'Provisioning successful',
        user: { id: newUser.id, email: newUser.email },
        tenant: { id: newTenant.id, name: newTenant.name },
        planSubscription,  // null nếu PlanSubscription creation failed
    },
    { status: 201 },
)
```

---

## Part D — Session-Check: Suspended Tenant Check

**File:** `src/app/api/auth/session-check/route.ts` — UPDATE (file được tạo bởi F34 #1187)

**Task:** Append suspended tenant check vào cuối existing logic — không replace, không reorder.

**Existing flow (F34):**
1. `getCurrentUser()` → không có user → `force_logout: Unauthenticated`
2. Get `activeTenantId` từ `user.tenants[0].tenant`
3. Check user còn trong tenant → không → `force_logout: Removed from workspace`
4. Return `{ok: true}` với `Cache-Control: private, max-age=30`

**Thêm sau step 3, trước step 4:**

```typescript
// Verify tenant not suspended (ban enforcement — appended after existing membership check)
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

**Note:** `Cache-Control: no-store` cho suspended path (không cache force_logout). Success path giữ `max-age=30` — ban propagation delay ≤30s là acceptable MVP behavior.

Verify `getPayload` + `config` đã được import trong file (F34 có thể đã import sẵn qua `withFeatureGuard`).

---

## Todo

- [ ] Read `src/app/api/v1/sso/provision/route.ts` — audit current structure
- [ ] Verify `src/lib/subscriptions/plan-subscription.ts` tồn tại và exports đúng
- [ ] Add `customerId` parse vào parsed fields
- [ ] Replace email-only check bằng composite `whereClause`
- [ ] Add `customerIdNumber` + `migrationStatus: 'migrated'` vào `payload.create` data
- [ ] Add imports cho `getPlanCode`, `upsertPlanSubscription`, `mapPlanCodeToTier`
- [ ] Add PlanSubscription bridge block (try/catch, non-blocking)
- [ ] Add `Tenants.plan` sync trong cùng try block
- [ ] Update response 201 body thêm `planSubscription`
- [ ] Read `src/app/api/auth/session-check/route.ts` — audit existing flow
- [ ] Append suspended check sau membership check (không replace)
- [ ] `pnpm tsc --noEmit` passes

## Success Criteria

- Provision email+customer_id mới → 201, response có `planSubscription.plan`
- Duplicate email+customer_id → 409 `'User already provisioned'`
- Email exists + different customer_id → 201 tạo user mới (AC-09)
- No customer_id + email exists → 409 (backward compat)
- New User: `customerIdNumber` set + `migrationStatus = 'migrated'`
- `plan_subscriptions` table có record sau provision
- `tenants.plan` updated: `PROFESSIONAL_TM_USER → 'business'`, `FREEMIUM → 'free'`
- PlanSubscription fail → provision vẫn 201, `planSubscription: null`
- session-check: tenant suspended → `{ action: 'force_logout', reason: 'Account suspended' }`
- session-check: ban propagation ≤30s (max-age=30 trên success path)
