'use client'

import { useCallback } from 'react'
import { getQueryClient, useQueryScope } from '@/providers/query-provider'
import { queryKeys, type QueryDomain } from './query-keys'
import { refreshQueries } from './refresh-queries'

/**
 * After a write made outside a list screen (a detail form, a dialog): mark that domain's cached data stale. Screens on
 * view refetch in the background; cached ones refetch when opened, so going back never shows the old row for long.
 * Uses the tab's one client directly, so a form also works where no QueryProvider is mounted (nothing to invalidate).
 */
export function useInvalidateDomain(): (domain: QueryDomain) => Promise<void> {
    const queryClient = getQueryClient()
    const scope = useQueryScope()
    return useCallback(
        (domain: QueryDomain) => refreshQueries(queryClient, queryKeys[domain].all(scope)),
        [queryClient, scope],
    )
}
