import type { GalleryConfig } from './config'

type RawGalleryItem = {
    image?: unknown
    caption?: unknown
}

function imageIdentity(image: Record<string, unknown>): string | null {
    const filename = typeof image.filename === 'string' ? image.filename : ''
    const pixabaySource = filename.match(/(?:^|\/)(?:pool|gallery)-(\d+)-/i)?.[1]
    if (pixabaySource) return `pixabay:${pixabaySource}`

    const url = typeof image.url === 'string' ? image.url.trim() : ''
    return url ? `url:${url}` : null
}

export function resolveGalleryImages(
    rawImages: unknown[],
    fallbackUrls: string[],
): GalleryConfig['images'] {
    const seen = new Set<string>()
    // Generated galleries already carry Pixabay Media IDs. Do not pad a real
    // gallery with checked-in fallback URLs merely to reach the legacy six
    // slots; that mixed two providers in one block.
    const slotCount = rawImages.length > 0 ? rawImages.length : fallbackUrls.length

    const fallbackFor = (index: number, caption: string): GalleryConfig['images'][number] => {
        for (let offset = 0; offset < fallbackUrls.length; offset++) {
            const url = fallbackUrls[(index + offset) % fallbackUrls.length]!
            const key = `url:${url}`
            if (seen.has(key)) continue
            seen.add(key)
            return { image: { url, alt: `Gallery image ${index + 1}` }, caption }
        }
        const url = fallbackUrls[index % fallbackUrls.length] ?? ''
        return { image: { url, alt: `Gallery image ${index + 1}` }, caption }
    }

    return Array.from({ length: slotCount }, (_, index) => {
        const item = rawImages[index] as RawGalleryItem | undefined
        const caption = typeof item?.caption === 'string' ? item.caption : ''
        const image = item?.image
        if (image && typeof image === 'object') {
            const record = image as Record<string, unknown>
            const key = imageIdentity(record)
            if (key) seen.add(key)
            return item as GalleryConfig['images'][number]
        }
        return fallbackFor(index, caption)
    })
}
