import { MigrationError } from './errors'
import type { ClassificationRow } from './classification'
import type { ImportDiagnostic, ImportStore } from './types'

export const RAW_SETTINGS_RULE = 'MASTER_RAW_MODEL_SETTINGS'
export const UNOWNED_SETTINGS_RULE = 'MASTER-MODEL-SETTINGS-UNOWNED-SOURCE'
export const RAW_SETTINGS_MARKER = 'MODEL_SETTINGS_RAW_PRESERVED'
const security = (field: string) => ['key_string', 'recovery_codes'].includes(field) || /password|passwd|secret|token|credential|authorization|api[_-]?key|private[_-]?key|cookie/i.test(field)
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
function fail(): never { throw new MigrationError('MODEL_SETTINGS_RAW_EVIDENCE_INVALID') }
type Evidence = { storeId: string; path: string; fields: string; directStore: string | null; modelTable?: string; modelId: string | null }
/** Index only identity/field metadata; opaque HTML and JSON are never parsed or sanitized. */
export function createModelSettingsProof(enabled: boolean) {
  const emittedStores = new Set<string>(), settings = new Map<string, Evidence>()
  const unowned = new Map<string, { storeId: string | null; rule: string }>()
  let marker = false, finished = false, bytes = 0
  const charge = (size: number) => { bytes += size; if (bytes > 128 * 1024 * 1024) fail() }
  const collect = (value: unknown, storeId: string, path: string, model?: string, parentId?: unknown) => {
    if (value === undefined) return
    if (!Array.isArray(value)) fail()
    for (const item of value) {
      if (!object(item) || typeof item.id !== 'string' || !item.id || settings.has(item.id)) fail()
      if (Object.entries(item).some(([field, v]) => security(field) || (v !== null && typeof v !== 'string'))) fail()
      if (model && (item.model_type !== `App\\Models\\${model}` || item.model_id !== parentId || (item.store_id && item.store_id !== storeId))) fail()
      if (item.store_id && item.store_id !== storeId) fail()
      const modelName = typeof item.model_type === 'string' ? item.model_type.split('\\').at(-1) : undefined
      const modelTable = typeof item.model_type === 'string' && item.model_type === `App\\Models\\${modelName}` && modelName ? ({ Store: 'stores', User: 'users', Page: 'pages', PageComponent: 'page_components', Menu: 'menus', MenuItem: 'menu_items', MenuLine: 'menu_lines', Product: 'products', Category: 'categories' } as Record<string, string>)[modelName] : undefined
      const fields = Object.keys(item).sort().join('\0')
      settings.set(item.id, { storeId, path, fields, directStore: typeof item.store_id === 'string' ? item.store_id : null, modelTable, modelId: typeof item.model_id === 'string' ? item.model_id : null })
      charge(192 + 2 * (item.id.length + storeId.length + path.length + fields.length))
    }
  }
  const children = (value: unknown): Record<string, unknown>[] => {
    if (value === undefined) return []
    if (!Array.isArray(value) || !value.every(object)) return fail()
    return value
  }
  return {
    addPage(storeId: string, page: unknown) {
      if (!enabled) return
      if (!object(page)) fail()
      collect(page.model_settings, storeId, 'pages.model_settings', 'Page', page.id)
      for (const component of children(page.components)) collect(component.model_settings, storeId, 'pages.components.model_settings', 'PageComponent', component.id)
    },
    addStore(store: ImportStore) {
      if (!enabled) return
      emittedStores.add(store.storeId)
      for (const page of store.collections.pages) this.addPage(store.storeId, page)
      for (const site of store.collections.sites) {
        collect(site.raw_model_settings, store.storeId, 'sites.raw_model_settings')
        for (const menu of children(site.menus)) {
          collect(menu.model_settings, store.storeId, 'sites.menus.model_settings', 'Menu', menu.id)
          for (const item of children(menu.menu_items)) {
            collect(item.model_settings, store.storeId, 'sites.menus.MenuItem.model_settings', 'MenuItem', item.id)
            for (const line of children(item.menu_lines)) collect(line.model_settings, store.storeId, 'sites.menus.MenuLine.model_settings', 'MenuLine', line.id)
          }
        }
      }
    },
    addDiagnostic(d: ImportDiagnostic) {
      if (enabled && d.code === 'MODEL_SETTINGS_OUTSIDE_SCOPE') fail()
      if (d.code !== RAW_SETTINGS_MARKER) return
      if (!enabled || d.table !== 'model_settings' || d.severity !== 'warning' || d.storeId !== undefined || d.sourceId !== undefined || d.field !== undefined || d.reason !== undefined) fail()
      marker = true
    },
    allows(row: ClassificationRow, field: string, rule: string) {
      return enabled && marker && rule === UNOWNED_SETTINGS_RULE && row.table === 'model_settings' && !row.contributions.length && (row.storeId === null || !emittedStores.has(row.storeId)) && row.fields[field] === 'retained-source' && !security(field)
    },
    validContribution(row: ClassificationRow, c: ClassificationRow['contributions'][number]) {
      if (!enabled || !marker || row.table !== 'model_settings' || c.rule !== RAW_SETTINGS_RULE) return false
      const actual = settings.get(row.sourceId)
      return Boolean(actual && actual.storeId === row.storeId && c.storeId === row.storeId && c.table === row.table && c.sourceId === row.sourceId && c.targetPath === actual.path && [...c.fields].sort().join('\0') === actual.fields && c.fields.every(field => row.fields[field] === 'mapped') && (row.ownership.rule !== 'SOURCE_PARENT_RELATION' || (actual.modelTable === row.ownership.parentTable && actual.modelId === row.ownership.parentId)) && (row.ownership.rule !== 'SOURCE_SETTING_STORE_ID' || (actual.path === 'sites.raw_model_settings' && actual.directStore === row.storeId)))
    },
    addRow(row: ClassificationRow) {
      const usesRule = row.contributions.some(c => c.rule === RAW_SETTINGS_RULE) || Object.values(row.fieldRetentionRules ?? {}).includes(UNOWNED_SETTINGS_RULE) || row.ownership.rule === 'SOURCE_SETTING_STORE_ID'
      if (!enabled) { if (usesRule) fail(); return }
      if (row.table !== 'model_settings') { if (usesRule) fail(); return }
      if (!marker || row.productExclusion || row.sourceExclusion) fail()
      const actual = settings.get(row.sourceId)
      if (actual) {
        if (row.disposition !== 'mapped' || row.contributions.length !== 1 || !this.validContribution(row, row.contributions[0]) || Object.entries(row.fields).some(([field, status]) => security(field) ? status !== 'security-excluded' : status !== 'mapped')) fail()
        settings.delete(row.sourceId)
      } else {
        if (row.disposition !== 'retained-source' || row.contributions.length || (row.storeId !== null && emittedStores.has(row.storeId)) || Object.entries(row.fields).some(([field, status]) => security(field) ? status !== 'security-excluded' : status !== 'retained-source' || row.fieldRetentionRules?.[field] !== UNOWNED_SETTINGS_RULE)) fail()
        unowned.set(row.sourceId, { storeId: row.storeId, rule: row.ownership.rule }); charge(160 + row.sourceId.length * 2)
      }
    },
    finish() { if (enabled && settings.size) fail(); finished = true },
    disposition(d: ImportDiagnostic): 'OUT_OF_SCOPE' | undefined {
      if (!enabled || !finished || !marker) return
      if (d.code === RAW_SETTINGS_MARKER && d.table === 'model_settings' && d.severity === 'warning' && !d.storeId && !d.sourceId && !d.field && !d.reason) return 'OUT_OF_SCOPE'
      const row = d.sourceId && unowned.get(d.sourceId)
      if (row && d.code === 'SOURCE_OWNERSHIP_UNRESOLVED' && d.table === 'model_settings' && d.severity === 'warning' && d.field === undefined && (d.storeId ?? null) === row.storeId && d.reason === row.rule) return 'OUT_OF_SCOPE'
    },
  }
}
