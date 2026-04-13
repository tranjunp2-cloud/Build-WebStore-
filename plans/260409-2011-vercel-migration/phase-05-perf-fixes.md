# Phase 5: Caching + AI Protection + Upstash Redis

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Phase 3 (running on Vercel)
- **Day 3** | **Priority:** P0 | **Status:** ⬜ pending
- ⚠️ SSE→Polling đã move sang Phase 2 (prediction review)
- ⚠️ **Upstash Redis added** cho distributed rate limiting (prediction review)

## 3 Fixes Cần Làm

### 5.1 ⚠️ Setup Upstash Redis (30min) — NEW from Prediction
**Vấn đề:** Vercel serverless = mỗi request 1 instance → in-memory rate limit KHÔNG WORK.

- [ ] Tạo Upstash account: https://upstash.com (GitHub login)
- [ ] Tạo Redis database: region `ap-southeast-1` (Singapore)
- [ ] Free tier: 10K commands/day (đủ cho 200 users)
- [ ] Lấy `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- [ ] Add env vars vào Vercel Project Settings
- [ ] Install: `npm install @upstash/redis @upstash/ratelimit`

### 5.2 AI Rate Limit với Upstash (2h)
```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Per-user: 5 AI generations / minute
export const aiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1m'),
  prefix: 'ai-gen',
})

// Global: max 10 concurrent AI generations
export const aiGlobalLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1m'),
  prefix: 'ai-global',
})
```

**Files:**
- `src/lib/rate-limit.ts` → NEW
- `src/app/api/ai/generate-site/route.ts` → integrate rate limit
- `src/app/api/ai/edit-block/route.ts` → integrate rate limit

- [ ] Create rate limit utility with Upstash
- [ ] Integrate per-user + global limit in AI routes
- [ ] Add daily spend cap: $50/day → 429 response
- [ ] Test: exceed limit → graceful error (not crash)

### 5.3 Caching Layer với `unstable_cache` (2h)
**Dùng Next.js native caching** thay vì custom in-memory Map (prediction review).

```typescript
// src/lib/cache/tenant.ts
import { unstable_cache } from 'next/cache'

export const getCachedTenant = unstable_cache(
  async (slug: string) => {
    const payload = await getPayload({ config })
    return payload.find({ collection: 'tenants', where: { slug: { equals: slug } } })
  },
  ['tenant-lookup'],
  { revalidate: 300, tags: ['tenants'] } // 5min cache
)

export const getCachedPage = unstable_cache(
  async (siteId: string, path: string) => {
    const payload = await getPayload({ config })
    return payload.find({ collection: 'pages', where: { site: { equals: siteId }, path: { equals: path } }, depth: 3 })
  },
  ['page-data'],
  { revalidate: 300, tags: [`site-${siteId}`] }
)
```

- [ ] Cache tenant/site lookup (5min TTL, revalidateTag on update)
- [ ] Cache page data (5min TTL, revalidateTag on publish)
- [ ] Add `revalidateTag('site-{id}')` trong publish endpoint
- [ ] Cache domain lookup trong middleware (Upstash Redis, 5min TTL)
- [ ] Test: cache hit rate > 90% after warmup

**Expected:** DB queries giảm 80%, pageview 300ms → 50ms.

## Dò Lỗi

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| Upstash connection fail | Wrong URL/token | Check env vars in Vercel dashboard |
| Rate limit always blocks | Limit quá thấp | Tăng window size (5 → 10/min) |
| Cache stale sau publish | Thiếu revalidateTag | Add tag invalidation trong publish route |
| `unstable_cache` không cache | Missing revalidate param | Ensure `revalidate: 300` set |
| Upstash free tier exhausted | >10K commands/day | Upgrade Upstash Pay-as-you-go ($0.2/100K) |

## Env Vars Mới
```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
```

## Success Criteria
- [ ] Upstash Redis connected + working
- [ ] AI rate limit: max 5/user/min, 10 global/min
- [ ] Daily spend cap: $50/day → 429 error
- [ ] Cache hit rate > 90% for tenant/site
- [ ] Pageview < 200ms (cached)
- [ ] Ready cho 200 concurrent users
