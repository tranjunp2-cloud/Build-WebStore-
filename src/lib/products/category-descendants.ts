import type { Payload } from 'payload'

const CATEGORY_PAGE_SIZE = 500

type CategoryLookupRow = {
    id: number | string
    parent?: number | string | { id?: number | string } | null
}

export async function getCategoryDescendantIds(payload: Payload, siteId: number, categoryIds: number[]): Promise<number[] | null> {
    const idToParent = new Map<number, number | null>()
    let currentPage = 1
    let totalPages = 1

    while (currentPage <= totalPages) {
        const categoriesResult = await payload.find({
            collection: 'categories',
            where: { and: [{ site: { equals: siteId } }, { deletedAt: { exists: false } }] },
            limit: CATEGORY_PAGE_SIZE,
            page: currentPage,
            depth: 0,
            overrideAccess: true,
            select: { id: true, parent: true },
        })

        totalPages = categoriesResult.totalPages || 1
        categoriesResult.docs.forEach((doc) => {
            const row = doc as unknown as CategoryLookupRow
            const parentRaw = row.parent
            const parentId = typeof parentRaw === 'object' && parentRaw !== null ? parentRaw.id : parentRaw
            idToParent.set(Number(row.id), parentId ? Number(parentId) : null)
        })
        currentPage += 1
    }

    const validSeedIds = Array.from(new Set(categoryIds.filter((id) => idToParent.has(id))))
    if (validSeedIds.length === 0) return null

    const descendantIds = new Set<number>(validSeedIds)
    let changed = true

    while (changed) {
        changed = false
        idToParent.forEach((parentId, id) => {
            if (parentId !== null && descendantIds.has(parentId) && !descendantIds.has(id)) {
                descendantIds.add(id)
                changed = true
            }
        })
    }

    return Array.from(descendantIds)
}
