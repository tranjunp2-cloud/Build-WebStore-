import { createHash } from 'node:crypto';

/** F40 read-only compatibility contract, pinned to F42 field-evidence-v26 / qc-fields-v1.
 * Kept local so the report does not deploy or import the F42 exporter/importer.
 * The ordered rows (including support/reason) intentionally match the producer's
 * registry hash. A producer contract change requires explicit adapter review.
 */
export const QC_FIELD_REGISTRY_VERSION = 'qc-fields-v1';
export const F42_FIELD_EVIDENCE_CONTRACT = 'field-evidence-v26';
type Support = 'compare' | 'unsupported' | 'unverified';
type QcField = { group: string; key: string; support: Support; reason: string };
const rows: QcField[] = [
  // Product and SKU
  { group: 'Product', key: 'products.name', support: 'compare', reason: 'NAME_TRIM' },
  { group: 'Product', key: 'products.slug', support: 'compare', reason: 'SLUG_TRIM' },
  { group: 'Product', key: 'products.status', support: 'compare', reason: 'PRODUCT_STATUS_ENUM' },
  { group: 'Product', key: 'products.category_id', support: 'compare', reason: 'CATEGORY_CROSSWALK' },
  { group: 'Product', key: 'products.package_weight', support: 'compare', reason: 'KG_OR_GRAMS_TO_KG' },
  { group: 'Product', key: 'products.package_weight_type', support: 'compare', reason: 'WEIGHT_UNIT_CONTRIBUTION' },
  { group: 'Product', key: 'products.package_length', support: 'compare', reason: 'SOURCE_CM_TO_TARGET_CM' },
  { group: 'Product', key: 'products.package_width', support: 'compare', reason: 'SOURCE_CM_TO_TARGET_CM' },
  { group: 'Product', key: 'products.package_height', support: 'compare', reason: 'SOURCE_CM_TO_TARGET_CM' },
  { group: 'Product', key: 'products.image_count', support: 'compare', reason: 'MAPPED_IMAGE_COUNT' },
  { group: 'Product', key: 'products.image_identity', support: 'compare', reason: 'MEDIA_TARGET_ID_SET' },
  { group: 'Product', key: 'products.currency', support: 'compare', reason: 'PW1_STORE_CURRENCY_CODE' },
  { group: 'SKU', key: 'product_skus.sku', support: 'compare', reason: 'SKU_IDENTITY' },
  { group: 'SKU', key: 'product_skus.price', support: 'compare', reason: 'CURRENCY_MINOR_UNITS' },
  { group: 'SKU', key: 'product_skus.cost', support: 'unsupported', reason: 'PW2_PRODUCT_COST_NOT_MIGRATED' },
  { group: 'SKU', key: 'product_skus.stock', support: 'compare', reason: 'SKU_ON_HAND_SNAPSHOT_V1' },
  { group: 'SKU', key: 'product_skus.reserved', support: 'unverified', reason: 'RESERVATION_SOURCE_UNAVAILABLE' },
  { group: 'SKU', key: 'product_skus.available', support: 'unverified', reason: 'AVAILABLE_SOURCE_UNAVAILABLE' },
  { group: 'SKU', key: 'product_skus.warehouse_location', support: 'unverified', reason: 'LOCATION_SOURCE_UNAVAILABLE' },
  // Order and items
  { group: 'Order', key: 'orders.code', support: 'compare', reason: 'KEYED_IDENTITY' },
  { group: 'Order', key: 'orders.currency_id', support: 'compare', reason: 'PW1_ORDER_CURRENCY_CODE' },
  { group: 'Order', key: 'orders.sub_total', support: 'compare', reason: 'CURRENCY_MINOR_UNITS' },
  { group: 'Order', key: 'orders.total_discount', support: 'compare', reason: 'TARGET_MINOR_UNITS' },
  { group: 'Order', key: 'orders.total_shipping', support: 'compare', reason: 'CURRENCY_MINOR_UNITS' },
  { group: 'Order', key: 'orders.total_tax', support: 'compare', reason: 'CURRENCY_MINOR_UNITS' },
  { group: 'Order', key: 'orders.total', support: 'compare', reason: 'CURRENCY_MINOR_UNITS' },
  { group: 'Order', key: 'orders.status', support: 'compare', reason: 'ORDER_STATUS_ENUM' },
  { group: 'Order', key: 'orders.purchase_status', support: 'compare', reason: 'PAYMENT_STATUS_ENUM' },
  { group: 'Order', key: 'orders.payment_method_id', support: 'compare', reason: 'COD_OR_STRIPE_PROVIDER_CROSSWALK' },
  { group: 'Order', key: 'orders.fulfilment_status', support: 'unsupported', reason: 'FULFILMENT_STATUS_NOT_MIGRATED' },
  { group: 'Order', key: 'orders.shipping_status', support: 'unsupported', reason: 'SHIPPING_STATUS_NOT_MIGRATED' },
  { group: 'Order', key: 'orders.refund_status', support: 'unverified', reason: 'REFUND_POLICY_DEPENDENT' },
  { group: 'Order', key: 'orders.cancel_state', support: 'unverified', reason: 'CANCEL_STATE_RULE_NOT_BUILT' },
  { group: 'Order item', key: 'order_details.product_sku_id', support: 'unverified', reason: 'ITEM_SKU_CROSSWALK_NOT_BUILT' },
  { group: 'Order item', key: 'order_details.sku', support: 'unsupported', reason: 'PW2_ITEM_SKU_NOT_STORED' },
  { group: 'Order item', key: 'order_details.quantity', support: 'compare', reason: 'STABLE_ITEM_ID' },
  { group: 'Order item', key: 'order_details.price', support: 'compare', reason: 'CURRENCY_MINOR_UNITS' },
  { group: 'Order item', key: 'order_details.total_price', support: 'unsupported', reason: 'PW2_ITEM_TOTAL_SNAPSHOT_NOT_STORED' },
  // Customer and discount
  { group: 'Customer', key: 'customers.identity', support: 'unverified', reason: 'CUSTOMER_IDENTITY_RULE_NOT_BUILT' },
  { group: 'Customer', key: 'customers.email', support: 'compare', reason: 'KEYED_EMAIL_TRIM_LOWER_EQUALITY' },
  { group: 'Customer', key: 'customers.address_count', support: 'compare', reason: 'MAPPED_DISTINCT_ADDRESS_COUNT' },
  { group: 'Discount', key: 'promotion_codes.code', support: 'compare', reason: 'UPPERCASE_CODE_KEYED_HMAC' },
  { group: 'Discount', key: 'promotions.discount_type_id', support: 'compare', reason: 'DISCOUNT_TYPE_ENUM' },
  { group: 'Discount', key: 'promotions.discount_value', support: 'compare', reason: 'PERCENT_OR_MYR_MINOR_UNITS' },
  { group: 'Discount', key: 'promotions.start_date', support: 'unverified', reason: 'DISCOUNT_TIMEZONE_RULE_NOT_BUILT' },
  { group: 'Discount', key: 'promotions.end_date', support: 'unverified', reason: 'DISCOUNT_TIMEZONE_RULE_NOT_BUILT' },
  { group: 'Discount', key: 'promotions.status', support: 'compare', reason: 'DISCOUNT_STATUS_ENUM' },
  // Settings and external integrations
  { group: 'Settings', key: 'stores.profile', support: 'unverified', reason: 'PROFILE_FIELD_REGISTRY_NOT_BUILT' },
  { group: 'Settings', key: 'users.team_membership', support: 'unverified', reason: 'TEAM_MEMBERSHIP_RULE_NOT_BUILT' },
  { group: 'Settings', key: 'store_email_templates.subject', support: 'compare', reason: 'EMAIL_SUBJECT_KEYED_HMAC' },
  { group: 'Settings', key: 'store_email_templates.status', support: 'compare', reason: 'EMAIL_TEMPLATE_ENABLED_FLAG' },
  { group: 'Payment', key: 'store_payments.provider_config', support: 'unsupported', reason: 'PROVIDER_CONFIG_NOT_MIGRATED' },
  { group: 'Delivery', key: 'stores.delivery_config', support: 'unsupported', reason: 'DELIVERY_PROVIDER_NOT_MIGRATED' },
  { group: 'Domain', key: 'store_domains.domain', support: 'unsupported', reason: 'DOMAIN_NOT_MIGRATED' },
  { group: 'Integration', key: 'stores.integration_config', support: 'unsupported', reason: 'INTEGRATION_CREDENTIALS_NOT_MIGRATED' },
];
export const QC_FIELD_REGISTRY: readonly Readonly<QcField>[] = Object.freeze(rows.map(row => Object.freeze(row)));
export const QC_FIELD_REGISTRY_HASH = createHash('sha256').update(JSON.stringify(rows)).digest('hex');

/**
 * Keys whose values are private. F42 already stores no display value for them;
 * the reader still refuses to surface one if a producer ever regresses.
 * Mirrors PRIVATE_SOURCE in the F42 comparator, kept local like the rest of this file.
 */
export const QC_PRIVATE_DISPLAY_KEYS: ReadonlySet<string> = new Set([
  'orders.code', 'customers.name', 'customers.email', 'customers.phone',
  'promotion_codes.code', 'store_email_templates.subject',
]);
