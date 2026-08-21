import { describe, expect, it } from 'vitest'
import { hasValidImageSignature } from '@/lib/media/image-signature'

describe('hasValidImageSignature', () => {
    it.each([
        ['JPEG', [0xFF, 0xD8, 0xFF]],
        ['PNG', [0x89, 0x50, 0x4E, 0x47]],
        ['ICO', [0x00, 0x00, 0x01, 0x00]],
        ['WebP', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
    ])('accepts a valid %s signature', (_name, bytes) => {
        expect(hasValidImageSignature(Uint8Array.from(bytes))).toBe(true)
    })

    it('rejects content without a supported image signature', () => {
        expect(hasValidImageSignature(Uint8Array.from([1, 2, 3, 4]))).toBe(false)
    })
})
