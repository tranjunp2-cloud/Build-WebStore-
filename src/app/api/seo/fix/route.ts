import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { checkRateLimit } from '@/lib/rateLimit'
import { SEO_CONTEXT_MAX_CHARS } from '@ech/ai-contracts'
import { describeAiTaskFailure } from '@/lib/ai-platform/ai-tasks'
import { AI_UNAVAILABLE_MESSAGE, isAiTasksEnabled } from '@/lib/ai-platform/config'
import { resolveActorForUser } from '@/lib/ai-platform/context'
import { getAiTaskClient } from '@/lib/ai-platform/task-client'
import type { PlatformUser } from '@/types/user'

/**
 * POST /api/seo/fix
 * Uses AI (GPT-4o-mini) to auto-generate missing meta titles and descriptions
 * for all pages in a site. The site must belong to a workspace the caller is
 * an active member of (super-admins excepted).
 *
 * Body: { siteId: string }
 */

type TenantRef = string | number | { id: string | number } | null | undefined
type SeoMetaResult = { metaTitle?: string; metaDescription?: string }

function tenantId(value: TenantRef): string | null {
    if (value == null) return null
    return String(typeof value === 'object' ? value.id : value)
}

function activeTenantIds(user: unknown): Set<string> {
    const memberships = (user as { tenants?: Array<{ tenant?: TenantRef; status?: string }> }).tenants ?? []
    return new Set(
        memberships.flatMap((membership) => {
            const id = tenantId(membership.tenant)
            return membership.status === 'active' && id ? [id] : []
        }),
    )
}

const forbidden = () =>
    NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } },
        { status: 403 },
    )

import { seoFixSchema } from '@/lib/validations/seo'
import { parseRequest } from '@/lib/validations/helpers'

export const POST = withFeatureGuard('content_management')(withAuth(async (user, request) => {
    try {
        const payload = await getPayload({ config })

        // Rate Limit: 20 AI tasks per hour
        const rateLimit = await checkRateLimit(`ai:seo-fix:${user.id}`, 20)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again later.' },
                { status: 429 }
            )
        }

        const { data, errorResponse } = await parseRequest(request, seoFixSchema)
        if (errorResponse) return errorResponse
        
        const { siteId } = data!

        const isSuperAdmin = user.roles?.includes('super-admin') === true
        const userTenantIds = activeTenantIds(user)
        // Inactive memberships are denied before any protected Local API read.
        if (!isSuperAdmin && userTenantIds.size === 0) return forbidden()

        // Get site info — read with the caller's access so another tenant's site is not found.
        const site = await payload.findByID({
            collection: 'sites',
            id: siteId,
            depth: 0,
            overrideAccess: false,
            user,
            disableErrors: true,
        })
        if (!site) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 }
            )
        }
        const siteTenantId = tenantId(site.tenant as TenantRef)
        if (!siteTenantId || (!isSuperAdmin && !userTenantIds.has(siteTenantId))) return forbidden()

        // Get all pages
        const pagesResult = await payload.find({
            collection: 'pages',
            where: { site: { equals: siteId } },
            limit: 50,
            depth: 1,
            overrideAccess: false,
            user,
        })

        if (pagesResult.docs.length === 0) {
            return NextResponse.json({
                success: true,
                data: { fixedPages: 0, message: 'No pages to fix' },
            })
        }

        // Collect pages that need fixing
        const pagesToFix = pagesResult.docs.filter(page => {
            const hasTitle = page.seo?.title || (site.seo as any)?.metaTitle
            const hasDesc = page.seo?.description || (site.seo as any)?.metaDescription
            return !hasTitle || !hasDesc
        })

        if (pagesToFix.length === 0) {
            return NextResponse.json({
                success: true,
                data: { fixedPages: 0, message: 'All pages already have SEO metadata' },
            })
        }

        // Generate SEO metadata with the ECH AI platform task.
        let generateMeta: (pageContent: string) => Promise<SeoMetaResult>
        if (isAiTasksEnabled()) {
            let ai: ReturnType<typeof getAiTaskClient>
            try {
                ai = getAiTaskClient(await resolveActorForUser(user as unknown as PlatformUser, request, { tenantId: siteTenantId }))
            } catch (error) {
                const failure = describeAiTaskFailure(error)
                return NextResponse.json(
                    { success: false, error: { code: 'AI_ERROR', message: failure.message } },
                    { status: failure.status },
                )
            }
            generateMeta = async (pageContent) => {
                try {
                    const { output } = await ai.runTask('seo.fix-meta', {
                        siteName: (site.name || '').slice(0, 200),
                        pageContent: pageContent.slice(0, SEO_CONTEXT_MAX_CHARS),
                    })
                    return output
                } catch (error) {
                    // Per-page error text is shown to the user: keep it user-safe.
                    throw new Error(describeAiTaskFailure(error).message)
                }
            }
        } else {
            return NextResponse.json(
                { success: false, error: { code: 'AI_UNAVAILABLE', message: AI_UNAVAILABLE_MESSAGE } },
                { status: 503 },
            )
        }

        const fixResults = []
        for (const page of pagesToFix) {
            // Extract page content for context
            const blocks = (page as any).layout || []
            const contentParts: string[] = []
            for (const block of blocks) {
                if (block.headline) contentParts.push(`Heading: ${block.headline}`)
                if (block.subheadline) contentParts.push(`Subheading: ${block.subheadline}`)
                if (block.body) contentParts.push(`Body: ${block.body}`)
            }

            const pageContent = contentParts.join('\n') || `Page: ${page.title}`

            try {
                const result = await generateMeta(pageContent)

                if (result.metaTitle || result.metaDescription) {
                    // Update the page SEO
                    const seoUpdate: any = {}
                    if (result.metaTitle && !page.seo?.title) {
                        seoUpdate['seo.title'] = result.metaTitle
                    }
                    if (result.metaDescription && !page.seo?.description) {
                        seoUpdate['seo.description'] = result.metaDescription
                    }

                    await payload.update({
                        collection: 'pages',
                        id: page.id,
                        overrideAccess: false,
                        user,
                        data: {
                            seo: {
                                ...(page.seo || {}),
                                title: result.metaTitle || page.seo?.title,
                                description: result.metaDescription || page.seo?.description,
                            } as any,
                        },
                    })

                    fixResults.push({
                        pageId: page.id,
                        title: page.title,
                        metaTitle: result.metaTitle,
                        metaDescription: result.metaDescription,
                    })
                }
            } catch (aiError: any) {
                console.error(`[SEO Fix] AI error for page ${page.id}:`, aiError.message)
                fixResults.push({
                    pageId: page.id,
                    title: page.title,
                    error: aiError.message,
                })
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                fixedPages: fixResults.filter(r => !r.error).length,
                totalPages: pagesToFix.length,
                results: fixResults,
            },
        })
    } catch (error: any) {
        console.error('[SEO Fix Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'SEO fix failed' } },
            { status: 500 }
        )
    }
}))
