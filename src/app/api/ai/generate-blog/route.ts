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
        const { prompt, language = 'en', tone = 'Professional' } = body

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
Your task is to write a comprehensive, high-quality, and deeply engaging blog post based on the user's topic.
The blog post should be well-structured with an introduction, multiple detailed body sections with clear subheadings (<h2>, <h3>), bullet points where appropriate, and a strong conclusion.
Target length: Around 800 to 1200 words. Make it incredibly detailed, adding real-world examples, actionable advice, and deep insights.
The tone of voice MUST be: ${tone}. Adapt your writing style, vocabulary, and structure to perfectly match this tone.
The output MUST be strictly in ${language === 'ms' ? 'Malay' : 'English'}. NO MATTER WHAT LANGUAGE THE USER PROMPT IS WRITTEN IN, YOUR ENTIRE RESPONSE (INCLUDING TITLE, CONTENT, AND SEO) MUST BE TRANSLATED AND WRITTEN EXCLUSIVELY IN ${language === 'ms' ? 'Malay (Bahasa Melayu)' : 'English'}. Do not include any text in the user's input language if it differs from the required output language.

CRITICAL CONSTRAINT: You can ONLY assist with text generation. If the user's prompt asks you to generate, create, or provide an image/picture, you MUST politely explain in the "content" field that you only generate text and suggest they upload images manually using the thumbnail upload feature.

Format the output EXACTLY as a JSON object matching this structure:
{
  "title": "A catchy, SEO-friendly title (max 90 chars)",
  "content": "The full blog post content in rich HTML format (use strictly <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>). The content MUST be comprehensive and detailed (at least 800 words). If the user asked for an image, put the refusal message here instead as a single paragraph.",
  "seoTitle": "SEO optimized title (max 60 chars)",
  "seoDescription": "SEO optimized meta description (max 155 chars)"
}
Do not include any extra text (like markdown code blocks \`\`\`json) outside the JSON object.`

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Please write a blog post about: ${prompt}\n\nIMPORTANT: Write the entire response strictly in ${language === 'ms' ? 'Malay' : 'English'}, regardless of the language used in this prompt.` },
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
    } catch (error: any) {
        console.error('API /api/ai/generate-blog error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to generate blog post: ' + (error?.message || error) },
            { status: 500 }
        )
    }
})
