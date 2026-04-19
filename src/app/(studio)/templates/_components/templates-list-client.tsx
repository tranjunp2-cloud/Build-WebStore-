'use client'
/**
 * Main client orchestrator for the Templates list page.
 * Manages: filter state ↔ URL sync, view toggle, selection, data re-fetch.
 * ≤200 LOC: sub-components handle rendering details.
 */
import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { LayoutList, Grid2X2, PanelRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TemplatesFilterBar } from './templates-filter-bar'
import { TemplatesTableView } from './templates-table-view'
import { TemplatesGridView } from './templates-grid-view'
import { TemplatesSplitView } from './templates-split-view'
import { BulkActionToolbar } from './bulk-action-toolbar'
import { CreateTemplateModal } from '../../_components/modals/create-template-modal'
import { fetchTemplates, bulkAction } from '@/lib/admin/templates-query'
import type {
    AdminTemplate,
    TemplatesListResponse,
    TemplatesFilter,
    TemplateStatus,
} from '@/lib/admin/templates-query'

type ViewMode = 'table' | 'grid' | 'split'

type Props = {
    initialData: TemplatesListResponse
    initialFilter: TemplatesFilter
    initialView: ViewMode
    pageTitle: string
    /** Sub-route preset status: locks the status filter (drafts/scheduled/archived/review pages) */
    presetStatus?: TemplateStatus
}

const VIEW_STORAGE_KEY = 'pw_templates_view'

export function TemplatesListClient({
    initialData,
    initialFilter,
    initialView,
    pageTitle,
    presetStatus,
}: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [data, setData] = useState<TemplatesListResponse>(initialData)
    const [filter, setFilter] = useState<TemplatesFilter>(initialFilter)
    const [view, setView] = useState<ViewMode>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode) ?? initialView
        }
        return initialView
    })
    const [selected, setSelected] = useState<Set<string | number>>(new Set())
    const [loading, setLoading] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [, startTransition] = useTransition()

    // Persist view preference
    useEffect(() => {
        localStorage.setItem(VIEW_STORAGE_KEY, view)
    }, [view])

    // Sync filter → URL searchParams
    const syncUrl = useCallback(
        (f: TemplatesFilter) => {
            const sp = new URLSearchParams(searchParams.toString())
            const set = (k: string, v: string | undefined) => {
                if (v && v !== 'all') sp.set(k, v); else sp.delete(k)
            }
            set('status', f.status)
            set('category', f.category)
            set('personality', f.personality)
            if (f.search) sp.set('search', f.search); else sp.delete('search')
            if (f.sort && f.sort !== '-updatedAt') sp.set('sort', f.sort); else sp.delete('sort')
            if (f.page && f.page > 1) sp.set('page', String(f.page)); else sp.delete('page')
            if (f.limit && f.limit !== 50) sp.set('limit', String(f.limit)); else sp.delete('limit')
            sp.set('view', view)
            startTransition(() => {
                router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
            })
        },
        [pathname, router, searchParams, view],
    )

    // Re-fetch when filter changes (skip initial render — initialData already loaded)
    const doFetch = useCallback(
        async (f: TemplatesFilter) => {
            setLoading(true)
            try {
                const result = await fetchTemplates({ ...f, presetStatus })
                setData(result)
                setSelected(new Set())
            } catch {
                toast.error('Failed to load templates')
            } finally {
                setLoading(false)
            }
        },
        [presetStatus],
    )

    const handleFilterChange = useCallback(
        (updated: Partial<TemplatesFilter>) => {
            const next = { ...filter, ...updated, page: 1 }
            setFilter(next)
            syncUrl(next)
            doFetch(next)
        },
        [filter, syncUrl, doFetch],
    )

    const handlePageChange = useCallback(
        (page: number) => {
            const next = { ...filter, page }
            setFilter(next)
            syncUrl(next)
            doFetch(next)
        },
        [filter, syncUrl, doFetch],
    )

    const handleBulkAction = useCallback(
        async (
            action: 'publish' | 'archive' | 'schedule' | 'delete',
            scheduledFor?: string,
        ) => {
            const ids = Array.from(selected)
            try {
                const result = await bulkAction(ids, action, scheduledFor)
                toast.success(`${result.succeeded} template(s) updated`)
                if (result.failed > 0) toast.warning(`${result.failed} failed`)
                setSelected(new Set())
                doFetch(filter)
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Bulk action failed')
            }
        },
        [selected, filter, doFetch],
    )

    const handleCreated = useCallback(() => {
        setShowCreate(false)
        doFetch(filter)
        toast.success('Template created')
    }, [filter, doFetch])

    const viewProps = {
        templates: data.data,
        selected,
        onSelect: setSelected,
        onFilterChange: handleFilterChange,
        loading,
        filter,
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {data.meta.totalDocs} templates
                        {presetStatus && ` · filtered by ${presetStatus}`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex items-center rounded-md border bg-background p-0.5 gap-0.5">
                        {(
                            [
                                { mode: 'table' as ViewMode, Icon: LayoutList, label: 'Table' },
                                { mode: 'grid' as ViewMode, Icon: Grid2X2, label: 'Grid' },
                                { mode: 'split' as ViewMode, Icon: PanelRight, label: 'Split' },
                            ] as const
                        ).map(({ mode, Icon, label }) => (
                            <button
                                key={mode}
                                title={label}
                                onClick={() => setView(mode)}
                                className={`p-1.5 rounded transition-colors ${
                                    view === mode
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Icon size={15} />
                            </button>
                        ))}
                    </div>
                    <Button size="sm" onClick={() => setShowCreate(true)}>
                        <Plus size={15} className="mr-1" />
                        New template
                    </Button>
                </div>
            </div>

            {/* Filter bar */}
            <TemplatesFilterBar
                filter={filter}
                presetStatus={presetStatus}
                onFilterChange={handleFilterChange}
                totalDocs={data.meta.totalDocs}
            />

            {/* Content */}
            <div className="flex-1 min-h-0 relative">
                {view === 'table' && <TemplatesTableView {...viewProps} />}
                {view === 'grid' && <TemplatesGridView {...viewProps} />}
                {view === 'split' && <TemplatesSplitView {...viewProps} />}
            </div>

            {/* Pagination */}
            {data.meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
                    <span>
                        Page {data.meta.page} of {data.meta.totalPages}
                        {' · '}{data.meta.totalDocs} total
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!data.meta.hasPrevPage}
                            onClick={() => handlePageChange(data.meta.page - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!data.meta.hasNextPage}
                            onClick={() => handlePageChange(data.meta.page + 1)}
                        >
                            Next
                        </Button>
                    </div>
                    <select
                        className="rounded border bg-background px-2 py-1 text-sm"
                        value={filter.limit ?? 50}
                        onChange={e => handleFilterChange({ limit: Number(e.target.value) })}
                    >
                        {[25, 50, 100].map(n => (
                            <option key={n} value={n}>{n} / page</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Bulk toolbar */}
            {selected.size > 0 && (
                <BulkActionToolbar
                    count={selected.size}
                    onAction={handleBulkAction}
                    onClear={() => setSelected(new Set())}
                />
            )}

            {/* Create modal */}
            {showCreate && (
                <CreateTemplateModal
                    onClose={() => setShowCreate(false)}
                    onCreated={handleCreated}
                />
            )}
        </div>
    )
}

export type { AdminTemplate, TemplatesFilter }
