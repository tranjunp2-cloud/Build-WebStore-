import { describe, expect, it } from 'vitest'
import { resolveGalleryImages } from '@/blocks/gallery/resolve-images'

describe('[TC-GENPERF-W3-11] gallery image deduplication', () => {
    const fallbacks = Array.from({ length: 6 }, (_, index) => `https://fallback.test/${index}.jpg`)

    it('replaces media rows uploaded from the same Pixabay source', () => {
        const images = resolveGalleryImages([
            { image: { url: 'https://s3.test/pool.jpg', filename: 'pool-12345-1000.jpg' }, caption: 'A' },
            { image: { url: 'https://s3.test/legacy.jpg', filename: 'gallery-12345-2000.jpg' }, caption: 'B' },
        ], fallbacks)

        expect(images[0]!.image.url).toBe('https://s3.test/pool.jpg')
        expect(images[1]!.image.url).toBe(fallbacks[1])
        expect(images[1]!.caption).toBe('B')
    })

    it('replaces an exact duplicate URL while preserving distinct images', () => {
        const images = resolveGalleryImages([
            { image: { url: 'https://cdn.test/burger.jpg' } },
            { image: { url: 'https://cdn.test/crab.jpg' } },
            { image: { url: 'https://cdn.test/burger.jpg' } },
        ], fallbacks)

        expect(images.slice(0, 3).map((item) => item.image.url)).toEqual([
            'https://cdn.test/burger.jpg',
            'https://cdn.test/crab.jpg',
            fallbacks[2],
        ])
    })
})
