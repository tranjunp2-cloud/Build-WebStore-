import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    AvatarDownloadError,
    detectAvatarMimetype,
    downloadSsoAvatar,
    validateSsoAvatarUrl,
} from '@/lib/sso/avatar-sync/download-sso-avatar'
import { AVATAR_MAX_BYTES } from '@/lib/profile/schemas'

const HOST = 'sso-bucket.s3.ap-southeast-1.amazonaws.com'
const URL_OK = `https://${HOST}/images/users/1.png`
const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
const JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])
const GIF = Buffer.from('GIF89a')

const okResponse = (bytes: Buffer, headers: Record<string, string> = {}) =>
    new Response(new Uint8Array(bytes), { status: 200, headers })

describe('downloadSsoAvatar (GH-1723)', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        vi.stubGlobal('fetch', fetchMock)
        fetchMock.mockReset()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    // TC-F23-SSO-08: only plain HTTPS links are fetched
    it.each([
        ['http scheme', `http://${HOST}/a.png`],
        ['custom port', `https://${HOST}:8443/a.png`],
        ['credentials', `https://u:p@${HOST}/a.png`],
        ['not a URL', 'not a url'],
    ])('rejects %s (not retryable)', (_label, url) => {
        const err = (() => { try { validateSsoAvatarUrl(url) } catch (e) { return e } })()
        expect(err).toBeInstanceOf(AvatarDownloadError)
        expect((err as AvatarDownloadError).retryable).toBe(false)
    })

    // TC-F23-SSO-08: any HTTPS host SSO sends is accepted (no host allow-list, no env needed)
    it.each([HOST, 'cdn.example.com'])('accepts an HTTPS link on %s', (host) => {
        expect(validateSsoAvatarUrl(`https://${host}/images/users/1.png`).hostname).toBe(host)
    })

    // TC-F23-SSO-01: valid PNG is downloaded without ever following redirects
    it('downloads a PNG and never follows redirects', async () => {
        fetchMock.mockResolvedValue(okResponse(PNG))

        const result = await downloadSsoAvatar(URL_OK)

        expect(result.mimetype).toBe('image/png')
        expect(result.ext).toBe('png')
        expect(result.buffer.equals(PNG)).toBe(true)
        expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: 'manual' }))
    })

    // TC-F23-SSO-01
    it('downloads a JPEG', async () => {
        fetchMock.mockResolvedValue(okResponse(JPEG))
        await expect(downloadSsoAvatar(URL_OK)).resolves.toMatchObject({ mimetype: 'image/jpeg', ext: 'jpg' })
    })

    // TC-F23-SSO-08: non-JPEG/PNG content is rejected by magic bytes
    it('rejects a GIF even when served as image/png', async () => {
        fetchMock.mockResolvedValue(okResponse(GIF, { 'content-type': 'image/png' }))
        await expect(downloadSsoAvatar(URL_OK)).rejects.toThrow(AvatarDownloadError)
    })

    // TC-F23-SSO-08: size cap via content-length and via streamed bytes
    it('rejects files over the avatar size limit', async () => {
        fetchMock.mockResolvedValueOnce(okResponse(PNG, { 'content-length': String(AVATAR_MAX_BYTES + 1) }))
        await expect(downloadSsoAvatar(URL_OK)).rejects.toThrow('size limit')

        const big = Buffer.concat([PNG, Buffer.alloc(AVATAR_MAX_BYTES)])
        fetchMock.mockResolvedValueOnce(okResponse(big))
        await expect(downloadSsoAvatar(URL_OK)).rejects.toThrow('size limit')
    })

    // TC-F23-SSO-06: HTTP errors and network failures surface as AvatarDownloadError with retry hint
    it.each([
        ['HTTP 404 (permanent)', () => fetchMock.mockResolvedValueOnce(new Response('missing', { status: 404 })), false],
        ['HTTP 503 (transient)', () => fetchMock.mockResolvedValueOnce(new Response('busy', { status: 503 })), true],
        ['HTTP 301 redirect (not followed, permanent)', () => fetchMock.mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://cdn.example.com/a.png' } })), false],
        ['network error', () => fetchMock.mockRejectedValueOnce(new TypeError('fetch failed')), true],
    ])('maps %s to AvatarDownloadError', async (_label, arrange, retryable) => {
        arrange()
        const err = await downloadSsoAvatar(URL_OK).catch((e: unknown) => e)
        expect(err).toBeInstanceOf(AvatarDownloadError)
        expect((err as AvatarDownloadError).retryable).toBe(retryable)
    })

    // TC-F23-SSO-06: body stream failure mid-download is transient (wrapped, not a raw error)
    it('wraps a body read failure as a retryable AvatarDownloadError', async () => {
        const body = new ReadableStream<Uint8Array>({
            start(controller) { controller.error(new Error('socket hang up')) },
        })
        fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }))

        const err = await downloadSsoAvatar(URL_OK).catch((e: unknown) => e)

        expect(err).toBeInstanceOf(AvatarDownloadError)
        expect((err as AvatarDownloadError).retryable).toBe(true)
    })

    // TC-F23-SSO-08
    it('detects only JPEG and PNG signatures', () => {
        expect(detectAvatarMimetype(PNG)).toBe('image/png')
        expect(detectAvatarMimetype(JPEG)).toBe('image/jpeg')
        expect(detectAvatarMimetype(GIF)).toBeNull()
    })
})
