import { createHash, createHmac } from 'node:crypto'
import { sourceDiscountMinorUnits } from '../pw2-commerce-reconciliation.mjs'
import type { SourceEvidenceRow } from '../pw1-export/source-evidence'
import { QC_FIELD_BY_KEY, QC_FIELD_REGISTRY } from './qc-field-registry'

export const EVIDENCE_CONTRACT_VERSION = 'field-evidence-v26'
export const EVIDENCE_STATUSES = ['match','mismatch','missing','duplicate','unsupported','unverified'] as const
export type EvidenceStatus = typeof EVIDENCE_STATUSES[number]

export type VerifiedTarget = {
  sourceEntity: string
  sourceId: string
  targetCollection: string
  targetId: string
  projection: Record<string, unknown>
  projectionChecksum?: string
}

export type FieldResult = {
  sourceEntity: string
  sourceId: string
  sourceRecordNo: number
  sourceDisposition: SourceEvidenceRow['disposition']
  sourceField: string
  elementKey: string
  targetCollection: string | null
  targetId: string | null
  targetClaims: Array<{ collection: string; id: string; projectionChecksum?: string }>
  targetField: string | null
  comparisonStatus: EvidenceStatus
  reasonCode: string
  sourceDisplay: string | null
  targetDisplay: string | null
  sourceNormalized: string | null
  targetNormalized: string | null
  sourceFingerprint: string | null
  targetFingerprint: string | null
  targetProjectionChecksum: string | null
  transformCode: string
}

type Rule = { targetField: string; transform: 'same' | 'trim' | 'product-status' | 'order-status' | 'payment-status' | 'money-major' | 'money-target-minor' | 'stock-on-hand' | 'stock-unapproved' | 'category-crosswalk' | 'weight-kg' | 'weight-unit' | 'dimension-cm' | 'source-currency' | 'image-count' | 'image-identity' | 'discount-type' | 'discount-value' | 'discount-status' | 'discount-code' | 'address-count' | 'payment-method' | 'email-enabled' | 'quantity' }

const RULES: Readonly<Record<string, Rule>> = Object.freeze({
  'products.name': { targetField: 'name', transform: 'trim' },
  'products.slug': { targetField: 'slug', transform: 'trim' },
  'products.status': { targetField: 'status', transform: 'product-status' },
  'products.category_id': { targetField: 'category', transform: 'category-crosswalk' },
  'products.package_weight': { targetField: 'weight', transform: 'weight-kg' },
  'products.package_weight_type': { targetField: 'weight', transform: 'weight-unit' },
  'products.package_length': { targetField: 'dimensions.length', transform: 'dimension-cm' },
  'products.package_width': { targetField: 'dimensions.width', transform: 'dimension-cm' },
  'products.package_height': { targetField: 'dimensions.height', transform: 'dimension-cm' },
  'products.currency': { targetField: 'currency', transform: 'source-currency' },
  'products.image_count': { targetField: 'images', transform: 'image-count' },
  'products.image_identity': { targetField: 'images', transform: 'image-identity' },
  'product_skus.sku': { targetField: 'sku', transform: 'trim' },
  'product_skus.price': { targetField: 'price', transform: 'money-major' },
  'product_skus.stock': { targetField: 'stock', transform: 'stock-on-hand' },
  'product_skus.reserved': { targetField: 'reserved', transform: 'stock-unapproved' },
  'product_skus.available': { targetField: 'available', transform: 'stock-unapproved' },
  'orders.code': { targetField: 'orderNumber', transform: 'same' },
  'orders.currency_id': { targetField: 'currency', transform: 'source-currency' },
  'orders.payment_method_id': { targetField: 'paymentMethod', transform: 'payment-method' },
  'orders.sub_total': { targetField: 'subtotal', transform: 'money-major' },
  'orders.total_discount': { targetField: 'discountAmount', transform: 'money-target-minor' },
  'orders.total_shipping': { targetField: 'shippingFee', transform: 'money-major' },
  'orders.total_tax': { targetField: 'tax', transform: 'money-major' },
  'orders.total': { targetField: 'total', transform: 'money-major' },
  'orders.status': { targetField: 'status', transform: 'order-status' },
  'orders.purchase_status': { targetField: 'paymentStatus', transform: 'payment-status' },
  'order_details.quantity': { targetField: 'quantity', transform: 'quantity' },
  'order_details.price': { targetField: 'unitPrice', transform: 'money-major' },
  'promotion_codes.code': { targetField: 'code', transform: 'discount-code' },
  'promotions.discount_type_id': { targetField: 'type', transform: 'discount-type' },
  'promotions.discount_value': { targetField: 'value', transform: 'discount-value' },
  'promotions.status': { targetField: 'status', transform: 'discount-status' },
  'customers.address_count': { targetField: 'addresses', transform: 'address-count' },
  'customers.email': { targetField: 'email', transform: 'same' },
  'store_email_templates.status': { targetField: 'enabled', transform: 'email-enabled' },
  'store_email_templates.subject': { targetField: 'contentEn.subject', transform: 'same' },
  'categories.name': { targetField: 'name', transform: 'same' },
  'categories.slug': { targetField: 'slug', transform: 'same' },
})
for (const field of QC_FIELD_REGISTRY) {
  if (field.support === 'compare' && !RULES[field.key]) throw new Error(`QC_FIELD_RULE_MISSING:${field.key}`)
}

const ORDER_STATUS: Record<string, string> = { '1':'pending','2':'pending','3':'ready_to_ship','4':'shipped','5':'completed','6':'cancelled','8':'payment_failed' }
const PAYMENT_STATUS: Record<string, string> = { '1':'paid','2':'awaiting_payment','3':'failed','4':'payment_failed' }
const PRIVATE_SOURCE = new Set(['orders.code','customers.name','customers.email','customers.phone',
  'promotion_codes.code','store_email_templates.subject'])

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function pathValue(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (Array.isArray(current)) {
      if (/^\d+$/.test(key)) return current[Number(key)]
      return current.find(item => object(item) && String(item.id) === key)
    }
    return object(current) ? current[key] : undefined
  }, value)
}

function targetRef(value: string): { collection: string; sourceEntity: string; sourceId: string; fieldPrefix: string } | null {
  const match = /^@([a-z_-]+):([a-z_]+):([1-9]\d*)(?:\.(.*))?$/.exec(value)
  return match ? { collection: match[1], sourceEntity: match[2], sourceId: match[3], fieldPrefix: match[4] ?? '' } : null
}

function targetKey(target: Pick<VerifiedTarget, 'targetCollection' | 'sourceEntity' | 'sourceId'>): string {
  return `${target.targetCollection}\0${target.sourceEntity}\0${target.sourceId}`
}

function safeText(value: unknown, privateField: boolean): string | null {
  if (privateField || value === undefined || value === null) return null
  const text = String(value)
  return text.length <= 240 && !/[\u0000-\u001f\u007f]/.test(text) ? text : null
}

function hmac(key: string | undefined, sourceKey: string, value: unknown): string | null {
  if (!key || value === undefined) return null
  const [table, field] = sourceKey.split('.')
  const canonical = value === null ? null : sourceKey === 'customers.email'
    ? String(value).trim().toLowerCase() : String(value)
  return createHmac('sha256', key).update(JSON.stringify([table, field, canonical])).digest('hex')
}

function canonicalSource(value: string, rule: Rule, currency: string | undefined): string | null {
  if (rule.transform === 'quantity') return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) &&
    Number(value) >= 1 ? String(Number(value)) : null
  if (rule.transform === 'stock-on-hand') return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? String(Number(value)) : null
  if (rule.transform === 'trim') return value.trim()
  if (rule.transform === 'product-status') return value === '1' ? 'active' : value === '0' ? 'draft' : null
  if (rule.transform === 'order-status') return ORDER_STATUS[value] ?? null
  if (rule.transform === 'payment-status') return PAYMENT_STATUS[value] ?? null
  if (rule.transform === 'money-major' || rule.transform === 'money-target-minor') {
    if (!currency) return null
    try { return String(sourceDiscountMinorUnits(value, currency)) } catch { return null }
  }
  return value
}

function canonicalTarget(value: unknown, rule: Rule, currency: string | undefined): string | null {
  if (value === undefined || value === null) return null
  if (rule.transform === 'quantity') return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= 1 ? String(value) : null
  if (rule.transform === 'stock-on-hand') return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : null
  if (rule.transform === 'money-target-minor') {
    if (!currency || !Number.isSafeInteger(value) || Number(value) < 0) return null
    return String(value)
  }
  if (rule.transform === 'money-major') {
    if (!currency) return null
    try { return String(sourceDiscountMinorUnits(value, currency)) } catch { return null }
  }
  return String(value)
}

/** Compare only a verified ledger projection with a hash-bound source row. */
export function compareSourceRow(
  row: SourceEvidenceRow,
  targets: ReadonlyMap<string, VerifiedTarget>,
  hmacKey?: string,
  confirmedAbsentTargets: ReadonlySet<string> = new Set(),
  includeRequiredRegistryFields = false,
  sourceCurrency?: string,
  sourceImages?: readonly { sourceId: string; targetId: string | null }[],
  sourceAddressCount?: number,
  sourcePaymentMethod?: string,
  verifiedTargetGroups?: ReadonlyMap<string, readonly VerifiedTarget[]>,
): FieldResult[] {
  const fields = { ...row.fields }
  if (includeRequiredRegistryFields) {
    for (const required of QC_FIELD_REGISTRY) {
      const [entity, fieldName] = required.key.split('.')
      if (entity === row.table && !(fieldName in fields)) {
        fields[fieldName] = entity === 'products' && fieldName === 'currency' && sourceCurrency
          ? { presence: 'value', display: sourceCurrency, fingerprint: null, disposition: 'mapped' }
          : entity === 'products' && fieldName === 'image_count' && sourceImages
          ? { presence: 'value', display: String(sourceImages.length), fingerprint: null, disposition: 'mapped' }
          : entity === 'products' && fieldName === 'image_identity' && sourceImages
          ? { presence: 'value', display: String(sourceImages.length), fingerprint: null, disposition: 'mapped' }
          : entity === 'customers' && fieldName === 'address_count' && sourceAddressCount !== undefined
          ? { presence: 'value', display: String(sourceAddressCount), fingerprint: null, disposition: 'mapped' }
          : { presence: 'absent', display: null, fingerprint: null, disposition: 'unverified' }
      }
    }
  }
  return Object.entries(fields).map(([fieldName, field]): FieldResult => {
    const sourceKey = `${row.table}.${fieldName}`
    const rule = RULES[sourceKey]
    const required = QC_FIELD_BY_KEY.get(sourceKey)
    const basic: FieldResult = {
      sourceEntity: row.table, sourceId: row.sourceId, sourceRecordNo: row.record,
      sourceDisposition: row.disposition,
      sourceField: fieldName, elementKey: '', targetCollection: null, targetId: null,
      targetClaims: [],
      targetField: rule?.targetField ?? null, comparisonStatus: 'unverified',
      reasonCode: 'EVIDENCE_INCOMPLETE', sourceDisplay: field.display,
      targetDisplay: null, sourceNormalized: null, targetNormalized: null,
      sourceFingerprint: field.fingerprint, targetFingerprint: null,
      targetProjectionChecksum: null,
      transformCode: rule?.transform ?? 'none',
    }
    if (row.disposition === 'unresolved') return { ...basic, reasonCode: 'SOURCE_ROW_UNRESOLVED' }
    if (row.disposition !== 'mapped' && row.disposition !== 'partial') {
      return { ...basic, comparisonStatus: 'unsupported', reasonCode: 'SOURCE_NOT_EMITTED' }
    }
    if (required?.support === 'unsupported') return { ...basic, comparisonStatus: 'unsupported', reasonCode: required.reason }
    if (required?.support === 'unverified') return { ...basic, reasonCode: required.reason }
    if (field.presence === 'absent') return { ...basic, reasonCode: 'SOURCE_FIELD_ABSENT' }
    if (field.disposition === 'unresolved') return { ...basic, reasonCode: 'SOURCE_FIELD_UNRESOLVED' }
    if (field.disposition === 'unverified') return { ...basic, reasonCode: 'SOURCE_FIELD_DISPOSITION_UNVERIFIED' }
    if (field.disposition !== 'mapped') return { ...basic, comparisonStatus: 'unsupported', reasonCode: 'FIELD_NOT_MIGRATED' }
    if (!rule) return { ...basic, comparisonStatus: 'unsupported', reasonCode: 'FIELD_RULE_UNSUPPORTED' }
    if (rule.transform === 'stock-unapproved') return { ...basic, reasonCode: 'STOCK_LOCATION_RULE_UNAPPROVED' }
    const refs = row.targetPaths.filter(path => path.fields.includes(fieldName) ||
      (sourceKey === 'products.package_weight_type' && path.fields.includes('package_weight')) ||
      (['products.currency','products.image_count','products.image_identity'].includes(sourceKey) &&
        path.path.startsWith('@products:products:')) ||
      (sourceKey === 'customers.address_count' && path.path.startsWith('@customers:customers:')))
      .map(path => targetRef(path.path)).filter((path): path is NonNullable<typeof path> => path !== null)
    const claims: Array<{ ref: (typeof refs)[number]; target: VerifiedTarget | undefined }> = []
    for (const ref of refs) {
      const key = [ref.collection, ref.sourceEntity, ref.sourceId].join('\0')
      const singleTarget = targets.get(key)
      const candidates = verifiedTargetGroups?.get(key) ?? (singleTarget ? [singleTarget] : [])
      if (candidates.length) {
        for (const target of candidates) claims.push({ ref, target })
      } else {
        claims.push({ ref, target: undefined })
      }
    }
    if (!claims.length) return { ...basic, reasonCode: 'MAPPING_PROVENANCE_MISSING' }
    const mapped = claims.filter((claim): claim is { ref: typeof claim.ref; target: VerifiedTarget } => claim.target !== undefined)
    if (!mapped.length) {
      const proven = claims.length > 0 && claims.every(claim => confirmedAbsentTargets.has(
        `${claim.ref.collection}\0${claim.ref.sourceEntity}\0${claim.ref.sourceId}`)) ? claims[0] : undefined
      return proven
        ? { ...basic, targetCollection: proven.ref.collection, comparisonStatus: 'missing',
            reasonCode: 'CONFIRMED_TARGET_RECORD_ABSENT' }
        : { ...basic, reasonCode: 'TARGET_CLAIM_MISSING' }
    }
    const targetClaims = [...new Map(mapped.map(claim => [
      `${claim.target.targetCollection}\0${claim.target.targetId}`,
      { collection: claim.target.targetCollection, id: claim.target.targetId,
        ...(claim.target.projectionChecksum ? { projectionChecksum: claim.target.projectionChecksum } : {}) },
    ])).values()].sort((a,b) => a.collection.localeCompare(b.collection) || a.id.localeCompare(b.id))
    if (targetClaims.length > 1) {
      return { ...basic, targetClaims, comparisonStatus: 'duplicate', reasonCode: 'MULTIPLE_VERIFIED_TARGETS' }
    }
    const claim = mapped[0]
    const stockField = sourceKey === 'product_skus.stock' && !claim.ref.fieldPrefix ? 'inventory' : rule.targetField
    const resolvedField = rule.transform === 'payment-method' && sourcePaymentMethod === 'stripe'
      ? 'paymentProvider' : stockField
    const targetField = [claim.ref.fieldPrefix, resolvedField].filter(Boolean).join('.')
    const targetValue = pathValue(claim.target.projection, targetField)
    const currency = typeof claim.target.projection.currency === 'string' ? claim.target.projection.currency : undefined
    const privateField = PRIVATE_SOURCE.has(sourceKey)
    const targetFingerprint = hmac(hmacKey, sourceKey, targetValue)
    const result: FieldResult = {
      ...basic, targetCollection: claim.target.targetCollection, targetId: claim.target.targetId,
      targetClaims,
      targetField, elementKey: claim.ref.fieldPrefix,
      targetDisplay: safeText(targetValue, privateField), targetFingerprint,
      targetProjectionChecksum: claim.target.projectionChecksum ?? null,
    }
    if (rule.transform === 'payment-method' && !['cod','stripe'].includes(sourcePaymentMethod ?? '')) {
      return { ...result, targetDisplay: null, reasonCode: 'PAYMENT_METHOD_NOT_MAPPED' }
    }
    if (targetValue === undefined || (targetValue === null && field.presence === 'value')) {
      return { ...result, comparisonStatus: 'missing', reasonCode: 'VERIFIED_PROJECTION_FIELD_ABSENT' }
    }
    if (rule.transform === 'image-count' || rule.transform === 'image-identity') {
      if (!sourceImages || !Array.isArray(targetValue) ||
        !targetValue.every(image => object(image) &&
          (typeof image.image === 'number' || typeof image.image === 'string'))) {
        return { ...result, targetDisplay: null, reasonCode: 'IMAGE_PROJECTION_UNVERIFIED' }
      }
      const targetIds = targetValue.map(image => String((image as Record<string,unknown>).image)).sort()
      if (rule.transform === 'image-count') {
        const equal = sourceImages.length === targetIds.length
        return { ...result, targetDisplay: String(targetIds.length), comparisonStatus: equal ? 'match' : 'mismatch',
          sourceNormalized: String(sourceImages.length), targetNormalized: String(targetIds.length),
          reasonCode: equal ? 'IMAGE_COUNT_EQUAL' : 'IMAGE_COUNT_DIFFERENT' }
      }
      if (sourceImages.some(image => !image.targetId)) {
        return { ...result, targetDisplay: String(targetIds.length), reasonCode: 'IMAGE_MEDIA_CROSSWALK_UNAVAILABLE' }
      }
      const mappedIds = sourceImages.map(image => image.targetId!).sort()
      const equal = JSON.stringify(mappedIds) === JSON.stringify(targetIds)
      return { ...result, sourceDisplay: String(mappedIds.length), targetDisplay: String(targetIds.length),
        sourceFingerprint: createHash('sha256').update(JSON.stringify(mappedIds)).digest('hex'),
        targetFingerprint: createHash('sha256').update(JSON.stringify(targetIds)).digest('hex'),
        comparisonStatus: equal ? 'match' : 'mismatch',
        reasonCode: equal ? 'IMAGE_IDENTITY_EQUAL' : 'IMAGE_IDENTITY_DIFFERENT' }
    }
    if (rule.transform === 'address-count') {
      if (sourceAddressCount === undefined || !Array.isArray(targetValue)) {
        return { ...result, targetDisplay: null, reasonCode: 'ADDRESS_COUNT_SOURCE_OR_TARGET_UNVERIFIED' }
      }
      const equal = sourceAddressCount === targetValue.length
      return { ...result, targetDisplay: String(targetValue.length), comparisonStatus: equal ? 'match' : 'mismatch',
        sourceNormalized: String(sourceAddressCount), targetNormalized: String(targetValue.length),
        reasonCode: equal ? 'ADDRESS_COUNT_EQUAL' : 'ADDRESS_COUNT_DIFFERENT' }
    }
    if (rule.transform === 'payment-method') {
      const equal = targetValue === sourcePaymentMethod
      return { ...result, comparisonStatus: equal ? 'match' : 'mismatch',
        sourceNormalized: sourcePaymentMethod ?? null, targetNormalized: String(targetValue),
        reasonCode: equal ? 'PAYMENT_METHOD_EQUAL' : 'PAYMENT_METHOD_DIFFERENT',
        sourceDisplay: sourcePaymentMethod ?? null }
    }
    if (rule.transform === 'email-enabled') {
      if (!['0','1'].includes(field.display ?? '') || typeof targetValue !== 'boolean') {
        return { ...result, reasonCode: 'EMAIL_ENABLED_RULE_UNAVAILABLE' }
      }
      const equal = (field.display === '1') === targetValue
      return { ...result, comparisonStatus: equal ? 'match' : 'mismatch',
        sourceNormalized: String(field.display === '1'), targetNormalized: String(targetValue),
        reasonCode: equal ? 'EMAIL_ENABLED_EQUAL' : 'EMAIL_ENABLED_DIFFERENT' }
    }
    if (privateField) {
      if (!field.fingerprint || !targetFingerprint) return { ...result, reasonCode: 'SENSITIVE_HASH_UNAVAILABLE' }
      return { ...result, comparisonStatus: field.fingerprint === targetFingerprint ? 'match' : 'mismatch',
        reasonCode: field.fingerprint === targetFingerprint ? 'KEYED_VALUE_EQUAL' : 'KEYED_VALUE_DIFFERENT' }
    }
    const emptySourceTax = sourceKey === 'orders.total_tax' &&
      (field.presence === 'empty' || field.presence === 'null')
    if (field.display === null && !emptySourceTax) return { ...result, reasonCode: 'SOURCE_VALUE_NOT_DISPLAYABLE' }
    if (rule.transform === 'discount-type') {
      const sourceType = field.display === '1' ? 'percentage' : field.display === '2' ? 'fixed' : null
      if (!sourceType || typeof targetValue !== 'string') return { ...result, reasonCode: 'DISCOUNT_TYPE_UNVERIFIED' }
      const equal = sourceType === targetValue
      return { ...result, comparisonStatus: equal ? 'match' : 'mismatch',
        sourceNormalized: sourceType, targetNormalized: targetValue,
        reasonCode: equal ? 'DISCOUNT_TYPE_EQUAL' : 'DISCOUNT_TYPE_DIFFERENT' }
    }
    if (rule.transform === 'discount-status') {
      const sourceStatus = field.display === '1' ? 'active' : ['0','2'].includes(field.display ?? '') ? 'inactive' : null
      if (!sourceStatus || typeof targetValue !== 'string') return { ...result, reasonCode: 'DISCOUNT_STATUS_UNVERIFIED' }
      const equal = sourceStatus === targetValue
      return { ...result, comparisonStatus: equal ? 'match' : 'mismatch',
        sourceNormalized: sourceStatus, targetNormalized: targetValue,
        reasonCode: equal ? 'DISCOUNT_STATUS_EQUAL' : 'DISCOUNT_STATUS_DIFFERENT' }
    }
    if (rule.transform === 'discount-value') {
      const sourceType = row.fields.discount_type_id?.display
      let expected: number | null = null
      if (sourceType === '1' && /^\d+(?:\.\d+)?$/.test(field.display ?? '')) expected = Number(field.display)
      if (sourceType === '2' && sourceCurrency === 'MYR') {
        try { expected = sourceDiscountMinorUnits(field.display, sourceCurrency) } catch { /* invalid source value */ }
      }
      if (expected === null || !Number.isFinite(expected) || typeof targetValue !== 'number' ||
        !Number.isFinite(targetValue)) return { ...result, reasonCode: 'DISCOUNT_VALUE_RULE_UNAVAILABLE' }
      const equal = expected === targetValue
      return { ...result, comparisonStatus: equal ? 'match' : 'mismatch',
        sourceNormalized: String(expected), targetNormalized: String(targetValue),
        reasonCode: equal ? 'DISCOUNT_VALUE_EQUAL' : 'DISCOUNT_VALUE_DIFFERENT',
        sourceDisplay: String(expected), targetDisplay: String(targetValue) }
    }
    if (rule.transform === 'source-currency') {
      if (!sourceCurrency || !currency) return { ...result, reasonCode: 'CURRENCY_CROSSWALK_UNAVAILABLE' }
      return { ...result, sourceDisplay: sourceCurrency, comparisonStatus: sourceCurrency === currency ? 'match' : 'mismatch',
        sourceNormalized: sourceCurrency, targetNormalized: currency,
        reasonCode: sourceCurrency === currency ? 'CURRENCY_EQUAL' : 'CURRENCY_DIFFERENT' }
    }
    if (rule.transform === 'category-crosswalk') {
      const category = targets.get(`categories\0categories\0${field.display}`)
      if (!category) return { ...result, reasonCode: 'CATEGORY_CROSSWALK_UNAVAILABLE' }
      if (!Array.isArray(targetValue)) return { ...result, reasonCode: 'CATEGORY_TARGET_SHAPE_UNVERIFIED' }
      const actual = targetValue.map(String)
      const equal = actual.length === 1 && actual[0] === category.targetId
      return { ...result, comparisonStatus: equal ? 'match' : 'mismatch',
        sourceNormalized: category.targetId, targetNormalized: actual.join(','),
        reasonCode: equal ? 'CATEGORY_IDENTITY_EQUAL' : 'CATEGORY_IDENTITY_DIFFERENT',
        sourceDisplay: null, targetDisplay: null }
    }
    if (rule.transform === 'weight-kg' || rule.transform === 'weight-unit') {
      const unit = row.fields.package_weight_type?.display
      const sourceWeight = row.fields.package_weight?.display
      if (!['1','2'].includes(unit ?? '') || !sourceWeight ||
        !/^\d+(?:\.\d+)?$/.test(sourceWeight) ||
        typeof targetValue !== 'number' || !Number.isFinite(targetValue) || targetValue < 0) {
        return { ...result, reasonCode: 'WEIGHT_UNIT_OR_VALUE_UNVERIFIED' }
      }
      const sourceKg = unit === '2' ? Number(sourceWeight) / 1000 : Number(sourceWeight)
      const equal = sourceKg === targetValue
      return { ...result, comparisonStatus: equal ? 'match' : 'mismatch',
        sourceNormalized: String(sourceKg), targetNormalized: String(targetValue),
        reasonCode: rule.transform === 'weight-unit'
          ? equal ? 'WEIGHT_UNIT_EQUAL' : 'WEIGHT_UNIT_DIFFERENT'
          : equal ? 'NORMALIZED_VALUE_EQUAL' : 'NORMALIZED_VALUE_DIFFERENT' }
    }
    if (rule.transform === 'dimension-cm') {
      // The reviewed PW1 mapping defines package dimensions in cm. The source
      // package_dimension_type enum is retained for audit, not a conversion factor.
      if (!/^\d+(?:\.\d+)?$/.test(field.display ?? '') || typeof targetValue !== 'number' ||
        !Number.isFinite(targetValue) || targetValue < 0 ||
        !Number.isFinite(Number(field.display))) {
        return { ...result, reasonCode: 'DIMENSION_VALUE_UNVERIFIED' }
      }
      const sourceCm = Number(field.display)
      const equal = sourceCm === targetValue
      return { ...result, comparisonStatus: equal ? 'match' : 'mismatch',
        sourceNormalized: String(sourceCm), targetNormalized: String(targetValue),
        reasonCode: equal ? 'DIMENSION_CM_EQUAL' : 'DIMENSION_CM_DIFFERENT' }
    }
    if ((rule.transform === 'money-major' || rule.transform === 'money-target-minor') &&
      (!sourceCurrency || !currency)) return { ...result, reasonCode: 'CURRENCY_CROSSWALK_UNAVAILABLE' }
    if ((rule.transform === 'money-major' || rule.transform === 'money-target-minor') &&
      sourceCurrency !== currency) return { ...result, comparisonStatus: 'mismatch', reasonCode: 'CURRENCY_DIFFERENT' }
    const sourceCanonical = emptySourceTax ? '0'
      : sourceKey === 'orders.purchase_status' && row.fields.refund_status?.display === '1'
      ? 'refunded'
      : sourceKey === 'orders.purchase_status' && field.display === '' && sourcePaymentMethod === 'cod' &&
        !row.fields.refund_status?.display ? 'unpaid'
      : canonicalSource(field.display ?? '', rule, sourceCurrency)
    const targetCanonical = canonicalTarget(targetValue, rule, currency)
    if (sourceCanonical === null || targetCanonical === null) return { ...result, reasonCode: 'COMPARISON_RULE_UNAVAILABLE' }
    if (sourceKey === 'product_skus.sku' && sourceCanonical !== targetCanonical) {
      return { ...result, reasonCode: 'SKU_TRANSFORM_NOT_PROVEN' }
    }
    return { ...result, comparisonStatus: sourceCanonical === targetCanonical ? 'match' : 'mismatch',
      sourceNormalized: sourceCanonical, targetNormalized: targetCanonical,
      reasonCode: emptySourceTax
        ? sourceCanonical === targetCanonical ? 'ORDER_TAX_EMPTY_AS_ZERO_EQUAL' : 'ORDER_TAX_EMPTY_AS_ZERO_DIFFERENT'
        : sourceCanonical === targetCanonical ? 'NORMALIZED_VALUE_EQUAL' : 'NORMALIZED_VALUE_DIFFERENT' }
  })
}

export function targetIndex(targets: readonly VerifiedTarget[]): Map<string, VerifiedTarget> {
  const index = new Map(targets.map(target => [targetKey(target), target]))
  const sourceAliases: Readonly<Record<string,string>> = {
    media: 'product_images', discounts: 'promotion_codes',
    'email-template-settings': 'store_email_templates',
  }
  for (const target of targets) {
    const alias = sourceAliases[target.targetCollection]
    if (alias && target.sourceEntity === target.targetCollection) {
      const key = `${target.targetCollection}\0${alias}\0${target.sourceId}`
      if (index.has(key)) throw new Error('TARGET_SOURCE_ALIAS_COLLISION')
      index.set(key,target)
    }
  }
  return index
}
