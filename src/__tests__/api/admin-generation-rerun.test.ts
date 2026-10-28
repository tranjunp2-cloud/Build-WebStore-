import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getPayload, resolveGenerationRecordActor, generateSiteWithAI, startCapture, finishCapture } = vi.hoisted(() => ({
    getPayload: vi.fn(),
    resolveGenerationRecordActor: vi.fn(),
    generateSiteWithAI: vi.fn(),
    startCapture: vi.fn(),
    finishCapture: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai/generation-actor', () => ({ resolveGenerationRecordActor }))
vi.mock('@/lib/ai/capture-generation', () => ({ startCapture, finishCapture }))
vi.mock('@/lib/ai/openai-generator', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/ai/openai-generator')>()),
    generateSiteWithAI,
}))
vi.mock('@/lib/admin/api-utils', () => ({
    withSuperAdmin: (handler: (request: Request, context: { user: { id: number } }) => Promise<Response>) =>
        async (request: Request) => handler(request, { user: { id: 2 } }),
    checkRateLimit: () => true,
}))

import { POST } from '@/app/api/admin/generations/[id]/rerun/route'

const context = { params: Promise.resolve({ id: '41' }) }
const request = () => new NextRequest('https://prime.test/api/admin/generations/41/rerun', { method: 'POST' })

describe('[TC-AIWB-99] POST /api/admin/generations/:id/rerun', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getPayload.mockResolvedValue({
            findByID: vi.fn().mockResolvedValue({ id: 41, endpoint: 'site-generator', promptText: 'Kopi Co | cafe | coffee | latte', user: null, tenant: 7 }),
        })
        startCapture.mockResolvedValue({ id: 'cap' })
        generateSiteWithAI.mockImplementation(async (_info, _extra, _lang, _ref, _over, _onEvent, options) => ({
            result: { siteName: 'Kopi Co', blocks: [{ blockType: 'hero' }] },
            events: [],
            requestedGenMode: 'template-first',
            effectiveGenMode: 'template-first',
            modeReason: options?.modeDecision?.modeReason,
            aiSkipReason: options?.modeDecision?.aiSkipReason,
        }))
    })

    it('TC-AIWB-99: a rerun without a billable merchant records why it ran without AI', async () => {
        // Arrange
        resolveGenerationRecordActor.mockResolvedValue({ actor: null, skipReason: 'record_missing_user' })

        // Act
        const response = await POST(request(), context)

        // Assert
        expect(response.status).toBe(200)
        expect((await response.json()).data).toMatchObject({ modeReason: 'no_ai_actor', aiSkipReason: 'record_missing_user' })
        expect(finishCapture).toHaveBeenCalledWith({ id: 'cap' }, expect.objectContaining({
            status: 'success',
            outputSnapshot: expect.objectContaining({ modeReason: 'no_ai_actor', aiSkipReason: 'record_missing_user' }),
        }))
    })
})
