import { SECRET_FIELDS } from './source-registry'

export const MODEL_SETTINGS_SCOPE_RULE = 'MASTER-2.2-MODEL-SETTINGS-OUTSIDE-SCOPE'
export const MODEL_SETTINGS_SCOPE_CODE = 'MODEL_SETTINGS_OUTSIDE_SCOPE'
export function modelSettingsSecurityField(field: string): boolean {
  return SECRET_FIELDS.has(field) || /password|passwd|secret|token|credential|authorization|api[_-]?key|private[_-]?key|cookie/i.test(field)
}

export const RAW_MODEL_SETTINGS_RULE = 'MASTER_RAW_MODEL_SETTINGS'
export const MODEL_SETTINGS_RETAIN_RULE = 'MASTER-MODEL-SETTINGS-UNOWNED-SOURCE'
export const MODEL_SETTINGS_RETAIN_CODE = 'MODEL_SETTINGS_RAW_PRESERVED'
export const MODEL_SETTINGS_PATHS = new Set(['pages.model_settings', 'pages.components.model_settings', 'sites.menus.model_settings', 'sites.menus.MenuItem.model_settings', 'sites.menus.MenuLine.model_settings', 'sites.raw_model_settings'])
