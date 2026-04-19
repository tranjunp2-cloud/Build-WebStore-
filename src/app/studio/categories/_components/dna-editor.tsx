'use client'
/**
 * DnaEditor — form to edit Category DNA fields.
 * Sends PATCH /api/admin/categories/[id]/dna on save.
 * Split responsibility: this file handles form state + save logic.
 * Block picker chips and drag-list are inlined (< 200 LOC total).
 */
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DnaBlockListField } from './dna-block-list-field'
import type { CategoryDNA } from '@/lib/admin/dna-compliance'

const PERSONALITY_OPTIONS = [
    { value: 'warm-traditional', label: 'Warm Traditional' },
    { value: 'warm-homestyle', label: 'Warm Homestyle' },
    { value: 'bold-dark', label: 'Bold Dark' },
    { value: 'soft-feminine', label: 'Soft Feminine' },
    { value: 'calm-wellness', label: 'Calm Wellness' },
    { value: 'modern-vibrant', label: 'Modern Vibrant' },
    { value: 'editorial-clean', label: 'Editorial Clean' },
    { value: 'luxury-travel', label: 'Luxury Travel' },
    { value: 'playful-kids', label: 'Playful Kids' },
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
    return text.split(',').map(s => s.trim()).filter(Boolean)
}

export function DnaEditor({ categoryId, categoryName, initialDna, onSaved }: Props) {
    const [form, setForm] = useState({
        signatureBlocks: tagsToText(initialDna?.signatureBlocks),
        recommendedBlocks: tagsToText(initialDna?.recommendedBlocks),
        mandatoryOrder: tagsToText(initialDna?.mandatoryOrder),
        forbiddenBlocks: tagsToText(initialDna?.forbiddenBlocks),
        typicalPersonalities: initialDna?.typicalPersonalities ?? [] as string[],
        minSections: initialDna?.minSections ?? 5,
        aiPromptHint: initialDna?.aiPromptHint ?? '',
    })
    const [saving, setSaving] = useState(false)

    const set = useCallback(<K extends keyof typeof form>(key: K, val: typeof form[K]) => {
        setForm(prev => ({ ...prev, [key]: val }))
    }, [])

    const togglePersonality = (value: string) => {
        setForm(prev => {
            const has = prev.typicalPersonalities.includes(value)
            return {
                ...prev,
                typicalPersonalities: has
                    ? prev.typicalPersonalities.filter(p => p !== value)
                    : [...prev.typicalPersonalities, value],
            }
        })
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const dna: CategoryDNA = {
                signatureBlocks: textToTags(form.signatureBlocks),
                recommendedBlocks: textToTags(form.recommendedBlocks),
                mandatoryOrder: textToTags(form.mandatoryOrder),
                forbiddenBlocks: textToTags(form.forbiddenBlocks),
                typicalPersonalities: form.typicalPersonalities as CategoryDNA['typicalPersonalities'],
                minSections: Number(form.minSections),
                aiPromptHint: form.aiPromptHint.trim() || undefined,
            }

            const res = await fetch(`/api/admin/categories/${categoryId}/dna`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dna),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }))
                throw new Error(err.error ?? 'Save failed')
            }

            toast.success(`DNA saved for "${categoryName}"`)
            onSaved(dna)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="p-6 space-y-6 max-w-2xl">
            <DnaBlockListField
                label="Signature Blocks"
                hint="Required blocks for templates in this category."
                value={form.signatureBlocks}
                onChange={v => set('signatureBlocks', v)}
            />
            <DnaBlockListField
                label="Recommended Blocks"
                hint="Encouraged but not required."
                value={form.recommendedBlocks}
                onChange={v => set('recommendedBlocks', v)}
            />
            <DnaBlockListField
                label="Mandatory Order"
                hint="Blocks that must appear in this sequence (left to right = top to bottom)."
                value={form.mandatoryOrder}
                onChange={v => set('mandatoryOrder', v)}
            />
            <DnaBlockListField
                label="Forbidden Blocks"
                hint="Blocks that must NOT appear in this category."
                value={form.forbiddenBlocks}
                onChange={v => set('forbiddenBlocks', v)}
            />

            {/* Personality multi-select */}
            <div className="space-y-1.5">
                <Label>Typical Personalities</Label>
                <div className="flex flex-wrap gap-2">
                    {PERSONALITY_OPTIONS.map(p => {
                        const active = form.typicalPersonalities.includes(p.value)
                        return (
                            <button
                                key={p.value}
                                type="button"
                                onClick={() => togglePersonality(p.value)}
                                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                                    active
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'border-border hover:border-foreground/40'
                                }`}
                            >
                                {p.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Min sections */}
            <div className="space-y-1.5">
                <Label htmlFor="min-sections">Minimum Sections</Label>
                <Input
                    id="min-sections"
                    type="number"
                    min={1}
                    max={20}
                    value={form.minSections}
                    onChange={e => set('minSections', Number(e.target.value))}
                    className="w-24"
                />
            </div>

            {/* AI prompt hint */}
            <div className="space-y-1.5">
                <Label htmlFor="ai-hint">AI Prompt Hint</Label>
                <Textarea
                    id="ai-hint"
                    value={form.aiPromptHint}
                    onChange={e => set('aiPromptHint', e.target.value)}
                    placeholder="Tone guidance for AI generation (1-2 sentences)…"
                    rows={3}
                    maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                    {form.aiPromptHint.length}/500 chars
                </p>
            </div>

            <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save DNA'}
            </Button>
        </div>
    )
}
