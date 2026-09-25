// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { emptyStore, type Row } from '@/lib/migration/pw1-export/contracts'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { collectUserActors, globalCreatorChain, validateUserActors } from '@/lib/migration/pw1-export/user-actors'
import { operationalIssues } from '@/lib/migration/pw1-export/validate-master'

function setup(patch: Partial<Row> = {}) {
  const config = sourceConfigSchema.parse({ version: 1, sourceInstance: 'fixture', sourceDatabase: 'fixture', sourceInstanceToken: 'fixture', snapshotId: 'one', asOf: '2026-01-01T00:00:00Z', utcOffset: '+00:00', sourcePlatformSuffix: 'old.test', targetPlatformSuffix: 'new.test', tables: { stores: 'stores.csv' }, deletedStores: 'review', migrationPolicy: { decisionEvidence: 'User approved preserving Users creator.', preserveUserCreators: true, siteTypeDefault: 'ecommerce', shippingPolicy: 'review' } })
  const base = { name: 'System', email: 'system@example.test', status: '1', is_frontend: '0', created_at: '2025-01-01 00:00:00', updated_at: '2025-01-01 00:00:00' }
  const ctx = new SourceIndex({ users: [{ ...base, id: '1', created_by: '0' }, { ...base, id: '51', email: 'system51@example.test', created_by: '1', ...patch }], model_has_roles: [], roles: [] }).context(config, '10', emptyStore(), [], [])
  const store = emptyStore()
  store.tenants.push({ _ref: '@tenants:stores:10', metaData: { pw1StoreId: '10' } })
  store.sites.push({ _ref: '@sites:stores:10' })
  store.users.push({ _ref: '@users:users:10', createdBy: '@users:users:51' })
  return { ctx, store }
}

describe('[TC-F42-068] Creator dependency identity and isolation', () => {
  it('preserves one copy of source creator chain without granting auth fields', () => {
    // Arrange
    const { ctx, store } = setup()
    // Act
    const registry = collectUserActors([store, store], ctx)!
    // Assert
    expect(registry.actors.map(a => a.sourceId)).toEqual(['1', '51'])
    expect(registry.actors[0].createdBy).toBeUndefined()
    expect(registry.actors[1].createdBy).toBe('@users:users:1')
    expect(registry.actors[1]).not.toHaveProperty('roles')
    expect(registry.actors[1]).not.toHaveProperty('password')
    expect(operationalIssues([store], registry)).toEqual([])
  })
  it.each([{ store_id: '20' }, { deleted_at: '2025-01-01' }, { is_frontend: '1' }, { created_by: '999' }, { created_by: '51' }])('rejects ineligible or unresolved creator %j', patch => {
    // Arrange
    const { ctx } = setup(patch)
    // Act / Assert
    expect(globalCreatorChain(ctx, '51')).toBeUndefined()
  })
  it('does not loosen author, nested createdBy, or ordinary cross-tenant refs', () => {
    // Arrange
    const { ctx, store } = setup()
    const registry = collectUserActors([store], ctx)!
    store.users[0].metadata = { createdBy: '@users:users:51' }
    store.blogs.push({ _ref: '@blogs:blog_posts:1', author: '@users:users:51' })
    // Act
    const issues = operationalIssues([store], registry)
    // Assert
    expect(issues.map(i => i.field)).toEqual(['users.metadata.createdBy', 'blogs.author'])
  })
  it('rejects sidecar collision with an ordinary document', () => {
    // Arrange
    const { ctx, store } = setup()
    const registry = collectUserActors([store], ctx)!
    store.users.push({ _ref: '@users:users:51' })
    // Act / Assert
    expect(operationalIssues([store], registry)).toContainEqual(expect.objectContaining({ code: 'USER_ACTOR_DOCUMENT_COLLISION' }))
  })
  it('rejects duplicate identity, provenance mismatch and missing creator chain', () => {
    // Arrange
    const { ctx, store } = setup()
    const registry = collectUserActors([store], ctx)!
    // Act / Assert
    expect(() => validateUserActors({ ...registry, actors: [registry.actors[0], registry.actors[0]] }, ctx.config)).toThrow('USER_ACTORS_IDENTITY_INVALID')
    expect(() => validateUserActors({ ...registry, snapshotId: 'other' }, ctx.config)).toThrow('USER_ACTORS_PROVENANCE_INVALID')
    expect(() => validateUserActors({ ...registry, actors: [registry.actors[1]] }, ctx.config)).toThrow('USER_ACTORS_CHAIN_INVALID')
  })
})
