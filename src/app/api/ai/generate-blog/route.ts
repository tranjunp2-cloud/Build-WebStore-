import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import OpenAI from 'openai'

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

export const POST = withAuth(async (_user, req) => {
    try {
        const body = await req.json()
        const { prompt, language = 'en' } = body

        if (!prompt) {
            return NextResponse.json(
                { success: false, error: 'Prompt is required' },
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

        const systemPrompt = `You are an expert copywriter and SEO specialist. 
Your task is to write a high-quality, engaging, and professional blog post based on the user's prompt.
The output MUST be in ${language === 'vi' ? 'Vietnamese' : language === 'ms' ? 'Malay' : 'English'}.
Format the output EXACTLY as a JSON object matching this structure:
{
  "title": "A catchy, SEO-friendly title (max 90 chars)",
  "content": "The full blog post content. Format with HTML tags (<h2>, <p>, <ul>, <li>, <strong>) for proper structural rendering. Make it at least 3-4 paragraphs long, informative and engaging.",
  "seoTitle": "SEO optimized title (max 60 chars)",
  "seoDescription": "SEO optimized meta description (max 155 chars)"
}
Do not include any extra text outside the JSON object.`

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Please write a blog post about: ${prompt}` },
            ],
            temperature: 0.7,
            max_tokens: 3000,
            response_format: { type: 'json_object' },
        })

        const content = completion.choices[0]?.message?.content
        if (!content) {
            throw new Error('No content received from OpenAI')
        }

        const parsed = JSON.parse(content)
        return NextResponse.json({ success: true, data: parsed })
    } catch (error) {
        console.error('API /api/ai/generate-blog error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to generate blog post' },
            { status: 500 }
        )
    }
})
