import { getPayload } from 'payload'
import config from '../src/payload.config'

async function seedTestOrders() {
    const payload = await getPayload({ config })

    console.log('🌱 Seeding specific test user and orders data...')

    // 1. Find User
    const existingUser = await payload.find({
        collection: 'users',
        where: { email: { equals: 'yangtest@yopmail.com' } },
    })

    let user = existingUser.docs[0]
    if (!user) {
        console.log('❌ User yangtest@yopmail.com does not exist! Please create it or login to create first.')
        process.exit(1)
    }

    // Find user's first tenant
    if (!user.tenants || user.tenants.length === 0) {
        console.log('❌ User yangtest@yopmail.com has no tenants! Please create a store first.')
        process.exit(1)
    }

    const firstTenantRel = user.tenants[0].tenant
    const tenantId = typeof firstTenantRel === 'object' && firstTenantRel !== null ? firstTenantRel.id || firstTenantRel : firstTenantRel

    if (!tenantId) {
        console.log('❌ Could not parse tenant ID.')
        process.exit(1)
    }

    console.log(`  ✓ Found Tenant ID: ${tenantId} for user ${user.email}`)

    // 2. Find or Create Site for this tenant
    const existingSite = await payload.find({
        collection: 'sites',
        where: { tenant: { equals: tenantId as number } },
    })

    let site = existingSite.docs[0]
    if (!site) {
        site = await payload.create({
            collection: 'sites',
            data: {
                name: 'Test Site for Yangtest',
                tenant: tenantId as number,
                status: 'published',
                siteType: 'ecommerce',
                domain: `test-site-${tenantId}.primeweb.app`,
            },
        })
        console.log('  ✓ Site created:', site.name)
    } else {
        console.log('  ✓ Using existing Site:', site.name)
    }

    // 3. Delete existing orders for this site to start fresh and avoid duplicates
    const allExistingOrders = await payload.find({
        collection: 'orders',
        where: { site: { equals: site.id as number } },
        limit: 100
    })

    for (const o of allExistingOrders.docs) {
        await payload.delete({
            collection: 'orders',
            id: o.id,
        })
    }

    // 4. Find or Create Products for this site
    const productList = [
        { name: 'Kopi Susu Test', price: 15, inventory: 100, slug: 'kopi-susu-test' },
        { name: 'Nasi Lemak Test', price: 10, inventory: 50, slug: 'nasi-lemak-test' },
    ]

    const existingProducts = await payload.find({
        collection: 'products',
        where: { site: { equals: site.id as number } },
    })

    const createdProducts = [...existingProducts.docs]
    if (existingProducts.totalDocs < 2) {
        for (const p of productList) {
            if (!createdProducts.find(cp => cp.slug === p.slug)) {
                const product = await payload.create({
                    collection: 'products',
                    data: {
                        name: p.name,
                        slug: p.slug,
                        price: p.price,
                        inventory: p.inventory,
                        site: site.id as number,
                        tenant: tenantId as number,
                        status: 'active',
                        currency: 'MYR',
                    },
                })
                createdProducts.push(product)
            }
        }
        console.log(`  ✓ Checked products`)
    }

    // 5. Create 15 orders (to trigger pagination of limit=10)
    const statuses = ['pending', 'confirmed', 'ready_to_ship', 'shipped', 'completed', 'cancelled', 'refunded']
    const paymentMethods = ['cod', 'qr_banking', 'card', 'bank', 'ewallet']

    let counter = 3000
    const p1 = createdProducts.find(p => p.slug === 'kopi-susu-test') || createdProducts[0]
    const p2 = createdProducts.find(p => p.slug === 'nasi-lemak-test') || createdProducts[1]

    if (!p1) {
        console.error('No products available to create orders.')
        process.exit(1)
    }

    for (let i = 0; i < 15; i++) {
        const status = statuses[i % statuses.length]
        const payMethod = paymentMethods[i % paymentMethods.length]

        // Some logic to set payment status based on order status
        let paymentStatus = 'pending'
        if (status === 'completed' || status === 'shipped' || payMethod === 'card') paymentStatus = 'paid'
        if (status === 'refunded') paymentStatus = 'refunded'

        await payload.create({
            collection: 'orders',
            data: {
                tenant: tenantId as number,
                site: site.id as number,
                orderNumber: `ORD-${counter++}`,
                status: status as any,
                currency: 'MYR',
                customerName: `Customer ${i + 1}`,
                customerEmail: `customer${i + 1}@example.com`,
                customerPhone: '+601111111' + (i < 10 ? '0' + i : i),
                subtotal: p1.price + (p2 ? p2.price * 2 : 0),
                tax: 2,
                shippingFee: i % 2 === 0 ? 0 : 5, // Mix of free and paid shipping
                total: p1.price + (p2 ? p2.price * 2 : 0) + 2 + (i % 2 === 0 ? 0 : 5),
                items: [
                    { product: p1.id as number, productName: p1.name, quantity: 1, unitPrice: p1.price },
                    ...(p2 ? [{ product: p2.id as number, productName: p2.name, quantity: 2, unitPrice: p2.price }] : []),
                ],
                shippingAddress: {
                    line1: `${100 + i} Seri Petaling St`,
                    line2: i % 3 === 0 ? `Unit ${i}` : '',
                    city: 'Kuala Lumpur',
                    state: 'KL',
                    postcode: '57000',
                    country: 'Malaysia',
                },
                paymentMethod: payMethod as any,
                paymentStatus: paymentStatus as any,
                paymentReference: payMethod !== 'cod' ? `REF-PMT-${counter}` : undefined,
            },
        })
        console.log(`  ✓ Created test order ${i + 1}/15 with status: ${status}, payment: ${payMethod}`)
    }

    console.log('\n✅ Seeded 15 test orders with full metadata for yangtest@yopmail.com.')
    process.exit(0)
}

seedTestOrders().catch((err) => {
    console.error('❌ Test Order Seed failed:', err)
    process.exit(1)
})
