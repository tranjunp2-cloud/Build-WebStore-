/**
 * Write runtime for the delta: the app's Payload config with the importer's migration guards, email
 * disabled, no schema push, bound to DATABASE_URI. Boot steps mirror pw1-json/runtime.ts `createRuntime`,
 * without its local-only target guard (the delta runs against the release database).
 */
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import pino from 'pino'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { Payload, PayloadRequest } from 'payload'
import { WRITABLE } from '../pw1-json/projection'
import { migrationContext, transactionClient, type QueryClient } from '../pw1-json/runtime'
import type { CollectionName } from '../pw1-json/types'
import { guardedPayloadConfig } from './collection-configs'
import { DeltaError } from './delta-options'
import { assertDirectConnection } from './ledger-lookup'

interface Adapter {
  pool: Pool
  schema: Record<string, unknown>
  drizzle: ReturnType<typeof drizzle>
  sessions: Record<string, { db: Parameters<typeof transactionClient>[0] }>
  resolveInitializing(): void
}

export interface DeltaRuntime {
  payload: Payload
  pool: Pool
  close(): Promise<void>
  /** One database transaction shared by Payload writes (via req) and raw SQL (via client). */
  transaction<T>(operation: (req: Partial<PayloadRequest>, client: QueryClient) => Promise<T>): Promise<T>
}

export async function createDeltaRuntime(uri: string | undefined): Promise<DeltaRuntime> {
  if (!uri) throw new DeltaError('DATABASE_URI_REQUIRED')
  assertDirectConnection(uri)
  process.env.PAYLOAD_PUSH_SCHEMA = 'false'
  const config = await guardedPayloadConfig()
  config.typescript.autoGenerate = false
  config.onInit = async () => {}
  // SanitizedConfig requires Pino members; a silent Pino instance is the supported logger contract.
  config.logger = pino({ level: 'silent' }) as typeof config.logger
  config.telemetry = false
  config.email = () => ({ name: 'pw1-delta-no-email', defaultFromAddress: 'migration@invalid.local', defaultFromName: 'Migration',
    sendEmail: async () => { throw new Error('MIGRATION_EMAIL_FORBIDDEN') } })
  for (const collection of config.collections) if (WRITABLE.has(collection.slug as CollectionName)) collection.lockDocuments = false
  const { BasePayload } = await import('payload')
  const payload = await new BasePayload().init({ config, disableDBConnect: true, disableOnInit: true })
  const pool = new Pool({ connectionString: uri, max: 3, connectionTimeoutMillis: 10_000,
    options: '-c statement_timeout=60000 -c lock_timeout=10000' })
  // A dropped idle connection fails the current store (rolled back) instead of crashing without cleanup.
  pool.on('error', error => process.stderr.write(`Write connection error: ${error.message}\n`))
  const adapter = payload.db as unknown as Adapter
  // Same manual connect as the importer runtime: no CREATE EXTENSION, no schema push.
  adapter.pool = pool
  adapter.drizzle = drizzle({ client: pool, schema: adapter.schema })
  adapter.resolveInitializing()
  payload.sendEmail = async () => { throw new Error('MIGRATION_EMAIL_FORBIDDEN') }
  try { await pool.query('SELECT 1') } catch (error) { await pool.end(); throw error }
  return {
    payload, pool,
    async close() { await pool.end() },
    async transaction(operation) {
      return adapter.drizzle.transaction(async tx => {
        const transactionID = randomUUID()
        adapter.sessions[transactionID] = { db: tx as unknown as Parameters<typeof transactionClient>[0] }
        const req: Partial<PayloadRequest> = { transactionID, context: migrationContext() }
        try { return await operation(req, transactionClient(tx as unknown as Parameters<typeof transactionClient>[0])) }
        finally { delete adapter.sessions[transactionID] }
      })
    },
  }
}
