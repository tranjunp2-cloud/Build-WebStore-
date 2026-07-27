/**
 * TC-GH1432-QC-02 — Scaled QC product fixtures must be deterministic.
 */
import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import {
  buildQcProductSlug,
  findMissingQcProducts,
  getQcProductSlugs,
  QC_PRODUCTS_PER_TENANT,
  seedTenantProducts,
} from '../../../../scripts/qc-seed-products'

function mockPayload(findDocs: unknown[] = []) {
  return {
    find: vi.fn().mockResolvedValue({ docs: findDocs }),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
  }
}

describe('[TC-GH1432-QC-02] deterministic QC product fixtures', () => {
  it('namespaces every product slug by tenant', () => {
    // Arrange
    const tenantOneSlug = 'qc-shop-1'
    const tenantTwoSlug = 'qc-shop-2'

    // Act
    const tenantOneProducts = getQcProductSlugs(tenantOneSlug)
    const tenantTwoProducts = getQcProductSlugs(tenantTwoSlug)

    // Assert
    expect(tenantOneProducts).toHaveLength(QC_PRODUCTS_PER_TENANT)
    expect(new Set([...tenantOneProducts, ...tenantTwoProducts]).size).toBe(
      QC_PRODUCTS_PER_TENANT * 2,
    )
    expect(buildQcProductSlug('qc-signature-coffee', tenantOneSlug)).toBe(
      'qc-shop-1-qc-signature-coffee',
    )
  })

  it('creates unique products when tenant seeds run concurrently', async () => {
    // Arrange
    const payload = mockPayload()

    // Act
    await Promise.all([
      seedTenantProducts(payload as unknown as Payload, 1, 'qc-shop-1', 11, 'QC Tenant 1'),
      seedTenantProducts(payload as unknown as Payload, 2, 'qc-shop-2', 22, 'QC Tenant 2'),
    ])
    const createdSlugs = payload.create.mock.calls.map(
      ([args]) => (args as { data: { slug: string } }).data.slug,
    )

    // Assert
    expect(createdSlugs).toHaveLength(QC_PRODUCTS_PER_TENANT * 2)
    expect(new Set(createdSlugs).size).toBe(createdSlugs.length)
  })

  it('skips canonical products that already belong to the tenant', async () => {
    // Arrange
    const payload = mockPayload([{ id: 10, tenant: 1 }])

    // Act
    const created = await seedTenantProducts(
      payload as unknown as Payload,
      1,
      'qc-shop-1',
      11,
      'QC Tenant 1',
    )

    // Assert
    expect(created).toBe(0)
    expect(payload.find).toHaveBeenCalledTimes(QC_PRODUCTS_PER_TENANT)
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('restores a soft-deleted canonical product instead of accepting an invisible fixture', async () => {
    // Arrange
    const payload = mockPayload([{ id: 10, tenant: 1, deletedAt: '2026-07-01T00:00:00.000Z' }])

    // Act
    const created = await seedTenantProducts(
      payload as unknown as Payload,
      1,
      'qc-shop-1',
      11,
      'QC Tenant 1',
    )

    // Assert
    expect(created).toBe(0)
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledTimes(QC_PRODUCTS_PER_TENANT)
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'products',
      id: 10,
      data: expect.objectContaining({ deletedAt: null, site: 11 }),
      overrideAccess: true,
    }))
  })

  it('fails immediately instead of swallowing product creation errors', async () => {
    // Arrange
    const payload = mockPayload()
    payload.create.mockRejectedValue(new Error('unique constraint violation'))

    // Act
    const result = seedTenantProducts(
      payload as unknown as Payload,
      1,
      'qc-shop-1',
      11,
      'QC Tenant 1',
    )

    // Assert
    await expect(result).rejects.toThrow(
      'Product seed failed for QC Tenant 1 / qc-shop-1-qc-signature-coffee',
    )
    expect(payload.create).toHaveBeenCalledTimes(1)
  })

  it('reports missing or cross-tenant canonical products', () => {
    // Arrange
    const tenantOneProducts = getQcProductSlugs('qc-shop-1')
    const products = tenantOneProducts.slice(1).map((slug) => ({ slug, tenant: 1 }))
    products.push({ slug: tenantOneProducts[0], tenant: 2 })

    // Act
    const missing = findMissingQcProducts(products, [{ id: 1, slug: 'qc-shop-1' }])

    // Assert
    expect(missing).toEqual([
      'qc-shop-1/qc-shop-1-qc-signature-coffee',
    ])
  })

  it('does not count soft-deleted canonical products as load-test fixtures', () => {
    // Arrange
    const products = getQcProductSlugs('qc-shop-1').map((slug) => ({
      slug,
      tenant: 1,
      deletedAt: '2026-07-01T00:00:00.000Z',
    }))

    // Act
    const missing = findMissingQcProducts(products, [{ id: 1, slug: 'qc-shop-1' }])

    // Assert
    expect(missing).toHaveLength(QC_PRODUCTS_PER_TENANT)
  })
})
