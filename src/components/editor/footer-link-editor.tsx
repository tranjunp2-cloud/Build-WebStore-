'use client'

import { useState, useEffect, useRef } from 'react'
import { useI18n } from '@/i18n'
import {
    DndContext, closestCenter,
    PointerSensor, TouchSensor, KeyboardSensor,
    useSensor, useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext, sortableKeyboardCoordinates,
    verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, ExternalLink, GripVertical, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import type { FooterColumn, NavLink } from '@/types/editor'

const labelCls = 'text-[12px] font-medium leading-4 text-slate-400'

function isExternal(url: string) {
    return url.startsWith('http://') || url.startsWith('https://')
}

// ── Sortable link row ────────────────────────────────────────────────────────

interface SortableLinkProps {
    id: string
    link: NavLink
    ci: number
    li: number
    onUpdate: (field: 'label' | 'url' | 'style', val: string) => void
    onRemove: () => void
}

function SortableLink({ id, link, ci, li, onUpdate, onRemove }: SortableLinkProps) {
    const { t } = useI18n()
    const s = t.editor.settings
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

    const currentStyle: 'internal' | 'external' =
        link.style ?? (isExternal(link.url ?? '') ? 'external' : 'internal')

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
            className="rounded-xl border border-[rgba(59,130,246,0.04)] bg-[rgba(30,41,59,0.3)] px-[13px] pb-[1px] pt-[13px]"
        >
            <div className="flex items-start gap-2">
                {/* Drag handle — listeners scoped here so inputs are unaffected */}
                <button
                    type="button"
                    aria-label={s.dragToReorder}
                    className="mt-1 shrink-0 touch-none cursor-grab text-slate-600 hover:text-slate-400 active:cursor-grabbing"
                    {...listeners}
                    {...attributes}
                >
                    <GripVertical className="h-4 w-4" />
                </button>

                <div className="flex-1 space-y-2 pb-3">
                    {/* Label + delete */}
                    <div className="flex items-center gap-1">
                        <Input
                            key={`link-label-${ci}-${li}-${link.label}`}
                            defaultValue={link.label}
                            placeholder="About Us"
                            onBlur={(e) => onUpdate('label', e.target.value)}
                            variant="editor"
                            className="h-8 flex-1 text-[14px] text-[#94a3b8]"
                        />
                        <button
                            type="button"
                            onClick={onRemove}
                            aria-label={s.removeLink}
                            className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-red-400"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Style dropdown */}
                    <div className="relative">
                        <select
                            value={currentStyle}
                            onChange={(e) => onUpdate('style', e.target.value)}
                            className="h-8 w-full appearance-none rounded-md border border-white/[0.08] bg-[rgba(15,23,42,0.7)] px-3 pr-8 text-[13px] text-[#94a3b8] cursor-pointer focus:outline-none focus:border-blue-500/40"
                        >
                            <option value="internal">Style: Internal</option>
                            <option value="external">Style: External</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    </div>

                    {/* URL */}
                    <div className="relative">
                        <Input
                            key={`link-url-${ci}-${li}-${link.url}`}
                            defaultValue={link.url}
                            placeholder={currentStyle === 'external' ? 'https://example.com' : '/about'}
                            onBlur={(e) => onUpdate('url', e.target.value.toLowerCase())}
                            variant="editor"
                            className={cn('h-8 text-[14px] text-[#94a3b8] w-full lowercase', currentStyle === 'external' && 'pr-8')}
                        />
                        {currentStyle === 'external' && (
                            <ExternalLink className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Main component ───────────────────────────────────────────────────────────

interface FooterLinkEditorProps {
    columns: FooterColumn[]
    onUpdate: (cols: FooterColumn[]) => void
}

export function FooterLinkEditor({ columns, onUpdate }: FooterLinkEditorProps) {
    const { t, ti } = useI18n()
    const s = t.editor.settings
    const [openCols, setOpenCols] = useState<Set<number>>(new Set())
    // Reset open state when a column is deleted (stale index would re-open wrong column on delete)
    const prevColCountRef = useRef(columns.length)
    useEffect(() => {
        if (columns.length < prevColCountRef.current) {
            setOpenCols(new Set())
        }
        prevColCountRef.current = columns.length
    }, [columns.length])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const toggleCol = (i: number) =>
        setOpenCols(prev => (prev.has(i) ? new Set<number>() : new Set<number>([i])))

    const updateColTitle = (ci: number, title: string) =>
        onUpdate(columns.map((c, i) => i !== ci ? c : { ...c, title }))

    const updateLink = (ci: number, li: number, field: 'label' | 'url' | 'style', val: string) =>
        onUpdate(columns.map((c, i) =>
            i !== ci ? c : { ...c, links: (c.links || []).map((l, j) => j !== li ? l : { ...l, [field]: val }) }
        ))

    const removeLink = (ci: number, li: number) =>
        onUpdate(columns.map((c, i) =>
            i !== ci ? c : { ...c, links: (c.links || []).filter((_, j) => j !== li) }
        ))

    const addLink = (ci: number) => {
        if (((columns[ci]?.links ?? []).length) >= 10) return
        onUpdate(columns.map((c, i) =>
            i !== ci ? c : { ...c, links: [...(c.links || []), { label: '', url: '' }] }
        ))
    }

    const removeCol = (ci: number) => {
        setOpenCols(prev => {
            const next = new Set<number>()
            prev.forEach(idx => {
                if (idx < ci) next.add(idx)
                else if (idx > ci) next.add(idx - 1)
            })
            return next
        })
        onUpdate(columns.filter((_, i) => i !== ci))
    }

    const addCol = () => {
        if (columns.length >= 4) return
        onUpdate([...columns, { title: `Column ${columns.length + 1}`, links: [] }])
    }

    const handleLinkDragEnd = (ci: number, event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = Number(active.id)
        const newIndex = Number(over.id)
        onUpdate(columns.map((c, i) =>
            i !== ci ? c : { ...c, links: arrayMove(c.links || [], oldIndex, newIndex) }
        ))
    }


    return (
        <div className="space-y-2 mb-4">
            {columns.map((col, ci) => {
                const links = col.links || []
                const isOpen = openCols.has(ci)

                return (
                    <div
                        key={ci}
                        className="overflow-hidden rounded-xl border border-[rgba(59,130,246,0.04)] bg-[rgba(30,41,59,0.3)]"
                    >
                        <button
                            type="button"
                            onClick={() => toggleCol(ci)}
                            className="flex w-full items-center justify-between px-3 py-3 text-left"
                        >
                            <span className="truncate text-[14px] font-medium leading-5 text-[#F8FAFC]">
                                {col.title || `Column ${ci + 1}`}
                            </span>
                            {isOpen
                                ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                                : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                            }
                        </button>

                        {isOpen && (
                            <div className="space-y-3 border-t border-[rgba(59,130,246,0.04)] px-3 pb-3 pt-3">

                                <div className="space-y-1.5">
                                    <label className={labelCls}>{s.columnTitle}</label>
                                    <Input
                                        key={`col-title-${ci}-${col.title}`}
                                        defaultValue={col.title}
                                        placeholder={s.columnTitle}
                                        onBlur={(e) => updateColTitle(ci, e.target.value)}
                                        variant="editor"
                                        className="h-8 text-[14px]"
                                    />
                                </div>

                                {links.length > 0 && (
                                    <div className="space-y-1.5">
                                        <label className={labelCls}>{s.links}</label>
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={(e) => handleLinkDragEnd(ci, e)}
                                        >
                                            <SortableContext
                                                items={links.map((_, li) => String(li))}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <div className="space-y-3">
                                                    {links.map((link, li) => (
                                                        <SortableLink
                                                            key={`${ci}-${li}-${link.label}-${link.url}`}
                                                            id={String(li)}
                                                            link={link}
                                                            ci={ci}
                                                            li={li}
                                                            onUpdate={(field, val) => updateLink(ci, li, field, val)}
                                                            onRemove={() => removeLink(ci, li)}
                                                        />
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    </div>
                                )}

                                {links.length < 10 && (
                                    <button
                                        type="button"
                                        onClick={() => addLink(ci)}
                                        className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-[rgba(59,130,246,0.07)] bg-[#0B1120] py-2 text-[12px] font-medium leading-4 text-[#F8FAFC] transition-colors hover:border-[rgba(59,130,246,0.15)] hover:bg-[#0d1528]"
                                    >
                                        <Plus className="h-4 w-4" />
                                        {s.addLink}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => removeCol(ci)}
                                    aria-label={ti(s.columnN, { n: ci + 1 })}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-red-500/10 bg-transparent py-1.5 text-[11px] text-red-400/60 transition-colors hover:border-red-500/30 hover:text-red-400"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {s.removeColumn}
                                </button>
                            </div>
                        )}
                    </div>
                )
            })}

            {columns.length < 4 && (
                <button
                    type="button"
                    onClick={addCol}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-2 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-300"
                >
                    <Plus className="h-3.5 w-3.5" />
                    {s.addColumn}
                </button>
            )}
        </div>
    )
}
