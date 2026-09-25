// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SanitizedCollectionConfig } from 'payload'
import { buildEntities } from '@/lib/migration/pw1-json/projection'
import { sourceKeyRecords } from '@/lib/migration/pw1-json/writer'
import { DiskRegistry } from '@/lib/migration/pw1-json/disk-registry'
import { findClaim, findOperation } from '@/lib/migration/pw1-json/ledger'
import { COLLECTIONS, type ImportStore } from '@/lib/migration/pw1-json/types'
import type { Runtime } from '@/lib/migration/pw1-json/runtime'

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
function fixture() {
  const configs = Object.fromEntries(COLLECTIONS.map(slug => [slug, { slug, fields: [] }])) as Record<string, SanitizedCollectionConfig>
  const store: ImportStore = { storeId: '3', collections: Object.fromEntries(COLLECTIONS.map(slug => [slug, []])) as ImportStore['collections'] }
  store.collections.tenants = [{ _ref: '@tenants:stores:3' }]
  store.collections.sites = [{ _ref: '@sites:stores:3', tenant: '@tenants:stores:3' }]
  configs.sites.fields = [{ name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true }]
  store.collections.media = [{ _ref: '@media:blog_posts:185' }]
  store.collections.blogs = [{ _ref: '@blogs:blog_posts:185' }]
  const entities = buildEntities(store, configs, 'PW1PROD:test').filter(entity => ['blogs', 'media'].includes(entity.collection))
  const runtime = { payload: { collections: Object.fromEntries(Object.entries(configs).map(([slug, config]) => [slug, { config }])) } } as unknown as Runtime
  return { entities, runtime }
}
async function registry() { const path = await mkdtemp(join(tmpdir(), 'pw1-blog-media-')); directories.push(path); return new DiskRegistry(path) }

describe('[TC-F42-IMP-BLOG-MEDIA-IDENTITY] Derived thumbnail source identity', () => {
  it('keeps original refs but separates Blog and thumbnail through ledger queries', async () => {
    // Arrange
    const { entities } = fixture()
    const db = { query: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [], rowCount: 0 })) }
    const batch = 'json:12345678-1234-4234-8234-123456789abc'
    // Act
    for (const entity of entities) {
      await findClaim(db, 'PW1PROD', entity.sourceEntity, entity.sourceId)
      await findOperation(db, batch, entity.storeId, entity.sourceEntity, entity.sourceId)
    }
    // Assert
    expect(entities.map(e => [e.ref, e.sourceEntity, e.sourceId])).toEqual([
      ['@media:blog_posts:185', 'blog_post_thumbnail', '185'],
      ['@blogs:blog_posts:185', 'blog_posts', '185'],
    ])
    expect(db.query.mock.calls.map(call => call[1])).toEqual([
      ['PW1PROD', 'blog_post_thumbnail', '185'], ['12345678-1234-4234-8234-123456789abc', '3', 'blog_post_thumbnail', '185'],
      ['PW1PROD', 'blog_posts', '185'], ['12345678-1234-4234-8234-123456789abc', '3', 'blog_posts', '185'],
    ])
  })
  it('accepts both entities and repeated identical evidence across disk merges', async () => {
    // Arrange
    const { entities, runtime } = fixture(), keys = await registry()
    // Act
    await keys.add(sourceKeyRecords(runtime, entities)); await keys.commitGroup()
    await keys.add(sourceKeyRecords(runtime, entities))
    // Assert
    await expect(keys.commitGroup()).resolves.toBeUndefined()
  })
  it.each(['store', 'checksum'])('still rejects changed %s for the same thumbnail', async kind => {
    // Arrange
    const { entities, runtime } = fixture(), keys = await registry()
    await keys.add(sourceKeyRecords(runtime, entities)); await keys.commitGroup()
    const changed = { ...entities[0], ...(kind === 'store' ? { storeId: '28' } : { sourceChecksum: 'changed' }) }
    // Act
    await keys.add(sourceKeyRecords(runtime, [changed]))
    // Assert
    await expect(keys.commitGroup()).rejects.toThrow('CROSS_STORE_SOURCE_CONFLICT')
  })
})
