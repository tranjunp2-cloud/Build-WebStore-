'use client'
/**
 * builder-canvas-pane.tsx
 * Center pane: sortable section cards via @dnd-kit.
 * Sections are abstract cards (no live HTML rendering — MVP scope).
 */
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

// ── Sortable wrapper ─────────────────────────────────────────────────────────

function SortableSectionCard({ section, isSelected }: { section: Section; isSelected: boolean }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: section.id,
    })

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
    }

    return (
        <div ref={setNodeRef} style={style}>
            <SectionCard
                section={section}
                isSelected={isSelected}
                dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
            />
        </div>
    )
}

// ── Main pane ────────────────────────────────────────────────────────────────

export function BuilderCanvasPane() {
    const { sections, selectedId, reorder, addBlock } = useBuilderStore()

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const fromIdx = sections.findIndex((s) => s.id === active.id)
        const toIdx = sections.findIndex((s) => s.id === over.id)
        if (fromIdx !== -1 && toIdx !== -1) reorder(fromIdx, toIdx)
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="px-3 py-2 border-b flex-shrink-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Canvas
                    <span className="ml-1 font-normal normal-case">
                        ({sections.length} section{sections.length !== 1 ? 's' : ''})
                    </span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Desktop view only (MVP)</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                {sections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                        <p className="text-sm text-muted-foreground">No sections yet.</p>
                        <button
                            type="button"
                            onClick={() => addBlock('hero')}
                            className="text-xs px-3 py-1.5 rounded-md border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors"
                        >
                            + Add hero block
                        </button>
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
                            <div className="space-y-1.5">
                                {sections.map((section) => (
                                    <SortableSectionCard
                                        key={section.id}
                                        section={section}
                                        isSelected={selectedId === section.id}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    )
}
