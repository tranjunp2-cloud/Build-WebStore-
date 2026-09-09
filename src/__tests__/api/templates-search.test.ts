import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { find, checkRateLimit } = vi.hoisted(() => ({
    find: vi.fn(),
    checkRateLimit: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn().mockImplementation((
        handler: (user: { id: string }, req: Request, ctx?: unknown) => Promise<Response>,
        options?: { unauthorizedResponse?: (req: Request) => Response },
    ) => (req: Request, ctx?: unknown) => (
        req.headers.get('x-test-anonymous') === 'true' && options?.unauthorizedResponse
            ? options.unauthorizedResponse(req)
            : handler({ id: 'user-1' }, req, ctx)
    )),
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ find })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/rateLimit', () => ({ checkRateLimit }))

import { POST } from '@/app/api/templates/search/route'

const templates = [
    {
        id: 'sport-shop',
        name: 'Activewear Performance',
        description: 'Sports commerce',
        category: ['ecommerce'],
        thumbnail: { url: '/sport.webp', filename: 'must-not-leak.webp' },
        isPremium: false,
        isFeatured: true,
        tags: [{ tag: 'sports', id: 'row-metadata-must-not-leak' }],
        defaultTheme: { primaryColor: '#123456', secondaryColor: '#654321', colorMode: 'dark' },
        defaultBlocks: [{ blockType: 'hero', headline: 'must not leak' }],
    },
    {
        id: 'sport-equipment',
        name: 'Sports Equipment Pro',
        description: 'Fitness equipment commerce',
        category: ['ecommerce'],
        tags: [{ tag: 'fitness' }, { tag: 'equipment' }],
    },
    { id: 'gym', name: 'Fitness Studio', category: ['fitness'] },
    { id: 'fashion', name: 'Fashion Boutique', category: ['ecommerce'] },
    { id: 'beauty', name: 'Beauty Studio', category: ['beauty'] },
]

function request(body: BodyInit, headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost:3000/api/templates/search', {
        method: 'POST',
        body,
        headers: {
            'Content-Type': 'application/json',
            'x-request-id': 'test-request-190',
            ...headers,
        },
    })
}

describe('[TC_F07_037] POST /api/templates/search', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        find.mockResolvedValue({ docs: templates })
        checkRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 99,
            resetAt: Date.now() + 86_400_000,
        })
    })

    it('returns ranked lightweight cards for an authenticated multilingual request', async () => {
        const response = await POST(request(JSON.stringify({
            query: 'mẫu cho shop thể thao',
            locale: 'vi',
        })))
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(response.headers.get('x-request-id')).toBe('test-request-190')
        expect(body.meta.timestamp).toEqual(expect.any(String))
        expect(body.data).toMatchObject({ query: 'mẫu cho shop thể thao', locale: 'vi' })
        expect(body.data.templates.map((template: { id: string }) => template.id)).toEqual([
            'sport-shop',
            'sport-equipment',
        ])
        expect(body.data.templates[0]).toEqual({
            id: 'sport-shop',
            name: 'Activewear Performance',
            description: 'Sports commerce',
            category: ['ecommerce'],
            thumbnail: { url: '/sport.webp' },
            isPremium: false,
            isFeatured: true,
            tags: [{ tag: 'sports' }],
            defaultTheme: { primaryColor: '#123456', secondaryColor: '#654321', colorMode: 'dark' },
        })
        expect(find).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'templates',
            user: { id: 'user-1' },
            overrideAccess: false,
            where: {
                and: [
                    { status: { equals: 'live' } },
                    { category: { in: ['ecommerce', 'fitness'] } },
                ],
            },
            limit: 1_000,
            sort: ['sortOrder', 'id'],
            depth: 1,
            select: expect.objectContaining({
                name: true,
                category: true,
                thumbnail: true,
                defaultTheme: expect.any(Object),
            }),
        }))
        expect(checkRateLimit).toHaveBeenCalledWith(
            'template-search:user-1',
            100,
            86_400_000,
        )
    })

    it('rate limits authenticated searches before loading the inventory', async () => {
        checkRateLimit.mockResolvedValueOnce({
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 60_000,
        })

        const response = await POST(request(JSON.stringify({ query: 'sports shop', locale: 'en' })))
        const body = await response.json()

        expect(response.status).toBe(429)
        expect(body).toEqual({
            success: false,
            error: {
                code: 'AI_RATE_LIMIT',
                message: 'Template search limit reached. Please try again later.',
                details: null,
                requestId: 'test-request-190',
            },
        })
        expect(find).not.toHaveBeenCalled()
    })

    it('uses the canonical authentication error contract', async () => {
        const response = await POST(request(
            JSON.stringify({ query: 'sports shop', locale: 'en' }),
            { 'x-test-anonymous': 'true' },
        ))
        const body = await response.json()

        expect(response.status).toBe(401)
        expect(body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: 'Authentication required',
                details: null,
                requestId: 'test-request-190',
            },
        })
        expect(checkRateLimit).not.toHaveBeenCalled()
        expect(find).not.toHaveBeenCalled()
    })

    it('prefilters unclassified text by every meaningful term before applying the cap', async () => {
        await POST(request(JSON.stringify({ query: 'galactic astronaut', locale: 'en' })))

        expect(find).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                and: [
                    { status: { equals: 'live' } },
                    {
                        or: [
                            { name: { contains: 'galactic' } },
                            { description: { contains: 'galactic' } },
                            { 'tags.tag': { contains: 'galactic' } },
                        ],
                    },
                    {
                        or: [
                            { name: { contains: 'astronaut' } },
                            { description: { contains: 'astronaut' } },
                            { 'tags.tag': { contains: 'astronaut' } },
                        ],
                    },
                ],
            },
        }))
    })

    it('normalizes punctuation and loads bounded category peers for an exact-name match', async () => {
        find
            .mockResolvedValueOnce({ docs: [templates[0]] })
            .mockResolvedValueOnce({ docs: [templates[1]] })

        const response = await POST(request(JSON.stringify({ query: 'activewear!', locale: 'en' })))
        const body = await response.json()

        expect(body.data.templates.map((template: { id: string }) => template.id)).toEqual(['sport-shop', 'sport-equipment'])
        expect(find).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: {
                and: [
                    { status: { equals: 'live' } },
                    {
                        or: [
                            { name: { contains: 'activewear' } },
                            { description: { contains: 'activewear' } },
                            { 'tags.tag': { contains: 'activewear' } },
                        ],
                    },
                ],
            },
        }))
        expect(find).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: {
                and: [
                    { status: { equals: 'live' } },
                    { category: { in: ['ecommerce'] } },
                    { id: { not_equals: 'sport-shop' } },
                ],
            },
            limit: 20,
            sort: ['sortOrder', 'id'],
        }))
    })

    it('returns an empty result when an exact-name primary has no live category peer', async () => {
        find
            .mockResolvedValueOnce({ docs: [templates[0]] })
            .mockResolvedValueOnce({ docs: [] })

        const response = await POST(request(JSON.stringify({ query: 'activewear', locale: 'en' })))
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.templates).toEqual([])
        expect(find).toHaveBeenCalledTimes(2)
    })

    it.each([
        [{ query: '   ', locale: 'en' }, 'query'],
        [{ query: 'x'.repeat(201), locale: 'ms' }, 'query'],
        [{ query: 'sports shop', locale: 'fr' }, 'locale'],
        [{ query: 'sports shop' }, 'locale'],
    ])('returns a structured validation error for %o', async (input, field) => {
        const response = await POST(request(JSON.stringify(input)))
        const body = await response.json()

        expect(response.status).toBe(422)
        expect(body).toMatchObject({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid template search request',
                requestId: 'test-request-190',
            },
        })
        expect(body.error.details.fieldErrors).toHaveProperty(field)
    })

    it('returns a structured error for malformed JSON', async () => {
        const response = await POST(request('{'))
        const body = await response.json()

        expect(response.status).toBe(422)
        expect(body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid JSON body',
                details: null,
                requestId: 'test-request-190',
            },
        })
    })

    it('returns a correlated structured error when Payload fails', async () => {
        find.mockRejectedValueOnce(new Error('database unavailable'))

        const response = await POST(request(JSON.stringify({ query: 'kedai baju', locale: 'ms' })))
        const body = await response.json()

        expect(response.status).toBe(500)
        expect(body).toEqual({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Unable to search templates. Please try again.',
                details: null,
                requestId: 'test-request-190',
            },
        })
    })
})
