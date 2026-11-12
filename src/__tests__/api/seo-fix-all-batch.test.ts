/**
 * POST /api/seo/fix-all — batched generation through the ECH AI platform.
 * TC-IDs: TC-F37-04-44..51 (docs/qa/F37-local-seo.md). The per-item path (no platform actor)
 * keeps its coverage in seo-fix-all.test.ts (TC-F37-04-16, 30..40).
 */
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
vi.mock('@/lib/rateLimit', () => ({
    checkTwoTierRateLimit: vi.fn().mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetAt: Date.now() + 60_000,
    }),
}))

const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

const mockEvaluateAuthoritativeLocalSeo = vi.fn()
vi.mock('@/lib/seo/local-seo-evaluation', () => ({
    evaluateAuthoritativeLocalSeo: (...args: unknown[]) =>
        mockEvaluateAuthoritativeLocalSeo(...args),
}))

// The platform is configured in this file: the route resolves an actor and batches.
vi.mock('@/lib/ai-platform/config', () => ({ isAiTasksEnabled: () => true }))
const ACTOR = {
    user: { id: 1, email: 'owner@shop.my' },
    tenantId: '1',
    organizationId: 'org_1',
    role: 'owner',
}
vi.mock('@/lib/ai-platform/context', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/ai-platform/context')>()),
    resolveActorForUser: vi.fn(async () => ACTOR),
}))

const mockBatch = vi.fn()
vi.mock('@/lib/ai/generate-meta-batch', () => ({
    generateAutoSEOMetaBatch: (...args: unknown[]) => mockBatch(...args),
}))
const mockSingle = vi.fn()
vi.mock('@/lib/ai/generate-meta', () => ({
    generateAutoSEOMeta: (...args: unknown[]) => mockSingle(...args),
}))

import { AiClientError } from '@ech/ai-contracts'
import { POST } from '@/app/api/seo/fix-all/route'
import {
    FIX_ALL_RETRY_BACKOFF_MS,
    FIX_ALL_TIMEOUT_MS,
} from '@/lib/seo/fix-all-protocol'

interface RequestedItem {
    collection: 'pages' | 'products' | 'blogs'
    id: string
    title: string
    context?: string
    missingFields: Array<'title' | 'description'>
}
interface SentItem {
    id: string
    type: 'page' | 'product'
    itemName: string
    context?: string
}

const pageItems = (count: number, collection: RequestedItem['collection'] = 'pages'): RequestedItem[] =>
    Array.from({ length: count }, (_, index) => ({
        collection,
        id: String(index),
        title: `Page ${index}`,
        missingFields: ['title', 'description'] as Array<'title' | 'description'>,
    }))

function request(items: RequestedItem[]) {
    return {
        json: () =>
            Promise.resolve({
                siteId: 'site-1',
                revisionToken: CURRENT_REVISION,
                missingSeo: items,
            }),
    } as unknown as Request
}

async function dataEvents(response: Response): Promise<Array<Record<string, unknown>>> {
    const text = await response.text()
    return text
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => JSON.parse(line.replace('data: ', '')) as Record<string, unknown>)
}

const metaFor = (item: SentItem) => ({ title: `Title ${item.itemName}`, description: `Description ${item.itemName}` })
const answerAll = (items: SentItem[]) => new Map(items.map((item) => [item.id, metaFor(item)]))
const answerOnly = (items: SentItem[], keep: (item: SentItem) => boolean) =>
    new Map(items.filter(keep).map((item) => [item.id, metaFor(item)]))
const batchError = (cause: unknown) => new Error('AI meta batch generation failed: x', { cause })
const busy = (retryAfterMs?: number) =>
    batchError(new AiClientError('The AI is busy right now. Try again in a minute.', 429, 'provider_rate_limited', retryAfterMs))
const batchSizes = () => mockBatch.mock.calls.map((call) => (call[0] as SentItem[]).length)
const sentNames = (callIndex: number) => (mockBatch.mock.calls[callIndex][0] as SentItem[]).map((item) => item.itemName)

describe('POST /api/seo/fix-all — batched generation [TC-F37-04-44..51]', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        vi.clearAllMocks()
        mockUser.roles = []
        mockUser.tenants = [{ tenant: 'tenant-1', status: 'active' }]
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            name: 'My Store',
            tenant: 'tenant-1',
            seo: { trackedKeywords: [{ keyword: 'nasi lemak' }] },
        })
        mockBatch.mockImplementation(async (items: SentItem[]) => answerAll(items))
        mockSingle.mockResolvedValue({ title: 'Single title', description: 'Single description' })
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.useRealTimers()
        errorSpy.mockRestore()
    })

    function arrange(items: RequestedItem[]) {
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue({
            response: { revisionToken: CURRENT_REVISION },
            metadataItems: items,
        })
    }

    it('[TC-F37-04-44] 15 items are one batch call, one fix event per item, then done', async () => {
        // Arrange
        const items = pageItems(14).concat({
            collection: 'products',
            id: 'p-1',
            title: 'Nasi Lemak Kit',
            context: 'Ready to cook',
            missingFields: ['title'],
        })
        arrange(items)

        // Act
        const response = await POST(request(items), {} as never)
        const events = await dataEvents(response)

        // Assert — exactly one platform call, not fifteen
        expect(mockBatch).toHaveBeenCalledTimes(1)
        expect(mockSingle).not.toHaveBeenCalled()
        const [sent, siteName, actor, options] = mockBatch.mock.calls[0] as [SentItem[], string, unknown, { keywords: string[] }]
        expect(sent).toHaveLength(15)
        expect(new Set(sent.map((item) => item.id)).size).toBe(15)
        expect(sent.at(-1)).toMatchObject({ type: 'product', itemName: 'Nasi Lemak Kit', context: 'Ready to cook' })
        expect(sent[0]).toMatchObject({ type: 'page', itemName: 'Page 0' })
        expect(siteName).toBe('My Store')
        expect(actor).toBe(ACTOR)
        expect(options.keywords).toEqual(['nasi lemak'])

        // Same event shape as the per-item path; the title-only product gets no description
        expect(events.filter((event) => event.proposedTitle)).toHaveLength(15)
        expect(events[0]).toMatchObject({ targetId: '0', collection: 'pages', name: 'Page 0', proposedTitle: 'Title Page 0', proposedDescription: 'Description Page 0' })
        const product = events.find((event) => event.targetId === 'p-1')
        expect(product).toMatchObject({ proposedTitle: 'Title Nasi Lemak Kit' })
        expect(product).not.toHaveProperty('proposedDescription')
        expect(events.at(-1)).toEqual({ done: true, succeeded: 15, failed: 0 })
    })

    it('[TC-F37-04-45] 25 items are two even batch calls, never more than two in flight, 100 items need five', async () => {
        // Arrange
        const items = pageItems(25)
        arrange(items)

        // Act
        const events = await dataEvents(await POST(request(items), {} as never))

        // Assert
        expect(batchSizes()).toEqual([13, 12])
        expect(events.at(-1)).toEqual({ done: true, succeeded: 25, failed: 0 })

        // Arrange — 100 items = 5 chunks of 20, gated to watch the concurrency
        vi.clearAllMocks()
        const many = pageItems(100)
        arrange(many)
        let active = 0
        let maximumActive = 0
        let release: (() => void) | undefined
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        mockBatch.mockImplementation(async (sent: SentItem[]) => {
            active += 1
            maximumActive = Math.max(maximumActive, active)
            await gate
            active -= 1
            return answerAll(sent)
        })

        // Act
        const response = await POST(request(many), {} as never)
        await vi.waitFor(() => expect(mockBatch).toHaveBeenCalledTimes(2))
        release?.()
        const manyEvents = await dataEvents(response)

        // Assert
        expect(batchSizes()).toEqual([20, 20, 20, 20, 20])
        expect(maximumActive).toBe(2)
        expect(manyEvents.at(-1)).toEqual({ done: true, succeeded: 100, failed: 0 })
    })

    it('[TC-F37-04-45] a chunk is streamed as soon as it returns, before the other chunk finishes', async () => {
        // Arrange — chunk 2 never answers until released
        const items = pageItems(25)
        arrange(items)
        let releaseSecond: (() => void) | undefined
        mockBatch.mockImplementation(async (sent: SentItem[]) => {
            if (sent[0].itemName === 'Page 13') await new Promise<void>((resolve) => (releaseSecond = resolve))
            return answerAll(sent)
        })

        // Act
        const response = await POST(request(items), {} as never)
        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let text = ''
        await vi.waitFor(async () => {
            text += decoder.decode((await reader.read()).value)
            expect((text.match(/"proposedTitle"/g) ?? []).length).toBe(13)
        })

        // Assert — first 13 arrived, no done frame yet
        expect(text).not.toContain('"done"')
        releaseSecond?.()
        while (!text.includes('"done":true')) {
            const chunk = await reader.read()
            if (chunk.done) break
            text += decoder.decode(chunk.value)
        }
        expect(text).toContain('{"done":true,"succeeded":25,"failed":0}')
    })

    it('[TC-F37-04-46] an item missing or invalid in the answer is retried once and then succeeds', async () => {
        // Arrange — the first answer skips "Page 3" and "Page 7"
        vi.useFakeTimers()
        const items = pageItems(10)
        arrange(items)
        mockBatch
            .mockImplementationOnce(async (sent: SentItem[]) => answerOnly(sent, (item) => !['Page 3', 'Page 7'].includes(item.itemName)))
            .mockImplementation(async (sent: SentItem[]) => answerAll(sent))

        // Act
        const response = await POST(request(items), {} as never)
        const eventsPromise = dataEvents(response)
        await vi.advanceTimersByTimeAsync(FIX_ALL_RETRY_BACKOFF_MS + 100)
        const events = await eventsPromise

        // Assert — retry is a smaller batch of just the two open items
        expect(batchSizes()).toEqual([10, 2])
        expect(sentNames(1)).toEqual(['Page 3', 'Page 7'])
        expect(events.filter((event) => event.proposedTitle)).toHaveLength(10)
        expect(events.at(-1)).toEqual({ done: true, succeeded: 10, failed: 0 })
    })

    it('[TC-F37-04-46] one item left over is retried through the per-item call, not another batch', async () => {
        // Arrange
        vi.useFakeTimers()
        const items = pageItems(3)
        arrange(items)
        mockBatch.mockImplementation(async (sent: SentItem[]) => answerOnly(sent, (item) => item.itemName !== 'Page 1'))

        // Act
        const response = await POST(request(items), {} as never)
        const eventsPromise = dataEvents(response)
        await vi.advanceTimersByTimeAsync(FIX_ALL_RETRY_BACKOFF_MS + 100)
        const events = await eventsPromise

        // Assert
        expect(mockBatch).toHaveBeenCalledTimes(1)
        expect(mockSingle).toHaveBeenCalledTimes(1)
        expect(mockSingle.mock.calls[0].slice(0, 3)).toEqual(['page', 'Page 1', 'My Store'])
        expect(events.find((event) => event.targetId === '1')).toMatchObject({ proposedTitle: 'Single title' })
        expect(events.at(-1)).toEqual({ done: true, succeeded: 3, failed: 0 })
    })

    it('[TC-F37-04-47] a chunk that fails with 429 is retried after the backoff and succeeds', async () => {
        // Arrange
        vi.useFakeTimers()
        const items = pageItems(6)
        arrange(items)
        mockBatch.mockRejectedValueOnce(busy())

        // Act
        const response = await POST(request(items), {} as never)
        const eventsPromise = dataEvents(response)
        await vi.advanceTimersByTimeAsync(FIX_ALL_RETRY_BACKOFF_MS - 1)
        expect(mockBatch).toHaveBeenCalledTimes(1) // still backing off
        await vi.advanceTimersByTimeAsync(2)
        const events = await eventsPromise

        // Assert — the whole chunk goes out again as one call
        expect(batchSizes()).toEqual([6, 6])
        expect(events.filter((event) => event.error === 'item_failed')).toEqual([])
        expect(events.at(-1)).toEqual({ done: true, succeeded: 6, failed: 0 })
    })

    it('[TC-F37-04-47] honours the platform Retry-After for the backoff', async () => {
        // Arrange — the platform asks for 4 s
        vi.useFakeTimers()
        const items = pageItems(4)
        arrange(items)
        mockBatch.mockRejectedValueOnce(busy(4_000))

        // Act
        const response = await POST(request(items), {} as never)
        const eventsPromise = dataEvents(response)
        await vi.advanceTimersByTimeAsync(FIX_ALL_RETRY_BACKOFF_MS + 500)
        expect(mockBatch).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(2_500)
        const events = await eventsPromise

        // Assert
        expect(mockBatch).toHaveBeenCalledTimes(2)
        expect(events.at(-1)).toEqual({ done: true, succeeded: 4, failed: 0 })
    })

    it.each([
        ['busy', () => busy(), 'busy'],
        ['timeout', () => batchError(new AiClientError('too long', 504)), 'timeout'],
        ['unavailable', () => batchError(new AiClientError('down', 503)), 'unavailable'],
    ])('[TC-F37-04-48] a chunk still failing after the retry makes its items item_failed (%s) and done counts them', async (_name, makeError, reason) => {
        // Arrange — 3 items so the retry is a batch (timeout halves it: 2 + 1)
        vi.useFakeTimers()
        const items = pageItems(3)
        arrange(items)
        mockBatch.mockImplementation(async () => {
            throw makeError()
        })
        mockSingle.mockRejectedValue(new Error('AI meta generation failed', { cause: makeError().cause }))

        // Act
        const response = await POST(request(items), {} as never)
        const eventsPromise = dataEvents(response)
        await vi.advanceTimersByTimeAsync(FIX_ALL_RETRY_BACKOFF_MS + 100)
        const events = await eventsPromise

        // Assert — one retry only, then item_failed with the real reason
        const failed = events.filter((event) => event.error === 'item_failed')
        expect(failed.map((event) => event.reason)).toEqual([reason, reason, reason])
        expect(failed.map((event) => event.targetId).sort()).toEqual(['0', '1', '2'])
        expect(events.filter((event) => event.proposedTitle)).toHaveLength(0)
        expect(events.at(-1)).toEqual({ done: true, succeeded: 0, failed: 3 })
        expect(mockBatch.mock.calls.length + mockSingle.mock.calls.length).toBeLessThanOrEqual(3)
    })

    it('[TC-F37-04-48] a timed-out chunk is retried as two smaller batches', async () => {
        // Arrange
        vi.useFakeTimers()
        const items = pageItems(8)
        arrange(items)
        mockBatch.mockRejectedValueOnce(batchError(new AiClientError('too long', 504)))

        // Act
        const response = await POST(request(items), {} as never)
        const eventsPromise = dataEvents(response)
        await vi.advanceTimersByTimeAsync(FIX_ALL_RETRY_BACKOFF_MS + 100)
        const events = await eventsPromise

        // Assert
        expect(batchSizes()).toEqual([8, 4, 4])
        expect(events.at(-1)).toEqual({ done: true, succeeded: 8, failed: 0 })
    })

    it.each([
        ['quota', batchError(new AiClientError('Your workspace reached today\'s AI limit.', 429))],
        ['failed', batchError(new AiClientError('bad request', 400))],
    ])('[TC-F37-04-49] a %s failure is not retried: items fail at once', async (reason, error) => {
        // Arrange
        const items = pageItems(4)
        arrange(items)
        mockBatch.mockRejectedValue(error)

        // Act
        const events = await dataEvents(await POST(request(items), {} as never))

        // Assert — no backoff wait (real timers), one call, every item failed with the reason
        expect(mockBatch).toHaveBeenCalledTimes(1)
        expect(mockSingle).not.toHaveBeenCalled()
        expect(events.filter((event) => event.error === 'item_failed').map((event) => event.reason)).toEqual([reason, reason, reason, reason])
        expect(events.at(-1)).toEqual({ done: true, succeeded: 0, failed: 4 })
        // the server log carries the reason, never the message
        expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('AI meta batch generation failed')
    })

    it('[TC-F37-04-49] a retry that cannot finish inside the remaining budget is skipped', async () => {
        // Arrange — the first call eats the whole stream budget minus 2 s
        vi.useFakeTimers()
        const items = pageItems(4)
        arrange(items)
        mockBatch.mockImplementation(async () => {
            await new Promise((resolve) => setTimeout(resolve, FIX_ALL_TIMEOUT_MS - 2_000))
            throw busy()
        })

        // Act
        const response = await POST(request(items), {} as never)
        const eventsPromise = dataEvents(response)
        await vi.advanceTimersByTimeAsync(FIX_ALL_TIMEOUT_MS)
        const events = await eventsPromise

        // Assert — marked busy straight away instead of being cut off by the stream timeout
        expect(mockBatch).toHaveBeenCalledTimes(1)
        expect(events.filter((event) => event.error === 'item_failed').map((event) => event.reason)).toEqual(['busy', 'busy', 'busy', 'busy'])
        expect(events.some((event) => event.error === 'timeout')).toBe(false)
        expect(events.at(-1)).toEqual({ done: true, succeeded: 0, failed: 4 })
    })

    it('[TC-F37-04-50] closing the request aborts the batch and stops retrying', async () => {
        // Arrange
        vi.useFakeTimers()
        const items = pageItems(4)
        arrange(items)
        const requestController = new AbortController()
        const signals: AbortSignal[] = []
        mockBatch.mockImplementation(
            (_items: unknown, _site: unknown, _actor: unknown, options: { signal: AbortSignal }) =>
                new Promise((_, reject) => {
                    signals.push(options.signal)
                    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
                }),
        )
        const abortable = new Request('http://localhost/api/seo/fix-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: requestController.signal,
            body: JSON.stringify({ siteId: 'site-1', revisionToken: CURRENT_REVISION, missingSeo: items }),
        })

        // Act
        const response = await POST(abortable, {} as never)
        const textPromise = response.text()
        await vi.waitFor(() => expect(mockBatch).toHaveBeenCalledTimes(1))
        requestController.abort()
        await textPromise
        await vi.advanceTimersByTimeAsync(10_000)

        // Assert
        expect(signals).toHaveLength(1)
        expect(signals[0].aborted).toBe(true)
        expect(mockBatch).toHaveBeenCalledTimes(1)
        expect(mockSingle).not.toHaveBeenCalled()
    })

    it('[TC-F37-04-51] items a batch answer omits for good fail with a generic reason after the one retry', async () => {
        // Arrange — the model never answers "Page 2", also not in the retry
        vi.useFakeTimers()
        const items = pageItems(5)
        arrange(items)
        mockBatch.mockImplementation(async (sent: SentItem[]) => answerOnly(sent, (item) => item.itemName !== 'Page 2'))
        mockSingle.mockRejectedValue(new Error('AI meta generation failed: no object'))

        // Act
        const response = await POST(request(items), {} as never)
        const eventsPromise = dataEvents(response)
        await vi.advanceTimersByTimeAsync(FIX_ALL_RETRY_BACKOFF_MS + 100)
        const events = await eventsPromise

        // Assert
        expect(events.filter((event) => event.error === 'item_failed')).toEqual([
            { error: 'item_failed', targetId: '2', collection: 'pages', name: 'Page 2', reason: 'failed' },
        ])
        expect(events.at(-1)).toEqual({ done: true, succeeded: 4, failed: 1 })
    })
})
