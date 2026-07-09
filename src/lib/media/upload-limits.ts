// Upload size limits per media type — GH-1284.
// Enforced BOTH client-side (early UX reject, before the request is even sent)
// and server-side. On the server there are two gates in /api/media/upload:
//   1. checkContentLength() on the declared Content-Length BEFORE formData()
//      parses/buffers the body — the actual "reject before buffering" guard.
//   2. checkUploadSize() on the real parsed size — precise per-type enforcement.
// Video was the reported failure: oversized files buffered through the route
// hit the 120s maxDuration and time out.
//
// NOTE: distinct from the client compression targets — processImageFile()
// (~2MB) and ImageUploader's maxSizeMB (5MB) shrink images before upload; these
// are the hard reject ceilings that sit above them.
export const UPLOAD_LIMITS = {
    image: 10 * 1024 * 1024, // 10 MB
    video: 100 * 1024 * 1024, // 100 MB
    pdf: 20 * 1024 * 1024, // 20 MB
} as const

export type UploadKind = keyof typeof UPLOAD_LIMITS

/** Largest per-type limit — the absolute ceiling any single upload may reach. */
export const MAX_UPLOAD_BYTES = Math.max(...Object.values(UPLOAD_LIMITS))

// Multipart framing (boundaries, field headers, the `alt` field) adds a small
// overhead on top of the raw file bytes, so the pre-parse Content-Length guard
// allows modest slack above MAX_UPLOAD_BYTES. Exact per-type enforcement still
// happens after parsing via checkUploadSize().
const CONTENT_LENGTH_CEILING = MAX_UPLOAD_BYTES + 1024 * 1024 // +1 MB slack

export function uploadKindFromMime(mime: string): UploadKind | null {
    if (mime.startsWith('image/')) return 'image'
    if (mime.startsWith('video/')) return 'video'
    if (mime === 'application/pdf') return 'pdf'
    return null
}

// Ceil so a file just over its limit never displays as equal to the limit
// (e.g. a 10.4MB image reads as "11MB", not "10MB").
const toMb = (bytes: number) => Math.ceil(bytes / (1024 * 1024))

/** Human-readable max size for a media kind, e.g. "100MB". */
export function uploadLimitLabel(kind: UploadKind): string {
    return `${toMb(UPLOAD_LIMITS[kind])}MB`
}

/**
 * Coarse guard on the declared Content-Length, checked BEFORE the body is
 * parsed/buffered. Rejects anything over the absolute ceiling regardless of
 * mime (closes the unknown/spoofed-mime gap for the RAM-exhaustion path).
 * Content-Length is client-set, so this is best-effort: a header of 0/missing
 * or an understated value falls through to checkUploadSize() after parsing.
 */
export function checkContentLength(declaredBytes: number): string | null {
    if (Number.isFinite(declaredBytes) && declaredBytes > CONTENT_LENGTH_CEILING) {
        return `File too large. Maximum ${toMb(MAX_UPLOAD_BYTES)}MB.`
    }
    return null
}

/**
 * Returns an error message if the file exceeds its per-type limit, else null.
 * Unknown mime types return null here — they are rejected by the collection's
 * `mimeTypes` gate, not by size (the Content-Length ceiling covers the RAM path).
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
