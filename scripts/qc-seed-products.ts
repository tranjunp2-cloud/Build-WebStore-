/**
 * QC test data — product + page enrichment helpers.
 *
 * Called from `seed-qc-data.ts` after tenants + sites exist. Adds:
 *   - 8 products per tenant (mixed stock: in stock, low stock, out of stock)
 *   - Price range 20-500 MYR to hit multiple discount tiers
 *   - 2 extra pages (About, Products) so QA has content to click through
 *
 * Idempotent: matches on slug (products) / title+site (pages), skips
 * existing rows. Safe to re-run alongside the base seed.
 *
 * Kept as a separate module so the main seed script stays under 300 lines.
 */

import type { Payload } from 'payload'

// Product templates — same 8 across every tenant so QA sees consistent
// state when switching tenants. Stock intentionally varied to exercise
// "out of stock" / "low stock" UI states.
interface ProductSpec {
  name: string
  slug: string
  price: number
  inventory: number
}

const PRODUCT_TEMPLATES: ProductSpec[] = [
  { name: 'QC Signature Coffee Blend',   slug: 'qc-signature-coffee', price: 45,  inventory: 120 },
  { name: 'QC Iced Matcha Latte',        slug: 'qc-iced-matcha',      price: 22,  inventory: 80 },
  { name: 'QC Handcrafted Ceramic Mug',  slug: 'qc-ceramic-mug',      price: 89,  inventory: 15 },
  { name: 'QC Cold Brew Bottle 500ml',   slug: 'qc-cold-brew-500ml',  price: 28,  inventory: 0 },   // OOS
  { name: 'QC Espresso Beans 1kg',       slug: 'qc-espresso-1kg',     price: 149, inventory: 5 },   // Low
  { name: 'QC Reusable Tote Bag',        slug: 'qc-tote-bag',         price: 35,  inventory: 200 },
  { name: 'QC Premium Gift Set',         slug: 'qc-gift-set',         price: 499, inventory: 8 },
  { name: 'QC Barista Course Voucher',   slug: 'qc-barista-voucher',  price: 320, inventory: 25 },
]

export const QC_PRODUCTS_PER_TENANT = PRODUCT_TEMPLATES.length

interface QcProductRecord {
  slug?: string | null
  tenant?: unknown
}

interface QcProductTenant {
  id: string | number
  slug: string
}

const EXTRA_PAGES = [
  { title: 'About',    slug: 'about' },
  { title: 'Products', slug: 'products' },
]

function relationId(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value !== 'object' || value === null || !('id' in value)) return undefined

  const id = (value as { id?: unknown }).id
  return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined
}

export function buildQcProductSlug(productSlug: string, tenantSlug: string): string {
  return `${tenantSlug}-${productSlug}`
}

export function getQcProductSlugs(tenantSlug: string): string[] {
  return PRODUCT_TEMPLATES.map((product) => buildQcProductSlug(product.slug, tenantSlug))
}

export function findMissingQcProducts(
  products: QcProductRecord[],
  tenants: QcProductTenant[],
): string[] {
  const seededProducts = new Set(
    products.flatMap((product) => {
      const tenantId = relationId(product.tenant)
      return product.slug && tenantId ? [`${tenantId}:${product.slug}`] : []
    }),
  )

  return tenants.flatMap((tenant) =>
    getQcProductSlugs(tenant.slug)
      .filter((productSlug) => !seededProducts.has(`${tenant.id}:${productSlug}`))
      .map((productSlug) => `${tenant.slug}/${productSlug}`),
  )
}

export async function seedTenantProducts(
  payload: Payload,
  tenantId: string | number,
  tenantSlug: string,
  siteId: string | number,
  tenantName: string,
): Promise<number> {
  let created = 0
  for (const spec of PRODUCT_TEMPLATES) {
    const productSlug = buildQcProductSlug(spec.slug, tenantSlug)
    const existing = await payload.find({
      collection: 'products',
      where: { slug: { equals: productSlug } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length) {
      const existingTenantId = relationId(existing.docs[0].tenant)
      if (existingTenantId !== String(tenantId)) {
        throw new Error(
          `QC product slug collision for ${productSlug}: expected tenant ${tenantId}, found ${existingTenantId ?? 'unknown'}`,
        )
      }
      continue
    }

    try {
      await payload.create({
        collection: 'products',
        data: {
          name: spec.name,
          slug: productSlug,
          price: spec.price,
          inventory: spec.inventory,
          tenant: tenantId,
          site: siteId,
        },
        overrideAccess: true,
      })
      created++
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 120) : 'unknown'
      throw new Error(`Product seed failed for ${tenantName} / ${productSlug}: ${msg}`)
    }
  }
  return created
}

export async function seedTenantExtraPages(
  payload: Payload,
  tenantId: string | number,
  siteId: string | number,
  tenantName: string,
): Promise<number> {
  let created = 0
  for (const spec of EXTRA_PAGES) {
    const existing = await payload.find({
      collection: 'pages',
      where: {
        and: [
          { slug: { equals: spec.slug } },
          { site: { equals: siteId } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length) continue
    try {
      await payload.create({
        collection: 'pages',
        data: {
          title: spec.title,
          slug: spec.slug,
          site: siteId,
          tenant: tenantId,
        },
        overrideAccess: true,
      })
      created++
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 120) : 'unknown'
      console.warn(`    ! page create failed for ${tenantName} / ${spec.slug}: ${msg}`)
    }
  }
  return created
}
