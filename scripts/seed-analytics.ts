import { getPayload } from 'payload'
import config from '../src/payload.config'
import { subDays } from 'date-fns'

async function seedAnalytics() {
  const payload = await getPayload({ config })
  console.log('🌱 Seeding analytics data...')

  // Get tenant
  const tenantRes = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: 'kedai-demo' } },
  })
  
  if (tenantRes.totalDocs === 0) {
    console.error('Tenant not found. Please run seed.ts first.')
    process.exit(1)
  }
  
  const tenantId = tenantRes.docs[0].id

  // Get site
  const siteRes = await payload.find({
    collection: 'sites',
    where: { tenant: { equals: tenantId } },
  })

  // We will generate 30 days of data
  const events = ['pageview', 'pageview', 'pageview', 'click', 'add_to_cart', 'checkout']
  const urls = ['/', '/', '/products', '/about', '/blog/fashion-tips', '/product/baju-kurung', '/product/tudung-bawal']
  const referrers = ['https://google.com', 'https://facebook.com', '', 'https://tiktok.com']
  const now = new Date()

  let generated = 0

  for (let i = 0; i <= 30; i++) {
    const targetDate = subDays(now, i)
    // Randomize 5 to 20 events per day
    const eventsCount = Math.floor(Math.random() * 15) + 5
    
    for (let j = 0; j < eventsCount; j++) {
      const eType = events[Math.floor(Math.random() * events.length)]
      const eUrl = urls[Math.floor(Math.random() * urls.length)]
      const eRef = referrers[Math.floor(Math.random() * referrers.length)]
      
      // randomize hours throughout the day
      const eventTime = new Date(targetDate)
      eventTime.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60))

      await payload.create({
        collection: 'analytics',
        data: {
          tenant: tenantId as number,
          site: siteRes.totalDocs > 0 ? siteRes.docs[0].id as number : undefined,
          event: eType as any,
          pageUrl: eUrl,
          referrer: eRef,
          sessionId: `sess_${Math.random().toString(36).substring(7)}`,
          visitorId: `vis_${Math.floor(Math.random() * 100)}`
        },
        req: {
            user: { id: 1 } as any // disable access control
        }
      })
      // manually update createdAt since Payload overrides it on create
      await payload.db.drizzle.execute(`UPDATE analytics SET created_at = '${eventTime.toISOString()}' WHERE id = (SELECT id FROM analytics ORDER BY id DESC LIMIT 1)`)
      
      generated++
    }
  }

  console.log(`✅ Seeded ${generated} analytics events over the past 30 days.`)
  process.exit(0)
}

seedAnalytics().catch(console.error)
