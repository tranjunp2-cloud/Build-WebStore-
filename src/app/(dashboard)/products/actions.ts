'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser, extractTenantId } from '@/lib/auth'

export async function getProductsAction() {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const tenantId = extractTenantId(user)
    const payload = await getPayload({ config: configPromise })
    const res = await payload.find({
        collection: 'products',
        user,
        where: {
            and: [
                { deletedAt: { exists: false } },
                ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
            ],
        },
        limit: 100,
        depth: 1
    })
    return JSON.parse(JSON.stringify(res.docs))
}

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
    return JSON.parse(JSON.stringify(res))
}

import { z } from 'zod'

const ProductServerSchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    images: z.array(z.object({
        image: z.union([z.string(), z.number(), z.record(z.unknown())]).optional(),
        alt: z.string().optional()
    })).optional(),
}).passthrough();

export async function saveProductAction(rawData: unknown, id?: string | number) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const data = ProductServerSchema.parse(rawData);
    
    const payload = await getPayload({ config: configPromise })
    
    // Automatically attach default placeholder image if none provided
    if (!data.images || data.images.length === 0) {
        try {
            const { getOrCreateCrateCartonIdAction } = await import('@/app/(dashboard)/actions/media')
            const cartonId = await getOrCreateCrateCartonIdAction()
            if (cartonId) {
                data.images = [{ image: cartonId, alt: data.name || 'Placeholder Image' }]
            }
        } catch (err) {
            console.error('Failed to attach placeholder image', err)
        }
    }
    
    if (id) {
        const res = await payload.update({
            collection: 'products',
            id,
            data,
            user,
        })
        return JSON.parse(JSON.stringify(res))
    } else {
        const res = await payload.create({
            collection: 'products',
            data,
            user,
        })
        return JSON.parse(JSON.stringify(res))
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

    // Access gate: findByID with user enforces tenant-scoped access check.
    // depth:0 returns raw IDs (no populated objects) so variants/variantConfigs come back
    // as plain objects ready to be re-passed to update.
    const existing = await payload.findByID({
        collection: 'products', id, user, depth: 0, disableErrors: true,
    })
    if (!existing) throw new Error('Product not found or access denied')

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
    })
    return JSON.parse(JSON.stringify(res))
}
