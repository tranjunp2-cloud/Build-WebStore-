import { getPayload, type PayloadRequest } from 'payload'
import configPromise from '@payload-config'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { isStaleVersion, VersionConflictError, versionOf } from '@/lib/save-version/save-version'
import { SAFE_RELATION_POPULATE } from '@/lib/payload/safe-populate'
import { getTenantId, isSuperAdmin, type TenantEntry, type UserWithTenants } from '@/lib/blog/blog-access'

/**
 * Blog persistence shared by the blog editor's server actions and the AI
 * copilot's approval step. Not a 'use server' module on purpose: callers pass
 * an already-authenticated user, which must never be client-controllable.
 */

// ─── Types & Helpers ──────────────────────────────────────────────────────
// one copy of the workspace rule (blog-access), re-exported for the actions and the copilot
export { getTenantId, isSuperAdmin }
export type { TenantEntry, UserWithTenants }

/**
 * Populated relations of blog reads and write replies carry what the blog screens show — never a whole user
 * (otpHash, keyString, sessions) or tenant row (payment secrets): the Local API skips field read access
 * (TC-PERF-073, TC-PERF-130).
 */
export const BLOG_POPULATE = SAFE_RELATION_POPULATE

/** Payload expects its internal User type — our auth user is compatible at runtime */
export type PayloadUser = PayloadRequest['user']
export type PayloadClient = Awaited<ReturnType<typeof getPayload>>

export function unwrapRelationId(value: string | number | { id: string | number } | null | undefined) {
    if (value == null) return value
    return typeof value === 'object' ? value.id : value
}

export async function validateBlogCategoryForTenant(params: {
    payload: PayloadClient
    categoryId: string | number | null
    tenantId: string | undefined
    user: UserWithTenants
}) {
    const { payload, categoryId, tenantId, user } = params
    if (categoryId == null) return { ok: true as const, categoryId: null }
    if (isSuperAdmin(user)) return { ok: true as const, categoryId }

    const categoryDoc = await payload.findByID({
        collection: 'blog_categories',
        id: categoryId,
        overrideAccess: true,
        disableErrors: true,
    })
    const categoryTenantId = unwrapRelationId(categoryDoc?.tenant)

    if (!categoryDoc || categoryDoc.status === 'deleted' || !tenantId || !categoryTenantId || String(categoryTenantId) !== String(tenantId)) {
        return { ok: false as const, error: 'Invalid category selection' }
    }

    return { ok: true as const, categoryId }
}


export type SaveBlogInput = {
    id?: string
    title: string
    slug: string
    content: string
    status: string
    category?: string | null
    thumbnail?: string | null
    publishedAt?: string | null
    scheduledPublishDate?: string | null
    seo?: {
        metaTitle?: string
        metaDescription?: string
    }
    /**
     * The `updatedAt` the editor loaded (an update only). A post changed since is refused with
     * `{ ok: false, code: 'VERSION_CONFLICT', current }` and nothing is written. Read-then-write in
     * this request: a save landing between the check and the update still wins (no row lock).
     * Not given: no check (the copilot's approval step).
     */
    expectedUpdatedAt?: string | null
    /** The copilot change set creating this post (new posts only): stored as its replay key, never from a request. */
    aiChangeSetId?: string
}

/** Create or update a blog post as `user` (plan gate, tenant/site binding, slug de-dup, IDOR check). */
export async function saveBlogForUser(user: UserWithTenants, data: SaveBlogInput) {
    const payload = await getPayload({ config: configPromise })
    const isNew = !data.id || data.id === 'new'

    // Get the first tenant from user's tenants array (similar to how Products does)
    const tenantId = getTenantId(user)

    if (tenantId != null) {
        const sub = await getActivePlanSubscription(payload, tenantId)
        if (!sub || !await canUse(payload, sub.plan as PlanCode, 'content_management')) {
            return { error: 'Content management is not available on your current plan.' }
        }
    }

    // Fetch the site associated with this tenant
    let siteId = null
    if (tenantId) {
        const siteRes = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            limit: 1
        })
        if (siteRes.docs.length > 0) {
            siteId = siteRes.docs[0].id
        }
    }

    const normalizedCategoryId = data.category ? (isNaN(Number(data.category)) ? data.category : Number(data.category)) : null
    const categoryCheck = await validateBlogCategoryForTenant({
        payload,
        categoryId: normalizedCategoryId,
        tenantId,
        user: user,
    })
    if (!categoryCheck.ok) {
        return { error: categoryCheck.error }
    }

    const body: Record<string, unknown> = {
        title: data.title,
        slug: data.slug,
        content: data.content,
        status: data.status,
        category: categoryCheck.categoryId,
        thumbnail: data.thumbnail ? (isNaN(Number(data.thumbnail)) ? data.thumbnail : Number(data.thumbnail)) : null,
        publishedAt: data.publishedAt || null,
        scheduledPublishDate: data.scheduledPublishDate || null,
        seo: data.seo || {},
        author: (user).id,
    }

    if (isNew) {
        // Only set tenant and site on creation
        body.tenant = tenantId
        body.site = siteId
        if (data.aiChangeSetId) body.aiChangeSetId = data.aiChangeSetId

        // Auto-suffix slug if duplicate exists within same tenant. Trashed posts count too (`trash: true`): a post
        // in the trash (e.g. an undone AI post) can be restored, and must not come back with a twin slug.
        let slug = body.slug
        let suffix = 0
        while (true) {
            const existing = await payload.find({
                collection: 'blogs',
                where: { slug: { equals: slug }, tenant: { equals: tenantId } },
                limit: 1,
                trash: true,
            })
            if (existing.docs.length === 0) break
            suffix++
            slug = `${body.slug}-${suffix}`
        }
        body.slug = slug

        try {
            const result = await payload.create({
                collection: 'blogs',
                data: body as Record<string, unknown>,
                user: user as PayloadUser,
                depth: 1,
                populate: BLOG_POPULATE,
            })
            return JSON.parse(JSON.stringify(result))
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error('[saveBlogAction] create failed:', msg)
            return { error: msg.includes('required') || msg.includes('invalid') ? msg : 'Failed to save blog' }
        }
    } else {
        try {
            // GH-1587: verify the actor owns this blog before writing to it. Keep the pre-check
            // inside the existing try/catch so a stale/deleted blog ID stays a controlled action
            // error instead of bubbling a raw 500 from findByID().
            const existing = !isSuperAdmin(user) || data.expectedUpdatedAt !== undefined
                ? await payload.findByID({ collection: 'blogs', id: data.id! })
                : null
            if (existing && !isSuperAdmin(user)) {
                const blogTenantId = typeof existing.tenant === 'object' ? existing.tenant?.id : existing.tenant
                if (!tenantId || !blogTenantId || String(tenantId) !== String(blogTenantId)) {
                    return { error: 'Unauthorized update access' }
                }
            }
            if (existing && isStaleVersion(data.expectedUpdatedAt, existing.updatedAt)) {
                return new VersionConflictError(versionOf(existing.updatedAt)).toResult()
            }

            const result = await payload.update({
                collection: 'blogs',
                id: data.id!,
                data: body as Record<string, unknown>,
                user: user as PayloadUser,
                depth: 1,
                populate: BLOG_POPULATE,
            })
            return JSON.parse(JSON.stringify(result))
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error('[saveBlogAction] update failed:', msg)
            return { error: msg.includes('required') || msg.includes('invalid') ? msg : 'Failed to save blog' }
        }
    }
}
