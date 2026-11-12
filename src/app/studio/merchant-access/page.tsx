/**
 * /studio/merchant-access — super-admin opens a merchant's CMS through a one-time, logged link.
 * Server component: guard + the 20 most recent links; the shared client searches and creates links
 * through the existing /api/admin/merchant-access endpoints (no endpoint of its own).
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import config from '@payload-config'
import { getPayload } from 'payload'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { listRecentMerchantAccessEvents, type RecentMerchantAccessEvent } from '@/lib/support/merchant-access-recent'
import { MerchantAccessClient } from '@/components/support/merchant-access-client'
import { RecentMerchantAccess } from './_components/recent-merchant-access'

export const metadata: Metadata = { title: 'Merchant CMS access' }

export default async function StudioMerchantAccessPage() {
    await requireSuperAdmin()
    let events: RecentMerchantAccessEvent[] = []
    let failed = false
    try {
        events = await listRecentMerchantAccessEvents(await getPayload({ config }), 20)
    } catch (error) {
        // The audit table must never hide the link form.
        console.error('[merchant-access] recent events failed', error)
        failed = true
    }
    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Merchant CMS access</h1>
                </div>
            </div>
            <div className="space-y-6">
                <section className="rounded-lg bg-white p-5 text-slate-900">
                    <MerchantAccessClient showHeading={false} />
                </section>
                <RecentMerchantAccess events={events} failed={failed} />
            </div>
        </div>
    )
}
