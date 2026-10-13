import type { Doc, StoreOutput } from './contracts'
import type { RowDisposition } from './source-dispositions'
import { RAW_MODEL_SETTINGS_RULE, modelSettingsSecurityField } from './model-settings-scope'
import { ExportError } from './primitives'

/** Verify every preserved setting has one report receipt and the correct source owner. */
export function validateRawSettings(master: readonly StoreOutput[], rows: readonly RowDisposition[]): void {
  const actual = new Map<string, { storeId: string; path: string; row: Doc }>()
  const fail = (): never => { throw new ExportError('MODEL_SETTINGS_EVIDENCE_INVALID') }
  const modelTables: Record<string, string> = { Page: 'pages', PageComponent: 'page_components', Menu: 'menus', MenuItem: 'menu_items', MenuLine: 'menu_lines' }
  const classifications = new Map(rows.map(row => [`${row.table}:${row.sourceId}`, row]))
  const add = (value: unknown, storeId: string, path: string, model?: string, parentId?: string) => {
    if (!Array.isArray(value)) fail()
    for (const item of value as Doc[]) {
      if (!item || typeof item.id !== 'string' || actual.has(item.id) || Object.entries(item).some(([field,value]) => modelSettingsSecurityField(field) || (value !== null && typeof value !== 'string'))) fail()
      if (item.store_id && item.store_id !== storeId) fail()
      if (model) {
        const parent = classifications.get(`${modelTables[model]}:${parentId}`)
        if (item.model_type !== `App\\Models\\${model}` || item.model_id !== parentId || !parent || parent.storeId !== storeId || parent.ownership?.rule.startsWith('OWNERSHIP_')) fail()
      }
      actual.set(item.id as string, { storeId, path, row: item })
    }
  }
  for (const store of master) {
    const storeId = String(store.tenants[0]._ref).split(':').at(-1)!
    for (const page of store.pages) {
      add(page.model_settings,storeId,'pages.model_settings','Page',String(page.id))
      for (const component of page.components as Doc[]) add(component.model_settings,storeId,'pages.components.model_settings','PageComponent',String(component.id))
    }
    for (const site of store.sites) {
      add(site.raw_model_settings,storeId,'sites.raw_model_settings')
      for (const menu of site.menus as Doc[]) {
        add(menu.model_settings,storeId,'sites.menus.model_settings','Menu',String(menu.id))
        for (const item of menu.menu_items as Doc[]) {
          add(item.model_settings,storeId,'sites.menus.MenuItem.model_settings','MenuItem',String(item.id))
          for (const line of item.menu_lines as Doc[]) add(line.model_settings,storeId,'sites.menus.MenuLine.model_settings','MenuLine',String(line.id))
        }
      }
    }
  }
  for (const row of rows.filter(row => row.table === 'model_settings')) {
    const preserved = actual.get(row.sourceId)
    if (!preserved) { if (row.contributions.some(c => c.rule === RAW_MODEL_SETTINGS_RULE)) fail(); continue }
    if (row.storeId !== preserved.storeId || row.contributions.length !== 1 || (row.ownership?.rule === 'SOURCE_SETTING_STORE_ID' && preserved.row.store_id !== preserved.storeId)) fail()
    const receipt = row.contributions[0]
    if (receipt.storeId !== preserved.storeId || receipt.rule !== RAW_MODEL_SETTINGS_RULE || receipt.targetPath !== preserved.path || receipt.fields.length !== Object.keys(preserved.row).length || receipt.fields.some(field => !Object.hasOwn(preserved.row,field))) fail()
    actual.delete(row.sourceId)
  }
  if (actual.size) fail()
}
