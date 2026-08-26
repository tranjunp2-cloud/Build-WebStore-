import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/notifications/cleanup
 * Deletes expired notifications (expires_at < NOW()).
 * Secured with CRON_SECRET Bearer token in production.
 */
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    const CRON_SECRET = process.env.CRON_SECRET

    if (process.env.NODE_ENV === 'production' && (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`)) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const payload = await getPayload({ config })
        const db = payload.db?.drizzle

        if (!db) {
            return NextResponse.json({ success: false, error: 'Database not available' }, { status: 500 })
        }

        const result = await db.execute(
            sql`DELETE FROM notifications WHERE expires_at < NOW()`
        )

        const deleted = Number(result?.rowCount ?? 0)

        return NextResponse.json({
            success: true,
            deleted,
            message: `Cleaned up ${deleted} expired notifications`,
        })
    } catch (err) {
        console.error('[Cron] Notification cleanup failed', err)
        return NextResponse.json({ success: false, error: 'Cleanup failed' }, { status: 500 })
    }
}
