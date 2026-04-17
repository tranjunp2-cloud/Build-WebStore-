import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/keep-alive
 *
 * Prevents Neon DB auto-suspend (free tier suspends after 5min idle).
 * Called every 4 minutes via Vercel Cron.
 * Lightweight query — no data returned, just keeps connection alive.
 */
export async function GET(req: Request) {
    // Verify cron secret (prevent public access)
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const payload = await getPayload({ config })
        const db = payload.db?.drizzle
        if (db) {
            const { sql } = await import('drizzle-orm')
            await db.execute(sql`SELECT 1`)
        }
        return NextResponse.json({ status: 'alive', timestamp: Date.now() })
    } catch (error) {
        return NextResponse.json({ status: 'error', message: String(error) }, { status: 500 })
    }
}
