'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import type { Where } from 'payload'
import {
    mapContactSubmission,
    mapSubscriber,
    CS_DISPLAY_TO_DB_STATUSES,
    CS_STATUS_TO_DB,
} from './_lib/customer-record'
import { toCsv } from './_lib/csv-exporter'
import type { CustomerRecord } from './_lib/customer-record'

type CustomerFilters = {
    search?: string
    status?: string   // new | contacted | ignored | subscribed | ''
    source?: string   // contact-form | newsletter | ''
    page?: number
    limit?: number
}

async function requireTenantId(): Promise<string> {
    const tenantId = await getCurrentTenantId()
    if (!tenantId) throw new Error('Unauthorized')
    return tenantId
}

// Resolve site IDs owned by this tenant (shared by list + mutation guards)
async function getTenantSiteIds(payload: Awaited<ReturnType<typeof getPayload>>, tenantId: string): Promise<number[]> {
    const res = await payload.find({
        collection: 'sites',
        where: { tenant: { equals: tenantId } },
        limit: 100,
        depth: 0,
    })
    return res.docs.map(s => s.id as number)
}

// IDOR guard — throws if record's site doesn't belong to this tenant
function assertSiteOwnership(siteId: number | null, siteIds: number[]): void {
    if (!siteId || !siteIds.includes(siteId)) throw new Error('Unauthorized')
}

function buildContactWhere(siteIds: number[], search: string, displayStatus: string): Where {
    const conditions: Where[] = [{ site: { in: siteIds } }]
    if (search) {
        conditions.push({ or: [{ email: { like: search } }, { name: { like: search } }] })
    }
    if (displayStatus && CS_DISPLAY_TO_DB_STATUSES[displayStatus]) {
        const dbStatuses = CS_DISPLAY_TO_DB_STATUSES[displayStatus]!
        conditions.push(
            dbStatuses.length === 1
                ? { status: { equals: dbStatuses[0] } }
                : { or: dbStatuses.map(s => ({ status: { equals: s } })) },
        )
    }
    return { and: conditions }
}

// Internal — no pagination cap, shared by paginated list + export
async function queryAllCustomers(tenantId: string, search: string, status: string, source: string, dedup = true): Promise<CustomerRecord[]> {
    const payload = await getPayload({ config: configPromise })
    const siteIds = await getTenantSiteIds(payload, tenantId)
    if (siteIds.length === 0) return []

    // 'subscribed' is newsletter-only — skip contact query to avoid returning all contacts
    const doContact = (!source || source === 'contact-form') && status !== 'subscribed'
    // 'read' is contact-only — skip newsletter query when filtering by contact-only statuses
    const doNewsletter = (!source || source === 'newsletter') && !['new', 'contacted', 'ignored', 'read'].includes(status)

    const [contactDocs, subscriberDocs] = await Promise.all([
        doContact
            ? payload
                  .find({
                      collection: 'contact-submissions',
                      where: buildContactWhere(siteIds, search, status),
                      sort: '-createdAt',
                      limit: 1000,
                      depth: 0,
                  })
                  .then(r => r.docs)
            : Promise.resolve([]),
        doNewsletter
            ? payload
                  .find({
                      collection: 'subscribers',
                      where: search
                          ? { and: [{ site: { in: siteIds } }, { email: { like: search } }] }
                          : { site: { in: siteIds } },
                      sort: '-createdAt',
                      limit: 1000,
                      depth: 0,
                  })
                  .then(r => r.docs)
            : Promise.resolve([]),
    ])

    const contactRecords = contactDocs.map(d => mapContactSubmission(d as Record<string, unknown>))
    const subscriberRecords = subscriberDocs.map(d => mapSubscriber(d as Record<string, unknown>))

    let resolvedContacts: CustomerRecord[]
    if (dedup) {
        // Keep latest submission per email for the list view
        const emailMap = new Map<string, CustomerRecord>()
        for (const r of contactRecords) {
            const existing = emailMap.get(r.email)
            if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
                emailMap.set(r.email, r)
            }
        }
        resolvedContacts = [...emailMap.values()]
    } else {
        resolvedContacts = contactRecords
    }

    return [...resolvedContacts, ...subscriberRecords]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function getCustomersAction(filters: CustomerFilters = {}) {
    const tenantId = await requireTenantId()
    const { search = '', status = '', source = '', page = 1, limit = 20 } = filters
    const safeLimit = Math.min(200, Math.max(1, limit))
    const all = await queryAllCustomers(tenantId, search, status, source)
    const start = (page - 1) * safeLimit
    return JSON.parse(
        JSON.stringify({
            data: all.slice(start, start + safeLimit),
            meta: { page, limit: safeLimit, total: all.length },
        }),
    )
}

export async function updateContactStatusAction(rawId: number, displayStatus: string) {
    const tenantId = await requireTenantId()
    const dbStatus = CS_STATUS_TO_DB[displayStatus]
    if (!dbStatus) throw new Error('Invalid status')
    const payload = await getPayload({ config: configPromise })

    // Resolve email + siteId from the target record
    const sourceDoc = await payload.findByID({ collection: 'contact-submissions', id: rawId, depth: 0 })
    const sourceRecord = mapContactSubmission(sourceDoc as Record<string, unknown>)

    // IDOR guard — verify the submission belongs to this tenant
    const siteIds = await getTenantSiteIds(payload, tenantId)
    assertSiteOwnership(sourceRecord.siteId, siteIds)

    // Batch update all submissions for the same email + site
    const siblings = await payload.find({
        collection: 'contact-submissions',
        where: {
            and: [
                { email: { equals: sourceRecord.email } },
                { site: { equals: sourceRecord.siteId } },
            ],
        },
        limit: 100,
        depth: 0,
    })
    await Promise.all(
        siblings.docs.map(doc =>
            payload.update({
                collection: 'contact-submissions',
                id: doc.id as number,
                data: { status: dbStatus },
                depth: 0,
            }),
        ),
    )

    const updated = await payload.findByID({ collection: 'contact-submissions', id: rawId, depth: 0 })
    return JSON.parse(JSON.stringify(mapContactSubmission(updated as Record<string, unknown>)))
}

export async function deleteCustomerAction(rawId: number, source: string) {
    const tenantId = await requireTenantId()
    const collection = source === 'contact-form' ? 'contact-submissions' : source === 'newsletter' ? 'subscribers' : null
    if (!collection) throw new Error('Invalid source')
    const payload = await getPayload({ config: configPromise })

    // IDOR guard — verify the record belongs to this tenant before deleting
    const doc = await payload.findByID({ collection, id: rawId, depth: 0 })
    const record = source === 'contact-form'
        ? mapContactSubmission(doc as Record<string, unknown>)
        : mapSubscriber(doc as Record<string, unknown>)
    const siteIds = await getTenantSiteIds(payload, tenantId)
    assertSiteOwnership(record.siteId, siteIds)

    await payload.delete({ collection, id: rawId })
}

export async function exportCustomersCsvAction(filters: Omit<CustomerFilters, 'page' | 'limit'> = {}) {
    const tenantId = await requireTenantId()
    const { search = '', status = '', source = '' } = filters
    const all = await queryAllCustomers(tenantId, search, status, source, false)
    return toCsv(all)
}

export async function getCustomerDetailAction(rawId: number, source: string) {
    const tenantId = await requireTenantId()
    const payload = await getPayload({ config: configPromise })

    if (source === 'contact-form') {
        const doc = await payload.findByID({ collection: 'contact-submissions', id: rawId, depth: 0 })
        const record = mapContactSubmission(doc as Record<string, unknown>)

        // IDOR guard
        const siteIds = await getTenantSiteIds(payload, tenantId)
        assertSiteOwnership(record.siteId, siteIds)

        const timeline = await payload
            .find({
                collection: 'contact-submissions',
                where: {
                    and: [
                        { email: { equals: record.email } },
                        { site: { equals: record.siteId } },
                    ],
                },
                sort: '-createdAt',
                limit: 20,
                depth: 0,
            })
            .then(r => r.docs.map(d => mapContactSubmission(d as Record<string, unknown>)))
        return JSON.parse(JSON.stringify({ record, timeline }))
    }

    const doc = await payload.findByID({ collection: 'subscribers', id: rawId, depth: 0 })
    const record = mapSubscriber(doc as Record<string, unknown>)

    // IDOR guard
    const siteIds = await getTenantSiteIds(payload, tenantId)
    assertSiteOwnership(record.siteId, siteIds)

    return JSON.parse(JSON.stringify({ record, timeline: [] }))
}
