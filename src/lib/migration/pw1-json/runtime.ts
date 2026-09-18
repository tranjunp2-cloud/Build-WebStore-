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

export function localTarget(uri: string | undefined, apply: boolean, localDatabase?: string): { uri: string; identity: string } {
  if (!uri) throw new Error('DATABASE_URI_REQUIRED')
  let url: URL
  try { url = new URL(uri) } catch { throw new Error('DATABASE_URI_INVALID') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('LOCAL_DATABASE_REQUIRED')
  }
  const database = decodeURIComponent(url.pathname.slice(1))
  if (localDatabase !== undefined && (!/^[a-zA-Z0-9_]+$/.test(localDatabase) || database !== localDatabase)) throw new Error('LOCAL_DATABASE_NAME_MISMATCH')
  if (!database || (apply && localDatabase === undefined && !/^pw1_import_1886_[a-z0-9_]+$/.test(database))) {
    throw new Error('ISOLATED_CLONE_REQUIRED')
  }
  // libpq service/options can override the intended connection or readonly setting.
  for (const key of url.searchParams.keys()) {
    if (!['sslmode', 'application_name', 'connect_timeout'].includes(key)) throw new Error('DATABASE_OPTION_NOT_ALLOWED')
  }
  return { uri, identity: createHash('sha256').update(`${url.hostname}:${url.port || '5432'}/${database}/public`).digest('hex') }
}

/** Suppress only identified historical replays. Normal app config is never modified on disk. */
function guardCollection(collection: CollectionConfig): void {
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
    // Product publishGate (index 1) remains enforced; only auto inventory/actor rewriting is suppressed.
    if (isMigrationContext(args.context) && skipBeforeChange && (collection.slug !== 'products' || index === 0)) return args.data
    return hook(args)
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

export async function createRuntime(uri: string, apply = false, localDatabase?: string): Promise<Runtime> {
  const target = localTarget(uri, apply, localDatabase)
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
  const pool = new Pool({ connectionString: uri, max: 3, connectionTimeoutMillis: 10000,
    options: apply ? '-c statement_timeout=45000 -c lock_timeout=5000' : '-c default_transaction_read_only=on -c statement_timeout=45000' })
  const adapter = payload.db as unknown as Adapter
  // Match installed @payloadcms/db-postgres 3.79 connect without CREATE EXTENSION/schema push/auto database creation.
  adapter.pool = pool
  adapter.drizzle = drizzle({ client: pool, schema: adapter.schema })
  adapter.resolveInitializing()
  payload.sendEmail = async () => { throw new Error('MIGRATION_EMAIL_FORBIDDEN') }
  try { await pool.query('SELECT 1') } catch (error) { await pool.end(); throw error }
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
