// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
const h = vi.hoisted(() => ({ load: vi.fn(), verify: vi.fn(), write: vi.fn(), register: vi.fn(), mark: vi.fn(), create: vi.fn() }))
vi.mock('@/lib/migration/pw1-json/artifact', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/migration/pw1-json/artifact')>(), loadImportArtifact: h.load, readImportStore: vi.fn(async () => ({ storeId: '636', collections: { tenants: [], users: [], sites: [] } })), readStoreTargetChecks: vi.fn(async () => []) }))
vi.mock('@/lib/migration/pw1-json/credentials', () => ({ loadCredentialSidecar: vi.fn(async () => new Map()) }))
vi.mock('@/lib/migration/pw1-json/runtime', () => ({ createRuntime: vi.fn(async () => ({ identity: 'target', pool: {}, transaction: async (callback: (req: object, db: object) => unknown) => callback({}, {}), close: vi.fn() })) }))
vi.mock('@/lib/migration/pw1-json/target-schema', () => ({ assertTargetSchema: vi.fn() }))
vi.mock('@/lib/migration/pw1-json/creator-bindings', () => ({ resolveCreatorContext: vi.fn(async () => ({ targets: new Map() })) }))
vi.mock('@/lib/migration/pw1-json/runner', () => ({ writerHash: vi.fn(async () => 'writer'), schemaHash: vi.fn(async () => 'schema'), safeError: (error: Error) => ({ code: error.message }) }))
vi.mock('@/lib/migration/pw1-json/lease-heartbeat', () => ({ leaseHeartbeat: () => ({ check: vi.fn(), stop: vi.fn() }) }))
vi.mock('@/lib/migration/pw1-json/ledger', () => ({ assertWritableProfile: vi.fn(), createBatch: h.create, registerPreflightedStores: h.register, markStoreVerified: h.mark, acquireLease: vi.fn(async () => ({})), releaseLease: vi.fn(), renewLease: vi.fn() }))
vi.mock('@/lib/migration/pw1-json/projection', () => ({ checksum: () => 'hash', creatorDiagnosticResolved: () => true, buildEntities: () => [{ collection: 'tenants', ref: 'tenant', refs: [], data: {} }, { collection: 'sites', ref: 'site', refs: [], data: {} }] }))
vi.mock('@/lib/migration/pw1-json/writer', () => ({ configurations: vi.fn(), preflightStore: vi.fn(async () => ({ targets: new Map(), claims: new Map() })), writeEntity: h.write, finalizeEntity: vi.fn(), verifyStore: h.verify }))
import { runUserImport } from '@/lib/migration/pw1-json/user-runner'

let directory: string
beforeEach(async () => {
  vi.clearAllMocks()
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  directory = await mkdtemp(join(tmpdir(), 'pw1-user-flow-'))
  const bytes = JSON.stringify([{ tenants: [{ _ref: '@tenants:stores:636' }], sites: [], users: [], pages: [{ original: true }], products: [] }])
  await writeFile(join(directory, 'master.json'), bytes)
  h.load.mockResolvedValue({ directory, manifest: { sourceInstance: 'PW1', masterHash: createHash('sha256').update(bytes).digest('hex') }, storeIds: ['636'], blockers: [] })
  h.create.mockResolvedValue({ id: 'json:batch' })
  h.verify.mockResolvedValue(undefined)
  h.write.mockImplementation(async (_runtime, entity) => entity.collection === 'tenants' ? 425 : 424)
})
afterEach(async () => { vi.restoreAllMocks(); await rm(directory, { recursive: true, force: true }) })

describe('[TC-F42-IMP-USERS] Destination publication gates', () => {
  it('registers and verifies foundation before publishing master even without user rows', async () => {
    // Arrange / Act
    await runUserImport({ manifest: join(directory, 'import-manifest.json'), store: '636' })
    // Assert
    expect(h.register).toHaveBeenCalledOnce()
    expect(h.register.mock.invocationCallOrder[0]).toBeLessThan(h.write.mock.invocationCallOrder[0])
    expect(h.verify.mock.invocationCallOrder[0]).toBeLessThan(h.mark.mock.invocationCallOrder[0])
    expect(h.create.mock.calls[0][1]).toMatchObject({ executionScope: 'foundation', groupSize: 1 })
    expect(JSON.parse(await readFile(join(directory, 'master-with-destination.json'), 'utf8'))[0]).toMatchObject({ pages: [{ original: true }], destination: { tenantId: 425, siteId: 424, productCategories: [] } })
  })
  it('dry-run does not create batch, business rows or output files', async () => {
    // Arrange / Act
    await runUserImport({ manifest: join(directory, 'import-manifest.json'), store: '636', dryRun: true })
    // Assert
    expect(h.create).not.toHaveBeenCalled(); expect(h.write).not.toHaveBeenCalled()
    await expect(readFile(join(directory, 'master-with-destination.json'))).rejects.toThrow()
    await expect(readFile(join(directory, 'migrated-users.json'))).rejects.toThrow()
  })
  it('verification failure propagates and does not publish destination', async () => {
    // Arrange
    h.verify.mockRejectedValueOnce(new Error('VERIFY_FAILED'))
    // Act / Assert
    await expect(runUserImport({ manifest: join(directory, 'import-manifest.json'), store: '636' })).rejects.toThrow('VERIFY_FAILED')
    expect(h.mark).not.toHaveBeenCalled()
    await expect(readFile(join(directory, 'master-with-destination.json'))).rejects.toThrow()
  })
})
