'use client'

import { Plus } from 'lucide-react'
import type { ChainKey, Draft } from '@/lib/admin/ai-settings/draft'
import styles from '../ai-settings.module.css'

const CHAINS: Array<{ key: ChainKey; name: string; hint: string }> = [
    { key: 'fast', name: 'Fast', hint: 'Chat replies, translate, summaries' },
    { key: 'balanced', name: 'Balanced', hint: 'Product descriptions, migration mapping' },
    { key: 'quality', name: 'Quality', hint: 'Site plan, page blocks' },
    { key: 'image', name: 'Image', hint: 'Pictures' },
]

interface Props {
    draft: Draft
    errors: Map<string, string>
    updatedAt: string | null
    onChange: (key: ChainKey, models: string[]) => void
}

/** Options = models that have a price (picture prices for the image chain), plus whatever the chain already holds. */
export function ChainsSection({ draft, errors, updatedAt, onChange }: Props) {
    const textModels = draft.prices.filter((row) => row.input.trim() && row.output.trim()).map((row) => row.key)
    const imageModels = draft.pictures.map((row) => row.key)
    return (
        <section className="aiq-card">
            <div className="aiq-card-head">
                <div>
                    <div className="aiq-card-title">Model chains</div>
                    <div className="aiq-card-sub">
                        First model answers; the next one is used if it fails.{updatedAt ? ` Last changed ${new Date(updatedAt).toLocaleString('en-GB')}.` : ''}
                    </div>
                </div>
            </div>
            {CHAINS.map(({ key, name, hint }) => {
                const chain = draft.chains[key]
                const options = (key === 'image' ? imageModels : textModels)
                const error = errors.get(`config|models|${key}`)
                return (
                    <div className={styles.chain} key={key}>
                        <div>
                            <b>{name}</b>
                            <p className={`${styles.small} ${styles.dim}`}>{hint}</p>
                            {error && <p className={styles.err}>{error}</p>}
                        </div>
                        <div className={styles.chainList}>
                            {chain.map((model, i) => (
                                <span key={`${model}-${i}`} className={styles.chainList}>
                                    {i > 0 && <span className={styles.dim} aria-hidden="true">→</span>}
                                    <select
                                        className={styles.select} aria-label={`${name} model ${i + 1}`} value={model}
                                        onChange={(e) => onChange(key, chain.map((m, j) => (j === i ? e.target.value : m)))}
                                    >
                                        {[...new Set([...options, model])].map((option) => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                    <button type="button" className={styles.btnIcon} aria-label={`Remove ${model} from ${name}`}
                                        onClick={() => onChange(key, chain.filter((_, j) => j !== i))}>×</button>
                                </span>
                            ))}
                            <button
                                type="button" className="btn btn-sm btn-ghost"
                                disabled={options.every((option) => chain.includes(option))}
                                onClick={() => onChange(key, [...chain, options.find((option) => !chain.includes(option)) ?? ''])}
                            >
                                <Plus size={14} /> {chain.length ? 'Add fallback' : 'Add model'}
                            </button>
                        </div>
                    </div>
                )
            })}
        </section>
    )
}
