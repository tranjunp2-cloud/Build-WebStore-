import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { describeAiTaskFailure, runAiTaskForUser } from '@/lib/ai-platform/ai-tasks'
import { AI_UNAVAILABLE_MESSAGE, isAiTasksEnabled } from '@/lib/ai-platform/config'


export const POST = withAuth(async (user, req) => {
    try {
        const rateLimit = await checkRateLimit(`ai:generate-blog:${user.id}`, 20)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: 'Rate limit exceeded. Try again later.' },
                { status: 429 }
            )
        }

        const body = await req.json()
        const { prompt, language = 'en', tone = 'Professional' } = body

        if (!prompt) {
            return NextResponse.json(
                { success: false, error: 'Prompt is required' },
                { status: 400 }
            )
        }

        if (!isAiTasksEnabled()) {
            return NextResponse.json({ success: false, error: AI_UNAVAILABLE_MESSAGE }, { status: 503 })
        }

        try {
            const { output } = await runAiTaskForUser(user, req, 'copy.blog-post', {
                prompt: String(prompt),
                language: typeof language === 'string' ? language : 'en',
                tone: typeof tone === 'string' && tone.trim() ? tone.trim() : 'Professional',
            })
            return NextResponse.json({ success: true, data: output })
        } catch (error) {
            const failure = describeAiTaskFailure(error)
            return NextResponse.json({ success: false, error: failure.message }, { status: failure.status })
        }
    } catch (error: any) {
        console.error('API /api/ai/generate-blog error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to generate blog post' },
            { status: 500 }
        )
    }
}, { csrf: true, requireMfa: true })
