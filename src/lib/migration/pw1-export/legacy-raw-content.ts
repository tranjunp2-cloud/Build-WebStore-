import type { Doc, StoreOutput } from './contracts'
import { RAW_FIELDS } from './mappers/raw-fields'
/** Settings gained opaque source columns in 1.10.4; older artifacts remain strict. */
export function legacyModelSettingsValid(store: StoreOutput): boolean {
  function settings(value: unknown): boolean {
    return Array.isArray(value) && value.every(item => !!item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).every(field => RAW_FIELDS.model_settings.includes(field)))
  }
  for (const page of store.pages) {
    if (!settings(page.model_settings)) return false
    for (const component of page.components as Doc[]) if (!settings(component.model_settings)) return false
  }
  for (const site of store.sites) {
    if (site.raw_model_settings !== undefined) return false
    for (const menu of site.menus as Doc[]) {
      if (!settings(menu.model_settings)) return false
      for (const item of menu.menu_items as Doc[]) {
        if (!settings(item.model_settings)) return false
        for (const line of item.menu_lines as Doc[]) if (!settings(line.model_settings)) return false
      }
    }
  }
  return true
}
/** Old contracts allowed only registered raw columns; opaque extra columns start in 1.10.3. */
export function legacyRawContentValid(store: StoreOutput): boolean {
  function row(table: string, value: unknown, extras: string[] = []): value is Doc {
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => RAW_FIELDS[table]?.includes(key) || extras.includes(key))
  }
  const component = (value: Doc) => row('page_components', value, ['frontend_component','model_settings','banners','shortlist_items']) &&
    (value.frontend_component === null || row('frontend_components', value.frontend_component)) &&
    Array.isArray(value.banners) && value.banners.every(item => row('banners', item)) &&
    Array.isArray(value.shortlist_items) && value.shortlist_items.every(item => row('shortlist_items', item))
  for (const page of store.pages) if (!row('pages', page, ['_ref','components','model_settings']) || !Array.isArray(page.components) || !page.components.every(item => component(item as Doc))) return false
  for (const site of store.sites) {
    if (!Array.isArray(site.menus)) return false
    for (const menu of site.menus) {
      if (!row('menus', menu, ['model_settings','menu_items']) || !Array.isArray(menu.menu_items)) return false
      for (const item of menu.menu_items) {
        if (!row('menu_items', item, ['menu_line_type','model_settings','menu_lines']) || (item.menu_line_type !== null && !row('menu_line_types',item.menu_line_type)) || !Array.isArray(item.menu_lines)) return false
        for (const line of item.menu_lines) if (!row('menu_lines', line, ['menu_line_type','model_settings']) || (line.menu_line_type !== null && !row('menu_line_types',line.menu_line_type))) return false
      }
    }
  }
  return true
}
