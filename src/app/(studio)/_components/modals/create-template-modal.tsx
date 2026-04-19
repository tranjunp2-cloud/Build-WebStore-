'use client'
/**
 * Create template 2-step wizard.
 * Step 1: source + name + category + description
 * Step 2: tags + personality + previewUrl
 * Submits on step 2 confirm → POST /api/admin/templates → status=draft
 */
import { useState } from 'react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createTemplate, CATEGORY_OPTIONS, PERSONALITY_OPTIONS } from '@/lib/admin/templates-query'

type Props = {
    onClose: () => void
    onCreated: () => void
}

type Step1 = {
    source: 'scratch' | 'clone' | 'upload'
    name: string
    category: string
    description: string
}

type Step2 = {
    tags: string
    personality: string
    previewUrl: string
}

const SOURCE_OPTIONS = [
    { id: 'scratch' as const, label: 'From scratch', sub: 'Blank project' },
    { id: 'clone' as const, label: 'Clone existing', sub: 'Fork a template' },
    { id: 'upload' as const, label: 'Upload ZIP', sub: 'Import build' },
]

export function CreateTemplateModal({ onClose, onCreated }: Props) {
    const [step, setStep] = useState<1 | 2>(1)
    const [step1, setStep1] = useState<Step1>({
        source: 'scratch',
        name: '',
        category: CATEGORY_OPTIONS[0]?.value ?? 'restaurant',
        description: '',
    })
    const [step2, setStep2] = useState<Step2>({
        tags: '',
        personality: '',
        previewUrl: '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const canGoNext = step1.name.trim().length > 0 && step1.category

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
                name: step1.name.trim(),
                description: step1.description.trim() || undefined,
                category: [step1.category],
                status: 'draft',
                personality: step2.personality || undefined,
                previewUrl: step2.previewUrl.trim() || undefined,
                tags: tagList,
            })
            onCreated()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Create failed')
            setLoading(false)
        }
    }

    return (
        <Dialog open onOpenChange={open => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>New template</DialogTitle>
                        <span className="text-xs text-muted-foreground">Step {step} / 2</span>
                    </div>
                </DialogHeader>

                {step === 1 && (
                    <div className="space-y-4 py-2">
                        {/* Source selector */}
                        <div className="space-y-1.5">
                            <Label>Source</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {SOURCE_OPTIONS.map(o => (
                                    <button
                                        key={o.id}
                                        type="button"
                                        onClick={() => setStep1(s => ({ ...s, source: o.id }))}
                                        className={`rounded-md border p-3 text-left transition-colors ${
                                            step1.source === o.id
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-foreground/30'
                                        }`}
                                    >
                                        <p className="text-sm font-semibold">{o.label}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{o.sub}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Name */}
                        <div className="space-y-1.5">
                            <Label htmlFor="ct-name">
                                Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="ct-name"
                                value={step1.name}
                                onChange={e => setStep1(s => ({ ...s, name: e.target.value }))}
                                placeholder="e.g. Romantic Restaurant"
                                autoFocus
                            />
                        </div>

                        {/* Category */}
                        <div className="space-y-1.5">
                            <Label htmlFor="ct-cat">Category</Label>
                            <select
                                id="ct-cat"
                                value={step1.category}
                                onChange={e => setStep1(s => ({ ...s, category: e.target.value }))}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                {CATEGORY_OPTIONS.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <Label htmlFor="ct-desc">Description</Label>
                            <Textarea
                                id="ct-desc"
                                value={step1.description}
                                onChange={e => setStep1(s => ({ ...s, description: e.target.value }))}
                                placeholder="Suitable for… Best used when…"
                                rows={3}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" type="button" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="button" disabled={!canGoNext} onClick={() => setStep(2)}>
                                Next
                            </Button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 py-2">
                        {/* Tags */}
                        <div className="space-y-1.5">
                            <Label htmlFor="ct-tags">Tags</Label>
                            <Input
                                id="ct-tags"
                                value={step2.tags}
                                onChange={e => setStep2(s => ({ ...s, tags: e.target.value }))}
                                placeholder="food, cafe, warm (comma-separated)"
                            />
                            <p className="text-xs text-muted-foreground">Separate tags with commas</p>
                        </div>

                        {/* Personality */}
                        <div className="space-y-1.5">
                            <Label htmlFor="ct-personality">Personality</Label>
                            <select
                                id="ct-personality"
                                value={step2.personality}
                                onChange={e => setStep2(s => ({ ...s, personality: e.target.value }))}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <option value="">— None —</option>
                                {PERSONALITY_OPTIONS.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Preview URL */}
                        <div className="space-y-1.5">
                            <Label htmlFor="ct-preview">Preview URL</Label>
                            <Input
                                id="ct-preview"
                                type="url"
                                value={step2.previewUrl}
                                onChange={e => setStep2(s => ({ ...s, previewUrl: e.target.value }))}
                                placeholder="https://…"
                            />
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <div className="flex justify-between gap-2 pt-2">
                            <Button variant="outline" type="button" onClick={() => setStep(1)} disabled={loading}>
                                Back
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
                                    Cancel
                                </Button>
                                <Button type="button" onClick={handleSubmit} disabled={loading}>
                                    {loading ? 'Creating…' : 'Create draft'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
