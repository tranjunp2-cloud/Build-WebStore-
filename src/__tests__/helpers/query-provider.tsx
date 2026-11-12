import React from 'react'
import { getQueryClient, QUERY_DEFAULTS, QueryProvider } from '@/providers/query-provider'

/** The dashboard's real provider (shared client, workspace-scoped keys) for one test workspace. */
export function DashboardQueryProvider({ children, workspace = 'tenant-1', user = 'user-1' }: { children: React.ReactNode; workspace?: string; user?: string }) {
    return <QueryProvider workspace={workspace} user={user}>{children}</QueryProvider>
}

/**
 * Empty the tab-wide client between tests and turn retries off (a rejected mock would otherwise be called twice,
 * a second later). Everything else keeps the production defaults.
 */
export function resetQueryCache(): void {
    const client = getQueryClient()
    client.clear()
    client.setDefaultOptions({ queries: { ...QUERY_DEFAULTS, retry: false } })
}
