import { describe, expect, it } from 'vitest'
import { classifyShipping, shippingInventory, gapCases } from '@/lib/migration/pw1-export/gap-inventory'
import type { Diagnostic, Row } from '@/lib/migration/pw1-export/contracts'

const delivery: Row = { id: '10', store_id: '1', delivery_provider_id: '2', status: '1', config_status: '1', shipping_fee_method: '1' }

describe('[TC-F42-063] Shipping source inventory', () => {
  it('keeps tier order and original numeric units without exporting unknown credential keys', () => {
    // Arrange
    const row = { ...delivery, shipping_fee_config: JSON.stringify({ condition_type: 2, secret: 'PRIVATE', condition_value: [
      { sub_total_from: '100', sub_total_to: '--', shipping_fee: '8.50', token: 'PRIVATE' },
      { sub_total_from: '0', sub_total_to: '99', shipping_fee: '20' },
    ] }) }
    // Act
    const result = classifyShipping(row, { id: '2', code: 'jnt', status: '1' })
    // Assert
    expect(result).toMatchObject({ classification: 'tiered-fee', targetReady: false, feeUnit: 'source-unit-unverified', tiers: [
      { index: 0, from: '100', to: '--', fee: '8.50' }, { index: 1, from: '0', to: '99', fee: '20' },
    ] })
    expect(JSON.stringify(result)).not.toContain('PRIVATE')
  })
  it.each([
    [{ shipping_fee_config: 'null' }, 'missing-config'],
    [{ shipping_fee_config: '{' }, 'invalid-json'],
    [{ shipping_fee_config: '[]' }, 'invalid-shape'],
    [{ shipping_fee_config: '{"condition_type":1,"shipping_fee":0}' }, 'fixed-fee'],
    [{ shipping_fee_config: '{"condition_type":1,"shipping_fee":-1}' }, 'invalid-fixed-fee'],
    [{ shipping_fee_config: '{"condition_type":2,"condition_value":[]}' }, 'invalid-tiers'],
    [{ shipping_fee_config: '{"condition_type":9}' }, 'unknown-condition'],
    [{ shipping_fee_method: '2', shipping_fee_config: 'null' }, 'dynamic-provider'],
    [{ shipping_fee_method: '9' }, 'unknown-method'],
  ])('classifies %j as %s without activating it', (override, classification) => {
    // Arrange / Act
    const result = classifyShipping({ ...delivery, ...override })
    // Assert
    expect(result.classification).toBe(classification)
    expect(result.targetReady).toBe(false)
  })
  it('distinguishes missing delivery table from stores with no rows and marks orphan delivery', () => {
    // Arrange
    const stores: Row[] = [{ id: '1' }, { id: '2', deleted_at: '2020-01-01' }]
    // Act
    const missing = shippingInventory({ stores })
    const orphan = shippingInventory({ stores, store_deliveries: [{ ...delivery, store_id: '3' }] })
    // Assert
    expect(missing.missingTable).toBe(true)
    expect(missing.storesWithoutDelivery).toEqual(['1'])
    expect(orphan.rows[0].liveStoreFound).toBe(false)
  })
})

describe('[TC-F42-064] Source reconciliation evidence', () => {
  it('separates same tenant/cross tenant slug collisions without copying titles or slugs', () => {
    // Arrange
    const tables = { blog_posts: [
      { id: '1', store_id: '1', slug: 'private-slug', name: 'PRIVATE_TITLE' },
      { id: '2', store_id: '2', slug: 'private-slug' },
      { id: '3', store_id: '2', slug: 'private-slug' },
    ] }
    const diagnostics: Diagnostic[] = ['1', '2'].map((id) => ({ code: 'BLOG_SLUG_COLLISION', severity: 'blocker', table: 'blog_posts', sourceId: id }))
    // Act
    const result = gapCases(tables, diagnostics)
    // Assert
    expect(result.map((row) => row.reason)).toEqual(['CROSS_TENANT_ONLY_SLUG_COLLISION', 'SAME_TENANT_SLUG_COLLISION'])
    expect(JSON.stringify(result)).not.toMatch(/private-slug|PRIVATE_TITLE/)
  })
  it('separates inactive, absent and deleted SKU and emits no sensitive contact value', () => {
    // Arrange
    const tables: Record<string, Row[]> = {
      products: ['1', '2', '3'].map((id) => ({ id, store_id: '1' })),
      product_skus: [{ id: '1', product_id: '1', store_id: '1', status: '0' }, { id: '2', product_id: '3', store_id: '1', status: '1', deleted_at: '2020-01-01' }],
      stores: [{ id: '1', hotline: '[123456789]', email: 'private@example.test', password: 'PRIVATE' }],
    }
    const diagnostics: Diagnostic[] = ['1', '2', '3'].map((id) => ({ code: 'SOURCE_NO_ELIGIBLE_SKU', severity: 'blocker', table: 'products', sourceId: id }))
    diagnostics.push({ code: 'CONTACT_STRUCTURE_UNRESOLVED', severity: 'blocker', table: 'stores', sourceId: '1', field: 'hotline' })
    // Act
    const result = gapCases(tables, diagnostics)
    // Assert
    expect(result.map((row) => row.reason)).toEqual(['ALL_LIVE_OWNED_SKUS_INACTIVE', 'NO_SKU_ROWS', 'NO_LIVE_OWNED_SKU', 'NUMERIC_CONTACT_ARRAY'])
    expect(JSON.stringify(result)).not.toMatch(/123456789|private@example|PRIVATE/)
  })
})
