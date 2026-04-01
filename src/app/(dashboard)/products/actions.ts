'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

export async function getProductsAction() {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const res = await payload.find({
        collection: 'products',
        user: user as any,
        where: { deletedAt: { exists: false } },
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
        user: user as any,
        depth: 1
    })
    return JSON.parse(JSON.stringify(res))
}

export async function saveProductAction(data: any, id?: string | number) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

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
            user: user as any,
        })
        return JSON.parse(JSON.stringify(res))
    } else {
        const res = await payload.create({
            collection: 'products',
            data,
            user: user as any,
        })
        return JSON.parse(JSON.stringify(res))
    }
}

export async function updateProductFieldAction(id: string | number, data: any) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const res = await payload.update({
        collection: 'products',
        id,
        data,
        user: user as any,
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
        user: user as any,
    })
    return JSON.parse(JSON.stringify(res))
}
