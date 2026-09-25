// @vitest-environment node
const h = vi.hoisted(() => ({ claim: vi.fn(), operation: vi.fn(), record: vi.fn() }))
vi.mock('@/lib/migration/pw1-json/ledger', async original => ({ ...await original<object>(), findClaim: h.claim, findOperation: h.operation, recordEntity: h.record, lockStore: vi.fn(), assertFence: vi.fn() }))
vi.mock('@/lib/migration/pw1-json/creator-bindings', async original => ({ ...await original<object>(), bindCreatorReferences: vi.fn() }))
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { preflightStore, writeEntity } from '@/lib/migration/pw1-json/writer'
import type { Entity } from '@/lib/migration/pw1-json/projection'
import type { Runtime } from '@/lib/migration/pw1-json/runtime'
import type { LedgerBatch, LedgerLease } from '@/lib/migration/pw1-json/ledger'

beforeEach(() => { vi.resetAllMocks(); h.claim.mockResolvedValue(null); h.operation.mockResolvedValue(null) })
function fixture(invalid = false) {
  const data = { createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' }
  const entity: Entity = { ref: '@users:users:87', collection: 'users', sourceEntity: 'users', sourceId: '87', storeId: '31', data, refs: [], sourceChecksum: 'source', ...(invalid ? { preserveInvalidEmail: true as const } : {}) }
  const create = vi.fn(async () => ({ id: 2 }))
  const db = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) }
  const runtime = { pool: db, transaction: async (fn: (req: object, db: object) => unknown) => fn({ transactionID: 'test', context: {} }, db), payload: { collections: { users: { config: { fields: [], indexes: [] } } }, db: { sessions: { test: {} }, create }, create, findByID: vi.fn(async () => ({ id: 2, ...data })) } } as unknown as Runtime
  // Full scope intentionally has no foundation marker. Other binding fields are not used by these mocked ledger boundaries.
  const batch = { id: 'batch', startedAt: data.createdAt, binding: { sourceInstance: 'PW1PROD' } } as LedgerBatch
  return { entity, runtime, create, batch, lease: {} as LedgerLease }
}
describe('[TC-F42-IMP-FULL-CREDENTIAL] Full missing credential policy', () => {
  it.each([false, true])('preflights and creates missing-credential user, legacy email=%s', async invalid => {
    // Arrange
    const f = fixture(invalid)
    // Act
    await preflightStore(f.runtime, [f.entity], 'PW1PROD', new Map(), f.batch, undefined, undefined, undefined, true)
    await writeEntity(f.runtime, f.entity, new Map(), new Map(), f.batch, f.lease)
    // Assert
    expect(f.create).toHaveBeenCalledOnce()
    const call = vi.mocked(f.runtime.payload.create).mock.calls[0][0]
    expect(call.data).toMatchObject({ keyString: null })
    expect(h.record).toHaveBeenCalledWith(expect.anything(), f.lease, expect.objectContaining({ action: 'CREATE', evidence: expect.objectContaining({ passwordResetRequired: true }) }))
  })
  it('blocks partial credentials in both preflight and writer', async () => {
    // Arrange
    const f = fixture(), credentials = new Map([['87', { key_string: 'partial' }]])
    // Act / Assert
    await expect(preflightStore(f.runtime, [f.entity], 'PW1PROD', credentials, f.batch, undefined, undefined, undefined, true)).rejects.toThrow('VERIFIABLE_CREDENTIAL_REQUIRED')
    await expect(writeEntity(f.runtime, f.entity, new Map(), credentials, f.batch, f.lease)).rejects.toThrow('VERIFIABLE_CREDENTIAL_REQUIRED')
    expect(f.create).not.toHaveBeenCalled()
  })
  it('reuses a claimed user without generating or changing authentication', async () => {
    // Arrange
    const f = fixture()
    h.claim.mockResolvedValue({ targetCollection: 'users', storeId: '31', targetId: '2', evidence: {} })
    // Act
    await writeEntity(f.runtime, f.entity, new Map(), new Map(), f.batch, f.lease)
    // Assert
    expect(f.create).not.toHaveBeenCalled()
    expect(h.record).toHaveBeenCalledWith(expect.anything(), f.lease, expect.objectContaining({ action: 'REUSE' }))
  })
})
