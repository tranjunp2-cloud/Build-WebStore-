'use client'
/**
 * Publish template confirm modal.
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
    onPublished: () => void
}

export function PublishTemplateModal({ template, onClose, onPublished }: Props) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleConfirm = async () => {
        setLoading(true)
        setError(null)
        try {
            await patchTemplate(template.id, { status: 'live' })
            onPublished()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Publish failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open onOpenChange={open => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Publish template</DialogTitle>
                    <DialogDescription>
                        <span className="font-medium text-foreground">{template.name}</span> will become visible
                        to all users in the Template Gallery.
                    </DialogDescription>
                </DialogHeader>
                {error && <p className="text-sm text-destructive py-1">{error}</p>}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={loading}>
                        {loading ? 'Publishing…' : 'Publish now'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
