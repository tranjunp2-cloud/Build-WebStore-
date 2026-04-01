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

    const categoriesWithCount = await Promise.all(
        res.docs.map(async (cat) => {
            const allIds = [cat.id, ...getDescendantIds(cat.id, res.docs)];
            
            const countRes = await payload.count({
                collection: 'products',
                where: {
                    and: [
                        { category: { in: allIds } },
                        { deletedAt: { exists: false } } // Do not count soft-deleted products
                    ]
                },
                user: user as any,
            })
            return {
                ...cat,
                productCount: countRes.totalDocs,
            }
        })
    )

    return JSON.parse(JSON.stringify(categoriesWithCount));
}

export async function saveCategoryAction(data: any, id?: string | number) {
    const user = await getCurrentUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

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
