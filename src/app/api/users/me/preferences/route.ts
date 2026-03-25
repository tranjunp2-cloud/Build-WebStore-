import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function PATCH(req: NextRequest) {
    try {
        const payload = await getPayload({ config: configPromise })

        // Verify auth via Payload's built-in token
        const { user } = await payload.auth({ headers: req.headers })
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { prefer_lang } = body

        if (!prefer_lang || !['en', 'ms'].includes(prefer_lang)) {
            return NextResponse.json(
                { error: 'Invalid prefer_lang value. Must be "en" or "ms".' },
                { status: 400 }
            )
        }

        await payload.update({
            collection: 'users',
            id: user.id,
            data: { prefer_lang },
        })

        return NextResponse.json({ success: true, prefer_lang })
    } catch (err) {
        console.error('[preferences] PATCH error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    try {
        const payload = await getPayload({ config: configPromise })

        const { user } = await payload.auth({ headers: req.headers })
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const doc = await payload.findByID({
            collection: 'users',
            id: user.id,
        })

        return NextResponse.json({ prefer_lang: doc.prefer_lang ?? 'en' })
    } catch (err) {
        console.error('[preferences] GET error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
