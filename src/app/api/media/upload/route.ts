import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { checkContentLength, checkUploadSize } from '@/lib/media/upload-limits'

export async function POST(req: NextRequest) {
    const user = await getCurrentUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // GH-1284 — reject over the absolute ceiling from the declared Content-Length
    // BEFORE formData() parses and buffers the whole body into memory. This is
    // the real "reject before buffering" guard; it is best-effort since the
    // header is client-set (an understated/missing header falls through to the
    // precise per-type check below, which runs once the body is parsed).
    const lengthError = checkContentLength(Number(req.headers.get('content-length') ?? 0))
    if (lengthError) return NextResponse.json({ error: lengthError }, { status: 413 })

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Precise per-type limit now that the real parsed size is known.
    const sizeError = checkUploadSize(file.type, file.size)
    if (sizeError) return NextResponse.json({ error: sizeError }, { status: 413 })

    const altRaw = formData.get('alt')
    const alt = typeof altRaw === 'string' && altRaw.trim() ? altRaw.trim() : file.name

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const payload = await getPayload({ config: configPromise })

    try {
        const res = await payload.create({
            collection: 'media',
            data: { alt },
            file: {
                data: buffer,
                name: file.name,
                mimetype: file.type,
                size: file.size,
            },
            user: user as any,
        })
        return NextResponse.json(JSON.parse(JSON.stringify(res)))
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/invalid image|input file|unsupported/i.test(msg)) {
            return NextResponse.json(
                { error: 'Invalid image file. Please upload JPG, PNG, WebP, GIF, or AVIF.' },
                { status: 400 },
            )
        }
        console.error('[/api/media/upload] Failed to create media:', msg)
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }
}
