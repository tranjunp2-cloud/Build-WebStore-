export const SUPPORTED_IMAGE_MIMES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/x-icon',
    'image/vnd.microsoft.icon',
])

/**
 * Magic-byte validation shared by buffered Payload uploads and direct S3
 * uploads. Twelve bytes cover WebP's signature at offset 8.
 */
export function hasValidImageSignature(data: Uint8Array): boolean {
    const signatures = [
        { bytes: [0xFF, 0xD8, 0xFF], offset: 0 },       // JPEG
        { bytes: [0x89, 0x50, 0x4E, 0x47], offset: 0 }, // PNG
        { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // WebP (RIFF????WEBP)
        { bytes: [0x00, 0x00, 0x01, 0x00], offset: 0 }, // ICO
    ]

    return signatures.some(signature =>
        signature.bytes.every((byte, index) => data[signature.offset + index] === byte),
    )
}
