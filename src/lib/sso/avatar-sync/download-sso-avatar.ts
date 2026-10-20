import { AVATAR_MAX_BYTES } from '@/lib/profile/schemas'

const DOWNLOAD_TIMEOUT_MS = 10_000

/**
 * Any reason the SSO avatar could not be fetched safely — caller keeps last-known avatar.
 * `retryable` = transient (network, timeout, 5xx); false = deterministic (bad URL/host, size, type, 4xx)
 * so the route can answer 422 and SSO does not retry pointlessly.
 */
export class AvatarDownloadError extends Error {
    readonly retryable: boolean

    constructor(message: string, retryable = false) {
        super(message)
        this.name = 'AvatarDownloadError'
        this.retryable = retryable
    }
}

export type DownloadedAvatar = {
    buffer: Buffer
    mimetype: 'image/jpeg' | 'image/png'
    ext: 'jpg' | 'png'
}

/**
 * Basic URL check for the SSO avatar link: HTTPS without credentials or custom port
 * (same rule as PW1 media import — no host allow-list; the endpoint is super-admin only).
 */
export function validateSsoAvatarUrl(rawUrl: string): URL {
    let url: URL
    try {
        url = new URL(rawUrl)
    } catch {
        throw new AvatarDownloadError('Avatar URL is not a valid URL')
    }
    if (url.protocol !== 'https:' || url.port || url.username || url.password) {
        throw new AvatarDownloadError('Avatar URL must be HTTPS without credentials or custom port')
    }
    return url
}

/** Same JPEG/PNG magic-byte rule as the local avatar upload (users/me/avatar). */
export function detectAvatarMimetype(buffer: Buffer): DownloadedAvatar['mimetype'] | null {
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg'
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png'
    return null
}

async function readCapped(body: ReadableStream<Uint8Array>, limit: number): Promise<Buffer> {
    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.length
            if (size > limit) {
                await reader.cancel()
                throw new AvatarDownloadError('Avatar exceeds size limit')
            }
            chunks.push(value)
        }
    } finally {
        reader.releaseLock()
    }
    return Buffer.concat(chunks)
}

/** Download an SSO avatar with URL, size and content checks. Throws AvatarDownloadError. */
export async function downloadSsoAvatar(rawUrl: string): Promise<DownloadedAvatar> {
    const url = validateSsoAvatarUrl(rawUrl)

    let response: Response
    try {
        // 'manual': never follow a redirect, and get the 3xx response back so it can be told apart from a network error
        response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
    } catch (err) {
        throw new AvatarDownloadError(`Avatar fetch failed: ${err instanceof Error ? err.message : String(err)}`, true)
    }
    if (response.status !== 200 || !response.body) {
        await response.body?.cancel()
        const isRedirect = response.status >= 300 && response.status < 400
        throw new AvatarDownloadError(
            isRedirect ? `Avatar URL redirects (HTTP ${response.status}); redirects are not followed` : `Avatar fetch returned HTTP ${response.status}`,
            response.status >= 500 || response.status === 429,
        )
    }
    if (Number(response.headers.get('content-length')) > AVATAR_MAX_BYTES) {
        await response.body.cancel()
        throw new AvatarDownloadError('Avatar exceeds size limit')
    }

    let buffer: Buffer
    try {
        buffer = await readCapped(response.body, AVATAR_MAX_BYTES)
    } catch (err) {
        if (err instanceof AvatarDownloadError) throw err
        // Timeout or socket reset while streaming the body → transient
        throw new AvatarDownloadError(`Avatar read failed: ${err instanceof Error ? err.message : String(err)}`, true)
    }
    const mimetype = detectAvatarMimetype(buffer)
    if (!mimetype) throw new AvatarDownloadError('Avatar is not a JPEG or PNG image')
    return { buffer, mimetype, ext: mimetype === 'image/png' ? 'png' : 'jpg' }
}
