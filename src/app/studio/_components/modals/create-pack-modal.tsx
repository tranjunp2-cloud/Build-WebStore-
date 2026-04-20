'use client'
/**
 * CreatePackModal — form to create a new content pack.
 * Restyled to match bundle design tokens (modal/card pattern).
 * Submits POST /api/admin/packs.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const CATEGORY_OPTIONS = [
    { value: 'restaurant', label: 'Restaurant / Cafe / F&B' },
    { value: 'ecommerce',  label: 'Shop / Fashion / E-commerce' },
    { value: 'beauty',     label: 'Beauty / Spa / Wellness' },
    { value: 'tech',       label: 'Tech / IT / SaaS' },
    { value: 'health',     label: 'Health / Dental / Clinic' },
    { value: 'education',  label: 'Education / Training' },
    { value: 'realestate', label: 'Real Estate / Property' },
    { value: 'fitness',    label: 'Gym / Fitness / Yoga' },
    { value: 'creative',   label: 'Portfolio / Freelancer / Agency' },
    { value: 'business',   label: 'Business / Corporate' },
    { value: 'fnb',        label: 'F&B / Cafe / Bakery' },
    { value: 'events',     label: 'Events / Wedding' },
    { value: 'blog',       label: 'Blog / Media / Magazine' },
    { value: 'travel',     label: 'Travel / Tourism' },
]

const PERSONALITY_OPTIONS = [
    { value: 'warm-traditional', label: 'Warm Traditional' },
    { value: 'warm-homestyle',   label: 'Warm Homestyle' },
    { value: 'bold-dark',        label: 'Bold Dark' },
    { value: 'soft-feminine',    label: 'Soft Feminine' },
    { value: 'calm-wellness',    label: 'Calm Wellness' },
    { value: 'modern-vibrant',   label: 'Modern Vibrant' },
    { value: 'editorial-clean',  label: 'Editorial Clean' },
    { value: 'luxury-travel',    label: 'Luxury Travel' },
    { value: 'playful-kids',     label: 'Playful Kids' },
]

type Props = { onClose: () => void; onCreated: () => void }

export function CreatePackModal({ onClose, onCreated }: Props) {
    const [form, setForm] = useState({ name: '', description: '', category: '', personality: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const set = <K extends keyof typeof form>(key: K, val: string) =>
        setForm((prev) => ({ ...prev, [key]: val }))

    const handleSubmit = async () => {
        if (!form.name.trim()) return
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/packs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    description: form.description.trim() || undefined,
                    category: form.category || undefined,
                    personality: form.personality || undefined,
                }),
            })
            if (!res.ok) {
                const d = await res.json().catch(() => ({}))
                throw new Error(d.error ?? 'Create failed')
            }
            toast.success('Content pack created')
            onCreated()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Create failed')
            setLoading(false)
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>New Content Pack</DialogTitle>
                </DialogHeader>

                <div className="modal-body">
                    <div className="modal-field">
                        <Label htmlFor="cp-name">
                            Name <span className="modal-required">*</span>
                        </Label>
                        <Input
                            id="cp-name"
                            value={form.name}
                            onChange={(e) => set('name', e.target.value)}
                            placeholder="e.g. Restaurant Starter Kit"
                            autoFocus
                        />
                    </div>

                    <div className="modal-field">
                        <Label htmlFor="cp-desc">Description</Label>
                        <Textarea
                            id="cp-desc"
                            value={form.description}
                            onChange={(e) => set('description', e.target.value)}
                            placeholder="Describe what this pack is for…"
                            rows={3}
                        />
                    </div>

                    <div className="modal-field">
                        <Label htmlFor="cp-cat">Category</Label>
                        <select
                            id="cp-cat"
                            value={form.category}
                            onChange={(e) => set('category', e.target.value)}
                            className="select"
                        >
                            <option value="">— None —</option>
                            {CATEGORY_OPTIONS.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="modal-field">
                        <Label htmlFor="cp-personality">Personality</Label>
                        <select
                            id="cp-personality"
                            value={form.personality}
                            onChange={(e) => set('personality', e.target.value)}
                            className="select"
                        >
                            <option value="">— None —</option>
                            {PERSONALITY_OPTIONS.map((p) => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>

                    {error && <p className="modal-error">{error}</p>}

                    <div className="modal-actions">
                        <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleSubmit}
                            disabled={loading || !form.name.trim()}
                        >
                            {loading ? 'Creating…' : 'Create Pack'}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
