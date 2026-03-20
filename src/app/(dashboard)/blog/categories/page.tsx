'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
    ArrowLeft, Plus, Pencil, Trash2, X, Check, Loader2,
    Tag, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

type Category = {
    id: string
    name: string
    slug: string
    createdAt: string
}

export default function BlogCategoriesPage() {
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
            const json = await res.json()
            setCategories(json.data || [])
        } catch {
            toast.error('Failed to load categories')
        } finally {
            setLoading(false)
        }
    }, [])

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
            if (!res.ok) throw new Error(json.error?.details || 'Failed to create')
            toast.success(`Category "${newName.trim()}" created`)
            setNewName('')
            setShowCreateInput(false)
            fetchCategories()
        } catch (err: any) {
            toast.error(err.message || 'Failed to create category')
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
            if (!res.ok) throw new Error(json.error?.details || 'Failed to update')
            toast.success('Category updated')
            setEditingId(null)
            fetchCategories()
        } catch (err: any) {
            toast.error(err.message || 'Failed to update category')
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
            if (!res.ok) throw new Error('Failed to delete')
            toast.success(`Category "${deleteTarget.name}" deleted`)
            setDeleteTarget(null)
            fetchCategories()
        } catch {
            toast.error('Failed to delete category')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <Link
                        href="/blog"
                        className="flex-shrink-0 rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <h1 className="text-xl font-bold text-white">Blog Categories</h1>
                </div>

                <button
                    onClick={() => setShowCreateInput(true)}
                    className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 hover:bg-cyan-500 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Add Category
                </button>
            </div>

            {/* Create Input */}
            {showCreateInput && (
                <div className="rounded-xl border border-cyan-500/20 bg-[#1E293B]/30 p-4">
                    <p className="text-xs font-medium text-gray-400 mb-2">New Category</p>
                    <div className="flex gap-2">
                        <input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            placeholder="e.g. Marketing Tips"
                            autoFocus
                            className="flex-1 rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={!newName.trim() || isCreating}
                            className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
                        >
                            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Save
                        </button>
                        <button
                            onClick={() => { setShowCreateInput(false); setNewName('') }}
                            className="rounded-lg p-2.5 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Loading skeleton */}
            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#1E293B]/30 px-5 py-4 animate-pulse">
                            <div className="h-4 w-32 rounded bg-white/5" />
                            <div className="h-4 w-20 rounded bg-white/5" />
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {!loading && categories.length === 0 && !showCreateInput && (
                <div className="py-16 text-center">
                    <Tag className="mx-auto h-10 w-10 text-gray-600 mb-4" />
                    <p className="text-sm text-gray-400 mb-1">No categories yet</p>
                    <p className="text-xs text-gray-600 mb-6">Create categories to organise your blog posts</p>
                    <button
                        onClick={() => setShowCreateInput(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 hover:bg-cyan-500 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Create your first category
                    </button>
                </div>
            )}

            {/* Categories list */}
            {!loading && categories.length > 0 && (
                <div className="space-y-2">
                    {categories.map(cat => (
                        <div
                            key={cat.id}
                            className="group flex items-center justify-between rounded-lg border border-white/10 bg-[#1E293B]/30 px-5 py-3.5 hover:border-white/15 transition-colors"
                        >
                            {editingId === cat.id ? (
                                // Inline edit mode
                                <div className="flex flex-1 gap-2">
                                    <input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleUpdate()
                                            if (e.key === 'Escape') setEditingId(null)
                                        }}
                                        autoFocus
                                        className="flex-1 rounded-lg border border-cyan-500/30 bg-[#0B1120] px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                                    />
                                    <button
                                        onClick={handleUpdate}
                                        disabled={!editName.trim() || isUpdating}
                                        className="rounded-lg p-1.5 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50 transition-colors"
                                    >
                                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    </button>
                                    <button
                                        onClick={() => setEditingId(null)}
                                        className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                // Display mode
                                <>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Tag className="h-4 w-4 text-gray-600 flex-shrink-0" />
                                        <span className="text-sm font-medium text-white truncate">{cat.name}</span>
                                        <span className="text-xs text-gray-600 hidden sm:inline">/{cat.slug}</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => startEditing(cat)}
                                            className="rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-white transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteTarget(cat)}
                                            className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1120] p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                                Delete Category
                            </h3>
                            <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 mb-2">
                            Are you sure you want to delete <span className="text-white font-medium">&quot;{deleteTarget.name}&quot;</span>?
                        </p>
                        <p className="text-xs text-gray-600 mb-5">
                            Posts assigned to this category will become uncategorized.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {isDeleting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                                ) : (
                                    <><Trash2 className="w-4 h-4" /> Delete</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
