'use client'

import { useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronDown, ChevronRight, Eye, EyeOff, FileText, Loader2, Plus, Search, Trash2 } from 'lucide-react'
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
    const [deleteTarget, setDeleteTarget] = useState<PageData | null>(null)
    const [is404SectionOpen, setIs404SectionOpen] = useState(false)

    const { regularPages, page404 } = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase()
        const visiblePages = pages.filter(page => !page.deletedAt)
        const matchesQuery = (page: PageData) =>
            !normalizedQuery ||
            page.title.toLowerCase().includes(normalizedQuery) ||
            page.slug.toLowerCase().includes(normalizedQuery)

        return {
            regularPages: visiblePages.filter(
                page => !SYSTEM_PAGE_SLUGS.has(page.slug) && matchesQuery(page),
            ),
            page404:
                visiblePages.find(
                    page =>
                        (page.slug === '404' || page.slug === '/404') &&
                        matchesQuery(page),
                ) ?? null,
        }
    }, [pages, searchQuery])

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

        const now = new Date().toISOString()
        updatePageInState(page.id, { deletedAt: now })
        setPendingPageId(page.id)
        setDeleteTarget(null)

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

    const isEmptyState = regularPages.length === 0 && !page404

    return (
        <>
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
                {isEmptyState ? (
                    <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 px-6 text-center">
                        <FileText className="h-8 w-8 text-gray-600" />
                        <p className="mt-4 text-sm font-medium text-white">No pages found</p>
                        <p className="mt-2 max-w-xs text-xs text-gray-500">
                            Create a new page or try a different search keyword.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {regularPages.map(page => {
                            const isCurrent = page.id === currentPageId

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
                                        <div className="text-xs text-gray-500">Regular page</div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleVisibility(page)}
                                                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
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
                                                onClick={() => setDeleteTarget(page)}
                                                disabled={pendingPageId === page.id}
                                                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-red-500/20 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
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

                        {page404 ? (
                            <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                                <button
                                    type="button"
                                    onClick={() => setIs404SectionOpen(open => !open)}
                                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#111A2D] px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-[#152038]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-white">Page 404 Not Found</p>
                                            <p className="mt-0.5 text-xs text-gray-500">System page</p>
                                        </div>
                                    </div>
                                    {is404SectionOpen ? (
                                        <ChevronDown className="h-4 w-4 text-gray-400" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-gray-400" />
                                    )}
                                </button>

                                {is404SectionOpen ? (
                                    <div className="mt-3 rounded-2xl border border-white/10 bg-[#0F172A] p-4">
                                        <p className="text-xs font-medium uppercase tracking-[0.24em] text-gray-500">
                                            404 Not Found Page
                                        </p>
                                        <p className="mt-3 text-sm text-gray-300">Open 404 Page to Edit</p>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="mt-4 w-full justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
                                            onClick={() => onPageSelected(page404.id)}
                                        >
                                            ✏️ Edit 404 Page
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
        <Dialog.Root open={Boolean(deleteTarget)} onOpenChange={open => !open && setDeleteTarget(null)}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-[#020617]/75 backdrop-blur-sm" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(347px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/10 bg-[#10192D] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.65)] focus:outline-none">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-300">
                        <Trash2 className="h-8 w-8" />
                    </div>
                    <Dialog.Title className="mt-4 text-center text-2xl font-semibold text-white">
                        Confirm Delete
                    </Dialog.Title>
                    <Dialog.Description className="mt-3 text-center text-sm leading-6 text-gray-400">
                        {deleteTarget ? (
                            <>
                                Are you sure you want to delete page &quot;{deleteTarget.title}&quot;?
                                <br />
                                This action cannot be undone.
                            </>
                        ) : null}
                    </Dialog.Description>
                    <div className="mt-6 grid grid-cols-2 gap-3">
                        <Dialog.Close asChild>
                            <Button
                                type="button"
                                variant="secondary"
                                className="h-11 rounded-xl bg-white/10 text-white hover:bg-white/15"
                            >
                                Cancel
                            </Button>
                        </Dialog.Close>
                        <Button
                            type="button"
                            className="h-11 rounded-xl bg-red-500 text-white hover:bg-red-400"
                            disabled={!deleteTarget || pendingPageId === deleteTarget.id}
                            onClick={() => {
                                if (!deleteTarget) return
                                void handleDelete(deleteTarget)
                            }}
                        >
                            {deleteTarget && pendingPageId === deleteTarget.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                            Delete Page
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
        </>
    )
}
