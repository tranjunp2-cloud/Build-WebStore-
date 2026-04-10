import { describe, it, expect } from 'vitest'
import { validateImageMagicBytes, MAX_IMAGE_SIZE } from '@/lib/validate-image'

// ─── TC-F17-02-13: Magic Byte File Validation ───────────────────────────

describe('validateImageMagicBytes [TC-F17-02-13]', () => {
    it('detects valid JPEG (FF D8 FF)', () => {
        const buffer = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x00, 0x00, 0x00]).buffer
        const result = validateImageMagicBytes(buffer)
        expect(result.valid).toBe(true)
        expect(result.detectedType).toBe('image/jpeg')
    })

    it('detects valid PNG (89 50 4E 47)', () => {
        const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).buffer
        const result = validateImageMagicBytes(buffer)
        expect(result.valid).toBe(true)
        expect(result.detectedType).toBe('image/png')
    })

    it('rejects EXE renamed to JPG (4D 5A)', () => {
        const buffer = new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]).buffer
        const result = validateImageMagicBytes(buffer)
        expect(result.valid).toBe(false)
        expect(result.detectedType).toBeNull()
    })

    it('rejects GIF file (47 49 46 38)', () => {
        const buffer = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]).buffer
        const result = validateImageMagicBytes(buffer)
        expect(result.valid).toBe(false)
        expect(result.detectedType).toBeNull()
    })

    it('rejects buffer shorter than 4 bytes', () => {
        const buffer = new Uint8Array([0xFF, 0xD8]).buffer
        const result = validateImageMagicBytes(buffer)
        expect(result.valid).toBe(false)
        expect(result.detectedType).toBeNull()
    })

    it('rejects empty buffer', () => {
        const buffer = new ArrayBuffer(0)
        const result = validateImageMagicBytes(buffer)
        expect(result.valid).toBe(false)
        expect(result.detectedType).toBeNull()
    })
})

describe('MAX_IMAGE_SIZE', () => {
    it('equals 10MB', () => {
        expect(MAX_IMAGE_SIZE).toBe(10 * 1024 * 1024)
    })
})
