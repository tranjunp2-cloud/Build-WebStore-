import { basename, resolve } from 'path'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { authUnavailableResponse, getCurrentUser, isAuthUnavailableError } from '@/lib/auth'
import { canReadPrivateMedia } from '@/lib/media/media-access'
import { buildS3Client } from '@/lib/media/s3-client'

/**
 * GET /api/media/private/{id} — the only way to open a private media file (payment receipts).
 * Members of the media's tenant (OTP session) and super-admins get the bytes, streamed from storage so the
 * object's public URL never reaches a browser. Anyone else gets 404 (no existence oracle) (TC-PERF-145).
 */
type PrivateMedia = {
    id: number | string
    tenant?: unknown
    private?: boolean | null
    filename?: string | null
    prefix?: string | null
    _objectKey?: string | null
    mimeType?: string | null
}

const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })

async function readStoredFile(media: PrivateMedia): Promise<Uint8Array | null> {
    const filename = basename(media.filename ?? '')
    if (!filename) return null
    const s3 = buildS3Client()
    if (s3) {
        // Same layout as the storage plugin: {prefix}/{_objectKey}/{filename}, empty parts left out.
        const key = [media.prefix, media._objectKey, filename].filter((part) => part && String(part).trim()).join('/')
        try {
            const object = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }))
            const body = object.Body as unknown as { transformToByteArray?: () => Promise<Uint8Array> } | undefined
            return body?.transformToByteArray ? await body.transformToByteArray() : null
        } catch {
            return null
        }
    }
    try {
        const fs = await import('fs/promises')
        const dir = process.env.VERCEL === '1' ? '/tmp/media' : 'public/media'
        return new Uint8Array(await fs.readFile(resolve(dir, filename)))
    } catch {
        return null
    }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: rawId } = await params
    if (!/^\d{1,15}$/.test(rawId)) return notFound()

    let user: Awaited<ReturnType<typeof getCurrentUser>>
    try {
        user = await getCurrentUser(req)
    } catch (error) {
        if (isAuthUnavailableError(error)) return authUnavailableResponse()
        throw error
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })

    const payload = await getPayload({ config })
    const media = (await payload.findByID({
        collection: 'media',
        id: Number(rawId),
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        select: { tenant: true, private: true, filename: true, prefix: true, _objectKey: true, mimeType: true },
    } as Parameters<typeof payload.findByID>[0])) as PrivateMedia | null
    if (!media || media.private !== true || !canReadPrivateMedia(user, media.tenant)) return notFound()

    const bytes = await readStoredFile(media)
    if (!bytes) return notFound()

    return new Response(bytes as BodyInit, {
        status: 200,
        headers: {
            'Content-Type': media.mimeType || 'application/octet-stream',
            'Content-Length': String(bytes.byteLength),
            'Content-Disposition': 'inline',
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        },
    })
}
