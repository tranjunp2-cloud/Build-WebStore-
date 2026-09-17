import {
  live,
  type Doc,
  type Json,
  type MappingContext,
  type Row,
} from '../contracts'
import { RAW_FIELDS } from './raw-fields'
import { verifiedSetting } from './raw-setting-registry'
import { safeUrl } from '../primitives'
import { isSafeContentLink } from './content-link'
import { matchingRows, matchingSettings } from './raw-row-index'
import { rawStructureKeys, verifiedUiSettingKey } from './raw-ui-registry'

const sensitive =
  /password|passwd|secret|token|credential|authorization|api[_-]?key|private[_-]?key|cookie/i
const nestedKeys = new Set(
  'id type name label value key title text content children items settings config default width height color background backgroundColor fontSize fontFamily fontWeight textAlign position alignment display margin padding top bottom left right url href src alt target enabled status image button header subheader link size style class className icon code model_type model_id field description options selected image_url imageUrl value_ms label_ms name_ms en ms social facebook instagram twitter youtube tiktok whatsapp linkedin'.split(
    ' ',
  ),
)
type RawReason =
  | 'SECRET_CONTENT'
  | 'UNSAFE_URL'
  | 'UNKNOWN_STRUCTURE_KEY'
  | 'INVALID_JSON'
  | 'INVALID_VALUE_TYPE'
  | 'UNKNOWN_SETTING_KEY'
  | 'INVALID_SETTING_VALUE'
const navigationKeys = new Set(['url', 'href', 'link'])
function treeReason(
  value: unknown,
  extraKeys: ReadonlySet<string> = new Set(),
  navigation = false,
): RawReason | undefined {
  if (value === null || typeof value === 'boolean' || typeof value === 'number')
    return undefined
  if (typeof value === 'string') return textReason(value, navigation)
  if (Array.isArray(value)) {
    for (const item of value) {
      const reason = treeReason(item, extraKeys, navigation)
      if (reason) return reason
    }
    return undefined
  }
  if (typeof value !== 'object') return 'INVALID_VALUE_TYPE'
  for (const [key, item] of Object.entries(value)) {
    if (sensitive.test(key)) return 'SECRET_CONTENT'
    if (!nestedKeys.has(key) && !extraKeys.has(key))
      return 'UNKNOWN_STRUCTURE_KEY'
    const reason = treeReason(item, extraKeys, navigationKeys.has(key))
    if (reason) return reason
  }
  return undefined
}
function textReason(text: string, navigation = false): RawReason | undefined {
  if (
    /-----BEGIN .*PRIVATE KEY-----|(?:password|secret|token|api[_-]?key|authorization)\s*["']?\s*[:=]/i.test(
      text,
    )
  )
    return 'SECRET_CONTENT'
  // Only named navigation fields and href attributes get navigation URL policy.
  // Image/src fields and unclassified URLs retain the media allowlist.
  if (navigation && text && !isSafeContentLink(text)) return 'UNSAFE_URL'
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const prefix = text.slice(Math.max(0, (match.index ?? 0) - 16), match.index)
    if (navigation || /href\s*=\s*["']?$/i.test(prefix)) {
      if (!isSafeContentLink(match[0])) return 'UNSAFE_URL'
    } else {
      try {
        safeUrl(match[0])
      } catch {
        return 'UNSAFE_URL'
      }
    }
  }
  for (const match of text.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)) {
    if (!isSafeContentLink(match[2])) return 'UNSAFE_URL'
  }
  return undefined
}
/** Unknown serialized structures stay in the immutable source, never pass through blind. */
export function rawRow(
  ctx: MappingContext,
  table: string,
  row: Row,
  path: string,
): Doc {
  const out: Doc = {}
  const fields: string[] = []
  for (const [key, value] of Object.entries(row)) {
    if (!RAW_FIELDS[table]?.includes(key) || sensitive.test(key)) {
      ctx.issue(
        sensitive.test(key) ? 'RAW_SECRET_EXCLUDED' : 'RAW_FIELD_UNVERIFIED',
        table,
        row.id,
        key,
        sensitive.test(key) ? 'warning' : 'blocker',
      )
      continue
    }
    const navigation =
      navigationKeys.has(key) ||
      (table === 'model_settings' &&
        key === 'value' &&
        /^(url|href|link|items\.\d+\.url)$/.test(row.key ?? ''))
    const serialized = Boolean(value && /^[\s]*[\[{]/.test(value))
    let reason: RawReason | undefined =
      value === null || serialized ? undefined : textReason(value, navigation)
    if (serialized && value) {
      try {
        reason = treeReason(
          JSON.parse(value),
          rawStructureKeys(table, key),
          navigation,
        )
      } catch {
        reason = 'INVALID_JSON'
      }
    }
    if (table === 'model_settings' && key === 'value') {
      // PW1 addresses settings by key; descriptive metadata cannot authorize values.
      const settingKey = row.key ?? ''
      const verified = verifiedSetting(settingKey, value)
      if (
        [row.key, row.field, row.name].some(
          (part) => part && sensitive.test(part),
        )
      )
        reason = 'SECRET_CONTENT'
      else if (verified === false) reason = reason ?? 'INVALID_SETTING_VALUE'
      else if (verified === true) {
        // Verified setting validators fully validate their own grammar; never bypass text safety.
        reason = value === null ? undefined : textReason(value, navigation)
      } else if (
        !nestedKeys.has(settingKey) &&
        !verifiedUiSettingKey(settingKey, row.model_type ?? null)
      ) {
        reason = reason ?? 'UNKNOWN_SETTING_KEY'
      }
    }
    if (reason) {
      ctx.issue('RAW_VALUE_UNVERIFIED', table, row.id, key, 'blocker', reason)
      continue
    }
    out[key] = value
    fields.push(key)
  }
  ctx.contribute(table, row, fields, path, 'MASTER_RAW_ALLOWLIST')
  return out
}
export function sourceOrder(a: Row, b: Row): number {
  const pos = (row: Row) =>
    row.position != null &&
    row.position !== '' &&
    /^-?\d+(\.\d+)?$/.test(row.position)
      ? Number(row.position)
      : Infinity
  const delta = pos(a) - pos(b)
  if (!Number.isNaN(delta) && delta !== 0) return delta
  const ai = a.id ?? ''
  const bi = b.id ?? ''
  if (/^\d+$/.test(ai) && /^\d+$/.test(bi))
    return BigInt(ai) < BigInt(bi)
      ? -1
      : BigInt(ai) > BigInt(bi)
        ? 1
        : ai.localeCompare(bi)
  return ai.localeCompare(bi)
}
export function rawChildren(
  ctx: MappingContext,
  table: string,
  key: string,
  id: string,
  path: string,
): Doc[] {
  return matchingRows(ctx.tables[table] ?? [], key, id)
    .sort(sourceOrder)
    .flatMap((row) => {
      if (row.store_id && row.store_id !== ctx.storeId) {
        ctx.issue('RAW_OWNERSHIP_MISMATCH', table, row.id, 'store_id')
        return []
      }
      return [rawRow(ctx, table, row, path)]
    })
}
export function settings(
  ctx: MappingContext,
  model: string,
  id: string,
  path: string,
): Json[] {
  return matchingSettings(
    ctx.tables.model_settings ?? [],
    `App\\Models\\${model}`,
    id,
  )
    .sort(sourceOrder)
    .flatMap((row) => {
      const store = ctx.find('stores', ctx.storeId)
      const resolvedFromStoreModel =
        !row.store_id &&
        model === 'Store' &&
        id === ctx.storeId &&
        row.model_type === 'App\\Models\\Store' &&
        row.model_id === ctx.storeId &&
        store?.id === ctx.storeId &&
        live(store)
      if (row.store_id !== ctx.storeId && !resolvedFromStoreModel) {
        ctx.issue(
          row.store_id ? 'RAW_OWNERSHIP_MISMATCH' : 'RAW_OWNERSHIP_MISSING',
          'model_settings',
          row.id,
          'store_id',
        )
        return []
      }
      if (resolvedFromStoreModel) {
        // Preserve immutable row/store_id; record the exact source ownership evidence.
        ctx.contribute(
          'model_settings',
          row,
          ['model_type', 'model_id'],
          path,
          'MASTER_RAW_STORE_MODEL_OWNERSHIP',
        )
        ctx.issue(
          'RAW_OWNERSHIP_RESOLVED_FROM_STORE_MODEL',
          'model_settings',
          row.id,
          'store_id',
          'warning',
        )
      }
      return [rawRow(ctx, 'model_settings', row, path)]
    })
}
