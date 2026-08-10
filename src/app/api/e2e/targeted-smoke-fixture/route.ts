import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TENANT_SLUG = 'e2e-targeted-smoke'
const CAPABILITY = 'targeted-smoke-fixture-v1'

/** Recreates only named QA records in the dedicated staging tenant. */
export async function POST(req: NextRequest) {
    if (process.env.APP_ENV !== 'staging') return NextResponse.json({ error: 'Fixture is staging-only' }, { status: 403 })
    if (req.headers.get('x-e2e-fixture-intent') !== CAPABILITY) return NextResponse.json({ error: 'Invalid fixture intent' }, { status: 400 })
    const user = await getCurrentUser(req)
    const expected = process.env.TEST_EMAIL?.trim().toLowerCase()
    if (!user || !expected || user.email?.trim().toLowerCase() !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const tenantId = tenantIdForQuery(user)
    if (tenantId === null) return NextResponse.json({ error: 'E2E tenant is unavailable' }, { status: 409 })
    const payload = await getPayload({ config })
    const tenant = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }) as { slug?: string }
    if (tenant.slug !== TENANT_SLUG) return NextResponse.json({ error: 'Dedicated targeted Smoke tenant is required' }, { status: 409 })
    const site = (await payload.find({ collection: 'sites', where: { tenant: { equals: tenantId } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (!site) return NextResponse.json({ error: 'Fixture site is unavailable; provision the E2E tenant first' }, { status: 409 })

    const productSlug = 'e2e-targeted-variant-product'
    const existing = await payload.find({ collection: 'products', where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: productSlug } }] }, limit: 1, depth: 0, overrideAccess: true })
    const productData = { tenant: tenantId, site: site.id, name: 'E2E Targeted Variant Product', slug: productSlug, sku: 'E2E-TARGETED-VARIANT', price: 50, inventory: 10, weight: 0.5, status: 'active' as const, hasVariants: true, variants: [{ name: 'Red - M', price: 55, stock: 5, sku: 'E2E-TARGETED-RED-M' }] }
    const product = existing.docs[0]
        ? await payload.update({ collection: 'products', id: existing.docs[0].id, data: productData, overrideAccess: true })
        : await payload.create({ collection: 'products', data: productData, overrideAccess: true })

    // A previous COD Smoke checkout uses this email. Deleting it here keeps the
    // dedicated tenant idempotent without touching customer orders.
    const oldOrders = await payload.find({ collection: 'orders', where: { and: [{ tenant: { equals: tenantId } }, { customerEmail: { equals: 'targeted-smoke@example.invalid' } }] }, limit: 100, depth: 0, overrideAccess: true })
    for (const order of oldOrders.docs) await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true })
    const orderNumber = `E2E-TARGETED-PAYMENT-${String(tenantId)}`
    const paymentOrder = await payload.create({ collection: 'orders', overrideAccess: true, data: { tenant: tenantId, site: site.id, orderNumber, items: [{ product: product.id, productName: productData.name, quantity: 1, unitPrice: 55, variant: 'Red - M' }], subtotal: 55, shippingFee: 0, tax: 0, total: 55, currency: 'MYR', status: 'pending', paymentMethod: 'bank_transfer', paymentStatus: 'pending_verification', paymentReference: 'E2E-TARGETED-REF', customerName: 'E2E Targeted Buyer', customerEmail: 'targeted-smoke@example.invalid' } })

    const storefront = buildStorefrontUrl(TENANT_SLUG)
    return NextResponse.json({ status: 'fixture-ready', setupCapability: CAPABILITY, productPath: `${storefront}/products/${productSlug}`, checkoutPath: `${storefront}/checkout`, paymentOrderPath: `/orders/${paymentOrder.id}` })
}
