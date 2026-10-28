import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { describeAiTaskFailure, runAiTaskForUser } from '@/lib/ai-platform/ai-tasks'
import { AI_UNAVAILABLE_MESSAGE, isAiTasksEnabled } from '@/lib/ai-platform/config'

type TenantRef = string | number | { id: string | number } | null | undefined

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


/**
 * POST /api/ai/seo-generate
 *
 * US-F08-03: AI SEO Generation
 * Generates SEO metadata for a product based on name + category.
 *
 * Body: { name: string, category?: string }
 * Returns: { success: true, data: { title: string, description: string, slug: string } }
 *
 * Constraints (from PRD v2.1):
 *   - title: ≤ 70 characters
 *   - description: 150–160 characters
 *   - slug: kebab-case, URL-safe
 */
export const POST = withAuth(async (user, req) => {
    try {
        // Rate Limit: 20 AI tasks per hour
        const rateLimit = await checkRateLimit(`ai:seo-generate:${user.id}`, 20)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: 'Rate limit exceeded. Try again later.' },
                { status: 429 }
            )
        }

        const body = await req.json()
        const { name, category, language = 'en', siteId } = body

        // Fetch tracked keywords if siteId provided (AC-15) — only from a site
        // of a workspace the caller is an active member of.
        let trackedKeywords: string[] = []
        let siteTenantId: string | null = null
        if (siteId) {
            let site: unknown = null
            try {
                const payload = await getPayload({ config })
                site = await payload.findByID({
                    collection: 'sites',
                    id: siteId,
                    depth: 0,
                    overrideAccess: false,
                    user,
                    disableErrors: true,
                })
            } catch { /* site fetch failed — proceed without keywords */ }
            if (site) {
                const isSuperAdmin = user.roles?.includes('super-admin') === true
                siteTenantId = tenantId((site as { tenant?: TenantRef }).tenant)
                if (!isSuperAdmin && (!siteTenantId || !activeTenantIds(user).has(siteTenantId))) {
                    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
                }
                trackedKeywords = ((site as any)?.seo?.trackedKeywords as Array<{ keyword: string }> | undefined)
                    ?.map(k => k.keyword).filter(Boolean) || []
            }
        }

        if (!name || typeof name !== 'string' || name.trim().length < 3) {
            return NextResponse.json(
                { success: false, error: 'Product name (min 3 chars) is required' },
                { status: 400 }
            )
        }

        if (!isAiTasksEnabled()) {
            return NextResponse.json({ success: false, error: AI_UNAVAILABLE_MESSAGE }, { status: 503 })
        }

        try {
            const { output } = await runAiTaskForUser(user, req, 'seo.page-meta', {
                name: name.trim(),
                category: typeof category === 'string' && category.trim() ? category.trim() : undefined,
                language: typeof language === 'string' ? language : 'en',
                keywords: trackedKeywords,
            }, { tenantId: siteTenantId })
            return NextResponse.json({ success: true, data: enforceSeoConstraints(output, name) })
        } catch (error) {
            const failure = describeAiTaskFailure(error)
            return NextResponse.json({ success: false, error: failure.message }, { status: failure.status })
        }
    } catch (error) {
        console.error('API /api/ai/seo-generate error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to generate SEO metadata' },
            { status: 500 }
        )
    }
}, { csrf: true })

/** Enforce hard constraints server-side as safety net. */
function enforceSeoConstraints(
    parsed: { title?: string; description?: string; slug?: string },
    name: string,
): { title: string; description: string; slug: string } {
    const title = (parsed.title || '').slice(0, 70).trim()
    const description = (parsed.description || '').slice(0, 160).trim()
    const slug = (parsed.slug || slugify(name))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    return { title, description, slug }
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip diacritics
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
}
