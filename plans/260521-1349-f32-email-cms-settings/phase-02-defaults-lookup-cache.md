# Phase 02 — Default Config Seeder + Lookup Cache

> Implement lookup logic: `getTemplateConfig(tenantId, templateType, recipient)` với cache layer + seed default rows cho mỗi template.

## Context Links

- Phase 01 collection schema
- PRD §10 (Security): cache không leak cross-tenant
- Existing cache pattern: `src/lib/rateLimit.ts` (Upstash Redis)

## Overview

- **Priority:** P0
- **Status:** Pending
- **Depends on:** Phase 01

## Key Insights

- Lookup hot path: mỗi email send → 1 query. Cần cache để tránh N+1 ở high-volume scenarios
- Cache backend: Upstash Redis (đã có cho rate limit) — multi-instance safe
- Cache key: `email-template-config:{tenantId}:{templateType}:{recipient}` → TTL 5 phút
- Cache invalidation: Payload `afterChange` + `afterDelete` hooks → `redis.del(key)`
- Default seeder: tạo 1 row cho mỗi tenant × templateType × recipient combination với `enabled: true` + content `null` (= use default)
- Lazy seeder: thay vì seed khi tạo tenant, lazy-create row khi seller first edit (avoid bulk inserts)

## Requirements

- `getTemplateConfig({ tenantId, templateType, recipient })` returns:
  - `{ enabled: boolean, content: { en, ms } | null }` nếu có config
  - `{ enabled: true, content: null }` nếu chưa customize (default behavior)
- Cache TTL: 5 phút
- Invalidate on Payload `afterChange` + `afterDelete` hooks
- KHÔNG eager-seed — lazy create on first edit (avoids bulk insert on tenant creation)
- TypeScript helper exports type-safe enum

## Related Code Files

**Create:**
- `src/lib/email/get-template-config.ts` — lookup function with cache
- `src/lib/email/template-config-cache.ts` — Redis client wrapper (hoặc inline trong get-template-config)

**Modify:**
- `src/collections/EmailTemplateSettings.ts` — add `afterChange` + `afterDelete` hooks
- `src/lib/email/send.ts` — invoke `getTemplateConfig()` nếu lookup params present

## Implementation Steps

1. Đọc `src/lib/rateLimit.ts` để hiểu Upstash Redis client pattern
2. Create `get-template-config.ts`:
   ```ts
   export async function getTemplateConfig(opts: {
       tenantId: number,
       templateType: string,
       recipient: 'buyer' | 'seller',
   }): Promise<TemplateConfig | null> {
       const cacheKey = `email-template-config:${opts.tenantId}:${opts.templateType}:${opts.recipient}`

       // Try cache
       const cached = await redis.get(cacheKey)
       if (cached) return JSON.parse(cached)

       // Lookup DB
       const payload = await getPayload({ config })
       const { docs } = await payload.find({
           collection: 'email-template-settings',
           where: {
               and: [
                   { tenant: { equals: opts.tenantId } },
                   { templateType: { equals: opts.templateType } },
                   { recipient: { equals: opts.recipient } },
               ],
           },
           limit: 1,
       })

       const config = docs[0] ?? null
       // Cache (5min TTL)
       await redis.set(cacheKey, JSON.stringify(config), { ex: 300 })
       return config
   }
   ```
3. Add invalidation hooks trong `EmailTemplateSettings.ts`:
   ```ts
   hooks: {
       afterChange: [
           ({ doc }) => {
               const tenantId = typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
               redis.del(`email-template-config:${tenantId}:${doc.templateType}:${doc.recipient}`)
                   .catch(err => console.error('[F32] Cache invalidation failed:', err))
           },
       ],
       afterDelete: [
           ({ doc }) => { /* same pattern */ },
       ],
   }
   ```
4. Update `sendEmail()` trong `send.ts`:
   ```ts
   export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
       let config = null
       if (opts.templateType && opts.recipient && opts.tenantId) {
           config = await getTemplateConfig({ ... })
           if (config && config.enabled === false) {
               console.log('[Email] Skipped (disabled by tenant):', opts.templateType)
               return true   // gracefully skip, not error
           }
       }
       // Pass config to template render (Phase 04 wires this)
       // ... existing send logic
   }
   ```
5. Verify cache hit rate via manual test: send same email 2 lần → 2nd call should be cache hit
6. Verify invalidation: edit setting → cache key deleted → next lookup re-fetches

## Todo List

- [ ] Create `get-template-config.ts` với Redis cache
- [ ] Add afterChange + afterDelete hooks cho cache invalidation
- [ ] Update `sendEmail()` để invoke lookup (gracefully skip if disabled)
- [ ] Unit test: cache hit/miss/invalidation
- [ ] Manual test: disable template → send → no email (correctly skipped)
- [ ] Logging: cache hit/miss metrics (optional, helpful cho monitoring)

## Success Criteria

- `getTemplateConfig()` returns correct config từ DB
- Cache hit reduces query count (verify with log/metrics)
- Invalidation works: edit setting → cache cleared → next lookup re-fetches
- Disabled template → `sendEmail()` skip silently, returns `true`
- No regression: existing email sends (without lookup params) still work

## Risk Assessment

- **Risk:** Redis down → lookup fails → email không gửi
  - **Mitigation:** Graceful fallback: nếu Redis error → skip cache, query DB direct + log warning
- **Risk:** Stale cache nếu invalidation hook fails silently
  - **Mitigation:** Log invalidation errors; TTL 5min upper bound staleness
- **Risk:** Cache key collision nếu enum value change
  - **Mitigation:** Include schema version in key prefix (vd `v1:email-template-config:...`)
- **Risk:** Per-tenant cache memory bloat (16+ templates × N tenants)
  - **Mitigation:** Upstash Redis pricing — 16 × 10,000 tenants = 160k keys, well within free tier

## Security Considerations

- Cache key includes `tenantId` → no cross-tenant leak
- Redis client KHÔNG accept tenant input directly (whitelist enum values only)
- Log KHÔNG include sensitive content (subject/greeting) — only counts

## Next Steps

- Unlocks Phase 04 (template render integration)
