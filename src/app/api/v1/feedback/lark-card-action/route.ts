import { after, NextResponse } from 'next/server'
import { handleFeedbackCardCallback } from '@/lib/feedback/feedback-card-callback'
import { MAX_CALLBACK_BODY_BYTES } from '@/lib/lark/lark-callback-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/v1/feedback/lark-card-action
 * Lark card button callback (Take it / Mark replied / Resolve / Won't fix / Reopen) and the URL verification
 * handshake. Authenticated by the app's verification token (+ encrypt key when set), not by a user session.
 */
export async function POST(request: Request) {
    const declared = Number(request.headers.get('content-length') ?? 0)
    if (declared > MAX_CALLBACK_BODY_BYTES) {
        return NextResponse.json({ error: { message: 'Body too large.' } }, { status: 413 })
    }
    const raw = await request.text()
    if (raw.length > MAX_CALLBACK_BODY_BYTES) {
        return NextResponse.json({ error: { message: 'Body too large.' } }, { status: 413 })
    }
    // The Base write runs after the 3-second answer; `after` keeps the function alive until it finishes.
    const { status, body } = await handleFeedbackCardCallback(request.headers, raw, (work) => after(() => work))
    return NextResponse.json(body, { status })
}
