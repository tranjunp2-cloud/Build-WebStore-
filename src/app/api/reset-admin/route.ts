import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'

/**
 * TEMPORARY: One-time endpoint to delete all users so admin shows "Create first user" page.
 * DELETE THIS FILE AFTER USE!
 */
export async function GET(req: Request) {
    const secret = new URL(req.url).searchParams.get('secret')
    if (secret !== 'reset-admin-2026') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const payload = await getPayload({ config })
        const users = await payload.find({ collection: 'users', limit: 100 })

        for (const user of users.docs) {
            await payload.delete({ collection: 'users', id: user.id })
        }

        return NextResponse.json({
            message: `Deleted ${users.docs.length} users. Go to /admin to create first user.`,
            deletedCount: users.docs.length,
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
