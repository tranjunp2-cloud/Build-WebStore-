/**
 * snapshot-field-counter.ts
 *
 * Counts editable fields in an AI generation output snapshot for override-rate tracking.
 * Extracted from capture-generation.ts to keep that file under 200 lines.
 *
 * Phase 04 — override-rate schema additions.
 * Plan: plans/260420-1028-studio-ui-visual-feature-audit/phase-04-schema-additions.md
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Structural keys on block objects that are not user-editable content fields.
 * These are excluded from fieldsTotal/fieldsFilled counts.
 */
const FIELD_SKIP_KEYS = new Set([
    'blockType', 'id', '_order', '_uuid', 'variant', 'path', 'siteName',
])

// ── Block-level counter ───────────────────────────────────────────────────────

/**
 * Counts editable text/number/boolean leaf fields on a single block object.
 * Recursively walks arrays of sub-objects (e.g. feature cards, gallery items).
 *
 * "filled" = non-empty string, or any number/boolean value.
 */
function countBlockFields(block: Record<string, unknown>): { total: number; filled: number } {
    let total = 0
    let filled = 0

    for (const [key, val] of Object.entries(block)) {
        if (FIELD_SKIP_KEYS.has(key)) continue

        if (Array.isArray(val)) {
            for (const item of val) {
                if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
                    const sub = countBlockFields(item as Record<string, unknown>)
                    total += sub.total
                    filled += sub.filled
                }
            }
        } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
            total++
            if (typeof val === 'string') {
                if (val.trim().length > 0) filled++
            } else {
                filled++
            }
        } else if (val !== null && typeof val === 'object') {
            const sub = countBlockFields(val as Record<string, unknown>)
            total += sub.total
            filled += sub.filled
        }
    }

    return { total, filled }
}

// ── Snapshot-level counter (public) ──────────────────────────────────────────

/**
 * Derives fieldsTotal + fieldsFilled from an AI generation output snapshot.
 *
 * Handles both output shapes:
 *   - Single-page: `{ blocks: [...] }`
 *   - Multi-page:  `{ pages: [{ layout: [...] }] }`
 *
 * Returns `{ fieldsTotal: 0, fieldsFilled: 0 }` for empty or truncated snapshots.
 */
export function countSnapshotFields(
    snapshot: Record<string, unknown>,
): { fieldsTotal: number; fieldsFilled: number } {
    if (snapshot._truncated) return { fieldsTotal: 0, fieldsFilled: 0 }

    let total = 0
    let filled = 0

    // Multi-page structure: { pages: [{ layout: [...blocks] }] }
    if (Array.isArray(snapshot.pages)) {
        for (const page of snapshot.pages as unknown[]) {
            const p = page as Record<string, unknown>
            if (Array.isArray(p.layout)) {
                for (const block of p.layout as unknown[]) {
                    const counts = countBlockFields(block as Record<string, unknown>)
                    total += counts.total
                    filled += counts.filled
                }
            }
        }
    }

    // Single-page structure: { blocks: [...blocks] }
    if (Array.isArray(snapshot.blocks)) {
        for (const block of snapshot.blocks as unknown[]) {
            const counts = countBlockFields(block as Record<string, unknown>)
            total += counts.total
            filled += counts.filled
        }
    }

    return { fieldsTotal: total, fieldsFilled: filled }
}
