export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { loadSettingsView } from '@/lib/admin/ai-providers/load-view'
import { loadPricedRefs } from '@/lib/admin/ai-providers/priced-models'
import { PageHead } from '../_components/page-head'
import { ProvidersClient } from '../_components/providers-client'
import { UnreachableBanner } from '../_components/unreachable-banner'

export const metadata: Metadata = { title: 'Providers' }

export default async function ProvidersPage() {
    await requireSuperAdmin()
    const [view, priced] = await Promise.all([loadSettingsView(), loadPricedRefs()])
    return (
        <>
            <PageHead title="Providers" sub="API keys the AI service can use. A provider that is off or has no working key is skipped in every chain." />
            {view.ok ? <ProvidersClient initial={view.data} priced={priced} /> : <UnreachableBanner message={view.error} />}
        </>
    )
}
