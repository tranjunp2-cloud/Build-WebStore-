// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProductExclusionIndex, PRODUCT_CATALOG_EXCLUSION_CODE, PRODUCT_CATALOG_EXCLUSION_RULE, PRODUCT_EXCLUSION_CODE, PRODUCT_EXCLUSION_RULE } from '@/lib/migration/pw1-json/product-exclusions'

const warning = { code: PRODUCT_EXCLUSION_CODE, severity: 'warning', table: 'products', storeId: '1', sourceId: '20', reason: 'MISSING_PRICE' }
const source = () => ({ table: 'products', sourceId: '20', storeId: '1', disposition: 'retained-source', fields: { id: 'retained-source' }, fieldRetentionRules: { id: PRODUCT_EXCLUSION_RULE }, contributions: [], ownership: { rule: 'SOURCE_STORE_ID' }, productExclusion: { productId: '20', reason: 'MISSING_PRICE' as const } })
const index = (enabled = true) => createProductExclusionIndex(() => { throw new Error('INVALID_EXCLUSION') }, enabled)
describe('[TC-F42-IMP-EXCLUSION-001] Product exclusion evidence', () => {
  it('accepts an absent Product with exact warning and retained source row', () => {
    const proof = index(); proof.addDiagnostic(warning); proof.addRow(source())
    expect(() => proof.finish()).not.toThrow()
  })
  it.each(['missing-root','wrong-reason','wrong-store','emitted','old-contract','operational-contribution','missing-rule','orphan-child','sku-without-parent','unrelated-sku'])('rejects %s', mutation => {
    const proof = index(mutation !== 'old-contract'), row = source()
    expect(() => {
      proof.addDiagnostic(warning)
      if (mutation === 'wrong-reason') proof.addDiagnostic({ ...warning, reason: 'MISSING_STOCK' })
      if (mutation === 'wrong-store') row.storeId = '2'
      if (mutation === 'emitted') proof.addProduct('1','@products:products:20')
      if (mutation === 'missing-rule') row.fieldRetentionRules.id = 'OTHER'
      if (mutation === 'operational-contribution') proof.addRow({ ...row, contributions: [{ rule: 'MASTER_5' }] })
      else if (mutation !== 'missing-root') proof.addRow(row)
      if (mutation === 'orphan-child') proof.addRow({ ...source(), table:'product_images', sourceId:'99', ownership:{rule:'SOURCE_PARENT_RELATION',parentTable:'products',parentId:'999'} })
      if (mutation === 'sku-without-parent') proof.addRow({ ...source(), table:'product_skus', sourceId:'30' })
      if (mutation === 'unrelated-sku') proof.addRow({ ...source(), table:'product_skus', sourceId:'30', ownership:{rule:'SOURCE_PARENT_RELATION',parentTable:'products',parentId:'21'} })
      proof.finish()
    }).toThrow('INVALID_EXCLUSION')
  })
})


describe('[TC-F42-IMP-POLICY-004] Reviewed catalog exclusion proof', () => {
  const catalogPolicy = { excludeDuplicateProductSlugs: true, excludeProductsWithoutValidVariants: true }
  function catalogIndex(enabled = true) { return createProductExclusionIndex(() => { throw new Error('INVALID_EXCLUSION') }, true, enabled ? catalogPolicy : undefined) }
  function catalogRow(reason: 'DUPLICATE_PRODUCT_SLUG' | 'NO_VALID_VARIANTS' | 'MISSING_VARIANT_DOMAIN' = 'DUPLICATE_PRODUCT_SLUG') {
    return { ...source(), fieldRetentionRules: { id: PRODUCT_CATALOG_EXCLUSION_RULE }, productExclusion: { productId: '20', reason, ...(reason === 'DUPLICATE_PRODUCT_SLUG' ? { canonicalProductId: '10' } : {}) } }
  }
  function canonical() { return { ...source(), sourceId: '10', disposition: 'mapped', fields: { id: 'source-identity' }, fieldRetentionRules: undefined, productExclusion: undefined } }
  it.each(['DUPLICATE_PRODUCT_SLUG', 'NO_VALID_VARIANTS', 'MISSING_VARIANT_DOMAIN'] as const)('accepts reviewed %s exclusion with source proof', reason => {
    // Arrange
    const proof = catalogIndex()
    // Act
    proof.addDiagnostic({ ...warning, code: PRODUCT_CATALOG_EXCLUSION_CODE, reason })
    proof.addRow(catalogRow(reason)); proof.addRow(canonical())
    // Assert
    expect(() => proof.finish()).not.toThrow()
  })
  it.each(['disabled', 'missing-canonical', 'cross-store-canonical', 'wrong-canonical-order', 'missing-canonical-id', 'emitted', 'wrong-retention-rule', 'child-canonical-mismatch'])('rejects %s', mutation => {
    // Arrange
    const proof = catalogIndex(mutation !== 'disabled'), row = catalogRow()
    // Act / Assert
    expect(() => {
      proof.addDiagnostic({ ...warning, code: PRODUCT_CATALOG_EXCLUSION_CODE, reason: 'DUPLICATE_PRODUCT_SLUG' })
      if (mutation !== 'missing-canonical') proof.addRow({ ...canonical(), storeId: mutation === 'cross-store-canonical' ? '2' : '1' })
      if (mutation === 'wrong-canonical-order') row.productExclusion.canonicalProductId = '21'
      if (mutation === 'missing-canonical-id') delete row.productExclusion.canonicalProductId
      if (mutation === 'wrong-retention-rule') row.fieldRetentionRules.id = PRODUCT_EXCLUSION_RULE
      if (mutation === 'emitted') proof.addProduct('1', '@products:products:20')
      proof.addRow(row)
      if (mutation === 'child-canonical-mismatch') proof.addRow({ ...catalogRow(), table: 'product_images', sourceId: '99', productExclusion: { productId: '20', reason: 'DUPLICATE_PRODUCT_SLUG', canonicalProductId: '9' }, ownership: { rule: 'SOURCE_PARENT_RELATION', parentTable: 'products', parentId: '20' } })
      proof.finish()
    }).toThrow('INVALID_EXCLUSION')
  })
})
