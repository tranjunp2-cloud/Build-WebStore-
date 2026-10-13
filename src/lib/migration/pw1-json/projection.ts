import { z } from 'zod'
import { createHash } from 'node:crypto'
import { normalizeDashboardBlocks } from '../../dashboard-utils'
import type { Field, SanitizedCollectionConfig } from 'payload'
import type { ImportStore, ImportDocument, CollectionName } from './types'
import { NULLIFIED_ROOT_CREATOR_REF } from './creator-policy'

export const WRITABLE = new Set<CollectionName>(['tenants', 'users', 'sites', 'media', 'categories', 'products', 'customers', 'discounts', 'orders', 'discount_usage_history', 'blog_categories', 'blogs', 'email-template-settings', 'plan-subscriptions', 'plan-subscription-usages'])
const FORBIDDEN = new Set(['password', 'hash', 'salt', 'keyString', 'key_string', 'resetPasswordToken', 'resetPasswordExpiration', '_verified', 'apiKey', 'enableAPIKey'])
export interface Reference { ref: string; collection: string; required: boolean; path: string; externalActor?: true }
export interface Entity {
  ref: string
  collection: CollectionName
  sourceEntity: string
  sourceId: string
  storeId: string
  data: ImportDocument
  refs: Reference[]
  sourceChecksum: string
  /** Operator-approved source creator policy; never read from caller-provided fields. */
  preserveInvalidEmail?: true
  nullifiedCreatorRef?: typeof NULLIFIED_ROOT_CREATOR_REF
}
export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
export function checksum(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex') }
export function sourceKey(ref: string, collection: CollectionName): { sourceEntity: string; sourceId: string } {
  if (/[\s\u0000-\u001f]/.test(ref)) throw new Error('INVALID_SOURCE_REFERENCE')
  const parts = ref.split(':')
  if (parts[0] !== `@${collection}` || parts.length < 3 || parts.slice(1).some(part => !part)) throw new Error('INVALID_SOURCE_REFERENCE')
  const namespaces: Partial<Record<CollectionName, readonly string[]>> = { tenants: ['stores'], users: ['users'], sites: ['stores', 'sites'], media: ['medias', 'media', 'stores', 'store_logo', 'store_favicon', 'product_images', 'product_sku_images', 'blog_posts', 'blog_posts_content'], categories: ['categories'], products: ['products'], customers: ['customers'], discounts: ['promotion_codes'], orders: ['orders'], blog_categories: ['blog_categories'], blogs: ['blog_posts'], 'email-template-settings': ['store_email_templates'], 'plan-subscriptions': ['plan_subscriptions'], 'plan-subscription-usages': ['plan_subscription_usages'], discount_usage_history: ['discount_usage_history', 'promotion_code_usages'] }
  if (!namespaces[collection]?.includes(parts[1])) throw new Error('SOURCE_NAMESPACE_UNSUPPORTED')
  let sourceEntity = parts[1]
  let sourceId = parts.slice(2).join(':')
  if (collection === 'sites' && sourceEntity === 'stores') sourceEntity = 'sites'
  if (collection === 'media' && sourceEntity === 'medias') sourceEntity = 'media'
  // A blog row emits both a Blog and its thumbnail; ledger source keys must differ.
  if (collection === 'media' && sourceEntity === 'blog_posts') sourceEntity = 'blog_post_thumbnail'
  if (collection === 'media' && sourceEntity === 'stores') {
    const last = parts.at(-1)
    if (last !== 'logo' && last !== 'favicon') throw new Error('MEDIA_SOURCE_NAMESPACE_UNSUPPORTED')
    sourceEntity = `store_${last}`
    sourceId = parts.slice(2, -1).join(':')
  }
  return { sourceEntity, sourceId }
}
function namedFields(fields: Field[]): Map<string, Field> {
  const map = new Map<string, Field>()
  for (const field of fields) {
    if ('name' in field && field.name) map.set(field.name, field)
    else if ('fields' in field) for (const [name, nested] of namedFields(field.fields)) map.set(name, nested)
    else if ('tabs' in field) for (const tab of field.tabs) {
      if ('name' in tab && tab.name) map.set(tab.name, { name: tab.name, type: 'group', fields: tab.fields })
      else for (const [name, nested] of namedFields(tab.fields)) map.set(name, nested)
    }
  }
  return map
}
function stableChildId(namespace: string): string {
  const hex = checksum(namespace).slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}

/** Select schema-declared fields, rejecting unknown business keys rather than silently discarding them. */
export function buildEntities(store: ImportStore, collections: Record<string, SanitizedCollectionConfig>, namespace: string, externalActorRefs: ReadonlySet<string> = new Set(), preserveInvalidUserEmails = false, delegateRawPageContent = false, delegateRawModelSettings = false): Entity[] {
  const entities: Entity[] = []
  const seen = new Set<string>()
  for (const [slug, records] of Object.entries(store.collections)) {
    if (slug === 'pages') continue
    if (!WRITABLE.has(slug as CollectionName)) {
      if (records.length) throw new Error('UNSUPPORTED_NONEMPTY_COLLECTION')
      continue
    }
    const config = collections[slug]
    if (!config) throw new Error('TARGET_COLLECTION_MISSING')
    for (const document of records) {
      if (typeof document._ref !== 'string' || seen.has(document._ref)) throw new Error('DUPLICATE_OR_MISSING_REFERENCE')
      if (externalActorRefs.has(document._ref)) throw new Error('CREATOR_BUSINESS_IDENTITY_OVERLAP')
      seen.add(document._ref)
      const entity: Entity = { ref: document._ref, collection: slug as CollectionName, ...sourceKey(document._ref, slug as CollectionName), storeId: store.storeId, data: {}, refs: [], sourceChecksum: '' }
      const source: ImportDocument = { ...document }
      delete source._ref
      // Payload auth normalizes email before persistence; checksums and unique checks must use the same value.
      if (slug === 'users' && typeof source.email === 'string') {
        if (preserveInvalidUserEmails && !z.string().email().safeParse(source.email).success) entity.preserveInvalidEmail = true
        else source.email = source.email.toLowerCase().trim()
      }
      // PW1 root creator has no corresponding PW2 account. Preserve the source
      // artifact, but persist an explicit null (not an omitted field/default).
      if (slug === 'users' && source.createdBy === NULLIFIED_ROOT_CREATOR_REF) {
        source.createdBy = null
        entity.nullifiedCreatorRef = NULLIFIED_ROOT_CREATOR_REF
      }
      // Legacy JSON objects are not a PW2 block list. Preserve valid lists and
      // leave the source artifact untouched; normalize only the target projection.
      if (slug === 'tenants' && object(source.settings) && source.settings.dashboardPreferences != null && !Array.isArray(source.settings.dashboardPreferences)) {
        source.settings = { ...source.settings, dashboardPreferences: normalizeDashboardBlocks(source.settings.dashboardPreferences) }
      }
      // Historical unknown payment method must remain null, never receive an app default.
      if (slug === 'orders' && !('paymentMethod' in source) && namedFields(config.fields).has('paymentMethod')) source.paymentMethod = null
      if (slug === 'sites') { delete source.pw1_source; delete source.menus; if(delegateRawPageContent)delete source.raw_frontend_template; if(delegateRawModelSettings)delete source.raw_model_settings }
      entity.data = inspectFields(source, config.fields, entity, namespace, '')
      entity.sourceChecksum = checksum(entity.data)
      entities.push(entity)
    }
  }
  const byRef = new Map(entities.map(entity => [entity.ref, entity]))
  const tenant = entities.find(entity => entity.collection === 'tenants')
  const site = entities.find(entity => entity.collection === 'sites')
  if (!tenant || !site || entities.filter(entity => entity.collection === 'tenants').length !== 1 || entities.filter(entity => entity.collection === 'sites').length !== 1) throw new Error('STORE_FOUNDATION_INVALID')
  if (tenant.sourceId !== store.storeId || site.sourceId !== store.storeId || site.data.tenant !== tenant.ref) throw new Error('STORE_OWNERSHIP_INVALID')
  for (const entity of entities) {
    for (const relation of entity.refs) {
      const destination = byRef.get(relation.ref)
      if (!destination && entity.collection === 'users' && relation.path === 'createdBy' && relation.collection === 'users' && externalActorRefs.has(relation.ref)) {
        relation.required = true
        relation.externalActor = true
        continue
      }
      if (!destination || destination.collection !== relation.collection) throw new Error('UNRESOLVED_OR_CROSS_STORE_REFERENCE')
    }
    if ('tenant' in entity.data && entity.data.tenant !== tenant.ref) throw new Error('TENANT_OWNERSHIP_INVALID')
    if (entity.data.site != null && entity.data.site !== site.ref) throw new Error('SITE_OWNERSHIP_INVALID')
    if (entity.collection === 'users') {
      if (!Array.isArray(entity.data.roles) || !entity.data.roles.length || entity.data.roles.includes('super-admin')) throw new Error('USER_ROLE_NOT_ALLOWED')
      const memberships = entity.data.tenants
      if (!Array.isArray(memberships) || memberships.length !== 1 || memberships.some(row => !object(row) || row.tenant !== tenant.ref)) throw new Error('USER_MEMBERSHIP_SCOPE_INVALID')
    }
    if (entity.collection === 'categories') {
      const ancestors = new Set([entity.ref])
      let parent = entity.data.parent
      while (typeof parent === 'string') {
        if (ancestors.has(parent) || ancestors.size >= 3) throw new Error('CATEGORY_TREE_INVALID')
        ancestors.add(parent)
        const record = byRef.get(parent)
        if (!record || record.data.deletedAt) throw new Error('CATEGORY_PARENT_INVALID')
        parent = record.data.parent
      }
    }
  }
  return entities
}

function inspectFields(data: ImportDocument, fields: Field[], entity: Entity, namespace: string, path: string, arrayRow = false): ImportDocument {
  const definitions = namedFields(fields)
  const result: ImportDocument = {}
  for (const [key, value] of Object.entries(data)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key) || FORBIDDEN.has(key)) throw new Error('FORBIDDEN_INPUT_FIELD')
    if (key === 'id' && arrayRow) {
      if (typeof value !== 'string' || !value) throw new Error('ARRAY_ID_INVALID')
      result.id = value
      continue
    }
    if (['createdAt', 'updatedAt'].includes(key) && !path) {
      result[key] = historicalDate(value, 'SOURCE_TIMESTAMP_INVALID')
      continue
    }
    const field = definitions.get(key)
    if (!field || field.type === 'ui' || field.type === 'join') throw new Error('UNKNOWN_INPUT_FIELD')
    const fieldPath = path ? `${path}.${key}` : key
    if (value === null) {
      if ('required' in field && field.required) throw new Error('REQUIRED_FIELD_NULL')
      result[key] = null
      continue
    }
    if (field.type === 'relationship' || field.type === 'upload') {
      const values = 'hasMany' in field && field.hasMany ? value : [value]
      if (!Array.isArray(values)) throw new Error('RELATIONSHIP_ARRAY_INVALID')
      for (const item of values) {
        if (typeof item !== 'string' || !item.startsWith('@')) throw new Error('RELATIONSHIP_REFERENCE_REQUIRED')
        const targetCollection = item.slice(1).split(':')[0]
        const allowed = Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo]
        if (!allowed.includes(targetCollection as never)) throw new Error('RELATIONSHIP_COLLECTION_INVALID')
        entity.refs.push({ ref: item, collection: targetCollection, required: Boolean(field.required) || (entity.collection === 'categories' && fieldPath === 'parent'), path: fieldPath })
      }
    } else if (field.type === 'group') {
      if (!object(value)) throw new Error('GROUP_INVALID')
      result[key] = inspectFields(value, field.fields, entity, namespace, fieldPath)
      continue
    } else if (field.type === 'array') {
      if (!Array.isArray(value) || (field.maxRows != null && value.length > field.maxRows) || (field.minRows != null && value.length < field.minRows)) throw new Error('ARRAY_INVALID')
      const ids = new Set<string>()
      result[key] = value.map((row, index) => {
        if (!object(row)) throw new Error('ARRAY_ROW_INVALID')
        const output = inspectFields(row, field.fields, entity, namespace, `${fieldPath}.${index}`, true)
        const id = typeof output.id === 'string' ? output.id : stableChildId(`${namespace}:${entity.ref}:${fieldPath}:${index}`)
        if (ids.has(id)) throw new Error('DUPLICATE_ARRAY_ID')
        ids.add(id)
        return { ...output, id }
      })
      continue
    } else if (field.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || (field.min != null && value < field.min) || (field.max != null && value > field.max)) throw new Error('NUMBER_INVALID')
      if (entity.collection === 'discounts' && key === 'value' && ((data.type === 'fixed' && !Number.isSafeInteger(value)) || (data.type === 'percentage' && value > 100))) throw new Error('DISCOUNT_VALUE_INVALID')
      if (['quantity', 'inventory', 'stock', 'usageCount', 'usageLimit', 'used', 'discountAmount', 'amountApplied'].includes(key) && !Number.isSafeInteger(value)) throw new Error('INTEGER_REQUIRED')
    } else if (field.type === 'select' || field.type === 'radio') {
      const options = field.options.map(option => typeof option === 'string' ? option : option.value)
      const values = 'hasMany' in field && field.hasMany ? value : [value]
      if (!Array.isArray(values) || values.some(item => !options.includes(item))) throw new Error('ENUM_INVALID')
    } else if (field.type === 'checkbox' && typeof value !== 'boolean') throw new Error('BOOLEAN_REQUIRED')
    else if (field.type === 'date') {
      result[key] = historicalDate(value, 'DATE_INVALID')
      continue
    } else if (['text', 'textarea', 'email'].includes(field.type) && typeof value !== 'string') throw new Error('STRING_REQUIRED')
    else if (field.type === 'richText') {
      if (!object(value) || !object(value.root) || value.root.type !== 'root' || !Array.isArray(value.root.children)) throw new Error('RICH_TEXT_ROOT_INVALID')
      inspectRichText(value, entity, fieldPath)
    }
    if (entity.collection === 'media' && ['url', 'sourceUrl'].includes(key)) {
      if (typeof value !== 'string') throw new Error('MEDIA_URL_INVALID')
      let url: URL
      try { url = new URL(value) } catch { throw new Error('MEDIA_URL_INVALID') }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('MEDIA_URL_INVALID')
    }
    result[key] = value
  }
  for (const [key, field] of definitions) {
    if ('required' in field && field.required && !('defaultValue' in field && field.defaultValue !== undefined) && !(key in result)) {
      // Payload adds authentication email/password and other generated fields separately.
      if (key !== 'password') throw new Error('REQUIRED_FIELD_MISSING')
    }
  }
  return result
}
/** Source instants require an explicit offset and a real calendar day. */
function historicalDate(value: unknown, code: string): string {
  if (typeof value !== 'string') throw new Error(code)
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match) throw new Error(code)
  const [, year, month, day, hour, minute, second, offset] = match
  const y = Number(year), m = Number(month), d = Number(day)
  const date = new Date(0)
  date.setUTCFullYear(y, m - 1, d)
  date.setUTCHours(0, 0, 0, 0)
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || (offset !== 'Z' && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4, 6)) > 59)) || !Number.isFinite(Date.parse(value))) throw new Error(code)
  return new Date(value).toISOString()
}

function inspectRichText(value: unknown, entity: Entity, path: string): void {
  if (Array.isArray(value)) { value.forEach((item, i) => inspectRichText(item, entity, `${path}.${i}`)); return }
  if (!object(value)) return
  if (value.type === 'link' || value.type === 'autolink') {
    const fields = object(value.fields) ? value.fields : value
    const link = fields.url
    if (typeof link !== 'string' || !link || /[\\\u0000-\u0020\u007f]/.test(link) || link.startsWith('//')) throw new Error('RICH_TEXT_LINK_INVALID')
    if (!link.startsWith('/') && !link.startsWith('#')) {
      let parsed: URL
      try { parsed = new URL(link) } catch { throw new Error('RICH_TEXT_LINK_INVALID') }
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('RICH_TEXT_LINK_INVALID')
    }
  }
  if (value.type === 'upload') {
    if (value.relationTo !== 'media' || typeof value.value !== 'string' || !value.value.startsWith('@media:')) throw new Error('RICH_TEXT_UPLOAD_INVALID')
    entity.refs.push({ ref: value.value, collection: 'media', required: true, path: `${path}.value` })
  }
  for (const [key, item] of Object.entries(value)) inspectRichText(item, entity, `${path}.${key}`)
}

/** References are replaced only at schema-discovered paths; raw/text strings are never interpreted. */
export function resolveData(entity: Entity, targets: ReadonlyMap<string, string | number>, allowDeferred = false): { data: ImportDocument; deferred: boolean } {
  const data: ImportDocument = structuredClone(entity.data)
  let deferred = false
  const groups = new Map<string, Reference[]>()
  for (const relation of entity.refs) {
    const group = groups.get(relation.path) ?? []
    group.push(relation)
    groups.set(relation.path, group)
  }
  for (const [path, relations] of groups) {
    const parts = path.split('.')
    let owner: Record<string, unknown> | unknown[] = data
    for (const part of parts.slice(0, -1)) {
      const next: unknown = (owner as Record<string, unknown>)[part]
      if (!object(next) && !Array.isArray(next)) throw new Error('RELATIONSHIP_PATH_INVALID')
      owner = next
    }
    const key = parts.at(-1)!
    const value = (owner as Record<string, unknown>)[key]
    const missing = relations.filter(relation => targets.get(relation.ref) === undefined)
    if (missing.length) {
      if (!allowDeferred || missing.some(relation => relation.required)) throw new Error('RELATIONSHIP_NOT_READY')
      // Defer the whole hasMany field; never turn a partially resolved array into a scalar.
      delete (owner as Record<string, unknown>)[key]
      deferred = true
      continue
    }
    const mapped = new Map(relations.map(relation => [relation.ref, targets.get(relation.ref)!]))
    if (Array.isArray(value)) (owner as Record<string, unknown>)[key] = value.map(item => typeof item === 'string' && mapped.has(item) ? mapped.get(item) : item)
    else (owner as Record<string, unknown>)[key] = mapped.get(relations[0].ref)
  }
  return { data, deferred }
}

/** Compare only mapped fields; arrays preserve row identity/order, null and empty arrays are schema-equivalent. */
export function projectionMatches(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected)) {
    if (!expected.length && actual == null) return true
    return Array.isArray(actual) && expected.length === actual.length && expected.every((item, i) => projectionMatches(item, actual[i]))
  }
  if (object(expected)) return object(actual) && Object.entries(expected).every(([key, value]) => projectionMatches(value, actual[key]))
  if (expected === null) return actual == null
  return expected === actual
}

/** Discharge only a proven root-creator normalization or a resolved actor binding. */
export function creatorDiagnosticResolved(entity: Entity, targets: ReadonlyMap<string, number>): boolean {
  if (entity.collection !== 'users') return false
  if (entity.nullifiedCreatorRef === NULLIFIED_ROOT_CREATOR_REF && entity.data.createdBy === null) return true
  return entity.refs.some(ref => ref.path === 'createdBy' && ref.externalActor && targets.has(ref.ref))
}


/** Legacy dashboard objects render as the default block list; compare that same view without rewriting DB. */
export function targetProjectionMatches(expected: unknown, actual: unknown): boolean {
  if (object(expected) && object(actual) && object(expected.settings) && object(actual.settings)
      && Array.isArray(expected.settings.dashboardPreferences) && object(actual.settings.dashboardPreferences)) {
    return projectionMatches(expected, { ...actual, settings: { ...actual.settings,
      dashboardPreferences: normalizeDashboardBlocks(actual.settings.dashboardPreferences) } })
  }
  return projectionMatches(expected, actual)
}
