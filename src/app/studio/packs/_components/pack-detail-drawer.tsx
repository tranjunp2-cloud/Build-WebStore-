'use client'
/**
 * PackDetailDrawer — slide-over with tabs: Overview / Templates / Edit.
 * Restyled to match bundle page-packs.jsx design tokens.
 */
import { useState } from 'react'
import { X, Trash2, Layers, ImageOff } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useStudioCan } from '../../_components/studio-permissions-context'
import type { PackDoc } from '../page'

type Props = {
    pack: PackDoc
    onClose: () => void
    onUpdated: (pack: PackDoc) => void
    onDeleted: () => void
}

export function PackDetailDrawer({ pack, onClose, onUpdated, onDeleted }: Props) {
    const can = useStudioCan()
    const canEditPack = can('pack.edit')
    const canDeletePack = can('pack.delete')
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
        <div className="pk-drawer">
            {/* Header */}
            <div className="pk-drawer-hd">
                <h2 className="pk-drawer-title">{pack.name}</h2>
                <button onClick={onClose} className="pk-drawer-close" aria-label="Close">
                    <X size={15} />
                </button>
            </div>

            <Tabs defaultValue="overview" className="pk-drawer-tabs">
                <TabsList className="pk-drawer-tablist">
                    {['overview', 'templates', ...(canEditPack || canDeletePack ? ['edit'] : [])].map((t) => (
                        <TabsTrigger key={t} value={t} className="pk-drawer-tab">
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* Overview tab */}
                <TabsContent value="overview" className="pk-drawer-body">
                    <div className="pk-drawer-thumb">
                        {pack.coverImage?.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pack.coverImage.url} alt={pack.name} className="pk-drawer-thumb-img" />
                        ) : (
                            <ImageOff size={24} className="pk-drawer-thumb-icon" />
                        )}
                    </div>
                    {pack.description && <p className="pk-drawer-desc">{pack.description}</p>}
                    <dl className="pk-drawer-dl">
                        <div>
                            <dt className="pk-drawer-dt">Category</dt>
                            <dd className="pk-drawer-dd">{pack.category ?? '—'}</dd>
                        </div>
                        <div>
                            <dt className="pk-drawer-dt">Personality</dt>
                            <dd className="pk-drawer-dd">{pack.personality ?? '—'}</dd>
                        </div>
                        <div>
                            <dt className="pk-drawer-dt">Templates</dt>
                            <dd className="pk-drawer-dd pk-drawer-dd-row">
                                <Layers size={12} /> {templates.length}
                            </dd>
                        </div>
                        <div>
                            <dt className="pk-drawer-dt">Created</dt>
                            <dd className="pk-drawer-dd">{new Date(pack.createdAt).toLocaleDateString('vi-VN')}</dd>
                        </div>
                    </dl>
                </TabsContent>

                {/* Templates tab */}
                <TabsContent value="templates" className="pk-drawer-body">
                    {templates.length === 0 ? (
                        <p className="pk-drawer-empty">No templates in this pack.</p>
                    ) : (
                        <ul className="pk-drawer-tmpl-list">
                            {templates.map((t) => (
                                <li key={t.id} className="pk-drawer-tmpl-row">
                                    <Layers size={12} className="pk-drawer-tmpl-icon" />
                                    <span className="pk-drawer-tmpl-name">{t.name}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </TabsContent>

                {/* Edit tab */}
                <TabsContent value="edit" className="pk-drawer-body pk-drawer-body-edit">
                    <div className="pk-drawer-field">
                        <Label htmlFor="edit-name">Name</Label>
                        <Input id="edit-name" value={editName} readOnly={!canEditPack} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="pk-drawer-field">
                        <Label htmlFor="edit-desc">Description</Label>
                        <Textarea id="edit-desc" value={editDesc} readOnly={!canEditPack} onChange={(e) => setEditDesc(e.target.value)} rows={4} />
                    </div>
                    <div className="pk-drawer-edit-actions">
                        {canEditPack && (
                            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !editName.trim()}>
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        )}
                        {canDeletePack && (
                            <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                                <Trash2 size={13} />
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
