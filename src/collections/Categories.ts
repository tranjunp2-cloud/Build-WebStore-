import type { CollectionConfig } from 'payload'
import slugify from 'slugify'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'

// GH-1587 Phase 01: resolve the tenant a hook should scope its parent lookups to.
// On update, the persisted originalDoc.tenant is the unspoofable source of truth.
// On create, beforeValidate runs before tenant auto-inject (see beforeChange below),
// so we fall back to the actor's own tenant. Super-admins return undefined to signal
// the existing cross-tenant passthrough should be preserved.
function resolveTenantId(
    operation: 'create' | 'update',
    originalDoc: { tenant?: string | { id: string } } | undefined,
    user: any
): string | undefined {
    if (user?.roles?.includes('super-admin')) return undefined
    const raw = operation === 'update' ? originalDoc?.tenant : user?.tenants?.[0]?.tenant
    return typeof raw === 'object' ? raw?.id : raw
}

// Tenant-scoped category lookup used by both hooks below. Super-admins keep the
// existing unscoped findByID passthrough; everyone else must resolve within their
// own tenant — a cross-tenant or missing id both fail as "not found".
async function findCategoryScoped(
    payload: any,
    id: string | number,
    tenantId: string | undefined,
    isSuperAdmin: boolean
) {
    if (isSuperAdmin) {
        return await payload.findByID({ collection: 'categories', id })
    }
    const res = await payload.find({
        collection: 'categories',
        where: { id: { equals: id }, tenant: { equals: tenantId } },
        limit: 1,
        depth: 0,
    })
    const doc = res.docs[0]
    if (!doc) {
        throw new Error('Danh mục cha phải thuộc cùng thương hiệu')
    }
    return doc
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
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            const tenantId = tenantIds[0]
            if (!tenantId) return false
            try {
                const sub = await getActivePlanSubscription(req.payload, tenantId)
                if (!sub) return false
                return await canUse(req.payload, sub.plan as PlanCode, 'product_management')
            } catch { return false }
        },
        read: ({ req }) => {
            // GH-1587 Phase 02: no live consumer reads this collection unauthenticated
            // (storefront uses /api/storefront/* with overrideAccess:true + manual scoping).
            // Block anonymous entirely rather than leak cross-tenant categories.
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        update: async ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            const tenantId = tenantIds[0]
            try {
                const sub = await getActivePlanSubscription(req.payload, tenantId)
                if (!sub) return false
                if (!(await canUse(req.payload, sub.plan as PlanCode, 'product_management'))) return false
            } catch { return false }
            return { tenant: { in: tenantIds } }
        },
        delete: async ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                typeof t.tenant === 'object' ? t.tenant.id : t.tenant
            ) ?? []
            if (tenantIds.length === 0) return false
            const tenantId = tenantIds[0]
            try {
                const sub = await getActivePlanSubscription(req.payload, tenantId)
                if (!sub) return false
                if (!(await canUse(req.payload, sub.plan as PlanCode, 'product_management'))) return false
            } catch { return false }
            return { tenant: { in: tenantIds } }
        },
    },
    hooks: {
        beforeValidate: [
            async ({ data, req, operation, originalDoc }) => {
                // Depth + cycle check: walk the ancestor chain from the candidate parent up to
                // the root ONCE, checking two things per hop: (1) does this ancestor equal the
                // node's own id — a cycle (self-as-parent or descendant-as-parent), and (2) how
                // many levels deep is the candidate parent — reject if placing a child under it
                // would exceed 3 levels. Only relevant on update (create has no existing id, so
                // no cycle is possible). Capped at 5 hops as a safety net against a pre-existing
                // corrupted cycle in the data causing an infinite loop.
                if (data?.parent) {
                    const selfId = operation === 'update' ? originalDoc?.id : undefined
                    const isSuperAdmin = Boolean(req.user?.roles?.includes('super-admin'))
                    const tenantId = resolveTenantId(operation, originalDoc, req.user)
                    if (!isSuperAdmin && !tenantId) {
                        throw new Error('Không thể xác định thương hiệu (tenant) của danh mục');
                    }

                    let candidateId: string | number | null | undefined = data.parent
                    let depth = 0
                    let hops = 0
                    while (candidateId != null) {
                        hops++
                        if (hops > 5) break
                        if (selfId != null && String(candidateId) === String(selfId)) {
                            throw new Error('Không thể đặt danh mục làm cha của chính nó hoặc của danh mục con/cháu của nó');
                        }
                        depth++;
                        // GH-1587 Phase 01: tenant-scoped lookup — prevents reading (and thus
                        // leaking breadcrumb/ancestry from) another tenant's category.
                        const candidateDoc = await findCategoryScoped(req.payload, candidateId, tenantId, isSuperAdmin);
                        candidateId = candidateDoc?.parent
                            ? (typeof candidateDoc.parent === 'object' ? candidateDoc.parent.id : candidateDoc.parent as string)
                            : null;
                    }
                    // If the parent is already level 3, the child would be level 4, which is not allowed.
                    if (depth >= 3) {
                        throw new Error('Chỉ hỗ trợ tối đa 3 cấp độ danh mục');
                    }
                }
                return data;
            }
        ],
        beforeChange: [
            async ({ data, req, operation, originalDoc }) => {
                // GH-1587 Phase 01b: force tenant/site to the actor's own tenant on every write,
                // independent of whether `parent` is present. The parent-IDOR fix above only
                // tenant-checks requests that touch `data.parent` — a bare `{tenant:<victim>}`
                // PATCH with no `parent` bypassed it entirely and could relocate a category into
                // a foreign tenant's namespace (access.update's Where only gates row SELECTION,
                // not what the body can write). Non-admins never get to choose their own tenant;
                // super-admins keep full cross-tenant control (existing behavior, unchanged).
                const isSuperAdmin = Boolean(req.user?.roles?.includes('super-admin'))
                if (req.user && !isSuperAdmin) {
                    const safeTenantId = operation === 'update'
                        ? (typeof originalDoc?.tenant === 'object' ? originalDoc.tenant.id : originalDoc?.tenant)
                        : (typeof req.user.tenants?.[0]?.tenant === 'object'
                            ? req.user.tenants[0].tenant?.id
                            : req.user.tenants?.[0]?.tenant)
                    if (!safeTenantId) {
                        throw new Error('Không thể xác định thương hiệu (tenant) của danh mục');
                    }
                    data.tenant = safeTenantId

                    // Site is tenant-scoped data too — validate/preserve it instead of blindly
                    // trusting the client OR clobbering an already-correct value. A tenant can
                    // have more than one site (see Sites.ts), so an unconditional first-match
                    // lookup would silently reassign the category to the wrong site on every
                    // update; only fall back to first-match when there's truly no prior value
                    // (create) or the requested site doesn't belong to this tenant (spoof).
                    const originalSiteId = operation === 'update'
                        ? (typeof originalDoc?.site === 'object' ? originalDoc.site?.id : originalDoc?.site)
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
                    // else (create, no site supplied): falls through to the first-match
                    // auto-inject below — no prior value exists to preserve.
                }

                // Auto-inject tenant & site (super-admin creates with no tenant specified)
                if (operation === 'create' && req.user) {
                    if (!data.tenant && req.user.tenants?.length > 0) {
                        data.tenant = typeof req.user.tenants[0].tenant === 'object'
                            ? req.user.tenants[0].tenant?.id
                            : req.user.tenants[0].tenant
                    }
                    if (!data.site && data.tenant && req.payload) {
                        const siteRes = await req.payload.find({
                            collection: 'sites',
                            where: { tenant: { equals: data.tenant } },
                            limit: 1
                        })
                        if (siteRes.docs.length > 0) {
                            data.site = siteRes.docs[0].id
                        }
                    }
                }

                if (!data.slug && data.name) {
                    data.slug = slugify(data.name, { lower: true, strict: true })
                }

                // Generate breadcrumb for UX usage
                let breadcrumbs = data.name;
                if (data.parent) {
                    const isSuperAdmin = Boolean(req.user?.roles?.includes('super-admin'))
                    // beforeChange runs after tenant auto-inject above, so data.tenant is set.
                    const tenantId = isSuperAdmin ? undefined : (data.tenant as string | undefined)
                    if (!isSuperAdmin && !tenantId) {
                        throw new Error('Không thể xác định thương hiệu (tenant) của danh mục');
                    }
                    // GH-1587 Phase 01: tenant-scoped lookup — same cross-tenant guard as beforeValidate.
                    const parentDoc = await findCategoryScoped(req.payload, data.parent, tenantId, isSuperAdmin);
                    if (parentDoc?.breadcrumbs) {
                        breadcrumbs = `${parentDoc.breadcrumbs} > ${data.name}`;
                    }
                }
                data.breadcrumbs = breadcrumbs;

                return data;
            }
        ]
    },
    fields: [
        {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            required: true,
            index: true,
            admin: { description: 'The tenant this category belongs to', position: 'sidebar' },
        },
        {
            name: 'site',
            type: 'relationship',
            relationTo: 'sites',
            required: true,
            index: true,
            admin: { description: 'The site this category is listed on', position: 'sidebar' },
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
            // NOT globally unique — GH-1587 Phase 01 replaced the global unique index with a
            // per-tenant composite unique index (categories_tenant_slug_uniq, DB-enforced via
            // scripts/db-setup.js). Keep `index: true` only so Payload's pushDevSchema still
            // creates a plain lookup index; do NOT re-add `unique: true` here.
            index: true,
            admin: { description: 'URL-friendly slug (Tự động tạo nếu để trống)' },
        },
        {
            name: 'parent',
            type: 'relationship',
            relationTo: 'categories',
            filterOptions: ({ id }) => {
                if (id) {
                    return { id: { not_equals: id } }
                }
                return true
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
        },
        {
            name: 'dna',
            type: 'json',
            admin: {
                description: 'Category DNA — block signature, order, forbidden, personality hints. Edited via Studio → Categories.',
            },
        },
    ],
    timestamps: true,
}
