import { useState, useCallback } from 'react'
import { Plus, Search, MoreVertical, Eye, EyeOff, Trash2, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/store/editorStore'
import { toast } from 'sonner'
import type { PageData } from '@/store/editorStore'

interface PageManagerPanelProps {
    isOpen: boolean
    onToggle: () => void
    siteId: string
}

export function PageManagerPanel({ isOpen, onToggle, siteId }: PageManagerPanelProps) {
    const pages = useEditorStore(state => state.pages)
    const currentPageId = useEditorStore(state => state.currentPageId)
    const addPageToState = useEditorStore(state => state.addPageToState)
    const updatePageInState = useEditorStore(state => state.updatePageInState)
    const removePageFromState = useEditorStore(state => state.removePageFromState)
    
    const [searchQuery, setSearchQuery] = useState('')
    const [isAdding, setIsAdding] = useState(false)
    const [newPageTitle, setNewPageTitle] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Filtered pages
    const filteredPages = pages.filter(p => !p.deletedAt && p.title.toLowerCase().includes(searchQuery.toLowerCase()))

    const handleCreatePage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newPageTitle.trim() || isSubmitting) return

        setIsSubmitting(true)
        try {
            // Dummy API call for now; we'll implement the real one later
            const tempId = Math.random().toString(36).substring(7)
            const slug = newPageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
            
            const newPage: PageData = {
                id: tempId,
                title: newPageTitle,
                slug,
                status: 'draft',
                isVisible: true,
                updatedAt: new Date().toISOString()
            }
            
            // Call API
            const res = await fetch(`/api/sites/${siteId}/pages`, {
                method: 'POST',
                headers: { 'Content-type': 'application/json' },
                body: JSON.stringify({ title: newPageTitle, slug })
            })
            
            if (!res.ok) throw new Error('Failed to create page')
            const data = await res.json()
            
            addPageToState(data.page || newPage)
            setNewPageTitle('')
            setIsAdding(false)
            toast.success("Page created successfully")
        } catch (error) {
            toast.error("Error creating page")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleToggleVisibility = async (page: PageData) => {
        const newVisible = !page.isVisible
        updatePageInState(page.id, { isVisible: newVisible })
        
        try {
            await fetch(`/api/sites/${siteId}/pages/${page.id}`, {
                method: 'PATCH',
                headers: { 'Content-type': 'application/json' },
                body: JSON.stringify({ isVisible: newVisible })
            })
            if (!newVisible) toast("Đã ẩn trang này")
        } catch (error) {
            updatePageInState(page.id, { isVisible: page.isVisible })
            toast.error("Lỗi khi cập nhật trạng thái hiển thị")
        }
    }

    const handleDelete = async (page: PageData) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa trang "${page.title}" không?`)) return
        
        const now = new Date().toISOString()
        updatePageInState(page.id, { deletedAt: now })

        // TODO: Soft delete API interaction & Undo logic 
        toast("Đã xóa. Hoàn tác?", {
            action: {
                label: "Undo",
                onClick: () => {
                   updatePageInState(page.id, { deletedAt: null })
                   // Undo logic over API
                }
            },
            duration: 5000
        })
    }

    if (!isOpen) {
        return (
            <div className="flex w-12 shrink-0 flex-col items-center border-r border-white/10 bg-[#0B1120] py-4">
                <button
                    onClick={onToggle}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                    title="Open Pages"
                >
                    <FileText className="h-5 w-5" />
                </button>
            </div>
        )
    }

    return (
        <div className="flex w-80 shrink-0 flex-col border-r border-white/10 bg-[#0B1120] shadow-xl">
            {/* Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-400" />
                    <span className="font-semibold text-white">Pages</span>
                </div>
                <button
                    onClick={onToggle}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            </div>

            {/* List Header & Actions */}
            <div className="flex flex-col gap-3 p-4">
                {!isAdding ? (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-500"
                    >
                        <Plus className="h-4 w-4" />
                        Thêm trang mới
                    </button>
                ) : (
                    <form onSubmit={handleCreatePage} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                        <input
                            autoFocus
                            value={newPageTitle}
                            onChange={(e) => setNewPageTitle(e.target.value)}
                            placeholder="Tên trang (VD: Khuyến mãi)"
                            className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsAdding(false)}
                                className="px-2 py-1 text-xs text-gray-400 hover:text-white"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !newPageTitle.trim()}
                                className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                                {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                                Lưu
                            </button>
                        </div>
                    </form>
                )}

                <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm trang..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-9 pr-4 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    />
                </div>
            </div>

            {/* Pages List */}
            <div className="flex-1 overflow-y-auto p-2">
                {filteredPages.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                        Không có trang nào phù hợp.
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {filteredPages.map(page => (
                            <div
                                key={page.id}
                                className={cn(
                                    "group flex items-center justify-between rounded-lg px-3 py-2 transition-colors",
                                    page.id === currentPageId ? "bg-white/10" : "hover:bg-white/5"
                                )}
                            >
                                <div className="flex flex-col overflow-hidden">
                                    <span className="truncate text-sm font-medium text-white">
                                        {page.title}
                                    </span>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span className={cn(
                                            "uppercase tracking-wider",
                                            page.status === 'published' ? "text-green-400" : "text-yellow-400"
                                        )}>
                                            {page.status}
                                        </span>
                                        <span>•</span>
                                        <span className="truncate">/{page.slug}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleVisibility(page); }}
                                        className="rounded p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                                        title={page.isVisible ? "Ẩn trang" : "Hiện trang"}
                                    >
                                        {page.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-yellow-500" />}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(page); }}
                                        className="rounded p-1.5 text-gray-400 hover:bg-red-500/20 hover:text-red-400"
                                        title="Xóa trang"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
