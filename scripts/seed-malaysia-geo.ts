/**
 * One-time seed: populate malaysia_states, malaysia_districts, malaysia_postcodes
 * from scripts/data/malaysia-geo.json (generated from ECH Excel reference file).
 *
 * Run: npx ts-node --project tsconfig.node.json scripts/seed-malaysia-geo.ts
 * Safe to re-run: ON CONFLICT DO NOTHING skips existing rows.
 */
import * as fs from 'fs'
import * as path from 'path'
import { Pool } from 'pg'

const DATA_FILE = path.join(__dirname, 'data', 'malaysia-geo.json')

interface GeoState {
    id: number
    excel_name: string
    name: string
    state_code: string
    zone: string
}

interface GeoDistrict {
    id: number
    state_id: number
    name: string
    postcodes: string[]
}

interface GeoData {
    states: GeoState[]
    districts: GeoDistrict[]
}

async function seed() {
    const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL
    if (!connStr) throw new Error('DATABASE_URI not set')

    const pool = new Pool({
        connectionString: connStr,
        ssl: connStr.includes('localhost') ? false : { rejectUnauthorized: false },
    })

    const data: GeoData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
    console.log(`[seed-geo] ${data.states.length} states, ${data.districts.length} districts`)

    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        // States
        for (const s of data.states) {
            await client.query(
                `INSERT INTO malaysia_states (id, name, state_code, zone)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (id) DO NOTHING`,
                [s.id, s.name, s.state_code, s.zone]
            )
        }
        console.log(`[seed-geo] ✅ states inserted`)

        // Districts
        for (const d of data.districts) {
            await client.query(
                `INSERT INTO malaysia_districts (id, state_id, name)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (id) DO NOTHING`,
                [d.id, d.state_id, d.name]
            )
        }
        console.log(`[seed-geo] ✅ districts inserted`)

        // Postcodes — flat from district.postcodes arrays
        let pcCount = 0
        for (const d of data.districts) {
            for (const pc of d.postcodes) {
                await client.query(
                    `INSERT INTO malaysia_postcodes (postcode, district_id)
                     VALUES ($1, $2)
                     ON CONFLICT (postcode) DO NOTHING`,
                    [pc, d.id]
                )
                pcCount++
            }
        }
        console.log(`[seed-geo] ✅ ${pcCount} postcodes inserted`)

        await client.query('COMMIT')
        console.log('[seed-geo] Done.')
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
        await pool.end()
    }
}

seed().catch(e => { console.error(e); process.exit(1) })
