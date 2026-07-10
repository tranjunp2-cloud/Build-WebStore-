'use server'

import { getPayload, type Where } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { productPublishBlocks } from '@/lib/products/publish-guard'
import { buildProductAlt } from '@/lib/products/build-product-alt'

// Upper bound for SKU conflict query results. If totalDocs exceeds this, the save is aborted
// with a user-facing error. In practice a single SKU or small batch rarely matches > 100 products.
// NOTE: This check is best-effort, fast-path UX — two limitations apply:
//   1. NOT concurrent-safe on its own: two parallel saves with the same SKU can both pass this
//      SELECT before either INSERT commits (TOCTOU). The DB-level unique index
//      `products_sku_tenant_uniq` (per tenant, case-insensitive, scripts/db-setup.js F08-1032)
//      is the authoritative backstop for the base `sku` — see `translateDbSkuConflict` below,
//      which converts that constraint's rejection into the same FIELD_ERRORS shape thrown here,
//      so callers (incl. BulkCreateModal's SKU-retry loop) handle both layers identically.
//      Cross-product variant-sku uniqueness has NO DB-level backstop (only same-product variant
//      SKUs are DB-enforced, via `products_variants_sku_parent_uniq`) — remains app-check-only.
//   2. Case-sensitive match only: the `in:` query generates SQL IN (...) which is case-sensitive
//      on Postgres. "ABC-001" and "abc-001" are treated as distinct SKUs here; the app-layer
//      case-fold below only catches cross-case conflicts among rows this exact-case query found.
const SKU_CONFLICT_QUERY_LIMIT = 100

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
    // When tenantId is null (super-admin or single-tenant setup) no tenant filter is applied —
    // the query spans all tenants. This is intentional: null-tenant users should not be able
    // to create SKUs that conflict with any tenant's products.
    const where: Where = {
        and: [
            { deletedAt: { exists: false } },
            ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
            ...(excludeId ? [{ id: { not_equals: excludeId } }] : []),
            // Payload 3 dotted-path on array sub-fields (variants.sku → JOIN products_variants).
            // WHERE shape locked by TC-F08-SKU-GLOBAL-10.
            { or: [
                { sku: { in: skus } },
                { 'variants.sku': { in: skus } },
            ]},
        ],
    }
    const result = await payload.find({ collection: 'products', where, limit: SKU_CONFLICT_QUERY_LIMIT, depth: 0 })
    if (result.docs.length === 0) return []
    if (result.totalDocs > result.docs.length) {
        throw new Error(
            'Cannot verify SKU uniqueness: your account has too many matching products. Please contact support.'
        )
    }
    // Case-fold both sides so the application-layer check is case-insensitive.
    // The SQL IN query above is case-sensitive, so this only catches exact-case matches
    // returned by the DB — it does NOT detect cross-case conflicts (e.g. "ABC" vs "abc").
    const skusLower = new Set(skus.map(s => s.toLowerCase()))
    const matched = new Set<string>()
    for (const doc of result.docs) {
        if (typeof doc.sku === 'string' && skusLower.has(doc.sku.toLowerCase())) matched.add(doc.sku)
        if (Array.isArray(doc.variants)) {
            for (const v of doc.variants as Array<{ sku?: string }>) {
                if (v?.sku && typeof v.sku === 'string' && skusLower.has(v.sku.toLowerCase())) matched.add(v.sku)
            }
        }
    }
    return Array.from(matched)
}

export async function getProductsAction() {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    // Fix B: coerce to number so payload WHERE matches Neon integer FK (tenant_id integer)
    const tenantId = tenantIdForQuery(user)
    const payload = await getPayload({ config: configPromise })
    const res = await payload.find({
        collection: 'products',
        user,
        where: {
            and: [
                { deletedAt: { exists: false } },
                ...(tenantId != null ? [{ tenant: { equals: tenantId } }] : []),
            ],
        },
        limit: 100,
        depth: 1
    })
    return JSON.parse(JSON.stringify(res.docs))
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

const ProductServerSchema = z.object({
    // max(120) matches product-form/schema.ts's client-side cap — without it here, a direct
    // saveProductAction call could submit an arbitrarily long name, which then flows unbounded
    // into the alt-text fallback below ("{name} - {store}") despite that field's own .max(500).
    name: z.string().min(3, "Name must be at least 3 characters").max(120, "Name must not exceed 120 characters"),
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

export async function saveProductAction(rawData: unknown, id?: string | number) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const data = ProductServerSchema.parse(rawData);

    const payload = await getPayload({ config: configPromise })

    const candidateSkus = [
        ...(typeof data.sku === 'string' && data.sku.trim() ? [data.sku.trim()] : []),
        ...((data.variants as Array<{ sku?: string }> | undefined) || [])
            .map(v => typeof v.sku === 'string' ? v.sku.trim() : '')
            .filter(Boolean),
    ]
    // Fix B: coerce to number so SKU scope and tenant filter match Neon integer FK
    const tenantId = tenantIdForQuery(user)

    // Alt-text fallback (GH-1458) needs the store name — fetched once per save, same
    // "one site per tenant" lookup pattern used elsewhere in the dashboard (see
    // src/app/(dashboard)/actions.ts addTrackedKeyword).
    let storeName: string | undefined
    if (tenantId != null) {
        const sitesRes = await payload.find({
            collection: 'sites', where: { tenant: { equals: tenantId } }, limit: 1, depth: 0,
        })
        storeName = sitesRes.docs[0]?.name ?? undefined
    }

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

    // Alt-text fallback (GH-1458): blank alt -> "{name} - {store}", so the storefront <img alt>
    // is never empty. Single source of truth shared with the storefront render paths. Re-capped
    // at 500 (matches the schema's alt max) since the derived string is computed AFTER Zod
    // validation and isn't re-checked otherwise.
    if (data.images && data.images.length > 0) {
        data.images = data.images.map((img) => ({ ...img, alt: buildProductAlt(img.alt, data.name, storeName).slice(0, 500) }))
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
                // Bypass Payload/Drizzle transaction: commitTransaction silently swallows COMMIT
                // errors (done.catch(()=>{}) in beginTransaction absorbs PostgreSQL commit failures),
                // so products appear created but are rolled back. Without a transaction each INSERT
                // auto-commits, avoiding the silent-commit-failure bug. Tradeoff: if variants INSERT
                // fails after the products row commits, the product row stays with no variants;
                // that failure still propagates to the user via handleUpsertError → throw.
                disableTransaction: true,
            })
            // Verify the product actually exists in DB — detects silent Payload/Drizzle commit failures
            // where commitTransaction swallows COMMIT errors and returns the doc as if it succeeded.
            try {
                const verify = await payload.findByID({ collection: 'products', id: res.id, overrideAccess: true, depth: 0 })
                if (!verify?.id) {
                    console.error('[products.create] VERIFY FAILED — product not in DB after create!', { id: res?.id })
                    throw new Error('Product was not saved. Please try again.')
                }
            } catch (verifyErr) {
                if ((verifyErr as Error)?.message === 'Product was not saved. Please try again.') throw verifyErr
                console.error('[products.create] VERIFY ERROR', { id: res?.id, verifyErr })
                throw new Error('Product was not saved. Please try again.')
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
