'use client'
/**
 * Create template 2-step wizard — matches bundle CreateModal design.
 * Step 1: source selector + name + category + description
 * Step 2: tags + personality + previewUrl
 * Footer: Back / step indicator / Next → Create draft
 */
import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { createTemplate, CATEGORY_OPTIONS, PERSONALITY_OPTIONS } from '@/lib/admin/templates-query'

type Props = {
    onClose: () => void
    onCreated: () => void
}

type Step1 = { source: 'scratch' | 'clone' | 'upload'; name: string; category: string; description: string }
type Step2 = { tags: string; personality: string; previewUrl: string }

const SOURCE_OPTIONS = [
    { id: 'scratch' as const, label: 'From scratch', sub: 'Blank project' },
    { id: 'clone'   as const, label: 'Clone',        sub: 'From existing' },
    { id: 'upload'  as const, label: 'Upload ZIP',   sub: 'Import build' },
]

export function CreateTemplateModal({ onClose, onCreated }: Props) {
    const [step, setStep]   = useState<1 | 2>(1)
    const [step1, setStep1] = useState<Step1>({
        source: 'scratch',
        name: '',
        category: CATEGORY_OPTIONS[0]?.value ?? 'restaurant',
        description: '',
    })
    const [step2, setStep2] = useState<Step2>({ tags: '', personality: '', previewUrl: '' })
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState<string | null>(null)

    const canNext = step1.name.trim().length > 0

    const handleSubmit = async () => {
        setLoading(true)
        setError(null)
        try {
            const tagList = step2.tags
                .split(',')
                .map(t => t.trim())
                .filter(Boolean)
                .map(t => ({ tag: t }))
            await createTemplate({
                name:        step1.name.trim(),
                description: step1.description.trim() || undefined,
                category:    [step1.category],
                status:      'draft',
                personality: step2.personality || undefined,
                previewUrl:  step2.previewUrl.trim() || undefined,
                tags:        tagList,
            })
            onCreated()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Create failed')
            setLoading(false)
        }
    }

    return (
        <>
            <div className="modal-scrim" onClick={onClose} />
            <div className="modal" style={{ width: 560 }}>
                {/* Head */}
                <div className="modal-head">
                    <span className="modal-title">New Template</span>
                    {/* Step indicator */}
                    <div className="stepper" style={{ marginLeft: 'auto', marginRight: 8 }}>
                        <span className={`step${step >= 1 ? (step > 1 ? ' done' : ' active') : ''}`}>
                            {step > 1 ? <Check size={10} /> : '1'}
                        </span>
                        <span style={{ width: 20, height: 1, background: 'var(--border)' }} />
                        <span className={`step${step === 2 ? ' active' : ''}`}>2</span>
                    </div>
                    <span className="muted" style={{ fontSize: 12 }}>Step {step} / 2</span>
                    <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button>
                </div>

                {/* Body — Step 1 */}
                {step === 1 && (
                    <div className="modal-body">
                        <div className="field">
                            <label>Source</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                {SOURCE_OPTIONS.map(o => (
                                    <div
                                        key={o.id}
                                        className={`source-card${step1.source === o.id ? ' active' : ''}`}
                                        onClick={() => setStep1(s => ({ ...s, source: o.id }))}
                                    >
                                        <div className="source-label">{o.label}</div>
                                        <div className="source-sub">{o.sub}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="field">
                            <label>
                                Template name <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <input
                                className="input"
                                placeholder="e.g. Romantic Restaurant"
                                value={step1.name}
                                onChange={e => setStep1(s => ({ ...s, name: e.target.value }))}
                                autoFocus
                            />
                        </div>

                        <div className="field-row">
                            <div className="field" style={{ marginBottom: 0 }}>
                                <label>Category</label>
                                <select
                                    className="select input"
                                    value={step1.category}
                                    onChange={e => setStep1(s => ({ ...s, category: e.target.value }))}
                                >
                                    {CATEGORY_OPTIONS.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="field" style={{ marginBottom: 0 }}>
                                <label>Personality</label>
                                <select
                                    className="select input"
                                    value={step2.personality}
                                    onChange={e => setStep2(s => ({ ...s, personality: e.target.value }))}
                                >
                                    <option value="">— None —</option>
                                    {PERSONALITY_OPTIONS.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="field" style={{ marginTop: 14 }}>
                            <label>Description</label>
                            <textarea
                                className="input"
                                placeholder="Suitable for… Best used when…"
                                value={step1.description}
                                onChange={e => setStep1(s => ({ ...s, description: e.target.value }))}
                            />
                        </div>
                    </div>
                )}

                {/* Body — Step 2 */}
                {step === 2 && (
                    <div className="modal-body">
                        <div className="field">
                            <label>Thumbnail</label>
                            <div className="ph" style={{ aspectRatio: '16/10', maxWidth: 360 }}>
                                <span>
                                    Upload image 1200×750
                                    <small>drag &amp; drop or click</small>
                                </span>
                            </div>
                        </div>

                        <div className="field">
                            <label>Tags</label>
                            <input
                                className="input"
                                placeholder="food, cafe, warm (comma-separated)"
                                value={step2.tags}
                                onChange={e => setStep2(s => ({ ...s, tags: e.target.value }))}
                            />
                            <div className="hint">Separate tags with commas.</div>
                        </div>

                        <div className="field">
                            <label>
                                AI prompt keywords{' '}
                                <span className="muted" style={{ fontWeight: 400 }}>· used for AI Search in Gallery</span>
                            </label>
                            <textarea
                                className="input"
                                placeholder={'e.g. "romantic restaurant", "cozy cafe"'}
                                value={step2.previewUrl}
                                onChange={e => setStep2(s => ({ ...s, previewUrl: e.target.value }))}
                            />
                            <div className="hint">One prompt per line. AI matches when user types nearby keywords.</div>
                        </div>

                        {error && (
                            <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 8px' }}>{error}</p>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="modal-foot">
                    {step === 2 && (
                        <button className="btn" onClick={() => setStep(1)} disabled={loading}>
                            Back
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    {step === 1 && (
                        <button
                            className="btn btn-primary"
                            disabled={!canNext}
                            onClick={() => setStep(2)}
                        >
                            Next
                        </button>
                    )}
                    {step === 2 && (
                        <button
                            className="btn btn-primary"
                            disabled={loading}
                            onClick={() => void handleSubmit()}
                        >
                            <Check size={13} />
                            {loading ? 'Creating…' : 'Create draft'}
                        </button>
                    )}
                </div>
            </div>
        </>
    )
}
