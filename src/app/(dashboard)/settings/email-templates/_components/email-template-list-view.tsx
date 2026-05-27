'use client'

import type { ElementType } from 'react'
import {
    Mail, Edit2, Info, ShoppingBag, PackageX, Truck, TimerOff,
    Timer, Key, ShoppingCart, ShieldCheck, BadgeCheck, XCircle,
    Lock, Upload, UserPlus, Activity, Users,
} from 'lucide-react'
import {
    EMAIL_TEMPLATE_TYPES,
    EMAIL_TEMPLATE_RECIPIENTS,
    type EmailTemplateType,
    type EmailRecipient,
} from '@/lib/email/types'
import type { TemplateRow } from './EmailTemplatesClient'

const CRITICAL_TYPES: EmailTemplateType[] = ['otp-verification', 'forgot-password', 'password-changed']

const TEMPLATE_ICONS: Record<EmailTemplateType, ElementType> = {
    'welcome':                    Users,
    'otp-verification':           ShieldCheck,
    'forgot-password':            Key,
    'password-changed':           Lock,
    'order-confirmation':         ShoppingBag,
    'order-status':               Activity,
    'order-cancelled':            PackageX,
    'order-shipped':              Truck,
    'order-expired':              TimerOff,
    'new-order-seller':           ShoppingCart,
    'bank-transfer-instructions': Timer,
    'payment-confirmed':          BadgeCheck,
    'payment-rejected':           XCircle,
    'resend-upload-link':         Upload,
    'staff-invitation':           UserPlus,
}

const TEMPLATE_DESCRIPTIONS: Record<EmailTemplateType, string> = {
    'welcome':                    'First-touch hello when a buyer signs up or places their first order.',
    'otp-verification':           'One-time verification code for login and account security.',
    'forgot-password':            'Password reset link, valid for 30 minutes.',
    'password-changed':           'Confirm password was changed successfully.',
    'order-confirmation':         "Sent the moment a buyer's checkout succeeds — receipts, items, shipping.",
    'order-status':               'Order status update notification sent to the buyer.',
    'order-cancelled':            'Notify buyer when their order is cancelled.',
    'order-shipped':              'Delivery confirmation when the order is shipped.',
    'order-expired':              'Alert buyer when an unpaid order has expired.',
    'new-order-seller':           'New order notification for the seller dashboard.',
    'bank-transfer-instructions': 'Remind buyer to complete bank transfer — order auto-cancels after 24h.',
    'payment-confirmed':          'Confirm payment has been received and order is processing.',
    'payment-rejected':           'Inform buyer that their payment was rejected.',
    'resend-upload-link':         'Send a new upload link when the previous one expires.',
    'staff-invitation':           'Invite new staff members to access the dashboard.',
}

function toLabel(type: EmailTemplateType): string {
    return type.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// Toggle pill: 36×20px, off=#cbd5e1 (slate-300), on=#22c55e (green-500)
function SimpleToggle({ on, locked, onChange }: { on: boolean; locked?: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={locked}
            onClick={() => !locked && onChange(!on)}
            style={{ width: 36, height: 20 }}
            className={`relative inline-flex shrink-0 rounded-full transition-colors ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${on ? 'bg-green-500' : 'bg-slate-300'}`}
        >
            <span
                style={{ width: 16, height: 16, top: 2, left: 2 }}
                className={`pointer-events-none absolute rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`}
            />
        </button>
    )
}

function relTime(iso?: string): string {
    if (!iso) return 'Default'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `Edited ${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Edited ${hrs}h ago`
    return `Edited ${Math.floor(hrs / 24)}d ago`
}

interface Props {
    rows: TemplateRow[]
    audienceTab: 'buyer' | 'seller'
    onTabChange: (tab: 'buyer' | 'seller') => void
    onSelectTemplate: (templateType: EmailTemplateType, recipient: EmailRecipient) => void
    onToggleEnabled: (templateType: EmailTemplateType, recipient: EmailRecipient, enabled: boolean) => void
}

export function EmailTemplateListView({ rows, audienceTab, onTabChange, onSelectTemplate, onToggleEnabled }: Props) {
    const allBuyer = EMAIL_TEMPLATE_TYPES.filter((t) => EMAIL_TEMPLATE_RECIPIENTS[t].includes('buyer'))
    const allSeller = EMAIL_TEMPLATE_TYPES.filter((t) => EMAIL_TEMPLATE_RECIPIENTS[t].includes('seller'))
    const activeTypes = audienceTab === 'buyer' ? allBuyer : allSeller
    const recipient: EmailRecipient = audienceTab === 'buyer' ? 'buyer' : 'seller'

    const findRow = (type: EmailTemplateType) =>
        rows.find((r) => r.templateType === type && r.recipient === recipient)

    const customizedCount = activeTypes.filter((t) => findRow(t)).length
    const sectionLabel = audienceTab === 'buyer' ? 'Buyer-facing emails' : 'Seller-facing emails'

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-white mb-1">Email Templates</h1>
            <p className="text-sm text-slate-400 mb-6">
                Customize the transactional emails your store sends to buyers and to yourself. Edits are scoped to this tenant — defaults stay safe and revertable.
            </p>

            {/* Tabs row */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex gap-0 border-b border-white/[0.08]">
                    {(['buyer', 'seller'] as const).map((tab) => {
                        const count = tab === 'buyer' ? allBuyer.length : allSeller.length
                        const isActive = audienceTab === tab
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => onTabChange(tab)}
                                className={`flex items-center gap-2 px-4 pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                                    isActive
                                        ? 'border-blue-500 text-white'
                                        : 'border-transparent text-slate-400 hover:text-white'
                                }`}
                            >
                                {tab === 'buyer' ? <Mail className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                                {tab === 'buyer' ? 'Buyer Emails' : 'Seller Emails'}
                                <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                                    isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-slate-400'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        )
                    })}
                </div>
                <span className="text-xs text-slate-400">
                    {customizedCount} of {activeTypes.length} customized
                </span>
            </div>

            {/* Main card — bg-[#0d1525] maps to --dash-bg (dark page bg) via globals.css */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0d1525] overflow-hidden mb-4">
                {/* Section header — bg-[#1a2540] maps to --dash-surface (slightly lighter) */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[#1a2540] border-b border-white/[0.08]">
                    {audienceTab === 'buyer'
                        ? <Mail className="h-4 w-4 text-slate-400" />
                        : <ShoppingCart className="h-4 w-4 text-slate-400" />}
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {sectionLabel}
                    </span>
                    <span className="text-xs bg-white/10 text-slate-400 rounded-full px-2 py-0.5 font-semibold">
                        {activeTypes.length}
                    </span>
                </div>

                {activeTypes.map((type) => {
                    const row = findRow(type)
                    const isEnabled = row ? row.enabled : true
                    const isCritical = CRITICAL_TYPES.includes(type)
                    const Icon = TEMPLATE_ICONS[type] ?? Mail

                    return (
                        <div
                            key={type}
                            className={`grid items-center gap-4 px-4 py-3 border-b border-white/[0.05] last:border-0 transition-opacity ${!isEnabled ? 'opacity-65 hover:opacity-100' : ''}`}
                            style={{ gridTemplateColumns: '44px minmax(0,1fr) 160px 120px 28px' }}
                        >
                            {/* Icon */}
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 shrink-0">
                                <Icon className="h-5 w-5 text-blue-400" />
                            </div>

                            {/* Name + description */}
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-semibold text-white truncate">{toLabel(type)}</span>
                                    {row && (
                                        <span className="shrink-0 bg-blue-500/15 text-blue-400 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded">
                                            Customized
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 truncate">{TEMPLATE_DESCRIPTIONS[type]}</p>
                            </div>

                            {/* Toggle + label */}
                            <div className="flex items-center gap-2">
                                <SimpleToggle
                                    on={isEnabled}
                                    locked={isCritical}
                                    onChange={(val) => onToggleEnabled(type, recipient, val)}
                                />
                                <span className={`text-xs font-medium ${isEnabled ? 'text-green-400' : 'text-slate-400'}`}>
                                    {isEnabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>

                            {/* Edited / Default */}
                            <span className="text-xs text-slate-400 truncate">{relTime(row?.updatedAt)}</span>

                            {/* Edit button */}
                            <button
                                type="button"
                                onClick={() => onSelectTemplate(type, recipient)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                                title="Edit template"
                            >
                                <Edit2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* Footer tip */}
            <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-xs text-slate-400">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                <span>
                    <strong className="text-white">Tenant-scoped overrides.</strong>{' '}
                    Disabling a template stops it from sending in your store only — global defaults keep serving other tenants. Reset any template to default at any time from the edit view.
                </span>
            </div>
        </div>
    )
}
