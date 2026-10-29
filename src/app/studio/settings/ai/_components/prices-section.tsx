'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'
import { blankPriceRow, type Draft, type PriceRow } from '@/lib/admin/ai-settings/draft'
import type { UnpricedModel } from '@/lib/admin/ai-settings/types'
import styles from '../ai-settings.module.css'

type NumField = 'input' | 'output' | 'cachedInput' | 'cacheWrite' | 'longFrom' | 'longInput' | 'longOutput'
const COLUMNS: Array<{ field: NumField; label: string; usd: boolean }> = [
    { field: 'input', label: 'Input', usd: true },
    { field: 'output', label: 'Output', usd: true },
    { field: 'cachedInput', label: 'Cached input', usd: true },
    { field: 'cacheWrite', label: 'Cache write', usd: true },
    { field: 'longFrom', label: 'Long context from (tokens)', usd: false },
    { field: 'longInput', label: 'Long input', usd: true },
    { field: 'longOutput', label: 'Long output', usd: true },
]

interface Props {
    draft: Draft
    unpriced: UnpricedModel[]
    errors: Map<string, string>
    updatedAt: string | null
    onChange: (next: Pick<Draft, 'prices' | 'pictures'>) => void
}

export function PricesSection({ draft, unpriced, errors, updatedAt, onChange }: Props) {
    const [newKey, setNewKey] = useState('')
    const [adding, setAdding] = useState(false)
    const [addError, setAddError] = useState<string | null>(null)
    const calls = new Map(unpriced.map((u) => [u.model, u.calls]))
    const setRow = (key: string, patch: Partial<PriceRow>) =>
        onChange({ pictures: draft.pictures, prices: draft.prices.map((row) => (row.key === key ? { ...row, ...patch } : row)) })
    const add = () => {
        const key = newKey.trim()
        if (!/^[a-z0-9_-]+:[^\s,]+$/i.test(key)) return setAddError('Use provider:model, e.g. anthropic:claude-haiku-5-5.')
        if (draft.prices.some((row) => row.key === key)) return setAddError('This model is already in the table.')
        onChange({ pictures: draft.pictures, prices: [...draft.prices, blankPriceRow(key)] })
        setNewKey(''); setAddError(null); setAdding(false)
    }
    return (
        <>
            <section className="aiq-card" id="prices">
                <div className="aiq-card-head">
                    <div>
                        <div className="aiq-card-title">Prices per 1M tokens (USD)</div>
                        <div className="aiq-card-sub">Used to price every call.{updatedAt ? ` Last changed ${new Date(updatedAt).toLocaleString('en-GB')}.` : ' No prices saved yet.'}</div>
                    </div>
                    <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> Add model</button>
                </div>
                {adding && (
                    <div className={styles.notice}>
                        <div className={styles.row}>
                            <input className={styles.select} style={{ width: 280 }} autoFocus aria-label="Provider and model" placeholder="provider:model"
                                value={newKey} onChange={(e) => setNewKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
                            <button type="button" className="btn btn-sm btn-primary" onClick={add}>Add</button>
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setAdding(false); setAddError(null) }}>Cancel</button>
                        </div>
                        {addError && <p className={styles.err}>{addError}</p>}
                    </div>
                )}
                <div className={styles.tblWrap}>
                    <table className="tbl">
                        <thead><tr><th scope="col">Provider · model</th>{COLUMNS.map((c) => <th key={c.field} scope="col" className="num">{c.label}</th>)}<th /></tr></thead>
                        <tbody>
                            {draft.prices.map((row) => {
                                const missing = calls.get(row.key)
                                const rowError = errors.get(`config|prices|${row.key}`)
                                const flagged = Boolean(missing && !row.input.trim() && !row.output.trim()) || Boolean(rowError)
                                return (
                                    <tr key={row.key} className={flagged ? styles.rowErr : undefined}>
                                        <td>
                                            <span className={styles.mono}>{row.key}</span>
                                            {missing && (!row.input.trim() || !row.output.trim()) && (
                                                <span className={styles.err} style={{ display: 'block' }}>Add input and output prices: {missing} {missing === 1 ? 'call' : 'calls'} this week {missing === 1 ? 'is' : 'are'} unpriced.</span>
                                            )}
                                            {rowError && <span className={styles.err} style={{ display: 'block' }}>{rowError}</span>}
                                        </td>
                                        {COLUMNS.map((c) => {
                                            const error = errors.get(`config|prices|${row.key}|${c.field === 'longFrom' ? 'longContext|aboveInputTokens' : c.field.startsWith('long') ? `longContext|${c.field === 'longInput' ? 'input' : 'output'}` : c.field}`)
                                            return (
                                                <td key={c.field} className="num">
                                                    <span className={`${styles.numIn} ${styles.sm} ${error ? styles.invalid : ''}`} title={error}>
                                                        {c.usd && <span>$</span>}
                                                        <input inputMode="decimal" value={row[c.field]} aria-label={`${c.label} for ${row.key}`} aria-invalid={error ? true : undefined}
                                                            placeholder={c.field === 'longFrom' ? 'none' : ''} onChange={(e) => setRow(row.key, { [c.field]: e.target.value })} />
                                                    </span>
                                                </td>
                                            )
                                        })}
                                        <td>
                                            <button type="button" className={styles.btnIcon} aria-label={`Remove ${row.key}`}
                                                onClick={() => onChange({ pictures: draft.pictures, prices: draft.prices.filter((r) => r.key !== row.key) })}>×</button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {draft.prices.length === 0 && <tr><td colSpan={9} className={styles.dim}>No prices yet. Add a model.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>
            <PicturePrices draft={draft} errors={errors} onChange={onChange} />
        </>
    )
}

function PicturePrices({ draft, errors, onChange }: Pick<Props, 'draft' | 'errors' | 'onChange'>) {
    const [key, setKey] = useState('')
    const set = (pictures: Draft['pictures']) => onChange({ prices: draft.prices, pictures })
    return (
        <section className="aiq-card">
            <div className="aiq-card-head">
                <div>
                    <div className="aiq-card-title">Picture prices (USD per picture)</div>
                    <div className="aiq-card-sub">One price per generated picture. Models here can be used in the Image chain.</div>
                </div>
            </div>
            <div className={styles.notice}>
                {draft.pictures.map((row) => {
                    const error = errors.get(`config|images|${row.key}`)
                    return (
                        <div className={styles.row} key={row.key} style={{ marginBottom: 6 }}>
                            <span className={`${styles.mono} ${styles.label}`}>{row.key}</span>
                            <span className={`${styles.numIn} ${styles.sm} ${error ? styles.invalid : ''}`}>
                                <span>$</span>
                                <input inputMode="decimal" aria-label={`Price per picture for ${row.key}`} value={row.price}
                                    onChange={(e) => set(draft.pictures.map((r) => (r.key === row.key ? { ...r, price: e.target.value } : r)))} />
                            </span>
                            <button type="button" className={styles.btnIcon} aria-label={`Remove ${row.key}`} onClick={() => set(draft.pictures.filter((r) => r.key !== row.key))}>×</button>
                            {error && <span className={styles.err}>{error}</span>}
                        </div>
                    )
                })}
                <div className={styles.row}>
                    <input className={styles.select} style={{ width: 280 }} aria-label="Picture model" placeholder="provider:model" value={key} onChange={(e) => setKey(e.target.value)} />
                    <button type="button" className="btn btn-sm" disabled={!key.trim() || draft.pictures.some((r) => r.key === key.trim())}
                        onClick={() => { set([...draft.pictures, { key: key.trim(), price: '' }]); setKey('') }}><Plus size={14} /> Add picture model</button>
                </div>
            </div>
        </section>
    )
}
