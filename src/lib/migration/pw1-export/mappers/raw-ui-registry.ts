import { COMPONENT_CONFIG_KEYS } from './raw-setting-registry'

// PW1 2022_10_12_062304_init_data_config_for_frontend_templates_table:
// banner typography/button style data. Scope to these fields, never arbitrary JSON.
const bannerKeys = new Set(
  'bold italic underline mode hover text_color border_color background_color'.split(
    ' ',
  ),
)
// Exact keys from PW1 2022_10_12_062304_init_data_config_for_frontend_templates_table.
// Keep declaration-only keys confined to template config, not merchant settings.
const templateKeys = new Set([
  ...bannerKeys,
  ...'component banner images required required_if schema option selected limit placeholder default_text default_value images.*.button.status animation timing_animation picker_image upload_image'.split(
    ' ',
  ),
])
// PW1 menu type config migrations 2021_10_21_032723, 2022_03_29_044118,
// 2022_04_20_170553: multilingual plain text and hyperlink/icon declarations.
const menuTypeKeys = new Set(['content_ms'])
const menuKeys = new Set(['cart_status', 'search_status']) // Header/MenuController::update
const pageKeys = new Set(['show_created_at_article_detail']) // 2025_05_27_042542 migration
const emptyKeys = new Set<string>()
const uiKeys = new Set([
  ...`product_information product_name unit_price quantity variant_details total_amount receiver_information fullname phone address city district ward email note_for_delivery payment_method cod provider promotion allow_enter_coupon rename_subheading rename_cta_button_text subheading cta_button_text checkout_button_text search_box_text search_button_text result delivery_provider use_discount_code order_status_and_order_details`.split(
    ' ',
  ),
  'content_ms', // 2022_04_20_170553 menu plain-text config
])
// FrontendTemplate::THEME_* and TYPOGRAPHY_* constants.
const themeKeys = new Set(
  `theme.background_text theme.header_text theme.primary_color theme.background_color theme.color_recommend typography.current_font typography.h1_font_size typography.h1_font_weight typography.h2_font_size typography.h2_font_weight typography.h3_font_size typography.h3_font_weight typography.paragraph_font_size typography.paragraph_font_weight`.split(
    ' ',
  ),
)

export function verifiedUiSettingKey(
  key: string,
  modelType: string | null,
): boolean {
  // EloquentMenuLineRepository::save assigns id/position/signature then
  // persists each icon property as items.{index}.{field}.
  const menuItem =
    modelType === 'App\\Models\\MenuLine' &&
    /^items\.(0|[1-9]\d*)\.(id|position|url|size|type|image|signature)$/.test(
      key,
    )
  return uiKeys.has(key) || themeKeys.has(key) || menuItem
}

export function rawStructureKeys(
  table: string,
  field: string,
): ReadonlySet<string> {
  if (
    table === 'frontend_components' &&
    ['config', 'default_config_values'].includes(field)
  )
    return COMPONENT_CONFIG_KEYS
  if (table === 'frontend_templates' && field === 'config') return templateKeys
  if (
    table === 'menu_line_types' &&
    ['config', 'default_config_values'].includes(field)
  )
    return menuTypeKeys
  if (table === 'banners' && ['header', 'subheader', 'button'].includes(field))
    return bannerKeys
  if (table === 'menus' && field === 'config') return menuKeys
  if (table === 'pages' && field === 'config') return pageKeys
  if (table === 'model_settings' && field === 'value') return uiKeys
  return emptyKeys
}
