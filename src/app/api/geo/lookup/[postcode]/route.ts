/**
 * GET /api/geo/lookup/[postcode]
 * Reverse lookup: postcode → { district, state, zone }
 * Used for address autofill if user types postcode directly.
 */
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ postcode: string }> }) {
    const { postcode } = await params
    if (!postcode || !/^\d{5}$/.test(postcode)) {
        return Response.json({ error: 'Invalid postcode' }, { status: 400 })
    }
    try {
        const payload = await getPayload({ config })
        const result = await payload.db.drizzle.execute(sql`
            SELECT
                d.id   AS district_id,
                d.name AS district,
                s.id   AS state_id,
                s.name AS state,
                s.zone AS zone
            FROM malaysia_postcodes p
            JOIN malaysia_districts d ON d.id = p.district_id
            JOIN malaysia_states    s ON s.id = d.state_id
            WHERE p.postcode = ${postcode}
            LIMIT 1
        `)
        if (!result.rows.length) {
            return Response.json({ error: 'Postcode not found' }, { status: 404 })
        }
        return Response.json(result.rows[0])
    } catch {
        return Response.json({ error: 'Failed to lookup postcode' }, { status: 500 })
    }
}
