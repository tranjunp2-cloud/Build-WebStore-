// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProductExclusionIndex, PRODUCT_EXCLUSION_CODE, PRODUCT_EXCLUSION_RULE } from '@/lib/migration/pw1-json/product-exclusions'

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
