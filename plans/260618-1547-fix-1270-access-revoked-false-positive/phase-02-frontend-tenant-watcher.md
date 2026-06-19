# Phase 02 — Frontend: TenantAccessWatcher

## Context Links
- Parent plan: [plan.md](./plan.md)
- Depends on: [Phase 01](./phase-01-backend-session-check.md) — backend must return `{ ok: false, retry: true }` first
- File to edit: `src/components/dashboard/TenantAccessWatcher.tsx`
- Rendered in: `src/app/(dashboard)/_components/CMSLayoutClient.tsx:65`

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Add startup delay, `retry: true` handling, and consecutive-failure counter so dialog only appears after 2 confirmed `force_logout` responses ≥10s apart.

## Key Insights
- `isEvicted` is React state → changes trigger `useEffect` re-run (deps: `[isEvicted]`). All new counters must be `useRef` to avoid unintended re-renders.
- `checkSession` is defined inside `useEffect` — refs are accessible via closure without adding to deps.
- **`subscription_expired` / `Account suspended` → show immediately**: Backend đã DB-verify, không thể transient sau Phase 01. 2-hit counter chỉ áp cho `Removed from workspace`.
- **`retry: true` cap 3 lần**: Sau 3 lần retry liên tiếp → escalate như `force_logout: Unauthenticated`. Tránh infinite loop khi genuine expired token.
- **Grace-period blocks interval + focus/visibility**: Khi đang trong 12s grace period, clear 60s interval và block focus/visibility events. Resume interval sau khi grace-period retry xong.
- Startup delay (5s) avoids false-positive on React strict-mode double-mount or HMR cold start.

## Requirements
1. Skip first `checkSession` call for 5s after mount
2. Handle `{ ok: false, retry: true }` → schedule retry after 8s, do NOT increment `consecutiveFailRef`; cap at 3 retries → escalate to `force_logout: Unauthenticated` flow
3. On `force_logout`:
   - `subscription_expired` / `Account suspended` → show dialog **immediately** (DB-verified, not transient)
   - `Removed from workspace` → 2-hit counter: show dialog only after 2 hits ≥10s apart
4. On `{ ok: true }`: reset both `consecutiveFailRef` and `retryCountRef` to 0
5. Log `force_logout` reason to `console.warn` for debuggability
6. During 12s grace period: pause 60s interval (block both interval AND focus/visibility)

## Architecture

```
mount
  → wait 5s (mountDelayRef)
  → checkSession()
      { ok: true } → reset consecutiveFailRef=0, retryCountRef=0, continue polling
      { ok: false, retry: true } → retryCountRef++
          retryCountRef < 3 → retry after 8s
          retryCountRef >= 3 → escalate: treat as force_logout: Unauthenticated
      { action: 'force_logout', reason }
          subscription_expired | Account suspended → show dialog IMMEDIATELY (no 2-hit)
          Removed from workspace → consecutiveFailRef++
              consecutiveFailRef < 2 → PAUSE interval, set inGracePeriodRef=true, retry after 12s
              consecutiveFailRef >= 2 AND elapsed >= 10s → RESUME interval, show dialog
      network error → console.error, continue polling (no counter increment)
  → 60s interval: paused during grace period (inGracePeriodRef = true), resumed after
  → focus/visibility events: blocked during startup AND grace period
```

## Related Code Files
- **Edit:** `src/components/dashboard/TenantAccessWatcher.tsx` (119 lines)
- **Read only:** `src/app/(dashboard)/_components/CMSLayoutClient.tsx` (for usage context)

## Implementation Steps

### Step 1 — Add new refs (after line 13)

```typescript
const consecutiveFailRef = useRef(0);           // counts consecutive 'Removed from workspace' hits
const lastFailTimestampRef = useRef(0);          // ms timestamp of previous force_logout
const retryCountRef = useRef(0);                // counts consecutive retry:true responses (cap: 3)
const mountedRef = useRef(false);               // startup delay gate
const inGracePeriodRef = useRef(false);         // true during 12s grace-period — blocks interval + focus/visibility
```

### Step 2 — Replace `checkSession` body (lines 18-32)

**Current:**
```typescript
const checkSession = async () => {
    if (isEvicted) return;
    try {
        const res = await fetch('/api/auth/session-check', { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            if (data.action === 'force_logout') {
                setEvictReason(data.reason ?? '');
                setIsEvicted(true);
            }
        }
    } catch (error) {
        console.error('Failed to check session', error);
    }
};
```

**Replace with:**
```typescript
const checkSession = async () => {
    if (isEvicted) return;
    try {
        const res = await fetch('/api/auth/session-check', { cache: 'no-store' });
        if (!res.ok) return; // non-2xx (5xx etc.) — skip silently, keep polling

        const data = await res.json();

        if (data.ok === true) {
            // Valid session — reset all counters
            consecutiveFailRef.current = 0;
            retryCountRef.current = 0;
            return;
        }

        if (data.ok === false && data.retry === true) {
            retryCountRef.current += 1;
            if (retryCountRef.current < 3) {
                // Transient — retry after 8s without counting as failure
                console.warn('[TenantAccessWatcher] session-check retry requested', { attempt: retryCountRef.current });
                setTimeout(checkSession, 8_000);
                return;
            }
            // Cap reached (3 consecutive retries) — escalate as genuine auth failure
            console.warn('[TenantAccessWatcher] retry cap reached, escalating to Unauthenticated');
            setEvictReason('Unauthenticated');
            setIsEvicted(true);
            return;
        }

        if (data.action === 'force_logout') {
            retryCountRef.current = 0; // clear retry streak on any force_logout
            console.warn('[TenantAccessWatcher] force_logout received', { reason: data.reason });

            // subscription_expired + Account suspended are DB-verified → show immediately
            if (data.reason === 'subscription_expired' || data.reason === 'Account suspended') {
                setEvictReason(data.reason);
                setIsEvicted(true);
                return;
            }

            // Removed from workspace → 2-hit grace period
            const now = Date.now();
            const elapsed = now - lastFailTimestampRef.current;

            if (consecutiveFailRef.current >= 1 && elapsed >= 10_000) {
                // Second confirmed hit ≥10s after first → real removal
                setEvictReason(data.reason ?? '');
                setIsEvicted(true);
            } else {
                // First hit or burst — enter grace period: pause interval + block events
                consecutiveFailRef.current += 1;
                lastFailTimestampRef.current = now;
                inGracePeriodRef.current = true;
                if (intervalRef.current) clearInterval(intervalRef.current); // pause 60s poll
                setTimeout(() => {
                    inGracePeriodRef.current = false;
                    startPolling(); // resume 60s poll
                    checkSession();
                }, 12_000);
            }
        }
    } catch (error) {
        console.error('[TenantAccessWatcher] Failed to check session', error);
    }
};
```

### Step 3 — Add startup delay (replace lines 39-41)

**Current:**
```typescript
// Poll every 60s; also check immediately on mount so page refresh doesn't bypass eviction
checkSession();
startPolling();
```

**Replace with:**
```typescript
// Delay initial check 5s to avoid HMR/cold-start false positives
const startupTimer = setTimeout(() => {
    mountedRef.current = true;
    checkSession();
}, 5_000);
startPolling();
```

And add `startupTimer` to cleanup:
```typescript
return () => {
    clearTimeout(startupTimer);         // ← add this
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (debounceId) clearTimeout(debounceId);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibility);
};
```

### Step 4 — Guard focus/visibility handlers

Add startup guard + grace-period guard in both handlers. Note: `handleVisibility` hidden-branch (pausing interval) should also skip during grace period since interval is already paused:
```typescript
const handleFocus = () => {
    if (!mountedRef.current) return;           // startup delay gate
    if (inGracePeriodRef.current) return;      // grace period — scheduled retry handles it
    if (document.visibilityState !== 'visible') return;
    ...
};

const handleVisibility = () => {
    if (!mountedRef.current) return;           // startup delay gate
    if (inGracePeriodRef.current) return;      // grace period — scheduled retry handles it
    if (document.visibilityState === 'hidden') {
        if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
        checkSession();
        startPolling();
    }
};
```

## Todo List
- [ ] Add 5 refs: `consecutiveFailRef`, `lastFailTimestampRef`, `retryCountRef`, `mountedRef`, `inGracePeriodRef`
- [ ] Replace `checkSession` with new logic: retry cap (3x), immediate show for subscription/ban, 2-hit grace for removal
- [ ] Grace period entry: `inGracePeriodRef=true` + `clearInterval(intervalRef.current)`
- [ ] Grace period exit (setTimeout callback): `inGracePeriodRef=false` + `startPolling()` + `checkSession()`
- [ ] Replace immediate `checkSession()` on mount with 5s delayed startup
- [ ] Add `clearTimeout(startupTimer)` to cleanup return
- [ ] Guard `handleFocus` and `handleVisibility` with `mountedRef.current` AND `inGracePeriodRef.current`
- [ ] TypeScript compile check: `npx tsc --noEmit`

## Success Criteria
- `{ ok: false, retry: true }` × 1-2 → no dialog, retry 8s each, no force_logout counter increment
- `{ ok: false, retry: true }` × 3 → escalate → `isEvicted=true`, dialog shows "Access Revoked"
- `force_logout: subscription_expired` → dialog **ngay lập tức** (không đợi lần 2)
- `force_logout: Account suspended` → dialog **ngay lập tức** (không đợi lần 2)
- `force_logout: Removed from workspace` lần 1 → no dialog, interval paused, retry 12s
- `force_logout: Removed from workspace` lần 2 ≥10s sau → dialog shows
- Tab switch trong grace period → bị block, counter KHÔNG tăng thêm, 60s interval KHÔNG restart
- `{ ok: true }` between two failures → cả hai counters reset, cần 2 hits mới từ đầu
- Tab switch / HMR trong 5s startup → no check triggered
- Console: `[TenantAccessWatcher] force_logout received` + `retry requested` logs

## Risk Assessment
- **Low risk:** All new logic is additive refs + timeout scheduling
- `setTimeout(checkSession, 8_000/12_000)` inside `checkSession` creates self-scheduling; OK because `isEvicted` guard stops it once dialog shows, and component unmount clears timers via cleanup
- Edge case: if component unmounts mid-timeout, the timeout fires but `isEvicted` check at top of `checkSession` will short-circuit safely. However, the setTimeout ID is not tracked — acceptable for this use case (unmount = dashboard exit = logout anyway)

## Security Considerations
- Grace period only delays UI feedback — backend still enforces access on every API call
- Console logs are debug-only and contain no sensitive data (reason + counter only)

## Next Steps
→ After both phases complete: manual QA per verify criteria in plan.md
→ git-manager: `fix(auth): add grace period and retry to session-check to prevent false-positive eviction #1270`
