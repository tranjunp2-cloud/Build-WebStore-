---
name: redis-vs-inmemory-cache
description: Distributed cache = Upstash Redis client in rateLimit.ts; cache.ts is in-memory only
metadata:
  type: project
---

Two caches exist: `src/lib/cache.ts` is a simple in-memory TTL Map (per-instance, NOT distributed — used for dashboard/analytics). The only Upstash Redis client lives in `src/lib/rateLimit.ts` (`@upstash/redis`, env `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, graceful null fallback when env absent).

**Why:** Vercel serverless = ephemeral instances, so in-memory cache can't be shared/invalidated across requests. Per-tenant config caching needs Redis.
**How to apply:** For distributed/per-tenant cache, reuse the Upstash client (consider extracting to `src/lib/redis.ts` to avoid a 2nd `new Redis()` — DRY). Use `cache.ts` only for per-instance ephemeral caching.
