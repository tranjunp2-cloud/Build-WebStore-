import type { CollectionConfig, Where } from 'payload'
import slugify from 'slugify'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'

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
            if (!req.user) {
                const query: Where = { deletedAt: { exists: false } };
                return query; // Public read for storefront
            }
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
                        const candidateDoc = await req.payload.findByID({
                            collection: 'categories',
                            id: candidateId,
                        });
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
            async ({ data, req, operation }) => {
                // Auto-inject tenant & site
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
                    const parentDoc = await req.payload.findByID({
                        collection: 'categories',
                        id: data.parent,
                    });
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
