import type { CollectionConfig, Where } from 'payload'
import slugify from 'slugify'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'

// Unwraps a Payload relationship value (populated object, raw id, or unset) to its id.
// `typeof x === 'object'` alone is unsafe — `typeof null === 'object'` is `true` in JS, so a
// relationship Payload resolves as `null` (e.g. pointing at a deleted/orphaned doc) would throw
// on `.id` instead of falling through to `null`/`undefined`. Every relationship unwrap in this
// file goes through this helper so that failure mode can't slip back in via a new call site.
function unwrapRelationId(
    value: string | number | { id: string | number } | null | undefined,
): string | number | null | undefined {
    if (value == null) return value
    return typeof value === 'object' ? value.id : value
}

function resolveOwnerTenantId(
    operation: 'create' | 'update',
    originalDoc: { tenant?: string | number | { id: string | number } } | undefined,
    user: any,
    incomingTenant?: string | number | { id: string | number } | null,
): string | number | null | undefined {
    if (!user) return undefined
    if (operation === 'update') return unwrapRelationId(originalDoc?.tenant)
    if (user.roles?.includes('super-admin')) return unwrapRelationId(incomingTenant)
    return unwrapRelationId(user.tenants?.[0]?.tenant)
}

export const Categories: CollectionConfig = {
    slug: 'categories',
    admin: {
        useAsTitle: 'breadcrumbs',
        description: 'Quản lý Danh mục (Tối đa 3 cấp độ)',
    },
    access: {
        create: async ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                unwrapRelationId(t.tenant),
            ) ?? []
            const tenantId = tenantIds[0]
            if (!tenantId) return false
            try {
                const sub = await getActivePlanSubscription(req.payload, tenantId)
                if (!sub) return false
                return await canUse(req.payload, sub.plan as PlanCode, 'product_management')
            } catch {
                return false
            }
        },
        read: ({ req }) => {
            // GH-1587 Phase 02: no live consumer reads this collection unauthenticated
            // (storefront uses /api/storefront/* with overrideAccess:true + manual scoping).
            // Block anonymous entirely rather than leak cross-tenant categories.
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                unwrapRelationId(t.tenant),
            ) ?? []
            if (tenantIds.length === 0) return false
            const query: Where = { and: [{ tenant: { in: tenantIds } }, { deletedAt: { exists: false } }] }
            return query
        },
        update: async ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                unwrapRelationId(t.tenant),
            ) ?? []
            if (tenantIds.length === 0) return false
            const tenantId = tenantIds[0]
            try {
                const sub = await getActivePlanSubscription(req.payload, tenantId)
                if (!sub) return false
                const hasFeature = await canUse(req.payload, sub.plan as PlanCode, 'product_management')
                if (!hasFeature) return false
            } catch {
                return false
            }

            return { tenant: { in: tenantIds } }
        },
        delete: async ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                unwrapRelationId(t.tenant),
            ) ?? []
            if (tenantIds.length === 0) return false
            const tenantId = tenantIds[0]
            try {
                const sub = await getActivePlanSubscription(req.payload, tenantId)
                if (!sub) return false
                if (!(await canUse(req.payload, sub.plan as PlanCode, 'product_management'))) return false
            } catch {
                return false
            }
            return { tenant: { in: tenantIds } }
        },
    },
    hooks: {
        beforeValidate: [
            async ({ data, req, operation, originalDoc }) => {
                if (data?.parent) {
                    const selfId = operation === 'update' ? originalDoc?.id : undefined
                    const isSuperAdmin = Boolean(req.user?.roles?.includes('super-admin'))
                    const ownerTenantId = resolveOwnerTenantId(operation, originalDoc, req.user, data?.tenant)

                    if (req.user && !isSuperAdmin && ownerTenantId == null) {
                        throw new Error('Không thể xác định thương hiệu (tenant) của danh mục')
                    }

                    let candidateId: string | number | null | undefined = unwrapRelationId(data.parent)
                    let depth = 0
                    let hops = 0
                    let checkedParentTenant = false
                    while (candidateId != null) {
                        hops++
                        if (hops > 5) break
                        if (selfId != null && String(candidateId) === String(selfId)) {
                            throw new Error('CATEGORY_CYCLE_ERROR')
                        }
                        depth++
                        const candidateDoc = await req.payload.findByID({
                            collection: 'categories',
                            id: candidateId,
                            user: req.user,
                            overrideAccess: true,
                            disableErrors: true,
                        })

                        if (!checkedParentTenant) {
                            checkedParentTenant = true
                            if (candidateDoc?.deletedAt) {
                                throw new Error('CATEGORY_PARENT_SOFT_DELETED')
                            }
                            if (ownerTenantId != null) {
                                const parentTenantId = unwrapRelationId(candidateDoc?.tenant) ?? null
                                if (
                                    parentTenantId == null ||
                                    String(parentTenantId) !== String(ownerTenantId)
                                ) {
                                    throw new Error('CATEGORY_PARENT_TENANT_MISMATCH')
                                }
                            }
                        }

                        candidateId = unwrapRelationId(candidateDoc?.parent) ?? null
                    }
                    if (depth >= 3) {
                        throw new Error('CATEGORY_MAX_DEPTH_ERROR')
                    }
                }

                if (data?.tenant && data?.site) {
                    const siteDoc = await req.payload.findByID({
                        collection: 'sites',
                        id: data.site,
                        overrideAccess: true,
                    })
                    const siteTenantId = unwrapRelationId(siteDoc?.tenant) ?? null
                    if (siteTenantId == null || String(siteTenantId) !== String(data.tenant)) {
                        throw new Error('CATEGORY_SITE_TENANT_MISMATCH')
                    }
                }
                return data
            },
        ],
        beforeChange: [
            async ({ data, req, operation, originalDoc }) => {
                // GH-1587 Phase 01b: force tenant/site to the actor's own tenant on every write,
                // independent of whether `parent` is present.
                const isSuperAdmin = Boolean(req.user?.roles?.includes('super-admin'))
                if (req.user && !isSuperAdmin) {
                    const safeTenantId = operation === 'update'
                        ? (unwrapRelationId(originalDoc?.tenant) ?? unwrapRelationId(req.user.tenants?.[0]?.tenant))
                        : unwrapRelationId(req.user.tenants?.[0]?.tenant)
                    if (!safeTenantId) {
                        throw new Error('Không thể xác định thương hiệu (tenant) của danh mục')
                    }
                    data.tenant = safeTenantId

                    const originalSiteId = operation === 'update'
                        ? unwrapRelationId(originalDoc?.site)
                        : undefined
                    if (data.site != null && String(data.site) !== String(originalSiteId ?? '')) {
                        const siteCheck = await req.payload.find({
                            collection: 'sites',
                            where: { id: { equals: data.site }, tenant: { equals: safeTenantId } },
                            limit: 1,
                        })
                        data.site = siteCheck.docs.length > 0 ? data.site : originalSiteId
                    } else if (originalSiteId != null) {
                        data.site = originalSiteId
                    }
                }

                if (operation === 'create' && req.user) {
                    if (!data.tenant && req.user.tenants?.length > 0) {
                        data.tenant = unwrapRelationId(req.user.tenants[0].tenant)
                    }
                    if (!data.site && data.tenant && req.payload) {
                        const siteRes = await req.payload.find({
                            collection: 'sites',
                            where: { tenant: { equals: data.tenant } },
                            limit: 1,
                            user: req.user,
                            overrideAccess: false,
                        })
                        if (siteRes.docs.length > 0) {
                            data.site = siteRes.docs[0].id
                        }
                    }
                }

                if (!data.slug && data.name) {
                    data.slug = slugify(data.name, { lower: true, strict: true })
                }

                const name = data.name ?? originalDoc?.name
                let breadcrumbs = name
                const rawParent = data.parent !== undefined ? data.parent : originalDoc?.parent
                const effectiveParentId = unwrapRelationId(rawParent)
                if (effectiveParentId) {
                    const parentDoc = await req.payload.findByID({
                        collection: 'categories',
                        id: effectiveParentId,
                        user: req.user,
                        overrideAccess: false,
                        disableErrors: true,
                    })
                    if (parentDoc?.breadcrumbs) {
                        breadcrumbs = `${parentDoc.breadcrumbs} > ${name}`
                    }
                }
                data.breadcrumbs = breadcrumbs

                return data
            },
        ],
    },
    fields: [
        {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            required: true,
            index: true,
            admin: { description: 'The tenant this category belongs to', position: 'sidebar' },
            access: {
                create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
                update: () => false,
            },
        },
        {
            name: 'site',
            type: 'relationship',
            relationTo: 'sites',
            required: true,
            index: true,
            admin: { description: 'The site this category is listed on', position: 'sidebar' },
            access: {
                create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
                update: () => false,
            },
            filterOptions: ({ data }) => {
                const tenantId = unwrapRelationId((data as { tenant?: string | { id: string } } | undefined)?.tenant)
                if (tenantId) {
                    return { tenant: { equals: tenantId } }
                }
                return true
            },
        },
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: { description: 'Tên danh mục (VD: Thời Trang, Áo Sơ Mi)' },
        },
        {
            name: 'slug',
            type: 'text',
            index: true,
            admin: { description: 'URL-friendly slug (Tự động tạo nếu để trống)' },
        },
        {
            name: 'parent',
            type: 'relationship',
            relationTo: 'categories',
            filterOptions: ({ id }) => {
                const conditions: Where[] = [{ deletedAt: { exists: false } }]
                if (id) {
                    conditions.push({ id: { not_equals: id } })
                }
                return conditions.length > 1 ? { and: conditions } : conditions[0]
            },
            admin: { description: 'Danh mục cha (Tối đa 3 level)' },
        },
        {
            name: 'description',
            type: 'textarea',
            admin: { description: 'Mô tả ngắn gọn cho SEO' },
        },
        {
            name: 'breadcrumbs',
            type: 'text',
            admin: { readOnly: true, description: 'Đường dẫn danh mục (auto-generated)' },
        },
        {
            name: 'deletedAt',
            type: 'date',
            admin: { readOnly: true, description: 'Soft delete timestamp' },
            access: { create: () => false, update: () => false },
        },
        {
            name: 'dna',
            type: 'json',
            admin: {
                description: 'Category DNA — block signature, order, forbidden, personality hints. Edited via Studio → Categories.',
            },
            access: {
                create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
                update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
            },
        },
    ],
    timestamps: true,
}
