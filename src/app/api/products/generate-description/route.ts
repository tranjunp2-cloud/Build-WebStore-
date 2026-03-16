import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'

const generateDescriptionSchema = z.object({
    name: z.string().min(1),
    category: z.string().optional(),
    features: z.string().optional(),
})

/**
 * POST /api/products/generate-description
 * Uses AI to generate a product description and SEO metadata.
 *
 * Body: { name, category?, features? }
 * Response: { description, shortDescription, seoTitle, seoDescription }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const parsed = generateDescriptionSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.flatten() } },
                { status: 400 } // using 400 for consistency in our standard validation
            )
        }

        const { name, category, features } = parsed.data

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        const prompt = [
            `Product name: ${name}`,
            category && `Category: ${category}`,
            features && `Key features: ${features}`,
            `Market: Malaysia (prices in MYR)`,
        ].filter(Boolean).join('\n')

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a professional e-commerce copywriter for Malaysian businesses. Generate compelling product copy. Output JSON only:
{
  "description": "2-3 paragraph rich description (HTML with <p>, <strong>, <ul> tags allowed)",
  "shortDescription": "One-liner for product cards (max 150 chars)",
  "seoTitle": "SEO meta title (max 60 chars)",
  "seoDescription": "SEO meta description (max 155 chars)"
}`,
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.6,
            max_tokens: 500,
            response_format: { type: 'json_object' },
        })

        const result = JSON.parse(completion.choices[0]?.message?.content || '{}')

        return NextResponse.json({
            success: true,
            data: result,
        })
    } catch (error: any) {
        console.error('[Product AI Description Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
            { status: 500 }
        )
    }
}
