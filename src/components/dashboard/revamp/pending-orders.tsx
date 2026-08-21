'use client'

import Link from 'next/link'
import { CircleAlert, PackageOpen } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { PendingOrdersLoadState } from '@/lib/dashboard/dashboard-types'
import { SectionHead } from './atoms'

function PendingOrdersUnavailable({
    title,
    description,
}: {
    title: string
    description: string
}) {
    return (
        <div className="card po-state po-unavailable" role="status">
            <span className="po-state-icon"><CircleAlert aria-hidden /></span>
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    )
}

export function PendingOrders({ data }: { data: PendingOrdersLoadState }) {
    const { locale, t, tp } = useI18n()
    const ordersT = t.dashboard.revamp.orders

    const right = data.state === 'ready'
        ? <span className="po-count">{tp(ordersT.count, data.totalCount)}</span>
        : undefined

    return (
        <section className="section">
            <SectionHead
                icon="package-check"
                title={ordersT.title}
                sub={ordersT.subtitle}
                right={right}
            />

            {data.state === 'unavailable' ? (
                <PendingOrdersUnavailable
                    title={ordersT.unavailableTitle}
                    description={ordersT.unavailableDesc}
                />
            ) : data.orders.length === 0 ? (
                <div className="card">
                    <div className="empty-block" role="status">
                        <span className="eb-ic"><PackageOpen aria-hidden /></span>
                        <h5>{ordersT.emptyTitle}</h5>
                        <p>{ordersT.emptyDesc}</p>
                    </div>
                </div>
            ) : (
                <div className="card po-card">
                    <div className="po-list">
                        {data.orders.slice(0, 5).map(order => {
                            const itemCount = tp(ordersT.items, order.itemCount)
                            const total = new Intl.NumberFormat(
                                locale === 'ms' ? 'ms-MY' : 'en-MY',
                                {
                                    style: 'currency',
                                    currency: order.currency,
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                }
                            ).format(order.total)

                            return (
                                <Link
                                    className="po-row"
                                    href={`/orders/${encodeURIComponent(String(order.id))}`}
                                    key={order.id}
                                    aria-label={`${order.orderNumber}, ${itemCount}, ${total}, ${ordersT.awaiting}`}
                                >
                                    <span className="po-number">{order.orderNumber}</span>
                                    <span className="po-items">{itemCount}</span>
                                    <span className="po-total">{total}</span>
                                    <span className="po-status">{ordersT.awaiting}</span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}
        </section>
    )
}
