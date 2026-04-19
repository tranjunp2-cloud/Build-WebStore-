'use client'
/**
 * Clone template modal — confirm + optional rename.
 */
import { useState } from 'react'
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cloneTemplate } from '@/lib/admin/templates-query'
import type { AdminTemplate } from '@/lib/admin/templates-query'

type Props = {
    template: AdminTemplate
    onClose: () => void
    onCloned: () => void
}

export function CloneTemplateModal({ template, onClose, onCloned }: Props) {
    const [name, setName] = useState(`${template.name} (copy)`)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            await cloneTemplate(template.id, name.trim() || undefined)
            onCloned()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Clone failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open onOpenChange={open => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Clone template</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="clone-name">New template name</Label>
                        <Input
                            id="clone-name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Template name"
                            autoFocus
                        />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Cloning <span className="font-medium">{template.name}</span>. The copy will be saved as a draft.
                    </p>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || !name.trim()}>
                            {loading ? 'Cloning…' : 'Clone template'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
