import { randomUUID, createHash } from 'node:crypto'
import { Pool } from 'pg'
import pino from 'pino'
import { WRITABLE } from './projection'
import type { CollectionName } from './types'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql, type SQL } from 'drizzle-orm'
import type { CollectionConfig, Field, Payload, PayloadRequest, RequestContext } from 'payload'

const capability = Symbol('pw1-json-local-import')
type Context = RequestContext & { [capability]: true }
// Payload createLocalReq treats an object with no string keys as empty and replaces it.
// Keep a non-authorizing string marker so the private Symbol survives nested Local API reads.
export function migrationContext(): Context { return { migrationProfile: 'pw1-json-v1', [capability]: true } }
export function isMigrationContext(context: RequestContext | undefined): boolean {
  return (context as Partial<Context> | undefined)?.[capability] === true
}

export interface QueryClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>
}
interface Transaction { execute(query: SQL): Promise<unknown> }
interface Adapter {
  pool: Pool
  schema: Record<string, unknown>
  drizzle: ReturnType<typeof drizzle>
  sessions: Record<string, { db: Transaction }>
  resolveInitializing(): void
  tableNameMap: Map<string, string>
}

/** Parameter values are bound by Drizzle, never interpolated into SQL text. */
export function transactionClient(transaction: Transaction): QueryClient {
  return { async query(text, values = []) {
    const chunks: SQL[] = []
    let end = 0
    for (const match of text.matchAll(/\$(\d+)/g)) {
      chunks.push(sql.raw(text.slice(end, match.index)))
      const index = Number(match[1]) - 1
      if (index < 0 || index >= values.length) throw new Error('SQL_PARAMETER_MISSING')
      chunks.push(sql`${sql.param(values[index])}`)
      end = match.index! + match[0].length
    }
    chunks.push(sql.raw(text.slice(end)))
    const result = await transaction.execute(sql.join(chunks, sql.raw('')))
    const response = result as { rows?: Record<string, unknown>[]; rowCount?: number }
    return { rows: response.rows ?? [], rowCount: response.rowCount ?? response.rows?.length ?? 0 }
  } }
}

export interface MigrationTarget {
  uri: string
  identity: string
  database: string
  ssl?: { rejectUnauthorized: true }
  enableChannelBinding?: true
}

/** Local targets remain the default. Neon is writable only when its exact host is declared by the operator. */
export function localTarget(uri: string | undefined, apply: boolean, localDatabase?: string, expectedNeonHost?: string, stagingQcTargetId?: string): MigrationTarget {
  if (!uri) throw new Error('DATABASE_URI_REQUIRED')
  let url: URL
  try { url = new URL(uri) } catch { throw new Error('DATABASE_URI_INVALID') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_PROTOCOL_INVALID')
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  const isNeon = !isLocal && Boolean(expectedNeonHost) && url.hostname.toLowerCase() === expectedNeonHost!.toLowerCase() && url.hostname.toLowerCase().endsWith('.neon.tech')
  if (expectedNeonHost && !isNeon) throw new Error('NEON_TARGET_HOST_MISMATCH')
  if (!isLocal && !isNeon) throw new Error('LOCAL_DATABASE_REQUIRED')
  if (isLocal && stagingQcTargetId) throw new Error('STAGING_QC_REMOTE_DATABASE_REQUIRED')
  const database = decodeURIComponent(url.pathname.slice(1))
  if (stagingQcTargetId && !/^[a-zA-Z0-9_-]{8,128}$/.test(stagingQcTargetId)) throw new Error('STAGING_QC_TARGET_CONFIG_INVALID')
  if (localDatabase !== undefined && (!/^[a-zA-Z0-9_]+$/.test(localDatabase) || database !== localDatabase)) throw new Error('LOCAL_DATABASE_NAME_MISMATCH')
  if (!database || (isNeon && localDatabase === undefined) || (apply && isLocal && localDatabase === undefined && !/^pw1_import_1886_[a-z0-9_]+$/.test(database))) {
    throw new Error('ISOLATED_CLONE_REQUIRED')
  }
  const sslmode = url.searchParams.get('sslmode')?.toLowerCase()
  if (isNeon && sslmode !== undefined && !['require', 'verify-full'].includes(sslmode)) throw new Error('NEON_SSL_REQUIRED')
  // libpq service/options can override the intended connection or readonly setting.
  for (const key of url.searchParams.keys()) {
    if (!['sslmode', 'application_name', 'connect_timeout', 'channel_binding'].includes(key)) throw new Error('DATABASE_OPTION_NOT_ALLOWED')
  }
  if (url.searchParams.has('channel_binding') && url.searchParams.get('channel_binding') !== 'require') throw new Error('DATABASE_OPTION_NOT_ALLOWED')
  if (url.searchParams.has('connect_timeout') && !/^[1-9]\d{0,2}$/.test(url.searchParams.get('connect_timeout')!)) throw new Error('DATABASE_OPTION_NOT_ALLOWED')
  // node-postgres does not map channel_binding=require to enableChannelBinding,
  // and URL sslmode can override explicit TLS options. Set both on the pool.
  const enableChannelBinding = isNeon && url.searchParams.get('channel_binding') === 'require'
  if (isNeon) { url.searchParams.delete('sslmode'); url.searchParams.delete('channel_binding') }
  return { uri: isNeon ? url.toString() : uri, database, ...(isNeon ? { ssl: { rejectUnauthorized: true as const } } : {}), ...(enableChannelBinding ? { enableChannelBinding: true as const } : {}), identity: createHash('sha256').update(`${url.hostname}:${url.port || '5432'}/${database}/public`).digest('hex') }
}

export async function assertStagingQcAuthorization(pool: Pool, targetId: string, targetHash: string, database: string, storeIds?: string[]): Promise<void> {
  const result = await pool.query<{ allowed_store_ids: unknown }>(`SELECT a.allowed_store_ids
    FROM migration_qc_import_authorizations a
    JOIN migration_target_guard g ON g.singleton=true AND g.target_instance_id=a.target_instance_id
    WHERE a.target_instance_id=$1 AND a.target_hash=$2 AND a.database_name=$3
      AND a.expires_at>clock_timestamp()`, [targetId,targetHash,database])
  const allowed = result.rows[0]?.allowed_store_ids
  if (!Array.isArray(allowed) || !allowed.every(id => typeof id === 'string' && /^[1-9]\d*$/.test(id)) ||
    (storeIds && storeIds.some(id => !allowed.includes(id)))) throw new Error('STAGING_QC_IMPORT_NOT_AUTHORIZED')
}

/** Suppress only identified historical replays. Normal app config is never modified on disk. */
export function guardCollection(collection: CollectionConfig): void {
  // Scope the projection's maxRows exception to this isolated importer runtime.
  // Normal app configuration retains maxRows=5 and the historical-edit validator.
  if (collection.slug === 'products') {
    for (const field of collection.fields) if (field.type === 'array' && field.name === 'images') delete field.maxRows
  }
  const hooks = collection.hooks
  if (hooks?.afterChange) hooks.afterChange = hooks.afterChange.map(hook => async args => {
    if (isMigrationContext(args.context)) return args.doc
    return hook(args)
  })
  const skipBeforeChange = collection.slug === 'orders' || collection.slug === 'products'
  if (hooks?.beforeChange) hooks.beforeChange = hooks.beforeChange.map((hook, index) => async args => {
    // Historical products preserve their mapped status and weight. All other publish
    // requirements remain enforced, as do normal application requests.
    const historical = isMigrationContext(args.context)
    if (historical && skipBeforeChange && (collection.slug !== 'products' || index === 0)) return args.data
    try { return await hook(args) } catch (error) {
      if (historical && collection.slug === 'products' && index === 1 && error instanceof Error) {
        let details: unknown
        try { details = JSON.parse(error.message) } catch { /* Not a structured publish error. */ }
        if (details && typeof details === 'object' && 'code' in details && details.code === 'PUBLISH_BLOCKED' &&
          'missingFields' in details && Array.isArray(details.missingFields) && details.missingFields.length === 1 && details.missingFields[0] === 'weight') return args.data
      }
      throw error
    }
  })
  if (hooks?.beforeValidate && ['discounts', 'sites'].includes(collection.slug)) {
    hooks.beforeValidate = hooks.beforeValidate.map(hook => async args => {
      if (isMigrationContext(args.context)) return args.data
      return hook(args)
    })
  }
  const walk = (fields: Field[]): void => {
    for (const field of fields) {
      if ('fields' in field) walk(field.fields)
      if ('tabs' in field) for (const tab of field.tabs) walk(tab.fields)
      if (!('name' in field) || !('hooks' in field) || !field.hooks) continue
      const skip = collection.slug === 'tenants' || (collection.slug === 'products' && field.name === 'slug')
      if (!skip) continue
      for (const stage of ['beforeValidate', 'beforeChange'] as const) {
        const callbacks = field.hooks[stage]
        if (callbacks) field.hooks[stage] = callbacks.map(hook => async args => {
          if (isMigrationContext(args.context)) return args.value
          return hook(args)
        })
      }
    }
  }
  walk(collection.fields)
}

export interface Runtime {
  payload: Payload
  pool: Pool
  identity: string
  close(): Promise<void>
  transaction<T>(operation: (req: Partial<PayloadRequest>, client: QueryClient) => Promise<T>): Promise<T>
}

export async function createRuntime(uri: string, apply = false, localDatabase?: string, expectedNeonHost?: string, stagingQcTargetId?: string): Promise<Runtime> {
  const target = localTarget(uri, apply, localDatabase, expectedNeonHost, stagingQcTargetId)
  process.env.PAYLOAD_PUSH_SCHEMA = 'false'
  process.env.DATABASE_URI = uri
  const { default: configPromise } = await import('../../../payload.config')
  const config = await configPromise
  config.typescript.autoGenerate = false
  config.onInit = async () => {}
  // SanitizedConfig recursively requires optional Pino members; an actual Pino instance is the supported logger contract.
  config.logger = pino({ level: 'silent' }) as typeof config.logger
  config.telemetry = false
  config.email = () => ({ name: 'migration-no-email', defaultFromAddress: 'migration@invalid.local', defaultFromName: 'Migration', sendEmail: async () => { throw new Error('MIGRATION_EMAIL_FORBIDDEN') } })
  for (const collection of config.collections) {
    // This isolated CLI has no editor. Avoid Payload's implicit stale-editor-lock deletion during deferred updates.
    if (WRITABLE.has(collection.slug as CollectionName)) collection.lockDocuments = false
    guardCollection(collection)
  }
  const { BasePayload: PayloadClass } = await import('payload')
  const payload = await new PayloadClass().init({ config, disableDBConnect: true, disableOnInit: true })
  const pool = new Pool({ connectionString: target.uri, ...(target.ssl ? { ssl: target.ssl } : {}), ...(target.enableChannelBinding ? { enableChannelBinding: true } : {}), max: 3, connectionTimeoutMillis: 10000,
    options: apply ? '-c statement_timeout=45000 -c lock_timeout=5000' : '-c default_transaction_read_only=on -c statement_timeout=45000' })
  const adapter = payload.db as unknown as Adapter
  // Match installed @payloadcms/db-postgres 3.79 connect without CREATE EXTENSION/schema push/auto database creation.
  adapter.pool = pool
  adapter.drizzle = drizzle({ client: pool, schema: adapter.schema })
  adapter.resolveInitializing()
  payload.sendEmail = async () => { throw new Error('MIGRATION_EMAIL_FORBIDDEN') }
  try {
    await pool.query('SELECT 1')
    if (stagingQcTargetId) await assertStagingQcAuthorization(pool, stagingQcTargetId, target.identity, target.database)
  } catch (error) { await pool.end(); throw error }
  return {
    payload, pool, identity: target.identity,
    async close() { await pool.end() },
    async transaction(operation) {
      if (!apply) throw new Error('READ_ONLY_RUNTIME')
      return adapter.drizzle.transaction(async tx => {
        const transactionID = randomUUID()
        adapter.sessions[transactionID] = { db: tx }
        const req: Partial<PayloadRequest> = { transactionID, context: migrationContext() }
        try { return await operation(req, transactionClient(tx)) }
        finally { delete adapter.sessions[transactionID] }
      })
    },
  }
}
