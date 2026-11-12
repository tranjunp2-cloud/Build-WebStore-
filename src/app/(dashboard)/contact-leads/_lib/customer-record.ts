export type CustomerSource = 'contact-form' | 'newsletter'
export type CustomerStatus = 'new' | 'read' | 'contacted' | 'ignored' | 'subscribed'

export interface CustomerRecord {
    id: string // composite "{source}:{rawId}"
    rawId: number
    source: CustomerSource
    name: string | null
    email: string
    phone: string | null
    message: string | null
    status: CustomerStatus
    siteId: number | null
    createdAt: string
    /** Emails the shop sent to this person from this message (contact-form only), oldest first. */
    replies?: SentReply[]
}

export interface SentReply {
    subject: string
    body: string
    sentAt: string
    sentBy: string | null
}

export const CS_DB_TO_DISPLAY: Record<string, CustomerStatus> = {
    new: 'new',
    read: 'read',
    replied: 'contacted',
    archived: 'ignored',
}

// Maps display status → DB value for PATCH
export const CS_STATUS_TO_DB: Record<string, string> = {
    new: 'new',
    read: 'read',
    contacted: 'replied',
    ignored: 'archived',
}

export const CS_DISPLAY_TO_DB_STATUSES: Record<string, string[]> = {
    new: ['new'],
    read: ['read'],
    contacted: ['replied'],
    ignored: ['archived'],
}

function resolveSiteId(rawSite: unknown): number | null {
    if (rawSite == null) return null
    if (typeof rawSite === 'object') return Number((rawSite as Record<string, unknown>).id)
    return Number(rawSite)
}

export function mapContactSubmission(doc: Record<string, unknown>): CustomerRecord {
    return {
        id: `contact-form:${doc.id}`,
        rawId: doc.id as number,
        source: 'contact-form',
        name: (doc.name as string) || null,
        email: doc.email as string,
        phone: (doc.phone as string) || null,
        message: (doc.message as string) || null,
        status: CS_DB_TO_DISPLAY[(doc.status as string) ?? 'new'] ?? 'new',
        siteId: resolveSiteId(doc.site),
        createdAt: doc.createdAt as string,
        replies: mapReplies(doc.replies),
    }
}

function mapReplies(raw: unknown): SentReply[] {
    if (!Array.isArray(raw)) return []
    return raw.flatMap((r) => {
        const row = (r ?? {}) as Record<string, unknown>
        if (typeof row.subject !== 'string' || typeof row.body !== 'string' || !row.sentAt) return []
        return [{ subject: row.subject, body: row.body, sentAt: String(row.sentAt), sentBy: typeof row.sentBy === 'string' ? row.sentBy : null }]
    })
}

export function mapSubscriber(doc: Record<string, unknown>): CustomerRecord {
    return {
        id: `newsletter:${doc.id}`,
        rawId: doc.id as number,
        source: 'newsletter',
        name: null,
        email: doc.email as string,
        phone: null,
        message: null,
        status: 'subscribed',
        siteId: resolveSiteId(doc.site),
        createdAt: doc.createdAt as string,
    }
}
