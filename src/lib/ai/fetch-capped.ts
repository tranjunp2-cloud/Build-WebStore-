/**
 * Two small fetch guards shared by the server-side downloaders (url-scraper, stock photo download, library pictures):
 *  - `readBodyCapped` reads a response body chunk by chunk and stops past a byte cap. The count is of the bytes fetch
 *    hands out, i.e. AFTER content decoding, so a few KB of brotli can't become gigabytes in memory before a size check.
 *  - `fetchAllowlisted` fetches with `redirect: 'manual'` and follows at most a couple of hops itself, re-checking the
 *    caller's host / scheme rule on every hop, so an open redirect on an allowlisted host can't send it anywhere else.
 */

export class FetchGuardError extends Error {
    constructor(
        readonly code: 'BLOCKED' | 'TOO_MANY_REDIRECTS' | 'TOO_LARGE',
        message: string,
    ) {
        super(message)
        this.name = 'FetchGuardError'
    }
}

/**
 * The body as bytes, refusing (`TOO_LARGE`) as soon as more than `maxBytes` arrived; a declared content-length over the
 * cap is refused before reading. `onTooLarge` runs first (e.g. to abort the request's controller).
 */
export async function readBodyCapped(response: Response, maxBytes: number, onTooLarge?: () => void): Promise<Uint8Array> {
    const tooLarge = async (cancel: () => Promise<unknown>) => {
        onTooLarge?.()
        await cancel().catch(() => undefined)
        return new FetchGuardError('TOO_LARGE', `Response too large (over ${maxBytes} bytes)`)
    }
    const declared = Number(response.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > maxBytes) throw await tooLarge(async () => response.body?.cancel())
    if (!response.body) return new Uint8Array(0)

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > maxBytes) throw await tooLarge(() => reader.cancel())
        chunks.push(value)
    }
    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
        out.set(chunk, offset)
        offset += chunk.byteLength
    }
    return out
}

const isRedirect = (status: number) => status >= 300 && status < 400

/**
 * `fetch` that only ever talks to addresses `isAllowed` accepts: the first URL and every redirect target are checked
 * before a request goes out, and at most `maxRedirects` hops are followed (default 2).
 */
export async function fetchAllowlisted(url: string | URL, init: RequestInit, isAllowed: (url: URL) => boolean, maxRedirects = 2): Promise<Response> {
    let current = new URL(url)
    for (let hop = 0; ; hop++) {
        if (!isAllowed(current)) throw new FetchGuardError('BLOCKED', `Address not allowed: ${current.origin}`)
        // the first request keeps the caller's URL exactly as given
        const response = await fetch(hop === 0 ? url : current.href, { ...init, redirect: 'manual' })
        const location = isRedirect(response.status) ? response.headers.get('location') : null
        if (!location) return response
        await response.body?.cancel().catch(() => undefined)
        if (hop >= maxRedirects) throw new FetchGuardError('TOO_MANY_REDIRECTS', 'Too many redirects')
        current = new URL(location, current)
    }
}
