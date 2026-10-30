import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { AiClientError } from '@ech/ai-contracts'
import { POST, maxDuration } from '@/app/api/seo/fix-all/route'
import {
    FIX_ALL_KEEPALIVE_MS,
    FIX_ALL_MAX_DURATION_S,
    FIX_ALL_TIMEOUT_MS,
    classifyFixFailure,
    dominantFixFailureReason,
    isRetryableFixFailure,
    normalizeFixFailureReason,
    fixAllStreamBudgetMs,
    FIX_ALL_FLUSH_MARGIN_MS,
    FIX_ALL_MIN_STREAM_MS,
} from '@/lib/seo/fix-all-protocol'

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
        expect(events).toHaveLength(2) // proposal + done summary
        expect(events[1]).toEqual({ done: true, succeeded: 1, failed: 0 })
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

// ── TC-F37-04-30..36: time budget, per-item failures, done summary ──────
describe('POST /api/seo/fix-all — budget and per-item failures [TC-F37-04-30..36]', () => {
    const pageItems = (count: number): RequestedItem[] =>
        Array.from({ length: count }, (_, index) => ({
            collection: 'pages' as const,
            id: String(index),
            title: `Page ${index}`,
            missingFields: ['title'] as Array<'title'>,
        }))

    const slowSuccess = (delayMs: number) => () =>
        new Promise((resolve) =>
            setTimeout(
                () => resolve({ title: 'Generated', description: 'Desc' }),
                delayMs,
            ),
        )

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

    afterEach(() => {
        vi.useRealTimers()
    })

    it('[TC-F37-04-40] the stream budget shrinks by the time setup already used, never past maxDuration', () => {
        // Act + Assert — fast setup keeps the full budget
        expect(fixAllStreamBudgetMs(0)).toBe(FIX_ALL_TIMEOUT_MS)
        expect(fixAllStreamBudgetMs(2_000)).toBe(FIX_ALL_TIMEOUT_MS)
        // a slow cold start (20 s) leaves only what fits before maxDuration
        expect(fixAllStreamBudgetMs(20_000)).toBe(maxDuration * 1_000 - 20_000 - FIX_ALL_FLUSH_MARGIN_MS)
        expect(20_000 + fixAllStreamBudgetMs(20_000)).toBeLessThan(maxDuration * 1_000)
        // pathological setup still gives the first wave a floor
        expect(fixAllStreamBudgetMs(70_000)).toBe(FIX_ALL_MIN_STREAM_MS)
    })

    it('[TC-F37-04-30] budget is at least 45s and stays below maxDuration', () => {
        expect(FIX_ALL_TIMEOUT_MS).toBeGreaterThanOrEqual(45_000)
        expect(FIX_ALL_TIMEOUT_MS).toBeLessThan(maxDuration * 1_000)
        expect(FIX_ALL_MAX_DURATION_S).toBe(maxDuration)
        expect(FIX_ALL_KEEPALIVE_MS).toBeLessThan(FIX_ALL_TIMEOUT_MS)
    })

    it('[TC-F37-04-31] nine slow items (3 waves of 12s) all finish within the budget', async () => {
        // Arrange — 3 waves x 12s = 36s: cut by the old 15s limit, fits the new budget
        vi.useFakeTimers()
        const items = pageItems(9)
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(evaluation(items))
        mockGenerateAutoSEOMeta.mockImplementation(slowSuccess(12_000))

        // Act
        const response = await POST(request(items), {} as never)
        const eventsPromise = dataEvents(response)
        await vi.advanceTimersByTimeAsync(40_000)
        const events = await eventsPromise

        // Assert
        expect(events.filter((event) => event.proposedTitle)).toHaveLength(9)
        expect(events.some((event) => event.error === 'timeout')).toBe(false)
        expect(events.at(-1)).toEqual({ done: true, succeeded: 9, failed: 0 })
    })

    it.each([
        ['timeout', () => new Error('AI meta generation failed: slow', { cause: new DOMException('t', 'TimeoutError') })],
        ['timeout', () => new Error('AI meta generation failed: gw', { cause: new AiClientError('gateway timeout', 504) })],
        ['quota', () => new Error('AI meta generation failed: q', { cause: new AiClientError('limit', 429) })],
        ['unavailable', () => new Error('AI meta generation failed: bad', { cause: new AiClientError('bad gateway', 502) })],
        ['unavailable', () => new Error('AI meta generation failed: down', { cause: new AiClientError('down', 503) })],
        ['failed', () => new Error('AI meta generation failed: boom')],
    ])(
        '[TC-F37-04-32] failure kind %s emits item_failed and does not stop the other items',
        async (reason, makeError) => {
            // Arrange — the first item fails, the other two succeed
            const items = pageItems(3)
            mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(evaluation(items))
            mockGenerateAutoSEOMeta.mockImplementation(
                async (_type: string, itemName: string) => {
                    if (itemName === 'Page 0') throw makeError()
                    return { title: 'Generated', description: 'Desc' }
                },
            )
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            // Act
            const response = await POST(request(items), {} as never)
            const events = await dataEvents(response)

            // Assert
            const failed = events.filter((event) => event.error === 'item_failed')
            expect(failed).toEqual([
                {
                    error: 'item_failed',
                    targetId: '0',
                    collection: 'pages',
                    name: 'Page 0',
                    reason,
                },
            ])
            expect(events.filter((event) => event.proposedTitle)).toHaveLength(2)
            // Server log carries the reason, never the error message / prompt text
            const logged = JSON.stringify(errorSpy.mock.calls)
            expect(logged).toContain(`"reason":"${reason}"`)
            expect(logged).not.toContain('AI meta generation failed')
            errorSpy.mockRestore()
        },
    )

    it('[TC-F37-04-33] done summary counts succeeded and failed items', async () => {
        // Arrange
        const items = pageItems(4)
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(evaluation(items))
        mockGenerateAutoSEOMeta.mockImplementation(
            async (_type: string, itemName: string) => {
                if (itemName === 'Page 1' || itemName === 'Page 3')
                    throw new Error('boom')
                return { title: 'Generated', description: 'Desc' }
            },
        )
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        // Act
        const response = await POST(request(items), {} as never)
        const events = await dataEvents(response)

        // Assert — done is the last frame, after every item result
        expect(events.at(-1)).toEqual({ done: true, succeeded: 2, failed: 2 })
        errorSpy.mockRestore()
    })

    it('[TC-F37-04-34] overall timeout reports the unfinished and not-started items as pending', async () => {
        // Arrange — 6 items, 4 at a time: wave 1 (0-3) finishes at 20s, wave 2 never fits
        vi.useFakeTimers()
        const items = pageItems(6)
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(evaluation(items))
        mockGenerateAutoSEOMeta.mockImplementation(
            async (_type: string, itemName: string) => {
                if (itemName === 'Page 0') return { title: 'Generated', description: 'Desc' }
                return slowSuccess(FIX_ALL_TIMEOUT_MS + 10_000)()
            },
        )

        // Act
        const response = await POST(request(items), {} as never)
        const eventsPromise = dataEvents(response)
        await vi.advanceTimersByTimeAsync(FIX_ALL_TIMEOUT_MS + 1)
        const events = await eventsPromise

        // Assert
        const timeout = events.find((event) => event.error === 'timeout')
        expect(timeout).toMatchObject({
            error: 'timeout',
            pending: ['1', '2', '3', '4', '5'].map((id) => ({
                targetId: id,
                collection: 'pages',
                name: `Page ${id}`,
            })),
        })
        expect(events.some((event) => event.done === true)).toBe(false)
    })

    it('[TC-F37-04-35] sends an SSE comment keep-alive every 10s while waiting', async () => {
        // Arrange
        vi.useFakeTimers()
        const items = pageItems(1)
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(evaluation(items))
        mockGenerateAutoSEOMeta.mockImplementation(slowSuccess(25_000))

        // Act
        const response = await POST(request(items), {} as never)
        const textPromise = response.text()
        await vi.advanceTimersByTimeAsync(26_000)
        const text = await textPromise

        // Assert — pings at 10s and 20s, before the result and the summary
        expect(text.split(': ping\n\n')).toHaveLength(3)
        expect(text.indexOf(': ping')).toBeLessThan(text.indexOf('"proposedTitle"'))
        expect(text.trimEnd().endsWith('}')).toBe(true)
    })

    it('[TC-F37-04-36] classifyFixFailure reads name/status/code through the cause chain only', () => {
        expect(classifyFixFailure(new Error('x', { cause: new AiClientError('m', 429) }))).toEqual({ reason: 'quota', status: 429 })
        expect(classifyFixFailure(new AiClientError('m', 504))).toEqual({ reason: 'timeout', status: 504 })
        expect(classifyFixFailure(new Error('x', { cause: new DOMException('t', 'TimeoutError') }))).toEqual({ reason: 'timeout' })
        expect(classifyFixFailure(new Error('x', { cause: Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }) }))).toEqual({ reason: 'unavailable' })
        expect(classifyFixFailure(new AiClientError('m', 500))).toEqual({ reason: 'failed', status: 500 })
        expect(classifyFixFailure('timeout 429')).toEqual({ reason: 'failed' })
        expect(classifyFixFailure(null)).toEqual({ reason: 'failed' })
    })

    it('[TC-F37-04-52] a provider rate limit is "busy", the workspace limit stays "quota"', () => {
        const providerBusy = new AiClientError('The AI is busy right now. Try again in a minute.', 429, 'provider_rate_limited', 2_000)

        expect(classifyFixFailure(new Error('x', { cause: providerBusy }))).toEqual({ reason: 'busy', status: 429, retryAfterMs: 2_000 })
        expect(classifyFixFailure(providerBusy).reason).toBe('busy')
        // no code = the org's daily task limit
        expect(classifyFixFailure(new AiClientError("Your workspace reached today's AI limit.", 429))).toEqual({ reason: 'quota', status: 429 })
        // billing exhaustion (402) is not a retryable busy moment
        expect(classifyFixFailure(new AiClientError('no credit', 402, 'provider_insufficient_quota')).reason).not.toBe('busy')
    })

    it('[TC-F37-04-52] only timeout, busy and unavailable are retryable; busy is a known client-side reason', () => {
        expect((['timeout', 'busy', 'unavailable', 'quota', 'failed'] as const).filter(isRetryableFixFailure)).toEqual(['timeout', 'busy', 'unavailable'])
        expect(normalizeFixFailureReason('busy')).toBe('busy')
        expect(normalizeFixFailureReason('nonsense')).toBe('failed')
        expect(dominantFixFailureReason(['failed', 'timeout', 'busy'])).toBe('busy')
        expect(dominantFixFailureReason(['busy', 'quota'])).toBe('quota')
    })
})
