/**
 * POST /api/ai/rewrite-text
 * AI-powered text rewriting for inline editing.
 * Takes original text + instruction → returns rewritten text.
 *
 * F-03: Inline AI Edit
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
    try {
        const { text, instruction, context, language = 'vi' } = await req.json()

        if (!text || !instruction) {
            return NextResponse.json({ error: 'Text and instruction are required' }, { status: 400 })
        }

        if (!process.env.OPENAI_API_KEY) {
            // Simple rule-based fallback
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
}
