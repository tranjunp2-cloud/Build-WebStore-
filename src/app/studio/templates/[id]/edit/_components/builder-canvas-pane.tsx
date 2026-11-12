'use client'
/**
 * builder-canvas-pane.tsx
 * Center pane: sortable section cards via @dnd-kit.
 * Ported DOM from builder-canvas.jsx. Drag-reorder logic unchanged.
 * Visual: b-canvas-wrap, b-canvas-toolbar, b-page-frame, b-section cards.
 */
import { useState } from 'react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useBuilderStore } from '@/lib/admin/builder-store'
import type { Section } from '@/lib/admin/builder-store'
import { SectionCard } from './section-card'

// ── Sortable wrapper keeps dnd-kit logic outside SectionCard ─────────────────

function SortableSectionCard({ section, isSelected, canEdit }: { section: Section; isSelected: boolean; canEdit: boolean }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: section.id,
        disabled: !canEdit,
    })

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 10 : undefined,
        position: 'relative',
    }

    return (
        <div ref={setNodeRef} style={style}>
            <SectionCard
                section={section}
                isSelected={isSelected}
                canEdit={canEdit}
                dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
            />
        </div>
    )
}

// ── Main pane ────────────────────────────────────────────────────────────────

export function BuilderCanvasPane({ canEdit = true }: { canEdit?: boolean } = {}) {
    const { sections, selectedId, reorder, addBlock } = useBuilderStore()
    const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const fromIdx = sections.findIndex((s) => s.id === active.id)
        const toIdx   = sections.findIndex((s) => s.id === over.id)
        if (fromIdx !== -1 && toIdx !== -1) reorder(fromIdx, toIdx)
    }

    const visibleCount = sections.filter(() => true).length // all visible for now

    return (
        <div className="b-canvas-wrap">
            {/* Toolbar row */}
            <div className="b-canvas-toolbar">
                <div className="b-seg b-vp-seg" style={{ background: 'transparent', padding: 0 }}>
                    <button
                        type="button"
                        className={viewport === 'desktop' ? 'active' : ''}
                        onClick={() => setViewport('desktop')}
                    >
                        ▢ Desktop
                    </button>
                    <button
                        type="button"
                        className={viewport === 'tablet' ? 'active' : ''}
                        onClick={() => setViewport('tablet')}
                    >
                        ▯ Tablet
                    </button>
                    <button
                        type="button"
                        className={viewport === 'mobile' ? 'active' : ''}
                        onClick={() => setViewport('mobile')}
                    >
                        ▮ Mobile
                    </button>
                </div>
                <span style={{ marginLeft: 12, fontSize: 11, color: 'var(--text-3)' }}>
                    {sections.length} sections · {visibleCount} visible
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
                    <span>⌘+S to save</span>
                    <span>·</span>
                    <span>Drag from Library to add</span>
                </div>
            </div>

            {/* Scrollable canvas area */}
            <div className="b-canvas-scroll scroll-thin">
                {sections.length === 0 ? (
                    <div className="b-page-frame">
                        <div className="b-empty-canvas">
                            <h3>Start with an empty template</h3>
                            <p>Drag blocks from the library on the left, or click to add quickly.</p>
                            {canEdit && (
                                <button
                                    type="button"
                                    className="b-btn"
                                    onClick={() => addBlock('hero')}
                                >
                                    + Add hero block
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={sections.map((s) => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className={`b-page-frame viewport-${viewport}`}>
                                {sections.map((section) => (
                                    <SortableSectionCard
                                        key={section.id}
                                        section={section}
                                        isSelected={selectedId === section.id}
                                        canEdit={canEdit}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}

                {/* End drop zone hint */}
                {canEdit && <div className="b-end-zone">
                    <div style={{ fontSize: 14, marginBottom: 4 }}>＋</div>
                    <div>Drag a block here to add at the end</div>
                    <div style={{ fontSize: 11, marginTop: 2, color: 'var(--text-4)' }}>
                        or click a block in the Library
                    </div>
                </div>}
            </div>
        </div>
    )
}
