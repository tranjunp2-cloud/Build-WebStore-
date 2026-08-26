/**
 * GET /api/geo/districts?stateId=1
 * Returns districts for a given state. Used by checkout cascade dropdown.
 */
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const stateId = req.nextUrl.searchParams.get('stateId')
    if (!stateId || isNaN(Number(stateId))) {
        return Response.json({ error: 'stateId required' }, { status: 400 })
    }
    try {
        const payload = await getPayload({ config })
        const result = await payload.db.drizzle.execute(sql`
            SELECT id, name
            FROM malaysia_districts
            WHERE state_id = ${Number(stateId)}
            ORDER BY name ASC
        `)
        return Response.json(result.rows)
    } catch {
        return Response.json({ error: 'Failed to load districts' }, { status: 500 })
    }
}
