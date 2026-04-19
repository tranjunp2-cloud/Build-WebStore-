'use client'
/**
 * Main client orchestrator for the Templates list page.
 * Manages: filter state ↔ URL sync, view toggle, selection, data re-fetch.
 * Visual layer matches design bundle (page-head, page-title, page-sub, btn-primary).
 */
import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Upload, Plus } from 'lucide-react'
import { TemplatesFilterBar } from './templates-filter-bar'
import { TemplatesTableView } from './templates-table-view'
import { TemplatesGridView } from './templates-grid-view'
import { TemplatesSplitView } from './templates-split-view'
import { TemplateDrawer } from './template-drawer'
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
    const [drawerId, setDrawerId] = useState<string | number | null>(null)
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
            action: 'publish' | 'archive' | 'schedule' | 'delete' | 're-score',
            scheduledFor?: string,
        ) => {
            const ids = Array.from(selected)
            try {
                const result = await bulkAction(ids, action, scheduledFor)
                const verb = action === 're-score' ? 'scored' : 'updated'
                toast.success(`${result.succeeded} template(s) ${verb}`)
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

    const handleRefresh = useCallback(() => {
        doFetch(filter)
    }, [filter, doFetch])

    const viewProps = {
        templates: data.data,
        selected,
        onSelect: setSelected,
        onFilterChange: handleFilterChange,
        loading,
        filter,
    }

    const liveCount = data.data.filter(t => t.status === 'live').length

    return (
        <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Page header */}
            <div className="page-head">
                <div>
                    <h1 className="page-title">{pageTitle}</h1>
                    <p className="page-sub">
                        {data.meta.totalDocs} templates
                        {liveCount > 0 && ` · ${liveCount} live`}
                        {presetStatus && ` · filtered by ${presetStatus}`}
                    </p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-ghost" style={{ fontSize: 13 }}>
                        <Upload size={14} /> Import ZIP
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={14} /> New template
                    </button>
                </div>
            </div>

            {/* Filter bar (includes status tabs + search row + view toggle) */}
            <TemplatesFilterBar
                filter={filter}
                presetStatus={presetStatus}
                onFilterChange={handleFilterChange}
                totalDocs={data.meta.totalDocs}
                view={view}
                onViewChange={setView}
                onRefresh={handleRefresh}
            />

            {/* Content area */}
            <div style={{ flex: 1, minHeight: 0 }}>
                {view === 'table' && (
                    <TemplatesTableView
                        {...viewProps}
                        onRowClick={id => setDrawerId(prev => prev === id ? null : id)}
                        activeId={drawerId}
                    />
                )}
                {view === 'grid'  && <TemplatesGridView  {...viewProps} />}
                {view === 'split' && <TemplatesSplitView {...viewProps} />}
            </div>

            {/* Pagination */}
            {data.meta.totalPages > 1 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid var(--border)',
                        paddingTop: 12,
                        marginTop: 12,
                        fontSize: 13,
                        color: 'var(--text-2)',
                    }}
                >
                    <span>
                        Page {data.meta.page} of {data.meta.totalPages}
                        {' · '}{data.meta.totalDocs} total
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            className="btn btn-sm"
                            disabled={!data.meta.hasPrevPage}
                            onClick={() => handlePageChange(data.meta.page - 1)}
                        >
                            Previous
                        </button>
                        <button
                            className="btn btn-sm"
                            disabled={!data.meta.hasNextPage}
                            onClick={() => handlePageChange(data.meta.page + 1)}
                        >
                            Next
                        </button>
                    </div>
                    <select
                        className="select"
                        style={{ height: 28, fontSize: 12 }}
                        value={filter.limit ?? 50}
                        onChange={e => handleFilterChange({ limit: Number(e.target.value) })}
                    >
                        {[25, 50, 100].map(n => (
                            <option key={n} value={n}>{n} / page</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Template detail drawer — overlay (table/grid views only; split handles inline) */}
            {drawerId !== null && view !== 'split' && (() => {
                const t = data.data.find(x => x.id === drawerId)
                return t ? (
                    <TemplateDrawer
                        template={t}
                        onClose={() => setDrawerId(null)}
                    />
                ) : null
            })()}

            {/* Bulk floating toolbar */}
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
