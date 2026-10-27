import { NextResponse } from 'next/server'
import { extractTenantId, withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { feedbackGuardKey, getFeedbackBlockSeconds } from '@/lib/feedback/feedback-spam-guard'
import { LarkApiError, uploadBaseImage } from '@/lib/lark/lark-base-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vercel rejects request bodies above ~4.5 MB, so the client compresses larger images first.
const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_BODY_BYTES = 4.4 * 1024 * 1024

const errorResponse = (status: number, code: string, message: string) =>
    NextResponse.json({ error: { code, message } }, { status })

/** Real type from the first bytes; the declared Content-Type is client-controlled. */
function sniffImage(b: Uint8Array): { ext: 'png' | 'jpg'; mime: string } | null {
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', mime: 'image/png' }
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
    return null
}

/**
 * POST /api/feedback/screenshots  (multipart, field `file`)
 * Uploads one screenshot into the Lark Base as attachment media and returns its file_token,
 * which the feedback submit later writes into the Attachment cell. Nothing is stored on our side.
 */
export const POST = withAuth(async (user, request) => {
    // A store blocked for spamming submits cannot keep pushing media into the Base either.
    if (await getFeedbackBlockSeconds(feedbackGuardKey(extractTenantId(user), user.id))) {
        return errorResponse(429, 'RATE_LIMITED', 'Too many submissions. Please try again later.')
    }

    const rate = await checkRateLimit(`feedback:screenshot:${user.id}`, 30, 60_000)
    if (!rate.allowed) return errorResponse(429, 'RATE_LIMITED', 'Too many uploads. Please try again shortly.')

    const appToken = process.env.LARK_BASE_APP_TOKEN
    if (!appToken) return errorResponse(503, 'UPLOAD_UNAVAILABLE', 'Screenshot upload is unavailable')

    // Reject on the declared size before the body is buffered.
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
        return errorResponse(413, 'TOO_LARGE', 'Image is too large')
    }

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return errorResponse(400, 'INVALID_BODY', 'Image file required')
    if (file.size === 0 || file.size > MAX_FILE_BYTES) return errorResponse(413, 'TOO_LARGE', 'Image is too large')

    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = sniffImage(bytes)
    if (!type) return errorResponse(415, 'UNSUPPORTED_TYPE', 'Only PNG or JPG images are supported')

    try {
        const { fileToken } = await uploadBaseImage({
            appToken,
            fileName: `screenshot-${Date.now().toString(36)}.${type.ext}`,
            mime: type.mime,
            bytes,
        })
        return NextResponse.json({ fileToken })
    } catch (err) {
        const larkCode = err instanceof LarkApiError ? err.code : null
        console.error('[feedback/screenshots] Lark upload failed', { larkCode })
        return errorResponse(502, 'UPSTREAM_ERROR', 'Could not upload the screenshot. Please try again.')
    }
})
