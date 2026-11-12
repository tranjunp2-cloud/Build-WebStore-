/**
 * TC-PERF-144 — Media ownership: a signed-in uploader's media belongs to their own tenant and is never private by
 * request; only active members of a private media's tenant (and super-admins) may open it.
 * TC-PERF-145 — Private media (payment receipts) never carry the public storage URL and are served only by
 * GET /api/media/private/{id}: anonymous 401, another shop 404, its own shop 200 with the bytes.
 * Real: lib/media/media-access.ts, the private media route. Faked: getCurrentUser, Payload, the S3 client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUser = vi.fn()
vi.mock('@/lib/auth', () => ({
    getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
    isAuthUnavailableError: () => false,
    authUnavailableResponse: () => new Response(null, { status: 503 }),
}))
const findByID = vi.fn()
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ findByID })) }))
vi.mock('@payload-config', () => ({ default: {} }))
const s3Send = vi.fn()
vi.mock('@/lib/media/s3-client', () => ({ buildS3Client: () => ({ client: { send: s3Send }, bucket: 'media-bucket' }) }))

import {
    activeTenantIds,
    assignMediaTenant,
    canReadPrivateMedia,
    hidePrivateMediaUrl,
} from '@/lib/media/media-access'
import { GET } from '@/app/api/media/private/[id]/route'

const owner5 = { id: 1, roles: ['tenant-owner'], tenants: [{ tenant: { id: 5 }, role: 'owner', status: 'active' }] }
const owner9 = { id: 2, roles: ['tenant-owner'], tenants: [{ tenant: 9, role: 'owner', status: 'active' }] }
const receipt = { id: 31, tenant: 5, private: true, filename: 'payment-proof-abc.jpg', prefix: null, _objectKey: null, mimeType: 'image/jpeg' }
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

const get = (id: string) => GET(new Request(`http://app.test/api/media/private/${id}`), { params: Promise.resolve({ id }) })

beforeEach(() => {
    getCurrentUser.mockReset()
    findByID.mockReset().mockResolvedValue({ ...receipt })
    s3Send.mockReset().mockResolvedValue({ Body: { transformToByteArray: async () => JPEG } })
})

afterEach(() => vi.restoreAllMocks())

describe('media ownership on upload [TC-PERF-144]', () => {
    it('puts a member\'s upload under their tenant and drops a request for privacy', () => {
        // Arrange
        const data: Record<string, unknown> = { alt: 'x', private: true }

        // Act
        const out = assignMediaTenant({ data, operation: 'create', req: { user: owner5 } } as never) as Record<string, unknown>

        // Assert
        expect(out).toMatchObject({ tenant: 5, private: false })
    })

    it('ignores a tenant the uploader is not an active member of', () => {
        const data: Record<string, unknown> = { alt: 'x', tenant: 9 }

        const out = assignMediaTenant({ data, operation: 'create', req: { user: owner5 } } as never) as Record<string, unknown>

        expect(out.tenant).toBe(5)
    })

    it('leaves server uploads without a user (payment proof, AI, pw1) as they set them', () => {
        const data: Record<string, unknown> = { alt: 'x', tenant: 9, private: true }

        const out = assignMediaTenant({ data, operation: 'create', req: {} } as never) as Record<string, unknown>

        expect(out).toMatchObject({ tenant: 9, private: true })
    })

    it('counts active memberships only', () => {
        expect(activeTenantIds({ tenants: [{ tenant: 1, status: 'pending' }, { tenant: '2' }, { tenant: { id: 3 }, status: 'suspended' }] })).toEqual([2])
    })

    it('lets a member of the media\'s tenant or a super-admin open private media, nobody else', () => {
        expect(canReadPrivateMedia(owner5, 5)).toBe(true)
        expect(canReadPrivateMedia(owner9, 5)).toBe(false)
        expect(canReadPrivateMedia({ roles: ['super-admin'], tenants: [] }, 5)).toBe(true)
        expect(canReadPrivateMedia(owner5, null)).toBe(false)
        expect(canReadPrivateMedia(null, 5)).toBe(false)
    })
})

describe('media tenant is never populated [TC-PERF-163]', () => {
    it('keeps Media.tenant an id at any read depth (page blocks / products / orders populate media)', async () => {
        const { Media } = await import('@/collections/Media')
        const field = (Media.fields as Array<{ name?: string; maxDepth?: number }>).find((f) => f.name === 'tenant')

        expect(field?.maxDepth).toBe(0)
    })
})

describe('private media URL [TC-PERF-145]', () => {
    it('replaces the public storage URL of a private row with the member-checked route', () => {
        const doc = { id: 31, private: true, url: 'https://file-storage/bucket/payment-proof-abc.jpg', thumbnailURL: 'https://t' }

        const out = hidePrivateMediaUrl({ doc } as never) as typeof doc

        expect(out.url).toBe('/api/media/private/31')
        expect(out.thumbnailURL).toBeNull()
    })

    it('keeps the public URL of storefront images', () => {
        const doc = { id: 4, private: false, url: 'https://file-storage/bucket/hero.jpg' }

        expect((hidePrivateMediaUrl({ doc } as never) as typeof doc).url).toBe('https://file-storage/bucket/hero.jpg')
    })
})

describe('GET /api/media/private/{id} [TC-PERF-145]', () => {
    it('answers 401 to an anonymous request', async () => {
        getCurrentUser.mockResolvedValue(null)

        const res = await get('31')

        expect(res.status).toBe(401)
        expect(s3Send).not.toHaveBeenCalled()
    })

    it('answers 404 to a member of another shop (no existence oracle)', async () => {
        getCurrentUser.mockResolvedValue(owner9)

        const res = await get('31')

        expect(res.status).toBe(404)
        expect(s3Send).not.toHaveBeenCalled()
    })

    it('streams the receipt to its own shop, private and not cacheable', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(owner5)

        // Act
        const res = await get('31')

        // Assert
        expect(res.status).toBe(200)
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG)
        expect(res.headers.get('content-type')).toBe('image/jpeg')
        expect(res.headers.get('cache-control')).toBe('private, no-store')
        expect(res.headers.get('x-content-type-options')).toBe('nosniff')
        expect(s3Send.mock.calls[0]![0].input).toEqual({ Bucket: 'media-bucket', Key: 'payment-proof-abc.jpg' })
    })

    it('reads the object under the storage plugin layout (prefix / object key / filename)', async () => {
        getCurrentUser.mockResolvedValue(owner5)
        findByID.mockResolvedValue({ ...receipt, prefix: 'p', _objectKey: 'k1' })

        await get('31')

        expect(s3Send.mock.calls[0]![0].input.Key).toBe('p/k1/payment-proof-abc.jpg')
    })

    it('does not serve public media or unknown ids through this route', async () => {
        getCurrentUser.mockResolvedValue(owner5)
        findByID.mockResolvedValueOnce({ ...receipt, private: false })
        expect((await get('31')).status).toBe(404)

        findByID.mockResolvedValueOnce(null)
        expect((await get('32')).status).toBe(404)

        expect((await get('abc')).status).toBe(404)
    })
})
