'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    Plus, Pencil, Trash2, X, Check, Loader2,
    AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'

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
    const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const fetchCategories = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/blog-categories', { credentials: 'include' })
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
            if (!res.ok) throw new Error(json.error?.details || cp.toastCreateFail)
            toast.success(cp.toastCreated.replace('{name}', newName.trim()))
            setNewName('')
            setShowCreateInput(false)
            fetchCategories()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : cp.toastCreateFail
            toast.error(msg)
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
            if (!res.ok) throw new Error(json.error?.details || cp.toastUpdateFail)
            toast.success(cp.toastUpdated)
            setEditingId(null)
            fetchCategories()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : cp.toastUpdateFail
            toast.error(msg)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/blog-categories/${deleteTarget.id}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            if (!res.ok) throw new Error(cp.toastDeleteFail)
            toast.success(cp.toastDeleted.replace('{name}', deleteTarget.name))
            setDeleteTarget(null)
            fetchCategories()
        } catch {
            toast.error(cp.toastDeleteFail)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="w-full h-full flex flex-col items-center pt-[64px]">
            <div className="flex flex-col p-[1px] w-full max-w-[768px] bg-[#1E293B] border-[1px] border-[rgba(255,255,255,0.08)] rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">
                {/* Header (31611:5304) */}
                <div className="flex flex-row justify-between items-center w-full px-[24px] py-[12px] border-b-[1px] border-b-[rgba(255,255,255,0.08)]">
                    <span className="font-['Inter'] font-[700] text-[20px] leading-[1.4em] text-[#F8FAFC]">{cp.title}</span>
                    <button
                        onClick={() => router.push('/blog')}
                        className="flex flex-col items-center justify-center pt-[8px] px-[8px] w-[36px] h-[36px] rounded-[12px] hover:bg-white/5 transition-colors"
                    >
                        <X className="w-[20px] h-[20px] text-[#F8FAFC]" />
                    </button>
                </div>

                {/* Body (31611:5322) */}
                <div className="flex flex-col w-full px-[24px] py-[24px] gap-[24px]">
                    <div className="flex flex-col w-full gap-[12px]">
                        {/* Title Row */}
                        <div className="flex flex-row justify-between items-center h-[20px] w-full">
                            <span className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[#F8FAFC]">{cp.existingTitle}</span>
                            <span className="font-['Inter'] font-[400] text-[12px] leading-[1.6666666666666667em] text-[#F8FAFC]">{cp.itemsCount.replace('{count}', String(categories.length))}</span>
                        </div>

                        {/* List Frame (31611:5417) */}
                        <div className="flex flex-col w-full space-y-[-1px]">
                            {loading ? (
                                <div className="flex flex-col p-[12px] gap-[12px] border-[1px] border-[#374151] rounded-[12px] animate-pulse h-[52px]">
                                    <div className="w-[100px] h-[16px] bg-white/10 rounded-[4px] mt-[4px]"></div>
                                </div>
                            ) : categories.length === 0 ? (
                                <div className="flex flex-col p-[12px] gap-[12px] border-[1px] border-[#374151] rounded-[12px] items-center justify-center py-[24px]">
                                    <span className="text-[#9F9FA9] text-[14px]">{cp.noCategories}</span>
                                </div>
                            ) : (
                                categories.map((cat, index) => {
                                    const isFirst = index === 0
                                    const isLast = index === categories.length - 1
                                    const roundedClass = categories.length === 1 ? 'rounded-[12px]' : isFirst ? 'rounded-t-[12px]' : isLast ? 'rounded-b-[12px]' : ''

                                    return (
                                        <div
                                            key={cat.id}
                                            className={`flex flex-col p-[12px] gap-[12px] border-[1px] border-[#374151] hover:bg-white/5 transition-colors group ${roundedClass}`}
                                        >
                                            {editingId === cat.id ? (
                                                <div className="flex flex-row items-center gap-[12px]">
                                                    <input
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleUpdate()
                                                            if (e.key === 'Escape') setEditingId(null)
                                                        }}
                                                        autoFocus
                                                        className="flex-1 px-[12px] py-[4px] h-[26px] bg-[rgba(255,255,255,0.1)] border-[1px] border-[rgba(255,255,255,0.3)] rounded-[12px] font-['Inter'] font-[500] text-[12px] text-[#FFFFFF] outline-none"
                                                    />
                                                    <button onClick={handleUpdate} disabled={!editName.trim() || isUpdating} className="text-cyan-400 p-[4px] hover:bg-white/10 rounded">
                                                        {isUpdating ? <Loader2 className="w-[14px] h-[14px] animate-spin" /> : <Check className="w-[14px] h-[14px]" />}
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="text-[#9F9FA9] p-[4px] hover:bg-white/10 rounded">
                                                        <X className="w-[14px] h-[14px]" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-row items-center justify-between">
                                                    <div className="flex flex-row items-center px-[12px] py-[4px] min-w-0 bg-[rgba(255,255,255,0.1)] border-[1px] border-[rgba(255,255,255,0.3)] rounded-[12px] w-fit">
                                                        <span className="font-['Inter'] font-[500] text-[12px] leading-[1.3333333333333333em] text-[#FFFFFF] truncate">{cat.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-[8px] xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => startEditing(cat)}
                                                            className="text-[#9F9FA9] hover:text-white p-[4px]"
                                                        >
                                                            <Pencil className="w-[14px] h-[14px]" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteTarget(cat)}
                                                            className="text-[#9F9FA9] hover:text-red-400 p-[4px]"
                                                        >
                                                            <Trash2 className="w-[14px] h-[14px]" />
                                                        </button>
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
                        <div className="flex flex-row items-center gap-[12px] w-full mt-[8px]">
                            <Plus className="w-[24px] h-[24px] text-white opacity-50" strokeWidth={1.5} />
                            <input
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                autoFocus
                                placeholder={cp.namePlaceholder}
                                className="flex-1 bg-transparent font-['Inter'] font-[600] text-[14px] text-[#FFFFFF] outline-none placeholder-[#9F9FA9] border-b-[1px] border-b-[rgba(255,255,255,0.2)] pb-[4px]"
                            />
                            <div className="flex gap-[4px]">
                                <button onClick={handleCreate} disabled={!newName.trim() || isCreating} className="p-[4px] text-cyan-400 hover:bg-white/10 rounded">
                                    {isCreating ? <Loader2 className="w-[16px] h-[16px] animate-spin" /> : <Check className="w-[16px] h-[16px]" />}
                                </button>
                                <button onClick={() => { setShowCreateInput(false); setNewName('') }} className="p-[4px] text-[#9F9FA9] hover:bg-white/10 rounded hover:text-white">
                                    <X className="w-[16px] h-[16px]" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowCreateInput(true)}
                            className="flex flex-row items-center w-full gap-[6px] hover:opacity-80 transition-opacity"
                        >
                            <Plus className="w-[24px] h-[24px] text-white" strokeWidth={1.5} />
                            <span className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[#FFFFFF]">{cp.addNew}</span>
                        </button>
                    )}
                </div>

                {/* Footer (31611:5388) */}
                <div className="flex flex-row justify-end items-center w-full pr-[24px] border-t-[1px] border-t-[rgba(255,255,255,0.08)]">
                    <button
                        onClick={() => router.push('/blog')}
                        className="flex flex-row justify-center items-center px-[16px] py-[8px] h-[48px] bg-[#0B1120] border-[1px] border-[rgba(255,255,255,0.08)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] transition-colors hover:bg-white/5"
                    >
                        <span className="font-['Inter'] font-[500] text-[14px] leading-[1.4285714285714286em] text-[#FAFAFA]">{cp.close}</span>
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-[16px] border border-white/10 bg-[#0B1120] p-[24px] shadow-2xl">
                        <div className="flex items-center justify-between mb-[16px]">
                            <h3 className="text-[18px] font-bold text-white flex items-center gap-[8px]">
                                <AlertTriangle className="w-[20px] h-[20px] text-red-500" />
                                {cp.deleteTitle}
                            </h3>
                            <button onClick={() => setDeleteTarget(null)} className="text-[#9F9FA9] hover:text-white transition-colors">
                                <X className="w-[20px] h-[20px]" />
                            </button>
                        </div>
                        <p className="text-[14px] text-gray-400 mb-[8px]">
                            {cp.deleteConfirm} <span className="text-white font-bold">&quot;{deleteTarget.name}&quot;</span>?
                        </p>
                        <p className="text-[13px] text-gray-500 mb-[24px]">
                            {cp.deleteWarning}
                        </p>
                        <div className="flex justify-end gap-[12px]">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-[16px] py-[10px] rounded-[8px] text-[14px] font-medium text-[#9F9FA9] hover:text-white hover:bg-white/5 transition-colors"
                            >
                                {cp.cancel}
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex items-center gap-[8px] rounded-[8px] bg-red-600 px-[16px] py-[10px] text-[14px] font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {isDeleting ? (
                                    <><Loader2 className="w-[16px] h-[16px] animate-spin" /> {cp.deleting}</>
                                ) : (
                                    <><Trash2 className="w-[16px] h-[16px]" /> {cp.delete}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
