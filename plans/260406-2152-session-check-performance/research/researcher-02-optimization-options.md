# Research: Optimization Options

## Root Causes
1. **Double `getCurrentUser()` call** — `getCurrentTenantId()` re-fetches user from DB
2. **15s polling too aggressive** — tenant revocation is rare event
3. **Zero caching** — every request hits DB fresh
4. **No debounce on focus** — rapid tab switching = burst of requests

## Optimization Strategies (ordered by impact/effort)

### 1. Fix Double DB Query (Quick Win — HIGH impact)
Pass `user` to tenant check instead of calling `getCurrentUser()` again.
- **Before:** 2-4 DB queries per call
- **After:** 1-2 DB queries per call
- **Effort:** 5 min

### 2. Increase Polling Interval (Quick Win — HIGH impact)
Change from 15s → 60s. Tenant revocation is not time-critical (30-60s delay is acceptable).
- **Before:** 4 req/min/user
- **After:** 1 req/min/user (75% reduction)
- **Effort:** 1 min

### 3. Add Visibility API Check (MEDIUM impact)
Only poll when tab is visible. Pause when tab is hidden.
- Eliminates background tab polling entirely
- **Effort:** 10 min

### 4. Debounce Focus Handler (LOW impact)
Prevent burst requests on rapid tab switching.
- **Effort:** 5 min

### 5. Cache-Control Header (MEDIUM impact)
Add `Cache-Control: private, max-age=30` to response.
- Browser caches for 30s, reducing actual server hits
- **Effort:** 2 min

### 6. Server-Side In-Memory Cache (MEDIUM impact)
Cache user→tenant mapping for 30-60s in a Map/LRU.
- Avoid DB query if checked recently
- **Effort:** 30 min

### 7. WebSocket/SSE for Revocation Events (LONG-TERM — HIGH impact)
Push revocation event instead of polling. Eliminates all polling.
- **Effort:** 2-4 hours
- **Complexity:** Needs connection management, reconnection logic

## Recommended Approach
**Phase 1 (Quick Wins — 30 min):** Fix #1, #2, #3, #4 → 90%+ reduction
**Phase 2 (Optional — 1h):** Add #5, #6 for remaining optimization
**Phase 3 (Future):** #7 WebSocket only if scale demands it

## Expected Result After Phase 1
| Users | Before (queries/min) | After (queries/min) | Reduction |
|-------|---------------------|--------------------| ---------|
| 100 | 800-1,600 | 100-200 | ~87% |
| 1,000 | 8,000-16,000 | 1,000-2,000 | ~87% |
