"use client"

import React from 'react'
import { Ban } from 'lucide-react'
import { isCodBlocked } from '@/lib/shipping/cod-block'
import { useI18n } from '@/i18n'
import './side.css'

// Re-use SVG icons from OrderDetailPanel (local copies to avoid cross-component coupling)
const IconUser = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="5.33" r="3.33" stroke="hsl(var(--info))" strokeWidth="1.33" />
        <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="hsl(var(--info))" strokeWidth="1.33" strokeLinecap="round" />
    </svg>
)

const IconPhone = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.33 10.42c-.97-.97-2.14-1.42-2.83-.74l-.83.83c-.27.27-.87.07-1.48-.4-.76-.6-1.49-1.33-2.09-2.09-.47-.61-.67-1.21-.4-1.48l.83-.83c.68-.69.23-1.86-.74-2.83-.97-.97-2.14-1.42-2.83-.74L2.13 3.77c-.68.69-.34 2.25.55 3.87.75 1.36 1.9 2.7 3.33 3.9 1.42 1.19 2.88 2.03 4.14 2.47.9.31 1.72.32 2.19-.14l.85-.85c.68-.69.23-1.86-.74-2.83z" stroke="hsl(var(--info))" strokeWidth="1.33" />
    </svg>
)

const IconEmail = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.33" y="3.33" width="13.33" height="9.33" rx="1.33" stroke="hsl(var(--info))" strokeWidth="1.33" />
        <path d="M1.33 4.67l6.67 5 6.67-5" stroke="hsl(var(--info))" strokeWidth="1.33" />
    </svg>
)

const IconLocation = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 1.33c-2.57 0-4.67 2.1-4.67 4.67 0 3.5 4.67 8.67 4.67 8.67s4.67-5.17 4.67-8.67c0-2.57-2.1-4.67-4.67-4.67z" stroke="hsl(var(--info))" strokeWidth="1.33" />
        <circle cx="8" cy="6" r="1.67" stroke="hsl(var(--info))" strokeWidth="1.33" />
    </svg>
)

const IconStickyNote = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.67 1.33H3.33C2.6 1.33 2 1.93 2 2.67v10.66C2 14.07 2.6 14.67 3.33 14.67H9.33L14 9.33V2.67C14 1.93 13.4 1.33 12.67 1.33z" stroke="hsl(var(--warning))" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.33 14.67V9.33H14" stroke="hsl(var(--warning))" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

function InfoRow({
    icon,
    label,
    value,
    tone,
}: {
    icon: React.ReactNode
    label: string
    value: string
    tone?: 'amber' | 'teal'
}) {
    return (
        <div className="od-info">
            <span className={`od-info-ic ${tone ?? ''}`}>{icon}</span>
            <div className="od-info-tx">
                <div className="od-info-l">{label}</div>
                <div className="od-info-v">{value}</div>
            </div>
        </div>
    )
}

export interface CustomerCardOrder {
    customerName: string
    customerEmail: string
    customerPhone?: string | null
    shippingAddress?: {
        line1?: string
        line2?: string
        city?: string
        state?: string
        postcode?: string
        country?: string
    } | null
    codAmount?: number | null
    notes?: string | null
}

export function CustomerCard({ order }: { order: CustomerCardOrder }) {
    const { t } = useI18n()
    const d = t.dashboard.orders.detail
    const addr = order.shippingAddress
        ? [
              order.shippingAddress.line1,
              order.shippingAddress.line2,
              order.shippingAddress.city,
              order.shippingAddress.state,
              order.shippingAddress.postcode,
              order.shippingAddress.country,
          ]
              .filter(Boolean)
              .join(', ')
        : d.noAddress

    const codBlocked = isCodBlocked({
        codAmount: order.codAmount,
        shippingAddress: order.shippingAddress ?? null,
    })

    return (
        <section className="od-card">
            <div className="od-cap">{d.customerInfoTitle}</div>
            <InfoRow icon={<IconUser />} label={d.name} value={order.customerName} />
            <InfoRow icon={<IconPhone />} label={d.phone} value={order.customerPhone || 'N/A'} />
            <InfoRow icon={<IconEmail />} label={d.email} value={order.customerEmail} />
            <InfoRow icon={<IconLocation />} label={d.address} value={addr} tone="teal" />
            {codBlocked && (
                <div className="od-region">
                    <span className="region-badge blocked">
                        <Ban style={{ width: 11, height: 11, flexShrink: 0 }} />
                        {d.codBlocked}
                    </span>
                </div>
            )}
            {order.notes ? (
                <InfoRow
                    icon={<IconStickyNote />}
                    label={d.notes}
                    value={order.notes}
                    tone="amber"
                />
            ) : null}
        </section>
    )
}
