import { beforeEach, describe, expect, it, vi } from 'vitest'

const CURRENT_REVISION = 'a'.repeat(64)

const mockUser = {
    id: 1,
    roles: [] as string[],
    tenants: [{ tenant: 'tenant-1', status: 'active' }],
}
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn(
        (handler: (user: typeof mockUser, request: Request) => unknown) =>
            (request: Request) =>
                handler(mockUser, request),
    ),
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(
        () => (handler: (request: Request) => unknown) => handler,
    ),
}))

const mockCheckTwoTierRateLimit = vi.fn()
vi.mock('@/lib/rateLimit', () => ({
    checkTwoTierRateLimit: (...args: unknown[]) => mockCheckTwoTierRateLimit(...args),
}))

const mockFindByID = vi.fn()
const mockGetPayload = vi.fn(() => Promise.resolve({ findByID: mockFindByID }))
vi.mock('payload', () => ({
    getPayload: (...args: unknown[]) => mockGetPayload(...args),
}))
vi.mock('@payload-config', () => ({ default: {} }))

const mockGenerateAutoSEOMeta = vi.fn().mockResolvedValue({
    title: 'Generated Title',
    description: 'Generated description for SEO.',
})
vi.mock('@/lib/ai/generate-meta', () => ({
    generateAutoSEOMeta: (...args: unknown[]) =>
        mockGenerateAutoSEOMeta(...args),
}))

const mockEvaluateAuthoritativeLocalSeo = vi.fn()
vi.mock('@/lib/seo/local-seo-evaluation', () => ({
    evaluateAuthoritativeLocalSeo: (...args: unknown[]) =>
        mockEvaluateAuthoritativeLocalSeo(...args),
}))

import { POST } from '@/app/api/seo/fix-all/route'

interface RequestedItem {
    collection: 'pages' | 'products' | 'blogs'
    id: string
    title: string
    context?: string
    missingFields: Array<'title' | 'description'>
}

function request(
    items: RequestedItem[],
    overrides: Record<string, unknown> = {},
) {
    return {
        json: () =>
            Promise.resolve({
                siteId: 'site-1',
                revisionToken: CURRENT_REVISION,
                missingSeo: items,
                ...overrides,
            }),
    } as unknown as Request
}

function abortableRequest(
    items: RequestedItem[],
    signal: AbortSignal,
): Request {
    return new Request('http://localhost/api/seo/fix-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
            siteId: 'site-1',
            revisionToken: CURRENT_REVISION,
            missingSeo: items,
        }),
    })
}

function evaluation(items: RequestedItem[], revisionToken = CURRENT_REVISION) {
    return {
        response: { revisionToken },
        metadataItems: items,
    }
}

async function dataEvents(
    response: Response,
): Promise<Array<Record<string, unknown>>> {
    const text = await response.text()
    return text
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map(
            (line) =>
                JSON.parse(line.replace('data: ', '')) as Record<
                    string,
                    unknown
                >,
        )
}

// ── TC-F37-04-16 / TC-F19.38: bounded revision-bound metadata proposals ──
describe('POST /api/seo/fix-all [TC-F37-04-16, TC-F19.38]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCheckTwoTierRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 4,
            resetAt: Date.now() + 60_000,
        })
        mockUser.roles = []
        mockUser.tenants = [{ tenant: 'tenant-1', status: 'active' }]
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            name: 'My Store',
            tenant: 'tenant-1',
        })
    })

    it('rejects unknown request fields before protected reads', async () => {
        const response = await POST(
            request([], { operation: 'apply' }),
            {} as never,
        )

        expect(response.status).toBe(400)
        expect(mockGetPayload).not.toHaveBeenCalled()
        expect(mockCheckTwoTierRateLimit).not.toHaveBeenCalled()
    })

    it('rate-limits repeated AI proposal requests before evaluation', async () => {
        mockCheckTwoTierRateLimit.mockResolvedValue({
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 30_000,
        })

        const response = await POST(request([]), {} as never)
        const body = await response.json()

        expect(response.status).toBe(429)
        expect(mockCheckTwoTierRateLimit).toHaveBeenCalledWith(
            'seo-fix-all:1:site-1',
            2,
            10,
        )
        expect(response.headers.get('Retry-After')).toBe('30')
        expect(body.error.code).toBe('RATE_LIMITED')
        expect(mockEvaluateAuthoritativeLocalSeo).not.toHaveBeenCalled()
        expect(mockGenerateAutoSEOMeta).not.toHaveBeenCalled()
    })

    it('uses revision-matched authoritative metadata when generating proposals', async () => {
        // Arrange
        const requested: RequestedItem[] = [
            {
                collection: 'products',
                id: 'prod-1',
                title: 'Client title',
                missingFields: ['title', 'description'],
            },
        ]
        const authoritative = [{ ...requested[0], title: 'Nasi Lemak' }]
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(
            evaluation(authoritative),
        )

        // Act
        const response = await POST(request(requested), {} as never)
        const events = await dataEvents(response)

        // Assert
        expect(response.status).toBe(200)
        expect(events).toHaveLength(1)
        expect(events[0]).toMatchObject({
            targetId: 'prod-1',
            name: 'Nasi Lemak',
            proposedTitle: 'Generated Title',
        })
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledWith(
            'product',
            'Nasi Lemak',
            'My Store',
            undefined,
            [],
            expect.any(AbortSignal),
            undefined, // no platform actor: AI tasks are not configured in this test
        )
    })

    it('rejects more than 100 proposals before protected reads', async () => {
        // Arrange
        const items = Array.from({ length: 101 }, (_, index) => ({
            collection: 'pages' as const,
            id: String(index),
            title: `Page ${index}`,
            missingFields: ['title'] as Array<'title'>,
        }))

        // Act
        const response = await POST(request(items), {} as never)

        // Assert
        expect(response.status).toBe(400)
        expect(mockGetPayload).not.toHaveBeenCalled()
        expect(mockFindByID).not.toHaveBeenCalled()
    })

    it.each(['pending', 'suspended'])(
        'denies a %s-only membership before protected reads',
        async (status) => {
            // Arrange
            mockUser.tenants = [{ tenant: 'tenant-1', status }]

            // Act
            const response = await POST(request([]), {} as never)

            // Assert
            expect(response.status).toBe(403)
            expect(mockGetPayload).not.toHaveBeenCalled()
            expect(mockFindByID).not.toHaveBeenCalled()
            expect(mockGenerateAutoSEOMeta).not.toHaveBeenCalled()
        },
    )

    it('rejects duplicate proposal targets before protected reads', async () => {
        // Arrange
        const duplicate: RequestedItem = {
            collection: 'pages',
            id: 'page-1',
            title: 'Page',
            missingFields: ['title'],
        }

        // Act
        const response = await POST(
            request([duplicate, duplicate]),
            {} as never,
        )

        // Assert
        expect(response.status).toBe(400)
        expect(mockGetPayload).not.toHaveBeenCalled()
        expect(mockGenerateAutoSEOMeta).not.toHaveBeenCalled()
    })

    it('returns 404 when the authorized site does not exist', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(null)

        // Act
        const response = await POST(
            request([], { siteId: 'missing-site' }),
            {} as never,
        )

        // Assert
        expect(response.status).toBe(404)
        expect(mockEvaluateAuthoritativeLocalSeo).not.toHaveBeenCalled()
    })

    it('returns 403 for cross-tenant access without starting AI', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'other-tenant',
        })

        // Act
        const response = await POST(request([]), {} as never)

        // Assert
        expect(response.status).toBe(403)
        expect(mockEvaluateAuthoritativeLocalSeo).not.toHaveBeenCalled()
        expect(mockGenerateAutoSEOMeta).not.toHaveBeenCalled()
    })

    it('returns 409 for a stale score revision without starting AI', async () => {
        // Arrange
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(
            evaluation([], 'b'.repeat(64)),
        )

        // Act
        const response = await POST(request([]), {} as never)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(body.error.code).toBe('STALE_REVISION')
        expect(mockGenerateAutoSEOMeta).not.toHaveBeenCalled()
    })

    it('returns 409 when requested fields no longer match authoritative gaps', async () => {
        // Arrange
        const requested: RequestedItem[] = [
            {
                collection: 'blogs',
                id: 'blog-1',
                title: 'Post',
                missingFields: ['title'],
            },
        ]
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(
            evaluation([{ ...requested[0], missingFields: ['description'] }]),
        )

        // Act
        const response = await POST(request(requested), {} as never)

        // Assert
        expect(response.status).toBe(409)
        expect(mockGenerateAutoSEOMeta).not.toHaveBeenCalled()
    })

    it('omits proposed title when only description is authoritatively missing', async () => {
        // Arrange
        const items: RequestedItem[] = [
            {
                collection: 'pages',
                id: 'page-1',
                title: 'About',
                missingFields: ['description'],
            },
        ]
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(evaluation(items))

        // Act
        const response = await POST(request(items), {} as never)
        const events = await dataEvents(response)

        // Assert
        expect(events[0].proposedTitle).toBeUndefined()
        expect(events[0].proposedDescription).toBeDefined()
    })

    it('runs at most four AI generations concurrently', async () => {
        // Arrange
        const items = Array.from({ length: 8 }, (_, index) => ({
            collection: 'pages' as const,
            id: String(index),
            title: `Page ${index}`,
            missingFields: ['title'] as Array<'title'>,
        }))
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(evaluation(items))
        let active = 0
        let maximumActive = 0
        let releaseGate: (() => void) | undefined
        const gate = new Promise<void>((resolve) => {
            releaseGate = resolve
        })
        mockGenerateAutoSEOMeta.mockImplementation(async () => {
            active += 1
            maximumActive = Math.max(maximumActive, active)
            await gate
            active -= 1
            return { title: 'Generated', description: 'Description' }
        })

        // Act
        const response = await POST(request(items), {} as never)
        await vi.waitFor(() => {
            expect(mockGenerateAutoSEOMeta).toHaveBeenCalledTimes(4)
        })
        releaseGate?.()
        await response.text()

        // Assert
        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledTimes(8)
        expect(maximumActive).toBeLessThanOrEqual(4)
    })

    it('aborts in-flight generation and stops scheduling when the request closes', async () => {
        const items = Array.from({ length: 8 }, (_, index) => ({
            collection: 'pages' as const,
            id: String(index),
            title: `Page ${index}`,
            missingFields: ['title'] as Array<'title'>,
        }))
        const requestController = new AbortController()
        const generationSignals: AbortSignal[] = []
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(evaluation(items))
        mockGenerateAutoSEOMeta.mockImplementation(
            (...args: unknown[]) =>
                new Promise((_, reject) => {
                    const signal = args[5] as AbortSignal
                    generationSignals.push(signal)
                    signal.addEventListener(
                        'abort',
                        () => reject(new DOMException('Aborted', 'AbortError')),
                        { once: true },
                    )
                }),
        )

        const response = await POST(
            abortableRequest(items, requestController.signal),
            {} as never,
        )
        await vi.waitFor(() => {
            expect(mockGenerateAutoSEOMeta).toHaveBeenCalledTimes(4)
        })
        requestController.abort()
        await response.text()

        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledTimes(4)
        expect(generationSignals).toHaveLength(4)
        expect(generationSignals.every((signal) => signal.aborted)).toBe(true)
    })

    it('aborts in-flight generation when the SSE reader cancels', async () => {
        const items = Array.from({ length: 8 }, (_, index) => ({
            collection: 'pages' as const,
            id: String(index),
            title: `Page ${index}`,
            missingFields: ['title'] as Array<'title'>,
        }))
        const generationSignals: AbortSignal[] = []
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(evaluation(items))
        mockGenerateAutoSEOMeta.mockImplementation(
            (...args: unknown[]) =>
                new Promise((_, reject) => {
                    const signal = args[5] as AbortSignal
                    generationSignals.push(signal)
                    signal.addEventListener(
                        'abort',
                        () => reject(new DOMException('Aborted', 'AbortError')),
                        { once: true },
                    )
                }),
        )

        const response = await POST(request(items), {} as never)
        const reader = response.body!.getReader()
        const first = await reader.read()
        expect(new TextDecoder().decode(first.value)).toContain('retry: 3000')
        await vi.waitFor(() => {
            expect(mockGenerateAutoSEOMeta).toHaveBeenCalledTimes(4)
        })

        await reader.cancel()
        await vi.waitFor(() => {
            expect(
                generationSignals.every((signal) => signal.aborted),
            ).toBe(true)
        })

        expect(mockGenerateAutoSEOMeta).toHaveBeenCalledTimes(4)
        expect(generationSignals).toHaveLength(4)
    })
})
