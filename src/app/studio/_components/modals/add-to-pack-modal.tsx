'use client'
/**
 * AddToPackModal — pick a content pack and append this template to it.
 * Restyled to match bundle design tokens (modal pattern).
 * GET /api/admin/packs → list packs, PATCH /api/admin/packs/[id] with merged includedTemplates.
 */
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

type PackOption = {
    id: string
    name: string
    includedTemplates?: Array<{ id: string | number }> | null
}

type Props = {
    templateId: string
    templateName: string
    onClose: () => void
    onAdded: () => void
}

export function AddToPackModal({ templateId, templateName, onClose, onAdded }: Props) {
    const [packs, setPacks] = useState<PackOption[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPack, setSelectedPack] = useState<string>('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/admin/packs?limit=100')
            .then((r) => r.json())
            .then((d) => setPacks(d.data ?? []))
            .catch(() => setPacks([]))
            .finally(() => setLoading(false))
    }, [])

    const handleAdd = async () => {
        if (!selectedPack) return
        setSaving(true)
        setError(null)

        const pack = packs.find((p) => p.id === selectedPack)
        if (!pack) {
            setError('Pack not found')
            setSaving(false)
            return
        }

        // Merge existing templates with the new one (deduplicate)
        const existing = (pack.includedTemplates ?? []).map((t) => String(t.id))
        const merged = Array.from(new Set([...existing, templateId]))

        try {
            const res = await fetch(`/api/admin/packs/${selectedPack}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ includedTemplates: merged }),
            })
            if (!res.ok) {
                const d = await res.json().catch(() => ({}))
                throw new Error(d.error ?? 'Add failed')
            }
            toast.success(`Added to pack`)
            onAdded()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Add failed')
            setSaving(false)
        }
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Add to Pack</DialogTitle>
                </DialogHeader>

                <div className="modal-body">
                    <p className="modal-hint">
                        Add <span className="modal-hint-em">{templateName}</span> to a content pack.
                    </p>

                    {loading ? (
                        <Skeleton className="h-9 w-full" />
                    ) : packs.length === 0 ? (
                        <p className="modal-hint">
                            No packs found. Create one in{' '}
                            <Link href="/studio/packs" className="modal-link">Content Packs</Link>.
                        </p>
                    ) : (
                        <select
                            value={selectedPack}
                            onChange={(e) => setSelectedPack(e.target.value)}
                            className="select"
                        >
                            <option value="">— Select a pack —</option>
                            {packs.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    )}

                    {error && <p className="modal-error">{error}</p>}

                    <div className="modal-actions">
                        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleAdd}
                            disabled={saving || !selectedPack || loading}
                        >
                            {saving ? 'Adding…' : 'Add to Pack'}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
