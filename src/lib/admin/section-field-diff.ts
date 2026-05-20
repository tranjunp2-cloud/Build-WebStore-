/**
 * section-field-diff.ts
 *
 * Helpers for diffing old vs new template sections to count user-edited fields.
 * Used by the save-sections route to populate fieldsEdited on ai_generation_records.
 *
 * Phase 04 — override-rate tracking.
 * Plan: plans/260420-1028-studio-ui-visual-feature-audit/phase-04-schema-additions.md
 */

// ── Flatten config ─────────────────────────────────────────────────────────

/**
 * Flatten a section's config into leaf key→value pairs for diffing.
 * Only primitive values (string, number, boolean) are included.
 * Arrays of primitives are indexed; arrays of objects recurse one level.
 */
export function flattenConfig(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, val] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
            result[path] = String(val)
        } else if (Array.isArray(val)) {
            val.forEach((item, i) => {
                if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
                    result[`${path}[${i}]`] = String(item)
                } else if (item !== null && typeof item === 'object') {
                    const sub = flattenConfig(item as Record<string, unknown>, `${path}[${i}]`)
                    Object.assign(result, sub)
                }
            })
        } else if (val !== null && typeof val === 'object') {
            const sub = flattenConfig(val as Record<string, unknown>, path)
            Object.assign(result, sub)
        }
    }
    return result
}

// ── Count changed fields ───────────────────────────────────────────────────

export type SectionLike = {
    id: string
    blockType: string
    config: Record<string, unknown>
}

/**
 * Count distinct fields that changed between old and new section arrays.
 * Matching is by section `id`; added/removed blocks count all their fields as changed.
 * Whitespace-only changes and null→empty changes are ignored.
 */
export function countChangedFields(
    oldSections: Array<Record<string, unknown>>,
    newSections: SectionLike[],
): number {
    const normalize = (v: string) => v.trim()

    const oldMap = new Map(
        oldSections.map((s) => [
            String(s['id'] ?? ''),
            flattenConfig((s['config'] as Record<string, unknown>) ?? {}),
        ]),
    )

    let changed = 0

    for (const ns of newSections) {
        const oldFlat = oldMap.get(ns.id)
        if (!oldFlat) {
            // New block added — count all its fields as "edited"
            changed += Object.keys(flattenConfig(ns.config)).length
            continue
        }
        const newFlat = flattenConfig(ns.config)
        for (const [k, newVal] of Object.entries(newFlat)) {
            const oldVal = oldFlat[k] ?? ''
            if (normalize(newVal) !== normalize(oldVal)) {
                changed++
            }
        }
    }

    // Sections removed entirely (id in old but not in new) — count as edited
    const newIds = new Set(newSections.map((s) => s.id))
    for (const [oldId, oldFlat] of oldMap) {
        if (!newIds.has(oldId)) {
            changed += Object.keys(oldFlat).length
        }
    }

    return changed
}
