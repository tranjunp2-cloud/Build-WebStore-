import { blockRegistry } from '@/blocks/registry'

/** Extract compact text summary from nested array/object fields.
 *  Returns null if field has no text worth showing. */
export function summarizeNestedField(key: string, value: unknown): string | null {
    // Handle arrays (ctaButtons, features, items, links, tags, etc.)
    if (Array.isArray(value) && value.length > 0) {
        const capped = value.slice(0, 5) // cap at 5 items to control tokens
        const suffix = value.length > 5 ? ` …+${value.length - 5} more` : ''

        // Array of primitive strings (e.g., pricing features: ["Free tier", "Up to 3 users"])
        if (typeof capped[0] === 'string') {
            const strings = capped
                .filter((s): s is string => typeof s === 'string' && s.length > 0)
                .map(s => `"${s.length > 60 ? s.slice(0, 60) + '…' : s}"`)
            if (strings.length === 0) return null
            return `${key}: [${strings.join(', ')}${suffix}]`
        }

        // Array of objects (ctaButtons, features, items, links, etc.)
        const summaries = capped
            .filter(item => item && typeof item === 'object')
            .map(item => {
                const obj = item as Record<string, unknown>
                const textParts: string[] = []
                for (const [k, v] of Object.entries(obj)) {
                    if (typeof v === 'string' && v.length > 0 && v.length < 200) {
                        textParts.push(`${k}:"${v.length > 60 ? v.slice(0, 60) + '…' : v}"`)
                    }
                }
                return textParts.length > 0 ? `{${textParts.join(', ')}}` : null
            })
            .filter(Boolean)

        if (summaries.length === 0) return null
        return `${key}: [${summaries.join(', ')}${suffix}]`
    }

    // Handle single objects (badge, cta, image with alt text)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>
        const textParts: string[] = []
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string' && v.length > 0 && v.length < 200) {
                textParts.push(`${k}:"${v.length > 60 ? v.slice(0, 60) + '…' : v}"`)
            }
        }
        if (textParts.length === 0) return null
        return `${key}: {${textParts.join(', ')}}`
    }

    return null
}

/** Build a bounded, always-valid-JSON copy of a block for inclusion in the
 *  SELECTED BLOCK FULL DATA section. Caps string values + array lengths so
 *  the stringified result is never truncated mid-structure. */
export function buildSafeBlockCopy(value: unknown, depth = 0): unknown {
    if (depth > 5) return '[deep]'
    if (typeof value === 'string') return value.length > 300 ? value.slice(0, 300) + '…' : value
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
    if (Array.isArray(value)) {
        const capped: unknown[] = value.slice(0, 10).map(v => buildSafeBlockCopy(v, depth + 1))
        if (value.length > 10) capped.push(`…+${value.length - 10} more`)
        return capped
    }
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = buildSafeBlockCopy(v, depth + 1)
        }
        return out
    }
    return null
}

// Build a concise block summary so AI knows the page structure and current content
// Spec §1.3: "compact summary, NOT full JSON" — limit to key text fields, truncate long values
const TEXT_FIELD_ALLOW = new Set([
    'headline', 'subheadline', 'title', 'subtitle', 'description',
    'ctaText', 'buttonText', 'label', 'tagline', 'copyright',
    'bodyText', 'sectionLabel', 'name', 'quote', 'content',
    'placeholder', 'html', 'code',
])

export function summarizeBlockFields(b: Record<string, unknown>): string[] {
    const fields: string[] = []
    for (const [k, v] of Object.entries(b)) {
        if (['blockType', 'variant', 'id', '_order', '_path'].includes(k)) continue

        // Top-level strings (existing behavior)
        if (typeof v === 'string' && v.length > 0 && TEXT_FIELD_ALLOW.has(k)) {
            fields.push(`${k}: "${v.length > 80 ? v.slice(0, 80) + '…' : v}"`)
            continue
        }

        // Nested arrays and objects
        const nested = summarizeNestedField(k, v)
        if (nested) fields.push(nested)
    }
    return fields
}

export function aiVisibleBlockMetas() {
    return blockRegistry.getAllMeta().filter(m => m.aiVisible !== false)
}

