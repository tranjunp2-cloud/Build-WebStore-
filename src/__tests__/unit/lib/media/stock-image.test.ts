// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import {
    downloadAndValidateStockImage,
    isAllowedStockDownloadUrl,
    stockObjectKey,
    validateStockImageBytes,
} from '@/lib/media/stock-image'

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0x00])

describe('F38 stock image validation', () => {
    it('[TC-F38-SEC-01] allows only HTTPS stock/curated hosts', () => {
        // Arrange / Act / Assert
        expect(isAllowedStockDownloadUrl('https://upload.wikimedia.org/file.jpg')).toBe(true)
        expect(isAllowedStockDownloadUrl('https://cdn.pixabay.com/file.jpg')).toBe(true)
        expect(isAllowedStockDownloadUrl('https://images.unsplash.com/file.jpg')).toBe(true)
        expect(isAllowedStockDownloadUrl('http://cdn.pixabay.com/file.jpg')).toBe(false)
        expect(isAllowedStockDownloadUrl('https://example.com/file.jpg')).toBe(false)
    })

    it('[TC-F38-SEC-02] rejects MIME/magic mismatch and oversize bytes', () => {
        // Arrange
        const pngMime = 'image/png'

        // Act / Assert
        expect(() => validateStockImageBytes(JPEG, pngMime)).toThrow('STOCK_IMAGE_MAGIC_MISMATCH')
        expect(() => validateStockImageBytes(JPEG, 'text/html')).toThrow(
            'STOCK_IMAGE_INVALID_CONTENT_TYPE',
        )
        expect(() => validateStockImageBytes(JPEG, 'image/jpeg', 3)).toThrow(
            'STOCK_IMAGE_TOO_LARGE',
        )
    })

    it('[TC-F38-SEC-01] validates every redirect target before fetching it', async () => {
        // Arrange
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(null, {
                status: 302,
                headers: { location: 'https://attacker.example/image.jpg' },
            }),
        )

        // Act / Assert
        await expect(
            downloadAndValidateStockImage('https://pixabay.com/get/image.jpg', fetchMock),
        ).rejects.toThrow('STOCK_IMAGE_SSRF_BLOCKED')
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' })
    })

    it('[TC-F38-PERSIST-02] builds a deterministic path-safe object key', () => {
        // Arrange / Act
        const key = stockObjectKey('wikimedia', 'File:Cake / hero', 'jpg')

        // Assert
        expect(key).toBe('stock/wikimedia/File%3ACake%20%2F%20hero.jpg')
    })
})
