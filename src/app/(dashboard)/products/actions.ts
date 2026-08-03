'use server'

import { getPayload, type PayloadRequest } from 'payload'
import { sql } from 'drizzle-orm'
import productSlugify from 'slugify'
import configPromise from '@payload-config'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { productPublishBlocks } from '@/lib/products/publish-guard'
import { buildProductAlt } from '@/lib/products/build-product-alt'
import {
    CATEGORY_LOCK_BUSY_ERROR,
    withActiveCategoryRowLock,
} from '@/lib/payload/category-row-lock'
import { findDashboardProducts } from '@/lib/products/dashboard-product-list'

// NOTE: This check is best-effort, fast-path UX — two limitations apply:
//   1. NOT concurrent-safe on its own: two parallel saves with the same SKU can both pass this
//      SELECT before either INSERT commits (TOCTOU). The DB-level unique index
//      `products_sku_tenant_uniq` (per tenant, case-insensitive, scripts/db-setup.js F08-1032)
//      is the authoritative backstop for the base `sku` — see `translateDbSkuConflict` below,
//      which converts that constraint's rejection into the same FIELD_ERRORS shape thrown here,
//      so callers (incl. BulkCreateModal's SKU-retry loop) handle both layers identically.
//      Cross-product variant-sku uniqueness has NO DB-level backstop (only same-product variant
//      SKUs are DB-enforced, via `products_variants_sku_parent_uniq`) — remains app-check-only.
//   2. The candidate query compares `lower(sku)` exactly. It deliberately does not use
//      Payload's `like` operator: `_` and `%` are valid SKU characters but SQL wildcards.

// Converts a DB-level unique-constraint rejection (the rare TOCTOU race that slips past
// findConflictingSkus's non-atomic pre-check) into the same `{code:'FIELD_ERRORS', fieldErrors}`
// JSON shape findConflictingSkus already throws, so every caller — including
// BulkCreateModal.handleSave's SKU-retry loop — handles both layers identically.
//
// IMPORTANT — verified against the actual installed @payloadcms/drizzle source
// (node_modules/@payloadcms/drizzle/dist/upsertRow/handleUpsertError.js): Payload's adapter
// intercepts EVERY raw Postgres 23505 before it ever reaches this catch block and rethrows its
// own `ValidationError`. It can only resolve a friendly field name for constraints Payload itself
// created via a field's `unique:true` (looked up in `adapter.fieldConstraints`), or via a
// `Key (col)=(val)` regex on the raw driver error's `.detail` text — which BREAKS on our
// multi-column expression index `(tenant_id, lower(sku))` because `lower(sku)` embeds its own
// nested `)`, desyncing the regex. Both resolution paths fail for our raw-SQL
// `products_sku_tenant_uniq` / `products_variants_sku_parent_uniq` indexes (neither is a
// Payload-native unique field), so what reaches us here is a generic
// `ValidationError({ data: { collection: 'products', errors: [{ message: 'Value must be unique',
// path: null }] } })` — no constraint name, no field name, no original pg `.code`/`.message`.
// We CANNOT reliably tell a base-sku collision apart from a same-product variant-sku collision
// from this shape (both collapse to the same generic entry) — see TC-F08-04-50b. We treat any
// UNRESOLVED ("Value must be unique" with `path == null`) violation on `products` as a base-sku
// conflict (the far more common trigger for this action's callers). Checking `path == null` (Payload
// couldn't resolve a field name) rather than excluding `path === 'slug'` by name is deliberate: it's
// self-maintaining if another Payload-native `unique:true` field is ever added to Products later —
// Payload WOULD resolve that field's name via its own fieldConstraints map, so it's naturally
// excluded without this function needing to know that field's name in advance.
function translateDbSkuConflict(err: unknown, data: Record<string, unknown>): Error {
    const anyErr = err as { name?: string; data?: { collection?: string; errors?: Array<{ message?: string; path?: string | null }> } } | null | undefined
    const errors = anyErr?.data?.errors ?? []
    const isUnresolvedUniqueViolation =
        anyErr?.name === 'ValidationError' &&
        anyErr?.data?.collection === 'products' &&
        errors.some(e => e?.message === 'Value must be unique' && e?.path == null)
    if (!isUnresolvedUniqueViolation) return err instanceof Error ? err : new Error(String(err))

    const skuValue = typeof data.sku === 'string' ? data.sku : ''
    return new Error(JSON.stringify({
        code: 'FIELD_ERRORS',
        fieldErrors: { baseSku: { code: 'SKU_ALREADY_IN_USE', values: [skuValue] } },
        message: `SKU already in use: ${skuValue}`,
    }))
}

async function findConflictingSkus(
    payload: Awaited<ReturnType<typeof getPayload>>,
    skus: string[],
    tenantId: string | number | null,
    excludeId?: number
): Promise<string[]> {
    if (skus.length === 0) return []
    const submittedSkuByNormalized = new Map(skus.map(sku => [sku.toLowerCase(), sku]))
    const normalizedSkus = Array.from(submittedSkuByNormalized.keys())
    const skuValues = sql.join(normalizedSkus.map(sku => sql`${sku}`), sql`, `)
    // A null tenant means the caller is allowed to see all tenants; otherwise, scope both
    // base and variant SKU checks to the product's tenant.
    const tenantFilter = tenantId != null ? sql`AND p.tenant_id = ${tenantId}` : sql``
    const excludeFilter = excludeId !== undefined ? sql`AND p.id <> ${excludeId}` : sql``

    // `DISTINCT lower(...)` bounds the result to the submitted SKU set, rather than to every
    // product that happens to substring-match it. Values are parameterized, so `%` and `_`
    // remain literal, valid SKU characters.
    const result = await payload.db.drizzle.execute(sql`
        SELECT DISTINCT lower(conflicting_skus.sku) AS sku
        FROM (
            SELECT p.sku
            FROM products p
            WHERE p.deleted_at IS NULL
              AND p.sku IS NOT NULL
              ${tenantFilter}
              ${excludeFilter}
              AND lower(p.sku) IN (${skuValues})

            UNION ALL

            SELECT v.sku
            FROM products p
            INNER JOIN products_variants v ON v._parent_id = p.id
            WHERE p.deleted_at IS NULL
              AND v.sku IS NOT NULL
              ${tenantFilter}
              ${excludeFilter}
              AND lower(v.sku) IN (${skuValues})
        ) AS conflicting_skus
    `) as { rows: Array<{ sku: string | null }> }

    return result.rows.flatMap(row => {
        if (typeof row.sku !== 'string') return []
        return [submittedSkuByNormalized.get(row.sku) ?? row.sku]
    })
}

export async function getProductsAction() {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const docs = await findDashboardProducts(payload, user)
    return JSON.parse(JSON.stringify(docs))
}

// NOTE: not a pure read — fetching a product with `aiReviewPending: true` clears that flag
// as a side effect (opening the edit page counts as the merchant reviewing an AI draft; see
// below). Any future caller of this action, not just the edit page, will trigger that write.
export async function getProductAction(id: string | number) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const res = await payload.findByID({
        collection: 'products',
        id,
        user,
        depth: 1
    })

    // Opening the edit page counts as the merchant having reviewed an AI-generated draft —
    // clear the pending flag immediately rather than waiting for an explicit save.
    // Best-effort: this is a secondary side effect of what is otherwise a read. If the write
    // fails, the read must still succeed — callers (any future one, not just the edit page)
    // expect getProductAction to behave like a read and must not see a load failure just
    // because this flag-clear hiccuped.
    if (res?.aiReviewPending) {
        try {
            await payload.update({
                collection: 'products',
                id,
                data: { aiReviewPending: false },
                user,
                overrideAccess: false,
            })
            res.aiReviewPending = false
        } catch (err) {
            console.error('[getProductAction] failed to clear aiReviewPending', { id, err })
        }
    }

    return JSON.parse(JSON.stringify(res))
}

import { z } from 'zod'

const SKU_SCHEMA = z.string().trim().min(1, 'SKU cannot be empty').max(100)

const ProductServerSchema = z.object({
    // max(120) matches product-form/schema.ts's client-side cap — without it here, a direct
    // saveProductAction call could submit an arbitrarily long name, which then flows unbounded
    // into the alt-text fallback below ("{name} - {store}") despite that field's own .max(500).
    name: z.string().min(3, "Name must be at least 3 characters").max(120, "Name must not exceed 120 characters"),
    sku: SKU_SCHEMA.optional(),
    variants: z.array(z.object({ sku: SKU_SCHEMA.optional() }).passthrough()).max(900).optional(),
    images: z.array(z.object({
        image: z.union([z.string(), z.number(), z.record(z.unknown())]).optional(),
        // ImageUploader.tsx enforces a 125-char UX cap (MAX_ALT_LENGTH) via <textarea maxLength>,
        // but that's client-only — a direct saveProductAction call bypasses it entirely. This 500
        // cap is a generous defense-in-depth ceiling (not the UX limit itself), sized to never
        // reject legitimate pre-existing over-125-char alt text (grandfathered, per TC-F08-01-37 —
        // the Popover shows it uncut, doesn't retroactively truncate), only pathological input.
        alt: z.string().max(500, 'Alt text is too long').optional()
    })).optional(),
}).passthrough();

type ProductSaveContext = {
    user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
    tenantId: string | number
    payload: Awaited<ReturnType<typeof getPayload>>
    req?: Pick<PayloadRequest, 'transactionID'>
}

async function saveProduct(rawData: unknown, id?: string | number, context?: ProductSaveContext) {
    const user = context?.user ?? await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const data = ProductServerSchema.parse(rawData);

    // The database only enforces duplicate variant SKUs after Payload validates the
    // collection, which produces an unhelpful generic "Variants" error. Reject duplicate
    // values in this request first, including a collision with the base SKU, so callers can
    // identify and regenerate the affected variant deterministically.
    const fieldErrors: Record<string, { code: string; values: string[] }> = {}
    const seenSkus = new Set<string>()
    if (typeof data.sku === 'string' && data.sku.trim()) {
        seenSkus.add(data.sku.trim().toLowerCase())
    }
    const submittedVariants = (data.variants as Array<{ sku?: string }> | undefined) || []
    submittedVariants.forEach((variant, index) => {
        const sku = typeof variant?.sku === 'string' ? variant.sku.trim() : ''
        if (!sku) return
        const normalizedSku = sku.toLowerCase()
        if (seenSkus.has(normalizedSku)) {
            fieldErrors[`variants.${index}.skuCode`] = { code: 'DUPLICATE_SKU_IN_REQUEST', values: [sku] }
            return
        }
        seenSkus.add(normalizedSku)
    })
    if (Object.keys(fieldErrors).length > 0) {
        throw new Error(JSON.stringify({
            code: 'FIELD_ERRORS',
            fieldErrors,
            message: 'Each product and variant SKU must be unique.',
        }))
    }

    const payload = context?.payload ?? await getPayload({ config: configPromise })

    const candidateSkus = [
        ...(typeof data.sku === 'string' && data.sku.trim() ? [data.sku.trim()] : []),
        ...((data.variants as Array<{ sku?: string }> | undefined) || [])
            .map(v => typeof v.sku === 'string' ? v.sku.trim() : '')
            .filter(Boolean),
    ]
    // Fix B: coerce to number so SKU scope and tenant filter match Neon integer FK
    const tenantId = context?.tenantId ?? tenantIdForQuery(user)

    // `id != null` (not truthy `id`) — a falsy `id === 0` is a legitimate Payload primary key
    // and must route to the update branch below, not silently fall through to create.
    const hasId = id != null && id !== ''
    const numId = hasId ? (typeof id === 'string' ? parseInt(id, 10) : id) : undefined
    if (numId !== undefined && Number.isNaN(numId)) throw new Error('Invalid product ID')

    // Publishing gate (GH-1458) — updateProductFieldAction() is not the only path to
    // status:'active'. saveProductAction is a directly-callable Server Action with a
    // .passthrough() schema, so a caller (not just the React form, which never sends `status`
    // on edits — see [id]/page.tsx) could otherwise smuggle `status:'active'` past this action
    // with no core-field validation, bypassing the gate entirely. Re-check here against the
    // MERGED view (existing doc + this save's incoming fields) since a save may only touch a
    // subset of fields.
    if (data.status === 'active') {
        const existing = numId !== undefined
            ? await payload.findByID({ collection: 'products', id: numId, user, depth: 0, overrideAccess: false, disableErrors: true })
            : null
        const merged = { ...(existing ?? {}), ...data }
        const blocks = productPublishBlocks({
            price: merged.price,
            sku: merged.sku,
            inventory: merged.inventory,
            weight: merged.weight,
            hasVariants: merged.hasVariants,
            variants: merged.variants,
        })
        if (!blocks.ok) {
            throw new Error(JSON.stringify({ code: 'PUBLISH_BLOCKED', missingFields: blocks.missingFields }))
        }
    }

    const conflicts = await findConflictingSkus(payload, candidateSkus, tenantId, numId)

    if (conflicts.length > 0) {
        const conflictsLower = new Set(conflicts.map(s => s.toLowerCase()))
        const fieldErrors: Record<string, { code: string; values: string[] }> = {}

        if (typeof data.sku === 'string' && data.sku.trim() && conflictsLower.has(data.sku.trim().toLowerCase())) {
            fieldErrors['baseSku'] = { code: 'SKU_ALREADY_IN_USE', values: [data.sku.trim()] }
        }
        const variants = (data.variants as Array<{ sku?: string }> | undefined) || []
        variants.forEach((v, i) => {
            if (typeof v?.sku === 'string' && v.sku.trim() && conflictsLower.has(v.sku.trim().toLowerCase())) {
                fieldErrors[`variants.${i}.skuCode`] = { code: 'SKU_ALREADY_IN_USE', values: [v.sku.trim()] }
            }
        })

        throw new Error(JSON.stringify({
            code: 'FIELD_ERRORS',
            fieldErrors,
            message: `SKU already in use: ${conflicts.join(', ')}`,
        }))
    }

    // Automatically attach default placeholder image if none provided
    if (!data.images || data.images.length === 0) {
        try {
            const { getOrCreateCrateCartonIdAction } = await import('@/app/(dashboard)/actions/media')
            const cartonId = await getOrCreateCrateCartonIdAction()
            if (cartonId) {
                data.images = [{ image: cartonId }]
            }
        } catch (err) {
            console.error('Failed to attach placeholder image', err)
        }
    }

    // Dashboard/manual product saves intentionally derive blank image alt text from the product
    // name only. We do NOT fetch/pass the tenant site name here, so manual saves never persist
    // noisy local/staging suffixes like "Product - localhost". Re-capped at 500 (matches the
    // schema's alt max) since the derived string is computed AFTER Zod validation and isn't
    // re-checked otherwise.
    if (data.images && data.images.length > 0) {
        data.images = data.images.map((img) => ({ ...img, alt: buildProductAlt(img.alt, data.name, undefined).slice(0, 500) }))
    }

    if (hasId) {
        // Manual edit clears the AI-review flag — the merchant has reviewed/touched the product.
        (data as Record<string, unknown>).aiReviewPending = false
        try {
            const res = await payload.update({
                collection: 'products',
                id: id as string | number,
                data,
                user,
                overrideAccess: false,
            })
            return JSON.parse(JSON.stringify(res))
        } catch (updateErr) {
            console.error('[products.update] failed', { id, name: (data as Record<string, unknown>).name, err: updateErr })
            throw translateDbSkuConflict(updateErr, data as Record<string, unknown>)
        }
    } else {
        // Fix A: explicitly set tenant so the product is always scoped to the user's tenant.
        // beforeChangeHook injects it too, but only if req.user.tenants is populated — this
        // guarantees the write even when tenants aren't deeply populated in the server action ctx.
        if (tenantId != null) (data as Record<string, unknown>).tenant = tenantId

        try {
            const res = await payload.create({
                collection: 'products',
                data,
                user,
                overrideAccess: false,
                // Manual creates remain auto-committed because Payload's adapter commit helper can
                // swallow PostgreSQL commit failures. AI creates instead receive the category-lock
                // transaction request, so the Product write and row lock finalize atomically through
                // Drizzle's callback transaction.
                ...(context?.req
                    ? { req: context.req }
                    : { disableTransaction: true }),
            })
            if (!context?.req) {
                // Verify an independently auto-committed manual row before reporting success. An
                // AI row is still uncommitted here and is verified by the outer transaction result.
                try {
                    const verify = await payload.findByID({
                        collection: 'products',
                        id: res.id,
                        overrideAccess: true,
                        depth: 0,
                    })
                    if (!verify?.id) {
                        console.error('[products.create] VERIFY FAILED — product not in DB after create!', { id: res?.id })
                        throw new Error('Product was not saved. Please try again.')
                    }
                } catch (verifyErr) {
                    if ((verifyErr as Error)?.message === 'Product was not saved. Please try again.') throw verifyErr
                    console.error('[products.create] VERIFY ERROR', { id: res?.id, verifyErr })
                    throw new Error('Product was not saved. Please try again.')
                }
            }
            return JSON.parse(JSON.stringify(res))
        } catch (createErr) {
            console.error('[products.create] failed', {
                tenant: tenantId,
                name: (data as Record<string, unknown>).name,
                err: createErr,
            })
            throw translateDbSkuConflict(createErr, data as Record<string, unknown>)
        }
    }
}

export async function saveProductAction(rawData: unknown, id?: string | number) {
    return saveProduct(rawData, id)
}

const AiCategoryIdSchema = z.union([
    z.number().int().positive().max(2_147_483_647),
    z.string()
        .trim()
        .regex(/^[1-9]\d*$/)
        .transform(value => Number(value))
        .refine(
            value => Number.isSafeInteger(value) && value <= 2_147_483_647,
            'Category ID is out of range',
        ),
])

function categoryInvalidResult() {
    return {
        ok: false as const,
        code: 'CATEGORY_INVALID',
        message: 'Please select an active category from your store.',
    }
}

/**
 * AI bulk-create boundary only.
 *
 * Keep the existing manual Product save path unchanged, but independently revalidate the
 * category selected in the AI review modal. Client-side revalidation is UX; this query is the
 * authoritative tenant/active-category check for direct Server Action calls.
 */
export async function saveAiProductAction(rawData: unknown) {
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
        return categoryInvalidResult()
    }

    const category = (rawData as Record<string, unknown>).category
    if (!Array.isArray(category) || category.length !== 1) {
        return categoryInvalidResult()
    }

    const parsedCategory = AiCategoryIdSchema.safeParse(category[0])
    if (!parsedCategory.success) return categoryInvalidResult()

    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const tenantId = tenantIdForQuery(user)
    if (tenantId == null) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const rawSlug = (rawData as Record<string, unknown>).slug
    const requestedSlug = typeof rawSlug === 'string'
        ? productSlugify(rawSlug, { lower: true, strict: true })
        : ''
    const canReplayAiDraft = /-ai-[a-f0-9]{32}$/.test(requestedSlug)
    const findReplay = async () => {
        if (!canReplayAiDraft) return null
        const replay = await payload.find({
            collection: 'products',
            where: {
                and: [
                    { deletedAt: { exists: false } },
                    { tenant: { equals: tenantId } },
                    { slug: { equals: requestedSlug } },
                    { aiReviewPending: { equals: true } },
                ],
            },
            limit: 1,
            pagination: false,
            depth: 0,
            overrideAccess: false,
            user,
        })
        return replay.docs[0] ?? null
    }
    const replayMatchesRequestedCategory = (replay: unknown) => {
        if (!replay || typeof replay !== 'object') return false
        const categoryValues = (replay as { category?: unknown }).category
        if (!Array.isArray(categoryValues) || categoryValues.length !== 1) return false

        const categoryValue = categoryValues[0]
        const replayCategoryId = (
            typeof categoryValue === 'string' || typeof categoryValue === 'number'
                ? categoryValue
                : categoryValue && typeof categoryValue === 'object' && 'id' in categoryValue
                    ? (categoryValue as { id?: unknown }).id
                    : null
        )
        return (
            (typeof replayCategoryId === 'string' || typeof replayCategoryId === 'number')
            && String(replayCategoryId) === String(parsedCategory.data)
        )
    }
    const replayCategoryConflict = () => new Error(JSON.stringify({
        code: 'AI_DRAFT_CATEGORY_CONFLICT',
        message: 'This AI draft was already saved to a different category. Retry using its original category.',
    }))

    // A previous attempt may have committed even if its connection failed before acknowledging
    // COMMIT. Reuse that exact AI draft instead of creating a duplicate on the merchant's retry.
    const existingDraft = await findReplay()
    if (existingDraft) {
        if (!replayMatchesRequestedCategory(existingDraft)) throw replayCategoryConflict()
        return JSON.parse(JSON.stringify(existingDraft))
    }

    const savedProduct = await (async () => {
        try {
            return await withActiveCategoryRowLock(
                payload,
                parsedCategory.data,
                tenantId,
                (canonicalCategoryId, req) => saveProduct({
                    ...(rawData as Record<string, unknown>),
                    category: [canonicalCategoryId],
                    status: 'draft',
                    aiReviewPending: true,
                }, undefined, { user, tenantId, payload, req }),
            )
        } catch (error) {
            // Also cover concurrent identical requests and ambiguous commit acknowledgements. If
            // the lookup itself is unavailable, preserve and report the original write failure.
            const committedReplay = await findReplay().catch(() => null)
            if (committedReplay) {
                if (!replayMatchesRequestedCategory(committedReplay)) throw replayCategoryConflict()
                return JSON.parse(JSON.stringify(committedReplay))
            }

            if (error instanceof Error && error.message === CATEGORY_LOCK_BUSY_ERROR) {
                throw new Error(JSON.stringify({
                    code: CATEGORY_LOCK_BUSY_ERROR,
                    message: 'This category is busy. Please try again.',
                }))
            }
            throw error
        }
    })()

    return savedProduct ?? categoryInvalidResult()
}

const ProductFieldUpdateSchema = z.union([
    z.object({ status: z.enum(['draft', 'active', 'archived']) }),
    z.object({ deletedAt: z.string().datetime({ offset: true }).nullable() }),
])

export async function updateProductFieldAction(id: string | number, data: unknown) {
    if (!id && id !== 0) throw new Error('Invalid product ID')

    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const validated = ProductFieldUpdateSchema.parse(data)
    const payload = await getPayload({ config: configPromise })

    // Subscription gate — checked here because the update below uses overrideAccess: true
    // (required to work around a Payload 3.79 bug with variant array 'id' fields).
    // Fix B: coerce to number so getActivePlanSubscription WHERE matches Neon integer FK
    const tenantId = tenantIdForQuery(user)
    if (tenantId != null) {
        const sub = await getActivePlanSubscription(payload, tenantId)
        if (!sub || !(await canUse(payload, sub.plan as PlanCode, 'product_management'))) {
            throw new Error('Product management is not available on your current plan.')
        }
    }

    // Tenant-scoped existence check — rejects updates on products not belonging to this tenant.
    // depth:0 returns raw IDs (no populated objects) so variants/variantConfigs come back
    // as plain objects ready to be re-passed to update.
    const existing = await payload.findByID({
        collection: 'products', id, user, depth: 0, overrideAccess: false, disableErrors: true,
    })
    if (!existing) throw new Error('Product not found or access denied')

    // Soft validation publishing gate (GH-1458) — only Draft/Archived -> Active is gated.
    // Re-checked server-side (not just in the client UI) because the payload.update below runs
    // with overrideAccess:true, which bypasses Payload's own field-level required checks.
    if ('status' in validated && validated.status === 'active') {
        const blocks = productPublishBlocks({
            price: existing.price,
            sku: existing.sku,
            inventory: existing.inventory,
            weight: existing.weight,
            hasVariants: existing.hasVariants,
            variants: existing.variants,
        })
        if (!blocks.ok) {
            throw new Error(JSON.stringify({ code: 'PUBLISH_BLOCKED', missingFields: blocks.missingFields }))
        }
    }
    // KNOWN LIMITATION (same class as the variant-loss race below): the gate check reads
    // `existing` here, then `saveProductAction` (a separate action) could concurrently clear
    // weight/sku on the same product between this read and the write below — no transaction/row
    // lock ties the two together. Accepted in practice: same risk profile as the variant race,
    // narrow window, no known exploit path beyond "two admins editing the same product at once."

    // Payload 3.79 Drizzle updateOne internally fetches the existing doc, merges it with the
    // incoming data, then runs traverseFields on the merged result. Variant array rows have an
    // auto-managed UUID 'id' that is NOT in user-defined field definitions, so traverseFields
    // throws "The following field is invalid: id" for every product that has variants.
    // Providing the arrays explicitly (stripped of the auto-managed 'id') prevents the internal
    // fetch+merge and bypasses this Payload bug.
    // KNOWN LIMITATION: reads then re-writes variants — a concurrent variant edit between the
    // findByID and update calls will lose the concurrent change. Acceptable in practice: status/
    // deletedAt toggles are fast operations; variant edits are slow UI-driven flows.
    const stripIds = (arr: unknown): unknown[] => {
        if (!Array.isArray(arr)) return []
        return arr.map((item) => {
            if (!item || typeof item !== 'object') return item
            const { id: _, ...rest } = item as Record<string, unknown>
            if (!Array.isArray(rest.options)) return rest
            return {
                ...rest,
                options: (rest.options as Record<string, unknown>[]).map((opt) => {
                    if (!opt || typeof opt !== 'object') return opt
                    const { id: _2, ...o } = opt as Record<string, unknown>
                    return o
                }),
            }
        })
    }

    // Coerce id to integer — Neon strict-mode requires INTEGER for _parent_id JOIN columns.
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id
    if (Number.isNaN(numericId)) throw new Error('Invalid product ID')

    const res = await payload.update({
        collection: 'products',
        id: numericId,
        data: {
            ...validated,
            variants: stripIds(existing.variants),
            variantConfigs: stripIds(existing.variantConfigs),
            // Activating a product means it's been reviewed — clear the AI-review flag.
            ...('status' in validated && validated.status === 'active' ? { aiReviewPending: false } : {}),
        },
        overrideAccess: true,
    })
    return JSON.parse(JSON.stringify(res))
}

export async function deleteProductAction(id: string | number) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const res = await payload.update({
        collection: 'products',
        id,
        data: {
            deletedAt: new Date().toISOString(),
        },
        user,
        overrideAccess: false,
    })
    return JSON.parse(JSON.stringify(res))
}
