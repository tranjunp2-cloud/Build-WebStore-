'use client'
/**
 * builder-inspector-pane.tsx
 * Right pane: dynamic form for the selected section's fields.
 * Uses SECTION_FIELD_SCHEMA; shows "coming soon" for unmapped block types.
 */
import { useBuilderStore } from '@/lib/admin/builder-store'
import { getFieldSchema } from '@/lib/admin/section-field-schema'
import { SectionFieldRenderer } from './section-field-renderer'

export function BuilderInspectorPane() {
    const { sections, selectedId, updateSelected } = useBuilderStore()
    const section = sections.find((s) => s.id === selectedId) ?? null

    if (!section) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-4">
                <p className="text-sm text-muted-foreground">Select a section to edit its properties.</p>
            </div>
        )
    }

    const schema = getFieldSchema(section.blockType)
    const label = section.blockType
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="px-3 py-2 border-b flex-shrink-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspector</p>
                <p className="text-sm font-medium truncate mt-0.5">{label}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {schema ? (
                    schema.map((spec) => (
                        <SectionFieldRenderer
                            key={spec.name}
                            spec={spec}
                            value={section.config[spec.name]}
                            onChange={(val) => updateSelected({ [spec.name]: val })}
                        />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                        <span className="text-2xl">🔧</span>
                        <p className="text-sm font-medium">Inspector coming soon</p>
                        <p className="text-xs text-muted-foreground">
                            Field schema for <strong>{section.blockType}</strong> will be added in a future update.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
