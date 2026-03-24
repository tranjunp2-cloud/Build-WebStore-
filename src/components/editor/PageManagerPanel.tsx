'use client'

import { useMemo, useState } from 'react'
import { Eye, EyeOff, FileText, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/store/editorStore'
import { toast } from 'sonner'
import type { PageData } from '@/store/editorStore'

interface PageManagerPanelProps {
    siteId: string
    currentPageId: string | null
    onPageSelected: (pageId: string) => void
    onPageCreated?: (pageId: string) => void
}

function slugifyPageTitle(title: string) {
    return title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
}

const SYSTEM_PAGE_SLUGS = new Set(['', 'home', '404'])

export function PageManagerPanel({
    siteId,
    currentPageId,
    onPageSelected,
    onPageCreated,
}: PageManagerPanelProps) {
    const pages = useEditorStore(state => state.pages)
    const addPageToState = useEditorStore(state => state.addPageToState)
    const updatePageInState = useEditorStore(state => state.updatePageInState)

    const [searchQuery, setSearchQuery] = useState('')
    const [isAdding, setIsAdding] = useState(false)
    const [newPageTitle, setNewPageTitle] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [pendingPageId, setPendingPageId] = useState<string | null>(null)

    const filteredPages = useMemo(
        () =>
            pages.filter(
                page =>
                    !page.deletedAt &&
                    page.title.toLowerCase().includes(searchQuery.toLowerCase()),
            ),
        [pages, searchQuery],
    )

    const handleCreatePage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newPageTitle.trim() || isSubmitting) return

        setIsSubmitting(true)

        try {
            const slug = slugifyPageTitle(newPageTitle)
            const res = await fetch(`/api/sites/${siteId}/pages`, {
                method: 'POST',
                headers: { 'Content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ title: newPageTitle, slug }),
            })

            if (!res.ok) throw new Error('Failed to create page')

            const data = await res.json()

            addPageToState(data.page)
            setNewPageTitle('')
            setIsAdding(false)
            toast.success('Page created successfully')

            const pageId = data.page?.id
            if (pageId) {
                onPageSelected(pageId)
                onPageCreated?.(pageId)
            }
        } catch {
            toast.error('Error creating page')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleToggleVisibility = async (page: PageData) => {
        if (SYSTEM_PAGE_SLUGS.has(page.slug)) return

        const newVisible = !page.isVisible
        updatePageInState(page.id, { isVisible: newVisible })

        try {
            await fetch(`/api/sites/${siteId}/pages/${page.id}`, {
                method: 'PATCH',
                headers: { 'Content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ isVisible: newVisible }),
            })

            if (!newVisible) {
                toast('Đã ẩn trang này')
            }
        } catch {
            updatePageInState(page.id, { isVisible: page.isVisible })
            toast.error('Lỗi khi cập nhật trạng thái hiển thị')
        }
    }

    const handleDelete = async (page: PageData) => {
        if (SYSTEM_PAGE_SLUGS.has(page.slug)) return
        if (!confirm(`Bạn có chắc chắn muốn xóa trang "${page.title}" không?`)) return

        const now = new Date().toISOString()
        updatePageInState(page.id, { deletedAt: now })
        setPendingPageId(page.id)

        try {
            await fetch(`/api/sites/${siteId}/pages/${page.id}`, {
                method: 'PATCH',
                headers: { 'Content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ deletedAt: now }),
            })
        } catch {
            updatePageInState(page.id, { deletedAt: null })
            setPendingPageId(null)
            toast.error('Không thể xóa trang')
            return
        }

        toast('Đã xóa. Hoàn tác?', {
            action: {
                label: 'Undo',
                onClick: async () => {
                    updatePageInState(page.id, { deletedAt: null })
                    setPendingPageId(null)

                    try {
                        await fetch(`/api/sites/${siteId}/pages/${page.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ deletedAt: null }),
                        })
                    } catch {
                        updatePageInState(page.id, { deletedAt: now })
                        toast.error('Không thể hoàn tác')
                    }
                },
            },
            duration: 5000,
        })
    }

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-white/10 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-white">Page Manager</p>
                        <p className="mt-1 text-xs text-gray-500">
                            Create, select, hide, and soft-delete pages for this site.
                        </p>
                    </div>
                    <FileText className="h-4 w-4 text-blue-400" />
                </div>
            </div>

            <div className="space-y-3 border-b border-white/10 p-4">
                {!isAdding ? (
                    <Button type="button" className="w-full justify-center" onClick={() => setIsAdding(true)}>
                        <Plus className="h-4 w-4" />
                        Thêm trang mới
                    </Button>
                ) : (
                    <form onSubmit={handleCreatePage} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <Input
                            autoFocus
                            value={newPageTitle}
                            onChange={e => setNewPageTitle(e.target.value)}
                            placeholder="Tên trang (VD: Khuyến mãi)"
                        />
                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                            <span>Slug: /{slugifyPageTitle(newPageTitle || 'new-page')}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAdding(false)
                                        setNewPageTitle('')
                                    }}
                                    className="text-gray-400 transition-colors hover:text-white"
                                >
                                    Hủy
                                </button>
                                <Button type="submit" size="sm" disabled={isSubmitting || !newPageTitle.trim()}>
                                    {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                    Tạo trang
                                </Button>
                            </div>
                        </div>
                    </form>
                )}

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm trang..."
                        className="pl-9"
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {filteredPages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 px-6 text-center">
                        <FileText className="h-8 w-8 text-gray-600" />
                        <p className="mt-4 text-sm font-medium text-white">No pages found</p>
                        <p className="mt-2 max-w-xs text-xs text-gray-500">
                            Create a new page or try a different search keyword.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredPages.map(page => {
                            const isCurrent = page.id === currentPageId
                            const isSystemPage = SYSTEM_PAGE_SLUGS.has(page.slug)

                            return (
                                <div
                                    key={page.id}
                                    className={cn(
                                        'rounded-2xl border p-4 transition-colors',
                                        isCurrent
                                            ? 'border-blue-500/40 bg-blue-500/10'
                                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10',
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onPageSelected(page.id)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-white">
                                                    {page.title}
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                                    <span>/{page.slug}</span>
                                                    <span>•</span>
                                                    <span>{new Date(page.updatedAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Badge variant={page.status === 'published' ? 'success' : 'warning'}>
                                                    {page.status}
                                                </Badge>
                                                {!page.isVisible ? <Badge variant="secondary">Hidden</Badge> : null}
                                            </div>
                                        </div>
                                    </button>

                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="text-xs text-gray-500">
                                            {isSystemPage ? 'System page' : 'Regular page'}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleVisibility(page)}
                                                disabled={isSystemPage}
                                                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                                title={page.isVisible ? 'Ẩn trang' : 'Hiện trang'}
                                            >
                                                {page.isVisible ? (
                                                    <Eye className="h-4 w-4" />
                                                ) : (
                                                    <EyeOff className="h-4 w-4 text-amber-400" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(page)}
                                                disabled={isSystemPage || pendingPageId === page.id}
                                                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-red-500/20 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                                                title="Xóa trang"
                                            >
                                                {pendingPageId === page.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
