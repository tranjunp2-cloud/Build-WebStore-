import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

/** Fails closed when CRON_SECRET is unset ("Bearer undefined" must not pass); constant-time compare. */
function authorized(header: string | null, secret: string | undefined): boolean {
    if (!secret || !header) return false
    const given = Buffer.from(header)
    const wanted = Buffer.from(`Bearer ${secret}`)
    return given.length === wanted.length && timingSafeEqual(given, wanted)
}

/**
 * GET /api/cron/keep-alive
 *
 * Prevents Neon DB auto-suspend (free tier suspends after 5min idle).
 * Called every 4 minutes via Vercel Cron.
 * Lightweight query — no data returned, just keeps connection alive.
 */
export async function GET(req: Request) {
    // Verify cron secret (prevent public access)
    if (!authorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
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
