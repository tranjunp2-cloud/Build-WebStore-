import { describe, expect, it } from 'vitest'
import { resolveMetadataImageUrl } from '@/lib/seo/metadata-image'

describe('[TC-GH-1717] resolveMetadataImageUrl', () => {
    it('returns an absolute or relative URL string', () => {
        // Arrange
        const absoluteUrl = 'https://cdn.example.com/social-image.png'
        const relativeUrl = '/media/social-image.png'

        // Act
        const absoluteResult = resolveMetadataImageUrl(absoluteUrl)
        const relativeResult = resolveMetadataImageUrl(relativeUrl)

        // Assert
        expect(absoluteResult).toBe(absoluteUrl)
        expect(relativeResult).toBe(relativeUrl)
    })

    it('extracts the URL from a populated Payload media relationship', () => {
        // Arrange
        const media = {
            id: 42,
            url: 'https://cdn.example.com/payload-media.png',
            filename: 'payload-media.png',
        }

        // Act
        const result = resolveMetadataImageUrl(media)

        // Assert
        expect(result).toBe(media.url)
    })

    it('ignores unresolved media IDs and malformed media values', () => {
        // Arrange
        const candidates = [42, null, undefined, {}, { url: null }, { url: 99 }]

        // Act
        const result = resolveMetadataImageUrl(...candidates)

        // Assert
        expect(result).toBeNull()
    })

    it('falls back to the first candidate that resolves to a URL', () => {
        // Arrange
        const siteOgImage = { id: 7, url: '/media/site-og-image.png' }
        const brandingLogo = '/media/logo.png'

        // Act
        const result = resolveMetadataImageUrl(
            42,
            { id: 8 },
            siteOgImage,
            brandingLogo,
        )

        // Assert
        expect(result).toBe(siteOgImage.url)
    })

    it('ignores blank URL values', () => {
        // Arrange
        const fallbackUrl = '/media/fallback.png'

        // Act
        const result = resolveMetadataImageUrl('   ', { url: ' ' }, fallbackUrl)

        // Assert
        expect(result).toBe(fallbackUrl)
    })
})
