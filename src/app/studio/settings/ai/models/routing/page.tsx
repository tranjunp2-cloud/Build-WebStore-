export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { loadSettingsView } from '@/lib/admin/ai-providers/load-view'
import { loadPricedRefs } from '@/lib/admin/ai-providers/priced-models'
import { PageHead } from '../_components/page-head'
import { RoutingClient } from '../_components/routing-client'
import { UnreachableBanner } from '../_components/unreachable-banner'

export const metadata: Metadata = { title: 'Routing' }

export default async function RoutingPage() {
    await requireSuperAdmin()
    const [view, priced] = await Promise.all([loadSettingsView(), loadPricedRefs()])
    return (
        <>
            <PageHead title="Routing" sub="Which model answers each tier. The first usable model answers; if it fails or times out, the next one does." />
            {view.ok ? <RoutingClient initial={view.data} priced={priced} /> : <UnreachableBanner message={view.error} />}
        </>
    )
}
