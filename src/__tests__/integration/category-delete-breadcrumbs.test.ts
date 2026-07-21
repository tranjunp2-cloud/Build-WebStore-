// @vitest-environment node
/** Real PostgreSQL regression for GH-1571. Requires DATABASE_URI or DATABASE_URL. */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const match = line.match(/^([A-Z0-9_]+)="?([^"\n]*)"?\s*$/)
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
    }
}

const connectionString = process.env.DATABASE_URI || process.env.DATABASE_URL
const runIntegration = Boolean(connectionString)

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(), tenantIdForQuery: vi.fn() }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({ getActivePlanSubscription: vi.fn(), canUse: vi.fn() }))

const { deleteCategoryAction } = await import('@/app/(dashboard)/products/categories/actions')
const { getPayload } = await import('payload')
const { getCurrentUser, tenantIdForQuery } = await import('@/lib/auth')
const { getActivePlanSubscription, canUse } = await import('@/lib/subscriptions/plan-subscription')

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
type ActiveSubscription = NonNullable<Awaited<ReturnType<typeof getActivePlanSubscription>>>
type PayloadInstance = Awaited<ReturnType<typeof getPayload>>

describe.skipIf(!runIntegration)('category delete action breadcrumbs (GH-1571)', () => {
    let pool: Pool
    const user = { id: 'integration-user', tenants: [{ tenant: 1 }] }

    beforeAll(() => {
        pool = new Pool({ connectionString, max: 1, ssl: connectionString?.includes('localhost') ? false : { rejectUnauthorized: false } })
    })
    afterAll(async () => { await pool?.end() })

    it('executes deleteCategoryAction and rebuilds a three-level subtree', async () => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            await client.query(`CREATE TEMP TABLE categories (id integer PRIMARY KEY, tenant_id integer, parent_id integer, name text, breadcrumbs text, deleted_at timestamptz, updated_at timestamptz) ON COMMIT DROP`)
            await client.query(`CREATE TEMP TABLE products_rels (categories_id integer, parent_id integer, path text) ON COMMIT DROP`)
            await client.query(`CREATE TEMP TABLE products (id integer PRIMARY KEY, deleted_at timestamptz) ON COMMIT DROP`)
            await client.query(`INSERT INTO categories (id, tenant_id, parent_id, name, breadcrumbs) VALUES (1,1,NULL,'Parent','Parent'),(2,1,1,'Child','Parent > Child'),(3,1,2,'Grandchild','Parent > Child > Grandchild')`)

            vi.mocked(getCurrentUser).mockResolvedValue(user as unknown as CurrentUser)
            vi.mocked(tenantIdForQuery).mockReturnValue(1)
            vi.mocked(getActivePlanSubscription).mockResolvedValue({ plan: 'PROFESSIONAL_TM_USER' } as unknown as ActiveSubscription)
            vi.mocked(canUse).mockResolvedValue(true)
            vi.mocked(getPayload).mockResolvedValue({
                findByID: vi.fn().mockResolvedValue({ id: 1, name: 'Parent', parent: null }),
                db: { drizzle: drizzle(client) },
            } as unknown as PayloadInstance)

            await deleteCategoryAction(1)

            const result = await client.query('SELECT id, parent_id, breadcrumbs, deleted_at FROM categories ORDER BY id')
            expect(result.rows[0].deleted_at).not.toBeNull()
            expect(result.rows[1]).toMatchObject({ id: 2, parent_id: null, breadcrumbs: 'Child' })
            expect(result.rows[2]).toMatchObject({ id: 3, parent_id: 2, breadcrumbs: 'Child > Grandchild' })
            await client.query('ROLLBACK')
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally { client.release() }
    })
})
