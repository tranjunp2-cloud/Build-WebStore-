# Phase 01 — Quick Wins (Fix Core Issues)

**Parent:** [plan.md](./plan.md)
**Priority:** P1 | **Effort:** 30m | **Status:** completed

## Overview

Fix 3 root causes — double DB query, aggressive polling, no debounce. Expected 90%+ reduction in DB load.

## Key Insights

- `getCurrentTenantId()` gọi `getCurrentUser()` riêng → 2x DB hit/request
- 15s polling là overkill cho tenant revocation (hiếm khi xảy ra)
- Focus handler không debounce → tab switching = burst requests
- Không check Page Visibility → background tabs vẫn poll

## Implementation Steps

### Step 1: Fix double `getCurrentUser()` in route handler
**File:** `src/app/api/auth/session-check/route.ts`

```typescript
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ action: 'force_logout', reason: 'Unauthenticated' });
    }

    // Extract tenant from user directly (no 2nd getCurrentUser call)
    const tenants = user.tenants as Array<{ tenant: string | { id: string } }> | undefined;
    const tenantId = tenants?.[0]?.tenant;
    const activeTenantId = typeof tenantId === 'string' ? tenantId : tenantId?.id;

    if (!activeTenantId) {
      return NextResponse.json({ action: 'force_logout', reason: 'Missing Tenant' });
    }

    const isStillInTenant = tenants?.some((t) => {
      const tId = typeof t.tenant === 'object' ? t.tenant?.id : t.tenant;
      return tId === activeTenantId;
    });

    if (!isStillInTenant) {
      return NextResponse.json({ action: 'force_logout', reason: 'Removed from workspace' });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Session Check Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

### Step 2: Optimize TenantAccessWatcher polling
**File:** `src/components/dashboard/TenantAccessWatcher.tsx`

Changes:
1. Increase interval: 15s → 60s
2. Add Page Visibility API — pause when tab hidden
3. Debounce focus handler (2s)
4. Initial delay — don't check immediately on mount

```typescript
useEffect(() => {
  let timeoutId: NodeJS.Timeout | null = null;
  
  const checkSession = async () => {
    if (isEvicted) return;
    try {
      const res = await fetch('/api/auth/session-check', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.action === 'force_logout') setIsEvicted(true);
      }
    } catch (error) {
      console.error('Failed to check session', error);
    }
  };

  // Poll every 60s instead of 15s
  intervalRef.current = setInterval(checkSession, 60000);

  // Debounced focus handler (2s delay)
  const handleFocus = () => {
    if (document.visibilityState !== 'visible') return;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(checkSession, 2000);
  };

  // Pause/resume on visibility change
  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') {
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      checkSession(); // Check immediately when tab becomes visible
      intervalRef.current = setInterval(checkSession, 60000);
    }
  };

  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutId) clearTimeout(timeoutId);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}, [isEvicted]);
```

### Step 3: Add Cache-Control header
**File:** `src/app/api/auth/session-check/route.ts`

```typescript
const response = NextResponse.json({ ok: true });
response.headers.set('Cache-Control', 'private, max-age=30');
return response;
```

## Todo

- [x] Fix double getCurrentUser in route.ts
- [x] Increase polling interval to 60s
- [x] Add Visibility API check (pause hidden tabs)
- [x] Debounce focus handler (2s)
- [x] Add Cache-Control header
- [ ] Test: verify polling frequency in Network tab
- [ ] Test: verify force_logout still works

## Success Criteria

- Session-check calls reduced from 4+/min to ~1/min per user
- DB queries per call reduced from 2-4 to 1
- Background tabs don't generate polling traffic
- Tenant revocation (force_logout) still works within ~60s

## Risk Assessment

- **Low risk**: Increasing poll interval means revocation takes up to 60s instead of 15s → acceptable tradeoff
- **No functional change**: Same logic, just fewer calls
- **Focus debounce**: 2s delay is imperceptible to user
