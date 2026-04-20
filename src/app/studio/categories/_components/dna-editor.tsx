'use client'
/**
 * DnaEditor — form to edit Category DNA fields.
 * Sends PATCH /api/admin/categories/[id]/dna on save.
 * Restyled to bundle .dna-* classes.
 */
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { DnaBlockListField } from './dna-block-list-field'
import type { CategoryDNA } from '@/lib/admin/dna-compliance'

// Personality options with swatch colors matching bundle
const PERSONALITY_OPTIONS = [
    { value: 'warm-traditional',  label: 'Warm Traditional',  hex: '#D97706', desc: 'Classic, trustworthy, heritage feel' },
    { value: 'warm-homestyle',    label: 'Warm Homestyle',    hex: '#F59E0B', desc: 'Cozy, approachable, family-friendly' },
    { value: 'bold-dark',         label: 'Bold Dark',         hex: '#1E293B', desc: 'Strong, premium, dramatic contrast' },
    { value: 'soft-feminine',     label: 'Soft Feminine',     hex: '#F9A8D4', desc: 'Gentle, elegant, pastel tones' },
    { value: 'calm-wellness',     label: 'Calm Wellness',     hex: '#6EE7B7', desc: 'Clean, serene, health-focused' },
    { value: 'modern-vibrant',    label: 'Modern Vibrant',    hex: '#60A5FA', desc: 'Bold colors, energetic, digital-native' },
    { value: 'editorial-clean',   label: 'Editorial Clean',   hex: '#94A3B8', desc: 'Minimal, typographic, editorial' },
    { value: 'luxury-travel',     label: 'Luxury Travel',     hex: '#A78BFA', desc: 'Aspirational, refined, escapism' },
    { value: 'playful-kids',      label: 'Playful Kids',      hex: '#FCD34D', desc: 'Fun, bright, child-friendly' },
] as const

type Props = {
    categoryId: string
    categoryName: string
    initialDna?: CategoryDNA
    onSaved: (dna: CategoryDNA) => void
}

function tagsToText(arr: string[] | undefined): string {
    return (arr ?? []).join(', ')
}

function textToTags(text: string): string[] {
    return text.split(',').map((s) => s.trim()).filter(Boolean)
}

export function DnaEditor({ categoryId, categoryName, initialDna, onSaved }: Props) {
    const [form, setForm] = useState({
        signatureBlocks:    tagsToText(initialDna?.signatureBlocks),
        recommendedBlocks:  tagsToText(initialDna?.recommendedBlocks),
        mandatoryOrder:     tagsToText(initialDna?.mandatoryOrder),
        forbiddenBlocks:    tagsToText(initialDna?.forbiddenBlocks),
        typicalPersonalities: initialDna?.typicalPersonalities ?? ([] as string[]),
        minSections: initialDna?.minSections ?? 5,
        aiPromptHint: initialDna?.aiPromptHint ?? '',
    })
    const [saving, setSaving] = useState(false)

    const set = useCallback(<K extends keyof typeof form>(key: K, val: (typeof form)[K]) => {
        setForm((prev) => ({ ...prev, [key]: val }))
    }, [])

    const togglePersonality = (value: string) => {
        setForm((prev) => {
            const has = prev.typicalPersonalities.includes(value)
            return {
                ...prev,
                typicalPersonalities: has
                    ? prev.typicalPersonalities.filter((p) => p !== value)
                    : [...prev.typicalPersonalities, value],
            }
        })
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const dna: CategoryDNA = {
                signatureBlocks:      textToTags(form.signatureBlocks),
                recommendedBlocks:    textToTags(form.recommendedBlocks),
                mandatoryOrder:       textToTags(form.mandatoryOrder),
                forbiddenBlocks:      textToTags(form.forbiddenBlocks),
                typicalPersonalities: form.typicalPersonalities as CategoryDNA['typicalPersonalities'],
                minSections:          Number(form.minSections),
                aiPromptHint:         form.aiPromptHint.trim() || undefined,
            }

            const res = await fetch(`/api/admin/categories/${categoryId}/dna`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dna),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }))
                throw new Error((err as { error?: string }).error ?? 'Save failed')
            }

            toast.success(`DNA saved for "${categoryName}"`)
            onSaved(dna)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    const mandatoryChips = form.mandatoryOrder.split(',').map((s) => s.trim()).filter(Boolean)

    return (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* AI prompt hint */}
            {(form.aiPromptHint || true) && (
                <div className="dna-field-group">
                    <div className="dna-prompt-label">AI prompt hint</div>
                    <textarea
                        className="dna-textarea"
                        value={form.aiPromptHint}
                        onChange={(e) => set('aiPromptHint', e.target.value)}
                        placeholder="Tone guidance for AI generation (1-2 sentences)…"
                        rows={3}
                        maxLength={500}
                    />
                    <span className="dna-char-count">{form.aiPromptHint.length}/500</span>
                </div>
            )}

            {/* Signature blocks */}
            <DnaBlockListField
                label="Signature blocks"
                labelPrefix="★"
                hint="bắt buộc — AI sẽ tự điền nếu user quên"
                value={form.signatureBlocks}
                onChange={(v) => set('signatureBlocks', v)}
            />

            {/* Mandatory order */}
            <div className="dna-field-group">
                <div className="dna-section-label">
                    <span>→</span>
                    <span>Mandatory order</span>
                    <span className="dna-section-hint">blocks must appear in this sequence</span>
                </div>
                <input
                    type="text"
                    className="dna-field-input"
                    value={form.mandatoryOrder}
                    onChange={(e) => set('mandatoryOrder', e.target.value)}
                    placeholder="navigation, hero, cta (comma-separated, ordered)"
                />
                {/* Render as sequence with arrows */}
                {mandatoryChips.length > 0 && (
                    <div className="dna-order-row">
                        {mandatoryChips.map((b, i) => (
                            <span key={b + i} style={{ display: 'contents' }}>
                                <div className="dna-order-item">
                                    <span className="dna-order-idx">{i + 1}</span>
                                    {b}
                                </div>
                                {i < mandatoryChips.length - 1 && (
                                    <span className="dna-order-arrow">›</span>
                                )}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Recommended blocks */}
            <DnaBlockListField
                label="Recommended"
                labelPrefix="+"
                hint="Encouraged but not required"
                value={form.recommendedBlocks}
                onChange={(v) => set('recommendedBlocks', v)}
            />

            {/* Forbidden blocks */}
            <DnaBlockListField
                label="Forbidden"
                labelPrefix="⊘"
                hint="Must NOT appear in this category"
                value={form.forbiddenBlocks}
                chipVariant="forbidden"
                onChange={(v) => set('forbiddenBlocks', v)}
            />

            {/* Min sections */}
            <div className="dna-field-group">
                <div className="dna-form-label">Minimum sections</div>
                <input
                    type="number"
                    className="dna-number-input"
                    min={1}
                    max={20}
                    value={form.minSections}
                    onChange={(e) => set('minSections', Number(e.target.value))}
                />
            </div>

            {/* Typical personalities */}
            <div className="dna-field-group">
                <div className="dna-section-label">
                    <span>Typical personalities</span>
                    <span className="dna-section-hint">Vibes thường gặp trong ngành này</span>
                </div>
                <div className="dna-personality-grid" style={{ padding: 0 }}>
                    {PERSONALITY_OPTIONS.map((p) => {
                        const active = form.typicalPersonalities.includes(p.value)
                        return (
                            <button
                                key={p.value}
                                type="button"
                                onClick={() => togglePersonality(p.value)}
                                className={`dna-personality-card${active ? ' selected' : ''}`}
                            >
                                <div className="dna-personality-head">
                                    <span
                                        className="dna-personality-swatch"
                                        style={{ background: p.hex }}
                                    />
                                    <span className="dna-personality-name">{p.label}</span>
                                </div>
                                <div className="dna-personality-desc">{p.desc}</div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Save */}
            <div className="dna-save-row">
                <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? 'Saving…' : 'Save DNA'}
                </button>
            </div>
        </div>
    )
}
