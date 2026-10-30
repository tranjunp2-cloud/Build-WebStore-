export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { loadSettingsView } from '@/lib/admin/ai-providers/load-view'
import { PageHead } from '../_components/page-head'
import { TasksClient } from '../_components/tasks-client'
import { UnreachableBanner } from '../_components/unreachable-banner'

export const metadata: Metadata = { title: 'Tasks' }

export default async function TasksPage() {
    await requireSuperAdmin()
    const view = await loadSettingsView()
    return (
        <>
            <PageHead title="Tasks" sub="Which tier each kind of request uses. Change one only when a task needs a faster or a better model." />
            {view.ok ? <TasksClient initial={view.data} /> : <UnreachableBanner message={view.error} />}
        </>
    )
}
