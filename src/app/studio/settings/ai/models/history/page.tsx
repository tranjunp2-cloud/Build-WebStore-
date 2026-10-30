export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { loadHistory } from '@/lib/admin/ai-providers/load-view'
import { HistoryClient } from '../_components/history-client'
import { PageHead } from '../_components/page-head'
import { UnreachableBanner } from '../_components/unreachable-banner'

export const metadata: Metadata = { title: 'History' }

export default async function HistoryPage() {
    await requireSuperAdmin()
    const history = await loadHistory(100)
    return (
        <>
            <PageHead title="History" sub="Every change saved here, newest first. Restore an earlier version of providers, routing, tasks or runtime." />
            {history.ok ? <HistoryClient initial={history.data.entries} /> : <UnreachableBanner message={history.error} />}
        </>
    )
}
