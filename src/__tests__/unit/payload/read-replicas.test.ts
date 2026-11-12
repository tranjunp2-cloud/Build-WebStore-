/**
 * TC-PERF-030..032 — Payload reads on Neon read replica(s) when DATABASE_URI_READ_REPLICA is set.
 * TC-PERF-030: unset / blank / junk → no `readReplicas` (everything on the primary, the behaviour before).
 * TC-PERF-031: a comma list → trimmed postgres URLs, `sslmode` dropped (pool.ssl applies), duplicates and the primary
 *              itself dropped.
 * TC-PERF-032: wired: the real postgresAdapter gets the replicas with the same pool options as the primary (Payload
 *              copies `pool` per replica), and payload.config.ts spreads readReplicaOptions(DATABASE_URI_READ_REPLICA).
 * Real: readReplicaOptions, @payloadcms/db-postgres postgresAdapter (init only, no connection). Faked: nothing.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { describe, expect, it } from 'vitest'

import { readReplicaOptions, withoutSslmode } from '@/lib/payload/read-replicas'

const PRIMARY = 'postgresql://user:pw@ep-main-pooler.ap-southeast-1.aws.neon.tech/neondb'
const REPLICA = 'postgresql://user:pw@ep-read-pooler.ap-southeast-1.aws.neon.tech/neondb'

describe('no replica configured [TC-PERF-030]', () => {
    it.each([undefined, '', '   ', ',', 'not-a-url', 'mysql://x/y'])('%j → {} (all reads on the primary)', (raw) => {
        expect(readReplicaOptions(raw, PRIMARY)).toEqual({})
    })
})

describe('replica list [TC-PERF-031]', () => {
    it('trims, drops sslmode, duplicates and the primary', () => {
        // Arrange
        const raw = ` ${REPLICA}?sslmode=require , ${PRIMARY}?sslmode=require,${REPLICA},postgres://user:pw@ep-two-pooler.neon.tech/neondb?sslmode=require&application_name=web `

        // Act
        const options = readReplicaOptions(raw, `${PRIMARY}?sslmode=require`)

        // Assert
        expect(options).toEqual({
            readReplicas: [REPLICA, 'postgres://user:pw@ep-two-pooler.neon.tech/neondb?application_name=web'],
        })
    })
})

describe('wired into the Payload adapter [TC-PERF-032]', () => {
    it('the adapter keeps the replica list and the primary pool options it will copy to each replica pool', () => {
        // Arrange
        const pool = { connectionString: PRIMARY, max: 10, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000, ssl: { rejectUnauthorized: true } }

        // Act
        const adapter = postgresAdapter({ pool, ...readReplicaOptions(REPLICA, PRIMARY) }).init({ payload: { config: {}, logger: console } } as never) as unknown as {
            readReplicaOptions?: string[]
            poolOptions: typeof pool
            readReplicasAfterWriteInterval: number
        }
        const without = postgresAdapter({ pool, ...readReplicaOptions(undefined, PRIMARY) }).init({ payload: { config: {}, logger: console } } as never) as unknown as {
            readReplicaOptions?: string[]
        }

        // Assert
        expect(adapter.readReplicaOptions).toEqual([REPLICA])
        expect(adapter.poolOptions).toEqual(pool)
        expect(adapter.readReplicasAfterWriteInterval).toBe(2000)
        expect(without.readReplicaOptions).toBeUndefined()
    })

    it('payload.config.ts passes DATABASE_URI_READ_REPLICA to the postgres adapter', () => {
        const source = readFileSync(path.resolve(__dirname, '../../../payload.config.ts'), 'utf8')
        const adapterBlock = source.slice(source.indexOf('db: postgresAdapter('), source.indexOf('sharp,', source.indexOf('db: postgresAdapter(')))

        expect(adapterBlock).toContain('...readReplicaOptions(process.env.DATABASE_URI_READ_REPLICA, getDatabaseConnectionString())')
    })
})

describe('primary connection string sslmode clean-up [TC-PERF-040]', () => {
    it('drops sslmode anywhere in the query and keeps a valid URL with the other parameters', () => {
        expect(withoutSslmode('postgresql://u:p@h/db?sslmode=require&application_name=web')).toBe('postgresql://u:p@h/db?application_name=web')
        expect(withoutSslmode('postgresql://u:p@h/db?a=1&sslmode=require&b=2')).toBe('postgresql://u:p@h/db?a=1&b=2')
        expect(withoutSslmode('postgresql://u:p@h/db?a=1&sslmode=require')).toBe('postgresql://u:p@h/db?a=1')
        expect(withoutSslmode('postgresql://u:p@h/db?sslmode=require')).toBe('postgresql://u:p@h/db')
        expect(withoutSslmode('postgresql://u:p@h/db')).toBe('postgresql://u:p@h/db')
    })
})
