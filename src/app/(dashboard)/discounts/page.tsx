import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DiscountsClientLayout } from './_components/discounts-client-layout'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Discounts',
}

export default function DiscountsPage() {
    return (
        <div className="flex flex-col gap-[22px] w-full">
            <Suspense>
                <DiscountsClientLayout />
            </Suspense>
        </div>
    )
}
