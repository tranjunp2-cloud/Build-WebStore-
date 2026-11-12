'use client'
/**
 * Period presets, custom range popover, compare toggle and refresh. Writes the choice to the URL
 * (?period=… or ?from&to, ?compare=0) and keeps the other filters; paging and the open drawer are reset.
 */
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Calendar, Check, Download, RefreshCw } from 'lucide-react'
import { useStudioCan } from '../../_components/studio-permissions-context'
import { MAX_CUSTOM_DAYS, PERIOD_KEYS, type PeriodKey } from '@/lib/admin/ai-usage/period'

type Props = {
    periodKey: PeriodKey
    rangeText: string
    fromDay: string
    toDay: string
    todayDay: string
    /** Overview only: show the "Compare to previous period" toggle. */
    compare?: { on: boolean; text: string }
    exportHref?: string
}

const PRESET_LABEL: Record<string, string> = { '24h': '24h', '7d': '7d', '30d': '30d', '90d': '90d' }

export function PeriodControls({ periodKey, rangeText, fromDay, toDay, todayDay, compare, exportHref }: Props) {
    const canExport = useStudioCan()('data.export')
    const router = useRouter()
    const pathname = usePathname()
    const sp = useSearchParams()
    const [open, setOpen] = useState(false)
    const [from, setFrom] = useState(fromDay)
    const [to, setTo] = useState(toDay)
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    const go = (mutate: (q: URLSearchParams) => void) => {
        const q = new URLSearchParams(sp.toString())
        for (const key of ['limit', 'log']) q.delete(key)
        mutate(q)
        const qs = q.toString()
        startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname))
    }

    const applyPreset = (key: string) => {
        setOpen(false)
        go((q) => { q.delete('from'); q.delete('to'); q.set('period', key) })
    }

    const applyCustom = () => {
        const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || Number.isNaN(days)) return setError('Enter both dates as YYYY-MM-DD.')
        if (days < 1) return setError('The end date must be on or after the start date.')
        if (days > MAX_CUSTOM_DAYS) return setError(`Pick at most ${MAX_CUSTOM_DAYS} days.`)
        if (to > todayDay) return setError('Days after today are not available.')
        setError(null)
        setOpen(false)
        go((q) => { q.delete('period'); q.set('from', from); q.set('to', to) })
    }

    return (
        <>
            <div className="page-actions au-actions">
                <div className="au-preset" role="group" aria-label="Period">
                    {PERIOD_KEYS.map((key) => (
                        <button key={key} type="button" aria-pressed={periodKey === key} onClick={() => applyPreset(key)}>{PRESET_LABEL[key]}</button>
                    ))}
                </div>
                <div className="au-range">
                    <button type="button" className="btn btn-sm" aria-expanded={open} aria-pressed={periodKey === 'custom'} onClick={() => setOpen((v) => !v)}>
                        <Calendar size={14} />{rangeText}
                    </button>
                    <div className="au-pop" data-open={open ? '' : undefined} role="dialog" aria-label="Custom range">
                        <div className="au-pop__row">
                            <div><label htmlFor="au-from">From</label><input id="au-from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="YYYY-MM-DD" autoComplete="off" /></div>
                            <div><label htmlFor="au-to">To</label><input id="au-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="YYYY-MM-DD" autoComplete="off" /></div>
                        </div>
                        <p>Up to {MAX_CUSTOM_DAYS} days. Days after today are not available.</p>
                        {error && <p className="au-err-txt" role="alert">{error}</p>}
                        <div><button type="button" className="btn btn-sm btn-primary" onClick={applyCustom}>Apply</button></div>
                    </div>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => startTransition(() => router.refresh())} disabled={pending}>
                    <RefreshCw size={14} />Refresh
                </button>
                {exportHref && canExport && <a className="btn btn-sm" href={exportHref} download><Download size={14} />Export CSV</a>}
            </div>
            {compare && (
                <div className="au-compare" style={{ width: '100%' }}>
                    <label className="au-check">
                        <input type="checkbox" checked={compare.on} onChange={(e) => go((q) => { if (e.target.checked) q.delete('compare'); else q.set('compare', '0') })} />
                        <span className="au-box">{compare.on && <Check size={12} />}</span>Compare to previous period
                    </label>
                    <span>{rangeText}{compare.on ? ` · compared with ${compare.text}` : ''} · Malaysia time (UTC+8)</span>
                </div>
            )}
        </>
    )
}
