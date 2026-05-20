/** Extract plain text from Payload richText JSON or return string as-is */
export function toPlainText(value: unknown): string {
    if (!value) return ''
    if (typeof value === 'string') {
        if (value.startsWith('{')) {
            try { return toPlainText(JSON.parse(value)) } catch { return value }
        }
        return value
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>
        if (obj.text && typeof obj.text === 'string') return obj.text
        if (Array.isArray(obj.children)) return (obj.children as unknown[]).map(toPlainText).join('')
        if (obj.root) return toPlainText(obj.root)
    }
    return String(value)
}
