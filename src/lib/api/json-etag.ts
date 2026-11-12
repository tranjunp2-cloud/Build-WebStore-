import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'

/**
 * Conditional GET for authenticated JSON reads the dashboard polls or reloads (TC-PERF-024, TC-PERF-080..083).
 *
 * The body carries a weak ETag (hash of the exact JSON) and `Cache-Control: private, max-age=0`, so the browser
 * revalidates every time and sends `If-None-Match`; an unchanged body is answered `304` with no body. The database
 * work still runs (the tag is the hash of the fresh answer), but the response, its parsing and the React re-render
 * on the client are skipped when nothing changed.
 */
export function jsonEtag(json: string): string {
    return `W/"${createHash('sha1').update(json).digest('base64url')}"`
}

/** `If-None-Match` matches when any listed tag (weak or strong form) equals the ETag, or it is `*`. */
export function etagMatches(header: string | null, etag: string): boolean {
    if (!header) return false
    const bare = etag.replace(/^W\//, '')
    return header.split(',').some((tag) => {
        const value = tag.trim()
        return value === '*' || value.replace(/^W\//, '') === bare
    })
}

/** 200 with the JSON body + ETag, or 304 (no body) when the request's `If-None-Match` already names this body. */
export function jsonWithEtag(
    body: unknown,
    request: Request,
    init: { status?: number; headers?: Record<string, string> } = {},
): NextResponse {
    const json = JSON.stringify(body)
    const etag = jsonEtag(json)
    const headers: Record<string, string> = { 'Cache-Control': 'private, max-age=0', ...init.headers, ETag: etag }
    if (etagMatches(request.headers.get('if-none-match'), etag)) {
        return new NextResponse(null, { status: 304, headers })
    }
    return new NextResponse(json, {
        status: init.status ?? 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
    })
}
