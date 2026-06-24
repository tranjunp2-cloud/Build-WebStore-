import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

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
