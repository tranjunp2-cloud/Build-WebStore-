export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { DiscountForm, type DiscountDoc } from '../_components/discount-form'

export const metadata: Metadata = { title: 'Edit Discount | PrimeWeb' }

export default async function EditDiscountPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const user = await getCurrentUser()
    if (!user) redirect('/login')

    const payload = await getPayload({ config: configPromise })

    let discount: any
    try {
        discount = await payload.findByID({
            collection: 'discounts',
            id,
            depth: 1,
            user,
            overrideAccess: false,
        })
    } catch {
        redirect('/discounts')
    }

    if (!discount) redirect('/discounts')

    const tenantName = typeof discount.tenant === 'object' && discount.tenant !== null
        ? (discount.tenant as { name?: string }).name
        : undefined

    const doc: DiscountDoc = {
        id: String(discount.id),
        code: discount.code,
        description: discount.description ?? null,
        type: discount.type,
        value: discount.value,
        status: discount.status,
        usageCount: discount.usageCount ?? 0,
        usageLimit: discount.usageLimit ?? null,
        startsAt: discount.startsAt ?? null,
        expiresAt: discount.expiresAt ?? null,
        createdAt: discount.createdAt,
    }

    return (
        <Suspense>
            <DiscountForm discount={doc} tenantName={tenantName} />
        </Suspense>
    )
}
