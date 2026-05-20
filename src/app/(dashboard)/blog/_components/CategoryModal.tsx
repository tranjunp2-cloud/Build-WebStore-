'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Plus, Minus, Pencil, Trash2, X, Check, Loader2,
    Tag, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

// Assume actions are exported from your server actions file
import {
    getBlogCategoriesAction,
    createBlogCategoryAction,
    updateBlogCategoryAction,
    deleteBlogCategoryAction,
    getCategoryPublishedPostCountAction,
} from '../actions'
import { useI18n } from '@/i18n'

type Category = {
    id: string
    name: string
    slug: string
    createdAt: string
}

type CategoryModalProps = {
    onClose: () => void;
    onCategoryUpdated?: () => void; // Optional callback to refresh parent
}

export function CategoryModal({ onClose, onCategoryUpdated }: CategoryModalProps) {
    const { t } = useI18n()
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)

    // Create state
    const [showCreateInput, setShowCreateInput] = useState(false)
    const [newName, setNewName] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)

    // Delete state
    const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
    const [deletePublishedCount, setDeletePublishedCount] = useState(0)
    const [isDeleting, setIsDeleting] = useState(false)
    const [fetchingDeleteId, setFetchingDeleteId] = useState<string | null>(null)

    const fetchCategories = useCallback(async () => {
        try {
            setLoading(true)
            const result = await getBlogCategoriesAction()
            if (result) {
                setCategories(result)
            }
        } catch {
            toast.error(t.dashboard.blog.categoryModal.toastLoadFail)
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
            const res = await createBlogCategoryAction({ name: newName.trim() })
            if (res?.error) {
                toast.error(t.dashboard.blog.categoryModal.toastCreateFail)
                return
            }
            toast.success(t.dashboard.blog.categoryModal.toastCreateSuccess)
            setNewName('')
            setShowCreateInput(false)
            fetchCategories()
            onCategoryUpdated?.()
        } catch {
            toast.error(t.dashboard.blog.categoryModal.toastCreateFail)
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
            const res = await updateBlogCategoryAction(editingId, { name: editName.trim() })
            if (res?.error) {
                toast.error(t.dashboard.blog.categoryModal.toastUpdateFail)
                return
            }
            toast.success(t.dashboard.blog.categoryModal.toastUpdateSuccess)
            setEditingId(null)
            fetchCategories()
            onCategoryUpdated?.()
        } catch {
            toast.error(t.dashboard.blog.categoryModal.toastUpdateFail)
        } finally {
            setIsUpdating(false)
        }
    }

    const openDeleteModal = async (cat: Category) => {
        setFetchingDeleteId(cat.id)
        try {
            const count = await getCategoryPublishedPostCountAction(cat.id)
            setDeletePublishedCount(count)
            setDeleteTarget(cat)
        } catch {
            setDeletePublishedCount(0)
            setDeleteTarget(cat)
        } finally {
            setFetchingDeleteId(null)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)
        try {
            const res = await deleteBlogCategoryAction(deleteTarget.id)
            if (res?.error) {
                toast.error(t.dashboard.blog.categoryModal.toastDeleteFail)
                return
            }
            toast.success(t.dashboard.blog.categoryModal.toastDeleteSuccess.replace('{name}', deleteTarget.name))
            setDeleteTarget(null)
            setDeletePublishedCount(0)
            fetchCategories()
            onCategoryUpdated?.()
        } catch {
            toast.error(t.dashboard.blog.categoryModal.toastDeleteFail)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="fixed inset-0 w-screen h-screen z-[999] flex flex-col items-end xl:items-center justify-end xl:justify-center border-0 bg-[var(--dash-overlay)] backdrop-blur-sm xl:p-4 animate-in fade-in duration-200">
            <div className="flex flex-col p-[1px] w-full xl:w-[768px] max-h-[90vh] items-start bg-[var(--dash-surface)] border-[1px] border-solid border-[var(--dash-border)] rounded-t-[16px] xl:rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] relative overflow-hidden animate-in slide-in-from-bottom xl:slide-in-from-bottom-0 duration-300">
                {/* Mobile drag handle */}
                <div className="flex xl:hidden items-start justify-center pt-[12px] w-full shrink-0">
                    <div className="bg-[rgba(255,255,255,0.2)] h-[4px] rounded-[9999px] shrink-0 w-[48px]" />
                </div>
                {/* Header (31611:5304) */}
                <div className="flex flex-row justify-between items-center w-full px-[24px] py-[12px]" style={{ borderBottom: '1px solid var(--dash-border)' }}>
                    <span className="font-['Inter'] font-[700] text-[20px] leading-[1.4em] text-[var(--dash-text)]">{t.dashboard.blog.categoryModal.title}</span>
                    <button
                        onClick={(e) => { e.preventDefault(); onClose(); }}
                        className="flex flex-col items-center justify-center pt-[8px] px-[8px] pb-[0px] w-[36px] h-[36px] rounded-[12px] hover:bg-white/5 transition-colors"
                    >
                        <X className="w-[20px] h-[20px] text-[var(--dash-text-muted)]" strokeWidth={1.666} />
                    </button>
                </div>

                {/* Body (31611:5322) */}
                <div className="flex flex-col w-full px-[24px] py-[24px] gap-[24px] overflow-y-auto flex-1">
                    <div className="flex flex-col w-full gap-[12px]">
                        {/* Title Row (31611:5328) */}
                        <div className="flex flex-row justify-between items-center w-full h-[20px] shrink-0">
                            <span className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[var(--dash-text)]">{t.dashboard.blog.categoryModal.existingTitle}</span>
                            <span className="font-['Inter'] font-[400] text-[12px] leading-[1.6666666666666667em] text-[var(--dash-text-muted)]">{t.dashboard.blog.categoryModal.itemsCount.replace('{count}', categories.length.toString())}</span>
                        </div>

                        {/* List Frame (31611:5417) */}
                        <div className="flex flex-col w-full -space-y-[1px] overflow-y-auto overflow-x-hidden nice-scrollbar pr-[2px]" style={{ maxHeight: '286px' }}>
                            {loading ? (
                                <div className="flex flex-col p-[12px] border-[1px] border-solid border-[var(--dash-border)] rounded-[12px] animate-pulse h-[52px]">
                                    <div className="w-[100px] h-[16px] rounded-[4px] mt-[4px]" style={{ backgroundColor: 'var(--dash-border)' }}></div>
                                </div>
                            ) : categories.length === 0 ? (
                                <div className="flex flex-col p-[12px] border-[1px] border-solid border-[var(--dash-border)] rounded-[12px] items-center justify-center py-[24px]">
                                    <span className="text-[var(--dash-text-muted)] text-[14px]">{t.dashboard.blog.categoryModal.noCategories}</span>
                                </div>
                            ) : (
                                categories.map((cat, index) => {
                                    const isFirst = index === 0
                                    const isLast = index === categories.length - 1
                                    const roundedClass = categories.length === 1 ? 'rounded-[12px]' : isFirst ? 'rounded-t-[12px]' : isLast ? 'rounded-b-[12px]' : ''

                                    return editingId === cat.id ? (
                                        <div
                                            key={cat.id}
                                            className={`flex flex-row items-center justify-between p-[12px] border-[1px] border-solid border-[var(--dash-border)] bg-[var(--dash-surface-hover)] gap-[12px] ${roundedClass}`}
                                            style={{ boxSizing: 'border-box' }}
                                        >
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                                                autoFocus
                                                disabled={isUpdating}
                                                className="flex-1 h-[48px] bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-[8px] px-[12px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] outline-none text-[var(--dash-text)] font-['Inter'] font-[400] text-[14px] leading-[1.4285714285714286em] disabled:opacity-50"
                                            />
                                            <div className="flex flex-row items-center gap-[24px]">
                                                <button
                                                    onClick={(e) => { e.preventDefault(); handleUpdate(); }}
                                                    disabled={isUpdating || !editName.trim()}
                                                    className="flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
                                                >
                                                    {isUpdating ? <Loader2 className="w-[24px] h-[24px] text-[#10B981] animate-spin" /> : <Check className="w-[24px] h-[24px] text-[#10B981]" strokeWidth={2} />}
                                                </button>
                                                <button
                                                    onClick={(e) => { e.preventDefault(); setEditingId(null); setEditName(''); }}
                                                    disabled={isUpdating}
                                                    className="flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50"
                                                >
                                                    <X className="w-[24px] h-[24px] text-[#EF4444]" strokeWidth={2} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            key={cat.id}
                                            className={`group flex flex-row items-center justify-between p-[12px] border-[1px] border-solid border-[var(--dash-border)] bg-transparent hover:bg-[var(--dash-surface-hover)] transition-colors ${roundedClass}`}
                                            style={{ boxSizing: 'border-box' }}
                                        >
                                            <div className="flex flex-row items-center px-[12px] py-[4px] rounded-[12px] w-fit h-[26px]" style={{ backgroundColor: 'var(--dash-surface-hover)', border: '1px solid var(--dash-border)' }}>
                                                <span className="font-['Inter'] font-[500] text-[12px] leading-[1.3333333333333333em] text-[var(--dash-text)]">
                                                    {cat.name}
                                                </span>
                                            </div>

                                            {/* Action Buttons (31611:5461) - Visible on hover */}
                                            <div className="flex flex-row items-center gap-[8px] opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.preventDefault(); startEditing(cat); }}
                                                    className="flex flex-col items-center pt-[8px] px-[8px] pb-0 w-[32px] h-[32px] rounded-[12px] hover:bg-white/10 transition-colors"
                                                >
                                                    <Pencil className="w-[16px] h-[16px] text-[#3B82F6]" strokeWidth={1.333} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.preventDefault(); openDeleteModal(cat); }}
                                                    disabled={fetchingDeleteId === cat.id}
                                                    className="flex flex-col items-center pt-[8px] px-[8px] pb-0 w-[32px] h-[32px] rounded-[12px] hover:bg-white/10 transition-colors disabled:opacity-50"
                                                >
                                                    {fetchingDeleteId === cat.id
                                                        ? <Loader2 className="w-[16px] h-[16px] text-[#EF4444] animate-spin" strokeWidth={1.333} />
                                                        : <Trash2 className="w-[16px] h-[16px] text-[#EF4444]" strokeWidth={1.333} />
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Add new Category Toggle */}
                    <button
                        onClick={(e) => { e.preventDefault(); setShowCreateInput(!showCreateInput); }}
                        className="flex flex-row items-center w-full gap-[6px] hover:opacity-80 transition-opacity"
                    >
                        {showCreateInput ? (
                            <Minus className="w-[24px] h-[24px] text-[#3B82F6]" strokeWidth={2} />
                        ) : (
                            <Plus className="w-[24px] h-[24px] text-[#3B82F6]" strokeWidth={2} />
                        )}
                        <span className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[var(--dash-text)]">{t.dashboard.blog.categoryModal.addNewBtn}</span>
                    </button>

                    {/* Add new Category Form */}
                    {showCreateInput && (
                        <div className="flex flex-col w-full p-[16px] mt-[4px] gap-[8px] border-[1px] border-solid border-[var(--dash-border)] rounded-[16px]">
                            <span className="font-['Inter'] font-[500] text-[12px] leading-[1.3333333333333333em] text-[var(--dash-text)]">{t.dashboard.blog.categoryModal.categoryNameLabel}</span>
                            <div className="flex flex-row gap-[16px] w-full">
                                <input
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                    autoFocus
                                    placeholder={t.dashboard.blog.categoryModal.categoryNamePlaceholder}
                                    className="flex-1 min-w-0 h-[48px] bg-[var(--dash-bg)] border-[1px] border-solid border-[var(--dash-border)] rounded-[12px] px-[16px] font-['Inter'] font-[400] text-[14px] text-[var(--dash-text)] outline-none placeholder:text-[var(--dash-text-muted)] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]"
                                />
                                <button
                                    onClick={handleCreate}
                                    disabled={!newName.trim() || isCreating}
                                    className="flex justify-center items-center px-0 py-0 w-[112px] h-[48px] rounded-[12px] bg-gradient-to-r from-teal-400 to-blue-500 hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
                                >
                                    {isCreating ? <Loader2 className="w-[20px] h-[20px] text-white animate-spin" /> : <span className="font-['Inter'] font-[600] text-[16px] leading-[1.5em] text-white">{t.dashboard.blog.categoryModal.saveBtn}</span>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer (31611:5388) */}
                <div className="flex flex-row justify-end items-center w-full pr-[24px] h-[72px]" style={{ borderTop: '1px solid var(--dash-border)' }}>
                    <button
                        onClick={(e) => { e.preventDefault(); onClose(); }}
                        className="flex flex-col justify-center items-center px-[16px] py-[8px] h-[48px] bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] transition-colors hover:bg-[var(--dash-surface-hover)] cursor-pointer"
                    >
                        <span className="font-['Inter'] font-[500] text-[14px] leading-[1.4285714285714286em] text-[var(--dash-text)]">{t.dashboard.blog.categoryModal.closeBtn}</span>
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal (31611:5609) */}
            {deleteTarget && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 rounded-[16px]">
                    <div className="flex flex-col shrink-0 items-center gap-[13px] p-[25px_10px] w-full max-w-[433px] bg-[var(--dash-surface)] border-[1px] border-solid border-[var(--dash-border)] rounded-[16px] relative">
                        {/* Icon Container */}
                        <div className="flex justify-center items-center px-[16px] w-[64px] h-[64px] bg-[rgba(240,177,0,0.1)] rounded-full">
                            <AlertTriangle className="w-[32px] h-[32px] text-[#F0B100]" strokeWidth={2.666} />
                        </div>

                        {/* Heading */}
                        <span className="font-['Inter'] font-[700] text-[20px] leading-[1.4em] text-center text-[var(--dash-text)]">
                            {t.dashboard.blog.categoryModal.removeTitle}
                        </span>

                        {/* Paragraph */}
                        <div className="flex flex-row justify-center items-center w-full px-[10px]">
                            <span className="font-['Inter'] font-[400] text-[14px] leading-[1.4285714285714286em] text-center text-[var(--dash-text-muted)] whitespace-pre-line">
                                {t.dashboard.blog.categoryModal.removeConfirmMsg.replace('{name}', deleteTarget.name)}
                            </span>
                        </div>

                        {deletePublishedCount > 0 && (
                            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 mx-[10px] w-full max-w-[398px]">
                                <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-yellow-400">
                                    {t.dashboard.blog.categoryModal.deletePublishedWarning.replace('{count}', String(deletePublishedCount))}
                                </p>
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex flex-row gap-[12px] w-full max-w-[398px] mt-[6px] px-[10px]">
                            <button
                                onClick={(e) => { e.preventDefault(); setDeleteTarget(null); }}
                                className="flex flex-1 justify-center items-center pt-[12px] pb-[14px] px-0 border-[1px] border-solid border-[var(--dash-border)] rounded-[16px] hover:bg-[var(--dash-surface-hover)] transition-colors cursor-pointer"
                            >
                                <span className="font-['Inter'] font-[600] text-[16px] leading-[1.5em] text-[var(--dash-text)]">{t.dashboard.blog.categoryModal.cancelBtn}</span>
                            </button>
                            <button
                                onClick={(e) => { e.preventDefault(); handleDelete(); }}
                                disabled={isDeleting}
                                className="flex flex-1 justify-center items-center gap-[8px] pt-[12px] pb-[14px] px-0 bg-[#FB2C36] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] rounded-[16px] hover:bg-opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                            >
                                {isDeleting ? (
                                    <><Loader2 className="w-[20px] h-[20px] text-white animate-spin" /><span className="font-['Inter'] font-[600] text-[16px] leading-[1.5em] text-white">{t.dashboard.blog.categoryModal.deletingBtn}</span></>
                                ) : (
                                    <span className="font-['Inter'] font-[600] text-[16px] leading-[1.5em] text-white">{t.dashboard.blog.categoryModal.deleteBtn}</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
