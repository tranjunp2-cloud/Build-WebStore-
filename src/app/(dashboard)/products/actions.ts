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

export async function updateProductFieldAction(id: string | number, data: unknown, opts?: { overrideAccess?: boolean }) {
    if (!id && id !== 0) throw new Error('Invalid product ID')

    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const res = await payload.update({
        collection: 'products',
        id,
        data: data as Record<string, unknown>,
        user,
        overrideAccess: opts?.overrideAccess ?? false,
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
