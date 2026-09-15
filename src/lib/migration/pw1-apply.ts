import { configureMigrationTransactions } from './pw1-transactions'
import { sql } from 'drizzle-orm'
import { withAtomicSiteWrite } from './pw1-atomic-write'
import { MigrationError } from './pw1-errors'
import { preparePw1SiteSettings } from './pw1-site-settings'
import type { WebsiteBlueprint } from './pw1-contract'
import { generateSiteSchema } from '@/lib/validations/ai'
import type { Payload } from 'payload'

export interface ApplyWebsiteOptions {
    onDesignUsage?: (usage: { model: string; totalTokens: number | null }) => void
    acquireWrite?: () => Promise<() => void>
    attemptId?: string
    onStage?: (stage: string) => Promise<void>
    signal?: AbortSignal
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
        configureMigrationTransactions(payload)
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
        await options.onStage?.('media')
        options.signal?.throwIfAborted()
        const sourceSettings = options.blueprint.nativeContract.site.settings
        const siteSettings = sourceSettings ? await preparePw1SiteSettings(sourceSettings, tenantId, payload) : undefined
        const applied = await withAtomicSiteWrite(payload, { id: options.siteId, updatedAt: String(site.updatedAt) }, pagesBefore.docs.map(p => ({ id: Number(p.id), updatedAt: String(p.updatedAt) })), async (scoped, beginWrite, tx) => {
            const productsBefore = await scoped.count({ collection: 'products', where: { site: { equals: options.siteId } } })
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
            await options.onStage?.('generation')
            let designUsage: { model: string; totalTokens: number | null } | undefined
            let generationError: unknown
            let expectedLayouts: Array<{ slug: string; types: string[] }> = []
            const response = await generateSiteService({
                payload: scoped, user: { ...user, collection: 'users' }, input, streaming: false,
                requestId: `pw1-${options.blueprint.storeId}-${options.sourceHash.slice(0, 12)}`,
                migration: {
                    targetSiteId: options.siteId,
                    sourceBlueprint: options.blueprint,
                    onGenerated: async result => {
                        expectedLayouts = (result.pages ?? []).map(page => ({ slug: String(page.slug), types: (page.blocks ?? []).map(block => String(block.blockType)) }))
                        await options.save('ai-generated-before-media.json', result)
                    },
                    beforeWrite: async () => {
                        options.signal?.throwIfAborted()
                        await options.onStage?.('waiting-write')
                        await beginWrite()
                        await options.onStage?.('write')
                    },
                    onFailure: error => { generationError = error },
                },
                onEvent: event => {
                    if (event.event === 'step') {
                        console.log(`[generation] ${JSON.stringify(event.data)}`)
                        if (event.data.step === 'ai-native-design-usage') {
                            const data = event.data as { model?: string; tokens?: { total_tokens?: number } }
                            designUsage = { model: String(data.model ?? 'unknown'), totalTokens: data.tokens?.total_tokens ?? null }
                            options.onDesignUsage?.(designUsage)
                        }
                    }
                },
            })
            if (designUsage) await options.save('usage.json', designUsage)
            const outcome = await response.json() as Record<string, unknown>
            await options.save('service-response.json', { httpStatus: response.status, ...outcome })
            if (!response.ok || outcome.success !== true) throw generationError ?? new MigrationError('GENERATION_FAILED', `Shared generation service failed (status ${response.status}); inspect service-response.json`, response.status === 429 || response.status >= 500)
            options.signal?.throwIfAborted()
            await options.onStage?.('verify')
            if (siteSettings) await scoped.update({ collection: 'sites', id: site.id, data: siteSettings })
            const persistedSite = await scoped.findByID({ collection: 'sites', id: options.siteId, depth: 0 })
            if (siteSettings) {
                for (const group of ['branding', 'contactInfo', 'socialLinks', 'seo'] as const) {
                    for (const [key, value] of Object.entries(siteSettings[group])) {
                        const actual = (persistedSite[group] as Record<string, unknown> | null)?.[key]
                        if (actual !== value) throw new Error(`Site settings verification failed: ${group}.${key}`)
                    }
                }
            }
            const persistedPages = await scoped.find({ collection: 'pages', where: { site: { equals: options.siteId } }, depth: 0, pagination: false })
            const productsAfter = await scoped.count({ collection: 'products', where: { site: { equals: options.siteId } } })
            const expectedSlugs = new Set(expectedLayouts.map(p => p.slug))
            if (persistedPages.docs.some(p => p.slug !== '404' && !expectedSlugs.has(String(p.slug)))) throw new MigrationError('RECONCILIATION', 'Unexpected persisted page')
            const unmatchedPages = [...persistedPages.docs]
            for (const expected of expectedLayouts) {
                const index = unmatchedPages.findIndex(p => p.slug === expected.slug && JSON.stringify(Array.isArray(p.layout) ? p.layout.map((b: { blockType: string }) => b.blockType) : []) === JSON.stringify(expected.types))
                const page = index < 0 ? undefined : unmatchedPages.splice(index, 1)[0]
                if (!page) throw new MigrationError('RECONCILIATION', `Missing distinct persisted page for ${expected.slug}`)
                const types = page && Array.isArray(page.layout) ? page.layout.map((b: { blockType: string }) => b.blockType) : []
                if (JSON.stringify(types) !== JSON.stringify(expected.types)) throw new MigrationError('RECONCILIATION', `Block count/order mismatch on ${expected.slug}`)
            }
            if (unmatchedPages.some(page => page.slug !== '404')) throw new MigrationError('RECONCILIATION', 'Unexpected extra persisted page')
            await options.save('reconciliation.json', { pages: expectedLayouts.length, blockCountsAndOrderVerified: true, siteSettingsVerified: Boolean(siteSettings), catalogCountUnchanged: productsBefore.totalDocs === productsAfter.totalDocs })
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
            await options.save('verified-candidate.json', summary)
            options.signal?.throwIfAborted()
            if (options.attemptId) await tx.execute(sql`INSERT INTO pw1_migration_commits(attempt_id,source_store_id,input_hash,summary) VALUES(${options.attemptId},${options.blueprint.storeId},${options.sourceHash},${JSON.stringify(summary)}::jsonb)`)
            await options.onStage?.('commit')
            return summary
        }, options.acquireWrite)
        await options.save('applied.json', applied)
        console.log(`Committed ${applied.pages.length} pages. Preview: ${applied.previewUrl}`)
        return applied
    } finally {
        try { if (payload && !options.payload) await payload.destroy() } finally { await lock.end() }
    }
}
