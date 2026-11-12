export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { withAuth } from '@/lib/auth'
import { normalizeSocialWidgetConfig } from '@/blocks/social-widget/config'
import { getCachedSidebarBadgeCounts } from '@/lib/dashboard/sidebar-badge-counts-cached'
import type { SidebarBadgeKey } from '@/config/sidebar-nav'
import { stripPrivateSnapshots } from '@/lib/payload/safe-populate'
import { formatDraftVersion, poolExec, readEditorRevision, type EditorRevision } from '@/lib/sites/editor-revision'

function normalizeEditorLayout(layout: unknown) {
    if (!Array.isArray(layout)) return []

    return layout.map(block => {
        if (block && typeof block === 'object') {
            const b = block as Record<string, unknown>
            if (b.blockType === 'socialWidget') {
                return normalizeSocialWidgetConfig(b)
            }
        }

        return block
    })
}

/**
 * GET /api/sites/[siteId]/editor-data
 * Returns site + homepage data for the editor.
 * Uses Payload's Local API (no REST auth issues).
 */
export const GET = withAuth<{ params: Promise<{ siteId: string }> }>(async (user, req, ctx) => {
    try {
        const payload = await getPayload({ config })
        const { siteId } = await ctx.params
        const numericSiteId = Number(siteId)
        const pageId = new URL(req.url).searchParams.get('pageId')

        // Fetch site (depth: 1 to populate tenant for siteUrl computation)
        // The tenant comes trimmed to what is read below (slug, domains): the whole ~70-column row rode along (TC-PERF-070)
        const site = await payload.findByID({
            collection: 'sites',
            id: siteId,
            depth: 1,
            disableErrors: true,
            populate: { tenants: { name: true, slug: true, customDomains: true } },
        })

        if (!site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 })
        }

        // The draft revision is read BEFORE the content: a write landing in between leaves the editor
        // with an older revision than its content (its next save is refused), never the reverse.
        const revisionExec = poolExec(payload)
        const revisionBefore: EditorRevision | null = Number.isSafeInteger(numericSiteId) && numericSiteId > 0
            ? await readEditorRevision(revisionExec, numericSiteId, pageId && /^\d+$/.test(pageId) ? Number(pageId) : null).catch(() => null)
            : null

        type TenantRef = string | number | { id: string | number } | null | undefined
        const resolveTenantId = (t: TenantRef): string | null =>
            t == null ? null : String(typeof t === 'object' ? t.id : t)

        const rawTenants = Array.isArray(user.tenants) ? user.tenants : []
        const tenantIds = rawTenants
            .map((t: { tenant: TenantRef }) => resolveTenantId(t.tenant))
            .filter((id): id is string => id !== null)

        const siteTenantId = resolveTenantId(site.tenant as TenantRef)
        if (!siteTenantId || !tenantIds.includes(siteTenantId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Matched tenant-membership row (already auth-checked above) — source of role + permissions for
        // the editor menu drawer's RBAC gate. Same shape the dashboard layout reads (currentTenantInfo).
        const matchedMembership = rawTenants.find(
            (t: { tenant: TenantRef }) => resolveTenantId(t.tenant) === siteTenantId,
        ) as { role?: string; permissions?: string[] } | undefined

        // Sidebar badge counts (orders/products/...) — scoped to the site's tenant, cached 60s per-tenant
        // (same cost the dashboard pays). Non-fatal: a failure shows no badges, never blanks the editor.
        // Started now, awaited at the end: it does not depend on the page reads below (TC-PERF-070).
        const badgeCountsPromise: Promise<Partial<Record<SidebarBadgeKey, number>>> = Promise.resolve()
            .then(() => getCachedSidebarBadgeCounts(siteTenantId))
            .catch((err) => {
                console.warn('[editor-data] sidebar badge counts failed:', err)
                return {}
            })

        const isSuperAdmin = Boolean((user as { roles?: string[] }).roles?.includes('super-admin'))
        // Env gate for any future dev-only nav item — mirror the dashboard layout (server-side; not NEXT_PUBLIC).
        const isProduction = (process.env.VERCEL_ENV ?? process.env.NODE_ENV) === 'production'

        let page: NonNullable<Awaited<ReturnType<typeof payload.findByID>>> | null = null

        if (pageId) {
            if (!/^\d+$/.test(pageId)) {
                return NextResponse.json({ error: 'Invalid pageId' }, { status: 400 })
            }
            let requestedPage: NonNullable<Awaited<ReturnType<typeof payload.findByID>>> | null = null
            try {
                requestedPage = await payload.findByID({
                    collection: 'pages',
                    id: pageId,
                    draft: true,
                })
            } catch {
                // Page not found — fall through to homepage
            }

            const requestedPageSiteId =
                typeof requestedPage?.site === 'object' ? requestedPage.site?.id : requestedPage?.site

            if (requestedPage && Number(requestedPageSiteId) === numericSiteId) {
                page = requestedPage
            }
        }

        if (!page) {
            let pagesResult = await payload.find({
                collection: 'pages',
                where: {
                    site: { equals: numericSiteId },
                    isHomepage: { equals: true },
                },
                limit: 1,
                pagination: false, // no COUNT over the versions table (TC-PERF-070)
                draft: true, // From staging: include drafts
            })

            if (pagesResult.docs.length === 0) {
                pagesResult = await payload.find({
                    collection: 'pages',
                    where: { site: { equals: numericSiteId } },
                    limit: 1,
                    pagination: false,
                    draft: true, // From staging: include drafts
                })
            }

            page = pagesResult.docs[0] || null
        }

        // the homepage fallback (no or unknown pageId): its revision is read now
        let draftVersion: string | undefined
        if (revisionBefore) {
            const pagePart = !page
                ? null
                : String(page.id) === pageId
                    ? revisionBefore.page
                    : (await readEditorRevision(revisionExec, numericSiteId, Number(page.id)).catch(() => null))?.page ?? null
            draftVersion = formatDraftVersion({ site: revisionBefore.site, page: pagePart })
        }

        // F-26: Fetch locale_content from pages table (raw SQL — not a Payload field)
        let localeContent: Record<string, unknown> = {}
        if (page) {
            try {
                const db = payload.db.drizzle as { execute: (q: unknown) => Promise<{ rows: Array<{ locale_content: unknown }> }> }
                const result = await db.execute(sql`
                    SELECT locale_content FROM pages WHERE id = ${page.id} LIMIT 1
                `)
                const row = result.rows?.[0]
                if (row?.locale_content && typeof row.locale_content === 'object') {
                    localeContent = stripPrivateSnapshots(row.locale_content as Record<string, unknown>)
                }
            } catch {
                // Non-fatal — locale_content is additive
            }
        }

        const badgeCounts = await badgeCountsPromise

        return NextResponse.json({
            site: {
                id: site.id,
                name: site.name || 'Untitled',
                domain: site.domain || null,
                status: site.status || 'draft',
                theme: site.theme || {},
                siteType: site.siteType || 'business',
                locale: site.locale || 'ms',
                generationLocale: ((site as Record<string, unknown>).generationLocale as string) || site.locale || 'ms',
                pendingLocaleConfirm: (site as Record<string, unknown>).pendingLocaleConfirm === true,
                contactInfo: site.contactInfo || {},
                // F37 US-01: structured local-business address/geo/hours for Local SEO.
                localBusiness: site.localBusiness || {},
                socialLinks: site.socialLinks || {},
                branding: site.branding || {},
                seo: site.seo || {},
                // Editor loads pending draft when available (null = no pending changes, fall back to live).
                // Explicit null check avoids treating `{}` as "no pending" (falsy-OR would shadow live data).
                headerBlock: site.pendingHeaderBlock != null
                    ? (site.pendingHeaderBlock as typeof site.headerBlock)
                    : site.headerBlock ?? null,
                footerBlock: site.pendingFooterBlock != null
                    ? (site.pendingFooterBlock as typeof site.footerBlock)
                    : site.footerBlock ?? null,
                globalBlocks: site.pendingGlobalBlocks != null
                    ? (site.pendingGlobalBlocks as typeof site.globalBlocks)
                    : site.globalBlocks ?? null,
                shippingConfig: site.shippingConfig || {},
                publishedAt: site.publishedAt || null,
                tenantSlug: (typeof site.tenant === 'object' && site.tenant !== null)
                    ? (site.tenant as Record<string, unknown>).slug as string || null
                    : null,
                primaryDomain: (() => {
                    if (typeof site.tenant === 'object' && site.tenant !== null) {
                        const tenant = site.tenant as Record<string, unknown>
                        const domains = Array.isArray(tenant.customDomains) ? tenant.customDomains : []
                        const primary = domains.find(
                            (d: Record<string, unknown>) => d.isPrimary === true && d.status === 'active'
                        )
                        return (primary as Record<string, unknown>)?.domain as string || null
                    }
                    return null
                })(),
            },
            /** The editor draft revision — sent back as `base` with each save (lib/sites/editor-revision) */
            ...(draftVersion ? { draftVersion } : {}),
            page: page ? {
                id: page.id,
                title: page.title || 'Homepage',
                layout: normalizeEditorLayout(page.layout),
                _status: page._status || 'published',
                updatedAt: page.updatedAt,
                /** F-26: Per-block locale content map for multilingual editor */
                localeContent,
                /** The page draft's SEO (the copilot's SEO proposals land here) */
                seo: { title: (page.seo as { title?: string | null } | undefined)?.title ?? null, description: (page.seo as { description?: string | null } | undefined)?.description ?? null },
            } : null,
            user: {
                firstName: (user as Record<string, unknown>).firstName as string || null,
                email: user.email || null,
                // avatar is a Payload Media object (depth≥1) or a numeric ID (depth=0) or null
                avatar: (user as Record<string, unknown>).avatar ?? null,
                // Role from matched tenant — guaranteed to exist since tenant check above returns 403 if no match
                role: matchedMembership?.role || 'viewer',
                // RBAC inputs for the editor menu drawer (parity with dashboard sidebar). Restrictive
                // defaults: empty permissions + non-super-admin never widen visibility.
                permissions: matchedMembership?.permissions ?? [],
                isSuperAdmin,
                isProduction,
                badgeCounts,
            },
        })

    } catch (error) {
        console.error('[Editor Data Error]', error)
        return NextResponse.json(
            { error: 'Failed to load editor data' },
            { status: 500 },
        )
    }
})
