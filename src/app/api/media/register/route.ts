import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getCurrentUser } from '@/lib/auth'
import { checkUploadSize } from '@/lib/media/upload-limits'
import { buildS3Client } from '@/lib/media/s3-client'
import { findRegisteredMedia, registerUploadedMedia } from '@/lib/media/register-media'

// GH-1284 — second half of the direct-upload flow. After the browser POSTs the
// video straight to S3 (via /api/media/presign), it calls this to create the
// Payload media record. We HeadObject the key first so a caller can't register
// a row for a file that was never uploaded, and we trust S3's real size/mime
// over the client's claimed values.
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm'])

export const maxDuration = 60

async function deleteUnregisteredObject(
    s3: NonNullable<ReturnType<typeof buildS3Client>>,
    key: string,
): Promise<void> {
    try {
        await s3.client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }))
    } catch (err) {
        console.error('[/api/media/register] Failed to remove unregistered upload:', err)
    }
}

export async function POST(req: NextRequest) {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: { key?: unknown; alt?: unknown }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const key = typeof body.key === 'string' ? body.key : ''
    const alt = typeof body.alt === 'string' && body.alt.trim() ? body.alt.trim() : 'Uploaded video'
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })
    // The key is server-minted (buildMediaKey → `u{userId}-…`); reject anything
    // that didn't come from this user's presign so one user can't claim another's
    // object or an arbitrary key.
    if (!key.startsWith(`u${String(user.id).replace(/[^a-z0-9]+/gi, '')}-`)) {
        return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }

    const s3 = buildS3Client()
    if (!s3) return NextResponse.json({ error: 'S3 not configured' }, { status: 500 })

    // Verify the object exists and read its authoritative size/type.
    let size: number
    let mimeType: string
    try {
        const head = await s3.client.send(new HeadObjectCommand({ Bucket: s3.bucket, Key: key }))
        size = Number(head.ContentLength ?? 0)
        mimeType = head.ContentType ?? ''
    } catch {
        return NextResponse.json({ error: 'Uploaded file not found' }, { status: 400 })
    }

    if (!VIDEO_MIMES.has(mimeType)) {
        await deleteUnregisteredObject(s3, key)
        return NextResponse.json({ error: 'Only MP4 and WebM videos are supported' }, { status: 415 })
    }
    const sizeError = checkUploadSize(mimeType, size)
    if (sizeError) {
        await deleteUnregisteredObject(s3, key)
        return NextResponse.json({ error: sizeError }, { status: 413 })
    }

    let payload: Awaited<ReturnType<typeof getPayload>> | undefined
    try {
        payload = await getPayload({ config: configPromise })
        const existing = await findRegisteredMedia(payload, key)
        if (existing) return NextResponse.json(existing)

        const media = await registerUploadedMedia(payload, { alt, filename: key, mimeType, filesize: size })
        return NextResponse.json(media)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[/api/media/register] Failed to register media:', msg)

        // A retry may lose a uniqueness race after another request has already
        // registered this key. Never delete an object while its DB state is
        // unknown: doing so would leave that successful media row dangling.
        if (payload) {
            try {
                const existing = await findRegisteredMedia(payload, key)
                if (existing) return NextResponse.json(existing)
                await deleteUnregisteredObject(s3, key)
            } catch (lookupErr) {
                console.error('[/api/media/register] Failed to verify media registration state:', lookupErr)
            }
        }
        return NextResponse.json({ error: 'Could not register upload' }, { status: 500 })
    }
}
