import { mkdir, open, lstat, realpath, access, rename } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { MigrationError } from './errors'
import type { ImportDiagnostic } from './types'

const textFields = new Set(['status','mode','runId','phase','storeId','collection','sourceEntity','sourceId','targetId','action','code','nextAction','operationId','manifestHash','masterHash'])
const numberFields = new Set(['exitCode','groupIndex','groupCount','groupSize','stores','entities','creates','reuses','completed','total','writes','blockerCount','count','bytes','totalBytes','verifiedBefore','verifiedThisSession'])
/** No arbitrary strings, payloads, errors or projections cross this boundary. */
export function safeLogEvent(event: Record<string, unknown>): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(event)) {
    if (key === 'field' && typeof value === 'string' && value.length <= 512 && /^[a-zA-Z_][a-zA-Z0-9_.\[\]-]*$/.test(value)) safe[key] = value
    if (key === 'reason' && typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,127}$/.test(value)) safe[key] = value
    if (key === 'samplesTruncated' && typeof value === 'boolean') safe[key] = value
    if (textFields.has(key) && (typeof value === 'string' || typeof value === 'number') && /^[a-zA-Z0-9_.:-]{1,160}$/.test(String(value))) safe[key] = String(value)
    if (numberFields.has(key) && typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) safe[key] = value
  }
  return safe
}
export class RunLogger {
  private sequence = 0
  private eventPart = 1
  private errorPart = 1
  private eventBytes = 0
  private errorBytes = 0
  private events!: FileHandle
  private errors!: FileHandle
  private failed = false
  private startedAt = new Date().toISOString()
  private summary: Record<string, unknown>
  private failedStoreIds = new Set<string>()
  private entityCounts: Record<string, number> = Object.create(null)
  private constructor(readonly directory: string, readonly sessionId: string, mode: string, private rotationBytes: number) {
    this.summary = { version: 1, sessionId, mode, startedAt: this.startedAt, outcome: 'RUNNING', verifiedThisSession: 0 }
  }
  static async create(root = join(homedir(), 'migration-data/pw1/logs'), mode = 'apply', rotationBytes = 32 * 1024 * 1024): Promise<RunLogger> {
    try {
      if (!isAbsolute(root)) throw new Error('invalid')
      // Check existing ancestry before mkdir, so symlinks/repositories are not followed.
      let current = resolve(root)
      for (;;) {
        try {
          const stat = await lstat(current)
          if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('invalid')
          try { await access(join(current, '.git')); throw new Error('repository') } catch (e) { if (!(e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT')) throw e }
        } catch (e) { if (!(e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT')) throw e }
        const parent = dirname(current); if (parent === current) break; current = parent
      }
      await mkdir(root, { recursive: true, mode: 0o700 })
      if (await realpath(root) !== resolve(root) || ((await lstat(root)).mode & 0o077)) throw new Error('invalid')
      const sessionId = randomUUID(), directory = join(root, `${new Date().toISOString().replace(/[^0-9TZ]/g, '')}-${sessionId}`)
      await mkdir(directory, { mode: 0o700 })
      const logger = new RunLogger(directory, sessionId, mode, rotationBytes)
      logger.events = await open(join(directory, 'events-0001.jsonl'), 'wx', 0o600)
      try { logger.errors = await open(join(directory, 'errors.jsonl'), 'wx', 0o600) } catch (e) { await logger.events.close(); throw e }
      try { await logger.event({ status: 'SESSION_STARTED', mode }); await logger.checkpoint() } catch (e) { await logger.close(); throw e }
      return logger
    } catch { throw new MigrationError('LOG_INIT_FAILED') }
  }
  async diagnosticBlocked(diagnostic: ImportDiagnostic & { samples: ImportDiagnostic[] }, context: Record<string, unknown> = {}): Promise<void> {
    const samples = diagnostic.samples.slice(0, 5)
    await this.event({ ...context, ...diagnostic, status: 'DIAGNOSTIC_BLOCKED', sourceEntity: diagnostic.table,
      samplesTruncated: (diagnostic.count ?? 1) > samples.length || diagnostic.samples.length > samples.length })
    for (const sample of samples) if (sample.sourceId && sample.sourceId !== diagnostic.sourceId) {
      await this.event({ ...context, ...sample, status: 'DIAGNOSTIC_SAMPLE', sourceEntity: sample.table })
    }
  }
  /** Await each event: no background queue, memory/backpressure bounded to one record. */
  async event(input: Record<string, unknown>): Promise<void> {
    if (this.failed) throw new MigrationError('LOG_WRITE_FAILED')
    try {
      const event = safeLogEvent(input)
      const line = JSON.stringify({ version: 1, sessionId: this.sessionId, sequence: ++this.sequence, timestamp: new Date().toISOString(), ...event }) + '\n'
      if (this.eventBytes + Buffer.byteLength(line) > this.rotationBytes) {
        await this.events.sync(); await this.events.close()
        this.events = await open(join(this.directory, `events-${String(++this.eventPart).padStart(4, '0')}.jsonl`), 'wx', 0o600); this.eventBytes = 0
      }
      await this.events.writeFile(line); this.eventBytes += Buffer.byteLength(line)
      if (event.code) {
        if (this.errorBytes + Buffer.byteLength(line) > this.rotationBytes) {
          await this.errors.sync(); await this.errors.close()
          this.errors = await open(join(this.directory, `errors-${String(++this.errorPart).padStart(4, '0')}.jsonl`), 'wx', 0o600); this.errorBytes = 0
        }
        await this.errors.writeFile(line); this.errorBytes += Buffer.byteLength(line)
      }
      for (const key of ['runId','groupIndex','groupCount','groupSize','storeId','verifiedBefore']) if (event[key] !== undefined) this.summary[key] = event[key]
      if (event.status === 'SELECTION_READY') this.summary.stores = event.stores
      if (event.status === 'STORE_VERIFIED') this.summary.verifiedThisSession = Number(this.summary.verifiedThisSession) + 1
      if (event.status === 'STORE_PREFLIGHT_PASSED') {
        this.summary.preflightedStores = Number(this.summary.preflightedStores ?? 0) + 1
        this.summary.plannedCreates = Number(this.summary.plannedCreates ?? 0) + Number(event.creates ?? 0)
        this.summary.plannedReuses = Number(this.summary.plannedReuses ?? 0) + Number(event.reuses ?? 0)
      }
      if (event.code && event.storeId) this.failedStoreIds.add(String(event.storeId))
      if (event.status === 'ENTITY_COMMITTED') {
        const key = `${event.collection}:${event.action}`
        this.entityCounts[key] = (this.entityCounts[key] ?? 0) + 1
      }
    } catch { this.failed = true; throw new MigrationError('LOG_WRITE_FAILED') }
  }
  async checkpoint(outcome = 'RUNNING', result: Record<string, unknown> = {}): Promise<void> {
    if (this.failed) throw new MigrationError('LOG_WRITE_FAILED')
    const temp = join(this.directory, `summary-${randomUUID()}.tmp`)
    try {
      const handle = await open(temp, 'wx', 0o600)
      try {
        const summary = { ...this.summary, ...safeLogEvent(result), outcome, updatedAt: new Date().toISOString(), entityCounts: this.entityCounts, failedStoreIds: [...this.failedStoreIds], remainingStores: Math.max(0, Number(this.summary.stores ?? 0) - (this.summary.mode === 'dry-run' ? Number(this.summary.preflightedStores ?? 0) : Number(this.summary.verifiedBefore ?? 0) + Number(this.summary.verifiedThisSession))) }
        await handle.writeFile(JSON.stringify(summary, null, 2) + '\n'); await handle.sync()
      } finally { await handle.close() }
      await this.events.sync(); await this.errors.sync()
      await rename(temp, join(this.directory, 'summary.json'))
    } catch { this.failed = true; throw new MigrationError('LOG_WRITE_FAILED') }
  }
  async close(): Promise<void> {
    const results = await Promise.allSettled([this.events?.close(), this.errors?.close()])
    if (results.some(result => result.status === 'rejected')) process.stderr.write('{"code":"LOG_CLOSE_FAILED"}\n')
  }
}
