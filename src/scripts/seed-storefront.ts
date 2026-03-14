/**
 * Seed script for PrimeWeb Storefront testing.
 * Creates: 1 admin user, 1 tenant, 1 site, 5 products.
 *
 * Usage: npx tsx src/scripts/seed-storefront.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'

const ADMIN_EMAIL = 'admin@primeweb.app'
const ADMIN_PASSWORD = 'Admin@123'
const TENANT_SLUG = 'bella-bakery'

async function seed() {
    console.log('🌱 Starting Storefront Seed...\n')
    const payload = await getPayload({ config })

    // ── 1. Create Admin User ────────────────────────────────────────────────────
    let user: any
    const existingUsers = await payload.find({
        collection: 'users',
        where: { email: { equals: ADMIN_EMAIL } },
        limit: 1,
    })

    if (existingUsers.docs.length > 0) {
        user = existingUsers.docs[0]
        console.log(`✅ User exists: ${user.email} (id: ${user.id})`)
    } else {
        user = await payload.create({
            collection: 'users',
            data: {
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                firstName: 'Admin',
                lastName: 'PrimeWeb',
                roles: ['super-admin'],
            },
        })
        console.log(`✅ Created admin user: ${user.email} (id: ${user.id})`)
    }

    // ── 2. Create Tenant ────────────────────────────────────────────────────────
    let tenant: any
    const existingTenants = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: TENANT_SLUG } },
        limit: 1,
    })

    if (existingTenants.docs.length > 0) {
        tenant = existingTenants.docs[0]
        console.log(`✅ Tenant exists: ${tenant.name} (id: ${tenant.id})`)
    } else {
        tenant = await payload.create({
            collection: 'tenants',
            data: {
                name: 'Bella Bakery KL',
                slug: TENANT_SLUG,
                plan: 'pro',
                status: 'active',
                onboardingCompleted: true,
            },
        })
        console.log(`✅ Created tenant: ${tenant.name} (id: ${tenant.id})`)
    }

    // Link user to tenant
    const userTenants = user.tenants || []
    const alreadyLinked = userTenants.some((t: any) => {
        const tid = typeof t.tenant === 'object' ? t.tenant?.id : t.tenant
        return tid === tenant.id
    })
    if (!alreadyLinked) {
        await payload.update({
            collection: 'users',
            id: user.id,
            data: {
                tenants: [...userTenants, { tenant: tenant.id, role: 'owner' }],
            },
        })
        console.log('✅ Linked user → tenant')
    }

    // ── 3. Create Site ──────────────────────────────────────────────────────────
    let site: any
    const existingSites = await payload.find({
        collection: 'sites',
        where: {
            tenant: { equals: tenant.id },
        },
        limit: 1,
    })

    if (existingSites.docs.length > 0) {
        site = existingSites.docs[0]
        console.log(`✅ Site exists: ${site.name} (id: ${site.id})`)
    } else {
        site = await payload.create({
            collection: 'sites',
            data: {
                tenant: tenant.id,
                name: 'Bella Bakery',
                status: 'published',
                siteType: 'ecommerce',
                theme: {
                    primaryColor: '#d97706',
                    secondaryColor: '#f59e0b',
                    backgroundColor: '#fffbeb',
                    fontHeading: 'Playfair Display',
                    fontBody: 'Inter',
                    borderRadius: 'rounded',
                    colorMode: 'light',
                },
                seo: {
                    metaTitle: 'Bella Bakery — Freshly Baked Goods in KL',
                    metaDescription: 'Order artisanal bread, pastries, and cakes online. Fresh from our oven to your door in Kuala Lumpur.',
                },
            },
        })
        console.log(`✅ Created site: ${site.name} (id: ${site.id})`)
    }

    // ── 4. Create 5 Products ────────────────────────────────────────────────────
    const products = [
        {
            name: 'Sourdough Loaf',
            slug: 'sourdough-loaf',
            shortDescription: 'Traditional sourdough bread, slow-fermented for 24 hours with a crispy crust and soft interior.',
            price: 18.90,
            compareAtPrice: 22.00,
            category: 'Bread',
            inventory: 50,
            sku: 'BB-BREAD-001',
        },
        {
            name: 'Butter Croissant',
            slug: 'butter-croissant',
            shortDescription: 'Flaky, buttery layers of golden pastry. Made with premium French butter.',
            price: 8.50,
            category: 'Pastries',
            inventory: 100,
            sku: 'BB-PASTRY-001',
        },
        {
            name: 'Chocolate Lava Cake',
            slug: 'chocolate-lava-cake',
            shortDescription: 'Rich dark chocolate cake with a molten center. Perfect for dessert lovers.',
            price: 32.00,
            compareAtPrice: 38.00,
            category: 'Cakes',
            inventory: 20,
            sku: 'BB-CAKE-001',
        },
        {
            name: 'Matcha Swiss Roll',
            slug: 'matcha-swiss-roll',
            shortDescription: 'Light sponge cake infused with premium Uji matcha, filled with fresh cream.',
            price: 28.00,
            category: 'Cakes',
            inventory: 15,
            sku: 'BB-CAKE-002',
        },
        {
            name: 'Cinnamon Roll Pack (6pcs)',
            slug: 'cinnamon-roll-pack',
            shortDescription: 'Six pillowy cinnamon rolls with cream cheese frosting. Great for sharing!',
            price: 24.90,
            compareAtPrice: 29.90,
            category: 'Pastries',
            inventory: 30,
            sku: 'BB-PASTRY-002',
        },
    ]

    for (const p of products) {
        const existing = await payload.find({
            collection: 'products',
            where: { slug: { equals: p.slug } },
            limit: 1,
        })

        if (existing.docs.length > 0) {
            console.log(`✅ Product exists: ${p.name}`)
            continue
        }

        await payload.create({
            collection: 'products',
            data: {
                tenant: tenant.id,
                site: site.id,
                name: p.name,
                slug: p.slug,
                shortDescription: p.shortDescription,
                price: p.price,
                compareAtPrice: p.compareAtPrice,
                currency: 'MYR',
                category: p.category,
                status: 'active',
                inventory: p.inventory,
                sku: p.sku,
            } as any,
        })
        console.log(`✅ Created product: ${p.name} — RM ${p.price.toFixed(2)}`)
    }

    console.log('\n🎉 Seed complete!')
    console.log('─────────────────────────────────')
    console.log(`📧 Login: ${ADMIN_EMAIL}`)
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`)
    console.log(`🏪 Storefront: /sites/${TENANT_SLUG}/products`)
    console.log('─────────────────────────────────')

    process.exit(0)
}

seed().catch((err) => {
    console.error('❌ Seed failed:', err)
    process.exit(1)
})
