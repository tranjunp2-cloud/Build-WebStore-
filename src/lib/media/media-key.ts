import { randomUUID } from 'crypto'

// Media S3 keys are FLAT filenames (the media upload collection has no `prefix`;
// see spike report 260715). We generate the key server-side so the client can
// never dictate an arbitrary path, and add a UUID so bypassing Payload's own
// filename-uniqueness can't cause two rows to collide on one object.

const EXT_BY_MIME: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
}

/** Sanitize the user-supplied base name: strip directories and anything that
 *  isn't a safe filename char, collapse repeats, cap length. Never trusts the
 *  original extension — the extension comes from the validated mime. */
function sanitizeBase(name: string): string {
    const base = name.replace(/\\/g, '/').split('/').pop() ?? '' // drop any path
    const stem = base.replace(/\.[^.]+$/, '') // drop original extension
    const safe = stem
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
    return safe || 'video'
}

/**
 * Build the S3 object key (== stored filename) for a video upload.
 * Format: `u{userId}-{safeBase}-{uuid}.{ext}` — flat, collision-safe, traceable.
 */
export function buildMediaKey({
    userId,
    filename,
    mime,
}: {
    userId: string | number
    filename: string
    mime: string
}): string {
    const ext = EXT_BY_MIME[mime]
    if (!ext) throw new Error(`Unsupported mime for media key: ${mime}`)
    const safeUser = String(userId).replace(/[^a-z0-9]+/gi, '')
    return `u${safeUser}-${sanitizeBase(filename)}-${randomUUID()}.${ext}`
}
