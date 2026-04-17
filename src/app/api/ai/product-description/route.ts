import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import OpenAI from 'openai'
import { checkRateLimit } from '@/lib/rateLimit'

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

/**
 * POST /api/ai/product-description
 *
 * US-F08-01: AI Description Generator
 * Generates an engaging product description based on name and optional category.
 *
 * Body: { name: string, category?: string, language?: string }
 * Returns: { success: true, data: { description: string } }
 */
export const POST = withAuth(async (user, req) => {
    try {
        // Rate Limit: 20 AI tasks per hour
        const rateLimit = await checkRateLimit(String(user.id), 20)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: 'Rate limit exceeded. Try again later.' },
                { status: 429 }
            )
        }

        const body = await req.json()
        const { name, category, language = 'en' } = body

        if (!name || typeof name !== 'string' || name.trim().length < 3) {
            return NextResponse.json(
                { success: false, error: 'Product name (min 3 chars) is required' },
                { status: 400 }
            )
        }

        const openai = getOpenAI()
        if (!openai) {
            return NextResponse.json(
                { success: false, error: 'OPENAI_API_KEY is not configured' },
                { status: 501 }
            )
        }

        const categoryContext = category ? ` in the "${category}" category` : ''

        const systemPrompt = `You are a professional conversion-focused e-commerce copywriter for the Malaysian market.
Your task is to write a highly engaging, persuasive, and professional product description.

The output MUST be in ${language === 'ms' ? 'Bahasa Melayu (Malay)' : 'English'}.

STRICT OUTPUT FORMAT — respond ONLY with a valid JSON object, no extra text:
{
  "description": "The full product description in plain text ONLY. Write 3-4 paragraphs highlighting the key benefits, features, and why the customer needs this. DO NOT include any HTML tags or markdown formatting. Use simple newlines to separate paragraphs. Ensure the tone is persuasive and professional."
}

RULES:
1. Keep it structured and easy to read.
2. Focus on the benefits of the product.
3. Be persuasive but honest.
4. Do NOT include store/brand names unless provided.
5. NO HTML TAGS WHATSOEVER. Return pure plain text only.`

        const userPrompt = `Write a product description for this product:
Product Name: "${name.trim()}"${categoryContext}`

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 800,
            response_format: { type: 'json_object' },
        })

        const content = completion.choices[0]?.message?.content
        if (!content) {
            throw new Error('No content received from OpenAI')
        }

        const parsed = JSON.parse(content) as {
            description?: string
        }

        const description = (parsed.description || '').trim()

        return NextResponse.json({
            success: true,
            data: { description },
        })
    } catch (error) {
        console.error('API /api/ai/product-description error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to generate product description' },
            { status: 500 }
        )
    }
})
