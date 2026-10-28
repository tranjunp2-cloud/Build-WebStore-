import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { describeAiTaskFailure, runAiTaskForUser } from '@/lib/ai-platform/ai-tasks'
import { AI_UNAVAILABLE_MESSAGE, isAiTasksEnabled } from '@/lib/ai-platform/config'


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
        const rateLimit = await checkRateLimit(`ai:product-description:${user.id}`, 20)
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

        if (!isAiTasksEnabled()) {
            return NextResponse.json({ success: false, error: AI_UNAVAILABLE_MESSAGE }, { status: 503 })
        }

        try {
            const { output } = await runAiTaskForUser(user, req, 'copy.product-description', {
                name: name.trim(),
                category: typeof category === 'string' && category.trim() ? category.trim() : undefined,
                language: typeof language === 'string' ? language : 'en',
            })
            return NextResponse.json({ success: true, data: { description: output.description.trim() } })
        } catch (error) {
            const failure = describeAiTaskFailure(error)
            return NextResponse.json({ success: false, error: failure.message }, { status: failure.status })
        }
    } catch (error) {
        console.error('API /api/ai/product-description error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to generate product description' },
            { status: 500 }
        )
    }
}, { csrf: true, requireMfa: true })
