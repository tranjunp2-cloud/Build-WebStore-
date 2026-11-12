export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DiscountsUsageHistoryLayout } from '../_components/discounts-usage-history-layout'

export const metadata: Metadata = { title: 'Discount Usage History' }

export default function DiscountUsageHistoryPage() {
    return (
        <div className="flex flex-col gap-[22px] w-full">
            <Suspense>
                <DiscountsUsageHistoryLayout />
            </Suspense>
        </div>
    )
}
