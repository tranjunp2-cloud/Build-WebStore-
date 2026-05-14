import { redirect } from 'next/navigation'
import { getCurrentUser, getCurrentTenantId } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ShippingSettingsClient } from './shipping-settings-client'

export const dynamic = 'force-dynamic'

export default async function ShippingSettingsPage() {
    const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
    if (!user) redirect('/login?returnUrl=/settings/shipping')
    if (!tenantId) redirect('/dashboard')

    const payload = await getPayload({ config })
    const siteResult = await payload.find({
        collection: 'sites',
        where: { tenant: { equals: tenantId } },
        limit: 1,
        depth: 0,
        select: { id: true, shippingConfig: true },
        overrideAccess: true,
    })

    const site = siteResult.docs[0]
    if (!site) redirect('/dashboard')

    return (
        <ShippingSettingsClient
            siteId={String(site.id)}
            initial={(site as any).shippingConfig ?? null}
        />
    )
}
