// Upload size limits per media type — GH-1284.
// Enforced BOTH client-side (early UX reject, before the request is even sent)
// and server-side (defense in depth, before the file is buffered into memory).
// Video was the reported failure: oversized files buffered through the
// serverless /api/media/upload route hit the 120s maxDuration and time out.
export const UPLOAD_LIMITS = {
    // Images are also compressed client-side (compress-image.ts) before upload,
    // so this is an upper guard on the raw pick.
    image: 10 * 1024 * 1024, // 10 MB
    video: 100 * 1024 * 1024, // 100 MB
    pdf: 20 * 1024 * 1024, // 20 MB
} as const

export type UploadKind = keyof typeof UPLOAD_LIMITS

export function uploadKindFromMime(mime: string): UploadKind | null {
    if (mime.startsWith('image/')) return 'image'
    if (mime.startsWith('video/')) return 'video'
    if (mime === 'application/pdf') return 'pdf'
    return null
}

const toMb = (bytes: number) => Math.round(bytes / (1024 * 1024))

/** Human-readable max size for a media kind, e.g. "100MB". */
export function uploadLimitLabel(kind: UploadKind): string {
    return `${toMb(UPLOAD_LIMITS[kind])}MB`
}

/**
 * Returns an error message if the file exceeds its per-type limit, else null.
 * Unknown mime types return null here — they are rejected by the collection's
 * `mimeTypes` gate, not by size.
 */
export function checkUploadSize(mime: string, size: number): string | null {
    const kind = uploadKindFromMime(mime)
    if (!kind) return null
    const limit = UPLOAD_LIMITS[kind]
    if (size > limit) {
        return `File too large (${toMb(size)}MB). Maximum ${toMb(limit)}MB for ${kind}.`
    }
    return null
}
