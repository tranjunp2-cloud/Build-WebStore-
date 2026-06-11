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
        user,
        where: { deletedAt: { exists: false } },
        depth: 1,
        limit: 1000,
    })

    const getDescendantIds = (parentId: string | number, allCats: Array<{ id: string | number; parent?: string | number | { id: string | number } | null }>): (string | number)[] => {
        const children = allCats.filter(c => {
            const pId = typeof c.parent === 'object' && c.parent !== null ? c.parent.id : c.parent;
            return pId === parentId;
        });
        const childIds = children.map(c => c.id);
        const descendantIds = childIds.flatMap(id => getDescendantIds(id, allCats));
        return [...childIds, ...descendantIds];
    };

    // Solve N+1 & Compute Efficiently: Group by in Database to prevent loading all Product records to RAM
    const { sql } = await import('drizzle-orm')
    const countResult = await (payload.db as any).drizzle.execute(
        sql`SELECT r.categories_id as category_id, COUNT(DISTINCT r.parent_id)::int as count 
            FROM products_rels r
            JOIN products p ON p.id = r.parent_id
            WHERE r.path = 'category' AND p.deleted_at IS NULL 
            GROUP BY r.categories_id`
    )

    const categoryCountMap: Record<string | number, number> = {}
    for (const row of countResult.rows as Array<{ category_id?: number | string | null; count: number }>) {
        if (row.category_id) {
            categoryCountMap[row.category_id] = row.count;
        }
    }

    const categoriesWithCount = res.docs.map((cat) => {
        const allIds = [cat.id, ...getDescendantIds(cat.id, res.docs)]
        let productCount = 0;
        for (const id of allIds) {
            productCount += categoryCountMap[id] || 0;
        }
        
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
    parent: z.union([z.number(), z.string(), z.record(z.unknown())]).nullable().optional(),
    depth: z.number().optional()
}).passthrough();

export async function saveCategoryAction(rawData: unknown, id?: string | number) {
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
            user,
            overrideAccess: false,
        })
        return JSON.parse(JSON.stringify(res));
    } else {
        const res = await payload.create({
            collection: 'categories',
            data,
            user,
            overrideAccess: false,
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
        user,
        overrideAccess: false,
    })
    return JSON.parse(JSON.stringify(res));
}
