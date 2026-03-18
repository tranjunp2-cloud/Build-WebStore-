import { getPayload } from 'payload'
import config from '../src/payload.config'
import { SEED_TEMPLATES } from '../src/lib/ai/seed-templates'

async function seed() {
  const payload = await getPayload({ config })

  console.log('🌱 Seeding database...')

  // 1. Tạo user
  const existingUser = await payload.find({
    collection: 'users',
    where: { email: { equals: 'demo@primeweb.app' } },
  })

  let user = existingUser.docs[0]
  if (!user) {
    user = await payload.create({
      collection: 'users',
      data: {
        email: 'demo@primeweb.app',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'Demo',
        roles: ['super-admin', 'tenant-owner'],
      },
    })
    console.log('  ✓ User created:', user.email)
  } else {
    console.log('  ✓ User already exists:', user.email)
  }

  // 2. Tạo tenant
  const existingTenant = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: 'kedai-demo' } },
  })

  let tenant = existingTenant.docs[0]
  if (!tenant) {
    tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Kedai Demo',
        slug: 'kedai-demo',
        plan: 'free',
        status: 'active',
      },
    })

    // Link user to tenant
    await payload.update({
      collection: 'users',
      id: user.id as number,
      data: {
        tenants: [{ tenant: tenant.id as number, role: 'owner' }],
      },
    })
    console.log('  ✓ Tenant created:', tenant.name)
  } else {
    console.log('  ✓ Tenant already exists:', tenant.name)
  }

  // 3. Tạo site
  const existingSite = await payload.find({
    collection: 'sites',
    where: { tenant: { equals: tenant.id as number } },
  })

  let site = existingSite.docs[0]
  if (!site) {
    site = await payload.create({
      collection: 'sites',
      data: {
        name: 'Kedai Demo Site',
        tenant: tenant.id as number,
        status: 'published',
        siteType: 'ecommerce',
        domain: 'kedai-demo.primeweb.app',
      },
    })
    console.log('  ✓ Site created:', site.name)
  } else {
    console.log('  ✓ Site already exists:', site.name)
  }

  // 4. Tạo 5 products
  const productList = [
    { name: 'Baju Kurung Pink', price: 189, inventory: 50, slug: 'baju-kurung-pink' },
    { name: 'Tudung Bawal Basic', price: 35, inventory: 100, slug: 'tudung-bawal-basic' },
    { name: 'Telekung Premium', price: 250, inventory: 30, slug: 'telekung-premium' },
    { name: 'Beg Tangan Kulit', price: 120, inventory: 40, slug: 'beg-tangan-kulit' },
    { name: 'Kasut Perempuan', price: 89, inventory: 60, slug: 'kasut-perempuan' },
  ]

  const existingProducts = await payload.find({
    collection: 'products',
    where: { site: { equals: site.id as number } },
  })

  const createdProducts = [...existingProducts.docs]
  if (existingProducts.totalDocs < 5) {
    for (const p of productList) {
      const product = await payload.create({
        collection: 'products',
        data: {
          name: p.name,
          slug: p.slug,
          price: p.price,
          inventory: p.inventory,
          site: site.id as number,
          tenant: tenant.id as number,
          status: 'active',
          currency: 'MYR',
        },
      })
      createdProducts.push(product)
    }
    console.log(`  ✓ Created ${productList.length} products`)
  } else {
    console.log('  ✓ Products already exist')
  }

  // 5. Tạo 3 orders (trạng thái khác nhau)
  const existingOrders = await payload.find({
    collection: 'orders',
    where: { site: { equals: site.id as number } },
  })

  if (existingOrders.totalDocs < 3 && createdProducts.length >= 2) {
    const statuses = ['pending', 'processing', 'completed'] as const
    let counter = 1001
    const p1 = createdProducts[0]
    const p2 = createdProducts[1]

    for (const status of statuses) {
      await payload.create({
        collection: 'orders',
        data: {
          tenant: tenant.id as number,
          site: site.id as number,
          orderNumber: `ORD-${counter++}`,
          status,
          currency: 'MYR',
          customerName: 'Ahmad Albab',
          customerEmail: 'ahmad@example.com',
          customerPhone: '+60123456789',
          subtotal: p1.price + p2.price * 2,
          total: p1.price + p2.price * 2,
          items: [
            { product: p1.id as number, productName: p1.name, quantity: 1, unitPrice: p1.price },
            { product: p2.id as number, productName: p2.name, quantity: 2, unitPrice: p2.price },
          ],
          shippingAddress: {
            line1: '123 Jalan Ampang',
            city: 'Kuala Lumpur',
            state: 'KL',
            postcode: '50450',
            country: 'Malaysia',
          },
        },
      })
    }
    console.log('  ✓ Created 3 orders (pending, processing, completed)')
  } else {
    console.log('  ✓ Orders already exist')
  }

  // 6. Seed 10 Industry Templates
  const existingTemplates = await payload.find({
    collection: 'templates',
    limit: 1,
  })

  if (existingTemplates.totalDocs === 0) {
    for (const tpl of SEED_TEMPLATES) {
      await payload.create({
        collection: 'templates',
        data: {
          name: tpl.name,
          description: tpl.description,
          category: tpl.category,
          defaultTheme: tpl.defaultTheme,
          defaultBlocks: tpl.defaultBlocks,
          tags: tpl.tags,
          sortOrder: tpl.sortOrder,
          isPremium: tpl.isPremium,
          isFeatured: tpl.isFeatured,
        },
      })
    }
    console.log(`  ✓ Created ${SEED_TEMPLATES.length} industry templates`)
  } else {
    console.log(`  ✓ Templates already exist (${existingTemplates.totalDocs})`)
  }

  // 7. Seed Pages (homepage + about + contact)
  const existingPages = await payload.find({
    collection: 'pages',
    where: { site: { equals: site.id as number } },
    limit: 1,
  })

  if (existingPages.totalDocs === 0) {
    // Homepage
    await payload.create({
      collection: 'pages',
      data: {
        title: 'Home',
        slug: '/',
        site: site.id as number,
        isHomepage: true,
        publishedAt: new Date().toISOString(),
        layout: [
          {
            blockType: 'navigation',
            logoText: 'Kedai Demo',
            links: [
              { label: 'Home', url: '/' },
              { label: 'Products', url: '/products' },
              { label: 'About', url: '/about' },
              { label: 'Contact', url: '/contact' },
            ],
            ctaButton: { show: true, label: 'Shop Now', url: '/products' },
          },
          {
            blockType: 'hero',
            variant: 'centered',
            headline: 'Fesyen Muslim Premium Malaysia',
            subheadline: 'Koleksi baju kurung, tudung, dan telekung berkualiti tinggi untuk wanita moden.',
            badge: { show: true, text: '✨ Koleksi Baru 2026' },
            ctaButtons: [
              { label: 'Beli Sekarang', url: '/products', style: 'primary' },
              { label: 'Lihat Koleksi', url: '/products', style: 'outline' },
            ],
          },
          {
            blockType: 'features',
            headline: 'Kenapa Pilih Kami?',
            subheadline: 'Kami komited untuk memberikan yang terbaik',
            sectionLabel: 'Kelebihan Kami',
            features: [
              { icon: '✅', title: 'Kualiti Premium', description: 'Bahan pilihan berkualiti tinggi, selesa dipakai seharian.' },
              { icon: '🚚', title: 'Penghantaran Pantas', description: 'Penghantaran ke seluruh Malaysia dalam 2-3 hari bekerja.' },
              { icon: '🔄', title: 'Pulangan Mudah', description: 'Polisi pulangan 30 hari tanpa soal jawab.' },
            ],
          },
        ],
        seo: {
          title: 'Kedai Demo — Fesyen Muslim Premium Malaysia',
          description: 'Baju kurung, tudung, dan telekung berkualiti tinggi untuk wanita moden Malaysia.',
        },
      },
    })

    // About page
    await payload.create({
      collection: 'pages',
      data: {
        title: 'About Us',
        slug: '/about',
        site: site.id as number,
        isHomepage: false,
        publishedAt: new Date().toISOString(),
        layout: [
          {
            blockType: 'about',
            headline: 'Tentang Kedai Demo',
            sectionLabel: 'Kisah Kami',
            layout: 'image-right',
          },
        ],
        seo: { title: 'Tentang Kami — Kedai Demo', description: 'Kenali lebih lanjut tentang Kedai Demo dan misi kami.' },
      },
    })

    // Contact page
    await payload.create({
      collection: 'pages',
      data: {
        title: 'Contact',
        slug: '/contact',
        site: site.id as number,
        isHomepage: false,
        publishedAt: new Date().toISOString(),
        layout: [
          {
            blockType: 'contact',
            headline: 'Hubungi Kami',
            subtext: 'Ada soalan? Kami sedia membantu!',
            email: 'hello@kedaidemo.my',
            phone: '+60 12-345 6789',
            address: '123 Jalan Demo, Kuala Lumpur',
            formFields: [
              { fieldName: 'name', label: 'Nama Penuh', fieldType: 'text', required: true, placeholder: 'Nama anda' },
              { fieldName: 'email', label: 'E-mel', fieldType: 'email', required: true, placeholder: 'email@example.com' },
              { fieldName: 'message', label: 'Mesej', fieldType: 'textarea', required: true, placeholder: 'Tulis mesej anda...' },
            ],
          },
        ],
        seo: { title: 'Hubungi Kami — Kedai Demo', description: 'Hubungi pasukan Kedai Demo untuk pertanyaan dan bantuan.' },
      },
    })

    console.log('  ✓ Created 3 pages (home, about, contact) with blocks')
  } else {
    console.log(`  ✓ Pages already exist (${existingPages.totalDocs})`)
  }

  console.log('\n✅ Seeded: 1 user, 1 tenant, 1 site, 5 products, 3 orders, 10 templates, 3 pages')
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
