import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { z } from 'zod'
import type { getCurrentUser } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { productPublishBlocks } from '@/lib/products/publish-guard'
import { buildProductAlt } from '@/lib/products/build-product-alt'
import { findOrCreateCartonMedia } from '@/lib/media/carton-placeholder'
import { withAiActorFor } from '@/lib/ai/seo-actor'
import { BASE_SKU_MAX, BASE_SKU_TOO_LONG_MESSAGE, VARIANT_SKU_MAX, VARIANT_SKU_TOO_LONG_MESSAGE } from '@/lib/products/sku-limits'
import { findConflictingSkus, translateDbSkuConflict } from '@/lib/products/product-sku-conflicts'
import { assertFreshVersion } from '@/lib/save-version/save-version'

/**
 * Product persistence shared by the dashboard's server actions and the AI copilot's approval step.
 * Not a 'use server' module on purpose: callers pass an already-authenticated user and tenant, which
 * must never be client-controllable. The server actions in `app/(dashboard)/products/actions.ts` are thin
 * wrappers that read the session and call these functions.
 */

// Product reads and the replies of product writes carry the tenant / site fields the editor may show, never whole
// rows: the Local API skips field read access, so a populated tenant hands the browser (and the copilot) its
// payment / courier secrets and ECH key (TC-PERF-076, TC-PERF-131).
export const PRODUCT_EDITOR_POPULATE = { tenants: { name: true, slug: true }, sites: { name: true, domain: true } } as const

export type ProductUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
export type ProductPayload = Awaited<ReturnType<typeof getPayload>>

/** Who is saving, and in which workspace (numeric ids are numbers: Neon integer FK columns). */
export interface ProductActor {
    user: ProductUser
    tenantId: string | number | null
}

export class ProductPersistenceVerificationError extends Error {
    readonly code = 'PERSISTENCE_VERIFY_FAILED'

    constructor(cause?: unknown) {
        super(
            'Product was not saved. Please try again.',
            cause === undefined ? undefined : { cause },
        )
        this.name = 'ProductPersistenceVerificationError'
    }
}

const BASE_SKU_SCHEMA = z.string().trim().min(1, 'SKU cannot be empty').max(BASE_SKU_MAX, BASE_SKU_TOO_LONG_MESSAGE)
const VARIANT_SKU_SCHEMA = z.string().trim().min(1, 'SKU cannot be empty').max(VARIANT_SKU_MAX, VARIANT_SKU_TOO_LONG_MESSAGE)

export const ProductServerSchema = z.object({
    // max(120) matches product-form/schema.ts's client-side cap — without it here, a direct
    // saveProductAction call could submit an arbitrarily long name, which then flows unbounded
    // into the alt-text fallback below ("{name} - {store}") despite that field's own .max(500).
    name: z.string().min(3, "Name must be at least 3 characters").max(120, "Name must not exceed 120 characters"),
    sku: BASE_SKU_SCHEMA.optional(),
    variants: z.array(z.object({ sku: VARIANT_SKU_SCHEMA.optional() }).passthrough()).max(900).optional(),
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


export interface ProductSaveContext extends ProductActor {
    payload?: ProductPayload
    source?: 'ai'
    /**
     * `patch`: the data holds only the fields to change (the AI copilot). It never attaches the
     * placeholder photo, and it leaves `aiReviewPending` as it is (a hand edit clears it, a copilot
     * edit does not). A product with options keeps its variants (re-passed without row ids, see
     * `stripRowIds`).
     */
    mode?: 'patch'
    /** The photo a product without pictures gets. Default: the tenant's crate-carton placeholder media. */
    placeholderImageId?: () => Promise<string | number | null>
    /**
     * The `updatedAt` the form loaded (an update only). A product changed since is refused with a
     * VersionConflictError and nothing is written. Read-then-write in this request: another save landing
     * between the check and the update still wins (no row lock). Not given: no check.
     */
    expectedUpdatedAt?: string | null
}

/** Variant / variant-config rows without Payload's auto-managed row ids (see `updateProductField`). */
export function stripRowIds(arr: unknown): unknown[] {
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

/** The tenant's crate-carton placeholder photo (repairs a stale record the same way the dashboard action does). */
async function defaultPlaceholderImageId(payload: ProductPayload, tenantId: string | number | null, user: ProductUser) {
    const result = await findOrCreateCartonMedia(payload, tenantId, user)
    if (!result) return null
    if (typeof result.replacedStaleId === 'number') {
        const { repairStaleProductImageRefs } = await import('@/app/(dashboard)/actions/media-repair')
        await repairStaleProductImageRefs(payload, result.replacedStaleId, result.id).catch(() => {})
        payload.delete({ collection: 'media', id: result.replacedStaleId }).catch(err =>
            console.warn('[Crate Carton] Stale record cleanup failed (non-fatal):', err),
        )
    }
    return result.id
}

export async function saveProduct(rawData: unknown, id: string | number | undefined, context: ProductSaveContext) {
    const { user } = context
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

    const payload = context.payload ?? await getPayload({ config: configPromise })

    const candidateSkus = [
        ...(typeof data.sku === 'string' && data.sku.trim() ? [data.sku.trim()] : []),
        ...((data.variants as Array<{ sku?: string }> | undefined) || [])
            .map(v => typeof v.sku === 'string' ? v.sku.trim() : '')
            .filter(Boolean),
    ]
    // Fix B: coerce to number so SKU scope and tenant filter match Neon integer FK
    const tenantId = context.tenantId

    // `id != null` (not truthy `id`) — a falsy `id === 0` is a legitimate Payload primary key
    // and must route to the update branch below, not silently fall through to create.
    const hasId = id != null && id !== ''
    const numId = hasId ? (typeof id === 'string' ? parseInt(id, 10) : id) : undefined
    if (numId !== undefined && Number.isNaN(numId)) throw new Error('Invalid product ID')

    if (hasId && context.expectedUpdatedAt !== undefined) {
        const stored = await payload.findByID({ collection: 'products', id: numId!, user, depth: 0, overrideAccess: false, disableErrors: true })
        if (stored) assertFreshVersion(context.expectedUpdatedAt, stored.updatedAt)
    }

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

    // Automatically attach default placeholder image if none provided (a patch only touches what it names)
    if (context.mode !== 'patch' && (!data.images || data.images.length === 0)) {
        try {
            const cartonId = context.placeholderImageId
                ? await context.placeholderImageId()
                : await defaultPlaceholderImageId(payload, tenantId, user)
            if (cartonId) {
                data.images = [{ image: cartonId }]
            }
        } catch (err) {
            if (context.source !== 'ai') {
                const causeName = err instanceof Error ? err.name : 'UnknownError'
                console.error('Failed to attach placeholder image', { causeName })
            }
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
        // A copilot patch is not a review: the flag stays as it is.
        if (context.mode !== 'patch') (data as Record<string, unknown>).aiReviewPending = false
        try {
            const res = await payload.update({
                collection: 'products',
                id: id as string | number,
                data,
                user,
                overrideAccess: false,
                depth: 1,
                populate: PRODUCT_EDITOR_POPULATE,
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
                depth: 1,
                populate: PRODUCT_EDITOR_POPULATE,
                // Payload's adapter commit helper can swallow PostgreSQL COMMIT errors. Force an
                // independently auto-committed write for manual and AI creates, then verify through
                // a separate read before reporting success (GH-1410/GH-1733).
                disableTransaction: true,
            })
            {
                // Verify the independently auto-committed row before reporting success. The AI
                // boundary performs an additional exact tenant/slug/state/category verification.
                try {
                    const verify = await payload.findByID({
                        collection: 'products',
                        id: res.id,
                        overrideAccess: true,
                        depth: 0,
                    })
                    if (!verify?.id) {
                        if (context.source !== 'ai') {
                            console.error('[products.create] persistence verification failed', { id: res?.id })
                        }
                        throw new ProductPersistenceVerificationError()
                    }
                } catch (verifyErr) {
                    if (verifyErr instanceof ProductPersistenceVerificationError) throw verifyErr
                    if (context.source !== 'ai') {
                        const causeName = verifyErr instanceof Error ? verifyErr.name : 'UnknownError'
                        console.error('[products.create] persistence verification error', { id: res?.id, causeName })
                    }
                    throw new ProductPersistenceVerificationError(verifyErr)
                }
            }
            return JSON.parse(JSON.stringify(res))
        } catch (createErr) {
            if (context.source !== 'ai') {
                const candidate = createErr as { name?: unknown; code?: unknown }
                console.error('[products.create] failed', {
                    tenant: tenantId,
                    causeName: typeof candidate?.name === 'string' ? candidate.name : 'UnknownError',
                    causeCode: typeof candidate?.code === 'string' ? candidate.code : undefined,
                })
            }
            throw translateDbSkuConflict(createErr, data as Record<string, unknown>)
        }
    }
}

// `status` + `deletedAt` together is the copilot's undo of a status change (put both back at once).
const ProductFieldUpdateSchema = z.union([
    z.object({
        status: z.enum(['draft', 'active', 'archived']),
        deletedAt: z.string().datetime({ offset: true }).nullable(),
    }),
    z.object({ status: z.enum(['draft', 'active', 'archived']) }),
    z.object({ deletedAt: z.string().datetime({ offset: true }).nullable() }),
])

/** `expectedUpdatedAt`: the `updatedAt` the list row showed; a product changed since is refused (VersionConflictError), nothing written. */
export async function updateProductField(id: string | number, data: unknown, actor: ProductActor, expectedUpdatedAt?: string | null) {
    if (!id && id !== 0) throw new Error('Invalid product ID')

    const { user, tenantId } = actor
    if (!user) throw new Error('Unauthorized')

    const validated = ProductFieldUpdateSchema.parse(data)
    const payload = await getPayload({ config: configPromise })

    // Subscription gate — checked here because the update below uses overrideAccess: true
    // (required to work around a Payload 3.79 bug with variant array 'id' fields).
    // Fix B: coerce to number so getActivePlanSubscription WHERE matches Neon integer FK
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
    assertFreshVersion(expectedUpdatedAt, existing.updatedAt)

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

    // Coerce id to integer — Neon strict-mode requires INTEGER for _parent_id JOIN columns.
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id
    if (Number.isNaN(numericId)) throw new Error('Invalid product ID')

    // overrideAccess with no `user` leaves the hooks without a caller: the SEO an activation queues would
    // run as nobody and write template text. The write runs as the merchant's AI actor instead.
    const res = await withAiActorFor(user, tenantId, () => payload.update({
        collection: 'products',
        id: numericId,
        data: {
            ...validated,
            variants: stripRowIds(existing.variants),
            variantConfigs: stripRowIds(existing.variantConfigs),
            // Activating a product means it's been reviewed — clear the AI-review flag.
            ...('status' in validated && validated.status === 'active' ? { aiReviewPending: false } : {}),
        },
        overrideAccess: true,
        depth: 1,
        populate: PRODUCT_EDITOR_POPULATE,
    }))
    return JSON.parse(JSON.stringify(res))
}

/** Moves a product to the trash (soft delete) with the caller's own access. */
export async function deleteProduct(id: string | number, actor: Pick<ProductActor, 'user'>) {
    const { user } = actor
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
        depth: 1,
        populate: PRODUCT_EDITOR_POPULATE,
    })
    return JSON.parse(JSON.stringify(res))
}
