/** GET /api/admin/generations/[id] — bounded, Super Admin-safe debug detail. */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { serializeAdminGenerationDetail, type GenerationDetailSource, type GenerationRecoveryJobDetailSource } from '@/lib/ai/generation-recovery-policy'

type RouteContext = { params: Promise<{ id: string }> }
type PersistedPage = { id: string | number; title?: string | null; slug?: string | null; layout?: Array<Record<string, unknown>> | null }
const COMPONENT_CONTENT_FIELDS: Array<[string, string]> = [['headline', 'Tiêu đề'], ['subheadline', 'Tiêu đề phụ'], ['sectionLabel', 'Nhãn section'], ['title', 'Tiêu đề'], ['description', 'Mô tả'], ['content', 'Nội dung'], ['ctaText', 'Nút CTA'], ['buttonText', 'Nút CTA']]

function persistedPageComponents(page: PersistedPage) {
    return (Array.isArray(page.layout) ? page.layout : []).slice(0, 100).map((block, index) => ({
        order: index + 1,
        type: typeof block.blockType === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(block.blockType) ? block.blockType : 'unknown',
        label: typeof block.headline === 'string' ? block.headline.slice(0, 160) : typeof block.sectionLabel === 'string' ? block.sectionLabel.slice(0, 160) : typeof block.title === 'string' ? block.title.slice(0, 160) : null,
        fields: COMPONENT_CONTENT_FIELDS.flatMap(([key, label]) => typeof block[key] === 'string' && block[key].trim() ? [[label, block[key].trim().slice(0, 240)] as [string, string]] : []),
    }))
}

function isNotFoundError(error: unknown) {
    if (!error || typeof error !== 'object') return false
    const candidate = error as { status?: unknown; statusCode?: unknown }
    return candidate.status === 404 || candidate.statusCode === 404
}

function relationId(value: GenerationDetailSource['retryRootGeneration']) {
    if (!value) return null
    return String(typeof value === 'object' ? value.id : value)
}

export async function GET(req: NextRequest, ctx: RouteContext) {
    return withSuperAdmin(async (_request, context) => {
        const { id } = await ctx.params

        const numericId = Number(id)
        if (!/^\d+$/.test(id) || !Number.isSafeInteger(numericId) || numericId <= 0) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
        }

        let record: GenerationDetailSource
        let payload: Awaited<ReturnType<typeof getPayload>>
        try {
            payload = await getPayload({ config })
            record = await payload.findByID({
                collection: 'ai-generation-records',
                id: numericId,
                depth: 1,
                overrideAccess: true,
            }) as unknown as GenerationDetailSource
        } catch (error) {
            if (isNotFoundError(error)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
            console.error('[generation-detail] failed to load record', { generationId: numericId, error: error instanceof Error ? error.name : 'unknown' })
            return NextResponse.json({ error: 'Unable to load generation detail' }, { status: 500 })
        }

        try {
            // Resolve tenantSlug for public live URL if site is published
            let tenantSlug: string | null = null
            if (record.tenant && typeof record.tenant === 'object' && 'slug' in record.tenant && typeof record.tenant.slug === 'string') {
                tenantSlug = record.tenant.slug
            } else {
                const tenantId = relationId(record.tenant) ?? (typeof record.site === 'object' && record.site && 'tenant' in record.site ? relationId((record.site as { tenant?: unknown }).tenant as { id: string | number }) : null)
                if (tenantId) {
                    try {
                        const tenantDoc = await payload.findByID({
                            collection: 'tenants',
                            id: tenantId,
                            depth: 0,
                            overrideAccess: true,
                        })
                        if (tenantDoc?.slug && typeof tenantDoc.slug === 'string') {
                            tenantSlug = tenantDoc.slug
                        }
                    } catch {
                        // ignore fallback lookup failure
                    }
                }
            }

            // Bounded root-lineage and recovery job queries provide the exact
            // retry timeline without returning raw worker payloads or scans.
            const retryRootId = relationId(record.retryRootGeneration) ?? String(record.id)
            const history = await payload.find({
                collection: 'ai-generation-records',
                where: { or: [{ id: { equals: retryRootId } }, { retryRootGeneration: { equals: retryRootId } }] },
                depth: 0,
                limit: 10,
                sort: '-createdAt',
                overrideAccess: true,
            })
            const generationIds = Array.from(new Set([String(record.id), ...history.docs.map((item) => String(item.id))]))
            const jobs = await payload.find({
                collection: 'generation_recovery_jobs',
                where: { sourceGeneration: { in: generationIds } },
                depth: 0,
                limit: 10,
                sort: '-queuedAt',
                overrideAccess: true,
            })
            const detail = serializeAdminGenerationDetail(record, history.docs as unknown as GenerationDetailSource[], jobs.docs as unknown as GenerationRecoveryJobDetailSource[], tenantSlug)
            const siteId = detail.website.id
            const persisted = siteId ? await payload.find({ collection: 'pages', where: { site: { equals: siteId } }, depth: 0, limit: 100, pagination: false, overrideAccess: true }) : { docs: [] }
            const persistedById = new Map((persisted.docs as unknown as PersistedPage[]).map((page) => [String(page.id), page]))
            const pages = detail.pages.map((page) => {
                const persistedPage = page.pageId ? persistedById.get(String(page.pageId)) : undefined
                return { ...page, components: persistedPage ? persistedPageComponents(persistedPage) : [] }
            })
            return NextResponse.json({ data: { ...detail, pages } })
        } catch (error) {
            console.error('[generation-detail] failed to serialize safe detail', { generationId: numericId, error: error instanceof Error ? error.name : 'unknown' })
            return NextResponse.json({ error: 'Unable to load generation detail' }, { status: 500 })
        }
    })(req, ctx)
}
