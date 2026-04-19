'use client'
/**
 * Archive template confirm modal — warns this removes it from the gallery.
 */
import { useState } from 'react'
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { patchTemplate } from '@/lib/admin/templates-query'
import type { AdminTemplate } from '@/lib/admin/templates-query'

type Props = {
    template: AdminTemplate
    onClose: () => void
    onArchived: () => void
}

export function ArchiveTemplateModal({ template, onClose, onArchived }: Props) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleConfirm = async () => {
        setLoading(true)
        setError(null)
        try {
            await patchTemplate(template.id, { status: 'archived' })
            onArchived()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Archive failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open onOpenChange={open => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Archive template</DialogTitle>
                    <DialogDescription>
                        <span className="font-medium text-foreground">{template.name}</span> will be removed from
                        the Template Gallery and hidden from users. You can restore it later.
                    </DialogDescription>
                </DialogHeader>
                {error && <p className="text-sm text-destructive py-1">{error}</p>}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={loading}
                    >
                        {loading ? 'Archiving…' : 'Archive template'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
