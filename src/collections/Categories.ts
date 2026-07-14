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
                // Depth + cycle + cross-tenant check: walk the ancestor chain from the candidate
                // parent up to the root ONCE, checking three things: (1) does any ancestor equal
                // the node's own id — a cycle (self-as-parent or descendant-as-parent), (2) how
                // many levels deep is the candidate parent — reject if placing a child under it
                // would exceed 3 levels, and (3) on the immediate parent only — does its tenant
                // match this category's tenant (GH-1587 H2: prevents nesting a category under
                // another tenant's category). Cycle check only relevant on update (create has no
                // existing id, so no cycle is possible); tenant check applies to create + update.
                // Capped at 5 hops as a safety net against a pre-existing corrupted cycle in the
                // data causing an infinite loop.
                if (data?.parent) {
                    const selfId = operation === 'update' ? originalDoc?.id : undefined
                    const isSuperAdmin = Boolean(req.user?.roles?.includes('super-admin'))

                    let candidateId: string | number | null | undefined = data.parent
                    let depth = 0
                    let hops = 0
                    let checkedParentTenant = false
                    while (candidateId != null) {
                        hops++
                        if (hops > 5) break
                        if (selfId != null && String(candidateId) === String(selfId)) {
                            throw new Error('CATEGORY_CYCLE_ERROR');
                        }
                        depth++;
                        const candidateDoc = await req.payload.findByID({
                            collection: 'categories',
                            id: candidateId,
                            user: req.user,
                            overrideAccess: false,
                        });

                        // Cross-tenant guard: only check the immediate parent (first hop, before
                        // candidateId advances to the next ancestor). Super-admin exempt.
                        if (!checkedParentTenant) {
                            checkedParentTenant = true
                            if (!isSuperAdmin) {
                                const parentTenantId = candidateDoc?.tenant
                                    ? (typeof candidateDoc.tenant === 'object' ? candidateDoc.tenant.id : candidateDoc.tenant)
                                    : null
                                // Owner tenant MUST come from an authoritative source, never from
                                // client-supplied `data.tenant` (GH-1587 C1: a forged `data.tenant`
                                // in the create payload would otherwise let the check "validate"
                                // an attacker-chosen tenant instead of blocking it). On create, use
                                // the authenticated user's own tenant — same source access.create
                                // trusts. On update, use the already-persisted originalDoc.tenant.
                                let ownerTenantId: string | number | null | undefined
                                if (operation === 'update') {
                                    ownerTenantId = originalDoc?.tenant
                                        ? (typeof originalDoc.tenant === 'object' ? (originalDoc.tenant as { id: string | number }).id : originalDoc.tenant)
                                        : undefined
                                } else {
                                    const tenantIds = req.user?.tenants?.map((t: { tenant: string | { id: string } }) =>
                                        typeof t.tenant === 'object' ? t.tenant.id : t.tenant
                                    ) ?? []
                                    ownerTenantId = tenantIds[0]
                                }
                                if (parentTenantId == null || ownerTenantId == null || String(parentTenantId) !== String(ownerTenantId)) {
                                    throw new Error('CATEGORY_PARENT_TENANT_MISMATCH');
                                }
                            }
                        }

                        candidateId = candidateDoc?.parent
                            ? (typeof candidateDoc.parent === 'object' ? candidateDoc.parent.id : candidateDoc.parent as string)
                            : null;
                    }
                    // If the parent is already level 3, the child would be level 4, which is not allowed.
                    if (depth >= 3) {
                        throw new Error('CATEGORY_MAX_DEPTH_ERROR');
                    }
                }

                // GH-1587 M5 follow-up: super-admin is exempt from the tenant/site field-level
                // create lock (see field configs below), so both can arrive together in the same
                // create payload — nothing else validates that `site` actually belongs to `tenant`.
                // Only reachable pre-auto-inject when both are explicitly supplied, which after
                // field-access stripping is super-admin-only; a sidebar mis-pick would otherwise
                // persist a structurally corrupt category (site.tenant !== category.tenant).
                if (data?.tenant && data?.site) {
                    const siteDoc = await req.payload.findByID({
                        collection: 'sites',
                        id: data.site,
                        user: req.user,
                        overrideAccess: false,
                    });
                    const siteTenantId = siteDoc?.tenant
                        ? (typeof siteDoc.tenant === 'object' ? (siteDoc.tenant as { id: string | number }).id : siteDoc.tenant)
                        : null;
                    if (siteTenantId == null || String(siteTenantId) !== String(data.tenant)) {
                        throw new Error('CATEGORY_SITE_TENANT_MISMATCH');
                    }
                }
                return data;
            }
        ],
        beforeChange: [
            async ({ data, req, operation, originalDoc }) => {
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

                // Generate breadcrumb for UX usage. Fall back to originalDoc.name for partial
                // updates (e.g. a re-parent-only payload `{ parent: null }`) so we don't stomp
                // the breadcrumb with "undefined" when `data.name` isn't part of this write.
                const name = data.name ?? originalDoc?.name;
                let breadcrumbs = name;
                if (data.parent) {
                    const parentDoc = await req.payload.findByID({
                        collection: 'categories',
                        id: data.parent,
                        user: req.user,
                        overrideAccess: false,
                    });
                    if (parentDoc?.breadcrumbs) {
                        breadcrumbs = `${parentDoc.breadcrumbs} > ${name}`;
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
            // Locked for tenant users — closes GH-1587 C1: without it a tenant user could
            // forge `tenant` in a create payload to smuggle a category into another tenant.
            // Legitimate tenant-user assignment happens via the beforeChange auto-inject
            // below. Super-admin is exempt on create only (no `tenants` of their own to
            // auto-inject from, and collection-level access already grants them full
            // cross-tenant create/read/update) so they can pick a tenant in the admin
            // sidebar — this grants no new privilege since super-admin already bypasses
            // collection-level access checks. Update stays locked for everyone (no
            // reassignment path via the API). (GH-1587 H2 / M5)
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
            // Same rationale as `tenant` above. (GH-1587 H2 / C1 / M5)
            access: {
                create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
                update: () => false,
            },
            // Scope the admin sidebar dropdown to the selected tenant so a super-admin can't
            // even see cross-tenant sites to pick from (UX layer; the beforeValidate hook above
            // is the enforced guard). Mirrors the `parent` field's filterOptions pattern below.
            filterOptions: ({ data }) => {
                const tenant = (data as { tenant?: string | { id: string } } | undefined)?.tenant
                if (tenant) {
                    return { tenant: { equals: typeof tenant === 'object' ? tenant.id : tenant } }
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
            // Absolute lock — soft-delete only happens via deleteCategoryAction's internal write
            // (overrideAccess:true, gated by its own findByID access check upfront). (GH-1587 H1)
            // create locked too: REST create could otherwise set deletedAt directly (blast
            // radius was low — self-created invisible category in one's own tenant — but
            // locked for consistency with update).
            access: { create: () => false, update: () => false },
        },
        {
            name: 'dna',
            type: 'json',
            admin: {
                description: 'Category DNA — block signature, order, forbidden, personality hints. Edited via Studio → Categories.',
            },
            // Super-admin only, both create and update — closes the create-path smuggling vector
            // (a tenant user could otherwise plant a `dna` value on category creation). The DNA
            // route (src/app/api/admin/categories/[id]/dna/route.ts) uses payload.update with no
            // explicit overrideAccess → Local API default `overrideAccess:true` → bypasses this
            // field access, so it stays functional and super-admin-only via its own withSuperAdmin
            // wrapper. (GH-1587 H1)
            access: {
                create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
                update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
            },
        },
    ],
    timestamps: true,
}
