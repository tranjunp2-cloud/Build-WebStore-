import type { CollectionConfig, CollectionAfterChangeHook, FieldHook, CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'
import { validateProductImages } from '@/lib/products/image-limit-validation'
import { MAX_PRODUCT_IMAGES } from '@/lib/products/image-limit'
import { queueSEOAutoGeneration } from '../lib/ai/seo-queue'
import slugify from 'slugify'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { productPublishBlocks, type ProductPublishInput } from '@/lib/products/publish-guard'
import {
    revalidateBadgeCountsAfterChange,
    revalidateBadgeCountsAfterDelete,
} from '@/lib/dashboard/revalidate-badge-counts-hook'
import { runAfterResponse } from '@/lib/runtime/run-after-response'

const STABLE_AI_DRAFT_SLUG_PATTERN = /-ai-[a-f0-9]{32}$/

export const formatSlug = (fallback: string): FieldHook => async ({ value, originalDoc, data, req, operation }) => {
    // If client supplied a value, use it (or slugify it)
    let baseSlug = ''
    if (typeof value === 'string' && value.trim().length > 0) {
        baseSlug = slugify(value, { lower: true, strict: true })
    } else {
        // Fallback to the specified field
        const fallbackData = data?.[fallback] || originalDoc?.[fallback]
        if (fallbackData && typeof fallbackData === 'string') {
            baseSlug = slugify(fallbackData, { lower: true, strict: true })
        }
    }

    if (!baseSlug) return value

    // The UUID-derived AI slug is an idempotency key, not a display slug. Keep it exact so the
    // database unique constraint arbitrates concurrent saves; auto-suffixing would turn the losing
    // request into a second Product and bypass saveAiProductAction's replay/category reconciliation.
    if (data?.aiReviewPending === true && STABLE_AI_DRAFT_SLUG_PATTERN.test(baseSlug)) {
        return baseSlug
    }

    const relation = req.user && !req.user.roles?.includes('super-admin')
        ? (originalDoc?.tenant ?? req.user.tenants?.[0]?.tenant)
        : (data?.tenant ?? originalDoc?.tenant ?? (operation === 'create' ? req.user?.tenants?.[0]?.tenant : undefined))
    const tenantId = typeof relation === 'object' ? relation?.id : relation
    if (!tenantId) return baseSlug // Required tenant validation rejects unresolved ownership.

    let slug = baseSlug
    let count = 1
    let isUnique = false

    // Check uniqueness (BR-03: Duplicate product name cho phép, slug auto-increments)
    while (!isUnique) {
        const existing = await req.payload.find({
            req,
            collection: 'products',
            where: {
                slug: { equals: slug },
                tenant: { equals: tenantId },
                ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {})
            },
            limit: 1,
            depth: 0
        })

        if (existing.docs.length === 0) {
            isUnique = true
        } else {
            slug = `${baseSlug}-${count}`
            count++
        }
    }
    
    return slug
}

const afterChangeHook: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
    const isPublishingUpdate = operation === 'update' && doc.status === 'active' && previousDoc?.status !== 'active'
    const isActiveCreate = operation === 'create' && doc.status === 'active'

    // Notify SSO Hub: user added their first product (step 3)
    // Trigger on any manual create (draft or active) — seeder creates have no req.user so are excluded
    if (operation === 'create' && req?.user?.id) {
        import('@/lib/sso/sso-api-client')
            .then(({ notifyStepComplete }) => notifyStepComplete(req.payload, req.user!.id, 3))
            .catch((err) => console.error('[Products] SSO step 3 import failed:', err))
    }

    // Wait until it becomes active and seo title is empty
    if ((isPublishingUpdate || isActiveCreate) && !doc.seo?.title) {
        const siteId = doc.site && typeof doc.site === 'object' ? doc.site.id : doc.site

        // Check if auto meta generation is enabled for this site
        try {
            const site = await req.payload.findByID({ collection: 'sites', id: siteId, depth: 0 })
            if (site.seo?.autoMetaEnabled === false) return
        } catch { /* proceed if can't check */ }

        // Trigger background generation
        queueSEOAutoGeneration('products', doc.id, siteId, doc.name, doc.shortDescription)
    }
}

export const LOW_STOCK_THRESHOLD = 10

export const lowStockHook: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
    if (operation !== 'update') return doc
    const prevInventory = previousDoc?.inventory ?? 0
    const currInventory = doc.inventory ?? 0

    // Only notify when crossing threshold downward (anti-spam)
    if (prevInventory >= LOW_STOCK_THRESHOLD && currInventory < LOW_STOCK_THRESHOLD && currInventory >= 0) {
        const payload = req.payload
        const tenantId = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
        runAfterResponse('Notification PRODUCT_LOW_STOCK', async () => {
            const { notifyTenantOwners } = await import('@/lib/notifications/notify-tenant-owners')
            await notifyTenantOwners(payload, tenantId, {
                type: 'PRODUCT_LOW_STOCK',
                title: 'Low Stock Alert',
                message: `${doc.name} is running low (${currInventory} units left)`,
                actionUrl: '/products',
                metadata: { productName: doc.name, quantity: String(currInventory) },
            })
        })
    }
    return doc
}

// Auto-inject tenant and site from logged-in user if not provided by client
const beforeChangeHook: CollectionBeforeChangeHook = async ({ data, req, operation, originalDoc }) => {
    // GH-1587: force tenant/site to the actor's own tenant on every write. access.update's
    // `{tenant:{in:tenantIds}}` Where only gates which product row can be targeted — it does
    // not constrain what the update body can write. Without this, a non-admin could relocate
    // their own product into another tenant's namespace via `{tenant:<victim-id>}`. Mirrors
    // the same fix applied to Categories.ts (same root cause, same Sites multi-site handling).
    const isSuperAdmin = Boolean(req.user?.roles?.includes('super-admin'))
    if (req.user && !isSuperAdmin) {
        const safeTenantId = operation === 'update'
            ? (typeof originalDoc?.tenant === 'object' ? originalDoc.tenant?.id : originalDoc?.tenant)
            : (typeof req.user.tenants?.[0]?.tenant === 'object'
                ? req.user.tenants[0].tenant?.id
                : req.user.tenants?.[0]?.tenant)
        if (!safeTenantId) {
            throw new APIError('Không thể xác định thương hiệu (tenant) của sản phẩm', 400)
        }
        data.tenant = safeTenantId

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
    }

    if (operation === 'create' && req.user) {
        // If client didn't specify tenant, try to grab the first active tenant from user
        if (!data.tenant && req.user.tenants?.length > 0) {
            data.tenant = typeof req.user.tenants[0].tenant === 'object'
                ? req.user.tenants[0].tenant?.id
                : req.user.tenants[0].tenant
        }

        // If client didn't specify site, try to fetch the first site for this tenant
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

    // Auto-calculate total inventory if it has variants
    if (data.hasVariants && Array.isArray(data.variants)) {
        data.inventory = data.variants.reduce((acc: number, v: Record<string, unknown>) => acc + (Number(v.stock) || 0), 0)
    }

    return data
}

// Publishing gate (GH-1458) — collection-level enforcement so EVERY write path (the two Next.js
// server actions, Payload REST, GraphQL, Local API, future bulk import) is covered, not just the
// two call sites that already check productPublishBlocks() for fast, structured client errors.
// Adversarial review found those two call-site checks only fire when the incoming payload
// explicitly sets `status:'active'` — editing an already-active product without touching `status`
// (exactly what the edit form does on every save) skipped both gates entirely, and Payload's
// default REST/GraphQL API bypassed them outright (no beforeChange enforcement existed here).
//
// All trigger fields compare by VALUE CHANGED against originalDoc, not by key presence. Two
// call shapes need this distinction:
//   - Payload's own /admin panel (src/app/(payload)/admin) submits the FULL document on every
//     save, not a partial diff — a key-presence trigger would re-fire this gate on EVERY admin
//     save of a legacy-incomplete active product (e.g. editing just `description`), not only
//     saves that actually change a gate-relevant field. Found via independent code review.
//   - updateProductFieldAction always re-passes existing.variants stripped of Payload's
//     auto-managed row `id` (a Payload 3.79 workaround, see actions.ts stripIds()) — a naive
//     "is the key present" trigger would wrongly re-fire this gate on unrelated updates (e.g.
//     soft-delete) to a legacy active product. But naively EXCLUDING 'variants' from the trigger
//     set entirely reopens the exact bug this hook exists to close: a direct saveProductAction
//     call with only `{variants: [bad data]}` (no status/hasVariants key) would then skip the
//     check outright.
// `variants` needs id-normalization before comparing (see normalizeVariantsForCompare); the
// other fields are plain scalars, so strict equality is enough.
const PUBLISH_GATE_TRIGGER_FIELDS = ['price', 'sku', 'inventory', 'weight', 'hasVariants'] as const

function normalizeVariantsForCompare(value: unknown): unknown {
    // Coerce non-array to [] — matching stripIds() in actions.ts — so a legacy row storing
    // variants as null/undefined compares equal to updateProductFieldAction's re-passed `[]`
    // (stripIds(null) === []), instead of "null" !== "[]" spuriously tripping variantsChanged.
    if (!Array.isArray(value)) return []
    return value.map((item) => {
        if (!item || typeof item !== 'object') return item
        const { id: _id, ...rest } = item as Record<string, unknown>
        if (Array.isArray(rest.options)) {
            rest.options = (rest.options as Record<string, unknown>[]).map((opt) => {
                if (!opt || typeof opt !== 'object') return opt
                const { id: _optId, ...o } = opt as Record<string, unknown>
                return o
            })
        }
        return rest
    })
}

const publishGateHook: CollectionBeforeChangeHook = async ({ data, originalDoc }) => {
    const record = data as Record<string, unknown>
    const original = originalDoc as Record<string, unknown> | undefined

    const resultingStatus = 'status' in record ? record.status : original?.status
    if (resultingStatus !== 'active') return data

    // A real transition (draft/archived -> active, or create with status:active), not just "the
    // full-document write happens to include status:'active' because it was already active."
    const statusBeingSetActive = resultingStatus === 'active' && original?.status !== 'active'

    const scalarFieldChanged = PUBLISH_GATE_TRIGGER_FIELDS.some((field) => field in record && record[field] !== original?.[field])
    const variantsChanged = 'variants' in record && JSON.stringify(normalizeVariantsForCompare(record.variants)) !== JSON.stringify(normalizeVariantsForCompare(original?.variants))
    if (!statusBeingSetActive && !scalarFieldChanged && !variantsChanged) return data

    const pick = (key: string): unknown => (key in record ? record[key] : original?.[key])
    const blocks = productPublishBlocks({
        price: pick('price'),
        sku: pick('sku'),
        inventory: pick('inventory'),
        weight: pick('weight'),
        hasVariants: pick('hasVariants'),
        variants: pick('variants'),
    } as ProductPublishInput)

    if (!blocks.ok) {
        throw new APIError(JSON.stringify({ code: 'PUBLISH_BLOCKED', missingFields: blocks.missingFields }), 400)
    }

    return data
}

// Extract tenant IDs from user session. Numeric strings (e.g. "1") are coerced to numbers
// so that Neon PostgreSQL strict mode can match them against integer FK columns.
// Non-numeric strings are kept as-is for compatibility.
function getTenantIds(user: unknown): (string | number)[] {
    const tenants = (user as { tenants?: Array<{ tenant: string | number | { id: string | number } }> }).tenants
    return (tenants?.map((t) => {
        const raw = typeof t.tenant === 'object' && t.tenant !== null ? t.tenant.id : t.tenant
        if (typeof raw === 'number' && !Number.isNaN(raw)) return raw
        if (typeof raw === 'string' && raw.trim() !== '') {
            const num = Number(raw)
            return Number.isNaN(num) ? raw : num
        }
        return null
    }).filter((id): id is string | number => id !== null)) ?? []
}

export const Products: CollectionConfig = {
    slug: 'products',
    indexes: [{ fields: ['tenant', 'slug'], unique: true }],
    hooks: {
        beforeChange: [beforeChangeHook, publishGateHook],
        afterChange: [afterChangeHook, lowStockHook, revalidateBadgeCountsAfterChange],
        afterDelete: [revalidateBadgeCountsAfterDelete],
    },
    admin: {
        useAsTitle: 'name',
        description: 'Products belong to a site and can be listed in the storefront.',
    },
    access: {
        create: async ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = getTenantIds(req.user)
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
            // (storefront uses /api/storefront/products with overrideAccess:true + site filter).
            // Block anonymous entirely rather than leak cross-tenant pricing/SKU/inventory data.
            if (!req.user) return false
            // Authenticated: tenant-scoped read (dashboard)
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = getTenantIds(req.user)
            if (tenantIds.length === 0) return false
            return { tenant: { in: tenantIds } }
        },
        update: async ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            const tenantIds = getTenantIds(req.user)
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
            const tenantIds = getTenantIds(req.user)
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
    fields: [
        {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            required: true,
            index: true,
            admin: { description: 'The tenant this product belongs to' },
        },
        {
            name: 'site',
            type: 'relationship',
            relationTo: 'sites',
            required: true,
            index: true,
            admin: { description: 'The site this product is listed on' },
        },
        {
            name: 'name',
            type: 'text',
            required: true,
            minLength: 3,
            hooks: {
                beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
            },
            admin: { description: 'Product name' },
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            index: true,
            hooks: {
                beforeValidate: [formatSlug('name')],
            },
            admin: { description: 'URL-friendly slug for the product page' },
        },
        {
            name: 'description',
            type: 'richText',
            admin: { description: 'Product description in English (supports rich text)' },
        },
        {
            name: 'descriptionBM',
            type: 'richText',
            admin: { description: 'Product description in Bahasa Melayu (supports rich text)' },
        },
        {
            name: 'shortDescription',
            type: 'textarea',
            admin: { description: 'Short description for cards and SEO' },
        },
        {
            name: 'price',
            type: 'number',
            required: true,
            min: 0,
            max: 100000000,
            admin: { description: 'Product price (in smallest currency unit or decimal)' },
        },
        {
            name: 'compareAtPrice',
            type: 'number',
            min: 0,
            validate: (value: number | null | undefined, { data }: { data: Record<string, unknown> }) => {
                if (value === undefined || value === null || value === 0) return true;
                if (typeof data?.price === 'number' && parseFloat(String(value)) <= data.price) {
                    return 'Compare at price must be greater than the regular price.';
                }
                return true;
            },
            admin: { description: 'Original price before discount (for sale displays)' },
        },
        {
            name: 'currency',
            type: 'select',
            defaultValue: 'MYR',
            options: [
                { label: 'Malaysian Ringgit (MYR)', value: 'MYR' },
                { label: 'US Dollar (USD)', value: 'USD' },
                { label: 'Singapore Dollar (SGD)', value: 'SGD' },
            ],
        },
        {
            name: 'images',
            type: 'array',
            maxRows: MAX_PRODUCT_IMAGES,
            validate: validateProductImages,
            fields: [
                {
                    name: 'image',
                    type: 'upload',
                    relationTo: 'media',
                    required: true,
                },
                {
                    name: 'alt',
                    type: 'text',
                    admin: { description: 'Alt text for accessibility and SEO' },
                },
            ],
            admin: { description: 'Product images (Max 5 new images, <= 5MB each; existing larger galleries are preserved)' },
        },
        {
            name: 'category',
            type: 'relationship',
            relationTo: 'categories',
            // hasMany kept true intentionally (GH-1587 #5/#12): flipping to false would require a
            // products_rels → direct-column data migration for zero functional gain, since
            // CategorySelect.tsx already enforces single-select (onChange([cat.id]), array-of-one).
            hasMany: true,
            admin: { description: 'Danh mục sản phẩm (chọn 1 danh mục)' },
        },
        {
            name: 'tags',
            type: 'array',
            fields: [
                { name: 'tag', type: 'text', required: true },
            ],
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'draft',
            options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Active', value: 'active' },
                { label: 'Archived', value: 'archived' },
            ],
        },
        {
            name: 'inventory',
            type: 'number',
            min: 0,
            max: 1000000,
            defaultValue: 0,
            admin: { description: 'Stock quantity' },
        },
        {
            name: 'sku',
            type: 'text',
            admin: { description: 'Stock Keeping Unit (optional)' },
        },
        {
            name: 'hasVariants',
            type: 'checkbox',
            defaultValue: false,
            admin: { description: 'Sản phẩm có nhiều phân loại (Variants)' },
        },
        {
            name: 'variantConfigs',
            type: 'array',
            maxRows: 2,
            admin: {
                condition: (data) => Boolean(data?.hasVariants),
                description: 'Cấu hình các phân loại (VD: Màu sắc, Kích cỡ)',
            },
            validate: (value: unknown[] | null | undefined) => {
                if (Array.isArray(value)) {
                    const names = value.map((v) => {
                        const n = (v as { name?: unknown })?.name;
                        return typeof n === 'string' ? n.trim().toLowerCase() : undefined;
                    }).filter(Boolean);
                    if (new Set(names).size !== names.length) return 'Tier names must be unique (cannot duplicate names)';
                }
                return true;
            },
            fields: [
                { name: 'name', type: 'text', required: true, maxLength: 50, admin: { description: 'Tên phân loại (VD: Màu sắc)' } },
                {
                    name: 'options',
                    type: 'array',
                    minRows: 1,
                    maxRows: 30,
                    validate: (value: unknown[] | null | undefined) => {
                        if (Array.isArray(value)) {
                            const opts = value.map(v => {
                                const val = (v as { value?: unknown })?.value;
                                return typeof val === 'string' ? val.trim().toLowerCase() : undefined;
                            }).filter(Boolean);
                            if (new Set(opts).size !== opts.length) return 'Options must be unique (no duplicates allowed)';
                        }
                        return true;
                    },
                    fields: [
                        { name: 'value', type: 'text', required: true, maxLength: 50, admin: { description: 'Giá trị tùy chọn (VD: Đỏ, Xanh)' } }
                    ]
                }
            ],
        },
        {
            name: 'variants',
            type: 'array',
            maxRows: 900,
            admin: {
                condition: (data) => Boolean(data?.hasVariants),
                description: 'Ma trận SKU (Tự động sinh ra từ cấu hình ở trên)',
            },
            validate: (value: unknown[] | null | undefined) => {
                if (Array.isArray(value)) {
                    const skus = value.map((v) => {
                        const s = (v as { sku?: unknown })?.sku;
                        return typeof s === 'string' ? s.trim().toLowerCase() : undefined;
                    }).filter(Boolean);
                    if (new Set(skus).size !== skus.length) return 'SKU Codes must be unique across variants';
                }
                return true;
            },
            fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'sku', type: 'text', maxLength: 100 },
                { name: 'price', type: 'number', required: true, min: 0, max: 100000000 },
                { 
                    name: 'compareAtPrice', 
                    type: 'number', 
                    min: 0, 
                    max: 100000000,
                    validate: (val: number | null | undefined, { siblingData }: { siblingData: Record<string, unknown> }) => {
                        if (val === undefined || val === null || val === 0) return true;
                        if (typeof siblingData?.price === 'number' && parseFloat(String(val)) <= siblingData.price) {
                            return 'Compare at price must be greater than variant price.';
                        }
                        return true;
                    }
                },
                { name: 'stock', type: 'number', required: true, min: 0, max: 1000000, defaultValue: 0 },
            ],
        },
        {
            name: 'halalCertified',
            type: 'checkbox',
            defaultValue: false,
            admin: { description: 'Toggle to mark product as Halal Certified (JAKIM)' },
        },
        {
            name: 'aiReviewPending',
            type: 'checkbox',
            defaultValue: false,
            admin: { description: 'Marks a product created via AI bulk-create as pending human review. Cleared as soon as the product is opened for editing.' },
        },
        {
            name: 'halalCertImage',
            type: 'upload',
            relationTo: 'media',
            admin: {
                condition: (data) => data.halalCertified,
                description: 'Upload JAKIM Halal certificate image',
            },
        },
        {
            name: 'weight',
            type: 'number',
            min: 0,
            defaultValue: 0,
            // Canonical unit is kg (confirmed 2026-07-06) — matches the create/edit form label,
            // AI weight-estimation prompts (generate-sample-products.ts, products-bulk-parse), and
            // seed data. This admin.description previously said "grams", contradicting every other
            // reader of this field. Safe to correct without a data migration: no consumer reads
            // `weight` yet (F14 flat-rate shipping calc isn't wired up to it), so no stored value's
            // meaning changes — this only fixes what the number displayed in /admin claims to be.
            admin: { description: 'Product weight in kg (for shipping calculation)' },
        },
        {
            name: 'dimensions',
            type: 'group',
            admin: { description: 'Package dimensions matching shipping logic in F14' },
            fields: [
                { name: 'length', type: 'number', min: 0, defaultValue: 0, admin: { description: 'Length (cm)' } },
                { name: 'width', type: 'number', min: 0, defaultValue: 0, admin: { description: 'Width (cm)' } },
                { name: 'height', type: 'number', min: 0, defaultValue: 0, admin: { description: 'Height (cm)' } },
            ],
        },
        {
            name: 'attributes',
            type: 'array',
            maxRows: 20,
            admin: { description: 'Dynamic key/value attributes for Storefront SEO/Rich Snippets' },
            fields: [
                { name: 'key', type: 'text', required: true, maxLength: 100, admin: { placeholder: 'e.g., Material' } },
                { name: 'value', type: 'text', required: true, maxLength: 500, admin: { placeholder: 'e.g., 100% Cotton' } },
            ],
        },
        {
            name: 'seo',
            type: 'group',
            label: 'SEO Settings',
            fields: [
                { name: 'title', type: 'text', admin: { description: 'Meta title for product page' } },
                { name: 'description', type: 'textarea', admin: { description: 'Meta description for product page' } },
            ],
        },
        {
            name: 'deletedAt',
            type: 'date',
            admin: { readOnly: true, description: 'Soft delete timestamp' },
        },
    ],
    timestamps: true,
}
