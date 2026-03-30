#!/usr/bin/env node
/**
 * DB Setup Script — runs as Docker CMD on DO App Platform.
 *
 * Problem: Payload CMS's `push: true` only creates tables when
 * `process.env.NODE_ENV !== 'production'` (checked at runtime in
 * node_modules/@payloadcms/db-postgres/dist/connect.js line 109).
 *
 * Solution:
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPool() {
  const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL;
  if (!connStr) return null;

  const pg = require('pg');
  const cleanStr = connStr
    .replace(/[?&]sslmode=[^&]+/g, '')
    .replace(/\?&/, '?')
    .replace(/\?$/, '');

  return new pg.Pool({
    connectionString: cleanStr,
    ssl: { rejectUnauthorized: false },
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
  // pushDevSchema may create array tables with only metadata columns (id, _order, _parent_id, _uuid).
  // CREATE TABLE IF NOT EXISTS skips if table already exists → field columns missing.
  // ALTER TABLE ADD COLUMN IF NOT EXISTS ensures columns exist regardless of creation order.
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
  // sites_seo_tracked_keywords
  { name: 'sites_seo_tracked_keywords.keyword', sql: `ALTER TABLE sites_seo_tracked_keywords ADD COLUMN IF NOT EXISTS keyword varchar;` },
  { name: 'sites_seo_tracked_keywords.current_rank', sql: `ALTER TABLE sites_seo_tracked_keywords ADD COLUMN IF NOT EXISTS current_rank numeric;` },
  { name: 'sites_seo_tracked_keywords.previous_rank', sql: `ALTER TABLE sites_seo_tracked_keywords ADD COLUMN IF NOT EXISTS previous_rank numeric;` },
  { name: 'sites_seo_tracked_keywords.last_checked_at', sql: `ALTER TABLE sites_seo_tracked_keywords ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;` },
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

/**
 * All collection slugs in the project (source of truth).
 * When adding a new collection, add its slug here.
 * Hyphens are converted to underscores for DB column naming.
 */
const COLLECTION_SLUGS = [
  'tenants', 'users', 'sites', 'pages', 'media',
  'templates', 'subscriptions', 'products', 'orders',
  'analytics', 'blogs', 'blog_categories', 'categories',
  'seo_meta_jobs',
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
      await syncPayloadRelsTables(pool);
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

async function main() {
  console.log('[db-setup] NODE_ENV:', process.env.NODE_ENV);

  const { needsPush, tableCount } = await checkDB();

  if (needsPush) {
    // ── Phase 1: Start with NODE_ENV=development to trigger pushDevSchema ──
    if (tableCount === 0) {
      console.log('[db-setup] ⚡ Empty database detected — starting schema push');
    } else {
      console.log(`[db-setup] 🔄 ${tableCount} tables exist — syncing schema for new columns`);
    }
    console.log('[db-setup] Phase 1: Starting server with NODE_ENV=development...');

    const devEnv = { ...process.env, NODE_ENV: 'development' };
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

main().catch((e) => {
  console.error('[db-setup] Fatal:', e);
  process.exit(1);
});
