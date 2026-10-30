export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { loadSettingsView } from '@/lib/admin/ai-providers/load-view'
import { PageHead } from '../_components/page-head'
import { RuntimeClient } from '../_components/runtime-client'
import { UnreachableBanner } from '../_components/unreachable-banner'

export const metadata: Metadata = { title: 'Runtime' }

export default async function RuntimePage() {
    await requireSuperAdmin()
    const view = await loadSettingsView()
    return (
        <>
            <PageHead title="Runtime" sub="Limits and switches that used to be environment variables. Each shows its default; a value set here wins over the environment." />
            {view.ok ? <RuntimeClient initial={view.data} /> : <UnreachableBanner message={view.error} />}
        </>
    )
}
