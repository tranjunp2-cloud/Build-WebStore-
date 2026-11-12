export const MAX_PRODUCT_IMAGES = 5

function mediaId(value: unknown): string | undefined {
    if (value !== null && typeof value === 'object' && 'id' in value) return mediaId(value.id)
    return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

/** Above five, only retain/reorder/remove existing occurrences; no new media or duplicates. */
export function allowsProductImages(next: readonly unknown[], previous: readonly unknown[] = []): boolean {
    if (next.length <= MAX_PRODUCT_IMAGES) return true
    if (previous.length <= MAX_PRODUCT_IMAGES || next.length > previous.length) return false
    const remaining = new Map<string, number>()
    for (const image of previous) {
        const id = mediaId(image)
        if (id === undefined) return false
        remaining.set(id, (remaining.get(id) ?? 0) + 1)
    }
    for (const image of next) {
        const id = mediaId(image)
        if (id === undefined || !remaining.get(id)) return false
        remaining.set(id, remaining.get(id)! - 1)
    }
    return true
}
