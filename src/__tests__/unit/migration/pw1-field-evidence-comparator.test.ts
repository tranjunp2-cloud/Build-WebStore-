import { describe, expect, it } from 'vitest'
import { compareSourceRow, targetIndex, type VerifiedTarget } from '@/lib/migration/pw1-evidence/comparator'
import type { SourceEvidenceRow } from '@/lib/migration/pw1-export/source-evidence'
import { sourceEvidenceRow } from '@/lib/migration/pw1-export/source-evidence'
import type { LoadedSource } from '@/lib/migration/pw1-export/csv-loader'
import type { RowDisposition } from '@/lib/migration/pw1-export/source-dispositions'

const target: VerifiedTarget = {
  sourceEntity: 'products', sourceId: '10', targetCollection: 'products', targetId: '501',
  projection: { name: 'Product A', slug: 'product-a', currency: 'MYR', variants: [{ sku: 'SKU-A', price: 12.5, stock: 2 }] },
}

function productRow(): SourceEvidenceRow {
  return {
    kind: 'row', table: 'products', sourceId: '10', storeId: '205', record: 1,
    redactedFieldCount: 0,
    disposition: 'mapped', targetPaths: [{ path: '@products:products:10', rule: 'master-5.2', fields: ['name','slug'] }],
    fields: {
      name: { presence: 'value', display: 'Product A', fingerprint: null, disposition: 'mapped' },
      slug: { presence: 'value', display: 'different-slug', fingerprint: null, disposition: 'mapped' },
    },
  }
}

describe('[TC-F42-EVD-001] verified field comparison', () => {
  it('classifies match and mismatch from a verified projection', () => {
    // Arrange
    const source = productRow()

    // Act
    const fields = compareSourceRow(source, targetIndex([target]))

    // Assert
    expect(fields.map(field => field.comparisonStatus)).toEqual(['match','mismatch'])
    expect(fields[0].targetId).toBe('501')
  })

  it('keeps missing mapping unverified and a verified absent field missing', () => {
    // Arrange
    const source = productRow()

    // Act
    const withoutClaim = compareSourceRow(source, targetIndex([]))
    const withoutTargetField = compareSourceRow(source, targetIndex([{ ...target, projection: { slug: 'product-a' } }]))

    // Assert
    expect(withoutClaim[0].comparisonStatus).toBe('unverified')
    expect(withoutTargetField[0].comparisonStatus).toBe('missing')
  })

  it('requires an explicit absence proof before classifying a whole missing Product', () => {
    const source = productRow()
    const absentKey = ['products','products','10'].join('\0')
    expect(compareSourceRow(source, targetIndex([]))[0].comparisonStatus).toBe('unverified')
    expect(compareSourceRow(source, targetIndex([]), undefined, new Set([absentKey]))[0])
      .toMatchObject({ comparisonStatus: 'missing', reasonCode: 'CONFIRMED_TARGET_RECORD_ABSENT' })
  })

  it('compares approved SKU on_hand stock and keeps reserved/available unverified', () => {
    // Arrange
    const source: SourceEvidenceRow = {
      kind: 'row', table: 'product_skus', sourceId: '20', storeId: '205', record: 1,
      redactedFieldCount: 0,
      disposition: 'mapped', targetPaths: [{ path: '@products:products:10.variants.0', rule: 'master-16-sku-crosswalk', fields: ['price','stock'] }],
      fields: {
        price: { presence: 'value', display: '12.50', fingerprint: null, disposition: 'mapped' },
        stock: { presence: 'value', display: '2', fingerprint: null, disposition: 'mapped' },
        reserved: { presence: 'absent', display: null, fingerprint: null, disposition: 'mapped' },
        available: { presence: 'absent', display: null, fingerprint: null, disposition: 'mapped' },
      },
    }

    // Act
    const fields = compareSourceRow(source, targetIndex([target]), undefined, new Set(), false, 'MYR')

    // Assert
    expect(fields[0].comparisonStatus).toBe('match')
    expect(fields[0].transformCode).toBe('money-major')
    expect(fields[0]).toMatchObject({ sourceNormalized: '1250', targetNormalized: '1250' })
    expect(fields[1]).toMatchObject({ comparisonStatus: 'match', transformCode: 'stock-on-hand' })
    expect(fields[2]).toMatchObject({ comparisonStatus: 'unverified', reasonCode: 'RESERVATION_SOURCE_UNAVAILABLE' })
    expect(fields[3]).toMatchObject({ comparisonStatus: 'unverified', reasonCode: 'AVAILABLE_SOURCE_UNAVAILABLE' })
  })

  it('reports SKU on_hand mismatch against the primary Product inventory', () => {
    const source: SourceEvidenceRow = {
      kind: 'row', table: 'product_skus', sourceId: '21', storeId: '205', record: 1,
      redactedFieldCount: 0, disposition: 'mapped',
      targetPaths: [{ path: '@products:products:10', rule: 'master-16-sku-crosswalk', fields: ['stock'] }],
      fields: { stock: { presence: 'value', display: '5', fingerprint: null, disposition: 'mapped' } },
    }
    const result = compareSourceRow(source, targetIndex([{ ...target, projection: { ...target.projection, inventory: 2 } }]))
    expect(result[0]).toMatchObject({ comparisonStatus: 'mismatch', targetField: 'inventory',
      transformCode: 'stock-on-hand' })
  })

  it('keeps an exporter-excluded row outside target parity', () => {
    // Arrange
    const source = { ...productRow(), disposition: 'retained-source' as const }

    // Act
    const fields = compareSourceRow(source, targetIndex([target]))

    // Assert
    expect(fields.every(field => field.comparisonStatus === 'unsupported')).toBe(true)
    expect(fields[0].reasonCode).toBe('SOURCE_NOT_EMITTED')
  })

  it('keeps an unresolved source row unverified instead of calling it unsupported', () => {
    const source = { ...productRow(), disposition: 'unresolved' as const }
    const fields = compareSourceRow(source, targetIndex([target]))
    expect(fields.every(field => field.comparisonStatus === 'unverified')).toBe(true)
    expect(fields[0].reasonCode).toBe('SOURCE_ROW_UNRESOLVED')
  })

  it('marks two verified PW2 identities claimed by one source field as duplicate', () => {
    // Arrange
    const source = productRow()
    source.fields = { name: source.fields.name }
    source.targetPaths = [
      { path: '@products:products:10', rule: 'fixture', fields: ['name'] },
      { path: '@products:products:11', rule: 'fixture', fields: ['name'] },
    ]

    // Act
    const result = compareSourceRow(source, targetIndex([target, { ...target, sourceId: '11', targetId: '502' }]))

    // Assert
    expect(result[0]).toMatchObject({ comparisonStatus: 'duplicate', reasonCode: 'MULTIPLE_VERIFIED_TARGETS' })
    expect(result[0].targetClaims).toEqual([
      { collection: 'products', id: '501' }, { collection: 'products', id: '502' },
    ])
  })

  it('retains two verified targets for the same PW1 mapping key', () => {
    // Arrange
    const source = productRow()
    source.fields = { name: source.fields.name }
    const second = { ...target, targetId: '502' }
    const key = ['products','products','10'].join('\0')

    // Act
    const result = compareSourceRow(source, targetIndex([target, second]), undefined, new Set(),
      false, undefined, undefined, undefined, undefined, new Map([[key, [target, second]]]))

    // Assert
    expect(result[0]).toMatchObject({ comparisonStatus: 'duplicate', reasonCode: 'MULTIPLE_VERIFIED_TARGETS' })
    expect(result[0].targetClaims.map(claim => claim.id)).toEqual(['501', '502'])
  })

  it('compares order discount in target minor units and detects total/status mismatch', () => {
    // Arrange
    const source: SourceEvidenceRow = {
      kind: 'row', table: 'orders', sourceId: '30', storeId: '205', record: 1,
      redactedFieldCount: 0, disposition: 'mapped',
      targetPaths: [{ path: '@orders:orders:30', rule: 'fixture', fields: ['total_discount','total','status'] }],
      fields: {
        total_discount: { presence: 'value', display: '12.50', fingerprint: null, disposition: 'mapped' },
        total: { presence: 'value', display: '40.00', fingerprint: null, disposition: 'mapped' },
        status: { presence: 'value', display: '5', fingerprint: null, disposition: 'mapped' },
      },
    }
    const order: VerifiedTarget = { sourceEntity: 'orders', sourceId: '30', targetCollection: 'orders', targetId: '700',
      projection: { currency: 'MYR', discountAmount: 1250, total: 42, status: 'shipped' } }

    // Act
    const fields = compareSourceRow(source, targetIndex([order]), undefined, new Set(), false, 'MYR')

    // Assert
    expect(fields.map(field => field.comparisonStatus)).toEqual(['match','mismatch','mismatch'])
  })

  it('does not claim a price match when the PW1 currency is missing or differs', () => {
    const source: SourceEvidenceRow = {
      kind: 'row', table: 'product_skus', sourceId: '20', storeId: '205', record: 1,
      redactedFieldCount: 0, disposition: 'mapped',
      targetPaths: [{ path: '@products:products:10.variants.0', rule: 'fixture', fields: ['price'] }],
      fields: { price: { presence: 'value', display: '12.50', fingerprint: null, disposition: 'mapped' } },
    }
    expect(compareSourceRow(source, targetIndex([target]))[0]).toMatchObject({
      comparisonStatus: 'unverified', reasonCode: 'CURRENCY_CROSSWALK_UNAVAILABLE',
    })
    expect(compareSourceRow(source, targetIndex([target]), undefined, new Set(), false, 'USD')[0]).toMatchObject({
      comparisonStatus: 'mismatch', reasonCode: 'CURRENCY_DIFFERENT',
    })
  })

  it('does not compare unknown mapped fields without a rule', () => {
    // Arrange
    const source = productRow()
    source.fields = { custom_field: { presence: 'value', display: null, fingerprint: null, disposition: 'mapped' } }

    // Act
    const result = compareSourceRow(source, targetIndex([target]))

    // Assert
    expect(result[0]).toMatchObject({ comparisonStatus: 'unsupported', reasonCode: 'FIELD_RULE_UNSUPPORTED' })
  })

  it('marks Domain outside the migration contract as unsupported', () => {
    // Arrange
    const source: SourceEvidenceRow = {
      kind: 'row', table: 'store_domains', sourceId: '88', storeId: '205', record: 1,
      redactedFieldCount: 0, disposition: 'mapped', targetPaths: [],
      fields: { domain: { presence: 'value', display: null, fingerprint: null, disposition: 'mapped' } },
    }

    // Act
    const result = compareSourceRow(source, targetIndex([]), undefined, new Set(), true)

    // Assert
    expect(result[0]).toMatchObject({
      comparisonStatus: 'unsupported', reasonCode: 'DOMAIN_NOT_MIGRATED',
    })
  })

  it('locates a migrated Order item by stable item ID rather than array position', () => {
    // Arrange
    const source: SourceEvidenceRow = {
      kind: 'row', table: 'order_details', sourceId: '31', storeId: '205', record: 1,
      redactedFieldCount: 0, disposition: 'mapped',
      targetPaths: [{ path: '@orders:orders:30.items.item-uuid', rule: 'fixture', fields: ['quantity'] }],
      fields: {
        quantity: { presence: 'value', display: '02', fingerprint: null, disposition: 'mapped' },
        total_price: { presence: 'value', display: '25.00', fingerprint: null, disposition: 'mapped' },
      },
    }
    const order: VerifiedTarget = { sourceEntity: 'orders', sourceId: '30', targetCollection: 'orders', targetId: '700',
      projection: { items: [{ id: 'other-uuid', quantity: 8 }, { id: 'item-uuid', quantity: 2 }] } }

    // Act
    const result = compareSourceRow(source, targetIndex([order]), undefined, new Set(), false, 'MYR')

    // Assert
    expect(result[0]).toMatchObject({ comparisonStatus: 'match', targetField: 'items.item-uuid.quantity' })
    expect(result[1]).toMatchObject({ comparisonStatus: 'unsupported',
      reasonCode: 'PW2_ITEM_TOTAL_SNAPSHOT_NOT_STORED' })
  })

  it('compares Product category by verified target identity and weight in kilograms', () => {
    const source = productRow()
    source.fields = {
      category_id: { presence: 'value', display: '70', fingerprint: null, disposition: 'mapped' },
      package_weight: { presence: 'value', display: '500', fingerprint: null, disposition: 'mapped' },
      package_weight_type: { presence: 'value', display: '2', fingerprint: null, disposition: 'mapped' },
    }
    source.targetPaths = [{ path: '@products:products:10', rule: 'master-5.2',
      fields: ['category_id','package_weight'] }]
    const product = { ...target, projection: { ...target.projection, category: [701], weight: 0.5 } }
    const category: VerifiedTarget = { sourceEntity: 'categories', sourceId: '70',
      targetCollection: 'categories', targetId: '701', projection: { name: 'Category' } }
    const result = compareSourceRow(source, targetIndex([product,category]))
    expect(result[0]).toMatchObject({ comparisonStatus: 'match', reasonCode: 'CATEGORY_IDENTITY_EQUAL' })
    expect(result[1]).toMatchObject({ comparisonStatus: 'match', transformCode: 'weight-kg' })
    expect(result[2]).toMatchObject({ comparisonStatus: 'match', transformCode: 'weight-unit',
      reasonCode: 'WEIGHT_UNIT_EQUAL' })
  })

  it('emits explicit statuses for required QC fields absent from the source row', () => {
    const results = compareSourceRow(productRow(), targetIndex([target]), undefined, new Set(), true)
    const imageCount = results.find(result => result.sourceField === 'image_count')
    const dimension = results.find(result => result.sourceField === 'package_length')
    expect(imageCount).toMatchObject({ comparisonStatus: 'unverified',
      reasonCode: 'SOURCE_FIELD_ABSENT' })
    expect(dimension).toMatchObject({ comparisonStatus: 'unverified',
      reasonCode: 'SOURCE_FIELD_ABSENT' })
  })

  it('compares reviewed PW1 cm dimensions without interpreting the legacy enum', () => {
    // Arrange
    const source = productRow()
    source.fields = {
      package_length: { presence: 'value', display: '12.50', fingerprint: null, disposition: 'mapped' },
      package_width: { presence: 'value', display: '8', fingerprint: null, disposition: 'mapped' },
    }
    source.targetPaths = [{ path: '@products:products:10', rule: 'master-5.2',
      fields: ['package_length','package_width'] }]
    const product = { ...target, projection: { ...target.projection,
      dimensions: { length: 12.5, width: 9 } } }

    // Act
    const result = compareSourceRow(source, targetIndex([product]))

    // Assert
    expect(result[0]).toMatchObject({ comparisonStatus: 'match', transformCode: 'dimension-cm',
      sourceNormalized: '12.5', targetNormalized: '12.5' })
    expect(result[1]).toMatchObject({ comparisonStatus: 'mismatch', reasonCode: 'DIMENSION_CM_DIFFERENT' })
  })

  it('compares Product image count and identity through the verified media crosswalk', () => {
    const source = productRow()
    const product = { ...target, projection: { ...target.projection,
      images: [{ id: 'child-1', image: 701 }, { id: 'child-2', image: 702 }] } }
    const results = compareSourceRow(source, targetIndex([product]), undefined, new Set(), true, 'MYR', [
      { sourceId: '11', targetId: '701' }, { sourceId: '12', targetId: '702' },
    ])
    expect(results.find(result => result.sourceField === 'image_count')).toMatchObject({
      comparisonStatus: 'match', reasonCode: 'IMAGE_COUNT_EQUAL',
    })
    expect(results.find(result => result.sourceField === 'image_identity')).toMatchObject({
      comparisonStatus: 'match', reasonCode: 'IMAGE_IDENTITY_EQUAL',
    })
    const changed = compareSourceRow(source, targetIndex([product]), undefined, new Set(), true, 'MYR', [
      { sourceId: '11', targetId: '701' }, { sourceId: '12', targetId: '703' },
    ])
    expect(changed.find(result => result.sourceField === 'image_identity')?.comparisonStatus).toBe('mismatch')
  })

  it('resolves Discount provenance and compares keyed code, type, value and status', () => {
    const key = 'synthetic-discount-hmac-key-with-32-plus-bytes'
    const path = '@discounts:promotion_codes:91'
    const loaded = { tables: { promotion_codes: [{ id: '91', code: ' save10 ' }] } } as LoadedSource
    const disposition = { table: 'promotion_codes', sourceId: '91', storeId: '205', record: 1,
      disposition: 'mapped', fields: { code: 'mapped' },
      contributions: [{ targetPath: path, rule: 'master-7.1', fields: ['code'] }] } as RowDisposition
    const code = sourceEvidenceRow(loaded, disposition, key)
    const promotion: SourceEvidenceRow = { kind: 'row', table: 'promotions', sourceId: '4', storeId: '205',
      record: 1, disposition: 'mapped', redactedFieldCount: 0,
      targetPaths: [{ path, rule: 'master-7.1', fields: ['discount_type_id','discount_value','status'] }],
      fields: {
        discount_type_id: { presence: 'value', display: '2', fingerprint: null, disposition: 'mapped' },
        discount_value: { presence: 'value', display: '12.50', fingerprint: null, disposition: 'mapped' },
        status: { presence: 'value', display: '1', fingerprint: null, disposition: 'mapped' },
      } }
    const discount: VerifiedTarget = { sourceEntity: 'discounts', sourceId: '91',
      targetCollection: 'discounts', targetId: '700',
      projection: { code: 'SAVE10', type: 'fixed', value: 1250, status: 'active' } }
    const index = targetIndex([discount])
    expect(compareSourceRow(code, index, key)[0].comparisonStatus).toBe('match')
    expect(compareSourceRow(promotion, index, key, new Set(), false, 'MYR')
      .map(result => result.comparisonStatus)).toEqual(['match','match','match'])
    expect(code.fields.code.display).toBeNull()
  })

  it('compares the count of distinct mapped Customer addresses without exposing address content', () => {
    const customer: SourceEvidenceRow = { kind: 'row', table: 'customers', sourceId: '24', storeId: '205',
      record: 1, disposition: 'mapped', redactedFieldCount: 0,
      targetPaths: [{ path: '@customers:customers:20', rule: 'canonical-customer', fields: ['name'] }],
      fields: { name: { presence: 'value', display: null, fingerprint: null, disposition: 'mapped' } } }
    const targetCustomer: VerifiedTarget = { sourceEntity: 'customers', sourceId: '20',
      targetCollection: 'customers', targetId: '900', projection: { addresses: [{ id: 'one' }, { id: 'two' }] } }
    const fields = compareSourceRow(customer, targetIndex([targetCustomer]), undefined, new Set(), true,
      undefined, undefined, 2)
    expect(fields.find(field => field.sourceField === 'address_count')).toMatchObject({
      comparisonStatus: 'match', sourceDisplay: '2', targetDisplay: '2', reasonCode: 'ADDRESS_COUNT_EQUAL',
    })
    expect(JSON.stringify(fields)).not.toContain('line1')
  })

  it('compares Customer email only through keyed fingerprints', () => {
    // Arrange
    const key = 'synthetic-customer-hmac-key-with-32-plus-bytes'
    const loaded = { tables: { customers: [{ id: '24', email: 'PRIVATE@Example.Invalid' }] } } as LoadedSource
    const disposition = { table: 'customers', sourceId: '24', storeId: '205', record: 1,
      disposition: 'mapped', fields: { email: 'mapped' },
      contributions: [{ targetPath: '@customers:customers:24', rule: 'master-customer',
        fields: ['email'] }] } as RowDisposition
    const source = sourceEvidenceRow(loaded, disposition, key)
    const customer: VerifiedTarget = { sourceEntity: 'customers', sourceId: '24',
      targetCollection: 'customers', targetId: '900',
      projection: { email: 'private@example.invalid' } }

    // Act
    const matched = compareSourceRow(source, targetIndex([customer]), key)
    const changed = compareSourceRow(source, targetIndex([{ ...customer,
      projection: { email: 'changed@example.invalid' } }]), key)

    // Assert
    expect(matched.find(field => field.sourceField === 'email')?.comparisonStatus).toBe('match')
    expect(changed.find(field => field.sourceField === 'email')?.comparisonStatus).toBe('mismatch')
    expect(JSON.stringify(matched)).not.toContain('PRIVATE@Example.Invalid')
    expect(JSON.stringify(matched)).not.toContain('private@example.invalid')
    expect(JSON.stringify(changed)).not.toContain('changed@example.invalid')
  })

  it('compares an emitted Order empty tax using the reviewed zero transform', () => {
    // Arrange
    const source: SourceEvidenceRow = { kind: 'row', table: 'orders', sourceId: '30', storeId: '205',
      record: 1, disposition: 'mapped', redactedFieldCount: 0,
      targetPaths: [{ path: '@orders:orders:30', rule: 'master-7.2', fields: ['total_tax'] }],
      fields: { total_tax: { presence: 'empty', display: '', fingerprint: null, disposition: 'mapped' } } }
    const order: VerifiedTarget = { sourceEntity: 'orders', sourceId: '30', targetCollection: 'orders',
      targetId: '700', projection: { currency: 'MYR', tax: 0 } }

    // Act
    const result = compareSourceRow(source, targetIndex([order]), undefined, new Set(), false, 'MYR')[0]
    const nullSource = { ...source, fields: { total_tax: {
      presence: 'null' as const, display: null, fingerprint: null, disposition: 'mapped',
    } } }
    const nullResult = compareSourceRow(nullSource, targetIndex([order]), undefined, new Set(), false, 'MYR')[0]

    // Assert
    expect(result)
      .toMatchObject({ comparisonStatus: 'match', sourceNormalized: '0', targetNormalized: '0',
        reasonCode: 'ORDER_TAX_EMPTY_AS_ZERO_EQUAL' })
    expect(nullResult).toMatchObject({ comparisonStatus: 'match', sourceNormalized: '0',
      reasonCode: 'ORDER_TAX_EMPTY_AS_ZERO_EQUAL' })
  })

  it('compares supported Order payment method and COD unpaid fallback', () => {
    const source: SourceEvidenceRow = { kind: 'row', table: 'orders', sourceId: '30', storeId: '205',
      record: 1, disposition: 'mapped', redactedFieldCount: 0,
      targetPaths: [{ path: '@orders:orders:30', rule: 'master-7.2',
        fields: ['payment_method_id','purchase_status'] }],
      fields: {
        payment_method_id: { presence: 'value', display: '1', fingerprint: null, disposition: 'mapped' },
        purchase_status: { presence: 'empty', display: '', fingerprint: null, disposition: 'mapped' },
      } }
    const order: VerifiedTarget = { sourceEntity: 'orders', sourceId: '30', targetCollection: 'orders',
      targetId: '700', projection: { paymentMethod: 'cod', paymentStatus: 'unpaid' } }
    const fields = compareSourceRow(source, targetIndex([order]), undefined, new Set(), false,
      undefined, undefined, undefined, 'cod')
    expect(fields.map(field => field.comparisonStatus)).toEqual(['match','match'])
  })

  it('compares Email template subject with a keyed fingerprint and never exposes its text', () => {
    const key = 'synthetic-email-hmac-key-with-more-than-32-bytes'
    const loaded = { tables: { store_email_templates: [{ id: '7', subject: 'Private subject' }] } } as LoadedSource
    const disposition = { table: 'store_email_templates', sourceId: '7', storeId: '205', record: 1,
      disposition: 'mapped', fields: { subject: 'mapped' },
      contributions: [{ targetPath: '@email-template-settings:store_email_templates:7',
        rule: 'master-email', fields: ['subject'] }] } as RowDisposition
    const source = sourceEvidenceRow(loaded, disposition, key)
    const email: VerifiedTarget = { sourceEntity: 'store_email_templates', sourceId: '7',
      targetCollection: 'email-template-settings', targetId: '71',
      projection: { contentEn: { subject: 'Private subject' } } }
    const result = compareSourceRow(source, targetIndex([email]), key)[0]
    expect(result.comparisonStatus).toBe('match')
    expect(result.sourceDisplay).toBeNull()
    expect(result.targetDisplay).toBeNull()
    expect(JSON.stringify(result)).not.toContain('Private subject')
  })
})
