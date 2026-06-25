"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { Loader2, ZoomIn, X } from 'lucide-react'
import Image from 'next/image'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { CancelOrderModal } from './CancelOrderModal'
import { ShipOrderModal } from './ShipOrderModal'
import { ManualPaymentVerificationBlock } from './ManualPaymentVerificationBlock'
import { xenditChannelLabel } from '@/lib/email/templates/shared/email-utils'
import { type OrderStatus } from '@/lib/orders/status-groups'

// ───────── ORDER DETAIL PANEL — Node 31155:10172 ─────────
//
// ─── TYPES & MOCKS ───
export type { OrderStatus }

export interface OrderDetail {
    id: string | number
    orderNumber: string
    status: OrderStatus
    paymentStatus: string
    paymentMethod: string
    xenditChannelCode?: string | null
    paymentProofImage?: string | { url?: string } | null
    paymentReference?: string
    paymentRejectionReason?: string
    paymentVerifiedAt?: string
    paymentVerifiedBy?: string | { id: string; email?: string } | null
    subtotal: number
    shippingFee: number
    tax: number
    total: number
    discountCode?: string | null
    discountAmount?: number | null
    currency: string
    customerName: string
    customerEmail: string
    customerPhone?: string
    shippingAddress?: {
        line1?: string
        line2?: string
        city?: string
        state?: string
        postcode?: string
        country?: string
    }
    items: {
        product?: string | number
        productName: string
        variant?: string
        quantity: number
        unitPrice: number
    }[]
}

// ─── SECTION CARD wrapper ───
function SectionCard({
    children,
    className,
    style,
}: {
    children: React.ReactNode
    className?: string
    style?: React.CSSProperties
}) {
    return (
        <div
            className={className}
            style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--dash-secondary-bg)',
                border: '1px solid var(--dash-border)',
                borderRadius: 16,
                ...style,
            }}
        >
            {children}
        </div>
    )
}

// ─── SECTION HEADER label ───
// style_LM3RHD: Inter 600 12px UPPERCASE 2.5% letterSpacing, rgba(248,250,252,0.6)
function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <span
            style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 12,
                lineHeight: '1.3333333333333333em',
                letterSpacing: '0.025em',
                textTransform: 'uppercase',
                color: 'var(--dash-text-muted)',
            }}
        >
            {children}
        </span>
    )
}

// ─── INFO ROW — icon + label + value ───
// layout_6BE2MR: row, alignItems center, alignSelf stretch, gap 12px
// Icon wrapper (layout_Y85W03): 32×32, padding 0 8px, bg fill_RKVNRG rgba(59,130,246,0.1), borderRadius 12px
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center" style={{ gap: 12 }}>
            {/* Icon container */}
            <div
                className="flex items-center justify-center shrink-0"
                style={{
                    width: 32,
                    height: 32,
                    padding: '0 8px',
                    background: 'hsl(var(--info)/0.1)',
                    borderRadius: 12,
                }}
            >
                {icon}
            </div>
            {/* Label + Value column */}
            <div className="flex flex-col min-w-0">
                {/* Label — style_231QNQ: Inter 400 12px, rgba(248,250,252,0.4) */}
                <span
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: 12,
                        lineHeight: '1.3333333333333333em',
                        color: 'var(--dash-text-muted)',
                    }}
                >
                    {label}
                </span>
                {/* Value — style_SMWX6A: Inter 400 14px, #F8FAFC */}
                <span
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: 14,
                        lineHeight: '1.4285714285714286em',
                        color: 'var(--dash-text)',
                    }}
                >
                    {value}
                </span>
            </div>
        </div>
    )
}

// ─── SVG ICONS ───
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

const IconCreditCard = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.33" y="3.33" width="13.33" height="9.33" rx="1.33" stroke="hsl(var(--info))" strokeWidth="1.33" />
        <path d="M1.33 6.67h13.33" stroke="hsl(var(--info))" strokeWidth="1.33" />
    </svg>
)

const IconUnconfirmed = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="6.666" stroke="hsl(var(--warning))" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.333 8L7.333 10L11.333 5.333" stroke="hsl(var(--warning))" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

const IconRefund = () => (
    <svg className="size-4 shrink-0" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 8C2 9.18669 2.35189 10.3467 3.01118 11.3334C3.67047 12.3201 4.60754 13.0892 5.7039 13.5433C6.80026 13.9974 8.00666 14.1162 9.17054 13.8847C10.3344 13.6532 11.4035 13.0818 12.2426 12.2426C13.0818 11.4035 13.6532 10.3344 13.8847 9.17054C14.1162 8.00666 13.9974 6.80026 13.5433 5.7039C13.0892 4.60754 12.3201 3.67047 11.3334 3.01118C10.3467 2.35189 9.18669 2 8 2C6.32263 2.00631 4.71265 2.66082 3.50667 3.82667L2 5.33333" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 2V5.33333H5.33333" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
)

// ─── ORDER PROGRESS STEPPER — Node 31155:10180 ───
// layout_DRCL44: column, alignItems stretch, gap 16px, padding 21px 21px 1px, height 130.5
// fill_JJ2WLZ: rgba(30,41,59,0.6), stroke_B1W3GE: 1px rgba(255,255,255,0.08), borderRadius 16px
//
// Inner stepper (layout_LRIATA): mode none, fill horizontal, height 56.5px
// Lines (absolute, y:27.25, height:2, width:37.22):
//   Line 1 (active):   x:43.64,  fill_979BFC: #10B981
//   Line 2,3,4 (inactive): x:138.39, x:220.83, x:304.94, fill_JME6ZO: rgba(255,255,255,0.1)
//
// Step nodes (absolute):
//   Pending:   x:0,      width:39.64  — layout_W0KU2T column center gap:8
//   Confirmed: x:84.86,  width:49.53  — layout_X5SG4Y column center gap:8
//   Ready:     x:179.61, width:37.22  — layout_BV4OM4 column center gap:8
//   Shipped:   x:262.05, width:38.89  — layout_L2D583 column center gap:8
//   Completed: x:346.16, width:51.84  — layout_H6ITKN column center gap:8
// Total canvas width: 346.16 + 51.84 = 398px
//
// Icon container (layout_B1E68C): row center, padding 0 10px, fill height
//   SVG icon: 16×16 circle, borderRadius 33554400px (full circle)
//   Active: fill_979BFC #10B981 | Inactive: fill_JME6ZO rgba(255,255,255,0.1)
//
// Label text:
//   Active (Pending):  style_N6FR8S Inter 600 10px CENTER, fill_KU03NT #F8FAFC
//   Inactive:          style_VL7F6N Inter 400 10px CENTER, fill_3G5XDF rgba(248,250,252,0.6)

function getProgressSteps(labels: Record<string, string>) {
    return [
        { label: labels.pending, x: 0, width: 39.64, StepIcon: StepPendingIcon },
        { label: labels.confirmed, x: 84.86, width: 49.53, StepIcon: StepConfirmedIcon },
        { label: labels.ready, x: 179.61, width: 37.22, StepIcon: StepReadyIcon },
        { label: labels.shipped, x: 262.05, width: 38.89, StepIcon: StepShippedIcon },
        { label: labels.completed, x: 346.16, width: 51.84, StepIcon: StepCompletedIcon },
    ]
}

// Lines between steps (absolute position within the 398px canvas)
const PROGRESS_LINES = [
    { x: 43.64, active: true },   // between Pending → Confirmed (active by default)
    { x: 138.39, active: false },   // between Confirmed → Ready
    { x: 220.83, active: false },   // between Ready → Shipped
    { x: 304.94, active: false },   // between Shipped → Completed
]

function StepPendingIcon({ isActive }: { isActive: boolean }) {
    const iStroke = isActive ? "white" : undefined
    const iClass = isActive ? undefined : "stroke-slate-500 dark:stroke-white"
    return (
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 md:w-9 md:h-9">
            <path d="M0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18Z" className={isActive ? "fill-[hsl(var(--primary))]" : "fill-[hsl(var(--muted))]"} />
            <path d="M18.0002 24.6673C21.6821 24.6673 24.6668 21.6825 24.6668 18.0007C24.6668 14.3188 21.6821 11.334 18.0002 11.334C14.3183 11.334 11.3335 14.3188 11.3335 18.0007C11.3335 21.6825 14.3183 24.6673 18.0002 24.6673Z" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18 14V18L20.6667 19.3333" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function StepConfirmedIcon({ isActive }: { isActive: boolean }) {
    const iStroke = isActive ? "white" : undefined
    const iClass = isActive ? undefined : "stroke-slate-500 dark:stroke-white"
    return (
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 md:w-9 md:h-9">
            <path d="M0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18Z" className={isActive ? "fill-[hsl(var(--primary))]" : "fill-[hsl(var(--muted))]"} />
            <path d="M24.5341 16.6676C24.8385 18.1618 24.6215 19.7153 23.9193 21.0688C23.2171 22.4224 22.072 23.4943 20.6751 24.1058C19.2782 24.7174 17.7138 24.8315 16.2429 24.4292C14.772 24.0269 13.4835 23.1326 12.5923 21.8953C11.701 20.6579 11.2608 19.1525 11.3452 17.6299C11.4295 16.1073 12.0333 14.6597 13.0558 13.5284C14.0783 12.3971 15.4578 11.6506 16.9641 11.4133C18.4704 11.176 20.0126 11.4622 21.3334 12.2243" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 17.3327L18 19.3327L24.6667 12.666" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function StepReadyIcon({ isActive }: { isActive: boolean }) {
    const iStroke = isActive ? "white" : undefined
    const iClass = isActive ? undefined : "stroke-slate-500 dark:stroke-white"
    return (
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 md:w-9 md:h-9">
            <path d="M0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18Z" className={isActive ? "fill-[hsl(var(--primary))]" : "fill-[hsl(var(--muted))]"} />
            <path d="M17.3333 24.486C17.536 24.603 17.766 24.6646 18 24.6646C18.234 24.6646 18.464 24.603 18.6667 24.486L23.3333 21.8193C23.5358 21.7024 23.704 21.5343 23.821 21.3318C23.938 21.1294 23.9998 20.8998 24 20.666V15.3326C23.9998 15.0988 23.938 14.8692 23.821 14.6667C23.704 14.4643 23.5358 14.2962 23.3333 14.1793L18.6667 11.5126C18.464 11.3956 18.234 11.334 18 11.334C17.766 11.334 17.536 11.3956 17.3333 11.5126L12.6667 14.1793C12.4642 14.2962 12.296 14.4643 12.179 14.6667C12.062 14.8692 12.0002 15.0988 12 15.3326V20.666C12.0002 20.8998 12.062 21.1294 12.179 21.3318C12.296 21.5343 12.4642 21.7024 12.6667 21.8193L17.3333 24.486Z" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18 24.6667V18" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12.1934 14.666L18 17.9993L23.8067 14.666" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 12.8457L21 16.279" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function StepShippedIcon({ isActive }: { isActive: boolean }) {
    const iStroke = isActive ? "white" : undefined
    const iClass = isActive ? undefined : "stroke-slate-500 dark:stroke-white"
    return (
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 md:w-9 md:h-9">
            <path d="M0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18Z" className={isActive ? "fill-[hsl(var(--primary))]" : "fill-[hsl(var(--muted))]"} />
            <path d="M19.3333 21.9993V13.9993C19.3333 13.6457 19.1928 13.3066 18.9427 13.0565C18.6927 12.8065 18.3535 12.666 17.9999 12.666H12.6666C12.313 12.666 11.9738 12.8065 11.7238 13.0565C11.4737 13.3066 11.3333 13.6457 11.3333 13.9993V21.3327C11.3333 21.5095 11.4035 21.6791 11.5285 21.8041C11.6535 21.9291 11.8231 21.9993 11.9999 21.9993H13.3333" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 22H16" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22.6666 22.0007H23.9999C24.1767 22.0007 24.3463 21.9304 24.4713 21.8054C24.5963 21.6804 24.6666 21.5108 24.6666 21.334V18.9007C24.6663 18.7494 24.6146 18.6027 24.5199 18.4847L22.1999 15.5847C22.1376 15.5066 22.0585 15.4435 21.9685 15.4001C21.8784 15.3567 21.7798 15.3341 21.6799 15.334H19.3333" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21.3333 23.3327C22.0697 23.3327 22.6667 22.7357 22.6667 21.9993C22.6667 21.263 22.0697 20.666 21.3333 20.666C20.597 20.666 20 21.263 20 21.9993C20 22.7357 20.597 23.3327 21.3333 23.3327Z" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14.6666 23.3327C15.403 23.3327 15.9999 22.7357 15.9999 21.9993C15.9999 21.263 15.403 20.666 14.6666 20.666C13.9302 20.666 13.3333 21.263 13.3333 21.9993C13.3333 22.7357 13.9302 23.3327 14.6666 23.3327Z" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function StepCompletedIcon({ isActive }: { isActive: boolean }) {
    const iStroke = isActive ? "white" : undefined
    const iClass = isActive ? undefined : "stroke-slate-500 dark:stroke-white"
    return (
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 md:w-9 md:h-9">
            <path d="M0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18Z" className={isActive ? "fill-[hsl(var(--primary))]" : "fill-[hsl(var(--muted))]"} />
            <path d="M24.5341 16.6676C24.8385 18.1618 24.6215 19.7153 23.9193 21.0688C23.2171 22.4224 22.072 23.4943 20.6751 24.1058C19.2782 24.7174 17.7138 24.8315 16.2429 24.4292C14.772 24.0269 13.4835 23.1326 12.5923 21.8953C11.701 20.6579 11.2608 19.1525 11.3452 17.6299C11.4295 16.1073 12.0333 14.6597 13.0558 13.5284C14.0783 12.3971 15.4578 11.6506 16.9641 11.4133C18.4704 11.176 20.0126 11.4622 21.3334 12.2243" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 17.3327L18 19.3327L24.6667 12.666" stroke={iStroke} className={iClass} strokeWidth={1.33333} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function OrderProgress({ status }: { status: OrderStatus }) {
    const { t } = useI18n()
    const d = t.dashboard.orders.detail
    const progressLabels = t.dashboard.orders.progress
    const STEPS = getProgressSteps(progressLabels)
    const STATUS_TO_STEP: Record<OrderStatus, number> = {
        pending: 0,
        new: 0,    // Stripe paid, awaiting merchant confirmation — same step as pending
        confirmed: 1,
        ready_to_ship: 2,
        shipped: 3,
        completed: 4,
        cancelled: -1,
        refunded: -1,
        paid: 1,
        payment_failed: -1,
        processing: 1
    }
    const currentStep = STATUS_TO_STEP[status] ?? 0

    return (
        <div
            className="flex flex-col items-start shrink-0 self-stretch rounded-[16px] border border-dash-border bg-dash-surface h-[118px] md:h-[130.5px] p-[17px] pb-[1px] md:p-[21px] md:pb-[1px] gap-[12px] md:gap-[16px]"
        >
            {/* Section label */}
            <span className="font-inter font-semibold text-[12px] uppercase tracking-[0.025em] text-dash-text-muted leading-[1.333em]">
                {d.orderProgress}
            </span>

            {/* Stepper canvas */}
            <div className="flex w-full items-start md:justify-between overflow-x-auto overflow-y-hidden pb-3 md:pb-0 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                {STEPS.map((step, i) => {
                    const isActive = i <= currentStep

                    return (
                        <React.Fragment key={step.label}>
                            {/* Step node */}
                            <div className="flex flex-col items-center z-10 gap-[8px] shrink-0">
                                {/* Icon container */}
                                <div className={`flex items-center justify-center shrink-0 rounded-full ${isActive ? 'shadow-[0_0_0_4px_hsl(var(--primary)/0.2)] md:shadow-none' : ''}`}>
                                    <step.StepIcon isActive={isActive} />
                                </div>

                                {/* Step label text */}
                                <span
                                    className={`font-inter text-center whitespace-nowrap ${isActive ? 'font-normal md:font-semibold text-dash-text-muted md:text-dash-text' : 'font-normal text-dash-text-muted'} text-[12px] md:text-[10px] leading-[1.25em]`}
                                >
                                    {step.label}
                                </span>
                            </div>

                            {/* Connector Line */}
                            {i < STEPS.length - 1 && (
                                <div
                                    className="flex-1 shrink-0 md:shrink mx-[8px] md:mx-1 min-w-[46px] md:min-w-0"
                                    style={{
                                        marginTop: 15, // Icon is 32x32 on mobile -> center is at 16, line is 2px high -> 15px.
                                        height: 2,
                                        background: i <= currentStep ? 'hsl(var(--success))' : 'var(--dash-border)',
                                    }}
                                />
                            )}
                        </React.Fragment>
                    )
                })}
            </div>
        </div>
    )
}

// ─── CUSTOMER INFORMATION ───
// layout_MW5IYR: column, gap 12px, padding 17px 17px 1px
// layout_0B2MTA: column, gap 12px
function CustomerInformation({ order }: { order: OrderDetail }) {
    const { t } = useI18n()
    const d = t.dashboard.orders.detail

    const addr = order.shippingAddress
        ? [order.shippingAddress.line1, order.shippingAddress.line2, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.postcode, order.shippingAddress.country].filter(Boolean).join(', ')
        : 'No address provided'

    return (
        // layout_RI94WM: height 242, padding 17px 17px 1px, gap 12px
        <div
            style={{
                display: 'flex',
                padding: 17,
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 12,
                alignSelf: 'stretch',
                borderRadius: 16,
                border: '1px solid var(--dash-border)',
                background: 'var(--dash-secondary-bg)',
            }}
        >
            <span
                style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: 12,
                    lineHeight: '1.3333333333333333em',
                    letterSpacing: '2.500000099341075%',
                    textTransform: 'uppercase',
                    color: 'var(--dash-text-muted)',
                }}
            >
                {d.customerInfo}
            </span>

            {/* Container for Info Rows — layout_O49664: column, gap 12px, height 180 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InfoRow icon={<IconUser />} label={d.name} value={order.customerName} />
                <InfoRow icon={<IconPhone />} label={d.phone} value={order.customerPhone || 'N/A'} />
                <InfoRow icon={<IconEmail />} label={d.email} value={order.customerEmail} />
                <InfoRow icon={<IconLocation />} label={d.address} value={addr} />
            </div>
        </div>
    )
}

function fmtPaymentMethod(m: string | null | undefined, labels: Record<string, string>, xenditChannelCode?: string | null) {
    if (m === 'ewallet') return xenditChannelLabel(xenditChannelCode)
    return labels[m ?? ''] ?? m ?? '—'
}

function fmtPaymentStatus(s: string | null | undefined, labels: Record<string, string>) {
    return labels[s ?? ''] ?? s ?? '—'
}

// ─── PAYMENT INFORMATION ───
// layout_ODZ12A: column, gap 12px, padding 17px 17px 1px, height 318
// Method row — icon fill_RKVNRG rgba(59,130,246,0.1)
// Status row — icon fill_A2P9AX rgba(255,105,0,0.1), text Unconfirmed style_88PH6H fill_IGVEST #FF8904
// Receipt image — layout_NCMUFS: column, padding 1px, height 160, borderRadius 16px
//   Image: layout_BNH1S2 fill horizontal, height 158
function PaymentInformation({ order }: { order: OrderDetail }) {
    const { t } = useI18n()
    const d = t.dashboard.orders.detail
    const methodLabels = (d as any).paymentMethods as Record<string, string>
    const statusLabels = (d as any).paymentStatuses as Record<string, string>
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [proofHovered, setProofHovered] = useState(false)

    useEffect(() => {
        if (!lightboxOpen) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxOpen(false) }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [lightboxOpen])

    const proofUrl = order.paymentProofImage
        ? (typeof order.paymentProofImage === 'string' ? order.paymentProofImage : order.paymentProofImage?.url || '')
        : null

    let statusColor = 'hsl(var(--warning))'
    let statusBg = 'hsl(var(--warning)/0.1)'
    let StatusIcon = IconUnconfirmed

    if (order.status === 'ready_to_ship' || order.status === 'shipped' || order.status === 'completed' || order.paymentStatus?.toLowerCase() === 'paid') {
        statusColor = 'hsl(var(--success))'
        statusBg = 'hsl(var(--success)/0.1)'
        StatusIcon = function SuccessIcon() {
            return (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="8" cy="8" r="6.666" stroke="hsl(var(--success))" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5.333 8L7.333 10L11.333 5.333" stroke="hsl(var(--success))" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )
        }
    } else if (order.status === 'cancelled' || order.status === 'refunded') {
        statusColor = 'hsl(var(--destructive))'
        statusBg = 'hsl(var(--destructive)/0.1)'
        StatusIcon = function CancelledIcon() {
            return (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="8" cy="8" r="6.666" stroke="var(--dash-error)" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 6L10 10M10 6L6 10" stroke="var(--dash-error)" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )
        }
    }

    return (
        // layout_ARJONX: height 318, padding 17px 17px 1px 17px, gap 12px
        <div
            style={{
                display: 'flex',
                padding: 17,
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 12,
                alignSelf: 'stretch',
                borderRadius: 16,
                border: '1px solid var(--dash-border)',
                background: 'var(--dash-secondary-bg)',
            }}
        >
            <span
                style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: 12,
                    lineHeight: '1.3333333333333333em',
                    letterSpacing: '0.025em',
                    textTransform: 'uppercase',
                    color: 'var(--dash-text-muted)',
                }}
            >
                {d.paymentInfo}
            </span>

            {/* Content wrapper: height 256, gap 12px */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
                {/* Method row */}
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {/* Icon */}
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 32, height: 32, padding: '0px 8px', background: 'hsl(var(--info)/0.1)', borderRadius: 12, flexShrink: 0 }}>
                        <IconCreditCard />
                    </div>
                    {/* Text container */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--dash-text-muted)' }}>
                            {d.method}
                        </span>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, lineHeight: '20px', color: 'var(--dash-text)' }}>
                            {fmtPaymentMethod(order.paymentMethod, methodLabels, order.xenditChannelCode)}
                        </span>
                    </div>
                </div>

                {/* Status row */}
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {/* Icon */}
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 32, height: 32, padding: '0px 8px', background: statusBg, borderRadius: 12, flexShrink: 0 }}>
                        <StatusIcon />
                    </div>
                    {/* Text container */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--dash-text-muted)' }}>
                            {d.paymentStatus}
                        </span>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, lineHeight: '20px', color: statusColor }}>
                            {fmtPaymentStatus(order.paymentStatus, statusLabels)}
                        </span>
                    </div>
                </div>

                {/* Payment Receipt Image: explicitly height 160 */}
                <div
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, width: '100%', border: '1px solid var(--dash-border)', borderRadius: 16, padding: 1, flexShrink: 0, overflow: 'hidden', position: 'relative', cursor: proofUrl ? 'pointer' : 'default' }}
                    onClick={() => { if (proofUrl) { setProofHovered(false); setLightboxOpen(true) } }}
                    onMouseEnter={() => setProofHovered(true)}
                    onMouseLeave={() => setProofHovered(false)}
                >
                    {proofUrl ? (
                        <>
                            <Image src={proofUrl} alt="Payment Receipt" fill className="object-cover" />
                            <div style={{ position: 'absolute', inset: 0, background: proofHovered ? 'rgba(0,0,0,0.35)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
                                <ZoomIn size={24} color="#fff" style={{ opacity: proofHovered ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: 'none' }} />
                            </div>
                        </>
                    ) : (
                        <div className="w-full flex items-center justify-center h-full text-center p-4" style={{ background: 'var(--dash-surface-hover)', borderRadius: 15 }}>
                            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 12, color: 'var(--dash-text-muted)' }}>
                                No Payment Receipt Provided
                            </span>
                        </div>
                    )}
                </div>
                {lightboxOpen && proofUrl && createPortal(
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Payment proof full view"
                        onClick={() => setLightboxOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <button
                            aria-label="Close"
                            onClick={() => setLightboxOpen(false)}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <X size={20} />
                        </button>
                        <img
                            src={proofUrl}
                            alt="Payment proof full view"
                            onClick={e => e.stopPropagation()}
                            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }}
                        />
                    </div>,
                    document.body
                )}
            </div>
        </div>
    )
}

// ─── ORDER ITEMS ───
// layout_USQL7O: column, gap 12px, padding 17px 17px 1px, height 146
// layout_QLWN63: column, gap 12px
// Item row: layout_LWI4PM: row, space-between, gap 260.125px
//   Left: layout_F9PMLN column — product name style_VWFEC1 Inter 500 14px, variant style_231QNQ rgba(248,250,252,0.5)
//   Right: layout_MOABVK — price style_88PH6H Inter 600 14px #F8FAFC
function OrderItems({ order }: { order: OrderDetail }) {
    const { t } = useI18n()
    const d = t.dashboard.orders.detail
    if (!order.items || order.items.length === 0) return null

    return (
        <SectionCard>
            <div style={{ padding: '17px 17px 1px', gap: 12, display: 'flex', flexDirection: 'column' }}>
                <SectionLabel>{d.orderItems}</SectionLabel>

                {/* Items Container */}
                <div style={{ gap: 12, display: 'flex', flexDirection: 'column', marginBottom: 16 }}>
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                            {/* Left: product info */}
                            <div className="flex flex-col">
                                <span
                                    style={{
                                        fontFamily: 'Inter, sans-serif',
                                        fontWeight: 500,
                                        fontSize: 14,
                                        lineHeight: '20px',
                                        color: 'var(--dash-text)',
                                    }}
                                >
                                    {item.productName}
                                </span>
                                <span
                                    style={{
                                        fontFamily: 'Inter, sans-serif',
                                        fontWeight: 400,
                                        fontSize: 12,
                                        lineHeight: '16px',
                                        color: 'var(--dash-text-muted)',
                                    }}
                                >
                                    {item.variant ? `${item.variant} × ${item.quantity}` : `${d.qty}: ${item.quantity}`}
                                </span>
                            </div>
                            {/* Right: price */}
                            <span
                                style={{
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: 600,
                                    fontSize: 14,
                                    lineHeight: '20px',
                                    color: 'var(--dash-text)',
                                }}
                            >
                                {order.currency} {(item.unitPrice * item.quantity).toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </SectionCard>
    )
}

// ─── ORDER SUMMARY ───
// layout_P1J2DV: column, gap 12px, padding 17px 17px 1px, height 191
// layout_F7BEO8: mode none, h 129
// Row pattern: row, space-between, alignItems center
//   label  – style_SMWX6A Inter 400 14px, fill_I8FWOL
//   amount – style_SMWX6A Inter 400 14px, fill_VDT3MR #F8FAFC
// Grand Total separator:
//   layout_VS3Y5N: column, padding 13px 0 0, borderTop 1px rgba(255,255,255,0.08)
//   label  – style_DZKK65 Inter 700 16px #F8FAFC
//   amount – style_QOAWPZ Inter 700 20px fill_31NCV3 #2DD4BF
function OrderSummary({ order }: { order: OrderDetail }) {
    const { t } = useI18n()
    const d = t.dashboard.orders.detail
    return (
        <SectionCard>
            <div style={{ padding: '17px 17px 17px', gap: 12, display: 'flex', flexDirection: 'column' }}>
                <SectionLabel>{d.orderSummary}</SectionLabel>
                {/* Container: auto height */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Inner items with gap: 8 */}
                    <div style={{ gap: 8, display: 'flex', flexDirection: 'column' }}>
                        {/* Subtotal */}
                        <div className="flex items-center justify-between">
                            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, lineHeight: '20px', color: 'var(--dash-text-muted)' }}>
                                {d.subtotal}
                            </span>
                            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, lineHeight: '20px', color: 'var(--dash-text)' }}>
                                {order.currency} {order.subtotal?.toFixed(2) || '0.00'}
                            </span>
                        </div>
                        {/* Discount — snapshot in sen → /100 for RM (F33) */}
                        {(order.discountAmount ?? 0) > 0 && (
                            <div className="flex items-center justify-between">
                                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, lineHeight: '20px', color: 'var(--dash-text-muted)' }}>
                                    Discount{order.discountCode ? ` (${order.discountCode})` : ''}
                                </span>
                                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, lineHeight: '20px', color: 'hsl(var(--success))' }}>
                                    −{order.currency} {((order.discountAmount ?? 0) / 100).toFixed(2)}
                                </span>
                            </div>
                        )}
                        {/* Shipping Fee */}
                        <div className="flex items-center justify-between">
                            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, lineHeight: '20px', color: 'var(--dash-text-muted)' }}>
                                {d.shippingFee}
                            </span>
                            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, lineHeight: '20px', color: 'var(--dash-text)' }}>
                                {order.currency} {order.shippingFee?.toFixed(2) || '0.00'}
                            </span>
                        </div>
                        {/* SST removed at checkout (F33 phase-06) — show only for historical orders that carried tax */}
                        {(order.tax ?? 0) > 0 && (
                            <div className="flex items-center justify-between">
                                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, lineHeight: '20px', color: 'var(--dash-text-muted)' }}>
                                    {d.tax}
                                </span>
                                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, lineHeight: '20px', color: 'var(--dash-text)' }}>
                                    {order.currency} {order.tax?.toFixed(2) || '0.00'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Grand Total — separated by margin 12, border top, padding 13 */}
                    <div
                        className="flex items-center justify-between"
                        style={{ marginTop: 12, paddingTop: 13, borderTop: '1px solid var(--dash-border)' }}
                    >
                        <span
                            style={{
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 700,
                                fontSize: 16,
                                lineHeight: '24px',
                                color: 'var(--dash-text)',
                            }}
                        >
                            {d.total}
                        </span>
                        <span
                            style={{
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 700,
                                fontSize: 20,
                                lineHeight: '28px',
                                color: 'hsl(var(--primary))',
                            }}
                        >
                            {order.currency} {order.total?.toFixed(2) || '0.00'}
                        </span>
                    </div>
                </div>
            </div>
        </SectionCard>
    )
}

// ─── ACTION BUTTONS ───
// layout_KSMCIE: column, alignSelf stretch, gap 12px, height 110
function ActionButtons({ order, onUpdate }: { order: OrderDetail, onUpdate: () => void }) {
    const { t } = useI18n()
    const a = t.dashboard.orders.actions
    const p = t.dashboard.orders.progress
    const [isLoading, setIsLoading] = useState(false)
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
    const [isShipModalOpen, setIsShipModalOpen] = useState(false)
    const { status, id, orderNumber } = order

    const isTerminalStatus = status === 'completed' || status === 'cancelled' || status === 'refunded'

    const handleAction = async (newStatus: OrderStatus, trackingNumber?: string) => {
        setIsLoading(true)
        try {
            const body: Record<string, string> = { status: newStatus }
            if (trackingNumber) body.trackingNumber = trackingNumber
            const res = await fetch(`/api/orders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) {
                const data = await res.json()
                console.error('Failed to update order status:', data.error)
                throw new Error('API_ERROR')
            }
            toast.success(t.dashboard.orders.toast.updated)
            onUpdate()
        } catch (error: unknown) {
            console.error('Order action error:', error)
            toast.error(t.dashboard.orders.toast.updateFailed)
        } finally {
            setIsLoading(false)
        }
    }

    const handleRefund = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/orders/${id}/refund`, { method: 'POST' })
            if (!res.ok) {
                const data = await res.json()
                console.error('Failed to refund order:', data.error)
                throw new Error('API_ERROR')
            }
            toast.success(t.dashboard.orders.toast.updated)
            onUpdate()
        } catch (error: unknown) {
            console.error('Refund order error:', error)
            toast.error(t.dashboard.orders.toast.updateFailed)
        } finally {
            setIsLoading(false)
        }
    }

    const handleCancel = async (reason: string) => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/orders/${id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            })
            if (!res.ok) {
                const data = await res.json()
                console.error('Failed to cancel order:', data.error)
                throw new Error('API_ERROR')
            }
            toast.success(t.dashboard.orders.toast.updated)
            setIsCancelModalOpen(false)
            onUpdate()
        } catch (error: unknown) {
            console.error('Cancel order error:', error)
            toast.error(t.dashboard.orders.toast.updateFailed)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                {/* Primary Action Button — always visible, disabled for terminal statuses */}
                {(() => {
                    const isTerminal = ['cancelled', 'refunded', 'completed'].includes(status)
                    const isAwaitingBtPayment = order.paymentMethod === 'bank_transfer' && order.paymentStatus !== 'paid' && ['pending', 'new'].includes(status)
                    const primaryDisabled = isLoading || isTerminal || isAwaitingBtPayment
                    // Shared <Button> dashPrimary (GH-1290 Bug 1) — giữ size full-width h-12 rounded-2xl
                    return (
                        <Button
                            variant="dashPrimary"
                            onClick={() => {
                                if (status === 'ready_to_ship') { setIsShipModalOpen(true); return }
                                handleAction(status === 'shipped' ? 'completed' : status === 'confirmed' ? 'ready_to_ship' : 'confirmed')
                            }}
                            disabled={primaryDisabled}
                            className="w-full h-9 rounded-lg text-[13px] gap-2 disabled:opacity-30"
                            style={{ boxShadow: '0px 4px 6px -4px rgba(0, 0, 0, 0.1), 0px 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        >
                            {isLoading && <Loader2 className="animate-spin" />}
                            {status === 'completed' ? p.completed : status === 'shipped' ? p.completed : status === 'ready_to_ship' ? p.shipped : status === 'confirmed' ? a.readyToShip : a.confirmOrder}
                        </Button>
                    )
                })()}

                {/* Bottom Row — layout_BH1FFS: row, gap 12px */}
                {(() => {
                    const isTerminal = ['cancelled', 'refunded', 'completed'].includes(status)
                    const cancelDisabled = isLoading || isTerminal || !['pending', 'new', 'confirmed', 'paid', 'processing'].includes(status)
                    const refundDisabled = isLoading || !['shipped', 'completed'].includes(status)
                    return (
                        <div className="flex" style={{ gap: 12 }}>
                            {/* Cancel Order — <Button> dashSecondary, border+text destructive (GH-1290 Bug 1) */}
                            <Button
                                variant="dashSecondary"
                                onClick={() => setIsCancelModalOpen(true)}
                                disabled={cancelDisabled}
                                className="flex-1 h-9 rounded-lg text-[13px] font-semibold hover:opacity-80 disabled:opacity-30 [border:1px_solid_hsl(var(--destructive)/0.3)] text-[hsl(var(--destructive))]"
                            >
                                {a.cancelOrder}
                            </Button>

                            {/* Refund — <Button> dashSecondary (GH-1290 Bug 1) */}
                            <Button
                                variant="dashSecondary"
                                onClick={handleRefund}
                                disabled={refundDisabled}
                                className="flex-1 h-9 rounded-lg text-[13px] font-semibold hover:opacity-80 disabled:opacity-30"
                            >
                                <IconRefund />
                                {a.refund}
                            </Button>
                        </div>
                    )
                })()}
            </div>

            <ShipOrderModal
                orderNumber={orderNumber}
                isOpen={isShipModalOpen}
                isLoading={isLoading}
                onBack={() => setIsShipModalOpen(false)}
                onConfirm={(trackingNumber) => { setIsShipModalOpen(false); handleAction('shipped', trackingNumber) }}
            />

            <CancelOrderModal
                orderNumber={orderNumber}
                isOpen={isCancelModalOpen}
                isLoading={isLoading}
                onBack={() => setIsCancelModalOpen(false)}
                onConfirm={handleCancel}
            />
        </>
    )
}

// ─── MAIN EXPORT ───
// layout_12UCNK: column, alignItems stretch, gap 24px, padding 24px 24px 0px
// ─── ORDER DETAIL PANEL MAIN COMPONENT ───
export function OrderDetailPanel({
    orderId,
    onClose,
    onUpdate,
}: {
    orderId: string | null
    onClose: () => void
    onUpdate?: () => void
}) {
    const [order, setOrder] = useState<OrderDetail | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const { t } = useI18n()
    const d = t.dashboard.orders.detail

    const fetchOrder = useCallback(async () => {
        if (!orderId) return
        setIsLoading(true)
        try {
            // Include depth to get related items (e.g. variants/products if stored as relationships via depth=1)
            const res = await fetch(`/api/orders/${orderId}?depth=1`)
            if (!res.ok) throw new Error('Failed to fetch order details')
            const result = await res.json()
            setOrder(result.data || result)
        } catch (error) {
            console.error(error)
            toast.error(t.dashboard.orders.toast.loadFailed)
        } finally {
            setIsLoading(false)
        }
    }, [orderId, t.dashboard.orders.toast.loadFailed])

    useEffect(() => {
        if (orderId) {
            fetchOrder()
        } else {
            setOrder(null)
        }
    }, [orderId, fetchOrder])

    if (!orderId) return null

    return (
        <div
            className="flex flex-col w-full"
            style={{
                gap: 24,
                padding: '24px 24px 0px',
            }}
        >
            {/* Header row — layout_RZB3PW: row, space-between, alignItems center */}
            <div className="flex items-center justify-between">
                {/* layout_8J1DI7: heading 215.47×28 */}
                {/* style_QOAWPZ: Inter 700 20px lineHeight 1.4em #F8FAFC */}
                <span
                    style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 700,
                        fontSize: 20,
                        lineHeight: '1.4em',
                        color: 'var(--dash-text)',
                    }}
                >
                    {d.title} {order?.orderNumber || orderId}
                </span>

                {/* Close button — shared <Button> ghost icon */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-dash-text-muted hover:text-dash-text rounded-xl"
                    aria-label="Close order details"
                    onClick={onClose}
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {isLoading && !order ? (
                <div className="w-full flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                </div>
            ) : order ? (
                <>
                    {/* Order Progress stepper */}
                    <OrderProgress status={order.status} />

                    {/* Action Buttons */}
                    <div className="z-20 md:static md:p-0 md:m-0 md:bg-transparent">
                        <ActionButtons order={order} onUpdate={() => { fetchOrder(); onUpdate?.(); }} />
                    </div>

                    {/* BT Verification Block */}
                    {(order.paymentMethod === 'bank_transfer' && order.paymentStatus === 'pending_verification') || (order.paymentMethod === 'bank_transfer' && order.paymentStatus === 'paid') ? (
                        <ManualPaymentVerificationBlock
                            order={order}
                            onUpdate={() => { fetchOrder(); onUpdate?.(); }}
                        />
                    ) : null}

                    {/* Customer Information */}
                    <CustomerInformation order={order} />

                    {/* Payment Information */}
                    <PaymentInformation order={order} />

                    {/* Order Items */}
                    <OrderItems order={order} />

                    {/* Order Summary */}
                    <OrderSummary order={order} />
                </>
            ) : null}

            {/* Bottom Padding Spacer (0px height, relies on 24px flex gap to push it down) */}
            <div style={{ flexShrink: 0, width: '100%' }}>&nbsp;</div>
        </div>
    )
}



