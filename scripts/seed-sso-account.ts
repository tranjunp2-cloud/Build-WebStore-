/**
 * Seed: Create SSO Service Account via Payload API
 *
 * Usage:
 *   npm run db:seed-sso
 *
 * Uses Payload CMS Local API — properly hashes password via scrypt.
 * Creates/updates a super-admin service account for SSO integration.
 *
 * Credentials from env vars (never hardcoded):
 *   SSO_SERVICE_EMAIL    — default: sso-service@primeweb.app
 *   SSO_SERVICE_PASSWORD — REQUIRED (no default)
 *
 * Also seeds admin user if BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD are set.
 */

import { getPayload } from 'payload'
import config from '../src/payload.config'

const SSO_EMAIL = process.env.SSO_SERVICE_EMAIL || 'sso-service@primeweb.app'
const SSO_PASSWORD = process.env.SSO_SERVICE_PASSWORD || ''

const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL || ''
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || ''

interface AccountConfig {
    email: string
    password: string
    firstName: string
    lastName: string
    label: string
}

async function ensureUser(
    payload: Awaited<ReturnType<typeof getPayload>>,
    account: AccountConfig,
) {
    if (!account.password) {
        console.log(`  ⏭  ${account.label}: SKIPPED (password env var not set)`)
        return
    }

    const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: account.email } },
        limit: 1,
        overrideAccess: true,
    })

    if (existing.docs.length > 0) {
        const userId = existing.docs[0].id as number
        console.log(`  ⚠️  ${account.label}: EXISTS (ID: ${userId}), updating password...`)

        // Only update password + profile. Do NOT change roles (avoid privilege escalation).
        await payload.update({
            collection: 'users',
            id: userId,
            data: {
                password: account.password,
                firstName: account.firstName,
                lastName: account.lastName,
            },
            overrideAccess: true,
        })
        console.log(`  ✅ ${account.label}: Password updated (roles unchanged)`)
    } else {
        const newUser = await payload.create({
            collection: 'users',
            data: {
                email: account.email,
                password: account.password,
                firstName: account.firstName,
                lastName: account.lastName,
                roles: ['super-admin'],
            },
            overrideAccess: true,
        })
        console.log(`  ✅ ${account.label}: CREATED (ID: ${newUser.id})`)
    }
}

async function seedAccounts() {
    console.log('\n' + '═'.repeat(50))
    console.log('  SEED — Service Accounts (Payload Local API)')
    console.log('═'.repeat(50))

    const payload = await getPayload({ config })

    // Admin user (optional)
    if (ADMIN_EMAIL) {
        console.log('\n📌 Admin user:')
        await ensureUser(payload, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            firstName: 'Admin',
            lastName: 'Web Store',
            label: 'Admin',
        })
    }

    // SSO service account
    console.log('\n📌 SSO service account:')
    await ensureUser(payload, {
        email: SSO_EMAIL,
        password: SSO_PASSWORD,
        firstName: 'SSO',
        lastName: 'Service',
        label: 'SSO Service',
    })

    console.log('\n' + '─'.repeat(50))
    console.log('  ✅ Seed complete.')
    if (SSO_PASSWORD) {
        console.log(`  SSO account: ${SSO_EMAIL}`)
    }
    console.log('─'.repeat(50) + '\n')

    process.exit(0)
}

seedAccounts().catch((err) => {
    console.error('❌ Error:', err.message || err)
    process.exit(1)
})
