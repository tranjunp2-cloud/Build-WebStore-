import { describe, it, expect, vi } from 'vitest'
import { POST } from '@/app/api/products/generate-description/route'
import { NextRequest } from 'next/server'

// Bypass withAuth HOC — inject mock user trực tiếp
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn().mockImplementation((handler: any) => {
        return async (req: any, ctx: any) => {
            const user = { id: 'user-1', email: 'admin@example.com' }
            return handler(user, req, ctx)
        }
    }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'admin@example.com' }),
}))

// Mock bài toán OpenAI để không gọi HTTP thật ra ngoài (tránh tốn xèng)
vi.mock('openai', () => {
    const OpenAI = vi.fn()
    OpenAI.prototype.chat = {
        completions: {
            create: vi.fn().mockResolvedValue({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                description: "<p>Mock description for Vitest</p>",
                                shortDescription: "Short mock",
                                seoTitle: "SEO Title",
                                seoDescription: "SEO Desc"
                            })
                        }
                    }
                ]
            })
        }
    }
    return { default: OpenAI }
})

describe('POST /api/products/generate-description', () => {
    
    it('returns 400 validation error when name is missing', async () => {
        // Thiết lập mock Request thiếu tham số 'name'
        const req = new NextRequest('http://localhost:3000/api/products/generate-description', {
            method: 'POST',
            body: JSON.stringify({ category: 'Fashion' })
        })

        const response = await POST(req)
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.success).toBe(false)
        expect(json.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 200 with AI generated JSON data for correct inputs', async () => {
        // Tham số chuẩn
        const req = new NextRequest('http://localhost:3000/api/products/generate-description', {
            method: 'POST',
            body: JSON.stringify({ name: 'Baju Kurung', category: 'Fashion', features: 'Pink color' })
        })

        const response = await POST(req)
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.success).toBe(true)
        expect(json.data.shortDescription).toBe('Short mock')
        expect(json.data.seoTitle).toBe('SEO Title')
    })
})
