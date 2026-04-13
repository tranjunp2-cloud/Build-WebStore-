import { getPayload } from 'payload'
import configPromise from './src/payload.config'
import { sql } from 'drizzle-orm'

async function main() {
    const payload = await getPayload({ config: configPromise })
    const res = await payload.db.drizzle.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'analytics'
    `)
    console.log(res.rows.map(r => r.column_name))
    process.exit(0)
}

main().catch(console.error)
