/**
 * Seed: Create SSO Service Account via Payload API
 *
 * Usage:
 *   npx tsx scripts/seed-sso-account.ts
 *
 * Uses Payload CMS Local API (same pattern as seed.ts).
 * Creates a super-admin service account for SSO integration.
 */

import { getPayload } from 'payload'
import config from '../src/payload.config'

const SSO_USER = {
    email: 'sso-service@primeweb.app',
    password: 'HxMQx_7GmmkzLJS8ssu2nK3D1Q1PHcfx',
    firstName: 'SSO',
    lastName: 'Service',
}

async function seedSsoAccount() {
    console.log('\n🔧 Creating SSO Service Account...')
    console.log(`   Email: ${SSO_USER.email}\n`)

    const payload = await getPayload({ config })

    // Check if user already exists
    const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: SSO_USER.email } },
        limit: 1,
    })

    let userId: number

    if (existing.docs.length > 0) {
        userId = existing.docs[0].id as number
        console.log(`⚠️  User already exists (ID: ${userId}), updating...`)

        await payload.update({
            collection: 'users',
            id: userId,
            data: {
                password: SSO_USER.password,
                firstName: SSO_USER.firstName,
                lastName: SSO_USER.lastName,
                roles: ['super-admin'],
            },
            overrideAccess: true,
        })
        console.log('✅ Password & role updated')
    } else {
        const newUser = await payload.create({
            collection: 'users',
            data: {
                email: SSO_USER.email,
                password: SSO_USER.password,
                firstName: SSO_USER.firstName,
                lastName: SSO_USER.lastName,
                roles: ['super-admin'],
            },
        })
        userId = newUser.id as number
        console.log(`✅ User created (ID: ${userId})`)
    }

    // Print credentials
    console.log('\n' + '='.repeat(50))
    console.log('📋 SSO Service Account Ready')
    console.log('='.repeat(50))
    console.log(`   ID:       ${userId}`)
    console.log(`   Email:    ${SSO_USER.email}`)
    console.log(`   Password: ${SSO_USER.password}`)
    console.log(`   Role:     super-admin`)
    console.log('')
    console.log('   ENV for SSO:')
    console.log(`   PRIME_WEB_V2_ADMIN_USERNAME=${SSO_USER.email}`)
    console.log(`   PRIME_WEB_V2_ADMIN_PASSWORD=${SSO_USER.password}`)
    console.log('='.repeat(50))

    process.exit(0)
}

seedSsoAccount().catch((err) => {
    console.error('❌ Error:', err.message || err)
    process.exit(1)
})
