/**
 * Reset a user account for testing — deletes all sites, pages, and analytics.
 * Usage: pnpm db:reset test@primeweb.app
 * Or:    pnpm db:reset (defaults to test@primeweb.app)
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const DEFAULT_EMAIL = 'test@primeweb.app'

async function resetAccount() {
    const email = process.argv[2] || DEFAULT_EMAIL
    const payload = await getPayload({ config })

    console.log(`\n🔄 Resetting account: ${email}\n`)

    // 1. Find user
    const userResult = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
    })

    if (!userResult.docs.length) {
        console.error(`❌ User not found: ${email}`)
        process.exit(1)
    }

    const user = userResult.docs[0]
    console.log(`  ✓ User found: ${user.firstName} ${user.lastName} (ID: ${user.id})`)

    // 2. Find tenant
    const tenants = (user.tenants as any[]) || []
    if (!tenants.length) {
        console.log('  ⚠ No tenant linked — nothing to reset')
        process.exit(0)
    }

    const tenantId = typeof tenants[0].tenant === 'object' ? tenants[0].tenant.id : tenants[0].tenant
    console.log(`  ✓ Tenant ID: ${tenantId}`)

    // 3. Find all sites for this tenant
    const sitesResult = await payload.find({
        collection: 'sites',
        where: { tenant: { equals: tenantId } },
        limit: 100,
    })

    console.log(`  ✓ Found ${sitesResult.docs.length} site(s)`)

    // 4. Delete pages for each site
    let pagesDeleted = 0
    for (const site of sitesResult.docs) {
        const pagesResult = await payload.find({
            collection: 'pages',
            where: { site: { equals: site.id } },
            limit: 500,
        })

        for (const page of pagesResult.docs) {
            await payload.delete({ collection: 'pages', id: page.id })
            pagesDeleted++
        }
    }
    console.log(`  ✓ Deleted ${pagesDeleted} page(s)`)

    // 5. Delete all sites
    for (const site of sitesResult.docs) {
        await payload.delete({ collection: 'sites', id: site.id })
    }
    console.log(`  ✓ Deleted ${sitesResult.docs.length} site(s)`)

    // 6. Delete analytics for this tenant
    const analyticsResult = await payload.find({
        collection: 'analytics',
        where: { tenant: { equals: tenantId } },
        limit: 1,
    })
    if (analyticsResult.totalDocs > 0) {
        await payload.delete({
            collection: 'analytics',
            where: { tenant: { equals: tenantId } },
        })
        console.log(`  ✓ Deleted ${analyticsResult.totalDocs} analytics event(s)`)
    }

    // 7. Reset user flags
    await payload.update({
        collection: 'users',
        id: user.id as number,
        data: {
            has_seen_ai_wizard: false,
            otpHash: null,
            otpExpiresAt: null,
            otpAttempts: 0,
        },
    })
    console.log('  ✓ Reset user flags (ai_wizard, otp)')

    // 8. Reset tenant counters
    await payload.update({
        collection: 'tenants',
        id: tenantId,
        data: {
            aiGenerationsCount: 0,
        },
    })
    console.log('  ✓ Reset tenant AI generation count')

    console.log(`\n✅ Account "${email}" reset successfully!`)
    console.log('   → Login at http://localhost:3000/login')
    console.log('   → Dashboard will show empty state with "Build with AI" CTA\n')

    process.exit(0)
}

resetAccount().catch((err) => {
    console.error('❌ Reset failed:', err)
    process.exit(1)
})
