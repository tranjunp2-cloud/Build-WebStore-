/**
 * GET /api/geo/postcodes?districtId=5
 * Returns postcodes for a given district. Used by checkout cascade dropdown.
 */
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const districtId = req.nextUrl.searchParams.get('districtId')
    if (!districtId || isNaN(Number(districtId))) {
        return Response.json({ error: 'districtId required' }, { status: 400 })
    }
    try {
        const payload = await getPayload({ config })
        const result = await payload.db.drizzle.execute(sql`
            SELECT postcode
            FROM malaysia_postcodes
            WHERE district_id = ${Number(districtId)}
            ORDER BY postcode ASC
        `)
        return Response.json((result.rows as { postcode: string }[]).map(r => r.postcode))
    } catch {
        return Response.json({ error: 'Failed to load postcodes' }, { status: 500 })
    }
}
