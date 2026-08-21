import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { checkUploadSize, UPLOAD_LIMITS } from '@/lib/media/upload-limits'
import { buildMediaKey } from '@/lib/media/media-key'
import { createMediaPresignedPost } from '@/lib/media/s3-presign'
import { s3PublicUrl } from '@/lib/media/s3-public-url'
import { SUPPORTED_IMAGE_MIMES } from '@/lib/media/image-signature'
import { isS3Configured } from '@/lib/media/s3-client'

// This endpoint hands the browser a presigned POST so media uploads go STRAIGHT
// to S3 (see /api/media/register for the follow-up DB record). Only the small
// JSON request below touches the function; the binary file never does.
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm'])

export const maxDuration = 60

export async function POST(req: NextRequest) {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isS3Configured()) {
        return NextResponse.json(
            { error: 'Direct upload unavailable', code: 'DIRECT_UPLOAD_UNAVAILABLE' },
            { status: 503 },
        )
    }

    const rate = await checkRateLimit(`media-presign:${user.id}`, 60)
    if (!rate.allowed) {
        return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
    }

    let body: { filename?: unknown; contentType?: unknown; size?: unknown }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const filename = typeof body.filename === 'string' ? body.filename.trim() : ''
    const contentType = typeof body.contentType === 'string' ? body.contentType : ''
    const size = Number(body.size)

    if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 })
    const isVideo = VIDEO_MIMES.has(contentType)
    const isImage = SUPPORTED_IMAGE_MIMES.has(contentType)
    if (!isVideo && !isImage) {
        return NextResponse.json(
            { error: 'Only JPEG, PNG, WebP, ICO, MP4, and WebM files are supported' },
            { status: 415 },
        )
    }
    if (!Number.isFinite(size) || size <= 0) {
        return NextResponse.json({ error: 'valid size required' }, { status: 400 })
    }
    // Best-effort early reject; the presigned policy's content-length-range is
    // the authoritative cap (client can't bypass it).
    const sizeError = checkUploadSize(contentType, size)
    if (sizeError) return NextResponse.json({ error: sizeError }, { status: 413 })

    try {
        const key = buildMediaKey({ userId: user.id, filename, mime: contentType })
        const post = await createMediaPresignedPost({
            key,
            contentType,
            maxFileBytes: isImage ? UPLOAD_LIMITS.image : UPLOAD_LIMITS.video,
        })
        return NextResponse.json({
            url: post.url,
            fields: post.fields,
            key,
            publicUrl: s3PublicUrl(key),
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[/api/media/presign] Failed to presign:', msg)
        if (msg === 'S3 not configured') {
            return NextResponse.json(
                { error: 'Direct upload unavailable', code: 'DIRECT_UPLOAD_UNAVAILABLE' },
                { status: 503 },
            )
        }
        return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 })
    }
}
