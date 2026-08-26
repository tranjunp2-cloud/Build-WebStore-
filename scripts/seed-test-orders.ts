/**
 * Creates test orders for confirm-page UI testing.
 * Covers: bank_transfer (awaiting_payment + pending_verification) + stripe (paid).
 *
 * Usage:
 *   npx tsx scripts/seed-test-orders.ts --slug=<tenant-slug>
 *
 * If --slug is omitted, uses the first tenant found in the DB.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
    const slugArg = process.argv.find(a => a.startsWith('--slug='))
    const tenantSlug = slugArg?.split('=')[1]

    const payload = await getPayload({ config })

    // 1. Resolve tenant
    const tenantResult = await payload.find({
        collection: 'tenants',
        where: tenantSlug ? { slug: { equals: tenantSlug } } : {},
        limit: 1,
        overrideAccess: true,
    })
    const tenant = tenantResult.docs[0] as any
    if (!tenant) {
        console.error(tenantSlug
            ? `Tenant "${tenantSlug}" not found.`
            : 'No tenants in DB. Run the main seed first.')
        process.exit(1)
    }

    // 2. Resolve site
    const siteResult = await payload.find({
        collection: 'sites',
        where: { tenant: { equals: tenant.id } },
        limit: 1,
        overrideAccess: true,
    })
    const site = siteResult.docs[0] as any
    if (!site) {
        console.error(`No site found for tenant "${tenant.slug}".`)
        process.exit(1)
    }

    // 3. Resolve a product (required field on order items)
    const productResult = await payload.find({
        collection: 'products',
        where: { site: { equals: site.id } },
        limit: 1,
        overrideAccess: true,
    })
    const product = productResult.docs[0] as any
    if (!product) {
        console.error(`No products found for site ${site.id}. Create a product first.`)
        process.exit(1)
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const ts = Date.now()

    const sharedAddress = {
        line1: '12 Jalan Mawar',
        line2: 'Taman Bukit Indah',
        city: 'Johor Bahru',
        state: 'Johor',
        postcode: '81300',
        country: 'Malaysia',
    }

    const sharedItems = [{
        product: product.id,
        productName: product.name ?? 'Test Product',
        variant: 'Blue / M',
        quantity: 2,
        unitPrice: 49.9,
    }]

    const cases = [
        {
            label: 'Bank Transfer — Awaiting Payment',
            data: {
                tenant: tenant.id,
                site: site.id,
                orderNumber: `TEST-BT-AW-${ts}`,
                items: sharedItems,
                subtotal: 99.8,
                shippingFee: 8,
                tax: 0,
                total: 107.8,
                currency: 'MYR',
                status: 'pending',
                paymentMethod: 'bank_transfer',
                paymentStatus: 'awaiting_payment',
                paymentReference: `BT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                paymentExpiresAt: expiresAt,
                customerName: 'Ahmad Razif',
                customerEmail: 'test-bt-awaiting@example.com',
                shippingAddress: sharedAddress,
            },
        },
        {
            label: 'Bank Transfer — Pending Verification',
            data: {
                tenant: tenant.id,
                site: site.id,
                orderNumber: `TEST-BT-PV-${ts}`,
                items: sharedItems,
                subtotal: 99.8,
                shippingFee: 8,
                tax: 0,
                total: 107.8,
                currency: 'MYR',
                status: 'pending',
                paymentMethod: 'bank_transfer',
                paymentStatus: 'pending_verification',
                paymentReference: `BT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                paymentExpiresAt: expiresAt,
                customerName: 'Siti Norzahara',
                customerEmail: 'test-bt-pending@example.com',
                shippingAddress: sharedAddress,
            },
        },
        {
            label: 'COD — Pending',
            data: {
                tenant: tenant.id,
                site: site.id,
                orderNumber: `TEST-COD-${ts}`,
                items: sharedItems,
                subtotal: 99.8,
                shippingFee: 8,
                tax: 0,
                total: 107.8,
                currency: 'MYR',
                status: 'pending',
                paymentMethod: 'cod',
                paymentStatus: 'unpaid',
                customerName: 'Tan Ah Kow',
                customerEmail: 'test-cod@example.com',
                shippingAddress: sharedAddress,
            },
        },
        {
            label: 'Stripe — Paid (card)',
            data: {
                tenant: tenant.id,
                site: site.id,
                orderNumber: `TEST-STRIPE-${ts}`,
                items: sharedItems,
                subtotal: 99.8,
                shippingFee: 8,
                tax: 0,
                total: 107.8,
                currency: 'MYR',
                status: 'confirmed',
                paymentMethod: 'card',
                paymentStatus: 'paid',
                stripePaymentIntentId: `pi_test_${Math.random().toString(36).slice(2, 18)}`,
                customerName: 'Lee Wei Jing',
                customerEmail: 'test-stripe@example.com',
                shippingAddress: sharedAddress,
            },
        },
    ]

    console.log(`\nTenant : ${tenant.slug} (id=${tenant.id})`)
    console.log(`Site   : id=${site.id}`)
    console.log(`Product: ${product.name} (id=${product.id})`)
    console.log()

    for (const { label, data } of cases) {
        try {
            const order = await payload.create({
                collection: 'orders',
                data: data as any,
                overrideAccess: true,
            })
            console.log(`✓  ${label}`)
            console.log(`   #${order.orderNumber}  id=${order.id}`)
            console.log(`   ${siteUrl}/sites/${tenant.slug}/order/${order.id}/confirm`)
            console.log()
        } catch (err: any) {
            console.error(`✗  ${label}`)
            console.error(`   ${err.message}`)
            if (err.cause) console.error(`   cause: ${err.cause}`)
            console.error(err)
            console.log()
        }
    }

    process.exit(0)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
