// Exact source header allowlists for the approved 1.10.3 source-only scope.
export const APPROVED_METADATA_FIELDS:Record<string,readonly string[]> = {
  "attributes": [
    "created_by"
  ],
  "addresses": [
    "full_address",
    "phone",
    "comment",
    "created_at",
    "updated_at"
  ],
  "attribute_values": [
    "created_by"
  ],
  "banners": [
    "signature",
    "created_by"
  ],
  "blog_categories": [
    "signature",
    "created_by"
  ],
  "blog_posts": [
    "signature",
    "created_by"
  ],
  "branches": [
    "created_by"
  ],
  "brands": [
    "signature",
    "created_by"
  ],
  "categories": [
    "signature",
    "created_by"
  ],
  "category_attributes": [
    "created_by"
  ],
  "countries": [
    "signature"
  ],
  "delivery_providers": [
    "image_signature",
    "large_image_signature"
  ],
  "districts": [
    "created_by"
  ],
  "faq_categories": [
    "signature"
  ],
  "frontend_components": [
    "created_by"
  ],
  "frontend_template_categories": [
    "signature"
  ],
  "frontend_templates": [
    "signature"
  ],
  "icons": [
    "signature"
  ],
  "import_histories": [
    "created_by"
  ],
  "media_categories": [
    "signature",
    "created_by"
  ],
  "media_items": [
    "signature",
    "created_by"
  ],
  "menu_line_types": [
    "created_by"
  ],
  "menus": [
    "created_by"
  ],
  "model_exports": [
    "created_by"
  ],
  "model_settings": [
    "signature"
  ],
  "order_details": [
    "signature",
    "created_by"
  ],
  "order_status_histories": [
    "created_by"
  ],
  "order_statuses": [
    "created_by"
  ],
  "orders": [
    "created_by"
  ],
  "page_components": [
    "created_by"
  ],
  "pages": [
    "created_by"
  ],
  "partners": [
    "signature",
    "created_by"
  ],
  "payment_methods": [
    "image_signature",
    "large_image_signature",
    "created_by"
  ],
  "product_attributes": [
    "created_by",
    "created_at",
    "updated_at"
  ],
  "product_images": [
    "signature",
    "created_by"
  ],
  "product_sku_images": [
    "signature",
    "created_by"
  ],
  "product_sku_promotion_prices": [
    "created_by"
  ],
  "product_skus": [
    "cost",
    "created_by",
    "created_at",
    "updated_at"
  ],
  "product_variants": [
    "created_by",
    "created_at",
    "updated_at"
  ],
  "products": [
    "created_by"
  ],
  "promotion_codes": [
    "used"
  ],
  "promotion_types": [
    "signature"
  ],
  "promotions": [
    "name_ms",
    "slug",
    "description_ms",
    "image",
    "signature",
    "type_id",
    "is_max_discount_value",
    "max_discount_value",
    "is_min_payment",
    "min_payment",
    "limit_per_user",
    "created_by"
  ],
  "provinces": [
    "created_by"
  ],
  "queue_sync": [
    "created_by"
  ],
  "ranks": [
    "signature"
  ],
  "ratings": [
    "reviewer_signature",
    "created_by"
  ],
  "service_tokens": [
    "created_by"
  ],
  "shortlist_items": [
    "signature",
    "created_by"
  ],
  "shortlists": [
    "signature",
    "created_by"
  ],
  "store_payments": [
    "created_by"
  ],
  "stores": [
    "logo_signature",
    "favicon_signature",
    "created_by"
  ],
  "tags": [
    "created_by"
  ],
  "users": [
    "signature"
  ],
  "vouchers": [
    "created_by"
  ],
  "wards": [
    "created_by"
  ]
}
export const APPROVED_SCOPE_HEADERS:Record<string,readonly string[]> = {
  "promotions": ["id", "store_id", "name", "name_ms", "slug", "description", "description_ms", "image", "signature", "start_date", "end_date", "type_id", "discount_value", "discount_type_id", "is_max_discount_value", "max_discount_value", "is_min_payment", "min_payment", "is_limit", "limit", "limit_per_user", "status", "created_by", "created_at", "updated_at", "deleted_at"],
  "promotion_codes": ["id", "promotion_id", "code", "used", "created_at", "updated_at", "deleted_at"],
  "orders": [
    "id",
    "code",
    "store_id",
    "customer_id",
    "customer_name",
    "customer_phone",
    "customer_email",
    "delivery_provider_id",
    "tracking_code",
    "currency_id",
    "comment",
    "invoice_date",
    "delivery_date",
    "payment_method_id",
    "promotion_code",
    "total_discount",
    "total_discount_tax",
    "total_shipping",
    "total_shipping_tax",
    "sub_total",
    "prepaid",
    "balance",
    "total",
    "total_tax",
    "total_weight",
    "shipping_address_id",
    "billing_address_id",
    "status",
    "purchase_status",
    "refund_status",
    "refund_message",
    "note",
    "cancel_note",
    "created_by",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  "order_details": [
    "id",
    "order_id",
    "product_sku_id",
    "name",
    "variant",
    "sku",
    "price",
    "price_with_tax",
    "total_price",
    "total_price_with_tax",
    "item_price",
    "total_item_price",
    "image",
    "signature",
    "quantity",
    "created_by",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  "addresses": [
    "id",
    "store_id",
    "address",
    "full_address",
    "country_id",
    "province_id",
    "district_id",
    "ward_id",
    "post_code",
    "city",
    "phone",
    "comment",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  "store_codes": [
    "id",
    "store_id",
    "code",
    "type",
    "created_at",
    "updated_at",
    "deleted_at"
  ],
  "store_deliveries": [
    "id",
    "store_id",
    "delivery_provider_id",
    "is_default",
    "is_support_cod",
    "is_support_dynamic_fee",
    "shipping_fee_method",
    "shipping_fee_config",
    "status",
    "config_status",
    "created_at",
    "updated_at"
  ]
}
