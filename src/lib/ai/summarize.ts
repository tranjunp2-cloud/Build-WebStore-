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
