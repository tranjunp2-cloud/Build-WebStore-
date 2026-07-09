import { redirect } from 'next/navigation'
import { Suspense } from 'react'
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
    const [siteResult, tenant] = await Promise.all([
        payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            limit: 1,
            depth: 0,
            select: { id: true, shippingConfig: true },
            overrideAccess: true,
        }),
        payload.findByID({
            collection: 'tenants',
            id: tenantId,
            depth: 0,
            overrideAccess: true,
            // SECURITY: overrideAccess bypasses the field-level read:()=>false on the
            // token subfields, and every prop passed to a client component is serialized
            // into the page payload — so whitelist ONLY non-secret subfields here. NEVER
            // add accessToken/refreshToken/tokenExpiresAt/tokenRefreshExpiresAt.
            select: {
                easyParcelIntegration: {
                    enabled: true,
                    warehouse: true,
                    warehouses: true,
                    testedAt: true,
                    accountName: true,
                    accountEmail: true,
                },
            } as any,
        }).catch(() => null),
    ])

    const site = siteResult.docs[0]
    if (!site) redirect('/dashboard')

    return (
        <Suspense fallback={null}>
            <ShippingSettingsClient
                siteId={String(site.id)}
                tenantId={String(tenantId)}
                initial={(site as any).shippingConfig ?? null}
                epConfig={(tenant as any)?.easyParcelIntegration ?? null}
            />
        </Suspense>
    )
}
