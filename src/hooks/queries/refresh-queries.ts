import type { QueryClient, QueryKey } from '@tanstack/react-query'

/**
 * Data under `queryKey` changed (a write here, the assistant, another tab): mark it stale and refetch what is on
 * screen. A read already in flight is cancelled first — React Query would otherwise reuse a first read that started
 * before the write (`cancelRefetch` only replaces reads of queries that already have data).
 */
export async function refreshQueries(queryClient: QueryClient, queryKey: QueryKey): Promise<void> {
    await queryClient.cancelQueries({ queryKey })
    await queryClient.invalidateQueries({ queryKey })
}
