# Phase 01 — Backend: session-check route

## Context Links
- Parent plan: [plan.md](./plan.md)
- File to edit: `src/app/api/auth/session-check/route.ts`
- Auth helper: `src/lib/auth.ts` → `getCurrentUser()`
- Issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1270

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Replace immediate `force_logout` for transient errors with `{ ok: false, retry: true }`, and add DB re-verify for empty-tenant case before concluding removal.

## Key Insights
- `getCurrentUser()` can transiently return `null` during HMR reload, token refresh, concurrent request race — this is NOT a confirmed unauthenticated state
- `user.tenants` in the returned object may be stale/unpopulated (Payload `depth` issue); DB may still have valid tenant
- `subscription_expired` and `Account suspended` are already DB-verified in the route — these are NOT transient; keep them as-is
- Adding `{ ok: false, retry: true }` response type is backward-compatible — frontend currently ignores anything that isn't `force_logout`

## Requirements
1. `getCurrentUser()` returns `null` → return `{ ok: false, retry: true }` (not `force_logout`)
2. `activeTenantId` is null/empty → re-fetch user from DB with `depth: 1` → only `force_logout` if DB also has no tenants
3. Log each `force_logout` to server console: `reason + userId`
4. No change to `subscription_expired` and `Account suspended` branches

## Architecture

```
GET /api/auth/session-check
  → getCurrentUser()
      null → { ok: false, retry: true }   ← NEW (was: force_logout: Unauthenticated)
      user → extract activeTenantId from user.tenants[0]
          null → re-fetch user DB depth:1  ← NEW
              still null → force_logout: Removed from workspace (+ log)
              found → continue with fresh activeTenantId
          → parallel: subResult + tenantResult
          → subscription check (unchanged)
          → ban check (unchanged)
          → { ok: true }
```

## Related Code Files
- **Edit:** `src/app/api/auth/session-check/route.ts` (76 lines)
- **Read:** `src/lib/auth.ts` — understand `getCurrentUser()` return shape
- **No change:** `src/lib/subscriptions/plan-subscription.ts`

## Implementation Steps

### Step 1 — Null user → retry (route.ts:10-14)

**Current:**
```typescript
if (!user) {
    return NextResponse.json(
        { action: 'force_logout', reason: 'Unauthenticated' },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
```

**Replace with:**
```typescript
if (!user) {
    // Transient null (HMR, token refresh, race condition) — not a confirmed logout event
    console.warn('[session-check] getCurrentUser returned null, returning retry');
    return NextResponse.json(
        { ok: false, retry: true },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
```

### Step 2 — Empty tenants → DB re-verify (route.ts:22-30)

**Current:**
```typescript
if (!activeTenantId) {
    return NextResponse.json(
        { action: 'force_logout', reason: 'Removed from workspace' },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
```

**Replace with:**
```typescript
let resolvedTenantId = activeTenantId;

if (!resolvedTenantId) {
    // Tenants may be stale/unpopulated on the user object — re-fetch from DB to confirm
    const payload = await getPayload({ config });
    const freshUser = await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 1,
    });
    const freshTenants = freshUser?.tenants as Array<{ tenant: string | { id: string } }> | undefined;
    const freshFirst = freshTenants?.[0]?.tenant;
    resolvedTenantId = typeof freshFirst === 'string' ? freshFirst : freshFirst?.id;

    if (!resolvedTenantId) {
        console.warn('[session-check] force_logout: Removed from workspace', { userId: user.id });
        return NextResponse.json(
            { action: 'force_logout', reason: 'Removed from workspace' },
            { headers: { 'Cache-Control': 'no-store' } },
        );
    }
}
```

Then replace all subsequent uses of `activeTenantId` with `resolvedTenantId` in the `payload.find()` calls (lines ~38, ~45).

### Step 3 — Log remaining force_logout cases

Add `console.warn` before `subscription_expired` return (line ~53):
```typescript
console.warn('[session-check] force_logout: subscription_expired', { userId: user.id, tenantId: resolvedTenantId });
```

Add `console.warn` before `Account suspended` return (line ~63):
```typescript
console.warn('[session-check] force_logout: Account suspended', { userId: user.id, tenantId: resolvedTenantId });
```

### Step 4 — Move `getPayload({ config })` call up

Currently `getPayload` is called only inside the parallel block. After Step 2, it's needed earlier (for DB re-fetch). Move the `getPayload` call to before the tenant check, or pass `payload` down. Simplest: move it before the `if (!resolvedTenantId)` block and reuse in the parallel block.

## Todo List
- [ ] Replace null-user branch → `{ ok: false, retry: true }`
- [ ] Add DB re-fetch logic for empty `activeTenantId`
- [ ] Replace `activeTenantId` references → `resolvedTenantId` in `payload.find()` calls
- [ ] Move `getPayload({ config })` before tenant-check block
- [ ] Add `console.warn` logs for each `force_logout` branch
- [ ] TypeScript compile check: `npx tsc --noEmit`

## Success Criteria
- `null` user → returns `{ ok: false, retry: true }` (HTTP 200)
- Empty tenants from user object but DB has tenant → continues to subscription/ban check
- Confirmed empty tenant (both user object AND DB) → returns `force_logout: Removed from workspace`
- `subscription_expired` and `Account suspended` → unchanged behavior
- Server console logs `[session-check] force_logout: <reason>` for each real force_logout

## Risk Assessment
- **Low risk:** Adding DB re-fetch for empty-tenant case adds ~1 extra DB query in an edge case only
- **getPayload refactor:** Move from line 34 to earlier — purely structural, no logic change
- No API contract change for consumers except new `{ ok: false, retry: true }` type (additive)

## Security Considerations
- `retry: true` must NOT leak user info — just signals "try again"
- DB re-fetch uses `payload.findByID` with system access — same pattern as rest of route

## Next Steps
→ Phase 02: Frontend must be updated to handle `{ ok: false, retry: true }` and add grace period
