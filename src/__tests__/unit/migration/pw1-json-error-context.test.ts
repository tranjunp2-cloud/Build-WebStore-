// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RunLogger, safeLogEvent } from '@/lib/migration/pw1-json/run-logger'
import { preflightStore, type PreflightEntityContext } from '@/lib/migration/pw1-json/writer'
import { safeError, updatePreflightContext } from '@/lib/migration/pw1-json/runner'
import type { Runtime } from '@/lib/migration/pw1-json/runtime'
import type { Entity } from '@/lib/migration/pw1-json/projection'
import type { ImportDiagnostic } from '@/lib/migration/pw1-json/types'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
async function logger() {
  const root = await mkdtemp(join(tmpdir(), 'pw1-error-context-')); roots.push(root)
  return RunLogger.create(root)
}
function entity(id: string, collection = 'products'): Entity {
  return { ref: `@${collection}:${id}`, collection, sourceEntity: collection, sourceId: id, storeId: '205', sourceChecksum: 'fixture', refs: [],
    data: { title: 'expected', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' } }
}

describe('[TC-F42-IMP-LOGS] diagnostic identity and preflight error context', () => {
  it('keeps different fields/reasons distinguishable and marks a truncated sample list', async () => {
    // Arrange
    const log = await logger()
    const base: ImportDiagnostic = { code: 'RAW_VALUE_UNVERIFIED', severity: 'blocker', storeId: '205', table: 'products' }
    const samples = Array.from({ length: 7 }, (_, i) => ({ ...base, sourceId: String(i + 1), field: 'description', reason: 'UNSAFE_URL' }))
    // Act
    await log.diagnosticBlocked({ ...base, field: 'description', reason: 'UNSAFE_URL', count: 7, samples })
    await log.diagnosticBlocked({ ...base, sourceId: '1', field: 'description_ms', reason: 'UNSUPPORTED_STRUCTURE', count: 1,
      samples: [{ ...base, sourceId: '1', field: 'description_ms', reason: 'UNSUPPORTED_STRUCTURE' }] })
    await log.close()
    const events = (await readFile(join(log.directory, 'errors.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    // Assert
    expect(events.filter(event => event.status === 'DIAGNOSTIC_BLOCKED')).toMatchObject([
      { field: 'description', reason: 'UNSAFE_URL', count: 7, samplesTruncated: true },
      { field: 'description_ms', reason: 'UNSUPPORTED_STRUCTURE', count: 1, samplesTruncated: false },
    ])
    expect(events.filter(event => event.status === 'DIAGNOSTIC_SAMPLE').map(event => event.sourceId)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('rejects raw values and control characters in newly allowed metadata', () => {
    // Arrange / Act
    const result = safeLogEvent({ field: 'description\nSECRET_CANARY', reason: 'password=SECRET_CANARY', samplesTruncated: 'true', password: 'SECRET_CANARY' })
    // Assert
    expect(result).toEqual({})
    expect(safeLogEvent({ field: 'variants[0].sku', reason: 'UNSAFE_URL', samplesTruncated: false })).toEqual({ field: 'variants[0].sku', reason: 'UNSAFE_URL', samplesTruncated: false })
  })

  it.each(['projection', 'credential', 'unique', 'network'])('identifies the second failing entity for %s without exposing raw data', async kind => {
    // Arrange — real preflight and logger, fake read-only DB/Payload boundary.
    const log = await logger()
    const entities = [entity('1'), entity('2', kind === 'credential' ? 'users' : 'products')]
    entities[1].data.privateCanary = 'SECRET_CANARY'
    const runtime = {
      pool: { query: async (_sql: string, params: unknown[]) => {
        if (kind === 'network' && params[2] === '2') throw Object.assign(new Error('URI password=SECRET_CANARY'), { code: 'ECONNRESET' })
        return { rows: kind === 'projection' ? [{ target_id: params[2], target_collection: 'products', state: 'VERIFIED', source_store_id: '205', source_checksum: 'fixture' }] : [] }
      } },
      payload: {
        collections: { products: { config: { fields: kind === 'unique' ? [{ name: 'title', unique: true }] : [], indexes: [] } } },
        findByID: async ({ id }: { id: number }) => ({ ...entities[id - 1].data, title: id === 2 ? 'changed' : 'expected' }),
        find: async () => ({ docs: [] }),
      },
    } as unknown as Runtime
    let context: PreflightEntityContext | undefined
    const seen: (PreflightEntityContext | undefined)[] = []
    // Act
    const error = await preflightStore(runtime, entities, 'fixture', new Map(), undefined, undefined, undefined,
      value => { context = value; seen.push(value) }).then(() => { throw new Error('Expected preflight failure') }, error => error)
    const result = safeError(error)
    await log.event({ ...context, status: 'SESSION_FAILED', ...result })
    await log.checkpoint('FAILED', { ...context, ...result }); await log.close()
    const contents = await readFile(join(log.directory, 'errors.jsonl'), 'utf8')
    const event = JSON.parse(contents.trim())
    // Assert
    const codes = { projection: 'TARGET_PROJECTION_CONFLICT', credential: 'VERIFIABLE_CREDENTIAL_REQUIRED', unique: 'DUPLICATE_SOURCE_UNIQUE_KEY', network: 'OUTCOME_REQUIRES_RESUME_RECONCILIATION' }
    expect(event).toMatchObject({ sourceId: '2', storeId: '205', collection: entities[1].collection, sourceEntity: entities[1].sourceEntity, code: codes[kind as keyof typeof codes] })
    expect(JSON.parse(await readFile(join(log.directory, 'summary.json'), 'utf8'))).toMatchObject({ sourceId: '2', code: result.code })
    expect(contents + JSON.stringify(seen)).not.toContain('SECRET_CANARY')
    expect(Object.keys(context!).sort()).toEqual(['collection', 'sourceEntity', 'sourceId', 'storeId'])
  })

  it('never copies raw Entity data into runner context or subsequent group output', () => {
    // Arrange — target checks pass the full Entity, not just its narrowed type.
    const record = entity('2')
    record.data.password = 'SECRET_CANARY'
    const context: Record<string, unknown> = { groupIndex: 1, storeId: '205' }
    // Act
    updatePreflightContext(context, record)
    const errorContext = { ...context }
    updatePreflightContext(context, undefined)
    const groupOutput = JSON.stringify({ status: 'GROUP_PREFLIGHT_PASSED', ...context })
    // Assert
    expect(errorContext).toEqual({ groupIndex: 1, storeId: '205', collection: 'products', sourceEntity: 'products', sourceId: '2' })
    expect(context).toEqual({ groupIndex: 1, storeId: '205' })
    expect(groupOutput + JSON.stringify(errorContext)).not.toContain('SECRET_CANARY')
  })

  it('clears the last entity context after successful preflight', async () => {
    // Arrange
    const runtime = { pool: { query: async () => ({ rows: [] }) }, payload: { collections: { products: { config: { fields: [], indexes: [] } } } } } as unknown as Runtime
    const seen: (PreflightEntityContext | undefined)[] = []
    // Act
    await preflightStore(runtime, [entity('1')], 'fixture', new Map(), undefined, undefined, undefined, value => seen.push(value))
    // Assert
    expect(seen).toContainEqual({ storeId: '205', collection: 'products', sourceEntity: 'products', sourceId: '1' })
    expect(seen.at(-1)).toBeUndefined()
  })
})
