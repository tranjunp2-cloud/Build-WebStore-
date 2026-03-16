import { describe, it, expect, vi } from 'vitest'
import { POST } from '@/app/api/products/generate-description/route'
import { NextRequest } from 'next/server'

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
    
    it('returns 422 validations error when name is missing', async () => {
        // Thiết lập mock Request thiếu tham số 'name'
        const req = new NextRequest('http://localhost:3000/api/products/generate-description', {
            method: 'POST',
            body: JSON.stringify({ category: 'Fashion' })
        })

        const response = await POST(req)
        const json = await response.json()

        expect(response.status).toBe(422)
        expect(json.success).toBe(false)
        expect(json.error.message).toContain('Product name is required')
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
