import { UPLOAD_FIELDS } from '@/lib/block-normalization'

const MEDIA_FIELDS = new Set<string>([...UPLOAD_FIELDS, 'posterImage'])

/** Restore populated render media; upload relationship columns still use numeric IDs. */
export function restoreTemplateRenderMedia<T>(value: T, sources: unknown[]): T {
    const mediaById = new Map<number, Record<string, unknown>>()
    const collect = (node: unknown): void => {
        if (Array.isArray(node)) { node.forEach(collect); return }
        if (!node || typeof node !== 'object') return
        for (const [key, child] of Object.entries(node)) {
            if (MEDIA_FIELDS.has(key) && child && typeof child === 'object' && !Array.isArray(child)) {
                const media = child as Record<string, unknown>
                if (typeof media.id === 'number' && Number.isSafeInteger(media.id) && media.id > 0
                    && typeof media.url === 'string' && media.url.length > 0) {
                    mediaById.set(media.id, media)
                }
            }
            collect(child)
        }
    }
    sources.forEach(collect)
    const restore = (node: unknown): unknown => {
        if (Array.isArray(node)) return node.map(restore)
        if (!node || typeof node !== 'object') return node
        return Object.fromEntries(Object.entries(node).map(([key, child]) => {
            const media = MEDIA_FIELDS.has(key) && typeof child === 'number' ? mediaById.get(child) : undefined
            return [key, media ? structuredClone(media) : restore(child)]
        }))
    }
    return restore(value) as T
}
