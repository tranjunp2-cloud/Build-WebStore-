import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { AVATAR_MAX_BYTES, AVATAR_ALLOWED_MIME } from '@/lib/profile/schemas'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // All authenticated users (owner + staff) can upload avatar — no blockOwner() guard here

        const formData = await req.formData()
        const file = formData.get('file') as File | null
        if (!file) {
            return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
        }

        if (file.size > AVATAR_MAX_BYTES) {
            return NextResponse.json({ error: 'avatarTooLarge' }, { status: 413 })
        }
        if (!(AVATAR_ALLOWED_MIME as readonly string[]).includes(file.type)) {
            return NextResponse.json({ error: 'avatarWrongType' }, { status: 415 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const payload = await getPayload({ config: configPromise })

        const ext = file.type === 'image/png' ? 'png' : 'jpg'
        let media: Record<string, unknown>
        try {
            media = await payload.create({
                collection: 'media',
                data: { alt: 'User avatar' },
                file: {
                    data: buffer,
                    mimetype: file.type,
                    name: file.name || `avatar-${user.id}.${ext}`,
                    size: file.size,
                },
            }) as Record<string, unknown>
        } catch (err) {
            console.error('[users/me/avatar] media create failed:', err)
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }

        try {
            await payload.update({
                collection: 'users',
                id: user.id,
                data: { avatar: media.id as string },
            })
        } catch (err) {
            console.error('[users/me/avatar] user update failed, cleaning up media:', err)
            await payload.delete({ collection: 'media', id: media.id as string }).catch(() => {})
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }

        return NextResponse.json({ avatarId: media.id, url: media.url })
    } catch (err) {
        console.error('[users/me/avatar] POST error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
