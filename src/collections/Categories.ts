import type { CollectionConfig, Where } from 'payload'
import slugify from 'slugify'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'

// Unwraps a Payload relationship value (populated object, raw id, or unset) to its id.
// `typeof x === 'object'` alone is unsafe — `typeof null === 'object'` is `true` in JS, so a
// relationship Payload resolves as `null` (e.g. pointing at a deleted/orphaned doc) would throw
// on `.id` instead of falling through to `null`/`undefined`. Every relationship unwrap in this
// file goes through this helper so that failure mode can't slip back in via a new call site.
function unwrapRelationId(value: string | number | { id: string | number } | null | undefined): string | number | null | undefined {
    if (value == null) return value
    return typeof value === 'object' ? value.id : value
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
                unwrapRelationId(t.tenant)
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
                unwrapRelationId(t.tenant)
            ) ?? []
            if (tenantIds.length === 0) return false
            // Excludes soft-deleted categories, matching the anonymous branch above — without
            // this, a soft-deleted category was still resolvable (findByID for the ancestor
            // walk, or the native admin panel's relationship picker) by any tenant user, letting
            // a new category get nested under an invisible parent and silently vanish from the
            // dashboard tree (getCategoriesAction filters deletedAt, so the child matches no
            // node there). Super-admin stays unrestricted (`true` above) — may legitimately need
            // to see soft-deleted docs for management/undelete tooling.
            const query: Where = { and: [{ tenant: { in: tenantIds } }, { deletedAt: { exists: false } }] }
            return query
        },
        update: async ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = req.user.tenants?.map((t: { tenant: string | { id: string } }) =>
                unwrapRelationId(t.tenant)
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
                unwrapRelationId(t.tenant)
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

                    let candidateId: string | number | null | undefined = unwrapRelationId(data.parent)
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
                        // disableErrors:true — Payload's findByID THROWS (Forbidden/NotFound) by
                        // default when access.read's Where-filter excludes the target doc, not
                        // just when access.read returns a hard `false` (verified empirically
                        // against a real Payload instance). Without this, a cross-tenant parent
                        // (parent's filterOptions doesn't scope by tenant, so a tenant user CAN
                        // pick one via the admin panel) or a soft-deleted parent (access.read now
                        // excludes deletedAt for tenant users) makes this throw a raw
                        // Forbidden/NotFound instead of resolving `undefined` — which would abort
                        // the write with an untranslated error instead of the intended
                        // CATEGORY_PARENT_TENANT_MISMATCH below.
                        const candidateDoc = await req.payload.findByID({
                            collection: 'categories',
                            id: candidateId,
                            user: req.user,
                            overrideAccess: true,
                            disableErrors: true,
                        });

                        // Cross-tenant guard: only check the immediate parent (first hop, before
                        // candidateId advances to the next ancestor). Super-admin exempt, and
                        // system/Local-API writes with no req.user exempt (GH-1587 M7 — see below).
                        if (!checkedParentTenant) {
                            checkedParentTenant = true
                            // Soft-deleted parent is invalid for EVERYONE, not just tenant users.
                            // access.read's deletedAt exclusion only blocks this implicitly for
                            // tenant users (their read is filtered, so candidateDoc resolves
                            // undefined and the tenant-mismatch check below catches it) — but
                            // super-admin and system/Local-API writes have unrestricted read
                            // access, so candidateDoc WOULD still resolve a soft-deleted doc for
                            // them without this explicit check.
                            if (candidateDoc?.deletedAt) {
                                throw new Error('CATEGORY_PARENT_SOFT_DELETED');
                            }
                            if (!isSuperAdmin && req.user) {
                                const parentTenantId = unwrapRelationId(candidateDoc?.tenant) ?? null
                                // Owner tenant MUST come from an authoritative source, never from
                                // client-supplied `data.tenant` (GH-1587 C1: a forged `data.tenant`
                                // in the create payload would otherwise let the check "validate"
                                // an attacker-chosen tenant instead of blocking it). On create, use
                                // the authenticated user's own tenant — same source access.create
                                // trusts. On update, use the already-persisted originalDoc.tenant.
                                let ownerTenantId: string | number | null | undefined
                                if (operation === 'update') {
                                    ownerTenantId = unwrapRelationId(originalDoc?.tenant as string | number | { id: string | number } | null | undefined)
                                } else {
                                    const tenantIds = req.user?.tenants?.map((t: { tenant: string | { id: string } }) =>
                                        unwrapRelationId(t.tenant)
                                    ) ?? []
                                    ownerTenantId = tenantIds[0]
                                }
                                if (parentTenantId == null || ownerTenantId == null || String(parentTenantId) !== String(ownerTenantId)) {
                                    throw new Error('CATEGORY_PARENT_TENANT_MISMATCH');
                                }
                            }
                            // else: either isSuperAdmin (already exempt pre-M7) or no req.user —
                            // the latter is a trusted system/Local-API write (seed script, AI
                            // generate-site), not a client request. Collection access.create
                            // already returns false for `!req.user`, so the only way to reach this
                            // hook without a user is trusted internal code with no client tenant
                            // identity to check against — skip, don't throw. (GH-1587 M7)
                        }

                        candidateId = unwrapRelationId(candidateDoc?.parent) ?? null;
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
                // field-access stripping is super-admin (client write) or system/Local-API code
                // (seed script, AI generate-site — no req.user, tenant/site always self-consistent
                // there); a sidebar mis-pick would otherwise persist a structurally corrupt category
                // (site.tenant !== category.tenant). overrideAccess:true here is a system-internal
                // truth lookup, not a read on behalf of req.user (which may be undefined for system
                // writes and would otherwise 403 against Sites' `!req.user → false` read access).
                // (GH-1587 M6)
                if (data?.tenant && data?.site) {
                    const siteDoc = await req.payload.findByID({
                        collection: 'sites',
                        id: data.site,
                        overrideAccess: true,
                    });
                    const siteTenantId = unwrapRelationId(siteDoc?.tenant) ?? null;
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

                // Generate breadcrumb for UX usage. Fall back to originalDoc.name for partial
                // updates (e.g. a re-parent-only payload `{ parent: null }`) so we don't stomp
                // the breadcrumb with "undefined" when `data.name` isn't part of this write.
                const name = data.name ?? originalDoc?.name;
                let breadcrumbs = name;
                // Use the EFFECTIVE parent, not just `data.parent`: a partial update that omits
                // `parent` entirely (e.g. the DNA route's `payload.update({ data: { dna: ... } })`,
                // which never sets `parent`) must preserve the existing ancestor chain, not treat
                // the write as a top-level re-parent. `data.parent === null` (an explicit
                // re-parent-to-top-level payload) is still respected as "no parent" — only an
                // ABSENT key falls back to `originalDoc.parent`.
                const rawParent = data.parent !== undefined ? data.parent : originalDoc?.parent;
                const effectiveParentId = unwrapRelationId(rawParent);
                if (effectiveParentId) {
                    // disableErrors:true — same rationale as the ancestor-walk lookup above:
                    // without it, an inaccessible parent (cross-tenant, or now soft-deleted) makes
                    // this throw instead of resolving `undefined`, which would abort even a
                    // partial write that has nothing to do with `parent` (e.g. a DNA-only PATCH)
                    // purely because the persisted ancestor reference isn't currently readable.
                    const parentDoc = await req.payload.findByID({
                        collection: 'categories',
                        id: effectiveParentId,
                        user: req.user,
                        overrideAccess: false,
                        disableErrors: true,
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
            // Excludes soft-deleted categories from the picker for everyone (including
            // super-admin, unlike `access.read` above) — nesting under an invisible parent is
            // always structurally wrong, not an access-control question. Enforcement for tenant
            // users comes from `access.read`'s deletedAt filter cascading into the beforeValidate
            // ancestor-walk (a soft-deleted parent resolves to null there, tripping the existing
            // cross-tenant mismatch throw); this filterOptions is the UX-layer guard, matching
            // the `site` field's filterOptions pattern above.
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
