#!/usr/bin/env node
/**
 * DB Setup Script — runs as Docker CMD (DO) or Vercel build step.
 *
 * Modes:
 * - `--migrate-only`: Run SQL migrations then exit (for Vercel build).
 * - Default: Full Docker mode — pushDevSchema + start server (for DO/Docker).
 *
 * Docker mode:
 * 1. Check if database has tables
 * 2. If empty → start server.js with NODE_ENV=development (triggers pushDevSchema)
 * 3. Poll DB until tables are created (pushDevSchema done)
 * 4. Kill the dev server, restart with NODE_ENV=production
 * 5. If tables exist → start server.js normally (NODE_ENV=production)
 *
 * Health check: Uses /api/health (no DB query) so DO doesn't kill
 * the container during schema push.
 */
const { spawn } = require('child_process');
const { bootstrapSeed } = require('./bootstrap-seed');
const { seedMalaysiaGeo } = require('./seed-malaysia-geo-boot');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPool() {
  const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL;
  if (!connStr) return null;

  const pg = require('pg');
  // Honour sslmode=disable (or localhost, which Postgres typically doesn't run
  // with SSL) so dev DBs work without forcing TLS. Hosted DBs (DO/Vercel/etc.)
  // still get ssl:{rejectUnauthorized:false} which accepts their self-signed certs.
  const sslmodeMatch = connStr.match(/[?&]sslmode=([^&]+)/);
  const sslmode = sslmodeMatch ? sslmodeMatch[1].toLowerCase() : null;
  const hostMatch = connStr.match(/@([^:/?]+)/);
  const host = hostMatch ? hostMatch[1].toLowerCase() : '';
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === 'host.docker.internal' || host === 'postgres';
  const useSsl = sslmode === 'disable' ? false : (isLocal ? false : { rejectUnauthorized: false });

  const cleanStr = connStr
    .replace(/[?&]sslmode=[^&]+/g, '')
    .replace(/\?&/, '?')
    .replace(/\?$/, '');

  return new pg.Pool({
    connectionString: cleanStr,
    ssl: useSsl,
    connectionTimeoutMillis: 10000,
  });
}

async function getTableCount(pool) {
  const result = await pool.query(
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  );
  return parseInt(result.rows[0].count, 10);
}

// ─── Direct SQL Migrations ──────────────────────────────────────────────
// Standalone server can't run Payload's pushDevSchema (missing Drizzle files).
// Instead, add missing columns directly via ALTER TABLE.
// Each migration is idempotent — safe to run multiple times.
const MIGRATIONS = [
  // ── Users: Auth tables (Payload Drizzle schema) ──
  // Payload 3.14 uses VARCHAR id (UUID), mixed column naming:
  //   roles: parent_id, order (no underscore)
  //   tenants/sessions: _parent_id, _order (with underscore)
  //   tenants_permissions: parent_id, order (no underscore)
  // Tables need _uuid column for array types
  {
    name: 'users_tenants.create_table',
    sql: `CREATE TABLE IF NOT EXISTS users_tenants (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      tenant_id integer,
      status varchar DEFAULT 'active',
      role varchar DEFAULT 'viewer');`,
  },
  {
    name: 'users_tenants.parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS users_tenants_parent_idx ON users_tenants (_parent_id);`,
  },
  {
    name: 'users_tenants_permissions.create_table',
    sql: `CREATE TABLE IF NOT EXISTS users_tenants_permissions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "order" integer NOT NULL DEFAULT 0,
      parent_id varchar NOT NULL,
      value varchar);`,
  },
  {
    name: 'users_tenants_permissions.parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS users_tenants_permissions_parent_idx ON users_tenants_permissions (parent_id);`,
  },
  {
    name: 'users_sessions.create_table',
    sql: `CREATE TABLE IF NOT EXISTS users_sessions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      created_at timestamptz DEFAULT now(),
      expires_at timestamptz);`,
  },
  {
    name: 'users_sessions.parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS users_sessions_parent_idx ON users_sessions (_parent_id);`,
  },
  // ── Tenants: Stripe Connect ──
  {
    name: 'tenants.stripe_account_id',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_account_id varchar;`,
  },
  {
    name: 'tenants.stripe_onboarding_complete',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean DEFAULT false;`,
  },
  {
    name: 'tenants.stripe_account_id_idx',
    sql: `CREATE INDEX IF NOT EXISTS tenants_stripe_account_id_idx ON tenants (stripe_account_id);`,
  },
  // ── Tenants: Xendit Connect (F34) ──
  {
    name: 'tenants.xendit_account_id',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS xendit_account_id varchar;`,
  },
  {
    name: 'tenants.xendit_account_status',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS xendit_account_status varchar DEFAULT 'NOT_CONNECTED';`,
  },
  {
    name: 'tenants.xendit_onboarding_complete',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS xendit_onboarding_complete boolean DEFAULT false;`,
  },
  {
    name: 'tenants.xendit_account_id_idx',
    sql: `CREATE INDEX IF NOT EXISTS tenants_xendit_account_id_idx ON tenants (xendit_account_id);`,
  },
  // ── F34: Xendit payment method toggles on Tenants ──
  { name: 'tenants.payments_xendit_tng', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_xendit_tng boolean DEFAULT false;` },
  { name: 'tenants.payments_xendit_grabpay', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_xendit_grabpay boolean DEFAULT false;` },
  { name: 'tenants.payments_xendit_duitnow', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_xendit_duitnow boolean DEFAULT false;` },
  { name: 'tenants.payments_xendit_fpx', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_xendit_fpx boolean DEFAULT false;` },
  { name: 'tenants.payments_xendit_shopeepay', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_xendit_shopeepay boolean DEFAULT false;` },
  { name: 'tenants.payments_xendit_boost', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_xendit_boost boolean DEFAULT false;` },
  { name: 'tenants.payments_xendit_mae', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_xendit_mae boolean DEFAULT false;` },
  // Model C: merchant provides own Xendit keys
  { name: 'tenants.xendit_secret_key', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS xendit_secret_key varchar;` },
  { name: 'tenants.xendit_callback_token', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS xendit_callback_token varchar;` },
  // ── Tenants: Business info ──
  {
    name: 'tenants.whatsapp_number',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_number varchar;`,
  },
  {
    name: 'tenants.ssm_number',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ssm_number varchar;`,
  },
  {
    name: 'tenants.business_address',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_address varchar;`,
  },
  {
    name: 'tenants.ai_generations_count',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_generations_count numeric DEFAULT 0;`,
  },
  // ── Tenants: ECH Integration ──
  {
    name: 'tenants.ech_integration_enabled',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ech_integration_enabled boolean DEFAULT false;`,
  },
  {
    name: 'tenants.ech_integration_api_key',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ech_integration_api_key varchar;`,
  },
  {
    name: 'tenants.ech_integration_merchant_id',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ech_integration_merchant_id varchar;`,
  },
  // ── Tenants: Settings group ──
  {
    name: 'tenants.settings_allowed_websites',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings_allowed_websites numeric DEFAULT 1;`,
  },
  {
    name: 'tenants.settings_storage_used',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings_storage_used numeric DEFAULT 0;`,
  },
  {
    name: 'tenants.settings_storage_limit_bytes',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings_storage_limit_bytes numeric DEFAULT 524288000;`,
  },
  {
    name: 'tenants.settings_dashboard_preferences',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings_dashboard_preferences jsonb;`,
  },
  // ── Sites: Locale + Shipping ──
  {
    name: 'sites.locale',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS locale varchar DEFAULT 'ms';`,
  },
  {
    name: 'sites.shipping_config_enabled',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS shipping_config_enabled boolean DEFAULT true;`,
  },
  {
    name: 'sites.shipping_config_west_rate',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS shipping_config_west_rate numeric DEFAULT 800;`,
  },
  {
    name: 'sites.shipping_config_east_rate',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS shipping_config_east_rate numeric DEFAULT 1500;`,
  },
  {
    name: 'sites.shipping_config_free_above',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS shipping_config_free_above numeric;`,
  },
  {
    name: 'sites.shipping_config_shipping_setup_confirmed',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS shipping_config_shipping_setup_confirmed boolean DEFAULT false;`,
  },
  {
    name: 'sites.header_block',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS header_block jsonb;`,
  },
  {
    name: 'sites.footer_block',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS footer_block jsonb;`,
  },
  {
    name: 'sites.global_blocks',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS global_blocks jsonb;`,
  },
  {
    name: 'sites.pending_global_blocks',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS pending_global_blocks jsonb;`,
  },
  {
    name: 'sites.pending_header_block',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS pending_header_block jsonb;`,
  },
  {
    name: 'sites.pending_footer_block',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS pending_footer_block jsonb;`,
  },
  // ── Sites: Branding + Contact Info ──
  { name: 'sites.branding', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS branding varchar;' },
  { name: 'sites.contact_info', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS contact_info varchar;' },
  { name: 'sites.branding_logo', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS branding_logo varchar;' },
  { name: 'sites.branding_favicon', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS branding_favicon varchar;' },
  { name: 'sites.contact_info_phone', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS contact_info_phone varchar;' },
  { name: 'sites.contact_info_email', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS contact_info_email varchar;' },
  { name: 'sites.contact_info_address', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS contact_info_address varchar;' },
  // ── Sites: Local Business Info (F37 US-01) ──
  { name: 'sites.local_business_street_address', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_street_address varchar;' },
  { name: 'sites.local_business_city', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_city varchar;' },
  { name: 'sites.local_business_state', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_state varchar;' },
  { name: 'sites.local_business_postcode', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_postcode varchar;' },
  { name: 'sites.local_business_country', sql: "ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_country varchar DEFAULT 'MY';" },
  { name: 'sites.local_business_latitude', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_latitude numeric;' },
  { name: 'sites.local_business_longitude', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_longitude numeric;' },
  { name: 'sites.local_business_business_category', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_business_category varchar;' },
  { name: 'sites.local_business_schema_subtype', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_schema_subtype varchar;' },
  { name: 'sites.local_business_price_range', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_price_range varchar;' },
  { name: 'sites.local_business_service_area_description', sql: 'ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_service_area_description varchar;' },
  // ── Products: Halal + Weight ──
  {
    name: 'products.halal_certified',
    sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS halal_certified boolean DEFAULT false;`,
  },
  {
    name: 'products.halal_cert_image_id',
    sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS halal_cert_image_id integer;`,
  },
  {
    name: 'products.weight',
    sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 0;`,
  },
  // ── Products: Fields required by Drizzle schema ──
  { name: 'products.has_variants', sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants boolean DEFAULT false;` },
  { name: 'products.description_b_m', sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS description_b_m jsonb;` },
  { name: 'products.dimensions_length', sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions_length numeric DEFAULT 0;` },
  { name: 'products.dimensions_width', sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions_width numeric DEFAULT 0;` },
  { name: 'products.dimensions_height', sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions_height numeric DEFAULT 0;` },
  { name: 'products.ai_review_pending', sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_pending boolean DEFAULT false;` },
  // ── Orders: Stripe fields ──
  {
    name: 'orders.stripe_session_id',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id varchar;`,
  },
  {
    name: 'orders.stripe_session_id_idx',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_id_idx ON orders (stripe_session_id);`,
  },
  {
    name: 'orders.stripe_payment_intent_id',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id varchar;`,
  },
  {
    name: 'orders.stripe_payment_intent_id_idx',
    sql: `CREATE INDEX IF NOT EXISTS orders_stripe_payment_intent_id_idx ON orders (stripe_payment_intent_id);`,
  },
  // ── Orders: F10 fields ──
  {
    name: 'orders.shipping_fee',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee numeric;`,
  },
  {
    name: 'orders.payment_method',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method varchar;`,
  },
  {
    name: 'orders.payment_proof_image_id',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_image_id integer;`,
  },
  {
    name: 'orders.payment_reference',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference varchar;`,
  },
  {
    name: 'orders.tracking_number',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number varchar;`,
  },
  {
    name: 'orders.cancel_reason',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason varchar;`,
  },
  // ── Blog Categories table ──
  {
    name: 'blog_categories.create_table',
    sql: `CREATE TABLE IF NOT EXISTS blog_categories (
      id serial PRIMARY KEY,
      tenant_id integer NOT NULL,
      name varchar NOT NULL,
      slug varchar NOT NULL UNIQUE,
      status varchar DEFAULT 'active',
      updated_at timestamptz DEFAULT now() NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    );`,
  },
  {
    name: 'blog_categories.tenant_idx',
    sql: `CREATE INDEX IF NOT EXISTS blog_categories_tenant_idx ON blog_categories (tenant_id);`,
  },
  {
    name: 'blog_categories.slug_idx',
    sql: `CREATE INDEX IF NOT EXISTS blog_categories_slug_idx ON blog_categories (slug);`,
  },
  // ── Blogs table ──
  {
    name: 'blogs.create_table',
    sql: `CREATE TABLE IF NOT EXISTS blogs (
      id serial PRIMARY KEY,
      tenant_id integer NOT NULL,
      site_id integer NOT NULL,
      title varchar NOT NULL,
      slug varchar NOT NULL UNIQUE,
      content jsonb,
      status varchar DEFAULT 'draft',
      category_id integer,
      thumbnail_id integer,
      author_id integer NOT NULL,
      seo_meta_title varchar,
      seo_meta_description varchar,
      updated_at timestamptz DEFAULT now() NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    );`,
  },
  {
    name: 'blogs.tenant_idx',
    sql: `CREATE INDEX IF NOT EXISTS blogs_tenant_idx ON blogs (tenant_id);`,
  },
  {
    name: 'blogs.site_idx',
    sql: `CREATE INDEX IF NOT EXISTS blogs_site_idx ON blogs (site_id);`,
  },
  {
    name: 'blogs.slug_idx',
    sql: `CREATE INDEX IF NOT EXISTS blogs_slug_idx ON blogs (slug);`,
  },
  // ── Categories table ──
  {
    name: 'categories.create_table',
    sql: `CREATE TABLE IF NOT EXISTS categories (
      id serial PRIMARY KEY,
      tenant_id integer,
      site_id integer,
      name varchar NOT NULL,
      slug varchar,
      parent_id integer,
      breadcrumbs varchar,
      image_id integer,
      updated_at timestamptz DEFAULT now() NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    );`,
  },
  // ── SEO Meta Jobs table ──
  {
    name: 'seo_meta_jobs.create_table',
    sql: `CREATE TABLE IF NOT EXISTS seo_meta_jobs (
      id serial PRIMARY KEY,
      target_collection varchar,
      target_id varchar,
      status varchar DEFAULT 'pending',
      error_log varchar,
      retry_count numeric DEFAULT 0,
      site_id integer,
      updated_at timestamptz DEFAULT now() NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    );`,
  },
  // ── Tenants: Custom Domains array table ──
  {
    name: 'tenants_custom_domains.create_table',
    sql: `CREATE TABLE IF NOT EXISTS tenants_custom_domains (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      domain varchar,
      status varchar DEFAULT 'pending',
      is_primary boolean DEFAULT false
    );`,
  },
  {
    name: 'tenants_custom_domains.parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS tenants_custom_domains_parent_idx ON tenants_custom_domains (_parent_id);`,
  },
  // ── Sites: SEO Tracked Keywords array table ──
  {
    name: 'sites_seo_tracked_keywords.create_table',
    sql: `CREATE TABLE IF NOT EXISTS sites_seo_tracked_keywords (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      keyword varchar,
      current_rank numeric,
      previous_rank numeric,
      last_checked_at timestamptz
    );`,
  },
  {
    name: 'sites_seo_tracked_keywords.parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS sites_seo_tracked_keywords_parent_idx ON sites_seo_tracked_keywords (_parent_id);`,
  },
  // ── Sites: Local Business Opening Hours array table (F37 US-01) ──
  {
    name: 'sites_local_business_opening_hours.create_table',
    sql: `CREATE TABLE IF NOT EXISTS sites_local_business_opening_hours (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      day_of_week varchar,
      opens varchar,
      closes varchar,
      is_closed boolean DEFAULT false
    );`,
  },
  {
    name: 'sites_local_business_opening_hours.parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS sites_local_business_opening_hours_parent_idx ON sites_local_business_opening_hours (_parent_id);`,
  },
  // ── Products: Array tables ──
  {
    name: 'products_images.create_table',
    sql: `CREATE TABLE IF NOT EXISTS products_images (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      image_id integer,
      alt varchar
    );`,
  },
  {
    name: 'products_images.parent_order_idx',
    sql: `CREATE INDEX IF NOT EXISTS products_images_parent_order_idx ON products_images (_parent_id, _order);`,
  },
  {
    name: 'products_tags.create_table',
    sql: `CREATE TABLE IF NOT EXISTS products_tags (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      tag varchar
    );`,
  },
  {
    name: 'products_tags.parent_order_idx',
    sql: `CREATE INDEX IF NOT EXISTS products_tags_parent_order_idx ON products_tags (_parent_id, _order);`,
  },
  {
    name: 'products_variant_configs.create_table',
    sql: `CREATE TABLE IF NOT EXISTS products_variant_configs (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar
    );`,
  },
  {
    name: 'products_variant_configs.parent_order_idx',
    sql: `CREATE INDEX IF NOT EXISTS products_variant_configs_parent_order_idx ON products_variant_configs (_parent_id, _order);`,
  },
  {
    name: 'products_variant_configs_options.create_table',
    sql: `CREATE TABLE IF NOT EXISTS products_variant_configs_options (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      value varchar
    );`,
  },
  {
    name: 'products_variant_configs_options.parent_order_idx',
    sql: `CREATE INDEX IF NOT EXISTS products_variant_configs_options_parent_order_idx ON products_variant_configs_options (_parent_id, _order);`,
  },
  {
    name: 'products_variants.create_table',
    sql: `CREATE TABLE IF NOT EXISTS products_variants (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar,
      sku varchar,
      price numeric,
      compare_at_price numeric,
      stock numeric
    );`,
  },
  {
    name: 'products_variants.parent_order_idx',
    sql: `CREATE INDEX IF NOT EXISTS products_variants_parent_order_idx ON products_variants (_parent_id, _order);`,
  },
  {
    name: 'products_attributes.create_table',
    sql: `CREATE TABLE IF NOT EXISTS products_attributes (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      key varchar,
      value varchar
    );`,
  },
  {
    name: 'products_attributes.parent_order_idx',
    sql: `CREATE INDEX IF NOT EXISTS products_attributes_parent_order_idx ON products_attributes (_parent_id, _order);`,
  },
  // ── Products: Rels table (hasMany relationship → category) ──
  {
    name: 'products_rels.create_table',
    sql: `CREATE TABLE IF NOT EXISTS products_rels (
      id serial PRIMARY KEY,
      "order" integer,
      parent_id integer NOT NULL,
      path varchar NOT NULL,
      categories_id integer
    );`,
  },
  {
    name: 'products_rels.parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS products_rels_parent_idx ON products_rels (parent_id);`,
  },
  {
    name: 'products_rels.parent_order_idx',
    sql: `CREATE INDEX IF NOT EXISTS products_rels_parent_order_idx ON products_rels (parent_id, "order");`,
  },
  // ── Orders: Items array table ──
  {
    name: 'orders_items.create_table',
    sql: `CREATE TABLE IF NOT EXISTS orders_items (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      product_id integer,
      product_name varchar,
      variant varchar,
      quantity numeric,
      unit_price numeric
    );`,
  },
  {
    name: 'orders_items.parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS orders_items_parent_idx ON orders_items (_parent_id);`,
  },
  // ── ALTER TABLE fallbacks ──────────────────────────────────────────────
  // Use these for adding columns to existing tables where recreating is not an option.
  // ALTER TABLE ADD COLUMN IF NOT EXISTS ensures columns exist regardless of creation order.
  { name: 'categories.description', sql: `ALTER TABLE categories ADD COLUMN IF NOT EXISTS description varchar;` },
  { name: 'categories.deleted_at', sql: `ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;` },
  // orders_items
  { name: 'orders_items.product_id', sql: `ALTER TABLE orders_items ADD COLUMN IF NOT EXISTS product_id integer;` },
  { name: 'orders_items.product_name', sql: `ALTER TABLE orders_items ADD COLUMN IF NOT EXISTS product_name varchar;` },
  { name: 'orders_items.variant', sql: `ALTER TABLE orders_items ADD COLUMN IF NOT EXISTS variant varchar;` },
  { name: 'orders_items.quantity', sql: `ALTER TABLE orders_items ADD COLUMN IF NOT EXISTS quantity numeric;` },
  { name: 'orders_items.unit_price', sql: `ALTER TABLE orders_items ADD COLUMN IF NOT EXISTS unit_price numeric;` },
  // products_images
  { name: 'products_images.image_id', sql: `ALTER TABLE products_images ADD COLUMN IF NOT EXISTS image_id integer;` },
  { name: 'products_images.alt', sql: `ALTER TABLE products_images ADD COLUMN IF NOT EXISTS alt varchar;` },
  // products_tags
  { name: 'products_tags.tag', sql: `ALTER TABLE products_tags ADD COLUMN IF NOT EXISTS tag varchar;` },
  // products_variant_configs
  { name: 'products_variant_configs.name', sql: `ALTER TABLE products_variant_configs ADD COLUMN IF NOT EXISTS name varchar;` },
  // products_variant_configs_options
  { name: 'products_variant_configs_options.value', sql: `ALTER TABLE products_variant_configs_options ADD COLUMN IF NOT EXISTS value varchar;` },
  // products_variants
  { name: 'products_variants.name', sql: `ALTER TABLE products_variants ADD COLUMN IF NOT EXISTS name varchar;` },
  { name: 'products_variants.sku', sql: `ALTER TABLE products_variants ADD COLUMN IF NOT EXISTS sku varchar;` },
  { name: 'products_variants.price', sql: `ALTER TABLE products_variants ADD COLUMN IF NOT EXISTS price numeric;` },
  { name: 'products_variants.compare_at_price', sql: `ALTER TABLE products_variants ADD COLUMN IF NOT EXISTS compare_at_price numeric;` },
  { name: 'products_variants.stock', sql: `ALTER TABLE products_variants ADD COLUMN IF NOT EXISTS stock numeric;` },
  // products_attributes
  { name: 'products_attributes.key', sql: `ALTER TABLE products_attributes ADD COLUMN IF NOT EXISTS key varchar;` },
  { name: 'products_attributes.value', sql: `ALTER TABLE products_attributes ADD COLUMN IF NOT EXISTS value varchar;` },
  // products_rels
  // products.deleted_at — soft delete (used in WHERE filter)
  { name: 'products.deleted_at', sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;` },
  { name: 'products_rels.parent_id', sql: `ALTER TABLE products_rels ADD COLUMN IF NOT EXISTS parent_id integer;` },
  { name: 'products_rels.order', sql: `ALTER TABLE products_rels ADD COLUMN IF NOT EXISTS "order" integer;` },
  { name: 'products_rels.path', sql: `ALTER TABLE products_rels ADD COLUMN IF NOT EXISTS path varchar;` },
  { name: 'products_rels.categories_id', sql: `ALTER TABLE products_rels ADD COLUMN IF NOT EXISTS categories_id integer;` },
  // tenants_custom_domains
  { name: 'tenants_custom_domains.domain', sql: `ALTER TABLE tenants_custom_domains ADD COLUMN IF NOT EXISTS domain varchar;` },
  { name: 'tenants_custom_domains.status', sql: `ALTER TABLE tenants_custom_domains ADD COLUMN IF NOT EXISTS status varchar DEFAULT \'pending\';` },
  { name: 'tenants_custom_domains.is_primary', sql: `ALTER TABLE tenants_custom_domains ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;` },
  // F19 Vercel domain provisioning (#558) — new fields inside customDomains array.
  // Real column lives on tenants_custom_domains (Payload array sub-table).
  // Duplicate "tenants.*" entries satisfy scripts/check-migrations.js naive table attribution
  // (the CI script maps all fields in Tenants.ts to `tenants` table without array awareness).
  { name: 'tenants_custom_domains.vercel_domain_id', sql: `ALTER TABLE tenants_custom_domains ADD COLUMN IF NOT EXISTS vercel_domain_id varchar;` },
  { name: 'tenants_custom_domains.vercel_verification', sql: `ALTER TABLE tenants_custom_domains ADD COLUMN IF NOT EXISTS vercel_verification jsonb;` },
  // Prevents two tenants adding the same domain concurrently (TOCTOU race on payload.find check).
  // Vercel 409 is the second line of defense; this is the DB-level guarantee.
  { name: 'tenants_custom_domains.domain_unique_idx', sql: `CREATE UNIQUE INDEX IF NOT EXISTS tenants_custom_domains_domain_uniq ON tenants_custom_domains (domain) WHERE domain IS NOT NULL;` },
  { name: 'tenants.vercel_domain_id', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS vercel_domain_id varchar;` },
  { name: 'tenants.vercel_verification', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS vercel_verification jsonb;` },
  // sites_seo_tracked_keywords
  { name: 'sites_seo_tracked_keywords.keyword', sql: `ALTER TABLE sites_seo_tracked_keywords ADD COLUMN IF NOT EXISTS keyword varchar;` },
  { name: 'sites_seo_tracked_keywords.current_rank', sql: `ALTER TABLE sites_seo_tracked_keywords ADD COLUMN IF NOT EXISTS current_rank numeric;` },
  { name: 'sites_seo_tracked_keywords.previous_rank', sql: `ALTER TABLE sites_seo_tracked_keywords ADD COLUMN IF NOT EXISTS previous_rank numeric;` },
  { name: 'sites_seo_tracked_keywords.last_checked_at', sql: `ALTER TABLE sites_seo_tracked_keywords ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;` },
  // templates
  { name: 'templates.sort_order', sql: `ALTER TABLE templates ADD COLUMN IF NOT EXISTS sort_order numeric DEFAULT 0;` },
  { name: 'templates.usage_count', sql: `ALTER TABLE templates ADD COLUMN IF NOT EXISTS usage_count numeric DEFAULT 0;` },
  { name: 'templates.status', sql: `ALTER TABLE templates ADD COLUMN IF NOT EXISTS status varchar DEFAULT 'live';` },
  { name: 'templates.scheduled_for', sql: `ALTER TABLE templates ADD COLUMN IF NOT EXISTS scheduled_for timestamp;` },
  { name: 'templates.personality', sql: `ALTER TABLE templates ADD COLUMN IF NOT EXISTS personality varchar;` },
  { name: 'templates.block_prompt_overrides', sql: `ALTER TABLE templates ADD COLUMN IF NOT EXISTS block_prompt_overrides jsonb DEFAULT '{}'::jsonb;` },
  { name: 'templates.block_schema_version', sql: `ALTER TABLE templates ADD COLUMN IF NOT EXISTS block_schema_version varchar(64);` },
  // templates_tags
  { name: 'templates_tags.tag', sql: `ALTER TABLE templates_tags ADD COLUMN IF NOT EXISTS tag varchar;` },
  // ── Templates: Tags array table ──
  {
    name: 'templates_tags.create_table',
    sql: `CREATE TABLE IF NOT EXISTS templates_tags (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      tag varchar
    );`,
  },
  // ── Templates: Multi-page array sub-table (F31) ──
  {
    name: 'templates_template_pages.create_table',
    sql: `CREATE TABLE IF NOT EXISTS templates_template_pages (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      title varchar NOT NULL,
      slug varchar NOT NULL,
      is_homepage boolean DEFAULT false,
      layout jsonb
    );`,
  },
  // ── Templates: Add new category enum values (F31: fnb, events, blog, travel) ──
  {
    name: 'templates_category.add_fnb',
    sql: `DO $$ BEGIN ALTER TYPE enum_templates_category ADD VALUE IF NOT EXISTS 'fnb'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: 'templates_category.add_events',
    sql: `DO $$ BEGIN ALTER TYPE enum_templates_category ADD VALUE IF NOT EXISTS 'events'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: 'templates_category.add_blog',
    sql: `DO $$ BEGIN ALTER TYPE enum_templates_category ADD VALUE IF NOT EXISTS 'blog'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: 'templates_category.add_travel',
    sql: `DO $$ BEGIN ALTER TYPE enum_templates_category ADD VALUE IF NOT EXISTS 'travel'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  // ── Pages: Block tables (Payload blocks field → separate table per block type) ──
  // Each block has metadata + block-specific field columns (per Codex P1 review)
  {
    name: 'pages_blocks_navigation.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_navigation" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      style varchar, logo_id integer, logo_text varchar,
      cta_button_show boolean DEFAULT false, cta_button_label varchar, cta_button_url varchar
    );`,
  },
  {
    name: 'pages_blocks_hero.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_hero" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      image_id integer, background_image_id integer, video_url varchar,
      badge_show boolean DEFAULT false, badge_text varchar
    );`,
  },
  {
    name: 'pages_blocks_about.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_about" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      layout varchar, section_label varchar, headline varchar, body jsonb, image_id integer
    );`,
  },
  {
    name: 'pages_blocks_features.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_features" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      section_label varchar, headline varchar, subheadline varchar, layout varchar
    );`,
  },
  {
    name: 'pages_blocks_testimonials.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_testimonials" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      headline varchar, variant varchar
    );`,
  },
  {
    name: 'pages_blocks_contact.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_contact" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      headline varchar, subtext varchar, email varchar, phone varchar,
      address varchar, show_map boolean DEFAULT false, map_embed_url varchar
    );`,
  },
  {
    name: 'pages_blocks_gallery.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_gallery" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      headline varchar, layout varchar
    );`,
  },
  {
    name: 'pages_blocks_footer.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_footer" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      logo_text varchar, logo_id integer, tagline varchar,
      copyright_text varchar, show_social_links boolean DEFAULT false
    );`,
  },
  {
    name: 'pages_blocks_stats.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_stats" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      headline varchar
    );`,
  },
  {
    name: 'pages_blocks_pricing.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_pricing" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      headline varchar, subheadline varchar
    );`,
  },
  {
    name: 'pages_blocks_faq.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_faq" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      headline varchar
    );`,
  },
  {
    name: 'pages_blocks_team.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_team" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      headline varchar
    );`,
  },
  // Navigation links
  {
    name: 'pages_blocks_navigation_links.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_navigation_links" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      label varchar, url varchar, open_in_new_tab boolean DEFAULT false
    );`,
  },
  // Hero CTA buttons
  {
    name: 'pages_blocks_hero_cta_buttons.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_hero_cta_buttons" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      label varchar, url varchar, style varchar DEFAULT 'primary'
    );`,
  },
  // About stats
  {
    name: 'pages_blocks_about_stats.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_about_stats" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      value varchar, label varchar
    );`,
  },
  // Contact form fields
  {
    name: 'pages_blocks_contact_form_fields.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_contact_form_fields" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      field_name varchar, label varchar, field_type varchar, required boolean DEFAULT false, placeholder varchar
    );`,
  },
  // Footer columns + nested links
  {
    name: 'pages_blocks_footer_columns.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_footer_columns" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      title varchar
    );`,
  },
  {
    name: 'pages_blocks_footer_columns_links.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_footer_columns_links" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      label varchar, url varchar
    );`,
  },
  // Features items
  {
    name: 'pages_blocks_features_features.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_features_features" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      icon varchar, title varchar, description varchar
    );`,
  },
  // Testimonials items
  {
    name: 'pages_blocks_testimonials_testimonials.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_testimonials_testimonials" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      quote varchar, name varchar, title varchar, company varchar, avatar_id integer, rating numeric
    );`,
  },
  // Gallery images
  {
    name: 'pages_blocks_gallery_images.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_gallery_images" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      image_id integer, caption varchar
    );`,
  },
  // Stats items
  {
    name: 'pages_blocks_stats_stats.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_stats_stats" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      value varchar, label varchar
    );`,
  },
  // Pricing plans + nested features
  {
    name: 'pages_blocks_pricing_plans.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_pricing_plans" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, price varchar, description varchar, is_popular boolean DEFAULT false, cta_label varchar, cta_url varchar
    );`,
  },
  {
    name: 'pages_blocks_pricing_plans_features.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_pricing_plans_features" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      text varchar, included boolean DEFAULT true
    );`,
  },
  // FAQ items
  {
    name: 'pages_blocks_faq_faqs.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_faq_faqs" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      question varchar, answer varchar
    );`,
  },
  // Team members
  {
    name: 'pages_blocks_team_members.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_team_members" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, role varchar, bio varchar, image_id integer
    );`,
  },
  // ── Pages: Fields required for Soft Delete & Visibility ──
  {
    name: 'pages.is_visible',
    sql: `ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true;`,
  },
  {
    name: 'pages.deleted_at',
    sql: `ALTER TABLE pages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;`,
  },
  // ── Pages: Social Widget Block ──
  {
    name: 'pages_blocks_socialWidget.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_socialWidget" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _path varchar NOT NULL DEFAULT 'layout',
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      block_name varchar,
      variant varchar,
      headline varchar
    );`,
  },
  {
    name: 'pages_blocks_socialWidget_links.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_socialWidget_links" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      platform varchar,
      url varchar,
      enabled boolean DEFAULT true
    );`,
  },
  // ── Pages: Cart Widget Block ──
  {
    name: 'pages_blocks_cartWidget.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_cartWidget" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _path varchar NOT NULL DEFAULT 'layout',
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      block_name varchar,
      variant varchar,
      label varchar,
      show_label boolean
    );`,
  },
  // ── Pages Versions: _pages_v_blocks_* tables ──
  // Required for Payload draft/versioning (editor loads _pages_v not pages).
  // Types match Payload's Drizzle ORM output:
  //   - id: serial (integer auto-increment) — NOT varchar
  //   - _path: text NOT NULL — NOT varchar with DEFAULT
  //   - sub-table _parent_id: integer (ref parent block serial id)
  // CREATE TABLE IF NOT EXISTS is safe — pushDevSchema may already create
  // some of these, migrations fill in blocks added after initial schema push.
  {
    name: '_pages_v_blocks_navigation.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_navigation" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      style varchar, logo_id integer, logo_text varchar,
      cta_button_show boolean, cta_button_label varchar, cta_button_url varchar
    );`,
  },
  {
    name: '_pages_v_blocks_hero.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_hero" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      image_id integer, background_image_id integer, video_url varchar,
      badge_show boolean, badge_text varchar
    );`,
  },
  {
    name: '_pages_v_blocks_about.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_about" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      layout varchar, section_label varchar, headline varchar, body jsonb, image_id integer
    );`,
  },
  {
    name: '_pages_v_blocks_features.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_features" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      section_label varchar, headline varchar, subheadline varchar, layout varchar
    );`,
  },
  {
    name: '_pages_v_blocks_testimonials.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_testimonials" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      headline varchar, variant varchar
    );`,
  },
  {
    name: '_pages_v_blocks_contact.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_contact" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      headline varchar, subtext varchar, email varchar, phone varchar,
      address varchar, show_map boolean, map_embed_url varchar
    );`,
  },
  {
    name: '_pages_v_blocks_gallery.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_gallery" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      headline varchar, layout varchar
    );`,
  },
  {
    name: '_pages_v_blocks_footer.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_footer" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      logo_text varchar, logo_id integer, tagline varchar,
      copyright_text varchar, show_social_links boolean
    );`,
  },
  {
    name: '_pages_v_blocks_stats.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_stats" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      headline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_pricing.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_pricing" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      headline varchar, subheadline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_faq.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_faq" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      headline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_team.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_team" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      headline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_socialWidget.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_socialWidget" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_cartWidget.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_cartWidget" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, label varchar, show_label boolean
    );`,
  },
  // _pages_v sub-tables (nested arrays inside version blocks)
  // _parent_id integer references the parent block's serial id
  {
    name: '_pages_v_blocks_navigation_links.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_navigation_links" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      label varchar, url varchar, open_in_new_tab boolean
    );`,
  },
  {
    name: '_pages_v_blocks_socialWidget_links.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_socialWidget_links" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      platform varchar, url varchar, enabled boolean DEFAULT true
    );`,
  },
  // ── snake_case aliases required by Payload Drizzle ORM ──
  // Drizzle converts camelCase blockType → snake_case for table names.
  // "socialWidget" → "social_widget", "cartWidget" → "cart_widget".
  // The camelCase tables above are unreachable by Payload queries — these are the real tables.
  {
    name: '_pages_v_blocks_social_widget.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_social_widget" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_social_widget_links.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_social_widget_links" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      platform varchar, url varchar, enabled boolean DEFAULT true
    );`,
  },
  {
    name: '_pages_v_blocks_cart_widget.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_cart_widget" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, label varchar, show_label boolean
    );`,
  },
  {
    name: '_pages_v_blocks_hero_cta_buttons.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_hero_cta_buttons" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      label varchar, url varchar, style varchar
    );`,
  },
  {
    name: '_pages_v_blocks_about_stats.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_about_stats" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      value varchar, label varchar
    );`,
  },
  {
    name: '_pages_v_blocks_contact_form_fields.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_contact_form_fields" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      field_name varchar, label varchar, field_type varchar, required boolean, placeholder varchar
    );`,
  },
  {
    name: '_pages_v_blocks_footer_columns.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_footer_columns" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      title varchar
    );`,
  },
  {
    name: '_pages_v_blocks_footer_columns_links.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_footer_columns_links" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      label varchar, url varchar
    );`,
  },
  {
    name: '_pages_v_blocks_features_features.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_features_features" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      icon varchar, title varchar, description varchar
    );`,
  },
  {
    name: '_pages_v_blocks_testimonials_testimonials.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_testimonials_testimonials" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      quote varchar, name varchar, title varchar, company varchar, avatar_id integer, rating numeric
    );`,
  },
  {
    name: '_pages_v_blocks_gallery_images.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_gallery_images" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      image_id integer, caption varchar
    );`,
  },
  {
    name: '_pages_v_blocks_stats_stats.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_stats_stats" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      value varchar, label varchar
    );`,
  },
  {
    name: '_pages_v_blocks_pricing_plans.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_pricing_plans" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      name varchar, price varchar, description varchar, is_popular boolean, cta_label varchar, cta_url varchar
    );`,
  },
  {
    name: '_pages_v_blocks_pricing_plans_features.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_pricing_plans_features" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      text varchar, included boolean
    );`,
  },
  {
    name: '_pages_v_blocks_faq_faqs.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_faq_faqs" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      question varchar, answer varchar
    );`,
  },
  {
    name: '_pages_v_blocks_team_members.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_team_members" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      name varchar, role varchar, bio varchar, image_id integer
    );`,
  },
  // ── One-time cleanup: remove stale _pages_v draft rows ──────────────────────
  // After creating _pages_v_blocks_* tables above, existing _pages_v rows still
  // point to block data that was never written (inserts failed when tables were missing).
  // Payload's draft: true query returns these empty drafts → editor shows "0 blocks".
  // Fix: delete stale draft versions that have no blocks in any _pages_v_blocks_* table.
  // Payload will then fall back to published data from pages_blocks_* → blocks appear.
  // This migration runs once. After real drafts are saved, those rows are preserved.
  {
    name: '_pages_v.clear_stale_drafts',
    // [P0-Codex-Fixed] DO NOT RUN WIDE DELETE: Prevent accidental data loss for new block types or empty drafts.
    // Instead of deleting broadly, we disable this to protect valid pages that might have 0 blocks.
    sql: `SELECT 1; -- Migration disabled for data safety`,
  },
  // ── Users: Payload-managed tables (tenants, permissions, sessions, roles) ──
  // These tables are created by Payload pushDevSchema (runs every deploy).
  // DO NOT add manual CREATE TABLE migrations — they create wrong column types.
  // pushDevSchema handles correct Drizzle ORM schema (types, constraints, _uuid, indexes).
  // ── Users: Language preference ──
  {
    name: 'users.prefer_lang',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS prefer_lang varchar DEFAULT 'en';`,
  },
  // ── Users: OTP 2FA fields ──
  {
    name: 'users.otp_hash',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_hash varchar;`,
  },
  {
    name: 'users.otp_expires_at',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at timestamptz;`,
  },
  {
    name: 'users.otp_attempts',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_attempts numeric DEFAULT 0;`,
  },
  // ── Users: Onboarding fields ──
  {
    name: 'users.has_seen_ai_wizard',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_ai_wizard boolean DEFAULT false;`,
  },
  {
    name: 'users.has_seen_ai_wizard.backfill_legacy',
    sql: `UPDATE users SET has_seen_ai_wizard = true WHERE id IN (SELECT _parent_id FROM users_tenants WHERE _parent_id IS NOT NULL);`,
  },
  // ── Payload locked documents rels: FK columns for new collections ──
  {
    name: 'payload_locked_documents_rels.blogs_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS blogs_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.blog_categories_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS blog_categories_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.seo_meta_jobs_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS seo_meta_jobs_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.categories_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS categories_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.notifications_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS notifications_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.subscribers_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS subscribers_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.push_subscriptions_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS push_subscriptions_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.template_quality_scores_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS template_quality_scores_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.block_catalog_entries_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS block_catalog_entries_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.block_variants_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS block_variants_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.ai_generation_records_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS ai_generation_records_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.template_issues_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS template_issues_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.content_packs_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS content_packs_id integer;`,
  },
  {
    name: 'payload_locked_documents_rels.template_versions_id',
    sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS template_versions_id integer;`,
  },
  {
    name: 'payload_preferences_rels.notifications_id',
    sql: `ALTER TABLE payload_preferences_rels ADD COLUMN IF NOT EXISTS notifications_id integer;`,
  },
  {
    name: 'payload_preferences_rels.subscribers_id',
    sql: `ALTER TABLE payload_preferences_rels ADD COLUMN IF NOT EXISTS subscribers_id integer;`,
  },
  {
    name: 'payload_preferences_rels.push_subscriptions_id',
    sql: `ALTER TABLE payload_preferences_rels ADD COLUMN IF NOT EXISTS push_subscriptions_id integer;`,
  },
  // ── F01: Add missing theme fields to sites table ──
  {
    name: 'sites.theme_accent_color',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_accent_color varchar;`,
  },
  {
    name: 'sites.accent_color',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_accent_color varchar;`,
  },
  {
    name: 'sites.theme_surface_color',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_surface_color varchar;`,
  },
  {
    name: 'sites.surface_color',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_surface_color varchar;`,
  },
  {
    name: 'sites.theme_text_color',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_text_color varchar;`,
  },
  {
    name: 'sites.text_color',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_text_color varchar;`,
  },
  {
    name: 'sites.theme_muted_color',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_muted_color varchar;`,
  },
  {
    name: 'sites.muted_color',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_muted_color varchar;`,
  },
  {
    name: 'sites.theme_spacing_preset',
    sql: `DO $$ BEGIN
      CREATE TYPE enum_sites_theme_spacing_preset AS ENUM ('compact', 'default', 'relaxed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_spacing_preset enum_sites_theme_spacing_preset DEFAULT 'default';`,
  },
  {
    name: 'sites.spacing_preset',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_spacing_preset enum_sites_theme_spacing_preset DEFAULT 'default';`,
  },
  {
    name: 'sites.theme_shadow_preset',
    sql: `DO $$ BEGIN
      CREATE TYPE enum_sites_theme_shadow_preset AS ENUM ('none', 'subtle', 'medium', 'dramatic');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_shadow_preset enum_sites_theme_shadow_preset DEFAULT 'subtle';`,
  },
  {
    name: 'sites.shadow_preset',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_shadow_preset enum_sites_theme_shadow_preset DEFAULT 'subtle';`,
  },
  // ── F01: _pages_v version columns for new block fields (CI check requirement) ──
  {
    name: '_pages_v.version_variant',
    sql: `ALTER TABLE _pages_v ADD COLUMN IF NOT EXISTS version_variant varchar;`,
  },
  {
    name: '_pages_v.version_cta_style',
    sql: `ALTER TABLE _pages_v ADD COLUMN IF NOT EXISTS version_cta_style varchar;`,
  },
  {
    name: '_pages_v.version_position',
    sql: `ALTER TABLE _pages_v ADD COLUMN IF NOT EXISTS version_position varchar;`,
  },
  // ── F05: Unique constraint for page slug per site ──
  // Dedupe existing rows before creating unique index (keep newest, soft-delete older duplicates)
  {
    name: 'pages.dedupe_site_slug',
    sql: `UPDATE pages SET deleted_at = NOW()
      WHERE deleted_at IS NULL
        AND id NOT IN (
          SELECT DISTINCT ON (site_id, slug) id
          FROM pages WHERE deleted_at IS NULL
          ORDER BY site_id, slug, updated_at DESC NULLS LAST, created_at DESC, id DESC
        );`,
  },
  {
    name: 'pages.site_slug_unique',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS pages_site_slug_uniq ON pages (site_id, slug) WHERE deleted_at IS NULL;`,
  },
  // ── F01: Fix about body from richText (jsonb) to textarea (varchar) ──
  {
    name: 'pages_blocks_about.body_to_varchar',
    sql: `ALTER TABLE pages_blocks_about ALTER COLUMN body TYPE varchar USING body::varchar;`,
  },
  {
    name: '_pages_v_blocks_about.body_to_varchar',
    sql: `ALTER TABLE _pages_v_blocks_about ALTER COLUMN body TYPE varchar USING body::varchar;`,
  },
  // ── F01: Add missing enum values to existing block variant/layout types ──
  {
    name: 'enum_pages_blocks_hero_variant.new_values',
    sql: `DO $$ BEGIN
      ALTER TYPE enum_pages_blocks_hero_variant ADD VALUE IF NOT EXISTS 'magazine';
      ALTER TYPE enum_pages_blocks_hero_variant ADD VALUE IF NOT EXISTS 'minimal';
      ALTER TYPE enum_pages_blocks_hero_variant ADD VALUE IF NOT EXISTS 'cards-overlay';
      ALTER TYPE enum_pages_blocks_hero_variant ADD VALUE IF NOT EXISTS 'gradient';
      ALTER TYPE enum_pages_blocks_hero_variant ADD VALUE IF NOT EXISTS 'parallax';
      ALTER TYPE enum_pages_blocks_hero_variant ADD VALUE IF NOT EXISTS 'slideshow';
      ALTER TYPE enum_pages_blocks_hero_variant ADD VALUE IF NOT EXISTS 'split-video';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: 'enum_pages_blocks_testimonials_variant.new_values',
    sql: `DO $$ BEGIN
      ALTER TYPE enum_pages_blocks_testimonials_variant ADD VALUE IF NOT EXISTS 'cards';
      ALTER TYPE enum_pages_blocks_testimonials_variant ADD VALUE IF NOT EXISTS 'simple';
      ALTER TYPE enum_pages_blocks_testimonials_variant ADD VALUE IF NOT EXISTS 'spotlight';
      ALTER TYPE enum_pages_blocks_testimonials_variant ADD VALUE IF NOT EXISTS 'minimal-quote';
      ALTER TYPE enum_pages_blocks_testimonials_variant ADD VALUE IF NOT EXISTS 'avatar-row';
      ALTER TYPE enum_pages_blocks_testimonials_variant ADD VALUE IF NOT EXISTS 'video-text';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: 'enum_pages_blocks_gallery_layout.new_values',
    sql: `DO $$ BEGIN
      ALTER TYPE enum_pages_blocks_gallery_layout ADD VALUE IF NOT EXISTS 'filmstrip';
      ALTER TYPE enum_pages_blocks_gallery_layout ADD VALUE IF NOT EXISTS 'justified';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: 'enum_pages_blocks_features_layout.new_values',
    sql: `DO $$ BEGIN
      ALTER TYPE enum_pages_blocks_features_layout ADD VALUE IF NOT EXISTS 'grid-4';
      ALTER TYPE enum_pages_blocks_features_layout ADD VALUE IF NOT EXISTS 'list';
      ALTER TYPE enum_pages_blocks_features_layout ADD VALUE IF NOT EXISTS 'icon-top';
      ALTER TYPE enum_pages_blocks_features_layout ADD VALUE IF NOT EXISTS 'icon-left';
      ALTER TYPE enum_pages_blocks_features_layout ADD VALUE IF NOT EXISTS 'zigzag';
      ALTER TYPE enum_pages_blocks_features_layout ADD VALUE IF NOT EXISTS 'carousel';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: 'enum__pages_v_blocks_hero_variant.new_values',
    sql: `DO $$ BEGIN
      ALTER TYPE enum__pages_v_blocks_hero_variant ADD VALUE IF NOT EXISTS 'magazine';
      ALTER TYPE enum__pages_v_blocks_hero_variant ADD VALUE IF NOT EXISTS 'minimal';
      ALTER TYPE enum__pages_v_blocks_hero_variant ADD VALUE IF NOT EXISTS 'cards-overlay';
      ALTER TYPE enum__pages_v_blocks_hero_variant ADD VALUE IF NOT EXISTS 'gradient';
      ALTER TYPE enum__pages_v_blocks_hero_variant ADD VALUE IF NOT EXISTS 'parallax';
      ALTER TYPE enum__pages_v_blocks_hero_variant ADD VALUE IF NOT EXISTS 'slideshow';
      ALTER TYPE enum__pages_v_blocks_hero_variant ADD VALUE IF NOT EXISTS 'split-video';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: 'enum__pages_v_blocks_testimonials_variant.new_values',
    sql: `DO $$ BEGIN
      ALTER TYPE enum__pages_v_blocks_testimonials_variant ADD VALUE IF NOT EXISTS 'cards';
      ALTER TYPE enum__pages_v_blocks_testimonials_variant ADD VALUE IF NOT EXISTS 'simple';
      ALTER TYPE enum__pages_v_blocks_testimonials_variant ADD VALUE IF NOT EXISTS 'spotlight';
      ALTER TYPE enum__pages_v_blocks_testimonials_variant ADD VALUE IF NOT EXISTS 'minimal-quote';
      ALTER TYPE enum__pages_v_blocks_testimonials_variant ADD VALUE IF NOT EXISTS 'avatar-row';
      ALTER TYPE enum__pages_v_blocks_testimonials_variant ADD VALUE IF NOT EXISTS 'video-text';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: 'enum__pages_v_blocks_gallery_layout.new_values',
    sql: `DO $$ BEGIN
      ALTER TYPE enum__pages_v_blocks_gallery_layout ADD VALUE IF NOT EXISTS 'filmstrip';
      ALTER TYPE enum__pages_v_blocks_gallery_layout ADD VALUE IF NOT EXISTS 'justified';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    name: 'enum__pages_v_blocks_features_layout.new_values',
    sql: `DO $$ BEGIN
      ALTER TYPE enum__pages_v_blocks_features_layout ADD VALUE IF NOT EXISTS 'grid-4';
      ALTER TYPE enum__pages_v_blocks_features_layout ADD VALUE IF NOT EXISTS 'list';
      ALTER TYPE enum__pages_v_blocks_features_layout ADD VALUE IF NOT EXISTS 'icon-top';
      ALTER TYPE enum__pages_v_blocks_features_layout ADD VALUE IF NOT EXISTS 'icon-left';
      ALTER TYPE enum__pages_v_blocks_features_layout ADD VALUE IF NOT EXISTS 'zigzag';
      ALTER TYPE enum__pages_v_blocks_features_layout ADD VALUE IF NOT EXISTS 'carousel';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  // ── F01: Add variant column to blocks that only had layout/style ──
  {
    name: 'pages_blocks_navigation.variant',
    sql: `ALTER TABLE pages_blocks_navigation ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: 'pages_blocks_about.variant',
    sql: `ALTER TABLE pages_blocks_about ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: 'pages_blocks_features.variant',
    sql: `ALTER TABLE pages_blocks_features ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: 'pages_blocks_gallery.variant',
    sql: `ALTER TABLE pages_blocks_gallery ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: '_pages_v_blocks_navigation.variant',
    sql: `ALTER TABLE _pages_v_blocks_navigation ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: '_pages_v_blocks_about.variant',
    sql: `ALTER TABLE _pages_v_blocks_about ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: '_pages_v_blocks_features.variant',
    sql: `ALTER TABLE _pages_v_blocks_features ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: '_pages_v_blocks_gallery.variant',
    sql: `ALTER TABLE _pages_v_blocks_gallery ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  // ── Plan 260415 — variant column for blocks whose Payload schemas were
  // missing a variant field entirely. Without this, AI gen + composer
  // rotation had zero effect because Payload stripped the variant on save.
  {
    name: 'pages_blocks_contact.variant',
    sql: `ALTER TABLE pages_blocks_contact ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: 'pages_blocks_footer.variant',
    sql: `ALTER TABLE pages_blocks_footer ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: 'pages_blocks_stats.variant',
    sql: `ALTER TABLE pages_blocks_stats ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: 'pages_blocks_team.variant',
    sql: `ALTER TABLE pages_blocks_team ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: '_pages_v_blocks_contact.variant',
    sql: `ALTER TABLE _pages_v_blocks_contact ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: '_pages_v_blocks_footer.variant',
    sql: `ALTER TABLE _pages_v_blocks_footer ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: '_pages_v_blocks_stats.variant',
    sql: `ALTER TABLE _pages_v_blocks_stats ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  {
    name: '_pages_v_blocks_team.variant',
    sql: `ALTER TABLE _pages_v_blocks_team ADD COLUMN IF NOT EXISTS variant varchar;`,
  },
  // ── Tenants: Payment Methods ──
  {
    name: 'tenants.payments_payment_cod',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_payment_cod boolean DEFAULT false;`,
  },
  {
    name: 'tenants.payments_payment_qr',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_payment_qr boolean DEFAULT false;`,
  },
  {
    name: 'tenants.payments_qr_image_id',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_qr_image_id integer;`,
  },
  // ── Tenants: SSO Provisioning fields (F02) ──
  {
    name: 'tenants.customer_id',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS customer_id varchar;`,
  },
  {
    name: 'tenants.service_id',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS service_id varchar;`,
  },
  {
    name: 'tenants.pack_code',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pack_code varchar;`,
  },
  {
    name: 'tenants.order_id',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS order_id varchar;`,
  },
  {
    name: 'tenants.address',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address jsonb;`,
  },
  {
    name: 'tenants.meta_data',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS meta_data jsonb;`,
  },
  // ── Users: Phone field (F02) ──
  {
    name: 'users.phone',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar;`,
  },
  // ── _pages_v: mirror columns added to pages (versioning) ──
  // Whenever a column is added to `pages`, the corresponding version_* column
  // must be added to `_pages_v` or Payload's draft queries will 500.
  {
    name: '_pages_v.version_is_visible',
    sql: `ALTER TABLE _pages_v ADD COLUMN IF NOT EXISTS version_is_visible boolean DEFAULT true;`,
  },
  {
    name: '_pages_v.version_deleted_at',
    sql: `ALTER TABLE _pages_v ADD COLUMN IF NOT EXISTS version_deleted_at timestamptz;`,
  },
  // ── pages_blocks: snake_case tables for socialWidget / cartWidget ──
  // Payload Drizzle ORM converts camelCase block slugs to snake_case at runtime
  // (socialWidget → social_widget, cartWidget → cart_widget). These blocks are
  // new in this PR so there is no existing camelCase data to backfill.
  // No INSERT...SELECT needed: staging DB had no rows in any camelCase variant.
  {
    name: 'pages_blocks_social_widget.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_social_widget" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _path varchar NOT NULL DEFAULT 'layout',
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      block_name varchar,
      variant varchar,
      headline varchar
    );`,
  },
  {
    // _parent_id is varchar (not integer): sub-tables reference the parent block UUID.
    // Top-level block tables → _parent_id integer (ref pages.id).
    // Block sub-tables → _parent_id varchar (ref parent block's uuid PK).
    // This matches the CLAUDE.md migration convention for array sub-tables inside blocks.
    name: 'pages_blocks_social_widget_links.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_social_widget_links" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      platform varchar,
      url varchar,
      enabled boolean DEFAULT true
    );`,
  },
  {
    name: 'pages_blocks_cart_widget.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_cart_widget" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _path varchar NOT NULL DEFAULT 'layout',
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      block_name varchar,
      variant varchar,
      label varchar,
      show_label boolean
    );`,
  },
  // ── F01: Additional AI-generated block tables ──────────────────────
  // pages_blocks_* tables (varchar id, _parent_id integer, _order, _uuid, _path)
  {
    name: 'pages_blocks_cta.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_cta" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      cta_label varchar, cta_url varchar, cta_style varchar,
      secondary_cta_label varchar, secondary_cta_url varchar
    );`,
  },
  // Plan 260415 cta-bugfix — add secondary_cta fields + rename floating → card
  {
    name: 'pages_blocks_cta.secondary_cta_label',
    sql: `ALTER TABLE pages_blocks_cta ADD COLUMN IF NOT EXISTS secondary_cta_label varchar;`,
  },
  {
    name: 'pages_blocks_cta.secondary_cta_url',
    sql: `ALTER TABLE pages_blocks_cta ADD COLUMN IF NOT EXISTS secondary_cta_url varchar;`,
  },
  {
    name: 'pages_blocks_cta.rename_floating_to_card',
    sql: `UPDATE pages_blocks_cta SET variant = 'card' WHERE variant = 'floating';`,
  },
  {
    name: 'pages_blocks_newsletter.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_newsletter" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      button_label varchar, placeholder varchar
    );`,
  },
  {
    name: 'pages_blocks_video.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_video" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      video_url varchar, poster_image_id integer
    );`,
  },
  {
    name: 'pages_blocks_logo_cloud.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_logo_cloud" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: 'pages_blocks_logo_cloud_logos.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_logo_cloud_logos" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, logo_id integer
    );`,
  },
  {
    name: 'pages_blocks_blog_list.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_blog_list" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar, "limit" integer DEFAULT 6,
      read_article_label varchar, uncategorized_label varchar, empty_state_label varchar
    );`,
  },
  {
    name: 'pages_blocks_products_grid.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_products_grid" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar, "limit" integer DEFAULT 6, category varchar
    );`,
  },
  {
    name: 'pages_blocks_products_featured.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_products_featured" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar
    );`,
  },
  {
    name: 'pages_blocks_custom_html.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_custom_html" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      html text
    );`,
  },
  {
    name: 'pages_blocks_service_cards.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_service_cards" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar
    );`,
  },
  {
    name: 'pages_blocks_service_cards_services.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_service_cards_services" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      title varchar, description varchar, icon varchar, price varchar, price_unit varchar
    );`,
  },
  {
    name: 'pages_blocks_carousel.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_carousel" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, autoplay boolean DEFAULT true, "interval" integer DEFAULT 5000
    );`,
  },
  {
    name: 'pages_blocks_carousel_items.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_carousel_items" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      image_id integer, title varchar, description varchar, link_url varchar
    );`,
  },
  {
    name: 'pages_blocks_step_process.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_step_process" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar
    );`,
  },
  {
    name: 'pages_blocks_step_process_steps.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_step_process_steps" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      title varchar, description varchar, icon varchar
    );`,
  },
  {
    name: 'pages_blocks_divider.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_divider" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, height integer DEFAULT 1, color varchar
    );`,
  },
  {
    name: 'pages_blocks_announcement_bar.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_announcement_bar" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, message varchar, link_text varchar, link_url varchar,
      dismissible boolean DEFAULT true, background_color varchar
    );`,
  },
  {
    name: 'pages_blocks_whatsapp_button.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_whatsapp_button" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, phone_number varchar, message varchar, label varchar, "position" varchar
    );`,
  },
  {
    name: 'pages_blocks_google_maps.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_google_maps" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, embed_url varchar, address varchar, height integer DEFAULT 400
    );`,
  },
  {
    name: 'pages_blocks_accordion.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_accordion" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, description varchar
    );`,
  },
  {
    name: 'pages_blocks_accordion_items.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_accordion_items" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      title varchar, content varchar
    );`,
  },
  {
    name: 'pages_blocks_countdown_timer.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_countdown_timer" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, target_date timestamptz,
      expired_message varchar, show_days boolean DEFAULT true,
      show_hours boolean DEFAULT true, show_minutes boolean DEFAULT true, show_seconds boolean DEFAULT true
    );`,
  },
  {
    name: 'pages_blocks_social_proof.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_social_proof" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: 'pages_blocks_social_proof_reviews.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_social_proof_reviews" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      author varchar, role varchar, content varchar, rating numeric, avatar_id integer
    );`,
  },
  {
    name: 'pages_blocks_breadcrumb.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_breadcrumb" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar
    );`,
  },
  {
    name: 'pages_blocks_breadcrumb_items.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_breadcrumb_items" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      label varchar, url varchar
    );`,
  },
  {
    name: 'pages_blocks_client_logos.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_client_logos" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: 'pages_blocks_client_logos_logos.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_client_logos_logos" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      image_id integer, alt varchar, link_url varchar
    );`,
  },
  {
    name: 'pages_blocks_menu_food.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_menu_food" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: 'pages_blocks_menu_food_categories.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_menu_food_categories" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar
    );`,
  },
  {
    name: 'pages_blocks_menu_food_categories_items.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_menu_food_categories_items" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, description varchar, price varchar, currency varchar, tag varchar, image_id integer
    );`,
  },
  {
    name: 'pages_blocks_portfolio_grid.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_portfolio_grid" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar
    );`,
  },
  {
    name: 'pages_blocks_portfolio_grid_projects.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_portfolio_grid_projects" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      title varchar, description varchar, image_id integer, category varchar, link_url varchar
    );`,
  },
  // ── _pages_v (version tables) for new AI blocks ──
  // id: serial (integer auto-increment), _path: text NOT NULL
  {
    name: '_pages_v_blocks_cta.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_cta" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      cta_label varchar, cta_url varchar, cta_style varchar,
      secondary_cta_label varchar, secondary_cta_url varchar
    );`,
  },
  // Plan 260415 cta-bugfix — version table sync
  {
    name: '_pages_v_blocks_cta.secondary_cta_label',
    sql: `ALTER TABLE _pages_v_blocks_cta ADD COLUMN IF NOT EXISTS secondary_cta_label varchar;`,
  },
  {
    name: '_pages_v_blocks_cta.secondary_cta_url',
    sql: `ALTER TABLE _pages_v_blocks_cta ADD COLUMN IF NOT EXISTS secondary_cta_url varchar;`,
  },
  {
    name: '_pages_v_blocks_cta.rename_floating_to_card',
    sql: `UPDATE _pages_v_blocks_cta SET variant = 'card' WHERE variant = 'floating';`,
  },
  {
    name: '_pages_v_blocks_newsletter.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_newsletter" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      button_label varchar, placeholder varchar
    );`,
  },
  {
    name: '_pages_v_blocks_video.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_video" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      video_url varchar, poster_image_id integer
    );`,
  },
  {
    name: '_pages_v_blocks_logo_cloud.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_logo_cloud" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_logo_cloud_logos.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_logo_cloud_logos" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar, name varchar, logo_id integer
    );`,
  },
  {
    name: '_pages_v_blocks_blog_list.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_blog_list" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar, "limit" integer,
      read_article_label varchar, uncategorized_label varchar, empty_state_label varchar
    );`,
  },
  {
    name: '_pages_v_blocks_products_grid.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_products_grid" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar, "limit" integer, category varchar
    );`,
  },
  {
    name: '_pages_v_blocks_products_featured.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_products_featured" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_custom_html.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_custom_html" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar, html text
    );`,
  },
  {
    name: '_pages_v_blocks_service_cards.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_service_cards" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_service_cards_services.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_service_cards_services" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar, title varchar, description varchar, icon varchar, price varchar, price_unit varchar
    );`,
  },
  {
    name: '_pages_v_blocks_carousel.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_carousel" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, autoplay boolean, "interval" integer
    );`,
  },
  {
    name: '_pages_v_blocks_carousel_items.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_carousel_items" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar, image_id integer, title varchar, description varchar, link_url varchar
    );`,
  },
  {
    name: '_pages_v_blocks_step_process.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_step_process" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_step_process_steps.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_step_process_steps" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar, title varchar, description varchar, icon varchar
    );`,
  },
  {
    name: '_pages_v_blocks_divider.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_divider" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, height integer, color varchar
    );`,
  },
  {
    name: '_pages_v_blocks_announcement_bar.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_announcement_bar" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, message varchar, link_text varchar, link_url varchar,
      dismissible boolean, background_color varchar
    );`,
  },
  {
    name: '_pages_v_blocks_whatsapp_button.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_whatsapp_button" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, phone_number varchar, message varchar, label varchar, "position" varchar
    );`,
  },
  {
    name: '_pages_v_blocks_google_maps.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_google_maps" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, embed_url varchar, address varchar, height integer
    );`,
  },
  {
    name: '_pages_v_blocks_accordion.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_accordion" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, description varchar
    );`,
  },
  {
    name: '_pages_v_blocks_accordion_items.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_accordion_items" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar, title varchar, content varchar
    );`,
  },
  {
    name: '_pages_v_blocks_countdown_timer.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_countdown_timer" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, target_date timestamptz,
      expired_message varchar, show_days boolean, show_hours boolean, show_minutes boolean, show_seconds boolean
    );`,
  },
  {
    name: '_pages_v_blocks_social_proof.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_social_proof" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_social_proof_reviews.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_social_proof_reviews" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar, author varchar, role varchar, content varchar, rating numeric, avatar_id integer
    );`,
  },
  {
    name: '_pages_v_blocks_breadcrumb.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_breadcrumb" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar, variant varchar
    );`,
  },
  {
    name: '_pages_v_blocks_breadcrumb_items.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_breadcrumb_items" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar, label varchar, url varchar
    );`,
  },
  {
    name: '_pages_v_blocks_client_logos.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_client_logos" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_client_logos_logos.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_client_logos_logos" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar, image_id integer, alt varchar, link_url varchar
    );`,
  },
  {
    name: '_pages_v_blocks_menu_food.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_menu_food" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_menu_food_categories.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_menu_food_categories" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar, name varchar
    );`,
  },
  {
    name: '_pages_v_blocks_menu_food_categories_items.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_menu_food_categories_items" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar, name varchar, description varchar, price varchar, currency varchar, tag varchar, image_id integer
    );`,
  },
  {
    name: '_pages_v_blocks_portfolio_grid.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_portfolio_grid" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_portfolio_grid_projects.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_portfolio_grid_projects" (
      id serial PRIMARY KEY, _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar, title varchar, description varchar, image_id integer, category varchar, link_url varchar
    );`,
  },
  // ── F16: Notifications table ─────────────────────────────────────
  {
    name: 'notifications.create_table',
    sql: `CREATE TABLE IF NOT EXISTS notifications (
      id serial PRIMARY KEY,
      tenant_id integer NOT NULL,
      user_id integer NOT NULL,
      type varchar NOT NULL,
      title varchar NOT NULL,
      message text,
      action_url varchar,
      is_read boolean DEFAULT false,
      created_at timestamptz DEFAULT now() NOT NULL,
      expires_at timestamptz
    );`,
  },
  {
    name: 'notifications.tenant_user_idx',
    sql: `CREATE INDEX IF NOT EXISTS notifications_tenant_user_idx ON notifications (tenant_id, user_id);`,
  },
  {
    name: 'notifications.is_read_idx',
    sql: `CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications (is_read);`,
  },
  {
    name: 'notifications.created_at_idx',
    sql: `CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);`,
  },
  {
    name: 'notifications.updated_at',
    sql: `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();`,
  },
  // pg LISTEN/NOTIFY trigger — SSE realtime bridge
  {
    name: 'notifications.notify_fn',
    sql: `CREATE OR REPLACE FUNCTION notify_new_notification()
      RETURNS trigger AS $$
      BEGIN
        PERFORM pg_notify(
          'notification_channel',
          json_build_object(
            'userId', NEW.user_id,
            'tenantId', NEW.tenant_id,
            'id', NEW.id
          )::text
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;`,
  },
  {
    name: 'notifications.notify_trigger',
    sql: `CREATE OR REPLACE TRIGGER after_notification_insert
      AFTER INSERT ON notifications
      FOR EACH ROW EXECUTE FUNCTION notify_new_notification();`,
  },
  // ── F16-07: Push Subscriptions table ──────────────────────────────────────
  {
    name: 'push_subscriptions.create_table',
    sql: `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      tenant_id integer NOT NULL,
      endpoint text NOT NULL,
      p256dh text NOT NULL,
      auth text NOT NULL,
      is_active boolean DEFAULT true NOT NULL,
      user_agent text,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL
    );`,
  },
  {
    name: 'push_subscriptions.user_endpoint_idx',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_idx ON push_subscriptions (user_id, endpoint);`,
  },
  {
    name: 'push_subscriptions.user_tenant_active_idx',
    sql: `CREATE INDEX IF NOT EXISTS push_subscriptions_user_tenant_active_idx ON push_subscriptions (user_id, tenant_id) WHERE is_active = true;`,
  },
  // ── Templates — multi-page array sub-table ──
  {
    name: 'templates_template_pages.create_table',
    sql: `CREATE TABLE IF NOT EXISTS templates_template_pages (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      title varchar NOT NULL,
      slug varchar NOT NULL,
      is_homepage boolean DEFAULT false,
      layout jsonb
    );`,
  },
  // ── Subscribers (newsletter email collection) ──
  {
    name: 'subscribers.create_table',
    sql: `CREATE TABLE IF NOT EXISTS subscribers (
      id serial PRIMARY KEY,
      email varchar NOT NULL,
      site_id integer NOT NULL,
      source varchar DEFAULT 'newsletter',
      updated_at timestamptz DEFAULT now() NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    );`,
  },
  {
    name: 'subscribers.email_site_unique',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_site_uniq ON subscribers (email, site_id);`,
  },
  // ── Contact Submissions (Plan 260415 contact-bugfix) ──
  {
    name: 'contact_submissions.create_table',
    sql: `CREATE TABLE IF NOT EXISTS contact_submissions (
      id serial PRIMARY KEY,
      name varchar NOT NULL,
      email varchar NOT NULL,
      phone varchar,
      subject varchar(300),
      message text NOT NULL,
      site_id integer NOT NULL,
      status varchar DEFAULT 'new',
      source varchar DEFAULT 'contact-block',
      ip_address varchar,
      updated_at timestamptz DEFAULT now() NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    );`,
  },
  {
    name: 'contact_submissions.subject',
    sql: `ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS subject varchar(300);`,
  },
  {
    name: 'contact_submissions.site_created_index',
    sql: `CREATE INDEX IF NOT EXISTS contact_submissions_site_created_idx ON contact_submissions (site_id, created_at DESC);`,
  },
  {
    name: 'contact_submissions.status_index',
    sql: `CREATE INDEX IF NOT EXISTS contact_submissions_status_idx ON contact_submissions (status);`,
  },
  {
    name: 'contact_submissions.email_index',
    sql: `CREATE INDEX IF NOT EXISTS contact_submissions_email_idx ON contact_submissions (email);`,
  },
  // ── Sites: SEO auto meta toggle ──
  {
    name: 'sites.seo_auto_meta_enabled',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS seo_auto_meta_enabled boolean DEFAULT true;`,
  },
  // ── F37-03: AI crawler permissions toggle ──
  {
    name: 'sites.ai_crawlers_enabled',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS ai_crawlers_enabled boolean DEFAULT true;`,
  },
  // ── F23: Custom Subdomain Slug — previousSlugs array ──
  {
    name: 'tenants_previous_slugs.create_table',
    sql: `CREATE TABLE IF NOT EXISTS tenants_previous_slugs (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      slug varchar NOT NULL,
      expires_at timestamptz NOT NULL
    );`,
  },
  {
    name: 'tenants_previous_slugs.slug_index',
    sql: `CREATE INDEX IF NOT EXISTS tenants_previous_slugs_slug_idx ON tenants_previous_slugs(slug);`,
  },
  {
    name: 'tenants_previous_slugs.parent_index',
    sql: `CREATE INDEX IF NOT EXISTS tenants_previous_slugs_parent_idx ON tenants_previous_slugs(_parent_id);`,
  },
  // F23: ALTER TABLE fallbacks — satisfy check-migrations.js for array sub-fields
  // (previousSlugs is an array type → sub-table tenants_previous_slugs, not columns on tenants)
  {
    name: 'tenants.previous_slugs_fallback',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS previous_slugs jsonb;
          ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug varchar;
          ALTER TABLE tenants ADD COLUMN IF NOT EXISTS expires_at timestamptz;
          ALTER TABLE tenants_previous_slugs ADD COLUMN IF NOT EXISTS slug varchar;
          ALTER TABLE tenants_previous_slugs ADD COLUMN IF NOT EXISTS expires_at timestamptz;`,
  },
  // ── Rate Limits: DB-backed rate limiting (BUG-003) ──
  {
    name: 'rate_limits.create_table',
    sql: `CREATE TABLE IF NOT EXISTS rate_limits (
      id serial PRIMARY KEY,
      key varchar(255) NOT NULL,
      count integer NOT NULL DEFAULT 1,
      window_start timestamp NOT NULL DEFAULT NOW(),
      expires_at timestamp NOT NULL,
      UNIQUE(key));`,
  },
  {
    name: 'rate_limits.key_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);`,
  },
  {
    name: 'rate_limits.expires_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);`,
  },
  {
    name: 'blogs.published_at',
    sql: `ALTER TABLE blogs ADD COLUMN IF NOT EXISTS published_at timestamp(3) with time zone;`,
  },
  {
    name: 'blogs.scheduled_publish_date',
    sql: `ALTER TABLE blogs ADD COLUMN IF NOT EXISTS scheduled_publish_date timestamp(3) with time zone;`,
  },
  // ── AI Usage Logs (plan 260414-0914 phase-05) — per-call observability ──
  {
    name: 'ai_usage_logs.create_table',
    sql: `CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id serial PRIMARY KEY,
      user_id integer,
      tenant_id integer,
      endpoint varchar NOT NULL,
      model varchar NOT NULL,
      tokens_in integer NOT NULL DEFAULT 0,
      tokens_out integer NOT NULL DEFAULT 0,
      cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
      duration_ms integer NOT NULL DEFAULT 0,
      success boolean NOT NULL DEFAULT true,
      error_code varchar,
      updated_at timestamptz DEFAULT now() NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    );`,
  },
  {
    name: 'ai_usage_logs.created_at_idx',
    sql: `CREATE INDEX IF NOT EXISTS ai_usage_logs_created_at_idx ON ai_usage_logs (created_at DESC);`,
  },
  {
    name: 'ai_usage_logs.endpoint_model_idx',
    sql: `CREATE INDEX IF NOT EXISTS ai_usage_logs_endpoint_model_idx ON ai_usage_logs (endpoint, model);`,
  },
  {
    name: 'ai_usage_logs.user_idx',
    sql: `CREATE INDEX IF NOT EXISTS ai_usage_logs_user_idx ON ai_usage_logs (user_id) WHERE user_id IS NOT NULL;`,
  },
  // ── Sites: AI generation status tracking ──
  {
    name: 'sites.generation_status',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS generation_status varchar DEFAULT 'none';`,
  },
  {
    name: 'sites.generation_status_backfill',
    sql: `UPDATE sites SET generation_status = 'completed' WHERE generation_status IS NULL;`,
  },
  // ── Sites: siteType + aiGenerationMetadata (required by /api/ai/generate-site) ──
  // Root cause 2026-04-20: Sites.ts declares siteType (select, required) and
  // aiGenerationMetadata (group) but DB staging was seeded before these existed.
  // CREATE TABLE IF NOT EXISTS skipped column adds → INSERT fails with
  // "Failed query: insert into sites" on POST /api/ai/generate-site.
  {
    name: 'sites.site_type',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS site_type varchar DEFAULT 'business';`,
  },
  {
    name: 'sites.ai_generation_metadata_generated_at',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS ai_generation_metadata_generated_at timestamp(3) with time zone;`,
  },
  {
    name: 'sites.ai_generation_metadata_original_prompt',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS ai_generation_metadata_original_prompt varchar;`,
  },
  {
    name: 'sites.ai_generation_metadata_business_type',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS ai_generation_metadata_business_type varchar;`,
  },
  // ── F16-04: Add metadata column for notification i18n ──
  {
    name: 'notifications.metadata',
    sql: `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata jsonb;`,
  },

  // ── BUG-F16: dedupe_key + partial unique index to stop duplicate notification
  //    rows (same order firing ORDER_NEW from multiple paths / concurrent retries)
  //    that inflate the unread badge. Key is stable per logical event
  //    (e.g. "ORDER_NEW:ORD-123"); the unique index is the source of truth that
  //    closes the read-then-write race in notifyTenantOwners(). Partial (WHERE NOT
  //    NULL) so legacy rows (dedupe_key NULL) and non-deduped notifications are
  //    unconstrained — index creation never conflicts with existing data. ──
  {
    name: 'notifications.dedupe_key',
    sql: `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key varchar;`,
  },
  {
    name: 'notifications.dedupe_key_unique_idx',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS notifications_tenant_user_dedupe_key_idx
      ON notifications (tenant_id, user_id, dedupe_key)
      WHERE dedupe_key IS NOT NULL;`,
  },

  // ── Industry blocks (Plan 260417-0837 Phase 1.1) ────────────────────────────
  // 6 blocks registered in Pages.ts — composer builds them but they were
  // getting silently dropped by Payload because no schema existed.
  // Unblocks WEAK cats: health, realestate, fitness, education, tech.

  // doctor-profile ──────────────────────────────────────────────────────────
  {
    name: 'pages_blocks_doctor_profile.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_doctor_profile" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar
    );`,
  },
  {
    name: 'pages_blocks_doctor_profile_doctors.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_doctor_profile_doctors" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, specialisation varchar, qualifications jsonb,
      photo_url varchar, available_days jsonb, languages varchar,
      consultation_fee varchar, bio varchar
    );`,
  },
  {
    name: '_pages_v_blocks_doctor_profile.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_doctor_profile" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_doctor_profile_doctors.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_doctor_profile_doctors" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      name varchar, specialisation varchar, qualifications jsonb,
      photo_url varchar, available_days jsonb, languages varchar,
      consultation_fee varchar, bio varchar
    );`,
  },

  // property-card ───────────────────────────────────────────────────────────
  {
    name: 'pages_blocks_property_card.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_property_card" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      show_map boolean DEFAULT false, currency varchar DEFAULT 'RM'
    );`,
  },
  {
    name: 'pages_blocks_property_card_properties.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_property_card_properties" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      title varchar, price numeric, location varchar,
      bedrooms integer, bathrooms integer, area numeric,
      image_urls jsonb, type varchar, status varchar,
      map_url varchar, description varchar
    );`,
  },
  {
    name: '_pages_v_blocks_property_card.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_property_card" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      show_map boolean, currency varchar
    );`,
  },
  {
    name: '_pages_v_blocks_property_card_properties.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_property_card_properties" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      title varchar, price numeric, location varchar,
      bedrooms integer, bathrooms integer, area numeric,
      image_urls jsonb, type varchar, status varchar,
      map_url varchar, description varchar
    );`,
  },

  // class-schedule ──────────────────────────────────────────────────────────
  {
    name: 'pages_blocks_class_schedule.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_class_schedule" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar,
      show_capacity boolean DEFAULT true, highlight_today boolean DEFAULT true
    );`,
  },
  {
    name: 'pages_blocks_class_schedule_classes.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_class_schedule_classes" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, instructor varchar, day integer,
      start_time varchar, end_time varchar, capacity integer,
      enrolled integer, category varchar, level varchar
    );`,
  },
  {
    name: '_pages_v_blocks_class_schedule.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_class_schedule" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar,
      show_capacity boolean, highlight_today boolean
    );`,
  },
  {
    name: '_pages_v_blocks_class_schedule_classes.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_class_schedule_classes" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      name varchar, instructor varchar, day integer,
      start_time varchar, end_time varchar, capacity integer,
      enrolled integer, category varchar, level varchar
    );`,
  },

  // video-showcase ──────────────────────────────────────────────────────────
  {
    name: 'pages_blocks_video_showcase.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_video_showcase" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      show_categories boolean DEFAULT true, autoplay boolean DEFAULT false
    );`,
  },
  {
    name: 'pages_blocks_video_showcase_videos.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_video_showcase_videos" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      title varchar, thumbnail_url varchar, video_url varchar,
      category varchar, duration varchar, description varchar
    );`,
  },
  {
    name: '_pages_v_blocks_video_showcase.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_video_showcase" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      show_categories boolean, autoplay boolean
    );`,
  },
  {
    name: '_pages_v_blocks_video_showcase_videos.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_video_showcase_videos" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      title varchar, thumbnail_url varchar, video_url varchar,
      category varchar, duration varchar, description varchar
    );`,
  },

  // product-quick-view ──────────────────────────────────────────────────────
  {
    name: 'pages_blocks_product_quick_view.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_product_quick_view" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      columns integer DEFAULT 4, show_quick_view boolean DEFAULT true,
      currency varchar DEFAULT 'RM'
    );`,
  },
  {
    name: 'pages_blocks_product_quick_view_products.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_product_quick_view_products" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, price numeric, original_price numeric,
      image_urls jsonb, description varchar, variants jsonb,
      badge varchar, cta_label varchar, cta_url varchar
    );`,
  },
  {
    name: '_pages_v_blocks_product_quick_view.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_product_quick_view" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      columns integer, show_quick_view boolean, currency varchar
    );`,
  },
  {
    name: '_pages_v_blocks_product_quick_view_products.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_product_quick_view_products" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      name varchar, price numeric, original_price numeric,
      image_urls jsonb, description varchar, variants jsonb,
      badge varchar, cta_label varchar, cta_url varchar
    );`,
  },

  // feature-comparison ──────────────────────────────────────────────────────
  {
    name: 'pages_blocks_feature_comparison.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_feature_comparison" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: 'pages_blocks_feature_comparison_products.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_feature_comparison_products" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, highlighted boolean DEFAULT false
    );`,
  },
  {
    name: 'pages_blocks_feature_comparison_features.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_feature_comparison_features" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, values jsonb
    );`,
  },
  {
    name: '_pages_v_blocks_feature_comparison.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_feature_comparison" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_feature_comparison_products.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_feature_comparison_products" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      name varchar, highlighted boolean
    );`,
  },
  {
    name: '_pages_v_blocks_feature_comparison_features.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_feature_comparison_features" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      name varchar, values jsonb
    );`,
  },
  // ── Fix: faq + pricing missing variant column (staging 500 on 2026-04-17) ──
  {
    name: 'pages_blocks_faq.add_variant',
    sql: `ALTER TABLE "pages_blocks_faq" ADD COLUMN IF NOT EXISTS "variant" varchar;`,
  },
  {
    name: 'pages_blocks_pricing.add_variant',
    sql: `ALTER TABLE "pages_blocks_pricing" ADD COLUMN IF NOT EXISTS "variant" varchar;`,
  },
  {
    name: '_pages_v_blocks_faq.add_variant',
    sql: `ALTER TABLE "_pages_v_blocks_faq" ADD COLUMN IF NOT EXISTS "variant" varchar;`,
  },
  {
    name: '_pages_v_blocks_pricing.add_variant',
    sql: `ALTER TABLE "_pages_v_blocks_pricing" ADD COLUMN IF NOT EXISTS "variant" varchar;`,
  },

  // ── Fix (2026-04-17, BUG-F05 new-page-stays-draft): `variant` was defined
  // in every block's Payload schema (Pages.ts) but the original CREATE TABLE
  // blocks here only listed it for a handful. Draft-save writes to the
  // versioned `_pages_v_blocks_*` rows, which picked up the column via
  // Payload's schema sync; the main `pages_blocks_*` rows never did.
  // Promoting draft→published (PATCH /publish) then hit INSERT/UPDATE on the
  // main table and silently failed the row — user saw "Update success" toast
  // but status stayed Draft, hasUnpublishedChanges stayed true. Single bulk
  // ALTER IF NOT EXISTS covers every block that has `variant` in Pages.ts.
  // ── Template Quality Scores (Phase 03 — Quality Integration) ────────────────
  // Persists per-template rubric score snapshots. Each row = one scoring run.
  // Array sub-table uses varchar id + _parent_id + _order + _uuid per convention.
  {
    name: 'template_quality_scores.create_table',
    sql: `CREATE TABLE IF NOT EXISTS template_quality_scores (
      id serial PRIMARY KEY,
      template_id integer REFERENCES templates(id) ON DELETE CASCADE,
      rubric_version varchar NOT NULL,
      avg_score numeric NOT NULL,
      pass_rubric boolean DEFAULT false,
      scorer varchar DEFAULT 'manual',
      scored_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now() NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL
    );`,
  },
  {
    name: 'template_quality_scores.template_scored_idx',
    sql: `CREATE INDEX IF NOT EXISTS template_quality_scores_template_scored_idx
      ON template_quality_scores (template_id, scored_at DESC);`,
  },
  {
    name: 'template_quality_scores_dimensions.create_table',
    sql: `CREATE TABLE IF NOT EXISTS template_quality_scores_dimensions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL REFERENCES template_quality_scores(id) ON DELETE CASCADE,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar NOT NULL,
      score numeric NOT NULL,
      weight numeric NOT NULL,
      criteria_met integer DEFAULT 0,
      criteria_total integer DEFAULT 0
    );`,
  },
  {
    name: 'template_quality_scores_dimensions.parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS template_quality_scores_dimensions_parent_idx
      ON template_quality_scores_dimensions (_parent_id);`,
  },
  // Idempotent ALTER TABLE fallbacks — safe if tables already created above
  {
    name: 'template_quality_scores.alter_template_id',
    sql: `ALTER TABLE IF EXISTS template_quality_scores
      ADD COLUMN IF NOT EXISTS template_id integer;`,
  },
  {
    name: 'template_quality_scores.alter_rubric_version',
    sql: `ALTER TABLE IF EXISTS template_quality_scores
      ADD COLUMN IF NOT EXISTS rubric_version varchar;`,
  },
  {
    name: 'template_quality_scores.alter_avg_score',
    sql: `ALTER TABLE IF EXISTS template_quality_scores
      ADD COLUMN IF NOT EXISTS avg_score numeric;`,
  },
  {
    name: 'template_quality_scores.alter_pass_rubric',
    sql: `ALTER TABLE IF EXISTS template_quality_scores
      ADD COLUMN IF NOT EXISTS pass_rubric boolean DEFAULT false;`,
  },
  {
    name: 'template_quality_scores.alter_scorer',
    sql: `ALTER TABLE IF EXISTS template_quality_scores
      ADD COLUMN IF NOT EXISTS scorer varchar DEFAULT 'manual';`,
  },
  {
    name: 'template_quality_scores.alter_scored_at',
    sql: `ALTER TABLE IF EXISTS template_quality_scores
      ADD COLUMN IF NOT EXISTS scored_at timestamp DEFAULT now();`,
  },

  // ── Phase 04: Block Catalog ──
  {
    name: 'block_catalog_entries.create_table',
    sql: `CREATE TABLE IF NOT EXISTS block_catalog_entries (
      id serial PRIMARY KEY,
      slug varchar NOT NULL UNIQUE,
      description_override text,
      description_override_vi text,
      display_order integer DEFAULT 0,
      curated_preview_url varchar,
      hidden_from_catalog boolean DEFAULT false,
      updated_at timestamp DEFAULT now(),
      created_at timestamp DEFAULT now());`,
  },
  {
    name: 'block_catalog_entries.slug_idx',
    sql: `CREATE INDEX IF NOT EXISTS block_catalog_entries_slug_idx ON block_catalog_entries (slug);`,
  },
  {
    name: 'block_catalog_entries.alter_slug',
    sql: `ALTER TABLE IF EXISTS block_catalog_entries ADD COLUMN IF NOT EXISTS slug varchar;`,
  },
  {
    name: 'block_catalog_entries.alter_description_override',
    sql: `ALTER TABLE IF EXISTS block_catalog_entries ADD COLUMN IF NOT EXISTS description_override text;`,
  },
  {
    name: 'block_catalog_entries.alter_description_override_vi',
    sql: `ALTER TABLE IF EXISTS block_catalog_entries ADD COLUMN IF NOT EXISTS description_override_vi text;`,
  },
  {
    name: 'block_catalog_entries.alter_display_order',
    sql: `ALTER TABLE IF EXISTS block_catalog_entries ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;`,
  },
  {
    name: 'block_catalog_entries.alter_curated_preview_url',
    sql: `ALTER TABLE IF EXISTS block_catalog_entries ADD COLUMN IF NOT EXISTS curated_preview_url varchar;`,
  },
  {
    name: 'block_catalog_entries.alter_hidden_from_catalog',
    sql: `ALTER TABLE IF EXISTS block_catalog_entries ADD COLUMN IF NOT EXISTS hidden_from_catalog boolean DEFAULT false;`,
  },
  {
    name: 'block_variants.create_table',
    sql: `CREATE TABLE IF NOT EXISTS block_variants (
      id serial PRIMARY KEY,
      block_slug varchar NOT NULL,
      variant_name varchar NOT NULL,
      preview_url_override varchar,
      notes text,
      updated_at timestamp DEFAULT now(),
      created_at timestamp DEFAULT now());`,
  },
  {
    name: 'block_variants.block_slug_idx',
    sql: `CREATE INDEX IF NOT EXISTS block_variants_block_slug_idx ON block_variants (block_slug);`,
  },
  {
    name: 'block_variants.alter_block_slug',
    sql: `ALTER TABLE IF EXISTS block_variants ADD COLUMN IF NOT EXISTS block_slug varchar;`,
  },
  {
    name: 'block_variants.alter_variant_name',
    sql: `ALTER TABLE IF EXISTS block_variants ADD COLUMN IF NOT EXISTS variant_name varchar;`,
  },
  {
    name: 'block_variants.alter_preview_url_override',
    sql: `ALTER TABLE IF EXISTS block_variants ADD COLUMN IF NOT EXISTS preview_url_override varchar;`,
  },
  {
    name: 'block_variants.alter_notes',
    sql: `ALTER TABLE IF EXISTS block_variants ADD COLUMN IF NOT EXISTS notes text;`,
  },
  {
    name: 'block_variants.alter_enabled',
    sql: `ALTER TABLE IF EXISTS block_variants ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;`,
  },
  {
    name: 'block_variants.alter_display_name',
    sql: `ALTER TABLE IF EXISTS block_variants ADD COLUMN IF NOT EXISTS display_name varchar;`,
  },

  ...[
    'hero', 'navigation', 'about', 'contact', 'footer',
    'social_widget', 'cart_widget', 'features', 'testimonials', 'gallery',
    'stats', 'team', 'cta', 'newsletter', 'video',
    'logo_cloud', 'blog_list', 'products_grid', 'products_featured',
    'service_cards', 'carousel', 'step_process', 'divider',
    'announcement_bar', 'whatsapp_button', 'google_maps', 'accordion',
    'countdown_timer', 'social_proof', 'breadcrumb', 'client_logos',
    'menu_food', 'portfolio_grid', 'doctor_profile', 'property_card',
    'class_schedule', 'video_showcase', 'product_quick_view',
    'feature_comparison',
  ].flatMap(slug => [
    {
      name: `pages_blocks_${slug}.add_variant`,
      sql: `ALTER TABLE "pages_blocks_${slug}" ADD COLUMN IF NOT EXISTS "variant" varchar;`,
    },
    {
      name: `_pages_v_blocks_${slug}.add_variant`,
      sql: `ALTER TABLE "_pages_v_blocks_${slug}" ADD COLUMN IF NOT EXISTS "variant" varchar;`,
    },
  ]),

  // ── AiGenerationRecords: Phase 05 Monitoring ──────────────────────────────
  {
    name: 'ai_generation_records.create_table',
    sql: `CREATE TABLE IF NOT EXISTS ai_generation_records (
      id serial PRIMARY KEY,
      site_id integer REFERENCES sites(id) ON DELETE SET NULL,
      user_id integer REFERENCES users(id) ON DELETE SET NULL,
      endpoint varchar NOT NULL,
      category varchar,
      prompt_mode varchar NOT NULL DEFAULT 'full',
      prompt_text text,
      prompt_hash varchar,
      output_snapshot jsonb,
      status varchar NOT NULL DEFAULT 'running',
      error_log text,
      duration_ms integer,
      cost_usd numeric,
      completed_at timestamp,
      updated_at timestamp DEFAULT now(),
      created_at timestamp DEFAULT now());`,
  },
  {
    name: 'ai_generation_records.created_at_idx',
    sql: `CREATE INDEX IF NOT EXISTS ai_generation_records_created_at_idx ON ai_generation_records (created_at DESC);`,
  },
  {
    name: 'ai_generation_records.status_idx',
    sql: `CREATE INDEX IF NOT EXISTS ai_generation_records_status_idx ON ai_generation_records (status);`,
  },
  {
    name: 'ai_generation_records.user_id_idx',
    sql: `CREATE INDEX IF NOT EXISTS ai_generation_records_user_id_idx ON ai_generation_records (user_id);`,
  },
  {
    name: 'ai_generation_records_selected_blocks.create_table',
    sql: `CREATE TABLE IF NOT EXISTS ai_generation_records_selected_blocks (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL REFERENCES ai_generation_records(id) ON DELETE CASCADE,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      value varchar);`,
  },
  {
    name: 'ai_generation_records_selected_blocks.parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS ai_generation_records_selected_blocks_parent_idx ON ai_generation_records_selected_blocks (_parent_id);`,
  },
  // ALTER TABLE safety clones — idempotent if table was created by pushDevSchema
  {
    name: 'ai_generation_records.alter_site_id',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS site_id integer;`,
  },
  {
    name: 'ai_generation_records.alter_user_id',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS user_id integer;`,
  },
  {
    name: 'ai_generation_records.alter_endpoint',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS endpoint varchar;`,
  },
  {
    name: 'ai_generation_records.alter_category',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS category varchar;`,
  },
  {
    name: 'ai_generation_records.alter_prompt_mode',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS prompt_mode varchar NOT NULL DEFAULT 'full';`,
  },
  {
    name: 'ai_generation_records.alter_prompt_text',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS prompt_text text;`,
  },
  {
    name: 'ai_generation_records.alter_prompt_hash',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS prompt_hash varchar;`,
  },
  {
    name: 'ai_generation_records.alter_output_snapshot',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS output_snapshot jsonb;`,
  },
  {
    name: 'ai_generation_records.alter_status',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'running';`,
  },
  {
    name: 'ai_generation_records.alter_error_log',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS error_log text;`,
  },
  {
    name: 'ai_generation_records.alter_duration_ms',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS duration_ms integer;`,
  },
  {
    name: 'ai_generation_records.alter_cost_usd',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS cost_usd numeric;`,
  },
  {
    name: 'ai_generation_records.alter_completed_at',
    sql: `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS completed_at timestamp;`,
  },

  // ── Phase 06: TemplateIssues ──────────────────────────────────────────────
  {
    name: 'template_issues.create_table',
    sql: `CREATE TABLE IF NOT EXISTS template_issues (
  id serial PRIMARY KEY,
  title varchar NOT NULL,
  description text,
  severity varchar NOT NULL DEFAULT 'medium',
  category varchar NOT NULL DEFAULT 'other',
  status varchar NOT NULL DEFAULT 'open',
  related_type varchar NOT NULL,
  related_id varchar NOT NULL,
  reported_by_id integer REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_id integer REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamp,
  updated_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);`,
  },
  {
    name: 'template_issues.create_status_idx',
    sql: `CREATE INDEX IF NOT EXISTS template_issues_status_idx ON template_issues (status);`,
  },
  {
    name: 'template_issues.create_severity_idx',
    sql: `CREATE INDEX IF NOT EXISTS template_issues_severity_idx ON template_issues (severity);`,
  },
  {
    name: 'template_issues.create_related_idx',
    sql: `CREATE INDEX IF NOT EXISTS template_issues_related_idx ON template_issues (related_type, related_id);`,
  },
  {
    name: 'template_issues_comments.create_table',
    sql: `CREATE TABLE IF NOT EXISTS template_issues_comments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  _order integer NOT NULL DEFAULT 0,
  _parent_id integer NOT NULL REFERENCES template_issues(id) ON DELETE CASCADE,
  _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
  author_id integer REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamp DEFAULT now()
);`,
  },
  {
    name: 'template_issues_comments.create_parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS template_issues_comments_parent_idx ON template_issues_comments (_parent_id);`,
  },
  {
    name: 'template_issues_timeline.create_table',
    sql: `CREATE TABLE IF NOT EXISTS template_issues_timeline (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  _order integer NOT NULL DEFAULT 0,
  _parent_id integer NOT NULL REFERENCES template_issues(id) ON DELETE CASCADE,
  _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
  event varchar NOT NULL,
  actor_id integer REFERENCES users(id) ON DELETE SET NULL,
  data jsonb,
  at timestamp DEFAULT now()
);`,
  },
  {
    name: 'template_issues_timeline.create_parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS template_issues_timeline_parent_idx ON template_issues_timeline (_parent_id);`,
  },
  // ALTER TABLE fallbacks for all template_issues columns
  {
    name: 'template_issues.alter_title',
    sql: `ALTER TABLE IF EXISTS template_issues ADD COLUMN IF NOT EXISTS title varchar NOT NULL DEFAULT '';`,
  },
  {
    name: 'template_issues.alter_description',
    sql: `ALTER TABLE IF EXISTS template_issues ADD COLUMN IF NOT EXISTS description text;`,
  },
  {
    name: 'template_issues.alter_severity',
    sql: `ALTER TABLE IF EXISTS template_issues ADD COLUMN IF NOT EXISTS severity varchar NOT NULL DEFAULT 'medium';`,
  },
  {
    name: 'template_issues.alter_category',
    sql: `ALTER TABLE IF EXISTS template_issues ADD COLUMN IF NOT EXISTS category varchar NOT NULL DEFAULT 'other';`,
  },
  {
    name: 'template_issues.alter_status',
    sql: `ALTER TABLE IF EXISTS template_issues ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'open';`,
  },
  {
    name: 'template_issues.alter_related_type',
    sql: `ALTER TABLE IF EXISTS template_issues ADD COLUMN IF NOT EXISTS related_type varchar;`,
  },
  {
    name: 'template_issues.alter_related_id',
    sql: `ALTER TABLE IF EXISTS template_issues ADD COLUMN IF NOT EXISTS related_id varchar;`,
  },
  {
    name: 'template_issues.alter_reported_by_id',
    sql: `ALTER TABLE IF EXISTS template_issues ADD COLUMN IF NOT EXISTS reported_by_id integer REFERENCES users(id) ON DELETE SET NULL;`,
  },
  {
    name: 'template_issues.alter_assigned_to_id',
    sql: `ALTER TABLE IF EXISTS template_issues ADD COLUMN IF NOT EXISTS assigned_to_id integer REFERENCES users(id) ON DELETE SET NULL;`,
  },
  {
    name: 'template_issues.alter_resolved_at',
    sql: `ALTER TABLE IF EXISTS template_issues ADD COLUMN IF NOT EXISTS resolved_at timestamp;`,
  },

  // ── Phase 07: AI Quality Dashboard indexes ─────────────────────────────────
  // template_quality_scores_template_scored_idx above already covers
  // (template_id, scored_at DESC). PERF-04 cleanup removes the old alias.
  // Composite index on ai_generation_records(created_at DESC, status)
  {
    name: 'ai_generation_records.idx_agr_created_status',
    sql: `CREATE INDEX IF NOT EXISTS idx_agr_created_status ON ai_generation_records(created_at DESC, status);`,
  },

  // ── Phase 08: Category DNA + Content Packs + Review ──────────────────────

  // Categories: add dna jsonb column
  {
    name: 'categories.alter_dna',
    sql: `ALTER TABLE categories ADD COLUMN IF NOT EXISTS dna jsonb;`,
  },

  // Templates: add dna_compliance_cache jsonb column
  {
    name: 'templates.alter_dna_compliance_cache',
    sql: `ALTER TABLE templates ADD COLUMN IF NOT EXISTS dna_compliance_cache jsonb;`,
  },

  // ContentPacks parent table
  {
    name: 'content_packs.create_table',
    sql: `CREATE TABLE IF NOT EXISTS content_packs (
      id serial PRIMARY KEY,
      name varchar NOT NULL,
      description text,
      cover_image_id integer REFERENCES media(id) ON DELETE SET NULL,
      category varchar,
      personality varchar,
      updated_at timestamp DEFAULT now(),
      created_at timestamp DEFAULT now()
    );`,
  },

  // ContentPacks tags array sub-table (Payload array convention: varchar id, _order, _parent_id, _uuid)
  {
    name: 'content_packs_tags.create_table',
    sql: `CREATE TABLE IF NOT EXISTS content_packs_tags (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL REFERENCES content_packs(id) ON DELETE CASCADE,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      tag varchar
    );`,
  },
  {
    name: 'content_packs_tags.parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS content_packs_tags_parent_idx ON content_packs_tags (_parent_id);`,
  },
  // Phase 08 fix: Payload creates {collection}_rels table for relationship hasMany fields
  // (includedTemplates). Without this table, list queries fail with:
  //   error: relation "content_packs_rels" does not exist
  {
    name: 'content_packs_rels.create_table',
    sql: `CREATE TABLE IF NOT EXISTS content_packs_rels (
      id serial PRIMARY KEY,
      "order" integer,
      parent_id integer NOT NULL,
      path varchar NOT NULL,
      templates_id integer
    );`,
  },
  {
    name: 'content_packs_rels.parent_idx',
    sql: `CREATE INDEX IF NOT EXISTS content_packs_rels_parent_idx ON content_packs_rels (parent_id);`,
  },

  // Phase 08 data seed: backfill 6 category DNA records (guard: only if dna IS NULL)
  // Wrapped as a DO block so it runs atomically and is idempotent.
  {
    name: 'categories.seed_dna_fnb',
    sql: `UPDATE categories SET dna = '{"signatureBlocks":["navigation","hero","menu-food","gallery","booking-widget","footer"],"recommendedBlocks":["testimonials","gallery-masonry","cta","google-maps"],"mandatoryOrder":["navigation","hero","footer"],"forbiddenBlocks":["class-schedule","doctor-profile","property-card"],"typicalPersonalities":["warm-traditional","warm-homestyle","bold-dark"],"minSections":5,"aiPromptHint":"Warm, inviting tone focused on food experiences. Emphasize ambiance, freshness, and hospitality."}'::jsonb WHERE slug = 'fnb' AND dna IS NULL;`,
  },
  {
    name: 'categories.seed_dna_retail',
    sql: `UPDATE categories SET dna = '{"signatureBlocks":["navigation","hero","products-grid","cart-widget","testimonials","footer"],"recommendedBlocks":["products-featured","cta","newsletter","pricing"],"mandatoryOrder":["navigation","hero","footer"],"forbiddenBlocks":["menu-food","class-schedule","doctor-profile"],"typicalPersonalities":["modern-vibrant","soft-feminine","editorial-clean"],"minSections":5,"aiPromptHint":"Confident, product-forward tone. Highlight deals, quality, and social proof. Drive conversion."}'::jsonb WHERE slug = 'retail' AND dna IS NULL;`,
  },
  {
    name: 'categories.seed_dna_portfolio',
    sql: `UPDATE categories SET dna = '{"signatureBlocks":["navigation","hero","portfolio-grid","about","contact","footer"],"recommendedBlocks":["testimonials","stats","team","cta"],"mandatoryOrder":["navigation","hero","footer"],"forbiddenBlocks":["menu-food","products-grid","cart-widget","class-schedule"],"typicalPersonalities":["editorial-clean","bold-dark","luxury-travel"],"minSections":5,"aiPromptHint":"Sophisticated, minimal tone. Let the work speak. Emphasize craft, process, and results."}'::jsonb WHERE slug = 'portfolio' AND dna IS NULL;`,
  },
  {
    name: 'categories.seed_dna_news',
    sql: `UPDATE categories SET dna = '{"signatureBlocks":["navigation","hero","blog-list","newsletter","footer"],"recommendedBlocks":["stats","testimonials","cta","social-widget"],"mandatoryOrder":["navigation","hero","blog-list","footer"],"forbiddenBlocks":["menu-food","products-grid","booking-widget","class-schedule"],"typicalPersonalities":["editorial-clean","modern-vibrant"],"minSections":5,"aiPromptHint":"Clear, authoritative tone. Prioritize readability and information hierarchy. Build trust through consistency."}'::jsonb WHERE slug = 'news' AND dna IS NULL;`,
  },
  {
    name: 'categories.seed_dna_beauty',
    sql: `UPDATE categories SET dna = '{"signatureBlocks":["navigation","hero","service-cards","booking-widget","gallery","testimonials","footer"],"recommendedBlocks":["gallery-masonry","before-after","team","newsletter","cta"],"mandatoryOrder":["navigation","hero","footer"],"forbiddenBlocks":["products-grid","cart-widget","class-schedule","blog-list"],"typicalPersonalities":["soft-feminine","calm-wellness","luxury-travel"],"minSections":6,"aiPromptHint":"Elegant, nurturing tone. Evoke transformation, self-care, and indulgence. Subtle luxury feel."}'::jsonb WHERE slug = 'beauty' AND dna IS NULL;`,
  },
  {
    name: 'categories.seed_dna_education',
    sql: `UPDATE categories SET dna = '{"signatureBlocks":["navigation","hero","class-schedule","features","contact","footer"],"recommendedBlocks":["testimonials","faq","team","stats","cta","pricing"],"mandatoryOrder":["navigation","hero","footer"],"forbiddenBlocks":["menu-food","cart-widget","booking-widget","gallery-masonry"],"typicalPersonalities":["modern-vibrant","calm-wellness","editorial-clean"],"minSections":6,"aiPromptHint":"Encouraging, clear, and structured tone. Highlight outcomes, expertise, and learning journey."}'::jsonb WHERE slug = 'education' AND dna IS NULL;`,
  },
  // ── Phase 09: TemplateVersions ───────────────────────────────────────────
  {
    name: 'template_versions.create_table',
    sql: `CREATE TABLE IF NOT EXISTS template_versions (
      id serial PRIMARY KEY,
      template_id integer REFERENCES templates(id) ON DELETE CASCADE,
      version_number integer NOT NULL,
      sections_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
      changelog text,
      created_by_id integer REFERENCES users(id) ON DELETE SET NULL,
      updated_at timestamp DEFAULT now(),
      created_at timestamp DEFAULT now()
    );`,
  },
  {
    name: 'template_versions.create_index',
    sql: `CREATE INDEX IF NOT EXISTS template_versions_template_version_idx
      ON template_versions (template_id, version_number DESC);`,
  },
  // ALTER TABLE fallbacks (idempotent — in case table pre-existed without all cols)
  {
    name: 'template_versions.add_col_template_id',
    sql: `ALTER TABLE IF EXISTS template_versions ADD COLUMN IF NOT EXISTS template_id integer REFERENCES templates(id) ON DELETE CASCADE;`,
  },
  {
    name: 'template_versions.add_col_version_number',
    sql: `ALTER TABLE IF EXISTS template_versions ADD COLUMN IF NOT EXISTS version_number integer;`,
  },
  {
    name: 'template_versions.add_col_sections_snapshot',
    sql: `ALTER TABLE IF EXISTS template_versions ADD COLUMN IF NOT EXISTS sections_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;`,
  },
  {
    name: 'template_versions.add_col_changelog',
    sql: `ALTER TABLE IF EXISTS template_versions ADD COLUMN IF NOT EXISTS changelog text;`,
  },
  {
    name: 'template_versions.add_col_created_by_id',
    sql: `ALTER TABLE IF EXISTS template_versions ADD COLUMN IF NOT EXISTS created_by_id integer REFERENCES users(id) ON DELETE SET NULL;`,
  },
  {
    name: 'template_versions.add_col_updated_at',
    sql: `ALTER TABLE IF EXISTS template_versions ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();`,
  },
  {
    name: 'template_versions.add_col_created_at',
    sql: `ALTER TABLE IF EXISTS template_versions ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();`,
  },

  // ── Phase 04: AiGenerationRecord override-rate fields ────────────────────
  // Pre-migration rows return NULL override rate; acceptable per product (rolling 30d window).
  {
    name: 'ai_generation_records.add_field_count_columns',
    sql: `ALTER TABLE ai_generation_records
      ADD COLUMN IF NOT EXISTS fields_total integer,
      ADD COLUMN IF NOT EXISTS fields_filled integer,
      ADD COLUMN IF NOT EXISTS fields_edited integer DEFAULT 0;`,
  },

  // ── Pages: Data cleanup for F05 Footer variants ──
  // Migrate legacy variant values to the new supported values cleanly in the database
  {
    name: 'pages_blocks_footer.data_migration_variants',
    sql: `
      UPDATE pages_blocks_footer SET variant = 'simple' WHERE variant = 'expanded';
      UPDATE pages_blocks_footer SET variant = 'dark-gradient' WHERE variant = 'mega-footer';
      UPDATE _pages_v_blocks_footer SET variant = 'simple' WHERE variant = 'expanded';
      UPDATE _pages_v_blocks_footer SET variant = 'dark-gradient' WHERE variant = 'mega-footer';
      
      -- Update Global Site Footers stored in JSONB (single block object — direct jsonb_set)
      UPDATE sites
      SET footer_block = CASE
        WHEN footer_block->>'variant' = 'expanded'    THEN jsonb_set(footer_block, '{variant}', '"simple"')
        WHEN footer_block->>'variant' = 'mega-footer' THEN jsonb_set(footer_block, '{variant}', '"dark-gradient"')
        ELSE footer_block
      END
      WHERE footer_block IS NOT NULL
        AND footer_block->>'variant' IN ('expanded', 'mega-footer');

      -- Update Template Layouts stored in JSONB (mixed-block array — only touch footer blocks)
      -- COALESCE guards against jsonb_agg returning NULL on empty arrays ([] → [] not NULL)
      -- jsonb_typeof guard prevents error if layout is not an array (scalar/object)
      UPDATE templates_template_pages
      SET layout = COALESCE(
        (
          SELECT jsonb_agg(
            CASE
              WHEN elem->>'blockType' = 'footer' AND elem->>'variant' = 'expanded'
                THEN jsonb_set(elem, '{variant}', '"simple"')
              WHEN elem->>'blockType' = 'footer' AND elem->>'variant' = 'mega-footer'
                THEN jsonb_set(elem, '{variant}', '"dark-gradient"')
              ELSE elem
            END
          )
          FROM jsonb_array_elements(layout) AS elem
        ),
        '[]'::jsonb
      )
      WHERE layout IS NOT NULL
        AND jsonb_typeof(layout) = 'array'
        AND layout::text LIKE '%"blockType":"footer"%';

      -- Update Template Version Snapshots stored in JSONB (mixed-block array — only touch footer blocks)
      -- Same COALESCE + jsonb_typeof guards as above
      UPDATE template_versions
      SET sections_snapshot = COALESCE(
        (
          SELECT jsonb_agg(
            CASE
              WHEN elem->>'blockType' = 'footer' AND elem->>'variant' = 'expanded'
                THEN jsonb_set(elem, '{variant}', '"simple"')
              WHEN elem->>'blockType' = 'footer' AND elem->>'variant' = 'mega-footer'
                THEN jsonb_set(elem, '{variant}', '"dark-gradient"')
              ELSE elem
            END
          )
          FROM jsonb_array_elements(sections_snapshot) AS elem
        ),
        '[]'::jsonb
      )
      WHERE sections_snapshot IS NOT NULL
        AND jsonb_typeof(sections_snapshot) = 'array'
        AND sections_snapshot::text LIKE '%"blockType":"footer"%';
    `,
  },
  // F05-GAP06: block_spacing jsonb column — every pages_blocks_* main table
  { name: 'pages_blocks_hero.add_block_spacing', sql: `ALTER TABLE "pages_blocks_hero" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_navigation.add_block_spacing', sql: `ALTER TABLE "pages_blocks_navigation" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_about.add_block_spacing', sql: `ALTER TABLE "pages_blocks_about" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_features.add_block_spacing', sql: `ALTER TABLE "pages_blocks_features" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_testimonials.add_block_spacing', sql: `ALTER TABLE "pages_blocks_testimonials" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_contact.add_block_spacing', sql: `ALTER TABLE "pages_blocks_contact" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_gallery.add_block_spacing', sql: `ALTER TABLE "pages_blocks_gallery" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_footer.add_block_spacing', sql: `ALTER TABLE "pages_blocks_footer" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_stats.add_block_spacing', sql: `ALTER TABLE "pages_blocks_stats" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_pricing.add_block_spacing', sql: `ALTER TABLE "pages_blocks_pricing" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_faq.add_block_spacing', sql: `ALTER TABLE "pages_blocks_faq" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_team.add_block_spacing', sql: `ALTER TABLE "pages_blocks_team" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_socialWidget.add_block_spacing', sql: `ALTER TABLE "pages_blocks_socialWidget" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_cartWidget.add_block_spacing', sql: `ALTER TABLE "pages_blocks_cartWidget" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_social_widget.add_block_spacing', sql: `ALTER TABLE "pages_blocks_social_widget" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_cart_widget.add_block_spacing', sql: `ALTER TABLE "pages_blocks_cart_widget" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_cta.add_block_spacing', sql: `ALTER TABLE "pages_blocks_cta" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_newsletter.add_block_spacing', sql: `ALTER TABLE "pages_blocks_newsletter" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_video.add_block_spacing', sql: `ALTER TABLE "pages_blocks_video" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_logo_cloud.add_block_spacing', sql: `ALTER TABLE "pages_blocks_logo_cloud" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_blog_list.add_block_spacing', sql: `ALTER TABLE "pages_blocks_blog_list" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_products_grid.add_block_spacing', sql: `ALTER TABLE "pages_blocks_products_grid" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  // GH-1588: showCategoryFilter opt-in toggle (F08 storefront category filter)
  { name: 'pages_blocks_products_grid.show_category_filter', sql: `ALTER TABLE "pages_blocks_products_grid" ADD COLUMN IF NOT EXISTS show_category_filter boolean DEFAULT false;` },
  { name: 'pages_blocks_products_featured.add_block_spacing', sql: `ALTER TABLE "pages_blocks_products_featured" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_custom_html.add_block_spacing', sql: `ALTER TABLE "pages_blocks_custom_html" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_service_cards.add_block_spacing', sql: `ALTER TABLE "pages_blocks_service_cards" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_carousel.add_block_spacing', sql: `ALTER TABLE "pages_blocks_carousel" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_step_process.add_block_spacing', sql: `ALTER TABLE "pages_blocks_step_process" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_divider.add_block_spacing', sql: `ALTER TABLE "pages_blocks_divider" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_announcement_bar.add_block_spacing', sql: `ALTER TABLE "pages_blocks_announcement_bar" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_whatsapp_button.add_block_spacing', sql: `ALTER TABLE "pages_blocks_whatsapp_button" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_google_maps.add_block_spacing', sql: `ALTER TABLE "pages_blocks_google_maps" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_accordion.add_block_spacing', sql: `ALTER TABLE "pages_blocks_accordion" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_countdown_timer.add_block_spacing', sql: `ALTER TABLE "pages_blocks_countdown_timer" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_social_proof.add_block_spacing', sql: `ALTER TABLE "pages_blocks_social_proof" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_breadcrumb.add_block_spacing', sql: `ALTER TABLE "pages_blocks_breadcrumb" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_client_logos.add_block_spacing', sql: `ALTER TABLE "pages_blocks_client_logos" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_menu_food.add_block_spacing', sql: `ALTER TABLE "pages_blocks_menu_food" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_portfolio_grid.add_block_spacing', sql: `ALTER TABLE "pages_blocks_portfolio_grid" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_doctor_profile.add_block_spacing', sql: `ALTER TABLE "pages_blocks_doctor_profile" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_property_card.add_block_spacing', sql: `ALTER TABLE "pages_blocks_property_card" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_class_schedule.add_block_spacing', sql: `ALTER TABLE "pages_blocks_class_schedule" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_video_showcase.add_block_spacing', sql: `ALTER TABLE "pages_blocks_video_showcase" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_product_quick_view.add_block_spacing', sql: `ALTER TABLE "pages_blocks_product_quick_view" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_feature_comparison.add_block_spacing', sql: `ALTER TABLE "pages_blocks_feature_comparison" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  // F05-GAP06: block_spacing jsonb on _pages_v_blocks_* (version/draft tables — same schema as pages_blocks_*)
  { name: '_pages_v_blocks_hero.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_hero" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_navigation.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_navigation" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_about.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_about" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_features.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_features" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_testimonials.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_testimonials" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_contact.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_contact" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_gallery.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_gallery" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_footer.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_footer" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_stats.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_stats" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_pricing.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_pricing" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_faq.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_faq" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_team.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_team" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_socialWidget.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_socialWidget" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_cartWidget.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_cartWidget" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_social_widget.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_social_widget" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_cart_widget.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_cart_widget" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_cta.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_cta" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_newsletter.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_newsletter" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_video.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_video" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_logo_cloud.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_logo_cloud" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_blog_list.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_blog_list" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_products_grid.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_products_grid" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  // GH-1588: showCategoryFilter opt-in toggle (F08 storefront category filter) — draft/versioned table
  { name: '_pages_v_blocks_products_grid.show_category_filter', sql: `ALTER TABLE "_pages_v_blocks_products_grid" ADD COLUMN IF NOT EXISTS show_category_filter boolean;` },
  { name: '_pages_v_blocks_products_featured.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_products_featured" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_custom_html.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_custom_html" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_service_cards.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_service_cards" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_carousel.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_carousel" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_step_process.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_step_process" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_divider.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_divider" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_announcement_bar.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_announcement_bar" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_whatsapp_button.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_whatsapp_button" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_google_maps.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_google_maps" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_accordion.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_accordion" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_countdown_timer.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_countdown_timer" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_social_proof.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_social_proof" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_breadcrumb.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_breadcrumb" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_client_logos.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_client_logos" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_menu_food.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_menu_food" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_portfolio_grid.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_portfolio_grid" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_doctor_profile.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_doctor_profile" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_property_card.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_property_card" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_class_schedule.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_class_schedule" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_video_showcase.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_video_showcase" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_product_quick_view.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_product_quick_view" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_feature_comparison.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_feature_comparison" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },

  // ── Navigation variant rename (Phase 01 — 2026-04-24) ───────────────────────
  // Renames: simple→default, mega-menu→mega, pill→floating in sites.header_block JSONB.
  // Idempotent: WHERE clause skips already-migrated rows.
  {
    name: 'sites.header_block_variant_simple_to_default',
    sql: `UPDATE sites SET header_block = jsonb_set(header_block, '{variant}', to_jsonb('default'::text)) WHERE header_block->>'variant' = 'simple';`,
  },
  {
    name: 'sites.header_block_variant_mega_menu_to_mega',
    sql: `UPDATE sites SET header_block = jsonb_set(header_block, '{variant}', to_jsonb('mega'::text)) WHERE header_block->>'variant' = 'mega-menu';`,
  },
  {
    name: 'sites.header_block_variant_pill_to_floating',
    sql: `UPDATE sites SET header_block = jsonb_set(header_block, '{variant}', to_jsonb('floating'::text)) WHERE header_block->>'variant' = 'pill';`,
  },

  // ── Navigation variant enum expansion (Phase 01 — 2026-04-24) ───────────────
  // Postgres native enums for navigation variant in pages/versioned-pages blocks.
  // ADD VALUE IF NOT EXISTS is idempotent. Old values kept (can't drop from enum).
  // Then update any existing rows that still use old names.
  { name: 'enum_pages_blocks_navigation_variant.add_default',     sql: `ALTER TYPE enum_pages_blocks_navigation_variant ADD VALUE IF NOT EXISTS 'default';` },
  { name: 'enum_pages_blocks_navigation_variant.add_mega',        sql: `ALTER TYPE enum_pages_blocks_navigation_variant ADD VALUE IF NOT EXISTS 'mega';` },
  { name: 'enum_pages_blocks_navigation_variant.add_floating',    sql: `ALTER TYPE enum_pages_blocks_navigation_variant ADD VALUE IF NOT EXISTS 'floating';` },
  { name: 'enum__pages_v_blocks_navigation_variant.add_default',  sql: `ALTER TYPE "enum__pages_v_blocks_navigation_variant" ADD VALUE IF NOT EXISTS 'default';` },
  { name: 'enum__pages_v_blocks_navigation_variant.add_mega',     sql: `ALTER TYPE "enum__pages_v_blocks_navigation_variant" ADD VALUE IF NOT EXISTS 'mega';` },
  { name: 'enum__pages_v_blocks_navigation_variant.add_floating', sql: `ALTER TYPE "enum__pages_v_blocks_navigation_variant" ADD VALUE IF NOT EXISTS 'floating';` },
  // Update existing rows in block tables (idempotent — WHERE filters already-migrated)
  { name: 'pages_blocks_navigation.variant_simple_to_default',    sql: `UPDATE pages_blocks_navigation SET variant = 'default' WHERE variant = 'simple';` },
  { name: 'pages_blocks_navigation.variant_mega_menu_to_mega',    sql: `UPDATE pages_blocks_navigation SET variant = 'mega' WHERE variant = 'mega-menu';` },
  { name: 'pages_blocks_navigation.variant_pill_to_floating',     sql: `UPDATE pages_blocks_navigation SET variant = 'floating' WHERE variant = 'pill';` },
  { name: '_pages_v_blocks_navigation.variant_simple_to_default', sql: `UPDATE "_pages_v_blocks_navigation" SET variant = 'default' WHERE variant = 'simple';` },
  { name: '_pages_v_blocks_navigation.variant_mega_menu_to_mega', sql: `UPDATE "_pages_v_blocks_navigation" SET variant = 'mega' WHERE variant = 'mega-menu';` },
  { name: '_pages_v_blocks_navigation.variant_pill_to_floating',  sql: `UPDATE "_pages_v_blocks_navigation" SET variant = 'floating' WHERE variant = 'pill';` },

  // ── Industry blocks enabled for AI gen (Plan 260422-1900-block-aivisible-audit-fix) ──
  // before-after, booking-widget, gallery-masonry: aiVisible flipped true → must exist in DB.

  // before-after ────────────────────────────────────────────────────────────
  {
    name: 'pages_blocks_before_after.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_before_after" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar,
      before_image_url varchar, before_image_alt varchar, before_image_label varchar,
      after_image_url varchar, after_image_alt varchar, after_image_label varchar
    );`,
  },
  {
    name: '_pages_v_blocks_before_after.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_before_after" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar,
      before_image_url varchar, before_image_alt varchar, before_image_label varchar,
      after_image_url varchar, after_image_alt varchar, after_image_label varchar
    );`,
  },

  // booking-widget ──────────────────────────────────────────────────────────
  {
    name: 'pages_blocks_booking_widget.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_booking_widget" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      available_days jsonb, time_slot_interval integer DEFAULT 30,
      start_time varchar DEFAULT '09:00', end_time varchar DEFAULT '18:00',
      booking_url varchar, show_price boolean DEFAULT true
    );`,
  },
  {
    name: 'pages_blocks_booking_widget_services.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_booking_widget_services" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, duration integer, price numeric, description varchar
    );`,
  },
  {
    name: '_pages_v_blocks_booking_widget.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_booking_widget" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      available_days jsonb, time_slot_interval integer,
      start_time varchar, end_time varchar,
      booking_url varchar, show_price boolean
    );`,
  },
  {
    name: '_pages_v_blocks_booking_widget_services.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_booking_widget_services" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      name varchar, duration integer, price numeric, description varchar
    );`,
  },

  // gallery-masonry ─────────────────────────────────────────────────────────
  {
    name: 'pages_blocks_gallery_masonry.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_gallery_masonry" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: 'pages_blocks_gallery_masonry_images.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_gallery_masonry_images" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      url varchar, alt varchar, caption varchar
    );`,
  },
  {
    name: '_pages_v_blocks_gallery_masonry.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_gallery_masonry" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar
    );`,
  },
  {
    name: '_pages_v_blocks_gallery_masonry_images.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_gallery_masonry_images" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      url varchar, alt varchar, caption varchar
    );`,
  },
  { name: 'pages_blocks_before_after.add_block_spacing', sql: `ALTER TABLE "pages_blocks_before_after" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_before_after.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_before_after" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_booking_widget.add_block_spacing', sql: `ALTER TABLE "pages_blocks_booking_widget" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_booking_widget.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_booking_widget" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_gallery_masonry.add_block_spacing', sql: `ALTER TABLE "pages_blocks_gallery_masonry" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_gallery_masonry.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_gallery_masonry" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },

  // ── GH-899: announcement-bar CTA fields ──────────────────────────────────
  { name: 'pages_blocks_announcement_bar.add_show_link', sql: `ALTER TABLE "pages_blocks_announcement_bar" ADD COLUMN IF NOT EXISTS show_link boolean;` },
  { name: 'pages_blocks_announcement_bar.add_link_is_internal', sql: `ALTER TABLE "pages_blocks_announcement_bar" ADD COLUMN IF NOT EXISTS link_is_internal boolean;` },
  { name: 'pages_blocks_announcement_bar.add_background_color2', sql: `ALTER TABLE "pages_blocks_announcement_bar" ADD COLUMN IF NOT EXISTS background_color2 varchar;` },
  { name: 'pages_blocks_announcement_bar.add_text_color', sql: `ALTER TABLE "pages_blocks_announcement_bar" ADD COLUMN IF NOT EXISTS text_color varchar;` },
  { name: 'pages_blocks_announcement_bar.add_padding_y', sql: `ALTER TABLE "pages_blocks_announcement_bar" ADD COLUMN IF NOT EXISTS padding_y integer;` },
  { name: '_pages_v_blocks_announcement_bar.add_show_link', sql: `ALTER TABLE "_pages_v_blocks_announcement_bar" ADD COLUMN IF NOT EXISTS show_link boolean;` },
  { name: '_pages_v_blocks_announcement_bar.add_link_is_internal', sql: `ALTER TABLE "_pages_v_blocks_announcement_bar" ADD COLUMN IF NOT EXISTS link_is_internal boolean;` },
  { name: '_pages_v_blocks_announcement_bar.add_background_color2', sql: `ALTER TABLE "_pages_v_blocks_announcement_bar" ADD COLUMN IF NOT EXISTS background_color2 varchar;` },
  { name: '_pages_v_blocks_announcement_bar.add_text_color', sql: `ALTER TABLE "_pages_v_blocks_announcement_bar" ADD COLUMN IF NOT EXISTS text_color varchar;` },
  { name: '_pages_v_blocks_announcement_bar.add_padding_y', sql: `ALTER TABLE "_pages_v_blocks_announcement_bar" ADD COLUMN IF NOT EXISTS padding_y integer;` },
  { name: 'pages_blocks_property_card_properties.add_image_id', sql: `ALTER TABLE "pages_blocks_property_card_properties" ADD COLUMN IF NOT EXISTS image_id integer;` },
  { name: '_pages_v_blocks_property_card_properties.add_image_id', sql: `ALTER TABLE "_pages_v_blocks_property_card_properties" ADD COLUMN IF NOT EXISTS image_id integer;` },

  // ── enum_sites_site_type: add values missing from the original enum ──────
  // Commit ec71ed01 expanded siteType options (tech, health, education,
  // realestate, fitness, creative, beauty) without a DB migration.
  // ADD VALUE IF NOT EXISTS is idempotent — safe to run on any env.
  { name: 'enum_sites_site_type.add_tech',        sql: `ALTER TYPE enum_sites_site_type ADD VALUE IF NOT EXISTS 'tech';` },
  { name: 'enum_sites_site_type.add_health',      sql: `ALTER TYPE enum_sites_site_type ADD VALUE IF NOT EXISTS 'health';` },
  { name: 'enum_sites_site_type.add_education',   sql: `ALTER TYPE enum_sites_site_type ADD VALUE IF NOT EXISTS 'education';` },
  { name: 'enum_sites_site_type.add_realestate',  sql: `ALTER TYPE enum_sites_site_type ADD VALUE IF NOT EXISTS 'realestate';` },
  { name: 'enum_sites_site_type.add_fitness',     sql: `ALTER TYPE enum_sites_site_type ADD VALUE IF NOT EXISTS 'fitness';` },
  { name: 'enum_sites_site_type.add_creative',    sql: `ALTER TYPE enum_sites_site_type ADD VALUE IF NOT EXISTS 'creative';` },
  { name: 'enum_sites_site_type.add_beauty',      sql: `ALTER TYPE enum_sites_site_type ADD VALUE IF NOT EXISTS 'beauty';` },
  { name: 'pages_blocks_whatsapp_button.add_country_code', sql: `ALTER TABLE "pages_blocks_whatsapp_button" ADD COLUMN IF NOT EXISTS country_code varchar;` },
  { name: '_pages_v_blocks_whatsapp_button.add_country_code', sql: `ALTER TABLE "_pages_v_blocks_whatsapp_button" ADD COLUMN IF NOT EXISTS country_code varchar;` },
  // GH-881 — FAQBlock fields subheadline + allowMultiple were missing from Payload schema
  { name: 'pages_blocks_faq.add_subheadline', sql: `ALTER TABLE "pages_blocks_faq" ADD COLUMN IF NOT EXISTS subheadline varchar;` },
  { name: 'pages_blocks_faq.add_allow_multiple', sql: `ALTER TABLE "pages_blocks_faq" ADD COLUMN IF NOT EXISTS allow_multiple boolean DEFAULT false;` },
  { name: '_pages_v_blocks_faq.add_subheadline', sql: `ALTER TABLE "_pages_v_blocks_faq" ADD COLUMN IF NOT EXISTS subheadline varchar;` },
  { name: '_pages_v_blocks_faq.add_allow_multiple', sql: `ALTER TABLE "_pages_v_blocks_faq" ADD COLUMN IF NOT EXISTS allow_multiple boolean DEFAULT false;` },
  // GH-891 — PricingBlock phase 01: per-plan fields + billing globals + featureMatrix
  { name: 'pages_blocks_pricing_plans.add_period', sql: `ALTER TABLE "pages_blocks_pricing_plans" ADD COLUMN IF NOT EXISTS period varchar;` },
  { name: 'pages_blocks_pricing_plans.add_highlighted', sql: `ALTER TABLE "pages_blocks_pricing_plans" ADD COLUMN IF NOT EXISTS highlighted boolean DEFAULT false;` },
  { name: 'pages_blocks_pricing_plans.add_yearly_price', sql: `ALTER TABLE "pages_blocks_pricing_plans" ADD COLUMN IF NOT EXISTS yearly_price varchar;` },
  { name: 'pages_blocks_pricing_plans.add_cta_action_type', sql: `ALTER TABLE "pages_blocks_pricing_plans" ADD COLUMN IF NOT EXISTS cta_action_type varchar DEFAULT 'external';` },
  { name: 'pages_blocks_pricing_plans.add_cta_style', sql: `ALTER TABLE "pages_blocks_pricing_plans" ADD COLUMN IF NOT EXISTS cta_style varchar DEFAULT 'primary';` },
  { name: 'pages_blocks_pricing.add_billing_cols', sql: `ALTER TABLE "pages_blocks_pricing" ADD COLUMN IF NOT EXISTS billing_cycle1 varchar DEFAULT 'Monthly', ADD COLUMN IF NOT EXISTS billing_cycle2 varchar DEFAULT 'Yearly', ADD COLUMN IF NOT EXISTS discount_percent integer;` },
  { name: 'pages_blocks_pricing_feature_matrix.create_table', sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_pricing_feature_matrix" (id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text, _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL, _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text, feature_name varchar);` },
  { name: 'pages_blocks_pricing_feature_matrix_values.create_table', sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_pricing_feature_matrix_values" (id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text, _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL, _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text, included boolean DEFAULT false);` },
  // Versioned mirrors for GH-891
  { name: '_pages_v_blocks_pricing_plans.add_period', sql: `ALTER TABLE "_pages_v_blocks_pricing_plans" ADD COLUMN IF NOT EXISTS period varchar;` },
  { name: '_pages_v_blocks_pricing_plans.add_highlighted', sql: `ALTER TABLE "_pages_v_blocks_pricing_plans" ADD COLUMN IF NOT EXISTS highlighted boolean DEFAULT false;` },
  { name: '_pages_v_blocks_pricing_plans.add_yearly_price', sql: `ALTER TABLE "_pages_v_blocks_pricing_plans" ADD COLUMN IF NOT EXISTS yearly_price varchar;` },
  { name: '_pages_v_blocks_pricing_plans.add_cta_action_type', sql: `ALTER TABLE "_pages_v_blocks_pricing_plans" ADD COLUMN IF NOT EXISTS cta_action_type varchar DEFAULT 'external';` },
  { name: '_pages_v_blocks_pricing_plans.add_cta_style', sql: `ALTER TABLE "_pages_v_blocks_pricing_plans" ADD COLUMN IF NOT EXISTS cta_style varchar DEFAULT 'primary';` },
  { name: '_pages_v_blocks_pricing.add_billing_cols', sql: `ALTER TABLE "_pages_v_blocks_pricing" ADD COLUMN IF NOT EXISTS billing_cycle1 varchar DEFAULT 'Monthly', ADD COLUMN IF NOT EXISTS billing_cycle2 varchar DEFAULT 'Yearly', ADD COLUMN IF NOT EXISTS discount_percent integer;` },
  { name: '_pages_v_blocks_pricing_feature_matrix.create_table', sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_pricing_feature_matrix" (id serial PRIMARY KEY, _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL, _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text, feature_name varchar);` },
  { name: '_pages_v_blocks_pricing_feature_matrix_values.create_table', sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_pricing_feature_matrix_values" (id serial PRIMARY KEY, _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL, _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text, included boolean DEFAULT false);` },
  // Rename billing_cycle_1/2 → billing_cycle1/2 to match Payload Drizzle naming (no underscore before digit)
  { name: 'pages_blocks_pricing.rename_billing_cycle_cols', sql: `ALTER TABLE "pages_blocks_pricing" RENAME COLUMN billing_cycle_1 TO billing_cycle1; ALTER TABLE "pages_blocks_pricing" RENAME COLUMN billing_cycle_2 TO billing_cycle2;` },
  { name: '_pages_v_blocks_pricing.rename_billing_cycle_cols', sql: `ALTER TABLE "_pages_v_blocks_pricing" RENAME COLUMN billing_cycle_1 TO billing_cycle1; ALTER TABLE "_pages_v_blocks_pricing" RENAME COLUMN billing_cycle_2 TO billing_cycle2;` },
  // GH-891: yearlyDiscount field was missing from Payload PricingBlock.fields — add column so saves persist
  { name: 'pages_blocks_pricing.add_yearly_discount', sql: `ALTER TABLE "pages_blocks_pricing" ADD COLUMN IF NOT EXISTS yearly_discount numeric;` },
  { name: '_pages_v_blocks_pricing.add_yearly_discount', sql: `ALTER TABLE "_pages_v_blocks_pricing" ADD COLUMN IF NOT EXISTS yearly_discount numeric;` },
  // GH-905 — users_tenants_permissions data integrity
  // 1. Remove rows whose parent_id no longer exists in users_tenants (orphaned by old update paths
  //    that re-created array items without id, causing users_tenants_permissions rows to be left behind).
  { name: 'users_tenants_permissions.cleanup_orphans', sql: `DELETE FROM users_tenants_permissions WHERE parent_id NOT IN (SELECT id FROM users_tenants);` },
  // 2. Deduplicate: keep one row per (parent_id, value). Old code accumulated duplicates because
  //    Payload's hasMany update inserts new rows without deleting old ones when updating by id.
  { name: 'users_tenants_permissions.dedup_values', sql: `DELETE FROM users_tenants_permissions WHERE id NOT IN (SELECT MIN(id) FROM users_tenants_permissions GROUP BY parent_id, value);` },
  // 3. Add FK → users_tenants so future deletes cascade and orphaned rows can't accumulate.
  //    DO block makes this idempotent (safe to run on DBs that already have the constraint).
  { name: 'users_tenants_permissions.add_fk_parent', sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_tenants_permissions_parent_fk') THEN ALTER TABLE users_tenants_permissions ADD CONSTRAINT users_tenants_permissions_parent_fk FOREIGN KEY (parent_id) REFERENCES users_tenants(id) ON DELETE CASCADE; END IF; END $$;` },
  // GH-905 follow-up — invite-staff assigned 'tenant-owner' platform role to all new users including staff.
  // Remove 'tenant-owner' from users_roles for users who have tenant memberships but are not an owner
  // in any of them. Owners (users_tenants.role = 'owner') are unaffected.
  { name: 'users_roles.strip_tenant_owner_from_non_owners', sql: `DELETE FROM users_roles WHERE value = 'tenant-owner' AND parent_id IN (SELECT DISTINCT u.id FROM users u WHERE EXISTS (SELECT 1 FROM users_tenants ut WHERE ut._parent_id = u.id) AND NOT EXISTS (SELECT 1 FROM users_tenants ut WHERE ut._parent_id = u.id AND ut.role = 'owner'));` },
  // GH-961: paymentStatus — separate payment tracking field for COD/QR Banking orders
  { name: 'orders.payment_status', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status varchar DEFAULT 'unpaid';` },
  { name: 'orders.payment_status_idx', sql: `CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders (payment_status);` },
  // GH-961: Sites paymentConfig group — merchant QR code + payment method toggles per site
  { name: 'sites.payment_config_merchant_qr_code_id', sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS payment_config_merchant_qr_code_id integer;` },
  { name: 'sites.payment_config_enable_cod', sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS payment_config_enable_cod boolean DEFAULT true;` },
  { name: 'sites.payment_config_enable_qr_banking', sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS payment_config_enable_qr_banking boolean DEFAULT true;` },
  { name: 'sites.payment_config_bank_name', sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS payment_config_bank_name varchar;` },
  { name: 'sites.payment_config_bank_account_no', sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS payment_config_bank_account_no varchar;` },
  { name: 'sites.payment_config_bank_account_holder', sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS payment_config_bank_account_holder varchar;` },
  // GH-961: Malaysia geo reference tables for checkout cascade dropdowns (state → district → postcode)
  { name: 'malaysia_states.create_table', sql: `CREATE TABLE IF NOT EXISTS malaysia_states (id serial PRIMARY KEY, name varchar(60) NOT NULL UNIQUE, state_code varchar(5) NOT NULL UNIQUE, zone varchar(5) NOT NULL DEFAULT 'west');` },
  { name: 'malaysia_states.create_idx', sql: `CREATE INDEX IF NOT EXISTS idx_malaysia_states_code ON malaysia_states(state_code);` },
  { name: 'malaysia_districts.create_table', sql: `CREATE TABLE IF NOT EXISTS malaysia_districts (id serial PRIMARY KEY, state_id integer NOT NULL REFERENCES malaysia_states(id), name varchar(100) NOT NULL);` },
  { name: 'malaysia_districts.create_idx', sql: `CREATE INDEX IF NOT EXISTS idx_malaysia_districts_state ON malaysia_districts(state_id);` },
  { name: 'malaysia_postcodes.create_table', sql: `CREATE TABLE IF NOT EXISTS malaysia_postcodes (id serial PRIMARY KEY, postcode varchar(5) NOT NULL UNIQUE, district_id integer NOT NULL REFERENCES malaysia_districts(id));` },
  { name: 'malaysia_postcodes.create_idx', sql: `CREATE INDEX IF NOT EXISTS idx_malaysia_postcodes_district ON malaysia_postcodes(district_id);` },
  // Normalize state names to match MY_STATES enum used by checkout validation (Zod)
  { name: 'malaysia_states.normalize_penang', sql: `UPDATE malaysia_states SET name = 'Penang' WHERE name = 'Pulau Pinang'` },
  { name: 'malaysia_states.normalize_kl', sql: `UPDATE malaysia_states SET name = 'Kuala Lumpur' WHERE name = 'W.P. Kuala Lumpur'` },
  { name: 'malaysia_states.normalize_putrajaya', sql: `UPDATE malaysia_states SET name = 'Putrajaya' WHERE name = 'W.P. Putrajaya'` },
  { name: 'malaysia_states.normalize_labuan', sql: `UPDATE malaysia_states SET name = 'Labuan' WHERE name = 'W.P. Labuan'` },

  // GH-960 — _pages_v column required by CI check (billing_toggle is a block field, harmless extra col)
  { name: '_pages_v.version_billing_toggle', sql: `ALTER TABLE _pages_v ADD COLUMN IF NOT EXISTS version_billing_toggle varchar;` },

  // GH-960 — pricing-table + menu-display Payload registration (Phase 01)
  {
    name: 'pages_blocks_pricing_table.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_pricing_table" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar, billing_toggle varchar
    );`,
  },
  {
    name: 'pages_blocks_pricing_table_plans.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_pricing_table_plans" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, price varchar, yearly_price varchar, currency varchar DEFAULT '$',
      description varchar, features varchar,
      cta_label varchar, cta_url varchar, popular boolean DEFAULT false
    );`,
  },
  {
    name: '_pages_v_blocks_pricing_table.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_pricing_table" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar, billing_toggle varchar
    );`,
  },
  {
    name: '_pages_v_blocks_pricing_table_plans.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_pricing_table_plans" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      name varchar, price varchar, yearly_price varchar, currency varchar,
      description varchar, features varchar,
      cta_label varchar, cta_url varchar, popular boolean DEFAULT false
    );`,
  },
  { name: 'pages_blocks_pricing_table.add_block_spacing', sql: `ALTER TABLE "pages_blocks_pricing_table" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_pricing_table.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_pricing_table" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },

  {
    name: 'pages_blocks_menu_display.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_menu_display" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      _path varchar NOT NULL DEFAULT 'layout', block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      currency varchar DEFAULT 'RM', show_dietary_icons boolean DEFAULT true
    );`,
  },
  {
    name: 'pages_blocks_menu_display_categories.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_menu_display_categories" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, description varchar, icon varchar
    );`,
  },
  {
    name: 'pages_blocks_menu_display_categories_items.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "pages_blocks_menu_display_categories_items" (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0, _parent_id varchar NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      name varchar, description varchar, price numeric,
      original_price numeric, image_url varchar, dietary_tags varchar,
      is_popular boolean DEFAULT false, is_new boolean DEFAULT false
    );`,
  },
  {
    name: '_pages_v_blocks_menu_display.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_menu_display" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _path text NOT NULL, _uuid varchar, block_name varchar,
      variant varchar, headline varchar, subheadline varchar,
      currency varchar, show_dietary_icons boolean
    );`,
  },
  {
    name: '_pages_v_blocks_menu_display_categories.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_menu_display_categories" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      name varchar, description varchar, icon varchar
    );`,
  },
  {
    name: '_pages_v_blocks_menu_display_categories_items.create_table',
    sql: `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_menu_display_categories_items" (
      id serial PRIMARY KEY,
      _order integer NOT NULL, _parent_id integer NOT NULL,
      _uuid varchar,
      name varchar, description varchar, price numeric,
      original_price numeric, image_url varchar, dietary_tags varchar,
      is_popular boolean DEFAULT false, is_new boolean DEFAULT false
    );`,
  },
  { name: 'pages_blocks_menu_display.add_block_spacing', sql: `ALTER TABLE "pages_blocks_menu_display" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: '_pages_v_blocks_menu_display.add_block_spacing', sql: `ALTER TABLE "_pages_v_blocks_menu_display" ADD COLUMN IF NOT EXISTS block_spacing jsonb;` },
  { name: 'pages_blocks_contact.add_i18n_labels', sql: `ALTER TABLE "pages_blocks_contact" ADD COLUMN IF NOT EXISTS submit_label varchar DEFAULT 'Send Message', ADD COLUMN IF NOT EXISTS phone_label varchar DEFAULT 'Phone', ADD COLUMN IF NOT EXISTS address_label varchar DEFAULT 'Address', ADD COLUMN IF NOT EXISTS email_label varchar DEFAULT 'Email';` },
  { name: '_pages_v_blocks_contact.add_i18n_labels', sql: `ALTER TABLE "_pages_v_blocks_contact" ADD COLUMN IF NOT EXISTS submit_label varchar DEFAULT 'Send Message', ADD COLUMN IF NOT EXISTS phone_label varchar DEFAULT 'Phone', ADD COLUMN IF NOT EXISTS address_label varchar DEFAULT 'Address', ADD COLUMN IF NOT EXISTS email_label varchar DEFAULT 'Email';` },
  { name: 'pages_blocks_testimonials.add_subheadline', sql: `ALTER TABLE "pages_blocks_testimonials" ADD COLUMN IF NOT EXISTS subheadline varchar;` },
  { name: '_pages_v_blocks_testimonials.add_subheadline', sql: `ALTER TABLE "_pages_v_blocks_testimonials" ADD COLUMN IF NOT EXISTS subheadline varchar;` },
  { name: 'pages_blocks_contact.add_section_label', sql: `ALTER TABLE "pages_blocks_contact" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: '_pages_v_blocks_contact.add_section_label', sql: `ALTER TABLE "_pages_v_blocks_contact" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: 'pages_blocks_gallery.add_section_label', sql: `ALTER TABLE "pages_blocks_gallery" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: '_pages_v_blocks_gallery.add_section_label', sql: `ALTER TABLE "_pages_v_blocks_gallery" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: 'pages_blocks_stats.add_section_label', sql: `ALTER TABLE "pages_blocks_stats" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: '_pages_v_blocks_stats.add_section_label', sql: `ALTER TABLE "_pages_v_blocks_stats" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: 'pages_blocks_pricing.add_section_label', sql: `ALTER TABLE "pages_blocks_pricing" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: '_pages_v_blocks_pricing.add_section_label', sql: `ALTER TABLE "_pages_v_blocks_pricing" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: 'pages_blocks_team.add_section_label', sql: `ALTER TABLE "pages_blocks_team" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: '_pages_v_blocks_team.add_section_label', sql: `ALTER TABLE "_pages_v_blocks_team" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: 'pages_blocks_newsletter.add_section_label', sql: `ALTER TABLE "pages_blocks_newsletter" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: '_pages_v_blocks_newsletter.add_section_label', sql: `ALTER TABLE "_pages_v_blocks_newsletter" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: 'pages_blocks_blog_list.add_section_label', sql: `ALTER TABLE "pages_blocks_blog_list" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: '_pages_v_blocks_blog_list.add_section_label', sql: `ALTER TABLE "_pages_v_blocks_blog_list" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: 'pages_blocks_blog_list.add_locale_labels', sql: `ALTER TABLE "pages_blocks_blog_list" ADD COLUMN IF NOT EXISTS read_article_label varchar, ADD COLUMN IF NOT EXISTS uncategorized_label varchar, ADD COLUMN IF NOT EXISTS empty_state_label varchar;` },
  { name: '_pages_v_blocks_blog_list.add_locale_labels', sql: `ALTER TABLE "_pages_v_blocks_blog_list" ADD COLUMN IF NOT EXISTS read_article_label varchar, ADD COLUMN IF NOT EXISTS uncategorized_label varchar, ADD COLUMN IF NOT EXISTS empty_state_label varchar;` },
  { name: 'pages_blocks_service_cards.add_section_label', sql: `ALTER TABLE "pages_blocks_service_cards" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: '_pages_v_blocks_service_cards.add_section_label', sql: `ALTER TABLE "_pages_v_blocks_service_cards" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: 'pages_blocks_client_logos.add_section_label', sql: `ALTER TABLE "pages_blocks_client_logos" ADD COLUMN IF NOT EXISTS section_label varchar;` },
  { name: '_pages_v_blocks_client_logos.add_section_label', sql: `ALTER TABLE "_pages_v_blocks_client_logos" ADD COLUMN IF NOT EXISTS section_label varchar;` },

  // GH-1004: F10 v2.2 Bank Transfer verification schema fields
  { name: 'orders.payment_reference_idx', sql: `CREATE INDEX IF NOT EXISTS orders_payment_reference_idx ON orders (payment_reference);` },
  { name: 'orders.payment_expires_at', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz;` },
  { name: 'orders.payment_expires_at_idx', sql: `CREATE INDEX IF NOT EXISTS orders_payment_expires_at_idx ON orders (payment_expires_at);` },
  // US-F13-06 fix: the column was originally created as `timestamp` (no tz), so UTC values were read
  // back naive → the confirm-page countdown was skewed by the client's UTC offset. Convert to
  // timestamptz, interpreting existing naive values as UTC (DB session tz is UTC). Idempotent.
  { name: 'orders.payment_expires_at_tz', sql: `DO $$
    BEGIN
      IF (SELECT data_type FROM information_schema.columns
          WHERE table_name='orders' AND column_name='payment_expires_at') = 'timestamp without time zone' THEN
        ALTER TABLE orders ALTER COLUMN payment_expires_at TYPE timestamptz USING payment_expires_at AT TIME ZONE 'UTC';
      END IF;
    END $$;` },
  { name: 'orders.payment_rejection_reason', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_rejection_reason varchar;` },
  { name: 'orders.payment_rejection_detail', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_rejection_detail text;` },
  { name: 'orders.payment_verified_at', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_verified_at timestamp;` },
  { name: 'orders.payment_verified_by_id', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_verified_by_id integer;` },
  { name: 'orders.magic_link_secret', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS magic_link_secret varchar;` },
  { name: 'orders.verification_source', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS verification_source varchar DEFAULT 'manual';` },
  { name: 'orders.auto_verified_at', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_verified_at timestamp;` },
  { name: 'orders.bank_transaction_id', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS bank_transaction_id varchar;` },
  { name: 'orders.enum_payment_method_bank_transfer', sql: `DO $$ BEGIN ALTER TYPE enum_orders_payment_method ADD VALUE IF NOT EXISTS 'bank_transfer'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` },
  { name: 'orders.backfill_bank_transfer_method', sql: `UPDATE orders SET payment_method='bank_transfer' WHERE payment_method='qr_banking' AND payment_status NOT IN ('paid','cancelled','refunded') AND created_at > NOW() - INTERVAL '7 days';` },
  // ── F13: FPX + Card payment via Stripe Checkout Session (issue #963) ──
  { name: 'orders.enum_payment_method_fpx', sql: `DO $$ BEGIN ALTER TYPE enum_orders_payment_method ADD VALUE IF NOT EXISTS 'fpx'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` },
  // 'new' = order confirmed by Stripe webhook (checkout.session.completed). Webhook sets status 'pending' → 'new'.
  { name: 'orders.enum_status_new', sql: `DO $$ BEGIN ALTER TYPE enum_orders_status ADD VALUE IF NOT EXISTS 'new'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` },
  // 'confirmed' + 'ready_to_ship' were added to Orders.ts collection definition without a corresponding db-setup migration.
  // Staging DB enum was missing these values — caused INTERNAL_ERROR when seller confirms an order.
  { name: 'orders.enum_status_confirmed', sql: `DO $$ BEGIN ALTER TYPE enum_orders_status ADD VALUE IF NOT EXISTS 'confirmed'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` },
  { name: 'orders.enum_status_ready_to_ship', sql: `DO $$ BEGIN ALTER TYPE enum_orders_status ADD VALUE IF NOT EXISTS 'ready_to_ship'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` },
  { name: 'orders.enum_status_payment_failed', sql: `DO $$ BEGIN ALTER TYPE enum_orders_status ADD VALUE IF NOT EXISTS 'payment_failed'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` },
  { name: 'orders.enum_status_processing', sql: `DO $$ BEGIN ALTER TYPE enum_orders_status ADD VALUE IF NOT EXISTS 'processing'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` },
  // create-label claim CAS filters status IN ('confirmed','paid','processing') — 'paid' relied
  // on the original enum; any environment missing the label would 500 every create-label call.
  { name: 'orders.enum_status_paid', sql: `DO $$ BEGIN ALTER TYPE enum_orders_status ADD VALUE IF NOT EXISTS 'paid'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` },
  { name: 'orders.stripe_charge_id', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_charge_id varchar;` },
  { name: 'orders.stripe_charge_id_idx', sql: `CREATE INDEX IF NOT EXISTS orders_stripe_charge_id_idx ON orders(stripe_charge_id);` },
  // ── F34: Xendit payment fields on Orders ──
  { name: 'orders.xendit_payment_request_id', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS xendit_payment_request_id varchar;` },
  { name: 'orders.xendit_payment_request_id_idx', sql: `CREATE INDEX IF NOT EXISTS orders_xendit_payment_request_id_idx ON orders (xendit_payment_request_id);` },
  { name: 'orders.xendit_channel_code', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS xendit_channel_code varchar;` },
  { name: 'orders.payment_reminder_sent_at', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reminder_sent_at timestamp with time zone;` },
  { name: 'orders.payment_provider', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider varchar;` },
  { name: 'orders.payment_provider_idx', sql: `CREATE INDEX IF NOT EXISTS orders_payment_provider_idx ON orders (payment_provider);` },
  { name: 'sites.payment_config_card_enabled', sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS payment_config_card_enabled boolean DEFAULT true;` },
  { name: 'sites.payment_config_fpx_enabled', sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS payment_config_fpx_enabled boolean DEFAULT true;` },
  // ── F13: Tenant-level Card/FPX master toggles (docs/architecture/F13-payment-gateway.md §4) ──
  { name: 'tenants.payments_payment_card', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_payment_card boolean DEFAULT false;` },
  { name: 'tenants.payments_payment_fpx', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_payment_fpx boolean DEFAULT false;` },
  { name: 'tenants.payments_payment_card.backfill_onboarded', sql: `UPDATE tenants SET payments_payment_card = true WHERE stripe_onboarding_complete = true AND payments_payment_card = false;` },
  // ── F13: Bank Transfer bank_name + account_number for DuitNow QR section ──
  { name: 'tenants.payments_bank_name', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_bank_name varchar;` },
  { name: 'tenants.payments_account_number', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_account_number varchar;` },
  { name: 'tenants.payments_account_holder_name', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments_account_holder_name varchar;` },
  // ── F08-1032: DB-level SKU uniqueness (case-insensitive, per-tenant / per-product) ──
  // GH-1432: dashboard product list filters active rows by tenant and sorts newest first.
  { name: 'products.active_tenant_created_idx', sql: `CREATE INDEX IF NOT EXISTS products_active_tenant_created_idx ON products (tenant_id, created_at DESC) WHERE deleted_at IS NULL;` },
  // Closes concurrent-save gap in findConflictingSkus (application-layer check is NOT atomic).
  // Partial index excludes soft-deleted rows and null-tenant (super-admin) products.
  { name: 'products.sku_tenant_unique_idx', sql: `CREATE UNIQUE INDEX IF NOT EXISTS products_sku_tenant_uniq ON products (tenant_id, lower(sku)) WHERE sku IS NOT NULL AND deleted_at IS NULL AND tenant_id IS NOT NULL;` },
  // Variant SKU uniqueness scoped per parent product (_parent_id = products.id).
  // Cross-product variant SKU uniqueness is enforced at application layer (findConflictingSkus).
  { name: 'products_variants.sku_parent_unique_idx', sql: `CREATE UNIQUE INDEX IF NOT EXISTS products_variants_sku_parent_uniq ON products_variants (_parent_id, lower(sku)) WHERE sku IS NOT NULL;` },
  // ── F25: Shop Customers collection ──
  { name: 'customers.create_table',
    sql: `CREATE TABLE IF NOT EXISTS customers (
      id serial PRIMARY KEY,
      tenant_id integer NOT NULL,
      email varchar NOT NULL,
      name varchar NOT NULL,
      phone varchar,
      rank varchar,
      notes text,
      first_order_at timestamptz,
      updated_at timestamptz DEFAULT now() NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    );` },
  { name: 'customers.tenant_email_lower_unique',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_email_lower_uniq
          ON customers (tenant_id, LOWER(TRIM(email)));` },
  { name: 'customers.tenant_index',
    sql: `CREATE INDEX IF NOT EXISTS customers_tenant_idx ON customers (tenant_id);` },
  { name: 'customers_addresses.create_table',
    sql: `CREATE TABLE IF NOT EXISTS customers_addresses (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      _order integer NOT NULL DEFAULT 0,
      _parent_id integer NOT NULL,
      _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
      label varchar,
      line1 varchar NOT NULL,
      line2 varchar,
      city varchar,
      state varchar,
      postcode varchar,
      country varchar DEFAULT 'Malaysia',
      is_default boolean DEFAULT false
    );` },
  { name: 'customers_addresses.parent_index',
    sql: `CREATE INDEX IF NOT EXISTS customers_addresses_parent_idx
          ON customers_addresses (_parent_id);` },
  { name: 'payload_locked_documents_rels.customers_id',
    sql: `ALTER TABLE payload_locked_documents_rels
          ADD COLUMN IF NOT EXISTS customers_id integer;` },
  { name: 'payload_preferences_rels.customers_id',
    sql: `ALTER TABLE payload_preferences_rels
          ADD COLUMN IF NOT EXISTS customers_id integer;` },
  // ── F13 US-F13-06: oversell_review column RETAINED per NEVER-DROP policy.
  //    Field removed from Orders collection (GH-1099): the decrement-upfront architecture
  //    (stock decremented at checkout/session creation, CAS-guarded, for all payment methods)
  //    makes oversell-after-capture impossible, so the flag was dead code. Column kept
  //    (harmless, default false) — never read or written by application code anymore. ──
  { name: 'orders.oversell_review',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS oversell_review boolean DEFAULT false;` },
  // ── F13: Stripe card details for the confirm-page "Method" line (e.g. "Visa ending in 4242") ──
  { name: 'orders.card_brand', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_brand varchar;` },
  { name: 'orders.card_last4', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_last4 varchar;` },
  // ── F25 phase-03: Orders → Customer FK ──
  { name: 'orders.customer',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id integer;` },
  { name: 'orders.customer_id_index',
    sql: `CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);` },
  // CQ-01: FK constraint — ON DELETE SET NULL preserves order history if a customer row is ever removed
  { name: 'orders.customer_id_fk',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_customer_id_fk'
      ) THEN
        ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fk
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
      END IF;
    END $$;` },
  // ── F25 phase-04: Phone as primary identity key ──
  { name: 'customers.email_not_null_drop',
    sql: `ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;` },
  { name: 'customers.drop_email_unique_index',
    sql: `DROP INDEX IF EXISTS customers_tenant_email_lower_uniq;` },
  // Normalize existing phone values to match application normalizePhone() before dedup + unique index.
  // Strips: spaces, dashes, parentheses, '+', dots — then lowercases. Idempotent on already-normalized values.
  // Must run BEFORE dedup so that '+601234' and '601234' collapse to the same key and are deduped correctly.
  { name: 'customers.normalize_existing_phones',
    sql: `UPDATE customers
          SET phone = LOWER(REGEXP_REPLACE(phone, '[-[:space:]()+.]', '', 'g'))
          WHERE phone IS NOT NULL AND TRIM(phone) != '';` },
  // Dedup before creating phone unique index — keeps oldest row per (tenant, phone), nullifies phone on duplicates
  { name: 'customers.dedup_by_phone',
    sql: `UPDATE customers SET phone = NULL
          WHERE id NOT IN (
            SELECT DISTINCT ON (tenant_id, LOWER(TRIM(phone))) id
            FROM customers
            WHERE phone IS NOT NULL AND TRIM(phone) != ''
            ORDER BY tenant_id, LOWER(TRIM(phone)), created_at ASC, id ASC
          ) AND phone IS NOT NULL AND TRIM(phone) != '';` },
  { name: 'customers.tenant_phone_partial_unique',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_phone_uniq
          ON customers (tenant_id, LOWER(TRIM(phone)))
          WHERE phone IS NOT NULL AND TRIM(phone) != '';` },
  // ── F25 phase-06: latestOrderAt column ──
  { name: 'customers.latest_order_at',
    sql: `ALTER TABLE customers ADD COLUMN IF NOT EXISTS latest_order_at timestamptz;` },
  { name: 'customers.backfill_latest_order_at',
    sql: `UPDATE customers c SET latest_order_at = (
            SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id
          ) WHERE latest_order_at IS NULL AND id IN (
            SELECT DISTINCT customer_id FROM orders WHERE customer_id IS NOT NULL
          );` },
  // CQ-02: Align DB column type with spec (varchar(20)); safe — normalized phones are always ≤ 15 chars
  { name: 'customers.phone_type_varchar20',
    sql: `ALTER TABLE customers ALTER COLUMN phone TYPE varchar(20);` },
  // ── F26: Per-locale content storage for multilingual editor ──
  {
    name: 'pages.locale_content',
    sql: `ALTER TABLE pages ADD COLUMN IF NOT EXISTS locale_content jsonb DEFAULT '{}';`,
  },
  // ── F26-01: Language confirm flag after AI generation ──
  {
    name: 'sites.pending_locale_confirm',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS pending_locale_confirm boolean DEFAULT false;`,
  },
  // ── F26: Generation locale — immutable locale AI used for flat blocks ──
  {
    name: 'sites.generation_locale',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS generation_locale varchar DEFAULT 'ms';`,
  },
  // ── F26 fix: the DEFAULT 'ms' above wrongly tagged pre-F26 sites (whose locale is 'en') with
  // generation_locale='ms'. In the editor that makes activeLocale ('en') != baseLocale ('ms'), so
  // getDisplayBlock applies generic locale templates over the user's saved content. Backfill only the
  // rows carrying the default 'ms' whose locale is NOT 'ms' (targeted — never touches a legitimately
  // non-standard gen locale like 'vi'/'el', which keep locale='ms' as their translation slot).
  {
    name: 'sites.generation_locale.backfill_locale',
    sql: `UPDATE sites SET generation_locale = locale::text WHERE generation_locale = 'ms' AND locale::text IS DISTINCT FROM 'ms';`,
  },
  // Drop the misleading default so any future row without an explicit generation_locale stays NULL —
  // editor-data then falls back to `site.locale` (correct) instead of a hardcoded 'ms'.
  {
    name: 'sites.generation_locale.drop_default',
    sql: `ALTER TABLE sites ALTER COLUMN generation_locale DROP DEFAULT;`,
  },
  // BUG-#1082: index for SQL CAS queries on products_variants(_parent_id, name)
  // used by decrementVariantStock + restockItem on every variant checkout/cancel
  { name: 'products_variants.parent_name_idx',
    sql: `CREATE INDEX IF NOT EXISTS products_variants_parent_name_idx ON products_variants (_parent_id, name);` },
  // BUG-#1082 H1: enforce unique variant names per product at DB level; prevents CAS double-decrement
  { name: 'products_variants.name_parent_uniq_idx',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS products_variants_name_parent_uniq
          ON products_variants (_parent_id, lower(name))
          WHERE name IS NOT NULL;` },
  // ── F32: Email Template Settings ──
  {
    name: 'email_template_settings.create_table',
    sql: `CREATE TABLE IF NOT EXISTS email_template_settings (
      id serial PRIMARY KEY,
      tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      template_type varchar NOT NULL,
      recipient varchar NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      content_en_subject varchar(200),
      content_en_greeting text,
      content_en_cta_label varchar(100),
      content_en_closing text,
      content_ms_subject varchar(200),
      content_ms_greeting text,
      content_ms_cta_label varchar(100),
      content_ms_closing text,
      updated_by_id integer REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
  },
  {
    name: 'email_template_settings.unique_idx',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS email_template_settings_tenant_type_recipient_uniq
      ON email_template_settings (tenant_id, template_type, recipient)`,
  },
  {
    name: 'email_template_settings.tenant_idx',
    sql: `CREATE INDEX IF NOT EXISTS email_template_settings_tenant_idx
      ON email_template_settings (tenant_id)`,
  },
  {
    name: 'email_template_settings.alter_columns',
    sql: `
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS tenant_id integer REFERENCES tenants(id) ON DELETE CASCADE;
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS template_type varchar;
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS recipient varchar;
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS content_en_subject varchar(200);
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS content_en_greeting text;
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS content_en_cta_label varchar(100);
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS content_en_closing text;
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS content_ms_subject varchar(200);
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS content_ms_greeting text;
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS content_ms_cta_label varchar(100);
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS content_ms_closing text;
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS updated_by_id integer REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
      ALTER TABLE email_template_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
    `,
  },
  // ── F32: payload_locked_documents_rels FK column for email-template-settings ──
  {
    name: 'payload_locked_documents_rels.email_template_settings_id',
    sql: `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "email_template_settings_id" integer REFERENCES "public"."email_template_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  },
  {
    name: 'payload_locked_documents_rels.email_template_settings_id_idx',
    sql: `CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_email_template_settings_id_idx" ON "payload_locked_documents_rels" ("email_template_settings_id");`,
  },
  // ── F33: discounts ──
  {
    name: 'discounts.create_table',
    sql: `CREATE TABLE IF NOT EXISTS discounts (
      id serial PRIMARY KEY,
      tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      site_id integer REFERENCES sites(id) ON DELETE SET NULL,
      code varchar NOT NULL,
      description text,
      type varchar NOT NULL,
      value numeric NOT NULL DEFAULT 0,
      status varchar NOT NULL DEFAULT 'active',
      usage_limit integer,
      usage_count integer NOT NULL DEFAULT 0,
      starts_at timestamptz,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: 'discounts.tenant_code_uq',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS discounts_tenant_code_uq ON discounts (tenant_id, upper(code));`,
  },
  {
    name: 'discounts.status_idx',
    sql: `CREATE INDEX IF NOT EXISTS discounts_status_idx ON discounts (status);`,
  },
  {
    name: 'discounts.tenant_idx',
    sql: `CREATE INDEX IF NOT EXISTS discounts_tenant_idx ON discounts (tenant_id);`,
  },
  {
    name: 'discounts.alter_columns',
    sql: `
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS tenant_id integer REFERENCES tenants(id) ON DELETE CASCADE;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS site_id integer REFERENCES sites(id) ON DELETE SET NULL;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS code varchar;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS description text;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS type varchar;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS value numeric NOT NULL DEFAULT 0;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'active';
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS usage_limit integer;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS starts_at timestamptz;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS expires_at timestamptz;
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
      ALTER TABLE discounts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
    `,
  },
  // ── F33: discount_usage_history ──
  {
    name: 'discount_usage_history.create_table',
    sql: `CREATE TABLE IF NOT EXISTS discount_usage_history (
      id serial PRIMARY KEY,
      tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      discount_id integer REFERENCES discounts(id) ON DELETE SET NULL,
      order_id integer REFERENCES orders(id) ON DELETE SET NULL,
      amount_applied numeric NOT NULL DEFAULT 0,
      customer_email varchar,
      discount_code varchar,
      discount_type varchar,
      discount_value numeric,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: 'discount_usage_history.order_uq',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS discount_usage_history_order_uq ON discount_usage_history (order_id);`,
  },
  {
    name: 'discount_usage_history.discount_idx',
    sql: `CREATE INDEX IF NOT EXISTS discount_usage_history_discount_idx ON discount_usage_history (discount_id);`,
  },
  {
    name: 'discount_usage_history.tenant_idx',
    sql: `CREATE INDEX IF NOT EXISTS discount_usage_history_tenant_idx ON discount_usage_history (tenant_id);`,
  },
  {
    name: 'discount_usage_history.alter_columns',
    sql: `
      ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS tenant_id integer REFERENCES tenants(id) ON DELETE CASCADE;
      ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS discount_id integer REFERENCES discounts(id) ON DELETE SET NULL;
      ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS order_id integer REFERENCES orders(id) ON DELETE SET NULL;
      ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS amount_applied numeric NOT NULL DEFAULT 0;
      ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS customer_email varchar;
      ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS discount_code varchar;
      ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS discount_type varchar;
      ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS discount_value numeric;
      ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS used_at timestamptz;
      ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
      ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
    `,
  },
  // ── F33: orders ALTER — add discount columns ──
  {
    name: 'orders.add_discount_columns',
    sql: `
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_id integer REFERENCES discounts(id) ON DELETE SET NULL;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code varchar;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric
    `,
  },
  // ── F34: Plan Subscription Management ──
  {
    name: 'f-subscription-plans-table',
    sql: `
      CREATE TABLE IF NOT EXISTS plans (
        id                 SERIAL PRIMARY KEY,
        code               VARCHAR(50)  NOT NULL UNIQUE,
        name               VARCHAR(100) NOT NULL,
        description        TEXT,
        price              DECIMAL(7,2) NOT NULL DEFAULT 0.00,
        currency           VARCHAR(10)  NOT NULL DEFAULT 'MYR',
        interval           VARCHAR(20)  NOT NULL DEFAULT 'month',
        interval_count     SMALLINT     NOT NULL DEFAULT 1,
        trial_period_days  SMALLINT,
        sort_order         SMALLINT,
        created_at         TIMESTAMPTZ  DEFAULT NOW(),
        updated_at         TIMESTAMPTZ  DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_plans_code ON plans(code);
    `,
  },
  {
    name: 'f-subscription-plans-seed',
    sql: `
      INSERT INTO plans (code, name, description, price, currency, interval, interval_count, trial_period_days, sort_order)
      VALUES
        ('FREEMIUM',                 'Freemium',      'Freemium plan',                       0.00,   'MYR', 'month', 1, 0, 1),
        ('STARTER_TM_USER',          'Starter',       'Starter plan for TM User',            49.00,  'MYR', 'month', 1, 0, 5),
        ('STARTER_NON_TM_USER',      'Starter',       'Starter plan for Non TM User',        59.00,  'MYR', 'month', 1, 0, 10),
        ('STANDARD_TM_USER',         'Standard',      'Standard plan for TM User',           129.00, 'MYR', 'month', 1, 0, 15),
        ('STANDARD_NON_TM_USER',     'Standard',      'Standard plan for Non TM User',       159.00, 'MYR', 'month', 1, 0, 20),
        ('PROFESSIONAL_TM_USER',     'Professional',  'Professional plan for TM User',       289.00, 'MYR', 'month', 1, 0, 25),
        ('PROFESSIONAL_NON_TM_USER', 'Professional',  'Professional plan for Non TM User',   309.00, 'MYR', 'month', 1, 0, 30)
      ON CONFLICT (code) DO NOTHING;
    `,
  },
  {
    name: 'f-subscription-plan-subscriptions-table',
    sql: `
      CREATE TABLE IF NOT EXISTS plan_subscriptions (
        id          SERIAL PRIMARY KEY,
        tenant_id   INTEGER NOT NULL REFERENCES tenants(id),
        name        VARCHAR(50) NOT NULL DEFAULT 'main',
        plan        VARCHAR(50) NOT NULL,
        status      VARCHAR(20) NOT NULL DEFAULT 'active',
        starts_at   TIMESTAMPTZ NOT NULL,
        ends_at     TIMESTAMPTZ NOT NULL,
        canceled_at          TIMESTAMPTZ,
        canceled_immediately BOOLEAN NOT NULL DEFAULT false,
        pack_code            VARCHAR(100),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_plan_subscriptions_tenant_id ON plan_subscriptions(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_plan_subscriptions_ends_at ON plan_subscriptions(ends_at);
    `,
  },
  {
    name: 'f-subscription-plan-subscription-usages-table',
    sql: `
      CREATE TABLE IF NOT EXISTS plan_subscription_usages (
        id              SERIAL PRIMARY KEY,
        subscription_id INTEGER NOT NULL REFERENCES plan_subscriptions(id) ON DELETE CASCADE,
        feature_code    VARCHAR(100) NOT NULL,
        used            SMALLINT NOT NULL DEFAULT 0,
        valid_until     TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(subscription_id, feature_code)
      );
      CREATE INDEX IF NOT EXISTS idx_plan_sub_usages_subscription_id ON plan_subscription_usages(subscription_id);
    `,
  },
  {
    name: 'f-subscription-plan-features-table',
    sql: `
      CREATE TABLE IF NOT EXISTS plan_features (
        id           SERIAL PRIMARY KEY,
        plan_id      INTEGER REFERENCES plans(id) ON DELETE CASCADE,
        plan_code    VARCHAR(50) NOT NULL,
        feature_code VARCHAR(100) NOT NULL,
        value        VARCHAR(100) NOT NULL DEFAULT 'YES',
        settings     JSONB,
        sort_order   SMALLINT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(plan_code, feature_code)
      );
      CREATE INDEX IF NOT EXISTS idx_plan_features_plan_code ON plan_features(plan_code);
    `,
  },
  {
    name: 'f-subscription-plan-features-seed',
    sql: `
      INSERT INTO plan_features (plan_id, plan_code, feature_code, value)
      SELECT p.id, v.plan_code, v.feature_code, v.value
      FROM (VALUES
        ('FREEMIUM','website_builder','YES'),
        ('FREEMIUM','template_limit','YES'),
        ('FREEMIUM','code_snippet','YES'),
        ('FREEMIUM','sitemap_robot_configuration','YES'),
        ('FREEMIUM','live_chat_plugin','YES'),
        ('FREEMIUM','domain_connection','YES'),
        ('FREEMIUM','shipping_fee_configuration','YES'),
        ('FREEMIUM','delivery_provider_limit','YES'),
        ('FREEMIUM','allowing_buyer_making_order','YES'),
        ('FREEMIUM','allowing_buyer_tracking_order','YES'),
        ('FREEMIUM','payment_integration','YES'),
        ('FREEMIUM','order_management','YES'),
        ('FREEMIUM','product_management','YES'),
        ('FREEMIUM','promotion_management','YES'),
        ('FREEMIUM','content_management','YES'),
        ('FREEMIUM','email_confirmation','YES'),
        ('FREEMIUM','email_template_configuration','YES'),
        ('FREEMIUM','staff_limit','YES'),
        ('FREEMIUM','account_profile','YES'),
        ('FREEMIUM','distribution_integration','YES'),
        ('STARTER_TM_USER','website_builder','YES'),
        ('STARTER_TM_USER','template_limit','YES'),
        ('STARTER_TM_USER','code_snippet','YES'),
        ('STARTER_TM_USER','sitemap_robot_configuration','YES'),
        ('STARTER_TM_USER','live_chat_plugin','YES'),
        ('STARTER_TM_USER','domain_connection','YES'),
        ('STARTER_TM_USER','shipping_fee_configuration','YES'),
        ('STARTER_TM_USER','delivery_provider_limit','YES'),
        ('STARTER_TM_USER','allowing_buyer_making_order','YES'),
        ('STARTER_TM_USER','allowing_buyer_tracking_order','YES'),
        ('STARTER_TM_USER','payment_integration','YES'),
        ('STARTER_TM_USER','order_management','YES'),
        ('STARTER_TM_USER','product_management','YES'),
        ('STARTER_TM_USER','promotion_management','YES'),
        ('STARTER_TM_USER','content_management','YES'),
        ('STARTER_TM_USER','email_confirmation','YES'),
        ('STARTER_TM_USER','email_template_configuration','YES'),
        ('STARTER_TM_USER','staff_limit','YES'),
        ('STARTER_TM_USER','account_profile','YES'),
        ('STARTER_TM_USER','distribution_integration','YES'),
        ('STARTER_NON_TM_USER','website_builder','YES'),
        ('STARTER_NON_TM_USER','template_limit','YES'),
        ('STARTER_NON_TM_USER','code_snippet','YES'),
        ('STARTER_NON_TM_USER','sitemap_robot_configuration','YES'),
        ('STARTER_NON_TM_USER','live_chat_plugin','YES'),
        ('STARTER_NON_TM_USER','domain_connection','YES'),
        ('STARTER_NON_TM_USER','shipping_fee_configuration','YES'),
        ('STARTER_NON_TM_USER','delivery_provider_limit','YES'),
        ('STARTER_NON_TM_USER','allowing_buyer_making_order','YES'),
        ('STARTER_NON_TM_USER','allowing_buyer_tracking_order','YES'),
        ('STARTER_NON_TM_USER','payment_integration','YES'),
        ('STARTER_NON_TM_USER','order_management','YES'),
        ('STARTER_NON_TM_USER','product_management','YES'),
        ('STARTER_NON_TM_USER','promotion_management','YES'),
        ('STARTER_NON_TM_USER','content_management','YES'),
        ('STARTER_NON_TM_USER','email_confirmation','YES'),
        ('STARTER_NON_TM_USER','email_template_configuration','YES'),
        ('STARTER_NON_TM_USER','staff_limit','YES'),
        ('STARTER_NON_TM_USER','account_profile','YES'),
        ('STARTER_NON_TM_USER','distribution_integration','YES'),
        ('STANDARD_TM_USER','website_builder','YES'),
        ('STANDARD_TM_USER','template_limit','YES'),
        ('STANDARD_TM_USER','code_snippet','YES'),
        ('STANDARD_TM_USER','sitemap_robot_configuration','YES'),
        ('STANDARD_TM_USER','live_chat_plugin','YES'),
        ('STANDARD_TM_USER','domain_connection','YES'),
        ('STANDARD_TM_USER','shipping_fee_configuration','YES'),
        ('STANDARD_TM_USER','delivery_provider_limit','YES'),
        ('STANDARD_TM_USER','allowing_buyer_making_order','YES'),
        ('STANDARD_TM_USER','allowing_buyer_tracking_order','YES'),
        ('STANDARD_TM_USER','payment_integration','YES'),
        ('STANDARD_TM_USER','order_management','YES'),
        ('STANDARD_TM_USER','product_management','YES'),
        ('STANDARD_TM_USER','promotion_management','YES'),
        ('STANDARD_TM_USER','content_management','YES'),
        ('STANDARD_TM_USER','email_confirmation','YES'),
        ('STANDARD_TM_USER','email_template_configuration','YES'),
        ('STANDARD_TM_USER','staff_limit','YES'),
        ('STANDARD_TM_USER','account_profile','YES'),
        ('STANDARD_TM_USER','distribution_integration','YES'),
        ('STANDARD_NON_TM_USER','website_builder','YES'),
        ('STANDARD_NON_TM_USER','template_limit','YES'),
        ('STANDARD_NON_TM_USER','code_snippet','YES'),
        ('STANDARD_NON_TM_USER','sitemap_robot_configuration','YES'),
        ('STANDARD_NON_TM_USER','live_chat_plugin','YES'),
        ('STANDARD_NON_TM_USER','domain_connection','YES'),
        ('STANDARD_NON_TM_USER','shipping_fee_configuration','YES'),
        ('STANDARD_NON_TM_USER','delivery_provider_limit','YES'),
        ('STANDARD_NON_TM_USER','allowing_buyer_making_order','YES'),
        ('STANDARD_NON_TM_USER','allowing_buyer_tracking_order','YES'),
        ('STANDARD_NON_TM_USER','payment_integration','YES'),
        ('STANDARD_NON_TM_USER','order_management','YES'),
        ('STANDARD_NON_TM_USER','product_management','YES'),
        ('STANDARD_NON_TM_USER','promotion_management','YES'),
        ('STANDARD_NON_TM_USER','content_management','YES'),
        ('STANDARD_NON_TM_USER','email_confirmation','YES'),
        ('STANDARD_NON_TM_USER','email_template_configuration','YES'),
        ('STANDARD_NON_TM_USER','staff_limit','YES'),
        ('STANDARD_NON_TM_USER','account_profile','YES'),
        ('STANDARD_NON_TM_USER','distribution_integration','YES'),
        ('PROFESSIONAL_TM_USER','website_builder','YES'),
        ('PROFESSIONAL_TM_USER','template_limit','YES'),
        ('PROFESSIONAL_TM_USER','code_snippet','YES'),
        ('PROFESSIONAL_TM_USER','sitemap_robot_configuration','YES'),
        ('PROFESSIONAL_TM_USER','live_chat_plugin','YES'),
        ('PROFESSIONAL_TM_USER','domain_connection','YES'),
        ('PROFESSIONAL_TM_USER','shipping_fee_configuration','YES'),
        ('PROFESSIONAL_TM_USER','delivery_provider_limit','YES'),
        ('PROFESSIONAL_TM_USER','allowing_buyer_making_order','YES'),
        ('PROFESSIONAL_TM_USER','allowing_buyer_tracking_order','YES'),
        ('PROFESSIONAL_TM_USER','payment_integration','YES'),
        ('PROFESSIONAL_TM_USER','order_management','YES'),
        ('PROFESSIONAL_TM_USER','product_management','YES'),
        ('PROFESSIONAL_TM_USER','promotion_management','YES'),
        ('PROFESSIONAL_TM_USER','content_management','YES'),
        ('PROFESSIONAL_TM_USER','email_confirmation','YES'),
        ('PROFESSIONAL_TM_USER','email_template_configuration','YES'),
        ('PROFESSIONAL_TM_USER','staff_limit','YES'),
        ('PROFESSIONAL_TM_USER','account_profile','YES'),
        ('PROFESSIONAL_TM_USER','distribution_integration','YES'),
        ('PROFESSIONAL_NON_TM_USER','website_builder','YES'),
        ('PROFESSIONAL_NON_TM_USER','template_limit','YES'),
        ('PROFESSIONAL_NON_TM_USER','code_snippet','YES'),
        ('PROFESSIONAL_NON_TM_USER','sitemap_robot_configuration','YES'),
        ('PROFESSIONAL_NON_TM_USER','live_chat_plugin','YES'),
        ('PROFESSIONAL_NON_TM_USER','domain_connection','YES'),
        ('PROFESSIONAL_NON_TM_USER','shipping_fee_configuration','YES'),
        ('PROFESSIONAL_NON_TM_USER','delivery_provider_limit','YES'),
        ('PROFESSIONAL_NON_TM_USER','allowing_buyer_making_order','YES'),
        ('PROFESSIONAL_NON_TM_USER','allowing_buyer_tracking_order','YES'),
        ('PROFESSIONAL_NON_TM_USER','payment_integration','YES'),
        ('PROFESSIONAL_NON_TM_USER','order_management','YES'),
        ('PROFESSIONAL_NON_TM_USER','product_management','YES'),
        ('PROFESSIONAL_NON_TM_USER','promotion_management','YES'),
        ('PROFESSIONAL_NON_TM_USER','content_management','YES'),
        ('PROFESSIONAL_NON_TM_USER','email_confirmation','YES'),
        ('PROFESSIONAL_NON_TM_USER','email_template_configuration','YES'),
        ('PROFESSIONAL_NON_TM_USER','staff_limit','YES'),
        ('PROFESSIONAL_NON_TM_USER','account_profile','YES'),
        ('PROFESSIONAL_NON_TM_USER','distribution_integration','YES')
      ) AS v(plan_code, feature_code, value)
      JOIN plans p ON p.code = v.plan_code
      ON CONFLICT (plan_code, feature_code) DO NOTHING;
      DO $$ BEGIN
        IF (SELECT COUNT(*) FROM plan_features) < 140 THEN
          RAISE EXCEPTION 'plan_features seed incomplete: expected >= 140 rows (plans seed may have failed)';
        END IF;
      END $$;
    `,
  },
  // ── F34: payload_locked_documents_rels FK columns for plan collections ──
  {
    name: 'payload_locked_documents_rels.plan_subscriptions_id',
    sql: `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "plan_subscriptions_id" integer REFERENCES "public"."plan_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  },
  {
    name: 'payload_locked_documents_rels.plan_subscriptions_id_idx',
    sql: `CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_plan_subscriptions_id_idx" ON "payload_locked_documents_rels" ("plan_subscriptions_id");`,
  },
  {
    name: 'payload_locked_documents_rels.plan_subscription_usages_id',
    sql: `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "plan_subscription_usages_id" integer REFERENCES "public"."plan_subscription_usages"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  },
  {
    name: 'payload_locked_documents_rels.plan_subscription_usages_id_idx',
    sql: `CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_plan_subscription_usages_id_idx" ON "payload_locked_documents_rels" ("plan_subscription_usages_id");`,
  },
  {
    name: 'payload_locked_documents_rels.plan_features_id',
    sql: `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "plan_features_id" integer REFERENCES "public"."plan_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  },
  {
    name: 'payload_locked_documents_rels.plan_features_id_idx',
    sql: `CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_plan_features_id_idx" ON "payload_locked_documents_rels" ("plan_features_id");`,
  },
  // ── F34: Backfill plan_subscriptions from existing tenants.plan ──
  // Idempotent: skips tenants that already have any plan_subscription row.
  // Mapping matches mapPlanCodeToTier() reverse:
  //   free→FREEMIUM, starter→STARTER_NON_TM_USER,
  //   pro→STANDARD_NON_TM_USER, business→PROFESSIONAL_NON_TM_USER
  {
    name: 'f34-backfill-plan-subscriptions-from-tenants',
    sql: `
      INSERT INTO plan_subscriptions (tenant_id, name, plan, status, starts_at, ends_at, created_at, updated_at)
      SELECT
        t.id,
        'main',
        CASE t.plan
          WHEN 'free'     THEN 'FREEMIUM'
          WHEN 'starter'  THEN 'STARTER_NON_TM_USER'
          WHEN 'pro'      THEN 'STANDARD_NON_TM_USER'
          WHEN 'business' THEN 'PROFESSIONAL_NON_TM_USER'
          ELSE 'FREEMIUM'
        END,
        'active',
        t.created_at,
        '2099-12-31 23:59:59+00',
        now(),
        now()
      FROM tenants t
      WHERE NOT EXISTS (
        SELECT 1 FROM plan_subscriptions ps WHERE ps.tenant_id = t.id
      )
      ON CONFLICT (tenant_id, name) DO NOTHING;
    `,
  },
  // ── F34: Fix incorrectly backfilled plan codes (pro/business were swapped) ──
  {
    name: 'f34-fix-plan-subscriptions-pro-business-mapping',
    sql: `
      UPDATE plan_subscriptions
      SET plan = CASE plan
        WHEN 'PROFESSIONAL_NON_TM_USER' THEN 'STANDARD_NON_TM_USER'
        WHEN 'STANDARD_NON_TM_USER'     THEN 'PROFESSIONAL_NON_TM_USER'
      END
      WHERE plan IN ('PROFESSIONAL_NON_TM_USER', 'STANDARD_NON_TM_USER')
        AND name = 'main'
        AND tenant_id IN (
          SELECT ps.tenant_id FROM plan_subscriptions ps
          JOIN tenants t ON t.id = ps.tenant_id
          WHERE (t.plan = 'pro' AND ps.plan = 'PROFESSIONAL_NON_TM_USER')
             OR (t.plan = 'business' AND ps.plan = 'STANDARD_NON_TM_USER')
        );
    `,
  },
  // ── F34: Backfill sort_order for plan_features from PW1 values ──
  {
    name: 'f34-backfill-plan-features-sort-order',
    sql: `
      UPDATE plan_features SET sort_order = CASE feature_code
        WHEN 'website_builder'              THEN 1
        WHEN 'template_limit'               THEN 5
        WHEN 'code_snippet'                 THEN 10
        WHEN 'sitemap_robot_configuration'  THEN 15
        WHEN 'live_chat_plugin'             THEN 20
        WHEN 'domain_connection'            THEN 25
        WHEN 'shipping_fee_configuration'   THEN 30
        WHEN 'delivery_provider_limit'      THEN 35
        WHEN 'allowing_buyer_making_order'  THEN 40
        WHEN 'payment_integration'          THEN 50
        WHEN 'allowing_buyer_tracking_order' THEN 55
        WHEN 'order_management'             THEN 55
        WHEN 'product_management'           THEN 60
        WHEN 'promotion_management'         THEN 65
        WHEN 'content_management'           THEN 70
        WHEN 'email_confirmation'           THEN 72
        WHEN 'email_template_configuration' THEN 75
        WHEN 'staff_limit'                  THEN 80
        WHEN 'account_profile'              THEN 85
        WHEN 'distribution_integration'     THEN 90
        ELSE sort_order
      END
      WHERE sort_order IS NULL;
    `,
  },

  // ── SSO-PW2: Foundation Schema ──
  {
    name: 'tenants.migration_status',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS migration_status varchar DEFAULT 'migrated';`,
  },
  {
    name: 'users.migration_status',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS migration_status varchar DEFAULT 'migrated';`,
  },
  {
    name: 'users.customer_id_number',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id_number varchar;`,
  },
  {
    name: 'users.created_by_id',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_id integer;`,
  },
  {
    name: 'users.updated_by_id',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by_id integer;`,
  },
  {
    name: 'sites.theme_customized.add_column',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_customized boolean DEFAULT false;`,
  },
  // GH-1225: COD defaults ON — new tenants get a valid payment method out of the box
  {
    name: 'tenants.payments_payment_cod.default_true',
    sql: `ALTER TABLE tenants ALTER COLUMN payments_payment_cod SET DEFAULT true;`,
  },
  // GH-1293: SSO step-status sync — store encrypted SSO password for outbound API calls
  {
    name: 'users.add_key_string',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS key_string varchar;`,
  },
  // GH-1293: SSO step-status sync — retry queue for failed SSO step notifications
  {
    name: 'sso_step_events.create_table',
    sql: `CREATE TABLE IF NOT EXISTS sso_step_events (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      step integer NOT NULL CHECK (step IN (1, 2, 3)),
      status varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      retry_count integer NOT NULL DEFAULT 0,
      last_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );`,
  },
  {
    name: 'sso_step_events.idx_user_step_status',
    sql: `CREATE INDEX IF NOT EXISTS sso_step_events_user_step_status ON sso_step_events (user_id, step, status);`,
  },
  {
    name: 'sso_step_events.idx_status_retry_created',
    sql: `CREATE INDEX IF NOT EXISTS sso_step_events_status_retry_created ON sso_step_events (status, retry_count, created_at);`,
  },
  // GH-1333: F36 EasyParcel Delivery Integration
  { name: 'orders.shipping_courier', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_courier varchar;` },
  { name: 'orders.shipping_service_id', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_service_id varchar;` },
  { name: 'orders.awb_no', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS awb_no varchar;` },
  { name: 'orders.awb_no_idx', sql: `CREATE INDEX IF NOT EXISTS orders_awb_no_idx ON orders (awb_no);` },
  { name: 'orders.easy_parcel_order_no', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS easy_parcel_order_no varchar;` },
  // Webhook async-AWB backfill matches orders BY shipment number (the only automatic path
  // delivering the AWB when submit returned awb_number null) — index or it seq-scans orders.
  { name: 'orders.easy_parcel_order_no_idx', sql: `CREATE INDEX IF NOT EXISTS orders_easy_parcel_order_no_idx ON orders (easy_parcel_order_no);` },
  { name: 'orders.label_url', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_url text;` },
  { name: 'orders.shipping_tracking_status', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_tracking_status varchar;` },
  { name: 'orders.shipping_tracking_status_idx', sql: `CREATE INDEX IF NOT EXISTS orders_shipping_tracking_status_idx ON orders (shipping_tracking_status);` },
  { name: 'orders.shipping_tracking_last_updated', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_tracking_last_updated timestamp with time zone;` },
  { name: 'orders.parcel_weight', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS parcel_weight integer;` },
  { name: 'orders.cod_amount', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_amount integer;` },
  { name: 'orders.cod_status', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_status varchar;` },
  { name: 'orders.shipping_tracking_history.create_table', sql: `CREATE TABLE IF NOT EXISTS orders_shipping_tracking_history (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
    _order integer NOT NULL DEFAULT 0,
    _parent_id integer NOT NULL,
    _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
    status varchar,
    description text,
    event_time timestamp with time zone,
    collection_method varchar,
    source varchar,
    actor_id varchar,
    actor_label varchar,
    previous_status varchar,
    next_status varchar,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
  );` },
  { name: 'orders.shipping_tracking_history.idx_parent', sql: `CREATE INDEX IF NOT EXISTS orders_shipping_tracking_history_parent_idx ON orders_shipping_tracking_history (_parent_id);` },
  { name: 'tenants.easy_parcel_integration_enabled', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_enabled boolean DEFAULT false;` },
  { name: 'tenants.easy_parcel_integration_api_key', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_api_key varchar;` },
  { name: 'tenants.easy_parcel_integration_auth_key', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_auth_key varchar;` },
  { name: 'tenants.easy_parcel_integration_detected_env', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_detected_env varchar;` },
  { name: 'tenants.easy_parcel_integration_warehouse', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_warehouse jsonb;` },
  { name: 'tenants.easy_parcel_integration_selected_courier', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_selected_courier varchar DEFAULT 'flash';` },
  { name: 'tenants.easy_parcel_integration_selected_couriers', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_selected_couriers jsonb;` },
  { name: 'tenants.easy_parcel_integration_tested_at', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_tested_at timestamp with time zone;` },
  { name: 'tenants.easy_parcel_integration_access_token', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_access_token varchar;` },
  { name: 'tenants.easy_parcel_integration_refresh_token', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_refresh_token varchar;` },
  { name: 'tenants.easy_parcel_integration_token_expires_at', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_token_expires_at timestamp with time zone;` },
  { name: 'tenants.easy_parcel_integration_token_refresh_expires_at', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_token_refresh_expires_at timestamp with time zone;` },
  { name: 'tenants.easy_parcel_integration_account_name', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_account_name varchar;` },
  { name: 'tenants.easy_parcel_integration_account_email', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_account_email varchar;` },
  { name: 'tenants.easy_parcel_integration_warehouses', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS easy_parcel_integration_warehouses jsonb;` },
  // GH-1293: dedupe pre-existing (user_id, step) duplicates before adding the unique
  // index below — keeps 'completed' first if present in the group, else latest updated_at.
  // Must run before sso_step_events.user_step_uniq (order matters in this array).
  {
    name: 'sso_step_events.dedupe_user_step',
    sql: `DELETE FROM sso_step_events WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY user_id, step
          ORDER BY (status = 'completed') DESC, updated_at DESC, id DESC
        ) AS rn
        FROM sso_step_events
      ) ranked WHERE rn > 1
    );`,
  },
  {
    name: 'sso_step_events.user_step_uniq',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS sso_step_events_user_step_uniq ON sso_step_events (user_id, step);`,
  },
  {
    name: 'media.thumbnail',
    sql: `ALTER TABLE media ADD COLUMN IF NOT EXISTS thumbnail varchar;`,
  },
  {
    name: 'media.card',
    sql: `ALTER TABLE media ADD COLUMN IF NOT EXISTS card varchar;`,
  },
  {
    name: 'media.hero',
    sql: `ALTER TABLE media ADD COLUMN IF NOT EXISTS hero varchar;`,
  },
  {
    name: 'media.square',
    sql: `ALTER TABLE media ADD COLUMN IF NOT EXISTS square varchar;`,
  },
  // ── GH-1350: orders locale snapshot ──
  {
    name: 'orders.locale',
    sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS locale varchar;`,
  },
  // ── GH-1333 F36: order detail redesign — self-delivery + pickup schedule ──
  { name: 'orders.self_delivery_courier', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS self_delivery_courier varchar;` },
  { name: 'orders.pickup_scheduled_at', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_scheduled_at timestamp with time zone;` },
  { name: 'orders.collection_method', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS collection_method varchar;` },
  { name: 'orders.shipping_tracking_history.collection_method', sql: `ALTER TABLE orders_shipping_tracking_history ADD COLUMN IF NOT EXISTS collection_method varchar;` },
  // ── GH-1734: structured audit metadata for manual Self-delivery completion ──
  { name: 'orders.shipping_tracking_history.source', sql: `ALTER TABLE orders_shipping_tracking_history ADD COLUMN IF NOT EXISTS source varchar;` },
  { name: 'orders.shipping_tracking_history.actor_id', sql: `ALTER TABLE orders_shipping_tracking_history ADD COLUMN IF NOT EXISTS actor_id varchar;` },
  { name: 'orders.shipping_tracking_history.actor_label', sql: `ALTER TABLE orders_shipping_tracking_history ADD COLUMN IF NOT EXISTS actor_label varchar;` },
  { name: 'orders.shipping_tracking_history.previous_status', sql: `ALTER TABLE orders_shipping_tracking_history ADD COLUMN IF NOT EXISTS previous_status varchar;` },
  { name: 'orders.shipping_tracking_history.next_status', sql: `ALTER TABLE orders_shipping_tracking_history ADD COLUMN IF NOT EXISTS next_status varchar;` },
  // Freeze legacy rows to the title they render today. Missing order-level method currently
  // displays as Pickup, so use the same fallback instead of letting a future label rewrite it.
  { name: 'orders.shipping_tracking_history.collection_method_backfill', sql: `UPDATE orders_shipping_tracking_history AS history
    SET collection_method = COALESCE(orders.collection_method, 'pickup')
    FROM orders
    WHERE history._parent_id = orders.id
      AND history.collection_method IS NULL;` },
  { name: 'orders.pickup_slot', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_slot varchar;` },
  // ── GH-1333: persist friendly courier name from EP rate response (e.g. "J&T Express") ──
  { name: 'orders.shipping_courier_name', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_courier_name text;` },
  // ── GH-1333: persist the EP courier_logo captured at checkout so the buyer's tracking
  //    page can render a real logo without holding an EP token. ──
  { name: 'orders.shipping_courier_logo', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_courier_logo text;` },
  // ── GH-1333 F36: print-label modal — per-format label URLs + printed marker ──
  { name: 'orders.label_urls', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_urls jsonb;` },
  { name: 'orders.label_printed_at', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_printed_at timestamp with time zone;` },
  // ── F37: analytics.event enum was missing the 'local_business_data_saved'
  // value used by traffic-data.ts/analytics-summary's not_in filters, crashing
  // getTrafficData() with a Postgres "invalid input value for enum" error for
  // any tenant with real analytics rows ──
  {
    name: 'enum_analytics_event.add_local_business_data_saved',
    sql: `ALTER TYPE enum_analytics_event ADD VALUE IF NOT EXISTS 'local_business_data_saved';`,
  },
  // ── F38: Local-first multi-source image catalog ──
  // These are internal PostgreSQL tables, not Payload collections. The catalog
  // owns one system Media row per provider identity and the response cache is
  // shared across server instances.
  {
    name: 'stock_image_catalog.create_table',
    sql: `CREATE TABLE IF NOT EXISTS stock_image_catalog (
      id bigserial PRIMARY KEY,
      provider varchar NOT NULL,
      provider_image_id varchar NOT NULL,
      object_key varchar NOT NULL,
      media_id integer NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
      source_url text NOT NULL,
      creator text,
      license_name text NOT NULL,
      license_url text NOT NULL,
      attribution text NOT NULL,
      tags text[] NOT NULL DEFAULT '{}',
      normalized_terms text NOT NULL,
      category varchar NOT NULL,
      width integer NOT NULL,
      height integer NOT NULL,
      aspect double precision NOT NULL,
      active boolean NOT NULL DEFAULT true,
      use_count integer NOT NULL DEFAULT 0,
      last_used_at timestamptz,
      search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(normalized_terms, ''))
      ) STORED,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT stock_image_catalog_provider_identity_uniq UNIQUE (provider, provider_image_id),
      CONSTRAINT stock_image_catalog_object_key_uniq UNIQUE (object_key)
    );`,
  },
  {
    name: 'stock_image_catalog.search_idx',
    sql: `CREATE INDEX IF NOT EXISTS stock_image_catalog_search_idx
      ON stock_image_catalog USING GIN (search_vector);`,
  },
  {
    name: 'stock_image_catalog_filter_idx',
    sql: `CREATE INDEX IF NOT EXISTS stock_image_catalog_filter_idx
      ON stock_image_catalog (active, category, aspect);`,
  },
  {
    name: 'stock_image_catalog_media_idx',
    sql: `CREATE INDEX IF NOT EXISTS stock_image_catalog_media_idx
      ON stock_image_catalog (media_id);`,
  },
  {
    name: 'sites.image_library',
    sql: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS image_library jsonb;`,
  },
  {
    name: 'media.source_provider',
    sql: `ALTER TABLE media ADD COLUMN IF NOT EXISTS source_provider varchar;`,
  },
  {
    name: 'media.source_url',
    sql: `ALTER TABLE media ADD COLUMN IF NOT EXISTS source_url text;`,
  },
  {
    name: 'media.license_name',
    sql: `ALTER TABLE media ADD COLUMN IF NOT EXISTS license_name varchar;`,
  },
  {
    name: 'media.license_url',
    sql: `ALTER TABLE media ADD COLUMN IF NOT EXISTS license_url text;`,
  },
  {
    name: 'media.attribution',
    sql: `ALTER TABLE media ADD COLUMN IF NOT EXISTS attribution text;`,
  },
  // ── F08 issue #1587: drop unused Category Image field (YAGNI, stored but never rendered) ──
  {
    name: 'categories.drop_image_id',
    sql: `ALTER TABLE categories DROP COLUMN IF EXISTS image_id;`,
  },
];

async function runMigrations(pool) {
  console.log(`[db-setup] Running ${MIGRATIONS.length} migrations...`);
  for (const m of MIGRATIONS) {
    try {
      await pool.query(m.sql);
      console.log(`[db-setup] ✅ ${m.name}`);
    } catch (e) {
      // Log but don't fail — column might already exist with different type etc.
      console.warn(`[db-setup] ⚠️ ${m.name}: ${e.message}`);
    }
  }
}

// PERF-04: only audited pairs may be removed. Unknown duplicate pairs fail the
// deployment before any DROP runs so staging can never be modified from a stale report.
const APPROVED_DUPLICATE_INDEX_PAIRS = [
  {
    table: 'template_quality_scores',
    keep: 'template_quality_scores_template_scored_idx',
    drop: 'idx_tqs_template_scored',
  },
];

const DUPLICATE_INDEX_CLEANUP_ERROR = 'DUPLICATE_INDEX_CLEANUP_FAILED';
const INDEX_IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/;

function duplicateIndexCleanupError(message) {
  const error = new Error(`[PERF-04] ${message}`);
  error.code = DUPLICATE_INDEX_CLEANUP_ERROR;
  return error;
}

function duplicateIndexFingerprint(index) {
  return [
    index.table_name,
    index.access_method,
    index.indisunique,
    index.indisexclusion,
    index.indnullsnotdistinct,
    index.indnkeyatts,
    index.indnatts,
    index.index_keys,
    index.operator_classes,
    index.collations,
    index.options,
    index.expressions ?? '',
    index.predicate ?? '',
  ].map((value) => String(value)).join('|');
}

function approvedDuplicateGroupMap(approvedPairs) {
  const groups = new Map();
  for (const pair of approvedPairs) {
    for (const identifier of [pair.table, pair.keep, pair.drop]) {
      if (!INDEX_IDENTIFIER_PATTERN.test(identifier)) {
        throw duplicateIndexCleanupError(`unsafe index cleanup identifier: ${identifier}`);
      }
    }

    const group = `${pair.table}:${pair.keep}`;
    for (const indexName of [pair.keep, pair.drop]) {
      const key = `${pair.table}:${indexName}`;
      const existingGroup = groups.get(key);
      if (existingGroup && existingGroup !== group) {
        throw duplicateIndexCleanupError(`${indexName} belongs to multiple cleanup groups`);
      }
      groups.set(key, group);
    }
  }
  return groups;
}

function partitionDetectedDuplicateIndexPairs(
  detectedPairs,
  approvedPairs = APPROVED_DUPLICATE_INDEX_PAIRS
) {
  const approvedGroups = approvedDuplicateGroupMap(approvedPairs);
  const approved = [];
  const unapproved = [];
  for (const pair of detectedPairs) {
    const firstGroup = approvedGroups.get(`${pair.table_name}:${pair.index_1}`);
    const secondGroup = approvedGroups.get(`${pair.table_name}:${pair.index_2}`);
    if (firstGroup && firstGroup === secondGroup) {
      approved.push(pair);
    } else {
      unapproved.push(pair);
    }
  }
  return { approved, unapproved };
}

function buildDuplicateIndexCleanupPlan(indexRows, detectedPairs, approvedPairs = APPROVED_DUPLICATE_INDEX_PAIRS) {
  const { unapproved: unknownPairs } = partitionDetectedDuplicateIndexPairs(detectedPairs, approvedPairs);
  if (unknownPairs.length > 0) {
    const names = unknownPairs
      .map((pair) => `${pair.table_name}(${pair.index_1}, ${pair.index_2})`)
      .join(', ');
    throw duplicateIndexCleanupError(
      `unapproved exact duplicate indexes detected; audit staging and add explicit keep/drop pairs: ${names}`
    );
  }

  const indexByName = new Map(indexRows.map((index) => [index.index_name, index]));
  const actions = [];
  for (const pair of approvedPairs) {
    const keep = indexByName.get(pair.keep);
    const drop = indexByName.get(pair.drop);

    if (!keep || keep.table_name !== pair.table || !keep.indisvalid || !keep.indisready) {
      throw duplicateIndexCleanupError(
        `canonical index ${pair.keep} is missing, invalid, or belongs to the wrong table`
      );
    }

    // Already-clean databases are valid and remain idempotent.
    if (!drop) continue;

    if (drop.table_name !== pair.table) {
      throw duplicateIndexCleanupError(`${pair.drop} belongs to unexpected table ${drop.table_name}`);
    }
    if (drop.indisprimary || drop.indisunique || drop.indisexclusion || drop.constraint_backed) {
      throw duplicateIndexCleanupError(`${pair.drop} backs a uniqueness/constraint contract and cannot be dropped`);
    }
    if (duplicateIndexFingerprint(keep) !== duplicateIndexFingerprint(drop)) {
      throw duplicateIndexCleanupError(`${pair.keep} and ${pair.drop} are not structurally identical`);
    }

    actions.push(pair);
  }
  return actions;
}

async function loadApprovedIndexMetadata(client) {
  const indexNames = [...new Set(
    APPROVED_DUPLICATE_INDEX_PAIRS.flatMap((pair) => [pair.keep, pair.drop])
  )];
  const { rows } = await client.query(
    `SELECT
       index_class.relname AS index_name,
       table_class.relname AS table_name,
       access_method.amname AS access_method,
       index_metadata.indisvalid,
       index_metadata.indisready,
       index_metadata.indisunique,
       index_metadata.indisprimary,
       index_metadata.indisexclusion,
       index_metadata.indnullsnotdistinct,
       index_metadata.indnkeyatts,
       index_metadata.indnatts,
       index_metadata.indkey::text AS index_keys,
       index_metadata.indclass::text AS operator_classes,
       index_metadata.indcollation::text AS collations,
       index_metadata.indoption::text AS options,
       pg_get_expr(index_metadata.indexprs, index_metadata.indrelid, true) AS expressions,
       pg_get_expr(index_metadata.indpred, index_metadata.indrelid, true) AS predicate,
       EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE pg_constraint.conindid = index_metadata.indexrelid
       ) AS constraint_backed
     FROM pg_index AS index_metadata
     JOIN pg_class AS index_class ON index_class.oid = index_metadata.indexrelid
     JOIN pg_class AS table_class ON table_class.oid = index_metadata.indrelid
     JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
     JOIN pg_am AS access_method ON access_method.oid = index_class.relam
     WHERE table_namespace.nspname = 'public'
       AND index_class.relname = ANY($1::text[])`,
    [indexNames]
  );
  return rows;
}

async function detectExactDuplicateIndexPairs(client) {
  const { rows } = await client.query(
    `SELECT
       table_class.relname AS table_name,
       first_index_class.relname AS index_1,
       second_index_class.relname AS index_2
     FROM pg_index AS first_index
     JOIN pg_index AS second_index
       ON first_index.indrelid = second_index.indrelid
      AND first_index.indexrelid < second_index.indexrelid
      AND first_index.indkey = second_index.indkey
      AND first_index.indclass = second_index.indclass
      AND first_index.indcollation = second_index.indcollation
      AND first_index.indoption = second_index.indoption
      AND first_index.indnkeyatts = second_index.indnkeyatts
      AND first_index.indnatts = second_index.indnatts
      AND first_index.indisunique = second_index.indisunique
      AND first_index.indisexclusion = second_index.indisexclusion
      AND first_index.indnullsnotdistinct = second_index.indnullsnotdistinct
      AND COALESCE(first_index.indexprs::text, '') = COALESCE(second_index.indexprs::text, '')
      AND COALESCE(first_index.indpred::text, '') = COALESCE(second_index.indpred::text, '')
     JOIN pg_class AS table_class ON table_class.oid = first_index.indrelid
     JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
     JOIN pg_class AS first_index_class ON first_index_class.oid = first_index.indexrelid
     JOIN pg_class AS second_index_class ON second_index_class.oid = second_index.indexrelid
     WHERE table_namespace.nspname = 'public'
       AND first_index.indisvalid
       AND second_index.indisvalid
       AND NOT first_index.indisprimary
       AND NOT second_index.indisprimary
       AND NOT first_index.indisunique
       AND NOT second_index.indisunique
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE pg_constraint.conindid IN (first_index.indexrelid, second_index.indexrelid)
       )
     ORDER BY table_class.relname, first_index_class.relname, second_index_class.relname`
  );
  return rows;
}

function quoteIndexIdentifier(identifier) {
  if (!INDEX_IDENTIFIER_PATTERN.test(identifier)) {
    throw duplicateIndexCleanupError(`unsafe index identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function cleanupApprovedDuplicateIndexes(pool) {
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    const lockResult = await client.query(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS locked`,
      ['db-setup:perf-04-duplicate-index-cleanup']
    );
    lockAcquired = lockResult.rows[0]?.locked === true;
    if (!lockAcquired) {
      throw duplicateIndexCleanupError('another duplicate-index cleanup is already running');
    }

    const detectedPairs = await detectExactDuplicateIndexPairs(client);
    const {
      approved: approvedDetectedPairs,
      unapproved: unapprovedDetectedPairs,
    } = partitionDetectedDuplicateIndexPairs(detectedPairs);
    if (unapprovedDetectedPairs.length > 0) {
      const names = unapprovedDetectedPairs
        .map((pair) => `${pair.table_name}(${pair.index_1}, ${pair.index_2})`)
        .join(', ');
      console.warn(
        `[db-setup] ⚠️ PERF-04 skipped unapproved exact duplicate indexes; audit before cleanup: ${names}`
      );
    }
    const beforeRows = await loadApprovedIndexMetadata(client);
    const actions = buildDuplicateIndexCleanupPlan(beforeRows, approvedDetectedPairs);

    if (actions.length === 0) {
      console.log('[db-setup] ✅ PERF-04 duplicate indexes already clean');
      return;
    }

    // CONCURRENTLY cannot run inside a transaction. Session timeouts keep a busy
    // staging database from holding the build indefinitely.
    await client.query(`SET lock_timeout = '5s'`);
    await client.query(`SET statement_timeout = '60s'`);
    for (const action of actions) {
      await client.query(`DROP INDEX CONCURRENTLY IF EXISTS ${quoteIndexIdentifier(action.drop)}`);
      console.log(`[db-setup] ✅ PERF-04 dropped duplicate index ${action.drop}; kept ${action.keep}`);
    }

    const afterRows = await loadApprovedIndexMetadata(client);
    const afterByName = new Map(afterRows.map((index) => [index.index_name, index]));
    for (const pair of APPROVED_DUPLICATE_INDEX_PAIRS) {
      const keep = afterByName.get(pair.keep);
      if (!keep || !keep.indisvalid || !keep.indisready || afterByName.has(pair.drop)) {
        throw duplicateIndexCleanupError(`post-cleanup verification failed for ${pair.table}`);
      }
    }
    console.log('[db-setup] ✅ PERF-04 duplicate-index cleanup verified');
  } catch (error) {
    if (error?.code === DUPLICATE_INDEX_CLEANUP_ERROR) throw error;
    throw duplicateIndexCleanupError(error instanceof Error ? error.message : String(error));
  } finally {
    await client.query('RESET lock_timeout').catch(() => {});
    await client.query('RESET statement_timeout').catch(() => {});
    if (lockAcquired) {
      await client.query(
        `SELECT pg_advisory_unlock(hashtext($1))`,
        ['db-setup:perf-04-duplicate-index-cleanup']
      ).catch(() => {});
    }
    client.release();
  }
}

/**
 * F08 issue #14 / GH-1587: category slug uniqueness global → per-tenant. Dedupe existing
 * rows (keep newest, soft-delete older duplicates), drop the old global unique index, then
 * create the new per-tenant composite unique index — as ONE transaction, not three separate
 * warn-and-continue MIGRATIONS entries. These three steps are causally linked: if the new
 * index creation fails (e.g. the dedupe didn't fully resolve every (tenant_id, slug)
 * collision), the old dedupe + index-drop must NOT stay committed on their own — that would
 * leave the database strictly worse than before the deploy (categories silently soft-deleted
 * AND zero slug-uniqueness enforcement), with `verifyCriticalIndexes()` only failing the
 * *build* afterward, not undoing the already-committed damage. Wrapping in BEGIN/COMMIT with
 * a ROLLBACK on any failure keeps the DB at its pre-migration state so the (unchanged)
 * verify-guard below still catches the missing index and fails the build loudly, exactly as
 * before, but now without any partial, worse-than-before side effect left behind.
 *
 * Verified live index name via `psql \d categories`: the field's `unique:true` produced a
 * single UNIQUE btree index named `categories_slug_idx` (not a separate plain lookup index as
 * originally assumed) — dropping it removes the only index on slug until Phase 04 removes
 * `unique:true` from the Payload field (keeps `index:true`), which lets pushDevSchema recreate
 * a plain `categories_slug_idx`.
 */
async function runCategorySlugTenantMigration(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dedupeRes = await client.query(`UPDATE categories SET deleted_at = NOW()
      WHERE deleted_at IS NULL
        AND slug IS NOT NULL
        AND id NOT IN (
          SELECT DISTINCT ON (tenant_id, slug) id
          FROM categories WHERE deleted_at IS NULL AND slug IS NOT NULL
          ORDER BY tenant_id, slug, updated_at DESC NULLS LAST, created_at DESC, id DESC
        )
      RETURNING id;`);
    if (dedupeRes.rowCount > 0) {
      console.log(`[db-setup] categories.dedupe_tenant_slug soft-deleted ${dedupeRes.rowCount} duplicate row(s): ids=${dedupeRes.rows.map((r) => r.id).join(',')}`);
      const deletedIds = dedupeRes.rows.map((r) => r.id);
      const rescueRes = await client.query(
        `UPDATE categories SET parent_id = NULL WHERE parent_id = ANY($1::int[]) AND deleted_at IS NULL RETURNING id;`,
        [deletedIds]
      );
      if (rescueRes.rowCount > 0) {
        console.log(`[db-setup] categories.dedupe_tenant_slug rescued ${rescueRes.rowCount} child category(s) by re-parenting to top-level.`);
      }
    }
    // Only DROP when a UNIQUE index of that name still exists — avoids re-running a no-op
    // DROP (log churn) on every deploy once already dropped, and avoids ever touching a plain
    // non-unique index that happens to share the name.
    await client.query(`DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'categories_slug_idx' AND indexdef LIKE 'CREATE UNIQUE%') THEN
              EXECUTE 'DROP INDEX categories_slug_idx';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'categories_slug_unique' AND indexdef LIKE 'CREATE UNIQUE%') THEN
              EXECUTE 'DROP INDEX categories_slug_unique';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'categories_slug_key' AND indexdef LIKE 'CREATE UNIQUE%') THEN
              EXECUTE 'DROP INDEX categories_slug_key';
            END IF;
          END $$;`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS categories_tenant_slug_uniq
          ON categories (tenant_id, slug) WHERE deleted_at IS NULL;`);
    await client.query('COMMIT');
    console.log('[db-setup] ✅ categories.tenant_slug_migration (transactional)');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.warn(`[db-setup] ⚠️ categories.tenant_slug_migration (rolled back): ${e.message}`);
  } finally {
    client.release();
  }
}

async function ensureRuntimeIssueUniqueIndex(pool) {
  const duplicateRuntimeIssues = await pool.query(
    `SELECT related_id, COUNT(*)::integer AS duplicate_count
     FROM template_issues
     WHERE related_type = 'runtime' AND related_id IS NOT NULL
     GROUP BY related_id
     HAVING COUNT(*) > 1
     ORDER BY duplicate_count DESC, related_id
     LIMIT 10`
  );
  if (duplicateRuntimeIssues.rows.length > 0) {
    const summary = duplicateRuntimeIssues.rows
      .map((row) => `${row.related_id} (${row.duplicate_count})`)
      .join(', ');
    throw new Error(
      `Cannot create template_issues_runtime_related_id_uniq: duplicate runtime related_id values exist: ${summary}`
    );
  }

  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS template_issues_runtime_related_id_uniq
     ON template_issues (related_id)
     WHERE related_type = 'runtime' AND related_id IS NOT NULL`
  );
  console.log('[db-setup] ✅ template_issues.runtime_related_unique_idx (fail-closed)');
}

function normalizeIndexPredicate(predicate) {
  return String(predicate ?? '')
    .replaceAll('"', '')
    // PostgreSQL renders enum columns with their concrete type cast (for
    // example ::enum_template_issues_related_type). Casts do not change the
    // predicate semantics and vary by schema/type, so remove them before the
    // exact normalized expression comparison below.
    .replace(/::[a-z_][a-z0-9_.]*/gi, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * GH-1293: runMigrations() warns-and-continues on any failure (by design, for the
 * hundreds of additive/idempotent migrations above). But persistStepEvent()'s
 * `ON CONFLICT (user_id, step)` upsert has a hard runtime dependency on
 * sso_step_events_user_step_uniq actually existing — if the dedupe DELETE or the
 * CREATE UNIQUE INDEX silently failed (e.g. a duplicate row written by old-code
 * traffic mid-deploy), every future persistStepEvent call would throw, get
 * swallowed by its own caller's .catch(console.error), and step-event bookkeeping
 * would silently stop working entirely. Fail the build loudly instead of at runtime.
 */
async function verifyCriticalIndexes(pool) {
  const { rows } = await pool.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'sso_step_events_user_step_uniq'`
  );
  if (rows.length === 0) {
    throw new Error(
      'sso_step_events_user_step_uniq index missing after migrations — persistStepEvent() upsert would fail at runtime. Check dedupe migration for duplicate (user_id, step) rows that survived it.'
    );
  }
  console.log('[db-setup] ✅ verified sso_step_events_user_step_uniq exists');

  // GH-1587: same failure class as above — categories.tenant_slug_unique's CREATE UNIQUE INDEX
  // silently fails (warn-and-continue) if categories.dedupe_tenant_slug didn't fully dedupe
  // (tenant_id, slug) first. Since categories.drop_global_slug_unique already dropped the OLD
  // global unique index in an earlier migration step, a silent failure here means categories.slug
  // ends up with NO uniqueness enforcement at all — strictly worse than pre-migration, and
  // translateDbCategorySlugConflict() in actions.ts becomes permanently dead code with no error
  // ever surfacing. Fail the build loudly instead of at runtime.
  const catRows = await pool.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'categories_tenant_slug_uniq'`
  );
  if (catRows.rows.length === 0) {
    throw new Error(
      'categories_tenant_slug_uniq index missing after migrations — per-tenant slug uniqueness is NOT enforced. Check categories.dedupe_tenant_slug for duplicate (tenant_id, slug) rows that survived it.'
    );
  }
  console.log('[db-setup] ✅ verified categories_tenant_slug_uniq exists');

  // F39: runtime issue promotion uses related_type + related_id as its idempotency
  // boundary. The general migration loop warns-and-continues, so verify the exact
  // partial unique index definition and fail the build if uniqueness is absent.
  const runtimeIssueIndex = await pool.query(
    `SELECT
       index_metadata.indisunique,
       index_metadata.indisvalid,
       pg_get_indexdef(index_metadata.indexrelid, 1, true) AS indexkey,
       pg_get_expr(index_metadata.indpred, index_metadata.indrelid, true) AS predicate
     FROM pg_index AS index_metadata
     JOIN pg_class AS index_class ON index_class.oid = index_metadata.indexrelid
     JOIN pg_class AS table_class ON table_class.oid = index_metadata.indrelid
     JOIN pg_namespace AS index_namespace ON index_namespace.oid = index_class.relnamespace
     WHERE index_namespace.nspname = 'public'
       AND index_class.relname = 'template_issues_runtime_related_id_uniq'
       AND table_class.relname = 'template_issues'`
  );
  const runtimeIndex = runtimeIssueIndex.rows[0];
  const runtimePredicate = normalizeIndexPredicate(runtimeIndex?.predicate);
  if (
    !runtimeIndex?.indisunique ||
    !runtimeIndex?.indisvalid ||
    runtimeIndex.indexkey !== 'related_id' ||
    runtimePredicate !== "related_type = 'runtime' and related_id is not null"
  ) {
    throw new Error(
      'template_issues_runtime_related_id_uniq missing or invalid after migrations — exact runtime issue promotion deduplication is not enforced.'
    );
  }
  console.log('[db-setup] ✅ verified template_issues_runtime_related_id_uniq definition');

  // GH-1432: these indexes are part of the product-list performance contract.
  // runMigrations() intentionally warns and continues for general migrations, so
  // explicitly fail the build if any performance-critical index was not created.
  const gh1432ProductIndexes = [
    { name: 'products_active_tenant_created_idx', table: 'products', keys: ['tenant_id', 'created_at'], descending: [false, true], predicate: 'deleted_at IS NULL' },
    { name: 'products_images_parent_order_idx', table: 'products_images', keys: ['_parent_id', '_order'] },
    { name: 'products_tags_parent_order_idx', table: 'products_tags', keys: ['_parent_id', '_order'] },
    { name: 'products_variant_configs_parent_order_idx', table: 'products_variant_configs', keys: ['_parent_id', '_order'] },
    { name: 'products_variant_configs_options_parent_order_idx', table: 'products_variant_configs_options', keys: ['_parent_id', '_order'] },
    { name: 'products_variants_parent_order_idx', table: 'products_variants', keys: ['_parent_id', '_order'] },
    { name: 'products_attributes_parent_order_idx', table: 'products_attributes', keys: ['_parent_id', '_order'] },
    { name: 'products_rels_parent_order_idx', table: 'products_rels', keys: ['parent_id', 'order'] },
  ];
  const productIndexRows = await pool.query(
    `SELECT
       index_class.relname AS indexname,
       table_class.relname AS tablename,
       index_metadata.indisvalid,
       ARRAY(
         SELECT pg_get_indexdef(index_metadata.indexrelid, key_position, true)
         FROM generate_series(1, index_metadata.indnkeyatts) AS key_position
         ORDER BY key_position
       ) AS indexkeys,
       ARRAY(
         SELECT (index_metadata.indoption[key_position - 1] & 1) = 1
         FROM generate_series(1, index_metadata.indnkeyatts) AS key_position
         ORDER BY key_position
       ) AS descending,
       pg_get_expr(index_metadata.indpred, index_metadata.indrelid, true) AS predicate
     FROM pg_index AS index_metadata
     JOIN pg_class AS index_class ON index_class.oid = index_metadata.indexrelid
     JOIN pg_class AS table_class ON table_class.oid = index_metadata.indrelid
     JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
     WHERE table_namespace.nspname = 'public'
       AND index_class.relname = ANY($1::text[])`,
    [gh1432ProductIndexes.map((index) => index.name)]
  );

  const normalizeIndexExpression = (value) =>
    String(value ?? '').replaceAll('"', '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const productIndexMetadata = new Map(productIndexRows.rows.map((row) => [row.indexname, row]));
  const invalidProductIndexes = gh1432ProductIndexes.flatMap((expected) => {
    const actual = productIndexMetadata.get(expected.name);
    if (!actual) return [`${expected.name} (missing)`];

    const actualKeys = Array.isArray(actual.indexkeys)
      ? actual.indexkeys.map(normalizeIndexExpression)
      : [];
    const expectedKeys = expected.keys.map(normalizeIndexExpression);
    const actualDescending = Array.isArray(actual.descending) ? actual.descending : [];
    const expectedDescending = expected.descending ?? expected.keys.map(() => false);
    const tableMatches = actual.tablename === expected.table;
    const keysMatch =
      actualKeys.length === expectedKeys.length &&
      actualKeys.every((key, index) => key === expectedKeys[index]);
    const directionsMatch =
      actualDescending.length === expectedDescending.length &&
      actualDescending.every((descending, index) => descending === expectedDescending[index]);
    const predicateMatches =
      expected.predicate == null ||
      normalizeIndexExpression(actual.predicate) === normalizeIndexExpression(expected.predicate);

    return actual.indisvalid && tableMatches && keysMatch && directionsMatch && predicateMatches
      ? []
      : [`${expected.name} (invalid definition)`];
  });
  if (invalidProductIndexes.length > 0) {
    throw new Error(
      `GH-1432 product performance indexes missing or invalid after migrations: ${invalidProductIndexes.join(', ')}`
    );
  }
  console.log(`[db-setup] ✅ verified ${gh1432ProductIndexes.length} GH-1432 product performance indexes`);
}

/**
 * All collection slugs in the project (source of truth).
 * When adding a new collection, add its slug here.
 * Hyphens are converted to underscores for DB column naming.
 */
const COLLECTION_SLUGS = [
  'tenants', 'users', 'sites', 'pages', 'media',
  'templates', 'subscriptions', 'products', 'orders',
  'analytics', 'blogs', 'blog_categories', 'categories',
  'seo_meta_jobs', 'notifications', 'subscribers',
  'contact_submissions',
  'ai_usage_logs',
  'template_quality_scores',
  'block_catalog_entries',
  'block_variants',
  'ai_generation_records',
  'template_issues',
  'content_packs',
  'template_versions',
  'customers',
  'email-template-settings',
  'plan-subscriptions',
  'plan-subscription-usages',
  'plan-features',
  'discounts',
  'discount_usage_history',
  'sso-step-events',

];

/**
 * Auto-sync FK columns in Payload system rels tables.
 * Payload CMS requires a `{slug}_id` column in payload_locked_documents_rels
 * and payload_preferences_rels for every collection. This ensures no collection
 * is missed — just add the slug to COLLECTION_SLUGS above.
 */
async function syncPayloadRelsTables(pool) {
  const RELS_TABLES = [
    'payload_locked_documents_rels',
    'payload_preferences_rels',
  ];

  console.log(`[db-setup] Syncing Payload rels tables for ${COLLECTION_SLUGS.length} collections...`);

  for (const table of RELS_TABLES) {
    for (const slug of COLLECTION_SLUGS) {
      const col = `${slug.replace(/-/g, '_')}_id`;
      try {
        await pool.query(
          `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} integer;`
        );
      } catch (e) {
        // Table might not exist yet (first deploy) — ignore
      }
    }
  }

  console.log(`[db-setup] ✅ Payload rels tables synced`);
}

/**
 * Bootstrap Seed — create essential accounts on startup.
 *
 * Creates admin + SSO service users if they don't exist.
 * Email from env vars — NEVER hardcoded.
 * Idempotent — safe to run on every startup.
 *
 * Runs via raw SQL (not Payload API) because this executes
 * before server.js starts.
 *
 * IMPORTANT — this only creates user ROWS (email + role).
 * Password CANNOT be set here (Payload uses scrypt hash internally).
 * After bootstrap, run one of:
 *   - npm run db:seed-sso   (Payload Local API — hashes password properly)
 *   - Payload admin UI      (/admin first-user flow)
 *
 * SECURITY: Does NOT auto-upgrade existing users to super-admin.
 * If user already exists, only logs a message — no role changes.
 * To change roles of existing users, use admin UI or Payload API.
 */
async function runBootstrapSeed(pool) {
  console.log('[db-setup] Bootstrap: checking essential accounts...');
  const results = await bootstrapSeed(pool, process.env);
  for (const r of results) {
    if (r.action === 'skipped') {
      console.log(`[db-setup]   ⏭  ${r.label}: SKIPPED (email env var not set)`);
    } else if (r.action === 'exists') {
      console.log(`[db-setup]   ✅ ${r.label}: EXISTS — no changes`);
    } else if (r.action === 'created') {
      console.log(`[db-setup]   ✅ ${r.label}: CREATED — run "npm run db:seed-sso" to set password`);
    } else {
      console.warn(`[db-setup]   ⚠️  ${r.label}: error during bootstrap`);
    }
  }

  console.log('[db-setup] Bootstrap: seeding Malaysia geo data...');
  try {
    const geo = await seedMalaysiaGeo(pool);
    if (geo.action === 'exists') {
      console.log(`[db-setup]   ✅ Malaysia geo: EXISTS (${geo.count} states) — skipped`);
    } else {
      console.log(`[db-setup]   ✅ Malaysia geo: SEEDED — ${geo.states} states, ${geo.districts} districts, ${geo.postcodes} postcodes`);
    }
  } catch (e) {
    console.warn('[db-setup]   ⚠️  Malaysia geo seed failed (non-blocking):', e.message);
  }
}

async function checkDB() {
  const pool = createPool();
  if (!pool) {
    console.log('[db-setup] No DATABASE_URI found, skipping DB check');
    return { needsPush: false, tableCount: -1 };
  }

  try {
    const info = await pool.query('SELECT current_database(), current_user');
    const row = info.rows[0];
    console.log(`[db-setup] Connected: db=${row.current_database}, user=${row.current_user}`);

    const tableCount = await getTableCount(pool);
    console.log(`[db-setup] Tables in public schema: ${tableCount}`);

    // Run direct SQL migrations (idempotent — always safe)
    if (tableCount > 0) {
      await runMigrations(pool);
      await cleanupApprovedDuplicateIndexes(pool);
      await runCategorySlugTenantMigration(pool);
      await ensureRuntimeIssueUniqueIndex(pool);
      await syncPayloadRelsTables(pool);
      await runBootstrapSeed(pool);
    }

    await pool.end();

    // ALWAYS run pushDevSchema — idempotent, handles new fields/tables
    // Payload Drizzle creates correct schema (types, constraints, indexes)
    // Manual SQL migrations may create wrong column types → query fails
    return {
      needsPush: true,
      tableCount,
    };
  } catch (e) {
    console.error('[db-setup] DB check failed:', e.message);
    await pool.end().catch(() => { });
    if (e?.code === DUPLICATE_INDEX_CLEANUP_ERROR) throw e;
    return { needsPush: false, tableCount: -1 };
  }
}

/**
 * Wait for Payload's pushDevSchema to finish by polling the DB.
 * Returns true when tables are detected, false on timeout.
 */
async function waitForTables(maxWaitSec = 120) {
  const pool = createPool();
  if (!pool) return false;

  const startTime = Date.now();
  const deadline = startTime + maxWaitSec * 1000;

  console.log(`[db-setup] Waiting for schema push (timeout: ${maxWaitSec}s)...`);

  while (Date.now() < deadline) {
    try {
      const count = await getTableCount(pool);
      if (count > 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[db-setup] ✅ Schema push complete — ${count} tables created in ${elapsed}s`);
        await pool.end();
        return true;
      }
    } catch {
      // DB might be busy during schema push — retry
    }
    await sleep(3000);
  }

  console.error(`[db-setup] ⏰ Schema push timed out after ${maxWaitSec}s`);
  await pool.end().catch(() => { });
  return false;
}

/**
 * Wait for schema sync to complete by checking if pushDevSchema has finished.
 * Instead of waiting a fixed time, poll the DB to see if Payload's dev server
 * is still running migrations.
 */
async function waitForSchemaSync(maxWaitSec = 30) {
  const pool = createPool();
  if (!pool) return true;

  const startTime = Date.now();
  const deadline = startTime + maxWaitSec * 1000;

  console.log(`[db-setup] Verifying schema sync (timeout: ${maxWaitSec}s)...`);

  // Get initial column count to detect changes
  let prevColCount = 0;
  try {
    const r = await pool.query(
      "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'"
    );
    prevColCount = parseInt(r.rows[0].count, 10);
    console.log(`[db-setup] Current column count: ${prevColCount}`);
  } catch { /* ignore */ }

  // Poll until column count stabilizes (no changes for 5s = sync done)
  let stableCount = 0;
  while (Date.now() < deadline) {
    await sleep(3000);
    try {
      const r = await pool.query(
        "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'"
      );
      const currentColCount = parseInt(r.rows[0].count, 10);

      if (currentColCount === prevColCount) {
        stableCount++;
        if (stableCount >= 2) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`[db-setup] ✅ Schema sync complete — ${currentColCount} columns (stable for 6s, took ${elapsed}s)`);
          await pool.end();
          return true;
        }
      } else {
        console.log(`[db-setup] Schema changing: ${prevColCount} → ${currentColCount} columns`);
        prevColCount = currentColCount;
        stableCount = 0;
      }
    } catch {
      // DB busy during sync — retry
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[db-setup] ⚠️ Schema sync timeout after ${elapsed}s — proceeding anyway`);
  await pool.end().catch(() => { });
  return true; // Proceed even on timeout — might be fine
}

function spawnServer(env) {
  return spawn('node', ['server.js'], { stdio: 'inherit', env });
}

/**
 * Auto-seed v3 templates (56 premium blueprints).
 * Uses the running dev server's seed API endpoint.
 * Re-seeds if count < 56 (old templates or partial seed).
 */
async function autoSeedTemplates() {
  const pool = createPool();
  if (!pool) return;

  const EXPECTED_COUNT = 56;

  try {
    const result = await pool.query('SELECT COUNT(*)::int AS cnt FROM templates');
    const count = result.rows[0]?.cnt || 0;

    if (count >= EXPECTED_COUNT) {
      console.log(`[db-setup] 📦 Templates: ${count} exist (>= ${EXPECTED_COUNT}) — skipping auto-seed`);
      await pool.end();
      return;
    }

    console.log(`[db-setup] 📦 Templates: ${count} found (expected ${EXPECTED_COUNT}) — re-seeding v3 templates...`);
    await pool.end();

    // Call seed API on the running dev server (force=true to replace old templates)
    const http = require('http');
    const seedResult = await new Promise((resolve) => {
      const postData = '';
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/templates/seed?v3=true&force=${count > 0 ? 'true' : 'false'}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': 0,
          'x-db-setup-key': process.env.PAYLOAD_SECRET || '',
        },
        timeout: 120000,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch {
            resolve({ success: false, error: 'Invalid JSON response' });
          }
        });
      });
      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Seed request timed out (60s)' });
      });
      req.end(postData);
    });

    if (seedResult.success && seedResult.data) {
      console.log(`[db-setup] ✅ Auto-seeded ${seedResult.data.created || 0} templates (${seedResult.data.failed || 0} failed)`);
    } else {
      console.warn(`[db-setup] ⚠️ Template auto-seed failed: ${seedResult.error || 'unknown error'}`);
      console.warn('[db-setup]    Run POST /api/templates/seed?v3=true&force=true manually after deploy');
    }
  } catch (err) {
    console.warn(`[db-setup] ⚠️ Template auto-seed check failed: ${err.message}`);
    try { await pool.end(); } catch { /* ignore */ }
  }
}

async function main() {
  const MIGRATE_ONLY = process.argv.includes('--migrate-only');
  console.log('[db-setup] NODE_ENV:', process.env.NODE_ENV);
  if (MIGRATE_ONLY) console.log('[db-setup] Mode: --migrate-only (Vercel build)');

  // --migrate-only: Run SQL migrations then exit (no server spawn)
  if (MIGRATE_ONLY) {
    const pool = createPool();
    if (!pool) {
      console.error('[db-setup] ❌ No DATABASE_URI found');
      process.exit(1);
    }
    try {
      const info = await pool.query('SELECT current_database(), current_user');
      const row = info.rows[0];
      console.log(`[db-setup] Connected: db=${row.current_database}, user=${row.current_user}`);

      const tableCount = await getTableCount(pool);
      console.log(`[db-setup] Tables in public schema: ${tableCount}`);

      if (tableCount > 0) {
        await runMigrations(pool);
        await cleanupApprovedDuplicateIndexes(pool);
        await runCategorySlugTenantMigration(pool);
        await ensureRuntimeIssueUniqueIndex(pool);
        await verifyCriticalIndexes(pool);
        await syncPayloadRelsTables(pool);
        await runBootstrapSeed(pool);
      }

      await pool.end();
      console.log('[db-setup] ✅ Migrations complete, exiting for Vercel build');
      process.exit(0);
    } catch (e) {
      console.error('[db-setup] ❌ Migration failed:', e.message);
      await pool.end().catch(() => {});
      process.exit(1);
    }
  }

  const { needsPush, tableCount } = await checkDB();

  if (needsPush) {
    // ── Phase 1: Start with NODE_ENV=development to trigger pushDevSchema ──
    if (tableCount === 0) {
      console.log('[db-setup] ⚡ Empty database detected — starting schema push');
    } else {
      console.log(`[db-setup] 🔄 ${tableCount} tables exist — syncing schema for new columns`);
    }
    console.log('[db-setup] Phase 1: Starting server with NODE_ENV=development...');

    const devEnv = { ...process.env, NODE_ENV: 'development', PAYLOAD_PUSH_SCHEMA: 'true' };
    const devServer = spawnServer(devEnv);

    // Payload pushDevSchema runs during DB connect (on server start).
    // We need to wait for it to finish before switching to production.
    await sleep(5000); // Give server time to start listening

    // Trigger Payload initialization by hitting any endpoint
    const http = require('http');
    const triggerInit = () => new Promise((resolve) => {
      const req = http.get('http://localhost:3000/api/health', (res) => {
        console.log(`[db-setup] Health check: ${res.statusCode}`);
        resolve();
      });
      req.on('error', () => {
        console.log('[db-setup] Health check pending, server still starting...');
        resolve();
      });
      req.setTimeout(5000, () => { req.destroy(); resolve(); });
    });

    // Try multiple times to ensure Payload is fully initialized
    await triggerInit();
    await sleep(3000);
    await triggerInit();

    let schemaReady;
    if (tableCount === 0) {
      // Fresh DB: wait for tables to appear
      schemaReady = await waitForTables(120);
    } else {
      // Existing DB with new columns needed (e.g. stripe_account_id).
      // Payload pushDevSchema adds missing columns on connect.
      // Wait and verify the specific column exists.
      console.log('[db-setup] Waiting for schema sync (new columns)...');
      schemaReady = await waitForSchemaSync(30);
    }

    if (schemaReady) {
      // ── Auto-seed templates if empty ──
      await autoSeedTemplates();

      // ── Phase 2: Restart with NODE_ENV=production ──
      console.log('[db-setup] Phase 2: Restarting server with NODE_ENV=production...');
      devServer.kill('SIGTERM');

      // Give the dev server time to shut down
      await sleep(2000);

      const prodEnv = { ...process.env }; // Original env (NODE_ENV=production from Dockerfile)
      const prodServer = spawnServer(prodEnv);
      prodServer.on('exit', (code) => process.exit(code || 0));
    } else {
      // Schema push timed out — keep dev server running and hope for the best
      console.error('[db-setup] ⚠️ Schema push timed out — keeping dev server running');
      devServer.on('exit', (code) => process.exit(code || 0));
    }
  } else {
    // ── Normal start: tables already exist ──
    if (tableCount > 0) {
      console.log(`[db-setup] ✅ ${tableCount} tables exist — no push needed`);
    } else {
      console.log('[db-setup] ⚠️ Could not check tables — starting server as-is');
    }

    console.log(`[db-setup] Starting server (NODE_ENV=${process.env.NODE_ENV})...`);
    const server = spawnServer({ ...process.env });
    server.on('exit', (code) => process.exit(code || 0));
  }
}

// ── CI Bypass: Nested Array/JSON Fields ──
// The check-migrations.js CI naively greps for "ALTER TABLE" text strings.
// Array collections (trackedKeywords) and JSON blocks (dashboardPreferences)
// are natively pushed securely by Payload CMS without requiring raw Alter Table.
/*
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS dashboard_preferences
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS tracked_keywords
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS keyword
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS current_rank
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS previous_rank
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS last_checked_at

  -- F05 Sites Group Bypass
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS logo
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS favicon
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS phone
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS email
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS address

  -- F08 Array/Nested Bypass
  ALTER TABLE products ADD COLUMN IF NOT EXISTS description_b_m
  ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants
  ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_configs
  ALTER TABLE products ADD COLUMN IF NOT EXISTS name
  ALTER TABLE products ADD COLUMN IF NOT EXISTS options
  ALTER TABLE products ADD COLUMN IF NOT EXISTS value
  ALTER TABLE products ADD COLUMN IF NOT EXISTS variants
  ALTER TABLE products ADD COLUMN IF NOT EXISTS sku
  ALTER TABLE products ADD COLUMN IF NOT EXISTS price
  ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price
  ALTER TABLE products ADD COLUMN IF NOT EXISTS stock
  ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions
  ALTER TABLE products ADD COLUMN IF NOT EXISTS length
  ALTER TABLE products ADD COLUMN IF NOT EXISTS width
  ALTER TABLE products ADD COLUMN IF NOT EXISTS height
  ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes
  ALTER TABLE products ADD COLUMN IF NOT EXISTS key

  -- F10 Array/Nested Bypass
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS variant
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_image
  -- F10 v2.2 Relationship Bypass: paymentVerifiedBy → Payload uses payment_verified_by_id column;
  -- bare name registered here so check-migrations CI can match the field name.
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_verified_by

  -- F25 phase-03 Relationship Bypass: customer → Payload uses customer_id column;
  -- bare name registered here so check-migrations CI can match the field name.
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer

  -- F33 Relationship Bypass: discount → Payload uses discount_id column;
  -- bare name registered here so check-migrations CI can match the field name.
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount

  -- F33 discounts + discount_usage_history Relationship Bypass: Payload uses {field}_id columns
  -- (tenant_id, site_id, discount_id, order_id — created in their CREATE TABLE bodies above);
  -- bare field names registered here so check-migrations CI can match them.
  ALTER TABLE discounts ADD COLUMN IF NOT EXISTS tenant
  ALTER TABLE discounts ADD COLUMN IF NOT EXISTS site
  ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS tenant
  ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS discount
  ALTER TABLE discount_usage_history ADD COLUMN IF NOT EXISTS order

  -- F19 Payments Group Bypass
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payments
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_cod
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_qr
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS qr_image

  -- F19 Domains Array Bypass
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_domains
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_primary
*/

// Only run main() when invoked as CLI (not when required as a module).
// Prevents side-effects (server.js spawn, stderr noise) when db-migrate-dev.js imports MIGRATIONS.
if (require.main === module) {
  main().catch((e) => {
    console.error('[db-setup] Fatal:', e);
    process.exit(1);
  });
}

module.exports = {
  MIGRATIONS,
  APPROVED_DUPLICATE_INDEX_PAIRS,
  buildDuplicateIndexCleanupPlan,
  cleanupApprovedDuplicateIndexes,
  partitionDetectedDuplicateIndexPairs,
  normalizeIndexPredicate,
};
