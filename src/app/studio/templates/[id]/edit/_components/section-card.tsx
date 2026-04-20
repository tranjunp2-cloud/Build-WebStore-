'use client'
/**
 * section-card.tsx
 * Single section row on the builder canvas.
 * Re-skinned to b-section DOM from builder-canvas.jsx:
 *   - b-sec-handle (hover overlay) with drag grip + type pill + variant + actions
 *   - b-sec-body placeholder (no live render — MVP scope)
 * Drag handle wired via dnd-kit props from BuilderCanvasPane.
 */
import { Eye, EyeOff, Copy, Trash2 } from 'lucide-react'
import { useBuilderStore } from '@/lib/admin/builder-store'
import type { Section } from '@/lib/admin/builder-store'
import { getBlockBySlug } from '@/lib/admin/block-registry-reader'

interface Props {
    section: Section
    isSelected: boolean
    dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
}

export function SectionCard({ section, isSelected, dragHandleProps }: Props) {
    const { select, duplicateSection, deleteSection, patchSection } = useBuilderStore()
    const blockMeta = getBlockBySlug(section.blockType)
    const icon      = blockMeta?.icon ?? '📦'
    const variant   = (section.config['variant'] as string | undefined) ?? blockMeta?.defaultVariant ?? ''
    const isVisible = section.config['visible'] !== false

    return (
        <div
            role="button"
            tabIndex={0}
            className={
                'b-section' +
                (isSelected ? ' selected' : '') +
                (!isVisible ? ' hidden-sec' : '')
            }
            onClick={() => select(section.id)}
            onKeyDown={(e) => e.key === 'Enter' && select(section.id)}
        >
            {/* Hover overlay handle bar */}
            <div className="b-sec-handle">
                {/* Drag grip */}
                <button
                    type="button"
                    className="b-drag-grip"
                    aria-label="Drag to reorder"
                    {...dragHandleProps}
                >
                    ⋮⋮
                </button>

                {/* Type pill */}
                <span className="b-sec-type">
                    {icon} {section.blockType}
                </span>

                {/* Variant label */}
                {variant && (
                    <span className="b-sec-variant">· {variant}</span>
                )}

                {/* Section human name */}
                <span className="b-sec-label">
                    {blockMeta?.name ?? section.blockType}
                </span>

                {/* Actions */}
                <div className="b-sec-actions">
                    <button
                        type="button"
                        title={isVisible ? 'Hide section' : 'Show section'}
                        onClick={(e) => {
                            e.stopPropagation()
                            patchSection(section.id, { visible: !isVisible })
                        }}
                    >
                        {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>

                    <button
                        type="button"
                        title="Duplicate section"
                        onClick={(e) => { e.stopPropagation(); duplicateSection(section.id) }}
                    >
                        <Copy size={12} />
                    </button>

                    <button
                        type="button"
                        className="danger"
                        title="Delete section"
                        onClick={(e) => { e.stopPropagation(); deleteSection(section.id) }}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Section body — abstract placeholder (no live render in MVP) */}
            <div className="b-sec-body">
                <div className="b-sec-placeholder">
                    <span className="b-sec-placeholder-icon">{icon}</span>
                    <span className="b-sec-placeholder-type">{blockMeta?.name ?? section.blockType}</span>
                    {variant && (
                        <span className="b-sec-placeholder-variant">{variant}</span>
                    )}
                </div>
            </div>
        </div>
    )
}
