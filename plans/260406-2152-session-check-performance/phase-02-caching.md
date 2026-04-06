# Phase 02 — Server-Side Caching (Optional Enhancement)

**Parent:** [plan.md](./plan.md)
**Priority:** P2 | **Effort:** 1h | **Status:** pending
**Depends on:** Phase 01

## Overview

Thêm server-side in-memory cache để giảm DB hits thêm. Chỉ cần nếu Phase 01 chưa đủ hoặc scale > 1,000 users.

## Key Insights

- Tenant membership thay đổi rất hiếm (chỉ khi owner remove member)
- Cache 60s cho user→tenant mapping an toàn
- Invalidate cache khi tenant membership thay đổi

## Implementation Steps

### Step 1: Add simple LRU cache utility
**File:** `src/lib/cache.ts` (new)

```typescript
const cache = new Map<string, { data: any; expires: number }>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: any, ttlMs: number) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
  // Prevent memory leak — cap at 10,000 entries
  if (cache.size > 10000) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}
```

### Step 2: Use cache in session-check route
**File:** `src/app/api/auth/session-check/route.ts`

```typescript
import { getCached, setCache } from '@/lib/cache';

// In the handler, after getting user:
const cacheKey = `session-check:${user.id}`;
const cached = getCached<{ ok: boolean }>(cacheKey);
if (cached) {
  return NextResponse.json(cached);
}

// ... do tenant check ...

setCache(cacheKey, { ok: true }, 30_000); // 30s TTL
return NextResponse.json({ ok: true });
```

### Step 3: Invalidate on tenant change
Add cache invalidation in tenant CRUD endpoints when membership changes.

## Todo

- [ ] Create `src/lib/cache.ts` utility
- [ ] Add caching to session-check route
- [ ] Add invalidation hooks in tenant membership endpoints
- [ ] Test: verify cache hit/miss behavior

## Success Criteria

- DB queries reduced to ~0 for repeat checks within 30s window
- Cache auto-expires (no stale data > 30s)
- Tenant revocation still detected within 60s (cache TTL 30s + poll 60s)

## Risk Assessment

- **Medium**: In-memory cache = per-process, không shared giữa multiple instances
- **Mitigation**: TTL ngắn (30s) nên eventual consistency acceptable
- **Future**: Dùng Redis nếu cần shared cache across instances

## Decision: Skip if Phase 01 is Sufficient

Phase 01 alone reduces load ~90%. Phase 02 chỉ cần nếu:
- Scale > 1,000 concurrent dashboard users
- DB CPU still high after Phase 01
