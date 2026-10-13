// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createSourceClassifier } from '@/lib/migration/pw1-export/source-classification'
import { dispositions } from '@/lib/migration/pw1-export/source-dispositions'
import type { Diagnostic } from '@/lib/migration/pw1-export/contracts'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
const config = sourceConfigSchema.parse({ version: 1, sourceInstance: 'test', sourceDatabase: 'test', sourceInstanceToken: 'test', snapshotId: 'one', asOf: '2026-01-01T00:00:00Z', utcOffset: '+08:00', sourcePlatformSuffix: 'old.test', targetPlatformSuffix: 'new.test', tables: { stores: 'stores.csv' }, deletedStores: 'review' })
describe('TC-F42-EXP-082: source ownership and retention', () => {
  it('scopes child rows through a SKU and product without using creator ownership', () => {
    const row = { id: '4', product_sku_id: '3', created_by: '999' }
    const classifier = createSourceClassifier({ stores: [{ id: '1' }], products: [{ id: '2', store_id: '1' }], product_skus: [{ id: '3', store_id: '1', product_id: '2' }], product_sku_images: [row] }, config, [])
    const owner = classifier.ownership('product_sku_images', row)
    expect(owner).toMatchObject({ storeId: '1', parentTable: 'product_skus', parentId: '3' })
  })
  it('fails closed for missing parents and conflicting tenant IDs', () => {
    const classifier = createSourceClassifier({ stores: [{ id: '1' }, { id: '2' }], products: [{ id: '3', store_id: '1' }] }, config, [])
    expect(classifier.ownership('product_images', { id: '4', product_id: 'missing' })).toMatchObject({ storeId: null, rule: 'OWNERSHIP_PARENT_UNVERIFIED' })
    expect(classifier.ownership('product_images', { id: '5', product_id: '3', store_id: '2' })).toMatchObject({ storeId: null, rule: 'OWNERSHIP_STORE_CONFLICT' })
  })
  it('resolves subscriptions only for supported polymorphic owners', () => {
    const classifier = createSourceClassifier({ stores: [{ id: '1' }] }, config, [])
    expect(classifier.ownership('plan_subscriptions', { id: '2', subscribable_type: 'App\\Models\\Store', subscribable_id: '1' }).storeId).toBe('1')
    expect(classifier.ownership('plan_subscriptions', { id: '3', subscribable_type: 'Unknown', subscribable_id: '1' }).rule).toBe('OWNERSHIP_MODEL_UNVERIFIED')
  })
  it('retains known source-only metadata, but never unknown fields or nonempty avatars', () => {
    const row = { id: '2', store_id: '1', profile_picture: 'image.png' }
    const classifier = createSourceClassifier({ stores: [{ id: '1' }], users: [row] }, config, [])
    const owner = classifier.ownership('users', row)
    expect(classifier.retention('users', row, 'username', owner)).toBe('MASTER-3.2-USER-METADATA-SOURCE-ONLY')
    expect(classifier.retention('users', row, 'new_unknown_field', owner)).toBeUndefined()
    expect(classifier.retention('users', row, 'profile_picture', owner)).toBeUndefined()
    expect(classifier.retention('users', { ...row, profile_picture: '' }, 'profile_picture', owner)).toBe('MASTER-3.2-OPTIONAL-AVATAR-ABSENT')
  })
  it('reports unresolved fields for the owning Store instead of blocking every Store', () => {
    const diagnostics: Diagnostic[] = []
    const rows = dispositions({ inputRoot: '/unused', config, tables: { stores: [{ id: '205' }, { id: '206' }], products: [{ id: '3', store_id: '206' }], product_images: [{ id: '4', product_id: '3', url: 'image.png' }] }, files: [{ table: 'product_images', filename: 'product_images.csv', sha256: '0'.repeat(64), bytes: 1, selected: true, rowCount: 1, headers: ['id', 'product_id', 'url'] }] }, [], diagnostics)
    expect(rows[0].storeId).toBe('206')
    expect(diagnostics).toContainEqual({ code: 'SOURCE_FIELDS_UNRESOLVED', severity: 'blocker', table: 'product_images', storeId: '206' })
    expect(diagnostics.some(d => !d.storeId || d.storeId === '205')).toBe(false)
  })
  it('does not retain an orphan role as an approved source-only row', () => {
    const row = { model_type: 'App\\Models\\User', model_id: '5753', role_id: '1' }
    const classifier = createSourceClassifier({}, config, [])
    const owner = classifier.ownership('model_has_roles', row)
    expect(owner.rule).toBe('OWNERSHIP_PARENT_UNVERIFIED')
    expect(classifier.retention('model_has_roles', row, 'role_id', owner)).toBeUndefined()
  })
})
