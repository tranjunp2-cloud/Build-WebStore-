import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/ai/product-description/route'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth', () => ({
    withAuth: (handler: any) => async (req: any, ...args: any[]) => {
        // Mock a signed-in user
        const mockUser = { id: 1, email: 'test@example.com' }
        return handler(mockUser, req, ...args)
    }
}))

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn()
}))

const mockCreate = vi.fn()
vi.mock('openai', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            chat: {
                completions: {
                    create: mockCreate
                }
            }
        }))
    }
})

import { checkRateLimit } from '@/lib/rateLimit'

describe('POST /api/ai/product-description', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.OPENAI_API_KEY = 'test-key'
        
        // Default to allowed rate limit
        vi.mocked(checkRateLimit).mockReturnValue({
            allowed: true,
            remaining: 19,
            reset: Date.now() + 3600000
        })
    })

    const createMockRequest = (body: any) => {
        return new NextRequest('http://localhost/api/ai/product-description', {
            method: 'POST',
            body: JSON.stringify(body)
        })
    }

    it('returns 429 if rate limit is exceeded', async () => {
        vi.mocked(checkRateLimit).mockReturnValue({
            allowed: false,
            remaining: 0,
            reset: Date.now() + 10000
        })

        const req = createMockRequest({ name: 'Test Product' })
        const res = await POST(req as any, {} as any)
        
        expect(res.status).toBe(429)
        const json = await res.json()
        expect(json.success).toBe(false)
        expect(json.error).toContain('Rate limit exceeded')
    })

    it('returns 400 if product name is missing or too short', async () => {
        const req1 = createMockRequest({ name: '' })
        const res1 = await POST(req1 as any, {} as any)
        expect(res1.status).toBe(400)
        
        const req2 = createMockRequest({ name: 'AB' })
        const res2 = await POST(req2 as any, {} as any)
        expect(res2.status).toBe(400)
    })

    it('returns 501 if OPENAI_API_KEY is missing', async () => {
        delete process.env.OPENAI_API_KEY
        
        const req = createMockRequest({ name: 'Valid Product Name' })
        const res = await POST(req as any, {} as any)
        
        expect(res.status).toBe(501)
        const json = await res.json()
        expect(json.error).toContain('OPENAI_API_KEY')
    })

    it('returns 200 and generated description on success', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    message: {
                        content: JSON.stringify({ description: 'This is a test AI description' })
                    }
                }
            ]
        })

        const req = createMockRequest({ name: 'Awesome Product', category: 'Electronics' })
        const res = await POST(req as any, {} as any)
        
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.success).toBe(true)
        expect(json.data.description).toBe('This is a test AI description')
        
        // Verify OpenAI was called with correct parameters
        expect(mockCreate).toHaveBeenCalledTimes(1)
        const callArgs = mockCreate.mock.calls[0][0]
        expect(callArgs.messages[1].content).toContain('Awesome Product')
        expect(callArgs.messages[1].content).toContain('Electronics')
    })

    it('returns 500 if OpenAI throws an error', async () => {
        mockCreate.mockRejectedValueOnce(new Error('OpenAI API Error'))

        const req = createMockRequest({ name: 'Awesome Product' })
        const res = await POST(req as any, {} as any)
        
        expect(res.status).toBe(500)
        const json = await res.json()
        expect(json.success).toBe(false)
        expect(json.error).toContain('Failed to generate product description')
    })
})
