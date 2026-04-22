'use client'

/**
 * variant-edit-modal.tsx
 * Modal for editing variant metadata: displayName, previewUrlOverride, notes.
 * Scope: metadata ONLY — no code editing, no demo content editing.
 * Phase H: wired via pencil icon in variant-gallery.tsx.
 */
import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type SavedPatch = {
    displayName?: string | null
    notes?: string | null
    previewUrlOverride?: string | null
}

type Props = {
    open: boolean
    onClose: () => void
    blockSlug: string
    variantName: string
    initial: {
        displayName?: string | null
        notes?: string | null
        previewUrlOverride?: string | null
    }
    onSaved: (patch: SavedPatch) => void
}

export function VariantEditModal({
    open,
    onClose,
    blockSlug,
    variantName,
    initial,
    onSaved,
}: Props) {
    const [displayName, setDisplayName] = useState(initial.displayName ?? '')
    const [notes, setNotes] = useState(initial.notes ?? '')
    const [previewUrl, setPreviewUrl] = useState(initial.previewUrlOverride ?? '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Reset form fields whenever modal opens with new initial values
    useEffect(() => {
        if (open) {
            setDisplayName(initial.displayName ?? '')
            setNotes(initial.notes ?? '')
            setPreviewUrl(initial.previewUrlOverride ?? '')
            setError(null)
        }
    }, [open, initial])

    async function handleSave() {
        setSaving(true)
        setError(null)
        try {
            const res = await fetch(
                `/api/admin/blocks/${blockSlug}/variants/${variantName}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        // Empty string → null (don't store empty strings)
                        displayName: displayName.trim() || null,
                        notes: notes.trim() || null,
                        previewUrlOverride: previewUrl.trim() || null,
                    }),
                }
            )
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error((data as { error?: string }).error ?? `Failed (${res.status})`)
            }
            onSaved({
                displayName: displayName.trim() || null,
                notes: notes.trim() || null,
                previewUrlOverride: previewUrl.trim() || null,
            })
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        Edit variant: {blockSlug}/{variantName}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1">
                        <Label htmlFor="ve-displayName">Display name</Label>
                        <Input
                            id="ve-displayName"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder={variantName}
                            maxLength={100}
                        />
                        <p className="text-xs text-muted-foreground">
                            Human-friendly label. Falls back to variant key if empty.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="ve-previewUrl">Preview image URL (optional)</Label>
                        <Input
                            id="ve-previewUrl"
                            type="url"
                            value={previewUrl}
                            onChange={(e) => setPreviewUrl(e.target.value)}
                            placeholder="https://..."
                            maxLength={2048}
                        />
                        <p className="text-xs text-muted-foreground">
                            Overrides SSR iframe preview with a static image.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="ve-notes">Internal notes</Label>
                        <Textarea
                            id="ve-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            maxLength={2000}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
