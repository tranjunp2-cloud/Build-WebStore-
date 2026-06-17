'use client'

import type { ElementType } from 'react'
import {
    Mail, Edit2, Info, ShoppingBag, PackageX, TimerOff,
    Timer, Key, ShoppingCart, ShieldCheck, BadgeCheck, XCircle,
    Lock, UserPlus, Users, CheckCircle, MessageSquare, BookOpen,
    User, Store,
} from 'lucide-react'
import { useI18n } from '@/i18n'
import {
    EMAIL_TEMPLATE_TYPES,
    EMAIL_TEMPLATE_RECIPIENTS,
    type EmailTemplateType,
    type EmailRecipient,
} from '@/lib/email/types'
import type { TemplateRow } from './EmailTemplatesClient'
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    TableActionButton,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

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

const TEMPLATE_LABELS: Partial<Record<EmailTemplateType, string>> = {
    'otp-verification':           'OTP Verification',
    'forgot-password':            'Password Reset',
    'order-completed':            'Order Delivered',
    'bank-transfer-instructions': 'Payment Reminder (Bank Transfer)',
    'new-order-seller':           'New Order Notification',
    'contact-from-seller':        'Contact Form (Seller)',
    'newsletter-seller-digest':   'Newsletter (Seller Digest)',
}

function toLabel(type: EmailTemplateType): string {
    return TEMPLATE_LABELS[type] ?? type.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
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
            <h1 className="text-2xl font-bold text-[var(--dash-text)] mb-1">{et.title}</h1>
            <p className="text-sm text-[var(--dash-text-muted)] mb-6">{et.subtitle}</p>

            {/* Tabs row — full-width baseline border; blue underline only under the active tab.
                Preflight is off (tailwind.config.js) so Tailwind border utils have no border-style
                and render invisible — paint borders via inline shorthand instead. */}
            <div className="flex items-center justify-between mb-4" style={{ borderBottom: '1px solid var(--dash-divider)' }}>
                <div className="flex gap-0">
                    {(['buyer', 'seller'] as const).map((tab) => {
                        const count = tab === 'buyer' ? allBuyer.length : allSeller.length
                        const isActive = audienceTab === tab
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => onTabChange(tab)}
                                className={`flex items-center gap-2 px-4 pb-2.5 text-sm font-medium transition-colors -mb-px ${
                                    isActive ? 'text-[var(--dash-text)]' : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]'
                                }`}
                                style={{ borderBottom: isActive ? '2px solid var(--dash-accent)' : '2px solid transparent' }}
                            >
                                {tab === 'buyer' ? <User className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                                {tab === 'buyer' ? et.buyerEmails : et.sellerEmails}
                                <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                                    isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-black/[0.06] dark:bg-white/10 text-[var(--dash-text-muted)]'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        )
                    })}
                </div>
                <span className="text-xs text-[var(--dash-text-muted)]">
                    {ti(et.customizedCount, { count: customizedCount, total: activeTypes.length })}
                </span>
            </div>

            {/* Table */}
            <div className="mb-4">
                <Table>
                    <colgroup>
                        <col />
                        <col style={{ width: 200 }} />
                        <col style={{ width: 140 }} />
                        <col style={{ width: 48 }} />
                    </colgroup>
                    <TableHeader>
                        <TableRow>
                            <TableHead style={{ height: 48, padding: '14px 20px' }}>{et.colTemplate}</TableHead>
                            <TableHead style={{ height: 48, padding: '14px 20px' }}>{et.colStatus}</TableHead>
                            <TableHead style={{ height: 48, padding: '14px 20px' }}>{et.colLastEdited}</TableHead>
                            <TableHead style={{ height: 48 }} />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {activeTypes.map((type) => {
                            const row = findRow(type)
                            const isEnabled = row ? row.enabled : true
                            const isCritical = CRITICAL_TYPES.includes(type)
                            const isCustomized = Boolean(row)
                            const Icon = TEMPLATE_ICONS[type] ?? Mail

                            return (
                                <TableRow
                                    key={type}
                                    clickable
                                    onClick={() => onSelectTemplate(type, recipient)}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--dash-surface-hover)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                                >
                                    {/* Template column */}
                                    <TableCell style={{ padding: '14px 20px' }}>
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
                                    </TableCell>

                                    {/* Status column — themed Badge replaces old hardcoded StatusPill */}
                                    <TableCell style={{ padding: '14px 20px' }}>
                                        <div
                                            className="flex items-center gap-2.5"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <Switch
                                                checked={isEnabled}
                                                disabled={isCritical}
                                                onCheckedChange={(val) => onToggleEnabled(type, recipient, val)}
                                            />
                                            <Badge
                                                variant={isEnabled ? 'success' : 'secondary'}
                                                dot
                                                className="rounded-full"
                                            >
                                                {isEnabled ? et.enabled : et.disabled}
                                            </Badge>
                                        </div>
                                    </TableCell>

                                    {/* Last edited column */}
                                    <TableCell style={{ padding: '14px 20px' }}>
                                        <span style={{ fontSize: 13, color: 'var(--dash-text-muted)', whiteSpace: 'nowrap' as const }}>
                                            {relTime(row?.updatedAt, et.neverEdited, et.editedAgo, ti)}
                                        </span>
                                    </TableCell>

                                    {/* Edit button column */}
                                    <TableCell style={{ padding: '14px 12px' }}>
                                        <TableActionButton
                                            onClick={(e) => { e.stopPropagation(); onSelectTemplate(type, recipient) }}
                                            title={et.editTemplate}
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </TableActionButton>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Footer tip */}
            <div className="flex items-start gap-2 rounded-lg px-4 py-3 text-xs" style={{ background: 'var(--dash-surface-hover)', border: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}>
                <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--dash-text-muted)' }} />
                <span>
                    <strong className="text-[var(--dash-text)]">{et.footerTitle}</strong>{' '}
                    {et.footerDesc}
                </span>
            </div>
        </div>
    )
}
