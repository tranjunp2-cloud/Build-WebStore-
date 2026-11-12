import { EXTERNAL_SOURCE_RULE, externalSourcePath } from '../external-source'
import {
  type Doc,
  type Json,
  type MappingContext,
  type Row,
} from '../contracts'
import { RAW_FIELDS } from './raw-fields'
import { verifiedSetting } from './raw-setting-registry'
import { safeUrl } from '../primitives'
import { isSafeContentLink } from './content-link'
import { createSourceClassifier } from '../source-classification'
import { RAW_MODEL_SETTINGS_RULE, modelSettingsSecurityField } from '../model-settings-scope'
import { matchingSettings, matchingRows } from './raw-row-index'
import { rawStructureKeys, verifiedUiSettingKey } from './raw-ui-registry'

const preservedSettings = new WeakMap<MappingContext, Set<string>>()
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
const opaqueContentTables = new Set(['pages', 'page_components', 'banners', 'shortlist_items', 'menus', 'menu_items', 'menu_lines', 'frontend_components', 'frontend_templates', 'menu_line_types'])

/** Delegated Page/Menu content retains original CSV strings without interpreting their contents. */
export function rawRow(
  ctx: MappingContext,
  table: string,
  row: Row,
  path: string,
): Doc {
  if (table === 'model_settings') {
    const ids = preservedSettings.get(ctx) ?? new Set<string>()
    if (row.id) ids.add(row.id)
    preservedSettings.set(ctx, ids)
    const out = Object.fromEntries(Object.entries(row).filter(([field]) => !modelSettingsSecurityField(field)))
    ctx.contribute(table, row, Object.keys(out), path, RAW_MODEL_SETTINGS_RULE)
    return out
  }
  if (opaqueContentTables.has(table)) {
    const preserved: Doc = {}
    for (const [key, value] of Object.entries(row)) {
      if (sensitive.test(key)) {
        ctx.issue('RAW_SECRET_EXCLUDED', table, row.id, key, 'warning')
        continue
      }
      preserved[key] = value
    }
    ctx.contribute(table, row, Object.keys(preserved), path, 'MASTER_RAW_PW1_CONTENT')
    return preserved
  }
  const out: Doc = {}
  const fields: string[] = []
  for (const [key, value] of Object.entries(row)) {
    if (table === 'stores' && key === 'social_channel') continue // Projected to supported PW2 fields; metadata stays in CSV.
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
    // Product descriptions and Blog content are opaque source text by explicit migration policy.
    // Do not reinterpret JSON-looking text, HTML, URLs or embedded attribute names.
    // Inactive Blog categories stay only in the external CSV; no value is imported.
    if ((table === 'blog_categories' && row.status === '0') ||
      (table === 'products' && ['description', 'description_ms'].includes(key)) ||
      (table === 'blog_posts' && ['content', 'content_ms'].includes(key))) {
      out[key] = value
      fields.push(key)
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
        if (
          ctx.config.migrationPolicy?.allowBracketedProductNames &&
          table === 'products' &&
          (key === 'name' || key === 'name_ms')
        ) {
          reason = textReason(value, navigation)
        } else {
          reason = 'INVALID_JSON'
        }
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
  const external = path.startsWith('sites.pw1_source.')
  ctx.contribute(table, row, fields, external ? externalSourcePath(table) : path, external ? EXTERNAL_SOURCE_RULE : 'MASTER_RAW_ALLOWLIST')
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
        ctx.issue('RAW_OWNERSHIP_MISMATCH', table, row.id, 'store_id', opaqueContentTables.has(table) ? 'warning' : 'blocker')
        return []
      }
      return [rawRow(ctx, table, row, path)]
    })
}
/** Values are opaque CSV strings, including malformed JSON and HTML navigation links. */
export function settings(ctx: MappingContext, model: string, id: string, path: string): Json[] {
  return matchingSettings(ctx.tables.model_settings ?? [], `App\\Models\\${model}`, id)
    .filter(row => !row.store_id || row.store_id === ctx.storeId)
    .sort(sourceOrder).map(row => rawRow(ctx, 'model_settings', row, path))
}

const settingOwners = new WeakMap<MappingContext['tables'], Map<string, Row[]>>()
export function remainingSettings(ctx: MappingContext): Json[] {
  let groups = settingOwners.get(ctx.tables)
  if (!groups) {
    groups = new Map()
    const classifier = createSourceClassifier(ctx.tables, ctx.config, [])
    for (const row of ctx.tables.model_settings ?? []) {
      const owner = classifier.ownership('model_settings', row)
      if (!owner.storeId) continue
      const list = groups.get(owner.storeId) ?? []
      list.push(row); groups.set(owner.storeId, list)
    }
    settingOwners.set(ctx.tables, groups)
  }
  const nested = preservedSettings.get(ctx) ?? new Set<string>()
  return (groups.get(ctx.storeId) ?? []).filter(row => !nested.has(row.id ?? '')).slice().sort(sourceOrder)
    .map(row => rawRow(ctx, 'model_settings', row, 'sites.raw_model_settings'))
}
