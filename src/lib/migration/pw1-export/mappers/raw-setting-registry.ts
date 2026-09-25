/** PW1 EloquentPageRepository::keysHasIntegerValue/parentKeysHasBooleanValue;
 * 2021_08_12_083607_create_init_values_for_frontend_components_table.
 * These rules preserve source strings; they never coerce migration input.
 */
const enums: Record<string, readonly string[]> = {
  animation: ['manual', 'auto'],
  list_type: ['all', 'fixed', 'random'],
  order_by: ['created_at'],
}
const integers = new Set([
  'timing_animation',
  'per_page',
  'product_category',
  'article_category',
])
const flags: Record<string, readonly string[]> = {
  criteria: [
    'variant',
    'price',
    'brand',
    'category',
    'created_at',
    'discount_value',
  ],
  others: ['display_out_of_stock'],
}
export function verifiedSetting(
  key: string,
  value: string | null,
): boolean | undefined {
  const known =
    Object.hasOwn(enums, key) ||
    integers.has(key) ||
    Object.hasOwn(flags, key) ||
    key === 'show_created_at_article_listing'
  if (!known) return undefined
  if (value === null || value === '') return true
  if (Object.hasOwn(enums, key)) return enums[key].includes(value)
  if (integers.has(key))
    return /^\d+$/.test(value) && Number.isSafeInteger(Number(value))
  if (key === 'show_created_at_article_listing')
    return ['0', '1'].includes(value)
  try {
    const parsed: unknown = JSON.parse(value)
    return (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Object.entries(parsed).every(
        ([name, flag]) =>
          flags[key].includes(name) &&
          [0, 1, false, true, '0', '1'].includes(flag),
      )
    )
  } catch {
    return false
  }
}

// Only for frontend component definitions, never generic store/settings JSON.
// Attribute keys come from FrontendComponent::ATTR_*; field keys from the above migration.
export const COMPONENT_CONFIG_KEYS = new Set(
  `required required_if readonly limit schema option
size images animation picker_image upload_image timing_animation header others order_by products list_type
product_category articles article_category items content criteria per_page
variant price brand category created_at discount_value display_out_of_stock
product_information product_name unit_price quantity variant_details total_amount
receiver_information fullname phone address city district ward email note_for_delivery
payment_method cod provider promotion allow_enter_coupon rename_subheading rename_cta_button_text
subheading cta_button_text checkout_button_text search_box_text search_button_text result
delivery_provider use_discount_code order_status_and_order_details`.split(
    /\s+/,
  ),
)
