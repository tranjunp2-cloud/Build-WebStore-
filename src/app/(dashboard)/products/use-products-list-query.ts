'use client'

import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queries/query-keys'
import { useKeptData } from '@/hooks/queries/use-kept-data'
import { whenIdle } from '@/hooks/queries/when-idle'
import { useQueryScope } from '@/providers/query-provider'
import { getProductsPageAction } from './actions'
import { getCategoriesAction } from './categories/actions'

export type ProductsListParams = {
    page: number
    limit: number
    status: string
    search: string
    lowStock: boolean
    sale: string
    categories: string[]
    sort: string
}

type StatusCounts = { all: number; active: number; draft: number; archived: number }
export type ProductsPage<Row> = { docs: Row[]; totalDocs: number; counts: StatusCounts; page: number; totalPages?: number }

const NO_COUNTS: StatusCounts = { all: 0, active: 0, draft: 0, archived: 0 }
/** store categories change rarely and a category change invalidates them (agent bus, categories page) */
const CATEGORIES_STALE_TIME = 5 * 60 * 1000

/** A typed search applies after a 250 ms pause; clearing it applies at once. */
export function useDebouncedSearch(search: string): string {
    const [applied, setApplied] = useState(search)
    useEffect(() => {
        if (!search) return setApplied('')
        const timer = setTimeout(() => setApplied(search), 250)
        return () => clearTimeout(timer)
    }, [search])
    return applied
}

/**
 * The products table's data: one cached query per page + filter set (`queryKeys.products.list`). Changing a filter or
 * page keeps the previous rows on screen until the new ones arrive; the next page is prefetched once the browser is
 * idle. Rows the screen changed optimistically are patched in the cache (`patchRows`).
 */
export function useProductsListQuery<Row extends { id: string }>(params: ProductsListParams) {
    const scope = useQueryScope()
    const queryClient = useQueryClient()

    const input = params
    const queryKey = queryKeys.products.list(scope, input)
    const query = useQuery({
        queryKey,
        queryFn: () => getProductsPageAction(input) as Promise<ProductsPage<Row>>,
        placeholderData: keepPreviousData,
    })
    const categoriesQuery = useQuery({
        queryKey: queryKeys.products.categories(scope),
        queryFn: async () => ((await getCategoriesAction()) ?? []) as Array<{ id: string; name: string; breadcrumbs?: string }>,
        staleTime: CATEGORIES_STALE_TIME,
    })

    // the rows last shown: a filter change that fails keeps them (the error toast offers a retry)
    const page = useKeptData(query.data)

    // the server clamps an out-of-range page: cache the answer under the page it really is
    const servedPage = query.data && !query.isPlaceholderData ? query.data.page : undefined
    useEffect(() => {
        if (servedPage === undefined || servedPage === input.page) return
        queryClient.setQueryData(queryKeys.products.list(scope, { ...input, page: servedPage }), query.data)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [servedPage])

    // prefetch the next page while the merchant reads this one (server actions run one at a time: wait for idle)
    const totalDocs = page?.totalDocs ?? 0
    const hasNext = servedPage !== undefined && servedPage * input.limit < totalDocs
    const nextKey = JSON.stringify({ ...input, page: (servedPage ?? 0) + 1 })
    useEffect(() => {
        if (!hasNext) return
        const next: ProductsListParams = JSON.parse(nextKey)
        return whenIdle(() => {
            void queryClient.prefetchQuery({
                queryKey: queryKeys.products.list(scope, next),
                queryFn: () => getProductsPageAction(next) as Promise<ProductsPage<Row>>,
            })
        })
    }, [hasNext, nextKey, queryClient, scope])

    /** apply an optimistic change to the rows on screen */
    const patchRows = (update: (rows: Row[]) => Row[]) => {
        // a refetch in flight would land over the change: drop it (the write's invalidation fetches again)
        void queryClient.cancelQueries({ queryKey, exact: true })
        queryClient.setQueryData<ProductsPage<Row>>(queryKey, (old) => (old ? { ...old, docs: update(old.docs) } : old))
    }
    /**
     * Every products page + filter combination is stale (counts move with any write). The one on view refetches, unless
     * the screen is about to switch to another one (`refetchShown: false`): that one loads when it is shown.
     */
    const invalidateLists = async ({ refetchShown = true }: { refetchShown?: boolean } = {}) => {
        const lists = { queryKey: queryKeys.products.lists(scope) }
        // a first read still in flight would otherwise be reused, and it may predate the write
        if (refetchShown) await queryClient.cancelQueries(lists)
        await queryClient.invalidateQueries({ ...lists, refetchType: refetchShown ? 'active' : 'none' })
    }

    return {
        rows: page?.docs ?? [],
        totalDocs,
        counts: page?.counts ?? NO_COUNTS,
        servedPage,
        categories: categoriesQuery.data ?? [],
        /** some page has loaded on this screen (a later failure keeps it) */
        loaded: page !== undefined,
        /** first load of this screen (nothing to show yet) */
        isLoading: page === undefined && query.isPending,
        query,
        patchRows,
        invalidateLists,
    }
}
