/**
 * GET /api/geo/states
 * Returns all 16 Malaysian states with zone info (west/east).
 * Used by checkout cascade dropdown. Publicly accessible, data is static reference.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const revalidate = 86400 // CDN cache 24h — geo data is static

export async function GET() {
    try {
        const payload = await getPayload({ config })
        const result = await payload.db.drizzle.execute(sql`
            SELECT id, name, state_code, zone
            FROM malaysia_states
            ORDER BY name ASC
        `)
        return Response.json(result.rows)
    } catch {
        return Response.json({ error: 'Failed to load states' }, { status: 500 })
    }
}
