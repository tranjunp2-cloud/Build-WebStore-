'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, User, ShoppingBag, CircleAlert, Undo2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { CustomerAvatar, RankBadge } from './customers-shared-ui'
import { CustomersDetailDefaultTab } from './customers-detail-default-tab'
import { CustomersDetailOrdersTab } from './customers-detail-orders-tab'
import { updateShopCustomerAction } from '../actions'
import type { ShopCustomerRecord } from '../_lib/shop-customer-record'

type Tab = 'default' | 'orders'
export type EditableFields = Pick<ShopCustomerRecord, 'name' | 'rank' | 'notes'>

type Props = { customer: ShopCustomerRecord }

function relativeTime(iso: string, justNow: string): string {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (d < 1) return justNow
    if (d < 60) return `${d}m ago`
    const h = Math.floor(d / 60)
    if (h < 24) return `${h}h ago`
    const days = Math.floor(h / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months}mo ago`
    return `${Math.floor(months / 12)}y ago`
}

export function CustomersDetail({ customer }: Props) {
    const router = useRouter()
    const { t } = useI18n()
    const cd = t.dashboard.shopCustomers.detail
    const [draft, setDraft]       = useState<ShopCustomerRecord>(customer)
    const [original, setOriginal] = useState<ShopCustomerRecord>(customer)
    const [activeTab, setActiveTab] = useState<Tab>('default')
    const [saving, setSaving]     = useState(false)
    const [errors, setErrors]     = useState<Record<string, string>>({})

    const dirty = useMemo(
        () => JSON.stringify(draft) !== JSON.stringify(original),
        [draft, original],
    )

    function handleChange(updates: Partial<EditableFields>) {
        setDraft(prev => ({ ...prev, ...updates }))
        const changed = Object.keys(updates)
        if (changed.some(k => errors[k])) {
            setErrors(prev => {
                const e = { ...prev }
                changed.forEach(k => delete e[k])
                return e
            })
        }
    }

    function validate(): boolean {
        const e: Record<string, string> = {}
        if (!draft.name?.trim()) e.name = cd.fieldNameRequired
        setErrors(e)
        return Object.keys(e).length === 0
    }

    async function handleSave() {
        if (!validate()) return
        setSaving(true)
        try {
            const updated = await updateShopCustomerAction(draft.id, {
                name: draft.name,
                rank: draft.rank,
                notes: draft.notes,
            })
            const merged: ShopCustomerRecord = {
                ...updated,
                orderCount: original.orderCount,
                lifetime: original.lifetime,
                completedRate: original.completedRate,
                failedRate: original.failedRate,
                firstOrderAt: original.firstOrderAt,
                latestOrderAt: original.latestOrderAt,
            }
            setOriginal(merged)
            setDraft(merged)
            toast.success(cd.saved)
        } catch {
            toast.error(cd.saveFailed)
        } finally {
            setSaving(false)
        }
    }

    function handleRevert() {
        setDraft(original)
        setErrors({})
    }

    const cusId = `cus_${String(original.id).padStart(6, '0')}`

    return (
        <div className="space-y-4 pb-24">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => router.push('/customers')}
                    className="flex items-center justify-center w-9 h-9 rounded-[10px] text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors border-none bg-transparent cursor-pointer shrink-0"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <CustomerAvatar name={original.name} email={original.email} size={48} square />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-[20px] font-bold text-[#F8FAFC] truncate">{original.name}</h1>
                        <RankBadge rank={original.rank} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5" style={{ fontSize: 12, color: 'var(--cus-text-muted)' }}>
                        <span>{original.email}</span>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--cus-dot-sep)', flexShrink: 0, display: 'inline-block' }} />
                        <span>
                            ID{' '}
                            <code className="font-mono px-1.5 py-0.5 rounded-[4px]" style={{ fontSize: 11, background: 'var(--cus-code-bg)', color: 'var(--cus-code-fg)', border: '1px solid var(--cus-code-border)' }}>
                                {cusId}
                            </code>
                        </span>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--cus-dot-sep)', flexShrink: 0, display: 'inline-block' }} />
                        <span>{cd.updated} {relativeTime(original.updatedAt, cd.relJustNow)}</span>
                    </div>
                </div>
            </div>

            {/* Dirty bar */}
            {dirty && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-[8px] border border-amber-500/30 bg-amber-500/[0.10]">
                    <div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: '#fbbf24' }}>
                        <CircleAlert className="w-3.5 h-3.5 shrink-0" />
                        {cd.unsavedBanner}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleRevert}
                            disabled={saving}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-medium text-white/70 border border-white/[0.1] bg-transparent hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <Undo2 className="w-3 h-3" /> {cd.revert}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 h-8 px-4 rounded-[8px] text-[12px] font-medium text-white border-none cursor-pointer disabled:opacity-60"
                            style={{ background: 'linear-gradient(90deg,#3b82f6 0%,#2dd4bf 100%)' }}
                        >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            {cd.saveChanges}
                        </button>
                    </div>
                </div>
            )}

            {/* Tab bar */}
            <div className="flex gap-1 border-b border-white/[0.06]">
                <button
                    type="button"
                    onClick={() => setActiveTab('default')}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold transition-colors cursor-pointer border-none bg-transparent border-b-2 -mb-px"
                    style={{
                        color: activeTab === 'default' ? '#3b82f6' : 'var(--cus-text-muted)',
                        borderBottomColor: activeTab === 'default' ? '#3b82f6' : 'transparent',
                    }}
                >
                    <User className="w-3.5 h-3.5 shrink-0" />
                    {cd.tabDefault}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold transition-colors cursor-pointer border-none bg-transparent border-b-2 -mb-px"
                    style={{
                        color: activeTab === 'orders' ? '#3b82f6' : 'var(--cus-text-muted)',
                        borderBottomColor: activeTab === 'orders' ? '#3b82f6' : 'transparent',
                    }}
                >
                    <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                    {cd.tabOrders}
                    <span
                        className="inline-flex items-center justify-center tabular-nums"
                        style={{
                            minWidth: 18, height: 18, padding: '0 6px',
                            borderRadius: 999, fontSize: 11, fontWeight: 700,
                            background: activeTab === 'orders' ? 'rgba(59,130,246,0.18)' : 'var(--cus-border-medium)',
                            color: activeTab === 'orders' ? '#93c5fd' : 'var(--cus-text-subtle)',
                        }}
                    >
                        {original.orderCount}
                    </span>
                </button>
            </div>

            {activeTab === 'default'
                ? <CustomersDetailDefaultTab draft={draft} onChange={handleChange} errors={errors} original={original} />
                : <CustomersDetailOrdersTab customerId={original.id} />
            }

            {/* Sticky save bar — only on Default tab */}
            {activeTab === 'default' && (
                <div
                    className="fixed bottom-0 left-0 right-0 md:left-[260px] flex items-center justify-between gap-3 px-6 py-3 border-t border-white/[0.06] z-40"
                    style={{ background: 'var(--cus-surface-sticky)', backdropFilter: 'blur(12px)' }}
                >
                    <span style={{ fontSize: 12, color: 'var(--cus-text-muted)' }}>
                        {dirty ? cd.unsaved : cd.upToDate}
                        {' · '}{cd.lastSaved}{' '}
                        <strong style={{ color: 'var(--dash-text)' }}>{relativeTime(original.updatedAt, cd.relJustNow)}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleRevert}
                            disabled={!dirty || saving}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12px] font-medium text-white/70 border border-white/[0.1] bg-transparent hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-40"
                        >
                            <Undo2 className="w-3 h-3" /> {cd.revert}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!dirty || saving}
                            className="flex items-center gap-1.5 h-8 px-4 rounded-[8px] text-[12px] font-medium text-white border-none cursor-pointer disabled:opacity-40"
                            style={{ background: 'linear-gradient(90deg,#3b82f6 0%,#2dd4bf 100%)' }}
                        >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            {cd.saveChanges}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
