'use client'

import { createContext, Fragment, useContext, useEffect, type ReactNode } from 'react'
import { isServer, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NO_SCOPE, type QueryScope } from '@/hooks/queries/query-keys'

/**
 * Cache defaults for every screen: data is fresh for 30 s (a screen opened again within that window shows the cached
 * rows without a request), kept 10 min after its last screen unmounts, one retry. Window-focus refetch is off unless a
 * query opts in (`refetchOnWindowFocus: true`) — the notification poller already covers "something changed".
 */
export const QUERY_DEFAULTS = {
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    structuralSharing: true,
} as const

export function makeQueryClient(): QueryClient {
    return new QueryClient({ defaultOptions: { queries: { ...QUERY_DEFAULTS } } })
}

let browserQueryClient: QueryClient | undefined

/**
 * One client per browser tab, shared by the dashboard and the editor layouts (both mount QueryProvider), so moving
 * between them keeps the cache. On the server every render gets its own client: no data crosses requests.
 */
export function getQueryClient(): QueryClient {
    if (isServer) return makeQueryClient()
    browserQueryClient ??= makeQueryClient()
    return browserQueryClient
}

const QueryScopeContext = createContext<QueryScope>(NO_SCOPE)

/** The workspace scope every dashboard query key starts with (see hooks/queries/query-keys). */
export function useQueryScope(): QueryScope {
    return useContext(QueryScopeContext)
}

let lastWorkspaceScope: QueryScope | undefined

/**
 * A different workspace (or user) than the last one this tab showed: drop every query and mutation of the old one.
 * Keys already carry the scope, so the new workspace never reads the old entries; this frees them and stops their
 * in-flight requests from landing.
 */
function useWorkspaceCacheReset(queryClient: QueryClient, scope: QueryScope) {
    useEffect(() => {
        if (scope === NO_SCOPE) return
        const previous = lastWorkspaceScope
        lastWorkspaceScope = scope
        if (previous === undefined || previous === scope) return
        const otherWorkspace = { predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey[0] === 'ws' && q.queryKey[1] !== scope }
        void queryClient.cancelQueries(otherWorkspace)
        queryClient.removeQueries(otherWorkspace)
        queryClient.getMutationCache().clear()
    }, [queryClient, scope])
}

interface QueryProviderProps {
    children: ReactNode
    /** the signed-in user's workspace (tenant); omitted in the editor, whose queries are not workspace data */
    workspace?: string | null
    user?: string | number | null
}

export function QueryProvider({ children, workspace, user }: QueryProviderProps) {
    const queryClient = getQueryClient()
    // the dashboard always passes `workspace` (null for a user without one); the editor never does
    const scope: QueryScope = workspace === undefined ? NO_SCOPE : `${workspace ?? '-'}:${user ?? '-'}`
    useWorkspaceCacheReset(queryClient, scope)

    return (
        <QueryClientProvider client={queryClient}>
            <QueryScopeContext.Provider value={scope}>
                {/* another workspace or user: the screens start over, so no rows kept on screen (a list's previous
                    page, a failed filter's last rows) can carry the old workspace's data into the new one */}
                <Fragment key={scope}>{children}</Fragment>
            </QueryScopeContext.Provider>
        </QueryClientProvider>
    )
}
