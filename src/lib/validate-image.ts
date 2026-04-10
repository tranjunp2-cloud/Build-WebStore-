/**
 * Validate image file magic bytes (TC-F17-02-13)
 * Detects real file type regardless of extension
 */
export function validateImageMagicBytes(buffer: ArrayBuffer): {
    valid: boolean
    detectedType: string | null
} {
    const bytes = new Uint8Array(buffer)
    if (bytes.length < 4) return { valid: false, detectedType: null }

    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        return { valid: true, detectedType: 'image/jpeg' }
    }

    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        return { valid: true, detectedType: 'image/png' }
    }

    return { valid: false, detectedType: null }
}

/** Max upload size: 10MB (TC-F17-02-11) */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024
