import type { Payload } from 'payload'

/**
 * Audit trail for a storefront going live or offline (`site_status_events`, created in scripts/db-setup.js).
 *
 * Support needs to answer "who took this store offline, and when" long after request logs have expired, so
 * every successful Publish / Unpublish writes one row. Writing is best-effort: a failed insert is logged and
 * swallowed, because the merchant's publish must never fail over an audit row.
 */
export type SiteStatusAction = 'publish' | 'unpublish'

/** Where the action came from: the editor buttons, the web builder copilot, or the PW1 migration grant. */
export type SiteStatusSource = 'editor' | 'copilot' | 'pw1-migration'

export interface SiteStatusEventInput {
    siteId: string | number
    tenantId: string | number | null
    user: { id: string | number; email?: string | null }
    action: SiteStatusAction
    source: SiteStatusSource
    /** site status before the action (e.g. `draft` for a first publish) */
    previousStatus: string | null
}

type DrizzleLike = { execute: (query: unknown) => Promise<unknown> }

export async function recordSiteStatusEvent(payload: Payload, input: SiteStatusEventInput): Promise<void> {
    try {
        const db = (payload.db as unknown as { drizzle?: DrizzleLike } | undefined)?.drizzle
        if (!db) {
            console.warn('[site-status-events] no drizzle handle, event not recorded', { siteId: input.siteId, action: input.action })
            return
        }
        const { sql } = await import('drizzle-orm')
        const userId = Number(input.user.id)
        const tenantId = input.tenantId == null ? null : Number(input.tenantId)
        await db.execute(sql`
            INSERT INTO site_status_events (site_id, tenant_id, user_id, user_email, action, source, previous_status)
            VALUES (
                ${Number(input.siteId)},
                ${Number.isFinite(tenantId) ? tenantId : null},
                ${Number.isFinite(userId) ? userId : null},
                ${input.user.email ?? null},
                ${input.action},
                ${input.source},
                ${input.previousStatus}
            )
        `)
    } catch (err) {
        console.error('[site-status-events] failed to record event', {
            siteId: input.siteId,
            action: input.action,
            error: err instanceof Error ? err.message : String(err),
        })
    }
}
