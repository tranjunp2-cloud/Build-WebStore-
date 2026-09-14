import { preparePw1SiteSettings } from './pw1-site-settings'
import type { WebsiteBlueprint } from './pw1-contract'
import { generateSiteSchema } from '@/lib/validations/ai'
import type { Payload } from 'payload'

export interface ApplyWebsiteOptions {
    payload?: Payload
    blueprint: WebsiteBlueprint
    account: string
    siteId: number
    sourceHash: string
    save: (name: string, data: unknown) => Promise<unknown>
}

/** CLI entry into the same generation/media/persistence service used by the API.
 * Destination credentials are supplied by the deployment environment. */
export async function applyPw1Website(options: ApplyWebsiteOptions) {
    const connectionString = process.env.DATABASE_URI || process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URI or DATABASE_URL is required')
    const databaseUrl = new URL(connectionString)
    if (!process.env.PAYLOAD_SECRET || !process.env.OPENAI_API_KEY) throw new Error('PAYLOAD_SECRET and OPENAI_API_KEY are required')
    process.env.PAYLOAD_PUSH_SCHEMA = 'false'
    const { Client } = await import('pg')
    const lock = new Client({ connectionString })
    let payload: Payload | undefined
    await lock.connect()
    try {
        const result = await lock.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1,$2) AS locked', [351826, options.siteId])
        if (!result.rows[0]?.locked) throw new Error('Another CLI migration is running for this site')
        // Fail before page replacement if the destination lacks the slide schema,
        // including Payload's version table used by draft writes.
        await lock.query('SELECT slides FROM pages_blocks_hero LIMIT 0')
        await lock.query('SELECT slides FROM _pages_v_blocks_hero LIMIT 0')
        const { getPayload } = await import('payload')
        const { default: config } = await import('@payload-config')
        payload = options.payload ?? await getPayload({ config })
        const users = await payload.find({ collection: 'users', where: { email: { equals: options.account } }, depth: 0, limit: 2 })
        if (users.docs.length !== 1) throw new Error('Expected exactly one matching PW2 account')
        const user = users.docs[0]
        const site = await payload.findByID({ collection: 'sites', id: options.siteId, depth: 0 })
        const tenantId = typeof site.tenant === 'object' && site.tenant ? site.tenant.id : site.tenant
        const memberships = user.tenants as Array<{ tenant: number | string | { id: number | string }; role?: string; status?: string }> | undefined
        if (!memberships?.some(entry => String(typeof entry.tenant === 'object' ? entry.tenant.id : entry.tenant) === String(tenantId)
            && entry.role === 'owner' && entry.status === 'active')) throw new Error('Target account is not an active owner of this site')
        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0 })
        const pagesBefore = await payload.find({ collection: 'pages', where: { site: { equals: options.siteId } }, depth: 0, pagination: false })
        // Durable, exclusive backup before the shared service can replace page rows.
        await options.save('site-before.json', { sourceHash: options.sourceHash, site, pages: pagesBefore.docs })
        const sourceSettings = options.blueprint.nativeContract.site.settings
        const siteSettings = sourceSettings ? await preparePw1SiteSettings(sourceSettings, tenantId, payload) : undefined
        const productsBefore = await payload.count({ collection: 'products', where: { site: { equals: options.siteId } } })
        const input = generateSiteSchema.parse({
            businessInfo: {
                businessName: options.blueprint.siteName,
                shortDescription: options.blueprint.description || options.blueprint.siteName,
                industry: 'ecommerce',
                products: 'Existing PW1 catalog; preserve source references, do not create sample products.',
            },
            language: options.blueprint.nativeContract.site.locale ?? 'en', generationLocale: options.blueprint.nativeContract.site.locale ?? 'en',
            extraInstructions: 'Recreate the supplied PW1 pages and components. Source blueprint is authoritative; no sample catalog or invented page content.',
        })
        console.log(`Applying source store ${options.blueprint.storeId} to PW2 user ${user.id}, tenant ${tenantId}, site ${site.id} on ${databaseUrl.hostname}.`)
        const { generateSiteService } = await import('@/lib/ai/generate-site-service')
        const response = await generateSiteService({
            payload, user: { ...user, collection: 'users' }, input, streaming: false,
            requestId: `pw1-${options.blueprint.storeId}-${options.sourceHash.slice(0, 12)}`,
            migration: { targetSiteId: options.siteId, sourceBlueprint: options.blueprint, onGenerated: result => options.save('ai-generated-before-media.json', result) },
            onEvent: event => { if (event.event === 'step') console.log(`[generation] ${JSON.stringify(event.data)}`) },
        })
        const outcome = await response.json() as Record<string, unknown>
        await options.save('service-response.json', { httpStatus: response.status, ...outcome })
        if (!response.ok || outcome.success !== true) throw new Error(`Shared generation service failed (status ${response.status}); inspect saved service-response.json and site-before.json artifacts`)
        if (siteSettings) await payload.update({ collection: 'sites', id: site.id, data: siteSettings })
        const persistedSite = await payload.findByID({ collection: 'sites', id: options.siteId, depth: 0 })
        if (siteSettings) {
            for (const group of ['branding', 'contactInfo', 'socialLinks', 'seo'] as const) {
                for (const [key, value] of Object.entries(siteSettings[group])) {
                    const actual = (persistedSite[group] as Record<string, unknown> | null)?.[key]
                    if (actual !== value) throw new Error(`Site settings verification failed: ${group}.${key}`)
                }
            }
        }
        const persistedPages = await payload.find({ collection: 'pages', where: { site: { equals: options.siteId } }, depth: 0, pagination: false })
        const productsAfter = await payload.count({ collection: 'products', where: { site: { equals: options.siteId } } })
        const actualSlugs = new Set(persistedPages.docs.map(page => String(page.slug).replace(/^\//, '')))
        const expectedPages = options.blueprint.pages.filter(page => page.kind === 'content')
        const missingPages = expectedPages.filter(page => !actualSlugs.has(page.isHomepage ? '' : page.slug) && !actualSlugs.has(page.slug))
        if (missingPages.length || productsBefore.totalDocs !== productsAfter.totalDocs) throw new Error('Post-write verification failed: missing source pages or catalog count changed')
        const appUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        const summary = {
            status: 'persisted', sourceHash: options.sourceHash, siteId: options.siteId, userId: user.id, tenantId,
            siteStatus: persistedSite.status, generationStatus: persistedSite.generationStatus,
            previewUrl: `${appUrl}/preview/${options.siteId}`,
            editorUrl: `${appUrl}/editor/${options.siteId}`,
            storefrontUrl: `${appUrl}/sites/${tenant.slug}`,
            pages: persistedPages.docs.map(page => ({ id: page.id, title: page.title, slug: page.slug, blocks: Array.isArray(page.layout) ? page.layout.length : 0 })),
            catalogCountUnchanged: true, sourceMigration: outcome.sourceMigration ?? null,
        }
        await options.save('applied.json', summary)
        console.log(`Persisted ${persistedPages.docs.length} pages. Preview: ${summary.previewUrl}`)
        return summary
    } finally {
        try { if (payload && !options.payload) await payload.destroy() } finally { await lock.end() }
    }
}
