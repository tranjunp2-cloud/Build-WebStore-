/**
 * Lookup helper for per-tenant email template config (F32).
 * Cache: Upstash Redis with 300s TTL → fallback to Payload DB → null.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { redis } from '../redis'
import type { EmailTemplateConfig, EmailTemplateType, EmailRecipient } from './types'

const CACHE_TTL_SECONDS = 300

export function templateConfigCacheKey(
    tenantId: string | number,
    type: EmailTemplateType,
    recipient: EmailRecipient,
): string {
    return `email_config:${tenantId}:${type}:${recipient}`
}

/**
 * Returns config from Redis cache (5 min TTL) → Payload DB → null on miss.
 * Does NOT cache null — missing rows skip caching so future creates are detected.
 */
export async function getTemplateConfig(
    tenantId: string | number,
    type: EmailTemplateType,
    recipient: EmailRecipient,
    locale: 'en' | 'ms' = 'en',
): Promise<EmailTemplateConfig | null> {
    const cacheKey = `${templateConfigCacheKey(tenantId, type, recipient)}:${locale}`

    // 1. Try Redis cache
    if (redis) {
        try {
            const cached = await redis.get<string>(cacheKey)
            if (cached) {
                return JSON.parse(cached) as EmailTemplateConfig
            }
        } catch {
            // Redis unavailable — proceed to DB
        }
    }

    // 2. Query Payload DB — overrideAccess required: called from webhook/hook contexts without user session
    const payload = await getPayload({ config })
    const result = await payload.find({
        collection: 'email-template-settings',
        where: {
            tenant: { equals: tenantId },
            templateType: { equals: type },
            recipient: { equals: recipient },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    })

    const row = result.docs[0]
    if (!row) return null

    type ContentFields = { subject?: string; greeting?: string; ctaLabel?: string; closing?: string }
    const contentEn = row.contentEn as ContentFields | undefined
    const contentMs = row.contentMs as ContentFields | undefined
    // Use locale-specific content; fall back to EN if MS fields are empty
    const content = locale === 'ms' ? (contentMs ?? contentEn) : contentEn

    const templateConfig: EmailTemplateConfig = {
        enabled: (row.enabled as boolean | undefined) ?? true,
        subject: content?.subject ?? undefined,
        greeting: content?.greeting ?? undefined,
        ctaLabel: content?.ctaLabel ?? undefined,
        closing: content?.closing ?? undefined,
    }

    // 3. Store in Redis (only on hit — do not cache null)
    if (redis) {
        try {
            await redis.set(cacheKey, JSON.stringify(templateConfig), { ex: CACHE_TTL_SECONDS })
        } catch {
            // Redis write failure is non-fatal
        }
    }

    return templateConfig
}

/**
 * Deletes all locale-specific Redis cache entries for the given tenant/type/recipient.
 * Called from afterChange and afterDelete hooks on EmailTemplateSettings.
 * Must delete both :en and :ms variants — the base key is never stored directly.
 */
export async function invalidateTemplateConfigCache(
    tenantId: string | number,
    type: EmailTemplateType,
    recipient: EmailRecipient,
): Promise<void> {
    if (!redis) return
    const base = templateConfigCacheKey(tenantId, type, recipient)
    try {
        await Promise.all([redis.del(`${base}:en`), redis.del(`${base}:ms`)])
    } catch {
        // Non-fatal — stale cache will expire naturally after TTL
    }
}
