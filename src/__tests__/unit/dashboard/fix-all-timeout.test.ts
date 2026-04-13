/**
 * Unit Tests — Fix-All SSE Timeout & Retry
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.39  → SSE retry directive
 *   TC-F03.40  → 15s timeout sends error event
 *   TC-F03.41  → stream closes gracefully on timeout
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, roles: [] as string[], tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any) => handler(mockUser, req)),
}))

const mockFindByID = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

// Slow AI generation to test timeout
const mockGenerateAutoSEOMeta = vi.fn()
vi.mock('@/lib/ai/generate-meta', () => ({
    generateAutoSEOMeta: (...args: any[]) => mockGenerateAutoSEOMeta(...args),
}))

import { POST } from '@/app/api/seo/fix-all/route'

function makeRequest(missingSeo: any[]) {
    return {
        json: () => Promise.resolve({ siteId: 'site-1', missingSeo }),
    } as unknown as Request
}

async function readSSEStream(res: Response): Promise<string[]> {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    const chunks: string[] = []

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(decoder.decode(value, { stream: true }))
    }
    return chunks
}

describe('Fix-All SSE Timeout & Retry [TC-F03.39, TC-F03.40, TC-F03.41]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useRealTimers()
        mockFindByID.mockResolvedValue({ id: 'site-1', name: 'Store', tenant: 'tenant-1' })
    })

    it('[TC-F03.39] sends retry:3000 directive as first SSE event', async () => {
        // Arrange
        mockGenerateAutoSEOMeta.mockResolvedValue({ title: 'T', description: 'D' })
        const req = makeRequest([{ collection: 'pages', id: '1', title: 'P', missingFields: ['title'] }])

        // Act
        const res = await POST(req, {} as any)
        const chunks = await readSSEStream(res)

        // Assert
        expect(chunks[0]).toContain('retry: 3000')
    })

    it('[TC-F03.39] returns SSE content type', async () => {
        // Arrange
        mockGenerateAutoSEOMeta.mockResolvedValue({ title: 'T', description: 'D' })
        const req = makeRequest([{ collection: 'pages', id: '1', title: 'P', missingFields: ['title'] }])

        // Act
        const res = await POST(req, {} as any)
        await readSSEStream(res) // consume stream

        // Assert
        expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    })

    it('[TC-F03.40] completes normally when AI responds fast', async () => {
        // Arrange
        mockGenerateAutoSEOMeta.mockResolvedValue({ title: 'Generated', description: 'Desc' })
        const req = makeRequest([
            { collection: 'pages', id: '1', title: 'Page 1', missingFields: ['title'] },
            { collection: 'pages', id: '2', title: 'Page 2', missingFields: ['description'] },
        ])

        // Act
        const res = await POST(req, {} as any)
        const chunks = await readSSEStream(res)
        const allText = chunks.join('')

        // Assert — should have retry + 2 data events
        expect(allText).toContain('retry: 3000')
        const dataEvents = allText.split('data: ').filter(s => s.trim().length > 0)
        expect(dataEvents.length).toBeGreaterThanOrEqual(2)
    })

    it('[TC-F03.41] timeout sends error event after 15s', async () => {
        // Arrange — AI takes 20s per item
        vi.useFakeTimers()
        mockGenerateAutoSEOMeta.mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({ title: 'T', description: 'D' }), 20_000))
        )

        const req = makeRequest([{ collection: 'pages', id: '1', title: 'Slow', missingFields: ['title'] }])

        // Act
        const res = await POST(req, {} as any)
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()

        // Read retry directive
        const first = await reader.read()
        expect(decoder.decode(first.value)).toContain('retry: 3000')

        // Advance past 15s timeout
        vi.advanceTimersByTime(15_001)

        // Read timeout error event
        const second = await reader.read()
        const text = decoder.decode(second.value)
        expect(text).toContain('"error":"timeout"')

        // Stream should be closed
        const third = await reader.read()
        expect(third.done).toBe(true)

        vi.useRealTimers()
    })
})
