export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { loadHistory, loadSettingsView } from '@/lib/admin/ai-providers/load-view'
import { OverviewView } from '../_components/overview-view'
import { PageHead } from '../_components/page-head'
import { UnreachableBanner } from '../_components/unreachable-banner'

export const metadata: Metadata = { title: 'Providers & models' }

export default async function OverviewPage() {
    await requireSuperAdmin()
    const [view, history] = await Promise.all([loadSettingsView(), loadHistory(3)])
    return (
        <>
            <PageHead title="Overview" sub="What answers each tier right now. The first usable model in a chain answers; the others are skipped until they work again." />
            {view.ok
                ? <OverviewView view={view.data} history={history.ok ? history.data.entries : null} />
                : <UnreachableBanner message={view.error} />}
        </>
    )
}
