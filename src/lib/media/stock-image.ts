import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

import { buildS3Client } from './s3-client'

import type { StockProvider } from '@/lib/ai/image-sourcing/contracts'

export type { StockImageCandidate, StockProvider } from '@/lib/ai/image-sourcing/contracts'

export interface ValidatedStockImage {
    buffer: Buffer
    extension: 'jpg' | 'png' | 'webp'
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
    size: number
}

export interface StockObjectStore {
    objectExists(objectKey: string, force?: boolean): Promise<boolean>
    put(objectKey: string, image: ValidatedStockImage): Promise<void>
}

const STOCK_DOWNLOAD_HOSTS = new Set([
    'upload.wikimedia.org',
    'pixabay.com',
    'cdn.pixabay.com',
    // Existing curated compatibility images share the same guarded downloader.
    'images.unsplash.com',
    'plus.unsplash.com',
])

const STOCK_IMAGE_MAX_BYTES = 10_000_000
const OBJECT_EXISTS_TTL_MS = 5 * 60 * 1000
const DOWNLOAD_TIMEOUT_MS = 15_000

type MagicMatch = Pick<ValidatedStockImage, 'extension' | 'mimeType'>

function imageMagic(buffer: Buffer): MagicMatch | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { extension: 'jpg', mimeType: 'image/jpeg' }
    }
    if (
        buffer.length >= 8
        && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
        return { extension: 'png', mimeType: 'image/png' }
    }
    if (
        buffer.length >= 12
        && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
        && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
        return { extension: 'webp', mimeType: 'image/webp' }
    }
    return null
}

export function isAllowedStockDownloadUrl(rawUrl: string): boolean {
    try {
        const url = new URL(rawUrl)
        return url.protocol === 'https:' && STOCK_DOWNLOAD_HOSTS.has(url.hostname)
    } catch {
        return false
    }
}

export function validateStockImageBytes(
    buffer: Buffer,
    responseContentType: string,
    maxBytes: number = STOCK_IMAGE_MAX_BYTES,
): ValidatedStockImage {
    if (buffer.length === 0) throw new Error('STOCK_IMAGE_EMPTY')
    if (buffer.length > maxBytes) throw new Error('STOCK_IMAGE_TOO_LARGE')

    const declaredMime = responseContentType.split(';', 1)[0]?.trim().toLowerCase()
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(declaredMime)) {
        throw new Error('STOCK_IMAGE_INVALID_CONTENT_TYPE')
    }

    const magic = imageMagic(buffer)
    if (!magic || magic.mimeType !== declaredMime) {
        throw new Error('STOCK_IMAGE_MAGIC_MISMATCH')
    }
    return { buffer, ...magic, size: buffer.length }
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Buffer> {
    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new Error('STOCK_IMAGE_TOO_LARGE')
    }
    if (!response.body) return Buffer.alloc(0)

    const reader = response.body.getReader()
    const chunks: Buffer[] = []
    let size = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > maxBytes) {
            await reader.cancel()
            throw new Error('STOCK_IMAGE_TOO_LARGE')
        }
        chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, size)
}

export async function downloadAndValidateStockImage(
    rawUrl: string,
    fetchImpl: typeof fetch = fetch,
    maxBytes: number = STOCK_IMAGE_MAX_BYTES,
): Promise<ValidatedStockImage> {
    let currentUrl = rawUrl
    for (let redirects = 0; redirects <= 3; redirects += 1) {
        if (!isAllowedStockDownloadUrl(currentUrl)) throw new Error('STOCK_IMAGE_SSRF_BLOCKED')
        const response = await fetchImpl(currentUrl, {
            redirect: 'manual',
            signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
            headers: { 'User-Agent': 'ech-prime-web-v2/1.0' },
        })
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location')
            if (!location || redirects === 3) throw new Error('STOCK_IMAGE_REDIRECT_REJECTED')
            currentUrl = new URL(location, currentUrl).toString()
            continue
        }
        if (!response.ok) throw new Error(`STOCK_IMAGE_DOWNLOAD_${response.status}`)
        const buffer = await readBoundedBody(response, maxBytes)
        return validateStockImageBytes(buffer, response.headers.get('content-type') ?? '', maxBytes)
    }
    throw new Error('STOCK_IMAGE_REDIRECT_REJECTED')
}

export function stockObjectKey(
    provider: StockProvider,
    providerImageId: string,
    extension: ValidatedStockImage['extension'],
): string {
    const encodedId = encodeURIComponent(providerImageId.trim())
    if (!encodedId) throw new Error('STOCK_IMAGE_ID_REQUIRED')
    return `stock/${provider}/${encodedId}.${extension}`
}

export function createS3StockObjectStore(
    now: () => number = Date.now,
): StockObjectStore {
    const successfulHeads = new Map<string, number>()

    return {
        async objectExists(objectKey, force = false) {
            const checkedAt = successfulHeads.get(objectKey)
            if (!force && checkedAt !== undefined && now() - checkedAt < OBJECT_EXISTS_TTL_MS) {
                return true
            }
            const s3 = buildS3Client()
            if (!s3) return false
            try {
                await s3.client.send(new HeadObjectCommand({ Bucket: s3.bucket, Key: objectKey }))
                successfulHeads.set(objectKey, now())
                return true
            } catch {
                successfulHeads.delete(objectKey)
                return false
            }
        },

        async put(objectKey, image) {
            const s3 = buildS3Client()
            if (!s3) throw new Error('S3_NOT_CONFIGURED')
            if (await this.objectExists(objectKey)) return
            await s3.client.send(new PutObjectCommand({
                Bucket: s3.bucket,
                Key: objectKey,
                Body: image.buffer,
                ContentLength: image.size,
                ContentType: image.mimeType,
            }))
            // A Put response is not the assignment barrier. The caller performs
            // a forced HeadObject after its database transaction commits.
            successfulHeads.delete(objectKey)
        },
    }
}
