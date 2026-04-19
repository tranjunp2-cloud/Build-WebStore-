'use client'
/**
 * section-card.tsx
 * Single section row on the builder canvas. Shows block type, hover actions.
 * Drag handle provided by parent (BuilderCanvasPane via dnd-kit).
 */
import { GripVertical, Copy, Trash2 } from 'lucide-react'
import { useBuilderStore } from '@/lib/admin/builder-store'
import type { Section } from '@/lib/admin/builder-store'

interface Props {
    section: Section
    isSelected: boolean
    dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
}

const BLOCK_ICONS: Record<string, string> = {
    hero: '🦸', features: '✨', cta: '📣', faq: '❓',
    navigation: '🧭', footer: '🦶', contact: '📬', newsletter: '📧',
    testimonials: '💬', about: 'ℹ️', gallery: '🖼️', pricing: '💰',
    stats: '📊', team: '👥', video: '🎬', 'blog-list': '📝',
}

export function SectionCard({ section, isSelected, dragHandleProps }: Props) {
    const { select, duplicateSection, deleteSection } = useBuilderStore()
    const icon = BLOCK_ICONS[section.blockType] ?? '📦'
    const label = section.blockType
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => select(section.id)}
            onKeyDown={(e) => e.key === 'Enter' && select(section.id)}
            className={[
                'group relative flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer',
                'transition-colors hover:border-primary/40 hover:bg-muted/50',
                isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-background',
            ].join(' ')}
        >
            {/* Drag handle */}
            <button
                type="button"
                className="flex-shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Drag to reorder"
                {...dragHandleProps}
            >
                <GripVertical size={14} />
            </button>

            {/* Icon + label */}
            <span className="text-sm" aria-hidden>{icon}</span>
            <span className="flex-1 text-sm font-medium truncate">{label}</span>
            <span className="text-xs text-muted-foreground font-mono opacity-60 truncate max-w-[80px]">
                #{section.id.slice(0, 6)}
            </span>

            {/* Hover actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); duplicateSection(section.id) }}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    aria-label="Duplicate section"
                >
                    <Copy size={12} />
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteSection(section.id) }}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    aria-label="Delete section"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    )
}
