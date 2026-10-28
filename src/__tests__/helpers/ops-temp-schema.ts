/**
 * Session-local TEMP tables that mirror the production columns and enum types the report / To do SQL reads
 * (orders, orders_items, discounts, analytics, products*, sites, contact_submissions). pg_temp comes first in
 * the search path, so the real queries run unchanged against these and never touch application data.
 * The pool must have `max: 1` so every query shares the session.
 */
import type { Pool } from 'pg'

export async function createOpsTempSchema(pool: Pool): Promise<void> {
    await pool.query(`
        CREATE TYPE pg_temp.enum_analytics_event AS ENUM ('pageview','click','add_to_cart','checkout','purchase','local_business_data_saved');
        CREATE TYPE pg_temp.enum_orders_currency AS ENUM ('MYR','USD','SGD');
        CREATE TYPE pg_temp.enum_orders_status AS ENUM ('cancelled','paid','confirmed','ready_to_ship','shipped','completed','refunded','payment_failed','processing','pending','new');
        CREATE TYPE pg_temp.enum_orders_payment_status AS ENUM ('payment_failed','unpaid','awaiting_payment','pending_verification','paid','failed','refunded','cancelled');
        CREATE TYPE pg_temp.enum_discounts_status AS ENUM ('active','inactive');
        CREATE TYPE pg_temp.enum_products_status AS ENUM ('active','archived','draft');
        CREATE TYPE pg_temp.enum_sites_generation_status AS ENUM ('none','generating','completed','failed');
        CREATE TYPE pg_temp.enum_contact_submissions_status AS ENUM ('new','read','replied','archived');

        CREATE TEMP TABLE orders (
            id serial PRIMARY KEY, tenant_id integer NOT NULL,
            status pg_temp.enum_orders_status NOT NULL, currency pg_temp.enum_orders_currency,
            payment_status pg_temp.enum_orders_payment_status DEFAULT 'unpaid',
            total numeric NOT NULL, discount_id integer, discount_code varchar, discount_amount numeric,
            created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TEMP TABLE orders_items (
            id varchar, _order integer DEFAULT 1, _parent_id integer NOT NULL,
            product_id integer, product_name varchar NOT NULL, quantity numeric NOT NULL, unit_price numeric NOT NULL
        );
        CREATE TEMP TABLE discounts (
            id serial PRIMARY KEY, tenant_id integer NOT NULL, code varchar NOT NULL,
            status pg_temp.enum_discounts_status NOT NULL DEFAULT 'active',
            usage_limit numeric, usage_count numeric DEFAULT 0, starts_at timestamptz, expires_at timestamptz,
            created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
        );
        CREATE TEMP TABLE analytics (
            tenant_id integer NOT NULL, event pg_temp.enum_analytics_event NOT NULL,
            page_url varchar, referrer varchar, session_id varchar, created_at timestamptz NOT NULL
        );
        CREATE TEMP TABLE products (
            id serial PRIMARY KEY, tenant_id integer NOT NULL, name varchar,
            description jsonb, description_b_m jsonb, short_description varchar,
            status pg_temp.enum_products_status NOT NULL DEFAULT 'draft', inventory numeric, has_variants boolean DEFAULT false,
            ai_review_pending boolean DEFAULT false, seo_title varchar, seo_description varchar, deleted_at timestamptz
        );
        CREATE TEMP TABLE products_images (_order integer, _parent_id integer NOT NULL, id varchar, image_id integer, alt varchar);
        CREATE TEMP TABLE products_remote_images (_order integer, _parent_id integer NOT NULL, id varchar, url varchar, alt varchar);
        CREATE TEMP TABLE products_variants (_order integer, _parent_id integer NOT NULL, id varchar, name varchar, stock numeric);
        CREATE TEMP TABLE sites (id serial PRIMARY KEY, tenant_id integer NOT NULL, generation_status pg_temp.enum_sites_generation_status);
        CREATE TEMP TABLE contact_submissions (
            id serial PRIMARY KEY, site_id integer NOT NULL,
            status pg_temp.enum_contact_submissions_status DEFAULT 'new', created_at timestamptz NOT NULL
        );
    `)
}

/** A rich-text value with one paragraph of text (what a described product looks like in `products.description`). */
export const richText = (text: string) => JSON.stringify({ root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text }] }] } })
