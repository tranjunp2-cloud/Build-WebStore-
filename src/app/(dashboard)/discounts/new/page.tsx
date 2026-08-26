export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth'
import { extractTenantId } from '@/lib/auth'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { DiscountForm } from '../_components/discount-form'

export const metadata: Metadata = { title: 'New Discount | Web Store' }

export default async function NewDiscountPage() {
    const user = await getCurrentUser()
    if (!user) redirect('/login')

    const tenantId = extractTenantId(user)
    let tenantName: string | undefined

    if (tenantId) {
        try {
            const payload = await getPayload({ config: configPromise })
            const tenant = await payload.findByID({
                collection: 'tenants',
                id: tenantId,
                depth: 0,
                user,
                overrideAccess: false,
            })
            tenantName = (tenant as { name?: string })?.name
        } catch {
            // tenant fetch failure is non-fatal — rail degrades gracefully
        }
    }

    return (
        <Suspense>
            <DiscountForm tenantName={tenantName} />
        </Suspense>
    )
}
