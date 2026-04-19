'use client'
/**
 * PackDetailDrawer — slide-over with tabs: Overview / Templates / Edit.
 */
import { useState } from 'react'
import { X, Trash2, Layers, ImageOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { PackDoc } from '../page'

type Props = {
    pack: PackDoc
    onClose: () => void
    onUpdated: (pack: PackDoc) => void
    onDeleted: () => void
}

export function PackDetailDrawer({ pack, onClose, onUpdated, onDeleted }: Props) {
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [editName, setEditName] = useState(pack.name)
    const [editDesc, setEditDesc] = useState(pack.description ?? '')

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/packs/${pack.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || undefined }),
            })
            if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed')
            const d = await res.json()
            toast.success('Pack updated')
            onUpdated({ ...pack, ...d.data, name: editName, description: editDesc })
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm(`Delete pack "${pack.name}"? This cannot be undone.`)) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/packs/${pack.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error((await res.json()).error ?? 'Delete failed')
            toast.success('Pack deleted')
            onDeleted()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Delete failed')
            setDeleting(false)
        }
    }

    const templates = pack.includedTemplates ?? []

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-background border-l shadow-xl flex flex-col z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <h2 className="font-semibold text-sm truncate">{pack.name}</h2>
                <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
                    <X size={16} />
                </button>
            </div>

            <Tabs defaultValue="overview" className="flex flex-col flex-1 min-h-0">
                <TabsList className="mx-4 mt-3 h-8 justify-start gap-1 bg-transparent p-0 border-b rounded-none">
                    {['overview', 'templates', 'edit'].map(t => (
                        <TabsTrigger
                            key={t}
                            value={t}
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-2 pb-2 text-xs capitalize"
                        >
                            {t}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* Overview tab */}
                <TabsContent value="overview" className="flex-1 overflow-auto p-4 mt-0 space-y-3">
                    <div className="aspect-[4/3] bg-muted rounded flex items-center justify-center">
                        {pack.coverImage?.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pack.coverImage.url} alt={pack.name} className="w-full h-full object-cover rounded" />
                        ) : (
                            <ImageOff size={24} className="text-muted-foreground opacity-40" />
                        )}
                    </div>
                    {pack.description && <p className="text-sm">{pack.description}</p>}
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <dt className="text-xs text-muted-foreground">Category</dt>
                            <dd>{pack.category ?? '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Personality</dt>
                            <dd>{pack.personality ?? '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Templates</dt>
                            <dd className="flex items-center gap-1"><Layers size={12} /> {templates.length}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Created</dt>
                            <dd>{new Date(pack.createdAt).toLocaleDateString()}</dd>
                        </div>
                    </dl>
                </TabsContent>

                {/* Templates tab */}
                <TabsContent value="templates" className="flex-1 overflow-auto p-4 mt-0">
                    {templates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No templates in this pack.</p>
                    ) : (
                        <ul className="space-y-1">
                            {templates.map(t => (
                                <li key={t.id} className="flex items-center gap-2 text-sm py-1.5 border-b last:border-0">
                                    <Layers size={12} className="text-muted-foreground flex-shrink-0" />
                                    <span className="truncate">{t.name}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </TabsContent>

                {/* Edit tab */}
                <TabsContent value="edit" className="flex-1 overflow-auto p-4 mt-0 space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-name">Name</Label>
                        <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-desc">Description</Label>
                        <Textarea id="edit-desc" value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} />
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleSave} disabled={saving || !editName.trim()}>
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                            <Trash2 size={13} className="mr-1" />
                            {deleting ? 'Deleting…' : 'Delete'}
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
