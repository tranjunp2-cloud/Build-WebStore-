/**
 * Contact-lead core shared by the Contact leads dashboard and the copilot's applier.
 *
 * `contact-submissions` is readable and writable by super-admins only, so (like the dashboard) every call
 * here uses the Local API without a user and keeps the workspace safe itself: a lead is touched only when
 * its site belongs to the caller's workspace (`getTenantSiteIds` + `assertSiteOwnership`). The status words
 * are the dashboard's: contacted = replied, ignored = archived.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

export type LeadActor = { tenantId: string }

/** A refusal the caller can word for the merchant (the reply could not go out, too many replies, ...). */
export class LeadServiceError extends Error {
    constructor(
        message: string,
        readonly code: 'INVALID' | 'RATE_LIMITED' | 'SEND_FAILED',
    ) {
        super(message)
        this.name = 'LeadServiceError'
    }
}
export type LeadDbStatus = 'new' | 'read' | 'replied' | 'archived'
export type LeadDisplayStatus = 'new' | 'read' | 'contacted' | 'ignored'

export const LEAD_DISPLAY_TO_DB: Record<LeadDisplayStatus, LeadDbStatus> = { new: 'new', read: 'read', contacted: 'replied', ignored: 'archived' }
export const LEAD_DB_TO_DISPLAY: Record<string, LeadDisplayStatus> = { new: 'new', read: 'read', replied: 'contacted', archived: 'ignored' }

type Cms = Awaited<ReturnType<typeof getPayload>>
type Doc = Record<string, unknown>

/** Site ids owned by the workspace (shared by list + mutation guards). */
export async function getTenantSiteIds(payload: Cms, tenantId: string): Promise<number[]> {
    const res = await payload.find({
        collection: 'sites',
        where: { tenant: { equals: tenantId } },
        limit: 100,
        depth: 0,
    })
    return res.docs.map((s) => s.id as number)
}

/** The site id of a lead (a relationship may come populated). */
export function leadSiteId(doc: Doc): number | null {
    const raw = doc.site
    if (raw == null) return null
    return Number(typeof raw === 'object' ? (raw as Doc).id : raw)
}

/** IDOR guard — throws if the record's site does not belong to this workspace. */
export function assertSiteOwnership(siteId: number | null, siteIds: number[]): void {
    if (!siteId || !siteIds.includes(siteId)) throw new Error('Unauthorized')
}

/** A lead of this workspace (throws `Unauthorized` for another one's). */
export async function getLeadAs(actor: LeadActor, leadId: number): Promise<{ lead: Doc; siteIds: number[] }> {
    const payload = await getPayload({ config })
    const lead = (await payload.findByID({ collection: 'contact-submissions', id: leadId, depth: 0 })) as unknown as Doc
    const siteIds = await getTenantSiteIds(payload, actor.tenantId)
    assertSiteOwnership(leadSiteId(lead), siteIds)
    return { lead, siteIds }
}

/** Every message of the same person (email) on the same site, newest first. */
export async function leadMessagesAs(payload: Cms, lead: Doc, limit = 100): Promise<Doc[]> {
    const res = await payload.find({
        collection: 'contact-submissions',
        where: { and: [{ email: { equals: lead.email as string } }, { site: { equals: leadSiteId(lead) } }] },
        sort: '-createdAt',
        limit,
        depth: 0,
    })
    return res.docs as unknown as Doc[]
}

export type LeadStatusWrite = { id: number; before: LeadDbStatus; updatedAt: string }

/**
 * The Contact leads page's status change: applies to every message of the same email on the same site.
 * Returns what each message was before (for undo) and the updatedAt each one has now.
 */
export async function setLeadStatusAs(actor: LeadActor, leadId: number, dbStatus: LeadDbStatus): Promise<{ lead: Doc; written: LeadStatusWrite[] }> {
    const payload = await getPayload({ config })

    // Resolve email + siteId from the target record
    const source = (await payload.findByID({ collection: 'contact-submissions', id: leadId, depth: 0 })) as unknown as Doc

    // IDOR guard — verify the submission belongs to this workspace
    const siteIds = await getTenantSiteIds(payload, actor.tenantId)
    assertSiteOwnership(leadSiteId(source), siteIds)

    // Batch update all submissions for the same email + site
    const siblings = await payload.find({
        collection: 'contact-submissions',
        where: {
            and: [
                { email: { equals: source.email as string } },
                { site: { equals: leadSiteId(source) } },
            ],
        },
        limit: 100,
        depth: 0,
    })
    const written = await Promise.all(
        siblings.docs.map(async (doc) => {
            const saved = (await payload.update({
                collection: 'contact-submissions',
                id: doc.id as number,
                data: { status: dbStatus },
                depth: 0,
            })) as unknown as Doc
            return { id: doc.id as number, before: ((doc as Doc).status as LeadDbStatus) ?? 'new', updatedAt: String(saved?.updatedAt ?? '') }
        }),
    )

    const lead = (await payload.findByID({ collection: 'contact-submissions', id: leadId, depth: 0 })) as unknown as Doc
    return { lead, written }
}

type StatusItem = { id: number; before: LeadDbStatus; updatedAt: string }

/** Whether every message still carries the `updatedAt` our own write left (and belongs to the workspace). */
export async function leadStatusesUntouchedAs(actor: LeadActor, items: ReadonlyArray<StatusItem>): Promise<boolean> {
    const payload = await getPayload({ config })
    const siteIds = await getTenantSiteIds(payload, actor.tenantId)
    const docs = await Promise.all(items.map((item) => payload.findByID({ collection: 'contact-submissions', id: item.id, depth: 0 }) as unknown as Promise<Doc>))
    docs.forEach((doc) => assertSiteOwnership(leadSiteId(doc), siteIds))
    return docs.every((doc, i) => String(doc.updatedAt ?? '') === items[i]!.updatedAt)
}

/**
 * Puts statuses back (undo of a status change, or of the "replied" a reply set) inside the workspace. The caller
 * has already checked (`leadStatusesUntouchedAs`) that nobody touched these messages since.
 */
export async function restoreLeadStatusesAs(actor: LeadActor, items: ReadonlyArray<StatusItem>): Promise<void> {
    const payload = await getPayload({ config })
    const siteIds = await getTenantSiteIds(payload, actor.tenantId)
    const docs = await Promise.all(items.map((item) => payload.findByID({ collection: 'contact-submissions', id: item.id, depth: 0 }) as unknown as Promise<Doc>))
    docs.forEach((doc) => assertSiteOwnership(leadSiteId(doc), siteIds))
    await Promise.all(items.map((item) => payload.update({ collection: 'contact-submissions', id: item.id, data: { status: item.before }, depth: 0 })))
}
