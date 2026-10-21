import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { crc32 } from 'node:zlib'
import sharp from 'sharp'
import {
    AvatarDownloadError,
    MAX_AVATAR_PIXELS,
    detectAvatarMimetype,
    downloadSsoAvatar,
    validateSsoAvatarUrl,
} from '@/lib/sso/avatar-sync/download-sso-avatar'
import { AVATAR_MAX_BYTES } from '@/lib/profile/schemas'

// DNS is mocked: the SSRF guard resolves the host before fetching. Default = a public address.
const lookupMock = vi.fn()
vi.mock('node:dns/promises', () => ({ lookup: (...args: unknown[]) => lookupMock(...args) }))

const HOST = 'sso-bucket.s3.ap-southeast-1.amazonaws.com'
const URL_OK = `https://${HOST}/images/users/1.png`
const PUBLIC_IP = [{ address: '52.219.128.1', family: 4 }]
// Bare signatures (used only for the magic-byte detector and the size/GIF cases)
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
const JPEG_SIG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])
const GIF = Buffer.from('GIF89a')

const okResponse = (bytes: Buffer, headers: Record<string, string> = {}) =>
    new Response(new Uint8Array(bytes), { status: 200, headers })

describe('downloadSsoAvatar (GH-1723)', () => {
    const fetchMock = vi.fn()
    // Real, decodable images — the download reads their dimensions with sharp
    let png: Buffer
    let jpeg: Buffer
    let hugePng: Buffer

    beforeAll(async () => {
        const base = { create: { width: 2, height: 2, channels: 3 as const, background: '#ffffff' } }
        png = await sharp(base).png().toBuffer()
        jpeg = await sharp(base).jpeg().toBuffer()
        // Same tiny PNG with a forged IHDR (10000x10000 = 100 MP) and a valid IHDR CRC:
        // sharp.metadata() only reads the header, so this models a decompression-bomb avatar.
        hugePng = Buffer.from(png)
        hugePng.writeUInt32BE(10_000, 16)
        hugePng.writeUInt32BE(10_000, 20)
        hugePng.writeUInt32BE(crc32(hugePng.subarray(12, 29)), 29)
    })

    beforeEach(() => {
        vi.stubGlobal('fetch', fetchMock)
        fetchMock.mockReset()
        lookupMock.mockReset().mockResolvedValue(PUBLIC_IP)
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

    // TC-F23-SSO-08: any public HTTPS host SSO sends is accepted (no host allow-list, no env needed)
    it.each([HOST, 'cdn.example.com'])('accepts an HTTPS link on %s', (host) => {
        expect(validateSsoAvatarUrl(`https://${host}/images/users/1.png`).hostname).toBe(host)
    })

    // TC-F23-SSO-08: SSRF guard — loopback / private / link-local / metadata targets are never fetched
    it.each([
        ['IPv4 loopback literal', 'https://127.0.0.1/a.png'],
        ['IPv6 loopback literal', 'https://[::1]/a.png'],
        ['cloud metadata endpoint', 'https://169.254.169.254/latest/meta-data'],
        ['private 10/8 literal', 'https://10.0.0.5/a.png'],
        ['private 192.168/16 literal', 'https://192.168.1.10/a.png'],
        ['IPv4-mapped IPv6 loopback', 'https://[::ffff:127.0.0.1]/a.png'],
        ['localhost', 'https://localhost/a.png'],
        ['*.localhost', 'https://app.localhost/a.png'],
        ['localhost with a trailing dot', 'https://localhost./a.png'],
        ['*.localhost with a trailing dot', 'https://app.localhost./a.png'],
        ['IP literal with a trailing dot', 'https://127.0.0.1./a.png'],
    ])('never fetches %s', async (_label, url) => {
        const err = await downloadSsoAvatar(url).catch((e: unknown) => e)

        expect(err).toBeInstanceOf(AvatarDownloadError)
        expect((err as AvatarDownloadError).retryable).toBe(false)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-08: a public-looking hostname that RESOLVES to a private address is blocked too
    it.each([
        ['resolves to a private address', [{ address: '10.1.2.3', family: 4 }]],
        ['resolves to link-local/metadata', [{ address: '169.254.169.254', family: 4 }]],
        ['resolves to IPv6 unique-local', [{ address: 'fd00::1', family: 6 }]],
        ['resolves to an IPv4-mapped IPv6 loopback', [{ address: '::ffff:7f00:1', family: 6 }]],
        ['resolves to nothing', []],
        ['has one private address among public ones', [{ address: '52.219.128.1', family: 4 }, { address: '192.168.0.9', family: 4 }]],
    ])('blocks a host that %s', async (_label, addresses) => {
        lookupMock.mockResolvedValue(addresses)

        const err = await downloadSsoAvatar(URL_OK).catch((e: unknown) => e)

        expect(err).toBeInstanceOf(AvatarDownloadError)
        expect((err as AvatarDownloadError).message).toMatch(/non-public/)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-06: DNS failures — a missing host is permanent, a flaky resolver is retried
    it.each([
        ['ENOTFOUND', false],
        ['EAI_AGAIN', true],
    ])('maps a DNS %s failure to retryable=%s', async (code, retryable) => {
        lookupMock.mockRejectedValue(Object.assign(new Error('dns'), { code }))

        const err = await downloadSsoAvatar(URL_OK).catch((e: unknown) => e)

        expect(err).toBeInstanceOf(AvatarDownloadError)
        expect((err as AvatarDownloadError).retryable).toBe(retryable)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    // TC-F23-SSO-01: valid PNG is downloaded without ever following redirects
    it('downloads a PNG and never follows redirects', async () => {
        fetchMock.mockResolvedValue(okResponse(png))

        const result = await downloadSsoAvatar(URL_OK)

        expect(result.mimetype).toBe('image/png')
        expect(result.ext).toBe('png')
        expect(result.buffer.equals(png)).toBe(true)
        expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: 'manual' }))
    })

    // TC-F23-SSO-01
    it('downloads a JPEG', async () => {
        fetchMock.mockResolvedValue(okResponse(jpeg))
        await expect(downloadSsoAvatar(URL_OK)).resolves.toMatchObject({ mimetype: 'image/jpeg', ext: 'jpg' })
    })

    // TC-F23-SSO-08: non-JPEG/PNG content is rejected by magic bytes
    it('rejects a GIF even when served as image/png', async () => {
        fetchMock.mockResolvedValue(okResponse(GIF, { 'content-type': 'image/png' }))
        await expect(downloadSsoAvatar(URL_OK)).rejects.toThrow(AvatarDownloadError)
    })

    // TC-F23-SSO-08: a valid signature is not enough — the bytes must decode as an image
    it('rejects bytes that only look like a PNG', async () => {
        fetchMock.mockResolvedValue(okResponse(PNG_SIG))

        const err = await downloadSsoAvatar(URL_OK).catch((e: unknown) => e)

        expect(err).toBeInstanceOf(AvatarDownloadError)
        expect((err as AvatarDownloadError).retryable).toBe(false)
        expect((err as AvatarDownloadError).message).toMatch(/decodable/)
    })

    // TC-F23-SSO-08: pixel cap protects the later Media image processing from huge-pixel files (≤ 2 MB on the wire)
    it('rejects an image over the pixel cap but accepts a normal one', async () => {
        expect(MAX_AVATAR_PIXELS).toBe(50_000_000)
        fetchMock.mockResolvedValueOnce(okResponse(hugePng))

        const err = await downloadSsoAvatar(URL_OK).catch((e: unknown) => e)

        expect(err).toBeInstanceOf(AvatarDownloadError)
        expect((err as AvatarDownloadError).retryable).toBe(false)
        expect((err as AvatarDownloadError).message).toMatch(/10000x10000/)

        fetchMock.mockResolvedValueOnce(okResponse(png))
        await expect(downloadSsoAvatar(URL_OK)).resolves.toMatchObject({ mimetype: 'image/png' })
    })

    // TC-F23-SSO-08: size cap via content-length and via streamed bytes
    it('rejects files over the avatar size limit', async () => {
        fetchMock.mockResolvedValueOnce(okResponse(png, { 'content-length': String(AVATAR_MAX_BYTES + 1) }))
        await expect(downloadSsoAvatar(URL_OK)).rejects.toThrow('size limit')

        const big = Buffer.concat([png, Buffer.alloc(AVATAR_MAX_BYTES)])
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
        expect(detectAvatarMimetype(PNG_SIG)).toBe('image/png')
        expect(detectAvatarMimetype(JPEG_SIG)).toBe('image/jpeg')
        expect(detectAvatarMimetype(GIF)).toBeNull()
    })
})
