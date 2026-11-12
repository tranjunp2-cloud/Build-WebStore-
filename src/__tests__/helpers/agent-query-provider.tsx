import React from 'react'
import { AgentQueryInvalidator } from '@/lib/agent-changes/agent-query-invalidator'
import { DashboardQueryProvider } from './query-provider'

/**
 * The dashboard layout's real wiring for one test workspace: the shared query client plus the bridge that turns
 * assistant changes into query invalidations (app/(dashboard)/layout.tsx mounts both).
 */
export function AgentDashboardQueryProvider({ children }: { children: React.ReactNode }) {
    return (
        <DashboardQueryProvider>
            <AgentQueryInvalidator />
            {children}
        </DashboardQueryProvider>
    )
}
