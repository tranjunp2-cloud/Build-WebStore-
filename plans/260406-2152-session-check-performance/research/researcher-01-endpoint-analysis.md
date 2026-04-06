# Research: Session-Check Endpoint Analysis

## Endpoint: `/api/auth/session-check`
**File:** `src/app/api/auth/session-check/route.ts`

## What It Does
1. `getCurrentUser()` → decode JWT + DB query (fetch user with tenants)
2. `getCurrentTenantId()` → calls `getCurrentUser()` AGAIN (2nd DB query!)
3. Checks if user still belongs to active tenant
4. Returns `{ok: true}` or `{action: 'force_logout'}`

## Critical Bug: Double DB Hit
`getCurrentTenantId()` at `src/lib/auth.ts:116-125` independently calls `getCurrentUser()` instead of accepting a user parameter. So EACH session-check = 2x full auth flow.

## Cost Per Call
- Best case (standard JWT): 2x `payload.auth()` = 2 DB queries
- Worst case (custom OTP JWT): 2x `payload.auth()` + 2x `payload.findByID()` = 4 DB queries
- JWT decode via jose: CPU-bound, ~1ms (negligible)
- No caching headers, no response caching
- `cache: 'no-store'` on client prevents any browser cache

## Caller: TenantAccessWatcher
**File:** `src/components/dashboard/TenantAccessWatcher.tsx`
- `setInterval(checkSession, 15000)` — every 15 seconds
- Also on `window.focus` event (no debounce)
- Mounted in ALL dashboard layouts

## Scale Projections
| Users | Requests/min | DB Queries/min (best) | DB Queries/min (worst) |
|-------|-------------|----------------------|----------------------|
| 10 | 40 | 80 | 160 |
| 100 | 400 | 800 | 1,600 |
| 1,000 | 4,000 | 8,000 | 16,000 |

## No Existing Optimization
- No rate limiting
- No caching (server or client)
- No TanStack Query usage
- No debounce on focus handler
