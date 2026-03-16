/**
 * POST /api/ai/rewrite-text
 * AI-powered text rewriting for inline editing.
 * Takes original text + instruction → returns rewritten text.
 *
 * F-03: Inline AI Edit
 */

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { rewriteTextSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { withAuth } from '@/lib/auth'

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

export const POST = withAuth(async (_user, req) => {
    try {
        const { data, errorResponse } = await parseRequest(req, rewriteTextSchema)
        if (errorResponse) return errorResponse
        
        const { text, instruction, context, language = 'en' } = data!

        const openai = getOpenAI()
        if (!openai) {
            return NextResponse.json({
                rewritten: text,
                message: 'AI rewriting requires OPENAI_API_KEY',
            })
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Faster, cheaper for small text edits
            messages: [
                {
                    role: 'system',
                    content: `You are a professional copywriter. Rewrite the given text based on the instruction.

RULES:
1. Respond ONLY with the rewritten text, no explanation
2. Keep the same language as the original (${language === 'vi' ? 'Vietnamese' : 'English'})
3. Maintain the same general meaning unless instructed otherwise
4. Keep it concise and professional
${context ? `5. Context: This text is for a ${context} section of a website` : ''}`,
                },
                {
                    role: 'user',
                    content: `Original text: "${text}"

Instruction: ${instruction}`,
                },
            ],
            temperature: 0.7,
            max_tokens: 500,
        })

        const rewritten = completion.choices[0]?.message?.content?.trim() || text

        return NextResponse.json({ rewritten })
    } catch (error: any) {
        console.error('[AI Rewrite Error]', error)
        return NextResponse.json(
            { error: error?.message || 'Rewrite failed' },
            { status: 500 },
        )
    }
})
