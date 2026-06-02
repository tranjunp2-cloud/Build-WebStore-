'use client'

import type { ElementType } from 'react'
import {
    Mail, Edit2, Info, ShoppingBag, PackageX, TimerOff,
    Timer, Key, ShoppingCart, ShieldCheck, BadgeCheck, XCircle,
    Lock, UserPlus, Users, CheckCircle, MessageSquare, BookOpen,
} from 'lucide-react'
import { useI18n } from '@/i18n'
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
    'order-completed':            CheckCircle,
    'order-cancelled':            PackageX,
    'order-expired':              TimerOff,
    'order-refunded':             XCircle,
    'bank-transfer-instructions': Timer,
    'payment-confirmed':          BadgeCheck,
    'payment-rejected':           XCircle,
    'new-order-seller':           ShoppingCart,
    'staff-invitation':           UserPlus,
    'contact-from-seller':        MessageSquare,
    'newsletter-seller-digest':   BookOpen,
}

function toLabel(type: EmailTemplateType): string {
    return type.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function relTime(iso: string | undefined, defaultLabel: string, editedAgoTpl: string, ti: (tpl: string, vars: Record<string, string | number>) => string): string {
    if (!iso) return defaultLabel
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return ti(editedAgoTpl, { time: `${mins}m` })
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return ti(editedAgoTpl, { time: `${hrs}h` })
    return ti(editedAgoTpl, { time: `${Math.floor(hrs / 24)}d` })
}

function HeaderCell({ children }: { children: React.ReactNode }) {
    return (
        <span
            style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 12,
                lineHeight: '1.333em',
                letterSpacing: '0.025em',
                textTransform: 'uppercase' as const,
                color: 'var(--dash-text-muted)',
            }}
        >
            {children}
        </span>
    )
}

function SimpleToggle({ on, locked, onChange }: { on: boolean; locked?: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={locked}
            onClick={(e) => { e.stopPropagation(); !locked && onChange(!on) }}
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

function StatusPill({ enabled, label }: { enabled: boolean; label: string }) {
    const cfg = enabled
        ? { bg: 'rgba(0,201,80,0.1)', border: 'rgba(0,201,80,0.3)', dot: '#00C950', text: '#05DF72' }
        : { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)', dot: '#64748b', text: '#94a3b8' }
    return (
        <span
            className="inline-flex items-center rounded-[12px]"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, gap: 7, padding: '4px 11px' }}
        >
            <span className="shrink-0 rounded-full" style={{ width: 7, height: 7, background: cfg.dot }} />
            <span style={{ fontWeight: 500, fontSize: 13, color: cfg.text, whiteSpace: 'nowrap' as const }}>{label}</span>
        </span>
    )
}

interface Props {
    rows: TemplateRow[]
    audienceTab: 'buyer' | 'seller'
    onTabChange: (tab: 'buyer' | 'seller') => void
    onSelectTemplate: (templateType: EmailTemplateType, recipient: EmailRecipient) => void
    onToggleEnabled: (templateType: EmailTemplateType, recipient: EmailRecipient, enabled: boolean) => void
}

export function EmailTemplateListView({ rows, audienceTab, onTabChange, onSelectTemplate, onToggleEnabled }: Props) {
    const { t, ti } = useI18n()
    const et = t.dashboard.settings.emailTemplates

    const allBuyer = EMAIL_TEMPLATE_TYPES.filter((tp) => EMAIL_TEMPLATE_RECIPIENTS[tp].includes('buyer'))
    const allSeller = EMAIL_TEMPLATE_TYPES.filter((tp) => EMAIL_TEMPLATE_RECIPIENTS[tp].includes('seller'))
    const activeTypes = audienceTab === 'buyer' ? allBuyer : allSeller
    const recipient: EmailRecipient = audienceTab === 'buyer' ? 'buyer' : 'seller'

    const findRow = (type: EmailTemplateType) =>
        rows.find((r) => r.templateType === type && r.recipient === recipient)

    const customizedCount = activeTypes.filter((tp) => findRow(tp)).length

    return (
        <div className="w-full">
            <h1 className="text-2xl font-bold text-white mb-1">{et.title}</h1>
            <p className="text-sm text-slate-400 mb-6">{et.subtitle}</p>

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
                                {tab === 'buyer' ? et.buyerEmails : et.sellerEmails}
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
                    {ti(et.customizedCount, { count: customizedCount, total: activeTypes.length })}
                </span>
            </div>

            {/* Table */}
            <div className="rounded-[16px] overflow-hidden border border-white/[0.08] bg-slate-800/60 mb-4">
                <table className="w-full border-collapse">
                    <colgroup>
                        <col />
                        <col style={{ width: 200 }} />
                        <col style={{ width: 140 }} />
                        <col style={{ width: 48 }} />
                    </colgroup>
                    <thead>
                        <tr style={{ background: 'var(--dash-surface)' }}>
                            <th className="text-left" style={{ height: 48, padding: '14px 20px' }}>
                                <HeaderCell>{et.colTemplate}</HeaderCell>
                            </th>
                            <th className="text-left" style={{ height: 48, padding: '14px 20px' }}>
                                <HeaderCell>{et.colStatus}</HeaderCell>
                            </th>
                            <th className="text-left" style={{ height: 48, padding: '14px 20px' }}>
                                <HeaderCell>{et.colLastEdited}</HeaderCell>
                            </th>
                            <th style={{ height: 48 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {activeTypes.map((type, i) => {
                            const row = findRow(type)
                            const isEnabled = row ? row.enabled : true
                            const isCritical = CRITICAL_TYPES.includes(type)
                            const isCustomized = Boolean(row)
                            const Icon = TEMPLATE_ICONS[type] ?? Mail

                            return (
                                <tr
                                    key={type}
                                    style={{
                                        borderBottom: i < activeTypes.length - 1 ? '1px solid var(--dash-border)' : 'none',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--dash-surface-hover)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                                    onClick={() => onSelectTemplate(type, recipient)}
                                >
                                    {/* Template column */}
                                    <td style={{ padding: '14px 20px' }}>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`flex items-center justify-center rounded-lg shrink-0 transition-colors ${isEnabled ? 'bg-blue-500/10' : 'bg-slate-500/10'}`}
                                                style={{ width: 36, height: 36 }}
                                            >
                                                <Icon
                                                    className={`transition-colors ${isEnabled ? 'text-blue-400' : 'text-slate-500'}`}
                                                    style={{ width: 18, height: 18 }}
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span
                                                        style={{
                                                            fontWeight: 600,
                                                            fontSize: 14,
                                                            color: isEnabled ? 'var(--dash-text)' : 'var(--dash-text-muted)',
                                                        }}
                                                    >
                                                        {toLabel(type)}
                                                    </span>
                                                    {isCustomized && (
                                                        <span className="shrink-0 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">
                                                            {et.customized}
                                                        </span>
                                                    )}
                                                </div>
                                                <p
                                                    style={{
                                                        fontSize: 12,
                                                        color: 'var(--dash-text-muted)',
                                                        overflow: 'hidden',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                    }}
                                                >
                                                    {et.descriptions[type]}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Status column */}
                                    <td style={{ padding: '14px 20px' }}>
                                        <div
                                            className="flex items-center gap-2.5"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <SimpleToggle
                                                on={isEnabled}
                                                locked={isCritical}
                                                onChange={(val) => onToggleEnabled(type, recipient, val)}
                                            />
                                            <StatusPill enabled={isEnabled} label={isEnabled ? et.enabled : et.disabled} />
                                        </div>
                                    </td>

                                    {/* Last edited column */}
                                    <td style={{ padding: '14px 20px' }}>
                                        <span style={{ fontSize: 13, color: 'var(--dash-text-muted)', whiteSpace: 'nowrap' as const }}>
                                            {relTime(row?.updatedAt, et.defaultLabel, et.editedAgo, ti)}
                                        </span>
                                    </td>

                                    {/* Edit button column */}
                                    <td style={{ padding: '14px 12px' }}>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onSelectTemplate(type, recipient) }}
                                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                                            title={et.editTemplate}
                                        >
                                            <Edit2 style={{ width: 14, height: 14 }} />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer tip */}
            <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-xs text-slate-400">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                <span>
                    <strong className="text-white">{et.footerTitle}</strong>{' '}
                    {et.footerDesc}
                </span>
            </div>
        </div>
    )
}
