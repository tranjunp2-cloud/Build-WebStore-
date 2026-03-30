import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

const mockUser = { id: 1, tenants: [{ tenant: 'tenant-1' }] }
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any) => handler(mockUser, req)),
}))

vi.mock('openai', () => ({ default: vi.fn() }))

import { POST } from '@/app/api/ai/generate-blog/route'

// ─── TC-F17.013: AI blog content generation ───────────────────────────

describe('POST /api/ai/generate-blog [TC-F17.013]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delete process.env.OPENAI_API_KEY
    })

    it('returns 400 when prompt is missing', async () => {
        const req = { json: () => Promise.resolve({}) } as unknown as Request
        const res = await POST(req, {} as any)
        expect(res.status).toBe(400)
    })

    it('returns 501 when OPENAI_API_KEY not configured', async () => {
        const req = { json: () => Promise.resolve({ prompt: 'Write about coffee' }) } as unknown as Request
        const res = await POST(req, {} as any)
        const body = await res.json()

        expect(res.status).toBe(501)
        expect(body.error).toContain('OPENAI_API_KEY')
    })

    it('generates blog post with valid prompt and API key', async () => {
        process.env.OPENAI_API_KEY = 'test-key'

        const OpenAI = (await import('openai')).default as any
        OpenAI.mockImplementation(() => ({
            chat: {
                completions: {
                    create: vi.fn().mockResolvedValue({
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    title: 'Coffee Culture in KL',
                                    content: '<p>Blog content here</p>',
                                    seoTitle: 'Coffee Culture',
                                    seoDescription: 'Explore coffee culture.',
                                }),
                            },
                        }],
                    }),
                },
            },
        }))

        const req = { json: () => Promise.resolve({ prompt: 'Coffee culture in KL' }) } as unknown as Request
        const res = await POST(req, {} as any)
        const body = await res.json()

        expect(body.success).toBe(true)
        expect(body.data.title).toBe('Coffee Culture in KL')
    })

    it('handles language parameter', async () => {
        process.env.OPENAI_API_KEY = 'test-key'

        const OpenAI = (await import('openai')).default as any
        OpenAI.mockImplementation(() => ({
            chat: {
                completions: {
                    create: vi.fn().mockResolvedValue({
                        choices: [{ message: { content: '{"title":"Budaya Kopi","content":"<p>Content</p>","seoTitle":"Kopi","seoDescription":"Desc"}' } }],
                    }),
                },
            },
        }))

        const req = { json: () => Promise.resolve({ prompt: 'Kopi culture', language: 'ms' }) } as unknown as Request
        const res = await POST(req, {} as any)
        const body = await res.json()

        expect(body.success).toBe(true)
    })

    it('returns 500 when OpenAI fails', async () => {
        process.env.OPENAI_API_KEY = 'test-key'

        const OpenAI = (await import('openai')).default as any
        OpenAI.mockImplementation(() => ({
            chat: {
                completions: {
                    create: vi.fn().mockRejectedValue(new Error('Rate limited')),
                },
            },
        }))

        const req = { json: () => Promise.resolve({ prompt: 'Test' }) } as unknown as Request
        const res = await POST(req, {} as any)

        expect(res.status).toBe(500)
    })
})
