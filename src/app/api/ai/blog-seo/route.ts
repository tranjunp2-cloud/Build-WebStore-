import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { describeAiTaskFailure, runAiTaskForUser } from '@/lib/ai-platform/ai-tasks'
import { AI_UNAVAILABLE_MESSAGE, isAiTasksEnabled } from '@/lib/ai-platform/config'

/** Text the model reads from the post — enough for a meta description, cheap to send. */
const CONTENT_MAX = 4_000

/**
 * POST /api/ai/blog-seo — the blog editor's ✦ on the SEO fields.
 * Body: { title?: string, content?: string (HTML or text), fallbackLanguage?: string }
 * Returns: { success: true, data: { metaTitle, metaDescription } } written in the post's own language
 * (ai-platform task `seo.blog-meta`).
 */
export const POST = withAuth(async (user, req) => {
    const rateLimit = await checkRateLimit(`ai:blog-seo:${user.id}`, 30)
    if (!rateLimit.allowed) {
        return NextResponse.json({ success: false, error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
    }
    const body = (await req.json().catch(() => ({}))) as { title?: unknown; content?: unknown; fallbackLanguage?: unknown }
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 300) : ''
    const content = typeof body.content === 'string'
        ? body.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CONTENT_MAX)
        : ''
    if (!title && !content) {
        return NextResponse.json({ success: false, error: 'Write a title or some text first.' }, { status: 400 })
    }
    if (!isAiTasksEnabled()) {
        return NextResponse.json({ success: false, error: AI_UNAVAILABLE_MESSAGE }, { status: 503 })
    }
    try {
        const { output } = await runAiTaskForUser(user, req, 'seo.blog-meta', {
            title,
            content,
            fallbackLanguage: typeof body.fallbackLanguage === 'string' ? body.fallbackLanguage.slice(0, 20) : 'en',
        })
        return NextResponse.json({ success: true, data: output })
    } catch (error) {
        const failure = describeAiTaskFailure(error)
        return NextResponse.json({ success: false, error: failure.message }, { status: failure.status })
    }
}, { csrf: true })
