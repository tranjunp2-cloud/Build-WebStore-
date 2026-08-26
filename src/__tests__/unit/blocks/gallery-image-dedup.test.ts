import { describe, expect, it } from 'vitest'
import { resolveGalleryImages } from '@/blocks/gallery/resolve-images'

describe('[TC-GENPERF-W3-11] generated gallery provenance', () => {
    const fallbacks = Array.from({ length: 6 }, (_, index) => `https://fallback.test/${index}.jpg`)

    it('keeps generated Pixabay media instead of replacing it with fallback URLs', () => {
        const images = resolveGalleryImages([
            { image: { url: 'https://s3.test/pool.jpg', filename: 'pool-12345-1000.jpg' }, caption: 'A' },
            { image: { url: 'https://s3.test/legacy.jpg', filename: 'gallery-12345-2000.jpg' }, caption: 'B' },
        ], fallbacks)

        expect(images[0]!.image.url).toBe('https://s3.test/pool.jpg')
        expect(images[1]!.image.url).toBe('https://s3.test/legacy.jpg')
        expect(images[1]!.caption).toBe('B')
        expect(images).toHaveLength(2)
    })

    it('does not introduce another provider when a generated URL repeats', () => {
        const images = resolveGalleryImages([
            { image: { url: 'https://cdn.test/burger.jpg' } },
            { image: { url: 'https://cdn.test/crab.jpg' } },
            { image: { url: 'https://cdn.test/burger.jpg' } },
        ], fallbacks)

        expect(images.slice(0, 3).map((item) => item.image.url)).toEqual([
            'https://cdn.test/burger.jpg',
            'https://cdn.test/crab.jpg',
            'https://cdn.test/burger.jpg',
        ])
        expect(images).toHaveLength(3)
    })
})
