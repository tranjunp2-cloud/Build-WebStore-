'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, User, ShoppingBag, UndoDot, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { CustomerAvatar, RankBadge } from './customers-shared-ui'
import { CustomersDetailDefaultTab } from './customers-detail-default-tab'
import { CustomersDetailOrdersTab } from './customers-detail-orders-tab'
import { getShopCustomerDetailAction, updateShopCustomerAction } from '../actions'
import { useAgentRecordSync } from '@/lib/agent-changes/use-agent-record-sync'
import { AgentChangedNotice, SaveConflictNotice } from '@/components/agent/agent-changed-notice'
import { useSaveVersion } from '@/lib/save-version/use-save-version'
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
    // the customer's updatedAt as loaded: sent with each save so a newer change is never written over
    const version = useSaveVersion(customer.updatedAt)
    const setVersion = version.set

    const dirty = useMemo(
        () => JSON.stringify(draft) !== JSON.stringify(original),
        [draft, original],
    )

    // The assistant changed this customer: read it again and replace both copies (draft + saved)
    const reload = useCallback(async () => {
        try {
            const fresh: ShopCustomerRecord = await getShopCustomerDetailAction(customer.id)
            setOriginal(fresh)
            setDraft(fresh)
            setErrors({})
            setVersion(fresh.updatedAt)
        } catch (err) {
            console.error('[Customer reload]', err)
        }
    }, [customer.id, setVersion])
    const sync = useAgentRecordSync({ kind: 'store_customer', id: String(customer.id), dirty, reload })

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
            const saved = await updateShopCustomerAction(draft.id, {
                name: draft.name,
                rank: draft.rank,
                notes: draft.notes,
            }, version.current())
            if (version.refused(saved)) return
            version.set(saved.updatedAt)
            toast.success(cd.saved)
            router.push('/customers')
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
                    className="flex items-center justify-center w-9 h-9 rounded-[10px] text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors border-none bg-transparent cursor-pointer shrink-0"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <CustomerAvatar name={original.name} email={original.email} size={48} square />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-[20px] font-bold text-foreground truncate">{original.name}</h1>
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

            {version.conflicted
                ? <SaveConflictNotice record="customer" onLoadLatest={sync.reloadNow} onSaveAnyway={() => { version.overwrite(); void handleSave() }} />
                : sync.stale && <AgentChangedNotice record="customer" onReload={sync.reloadNow} onKeep={sync.keepMine} />}

            {/* Dirty bar — synced with discount-form-header style */}
            {dirty && (
                <div
                    className="flex items-center justify-between gap-4 px-6 py-2 text-sm rounded-[10px]"
                    style={{ background: 'hsl(var(--warning)/0.08)', border: '1px solid hsl(var(--warning)/0.2)', color: 'hsl(var(--warning))' }}
                >
                    <span>{cd.unsavedBanner}</span>
                    <button
                        type="button"
                        onClick={handleRevert}
                        disabled={saving}
                        className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                        style={{ color: 'hsl(var(--warning))', background: 'hsl(var(--warning)/0.12)' }}
                    >
                        <UndoDot className="h-3 w-3" />
                        {cd.revert}
                    </button>
                </div>
            )}

            {/* Tab bar */}
            <div className="flex gap-1" style={{ borderBottom: '1px solid var(--dash-border)' }}>
                <button
                    type="button"
                    onClick={() => setActiveTab('default')}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold transition-colors cursor-pointer border-none bg-transparent border-b-2 -mb-px"
                    style={{
                        color: activeTab === 'default' ? 'hsl(var(--primary))' : 'var(--cus-text-muted)',
                        borderBottomColor: activeTab === 'default' ? 'hsl(var(--primary))' : 'transparent',
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
                        color: activeTab === 'orders' ? 'hsl(var(--primary))' : 'var(--cus-text-muted)',
                        borderBottomColor: activeTab === 'orders' ? 'hsl(var(--primary))' : 'transparent',
                    }}
                >
                    <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                    {cd.tabOrders}
                    <span
                        className="inline-flex items-center justify-center tabular-nums"
                        style={{
                            minWidth: 18, height: 18, padding: '0 6px',
                            borderRadius: 999, fontSize: 11, fontWeight: 700,
                            background: activeTab === 'orders' ? 'hsl(var(--primary)/0.18)' : 'var(--cus-border-medium)',
                            color: activeTab === 'orders' ? 'hsl(var(--primary))' : 'var(--cus-text-subtle)',
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

            {/* Save bar — GH-1509: aligned to the same template as PaymentsFormClient.tsx /
                Shipping's SettingsFooter (floating rounded card, `--save-bar-bg`, amber
                "unsaved changes" indicator, size="sm" buttons) instead of the old full-width
                fixed bar. Also only renders while dirty — was previously always visible on the
                default tab, just swapping "Unsaved changes" / "Up to date" text.
                `position: fixed` (not `sticky`) — sticky only pins once you scroll past its
                natural flow position, so it visibly drifted with the page instead of staying
                put. `--dash-content-pl` (globals.css, GH-1592) aligns it with the content column
                (sidebar + p-8 gutter) at lg+. */}
            {activeTab === 'default' && dirty && (
                <div
                    className="fixed z-40 bottom-4 left-4 right-4 lg:left-[var(--dash-content-pl)] lg:right-8 flex flex-wrap items-center justify-between gap-y-2 px-[18px] py-[12px] rounded-[14px] border border-solid border-[hsl(var(--border))]"
                    style={{ background: 'var(--save-bar-bg)', boxShadow: 'var(--save-bar-shadow)' }}
                >
                    <div className="flex items-center gap-2 text-[13px]">
                        <AlertCircle className="w-[14px] h-[14px] text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="text-amber-600 dark:text-amber-300 font-medium">{cd.unsaved}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            onClick={() => router.push('/customers')}
                            disabled={saving}
                            variant="dashSecondary"
                            size="sm"
                        >
                            {cd.cancel}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={!dirty || saving}
                            size="sm"
                        >
                            {saving
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Check className="h-3.5 w-3.5" />
                            }
                            {cd.saveChanges}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
