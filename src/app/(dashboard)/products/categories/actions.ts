'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

export async function getCategoriesAction() {
    const user = await getCurrentUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    const payload = await getPayload({ config: configPromise })
    
    const res = await payload.find({
        collection: 'categories',
        user: user as any,
        where: { deletedAt: { exists: false } },
        depth: 1,
        limit: 1000,
    })

    const getDescendantIds = (parentId: string | number, allCats: any[]): (string | number)[] => {
        const children = allCats.filter(c => {
            const pId = typeof c.parent === 'object' && c.parent !== null ? c.parent.id : c.parent;
            return pId === parentId;
        });
        const childIds = children.map(c => c.id);
        const descendantIds = childIds.flatMap(id => getDescendantIds(id, allCats));
        return [...childIds, ...descendantIds];
    };

    // Solve N+1: Lấy trước toàn bộ Product id + category để đếm trong RAM
    const allProducts = await payload.find({
        collection: 'products',
        where: { deletedAt: { exists: false } },
        depth: 0,
        pagination: false,
        select: { category: true },
        user: user as any,
    })

    const categoriesWithCount = res.docs.map((cat) => {
        const allIds = [cat.id, ...getDescendantIds(cat.id, res.docs)]
        const productCount = allProducts.docs.filter((p: any) => {
            const pCatId = typeof p.category === 'object' && p.category !== null ? p.category.id : p.category;
            return allIds.includes(pCatId);
        }).length;
        
        return {
            ...cat,
            productCount,
        }
    })

    return JSON.parse(JSON.stringify(categoriesWithCount));
}

import { z } from 'zod';

const CategoryServerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    slug: z.string().optional(),
    parent: z.union([z.number(), z.string(), z.record(z.any())]).nullable().optional(),
    depth: z.number().optional()
}).passthrough();

export async function saveCategoryAction(rawData: any, id?: string | number) {
    const user = await getCurrentUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    const data = CategoryServerSchema.parse(rawData);

    const payload = await getPayload({ config: configPromise })
    
    if (id) {
        const res = await payload.update({
            collection: 'categories',
            id,
            data,
            user: user as any,
        })
        return JSON.parse(JSON.stringify(res));
    } else {
        const res = await payload.create({
            collection: 'categories',
            data,
            user: user as any,
        })
        return JSON.parse(JSON.stringify(res));
    }
}

export async function deleteCategoryAction(id: string | number) {
    const user = await getCurrentUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    const payload = await getPayload({ config: configPromise })
    
    const res = await payload.update({
        collection: 'categories',
        id,
        data: {
            deletedAt: new Date().toISOString(),
        },
        user: user as any,
    })
    return JSON.parse(JSON.stringify(res));
}
