// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { findClaims, pendingReferenceKeys } from '@/lib/migration/pw1-json/ledger'
import { preflightStore } from '@/lib/migration/pw1-json/writer'
import type { Runtime } from '@/lib/migration/pw1-json/runtime'
import type { Entity } from '@/lib/migration/pw1-json/projection'

function product(id: string): Entity {
  return { ref: `@products:products:${id}`, collection: 'products', sourceEntity: 'products', sourceId: id, storeId: '205',
    sourceChecksum: `checksum-${id}`, refs: [], data: { title: `title-${id}`, createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' } }
}

describe('[TC-F42-IMP-010] Batched preflight claim reads', () => {
  it('selects only durable pending references and fails closed for unknown legacy state', async () => {
    const query = vi.fn(async () => ({ rows: [
      { source_entity: 'products', source_id: '1', id: 1, action: 'CREATE', claim_active: true, pending_references: 'true' },
      { source_entity: 'products', source_id: '2', id: 2, action: 'CREATE', claim_active: true, pending_references: 'false' },
    ] as Record<string, unknown>[], rowCount: 2 }))
    const entities = [{ sourceEntity: 'products', sourceId: '1' }, { sourceEntity: 'products', sourceId: '2' }]
    const pending = await pendingReferenceKeys({ query }, 'json:12345678-1234-4234-8234-123456789abc', '205', entities)
    expect(pending).toEqual(new Set(['products\0' + '1']))
    expect(query).toHaveBeenCalledOnce()

    query.mockResolvedValueOnce({ rows: [
      { source_entity: 'products', source_id: '1', id: 1, action: 'CREATE', claim_active: true, pending_references: null },
    ] as Record<string, unknown>[], rowCount: 1 })
    await expect(pendingReferenceKeys({ query }, 'json:12345678-1234-4234-8234-123456789abc', '205', [entities[0]]))
      .rejects.toThrow('FINALIZE_PENDING_STATE_UNKNOWN')
  })

  it('fails closed when an entity has no durable operation evidence', async () => {
    const query = vi.fn(async () => ({ rows: [
      { source_entity: 'products', source_id: '1', id: null, action: null, claim_active: null, pending_references: null },
    ], rowCount: 1 }))
    await expect(pendingReferenceKeys({ query }, 'json:12345678-1234-4234-8234-123456789abc', '205', [{ sourceEntity: 'products', sourceId: '1' }]))
      .rejects.toThrow('OPERATION_EVIDENCE_MISSING')
  })

  it('loads distinct source identities in one bounded query without merging equal IDs from different entities', async () => {
    // Arrange
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [
      { id: 1, source_entity: 'blog_posts', source_id: '185', source_store_id: '3', target_id: 10, target_collection: 'blogs', state: 'VERIFIED', importer_profile: 'pw1-json-v3', source_checksum: 'a', target_checksum: 'b' },
      { id: 2, source_entity: 'blog_post_thumbnail', source_id: '185', source_store_id: '3', target_id: 11, target_collection: 'media', state: 'VERIFIED', importer_profile: 'pw1-json-v3', source_checksum: 'c', target_checksum: 'd' },
    ], rowCount: 2 }))
    const keys = [{ sourceEntity: 'blog_posts', sourceId: '185' }, { sourceEntity: 'blog_post_thumbnail', sourceId: '185' }]
    // Act
    const claims = await findClaims({ query }, 'PW1PROD', keys)
    // Assert
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0][1]).toEqual(['PW1PROD', ['blog_posts', 'blog_post_thumbnail'], ['185', '185']])
    expect(claims.get('blog_posts\0' + '185')?.targetId).toBe('10')
    expect(claims.get('blog_post_thumbnail\0' + '185')?.targetId).toBe('11')
  })

  it('keeps query batches at 128 identities', async () => {
    // Arrange
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [], rowCount: 0 }))
    const keys = Array.from({ length: 129 }, (_, index) => ({ sourceEntity: 'products', sourceId: String(index + 1) }))
    // Act
    await findClaims({ query }, 'PW1PROD', keys)
    // Assert
    expect(query.mock.calls.map(call => (call[1]?.[1] as string[]).length)).toEqual([128, 1])
  })

  it('rejects unresolved active claims instead of treating them as new entities', async () => {
    // Arrange
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [{ source_entity: 'products', source_id: '1', state: 'APPLYING' }], rowCount: 1 }))
    // Act / Assert
    await expect(findClaims({ query }, 'PW1PROD', [{ sourceEntity: 'products', sourceId: '1' }])).rejects.toThrow('SOURCE_CLAIM_UNRESOLVED')
  })

  it('uses one negative unique lookup for multiple source keys', async () => {
    // Arrange
    const find = vi.fn(async () => ({ docs: [] }))
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }))
    const runtime = { pool: { query }, payload: { find, collections: { products: { config: { fields: [{ name: 'title', unique: true }], indexes: [] } } } } } as unknown as Runtime
    // Act
    const proposal = await preflightStore(runtime, [product('1'), product('2'), product('3')], 'PW1PROD', new Map())
    // Assert
    expect(query).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledTimes(1)
    expect(proposal.preflightLookups).toBe(2)
  })

  it('falls back to exact owner checks when a batch unique lookup finds a target', async () => {
    // Arrange
    const find = vi.fn(async ({ where }: { where: Record<string, unknown> }) => ({ docs: 'or' in where ? [{ id: 99 }] : [] }))
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }))
    const runtime = { pool: { query }, payload: { find, collections: { products: { config: { fields: [{ name: 'title', unique: true }], indexes: [] } } } } } as unknown as Runtime
    // Act
    await preflightStore(runtime, [product('1'), product('2')], 'PW1PROD', new Map())
    // Assert
    expect(find).toHaveBeenCalledTimes(3)
  })

  it('bounds a 100-entity empty-target preflight to five target lookups', async () => {
    // Arrange
    const find = vi.fn(async () => ({ docs: [] }))
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }))
    const runtime = { pool: { query }, payload: { find, collections: { products: { config: { fields: [{ name: 'title', unique: true }], indexes: [] } } } } } as unknown as Runtime
    // Act
    const proposal = await preflightStore(runtime, Array.from({ length: 100 }, (_, i) => product(String(i + 1))), 'PW1PROD', new Map())
    // Assert
    expect(query).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledTimes(4)
    expect(proposal.preflightLookups).toBe(5)
  })
})
