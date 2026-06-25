'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    Plus, Pencil, Trash2, X, Check, Loader2,
    AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { deleteBlogCategoryAction, getCategoryPublishedPostCountAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmModal } from '@/components/ui/confirm-modal'

type Category = {
    id: string
    name: string
    slug: string
    createdAt: string
}

export default function BlogCategoriesPage() {
    const router = useRouter()
    const { t } = useI18n()
    const cp = t.dashboard.blog.categoryPage
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)

    // Inline create state
    const [newName, setNewName] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [showCreateInput, setShowCreateInput] = useState(false)

    // Inline edit state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)

    // Delete modal state
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; publishedCount: number } | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [fetchingDeleteId, setFetchingDeleteId] = useState<string | null>(null)

    const fetchCategories = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/blog-categories', { credentials: 'include', cache: 'no-store' })
            if (!res.ok) throw new Error('fetch failed')
            const json = await res.json()
            setCategories(json.data || [])
        } catch {
            toast.error(cp.toastLoadFail)
        } finally {
            setLoading(false)
        }
    }, [cp.toastLoadFail])

    useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    const handleCreate = async () => {
        if (!newName.trim()) return
        setIsCreating(true)
        try {
            const res = await fetch('/api/blog-categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: newName.trim() }),
            })
            const json = await res.json()
            if (!res.ok) {
                toast.error(cp.toastCreateFail)
                return
            }
            toast.success(cp.toastCreated.replace('{name}', newName.trim()))
            setNewName('')
            setShowCreateInput(false)
            fetchCategories()
        } catch {
            toast.error(cp.toastCreateFail)
        } finally {
            setIsCreating(false)
        }
    }

    const startEditing = (cat: Category) => {
        setEditingId(cat.id)
        setEditName(cat.name)
    }

    const handleUpdate = async () => {
        if (!editingId || !editName.trim()) return
        setIsUpdating(true)
        try {
            const res = await fetch(`/api/blog-categories/${editingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: editName.trim() }),
            })
            const json = await res.json()
            if (!res.ok) {
                toast.error(cp.toastUpdateFail)
                return
            }
            toast.success(cp.toastUpdated)
            setEditingId(null)
            fetchCategories()
        } catch {
            toast.error(cp.toastUpdateFail)
        } finally {
            setIsUpdating(false)
        }
    }

    const openDeleteModal = async (cat: Category) => {
        setFetchingDeleteId(cat.id)
        try {
            const publishedCount = await getCategoryPublishedPostCountAction(cat.id)
            setDeleteTarget({ id: cat.id, name: cat.name, publishedCount })
        } catch {
            setDeleteTarget({ id: cat.id, name: cat.name, publishedCount: 0 })
        } finally {
            setFetchingDeleteId(null)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            const res = await deleteBlogCategoryAction(deleteTarget.id)
            if (res.error) {
                toast.error(cp.toastDeleteFail)
                return
            }
            toast.success(cp.toastDeleted.replace('{name}', deleteTarget.name))
            setCategories(prev => prev.filter(c => c.id !== deleteTarget.id))
            setDeleteTarget(null)
        } catch {
            toast.error(cp.toastDeleteFail)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="w-full h-full flex flex-col items-center pt-[64px]">
            <div className="flex flex-col p-[1px] w-full max-w-[768px] bg-[var(--dash-surface)] border-[1px] border-[var(--dash-border)] rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">
                {/* Header (31611:5304) */}
                <div className="flex flex-row justify-between items-center w-full px-[24px] py-[12px] border-b-[1px] border-b-[var(--dash-border)]">
                    <span className="font-['Inter'] font-[700] text-[20px] leading-[1.4em] text-[var(--dash-text)]">{cp.title}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/blog')}
                    >
                        <X className="w-[20px] h-[20px]" />
                    </Button>
                </div>

                {/* Body (31611:5322) */}
                <div className="flex flex-col w-full px-[24px] py-[24px] gap-[24px]">
                    <div className="flex flex-col w-full gap-[12px]">
                        {/* Title Row */}
                        <div className="flex flex-row justify-between items-center h-[20px] w-full">
                            <span className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[var(--dash-text)]">{cp.existingTitle}</span>
                            <span className="font-['Inter'] font-[400] text-[12px] leading-[1.6666666666666667em] text-[var(--dash-text-muted)]">{cp.itemsCount.replace('{count}', String(categories.length))}</span>
                        </div>

                        {/* List Frame (31611:5417) */}
                        <div className="flex flex-col w-full space-y-[-1px]">
                            {loading ? (
                                <div className="flex flex-col p-[12px] gap-[12px] border-[1px] border-[var(--dash-border)] rounded-[12px] animate-pulse h-[52px]">
                                    <div className="w-[100px] h-[16px] bg-[var(--dash-surface-hover)] rounded-[4px] mt-[4px]"></div>
                                </div>
                            ) : categories.length === 0 ? (
                                <div className="flex flex-col p-[12px] gap-[12px] border-[1px] border-[var(--dash-border)] rounded-[12px] items-center justify-center py-[24px]">
                                    <span className="text-[var(--dash-text-muted)] text-[14px]">{cp.noCategories}</span>
                                </div>
                            ) : (
                                categories.map((cat, index) => {
                                    const isFirst = index === 0
                                    const isLast = index === categories.length - 1
                                    const roundedClass = categories.length === 1 ? 'rounded-[12px]' : isFirst ? 'rounded-t-[12px]' : isLast ? 'rounded-b-[12px]' : ''

                                    return (
                                        <div
                                            key={cat.id}
                                            className={`flex flex-col p-[12px] gap-[12px] border-[1px] border-[var(--dash-border)] hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors group ${roundedClass}`}
                                        >
                                            {editingId === cat.id ? (
                                                <div className="flex flex-row items-center gap-[12px] overflow-hidden">
                                                    <Input
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleUpdate()
                                                            if (e.key === 'Escape') setEditingId(null)
                                                        }}
                                                        autoFocus
                                                        className="flex-1 min-w-0 h-[26px] text-[12px] rounded-[12px]"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={handleUpdate}
                                                        disabled={!editName.trim() || isUpdating}
                                                        className="shrink-0 text-primary"
                                                    >
                                                        {isUpdating ? <Loader2 className="w-[14px] h-[14px] animate-spin" /> : <Check className="w-[14px] h-[14px]" />}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setEditingId(null)}
                                                        className="shrink-0 text-muted-foreground"
                                                    >
                                                        <X className="w-[14px] h-[14px]" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-row items-center justify-between">
                                                    <div className="flex flex-row items-center px-[12px] py-[4px] min-w-0 bg-[var(--dash-secondary-bg)] border-[1px] border-[var(--dash-border)] rounded-[12px] w-fit">
                                                        <span className="font-['Inter'] font-[500] text-[12px] leading-[1.3333333333333333em] text-[var(--dash-text)] truncate">{cat.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-[8px] xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => startEditing(cat)}
                                                            className="text-muted-foreground hover:text-foreground"
                                                        >
                                                            <Pencil className="w-[14px] h-[14px]" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openDeleteModal(cat)}
                                                            disabled={fetchingDeleteId === cat.id}
                                                            className="text-muted-foreground hover:text-destructive"
                                                        >
                                                            {fetchingDeleteId === cat.id
                                                                ? <Loader2 className="w-[14px] h-[14px] animate-spin" />
                                                                : <Trash2 className="w-[14px] h-[14px]" />
                                                            }
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Add new Category */}
                    {showCreateInput ? (
                        <div className="flex flex-row items-center gap-[12px] w-full mt-[8px] overflow-hidden">
                            <Plus className="w-[24px] h-[24px] shrink-0 text-muted-foreground" strokeWidth={1.5} />
                            <Input
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                autoFocus
                                placeholder={cp.namePlaceholder}
                                className="flex-1 min-w-0 bg-transparent border-0 border-b border-border rounded-none shadow-none focus-visible:ring-0 focus-visible:border-border pb-[4px]"
                            />
                            <div className="flex shrink-0 gap-[4px]">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleCreate}
                                    disabled={!newName.trim() || isCreating}
                                    className="text-primary"
                                >
                                    {isCreating ? <Loader2 className="w-[16px] h-[16px] animate-spin" /> : <Check className="w-[16px] h-[16px]" />}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setShowCreateInput(false); setNewName('') }}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-[16px] h-[16px]" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setShowCreateInput(true)}
                            className="flex flex-row items-center w-full gap-[6px] justify-start hover:opacity-80"
                        >
                            <Plus className="w-[24px] h-[24px]" strokeWidth={1.5} />
                            <span className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[var(--dash-text)]">{cp.addNew}</span>
                        </Button>
                    )}
                </div>

                {/* Footer (31611:5388) */}
                <div className="flex flex-row justify-end items-center w-full pr-[24px] border-t-[1px] border-t-[var(--dash-border)]">
                    <Button
                        type="button"
                        variant="dashSecondary"
                        size="dash"
                        onClick={() => router.push('/blog')}
                        className="my-3"
                    >
                        {cp.close}
                    </Button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                open={!!deleteTarget}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title={cp.deleteTitle}
                description={
                    deleteTarget ? (
                        <span>
                            {cp.deleteConfirm.replace('{name}', deleteTarget.name)}
                            {deleteTarget.publishedCount > 0 && (
                                <span className="flex items-start gap-2 mt-3 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
                                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                                    <span className="text-xs text-warning">
                                        {cp.deletePublishedWarning.replace('{count}', String(deleteTarget.publishedCount))}
                                    </span>
                                </span>
                            )}
                            <span className="block mt-2 text-xs text-muted-foreground">{cp.deleteWarning}</span>
                        </span>
                    ) : undefined
                }
                confirmLabel={cp.delete}
                cancelLabel={cp.cancel}
                variant="danger"
                loading={isDeleting}
            />
        </div>
    )
}
