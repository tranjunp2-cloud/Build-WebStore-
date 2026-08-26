interface PayloadFindResult<TDoc> {
    docs: TDoc[]
    totalPages?: number | null
    hasNextPage?: boolean | null
}

const MAX_PAGINATION_PAGES = 1000

export async function findAllPayloadDocs<TDoc>(
    payload: {
        // Payload.find is collection-generic; this helper intentionally erases
        // that detail because each caller supplies a collection-scoped query.
        find: (args: any) => Promise<PayloadFindResult<unknown>>
    },
    args: Record<string, unknown>,
    pageSize: number,
): Promise<TDoc[]> {
    const docs: TDoc[] = []

    for (let page = 1; page <= MAX_PAGINATION_PAGES; page++) {
        const result = await payload.find({ ...args, page, limit: pageSize })
        docs.push(...((Array.isArray(result.docs) ? result.docs : []) as TDoc[]))

        const hasNextPage = typeof result.hasNextPage === 'boolean'
            ? result.hasNextPage
            : typeof result.totalPages === 'number'
                ? page < result.totalPages
                : false

        if (!hasNextPage) {
            return docs
        }
    }

    throw new Error(`Exceeded payload pagination safety guard (${MAX_PAGINATION_PAGES} pages)`)
}
