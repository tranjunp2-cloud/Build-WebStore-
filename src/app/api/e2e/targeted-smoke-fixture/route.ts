import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TENANT_SLUG = 'e2e-targeted-smoke'
const CAPABILITY = 'targeted-smoke-fixture-v1'

async function getDedicatedFixtureTenant(req: NextRequest) {
    if (process.env.APP_ENV !== 'staging') return { error: NextResponse.json({ error: 'Fixture is staging-only' }, { status: 403 }) }
    if (req.headers.get('x-e2e-fixture-intent') !== CAPABILITY) return { error: NextResponse.json({ error: 'Invalid fixture intent' }, { status: 400 }) }
    const user = await getCurrentUser(req)
    const expected = process.env.TEST_EMAIL?.trim().toLowerCase()
    if (!user || !expected || user.email?.trim().toLowerCase() !== expected) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    const tenantId = tenantIdForQuery(user)
    if (tenantId === null) return { error: NextResponse.json({ error: 'E2E tenant is unavailable' }, { status: 409 }) }
    const payload = await getPayload({ config })
    const tenant = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }) as { slug?: string }
    if (tenant.slug !== TENANT_SLUG) return { error: NextResponse.json({ error: 'Dedicated targeted Smoke tenant is required' }, { status: 409 }) }
    const dispatchId = req.headers.get('x-targeted-dispatch-id')
    if (!dispatchId || !/^\d+$/.test(dispatchId)) return { error: NextResponse.json({ error: 'Active targeted fixture lease is required' }, { status: 409 }) }
    const dispatch = await payload.findByID({ collection: 'qa_smoke_dispatches', id: Number(dispatchId), depth: 0, overrideAccess: true }) as { id?: string | number; status?: string; fixtureKey?: string } | null
    if (!dispatch || dispatch.status !== 'dispatched' || dispatch.fixtureKey !== 'smoke-e2e-targeted-tenant') return { error: NextResponse.json({ error: 'Active targeted fixture lease is required' }, { status: 409 }) }
    const lease = await payload.find({ collection: 'qa_fixture_leases', where: { and: [{ dispatch: { equals: dispatch.id } }, { fixtureKey: { equals: dispatch.fixtureKey } }, { status: { equals: 'active' } }] }, limit: 1, depth: 0, overrideAccess: true })
    const expiresAt = (lease.docs[0] as { expiresAt?: unknown } | undefined)?.expiresAt
    if (typeof expiresAt !== 'string' || Date.parse(expiresAt) <= Date.now()) return { error: NextResponse.json({ error: 'Active targeted fixture lease is required' }, { status: 409 }) }
    return { payload, tenantId }
}

/** Recreates only named QA records in the dedicated staging tenant. */
export async function POST(req: NextRequest) {
    const fixture = await getDedicatedFixtureTenant(req)
    if ('error' in fixture) return fixture.error
    const { payload, tenantId } = fixture
    const site = (await payload.find({ collection: 'sites', where: { tenant: { equals: tenantId } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (!site) return NextResponse.json({ error: 'Fixture site is unavailable; provision the E2E tenant first' }, { status: 409 })

    const productSlug = 'qa-tshirt-sml'
    const existing = await payload.find({ collection: 'products', where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: productSlug } }] }, limit: 1, depth: 0, overrideAccess: true })
    const productData = { tenant: tenantId, site: site.id, name: 'QA-Tshirt-SML', slug: productSlug, sku: 'QA-TSHIRT-SML', price: 50, inventory: 30, weight: 0.5, status: 'active' as const, hasVariants: true, variantConfigs: [
        { name: 'Size', options: [{ value: 'S' }, { value: 'M' }, { value: 'L' }] },
    ], variants: [
        { name: 'S', price: 50, stock: 10, sku: 'QA-TSHIRT-S' },
        // M starts at 9 because the dedicated confirmed cancellation order
        // below has already reserved one unit from the baseline of 10.
        { name: 'M', price: 50, stock: 9, sku: 'QA-TSHIRT-M' },
        { name: 'L', price: 50, stock: 10, sku: 'QA-TSHIRT-L' },
    ] }
    const product = existing.docs[0]
        ? await payload.update({ collection: 'products', id: existing.docs[0].id, data: productData, overrideAccess: true })
        : await payload.create({ collection: 'products', data: productData, overrideAccess: true })

    // A previous COD Smoke checkout uses this email. Deleting it here keeps the
    // dedicated tenant idempotent without touching customer orders.
    const oldOrders = await payload.find({ collection: 'orders', where: { and: [{ tenant: { equals: tenantId } }, { customerEmail: { equals: 'targeted-smoke@example.invalid' } }] }, limit: 100, depth: 0, overrideAccess: true })
    for (const order of oldOrders.docs) await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true })
    const orderNumber = `E2E-TARGETED-PAYMENT-${String(tenantId)}`
    const paymentOrder = await payload.create({ collection: 'orders', overrideAccess: true, data: { tenant: tenantId, site: site.id, orderNumber, items: [{ product: product.id, productName: productData.name, quantity: 1, unitPrice: 50, variant: 'M' }], subtotal: 50, shippingFee: 0, tax: 0, total: 50, currency: 'MYR', status: 'pending', paymentMethod: 'bank_transfer', paymentStatus: 'pending_verification', paymentReference: 'E2E-TARGETED-REF', customerName: 'E2E Targeted Buyer', customerEmail: 'targeted-smoke@example.invalid' } })
    // Provider-neutral cancellation fixture. It is intentionally bank-transfer
    // (never Stripe/Xendit) and starts confirmed/paid so cancellation exercises
    // the real restock branch against only this resettable tenant product.
    const cancelOrder = await payload.create({ collection: 'orders', overrideAccess: true, data: { tenant: tenantId, site: site.id, orderNumber: `E2E-TARGETED-CANCEL-${String(tenantId)}`, items: [{ product: product.id, productName: productData.name, quantity: 1, unitPrice: 50, variant: 'M' }], subtotal: 50, shippingFee: 0, tax: 0, total: 50, currency: 'MYR', status: 'confirmed', paymentMethod: 'bank_transfer', paymentStatus: 'paid', paymentReference: 'E2E-TARGETED-CANCEL-REF', customerName: 'E2E Targeted Buyer', customerEmail: 'targeted-smoke@example.invalid' } })

    const pageSlug = '/qa-product-grid-variants'
    const existingPage = await payload.find({ collection: 'pages', where: { and: [{ site: { equals: site.id } }, { slug: { equals: pageSlug } }] }, limit: 1, depth: 0, overrideAccess: true })
    // The dedicated tenant contains only controlled E2E products. Its grid is
    // deliberately wide enough not to hide QA-Tshirt-SML behind an older test
    // record, while the shared fixture lease prevents concurrent mutation.
    const pageData = { site: site.id, title: 'QA Product Grid Variants', slug: pageSlug, isHomepage: false, _status: 'published' as const, layout: [{ blockType: 'products-grid', variant: 'grid-3', headline: 'QA-Tshirt-SML variants', limit: 20, showCategoryFilter: false }] }
    const page = existingPage.docs[0]
        ? await payload.update({ collection: 'pages', id: existingPage.docs[0].id, data: pageData, overrideAccess: true })
        : await payload.create({ collection: 'pages', data: pageData, overrideAccess: true })

    const storefront = buildStorefrontUrl(TENANT_SLUG)
    return NextResponse.json({ status: 'fixture-ready', setupCapability: CAPABILITY, productPath: `${storefront}/products/${productSlug}`, productGridPath: `${storefront}${pageSlug}`, editorPath: `/editor/${site.id}?pageId=${page.id}`, checkoutPath: `${storefront}/checkout`, paymentOrderPath: `/orders/${paymentOrder.id}`, cancelOrderPath: `/orders/${cancelOrder.id}`, cancelVariantStockBefore: 9, cancelVariantStockAfter: 10 })
}

/** Read-only assertion endpoint for the dedicated cancellation fixture only. */
export async function GET(req: NextRequest) {
    const fixture = await getDedicatedFixtureTenant(req)
    if ('error' in fixture) return fixture.error
    const product = await fixture.payload.find({ collection: 'products', where: { and: [{ tenant: { equals: fixture.tenantId } }, { slug: { equals: 'qa-tshirt-sml' } }] }, limit: 1, depth: 0, overrideAccess: true })
    const variant = (product.docs[0] as { variants?: Array<{ name?: string; stock?: unknown }> } | undefined)?.variants?.find((item) => item.name === 'M')
    if (typeof variant?.stock !== 'number') return NextResponse.json({ error: 'Cancellation fixture variant is unavailable' }, { status: 409 })
    return NextResponse.json({ variant: 'M', stock: variant.stock })
}
