/**
 * QC test environment seed script.
 *
 * Populates the isolated Neon QC database with dummy fixtures the QC team
 * needs for JMeter / E2E / functional load tests:
 *
 *   - 10 test users across 3 role tiers (super-admin / tenant-owner / editor)
 *   - 5 test tenants with subscription-status variety
 *     (active / trialing / past_due / cancelled / suspended)
 *   - Owner ↔ tenant linkage via Users.tenants[] membership array
 *   - Per-tenant lightweight content (site + one home page)
 *
 * Idempotent: re-running skips existing users (matched by email) and
 * tenants (matched by name). Safe for repeat runs during handover.
 *
 * Guarded by `assertQcEnv()` — refuses to run against staging / prod.
 *
 * Password: read from env var `QC_SEED_PASSWORD` (set via `.env.qc-test`
 * or exported before the run). No hardcoded fallback — refusing to seed
 * is safer than seeding a well-known default.
 *
 * Usage:
 *   set -a && . .env.qc-test && set +a
 *   npm run db:seed-qc
 */

import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config'
import { assertQcEnv } from './qc-guard'
import { seedTenantProducts, seedTenantExtraPages } from './qc-seed-products'
import {
  buildTenants,
  buildUsers,
  readMerchantCount,
  type TenantSpec,
  type UserSpec,
} from './qc-fixtures'

type IdMap = Record<string, string | number>

function readSeedPassword(): string {
  const pw = process.env.QC_SEED_PASSWORD
  if (!pw || pw.length < 8) {
    console.error('❌ QC_SEED_PASSWORD env var missing or shorter than 8 chars.')
    console.error('   Set it in .env.qc-test (see .env.qc-test.example) or export before running.')
    process.exit(1)
  }
  return pw
}

async function seedUsers(payload: Payload, users: UserSpec[], password: string): Promise<IdMap> {
  const idsByEmail: IdMap = {}
  for (const spec of users) {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: spec.email } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length) {
      idsByEmail[spec.email] = existing.docs[0].id
      console.log(`  ~ user exists: ${spec.email}`)
      continue
    }
    const created = await payload.create({
      collection: 'users',
      data: {
        email: spec.email,
        password,
        firstName: spec.firstName,
        lastName: spec.lastName,
        roles: spec.roles,
      },
      overrideAccess: true,
    })
    idsByEmail[spec.email] = created.id
    console.log(`  + user created: ${spec.email} [${spec.roles.join(',')}]`)
  }
  return idsByEmail
}

async function seedTenants(payload: Payload, tenants: TenantSpec[]): Promise<IdMap> {
  const tenantIdsByName: IdMap = {}
  for (const spec of tenants) {
    const existing = await payload.find({
      collection: 'tenants',
      where: { name: { equals: spec.name } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length) {
      tenantIdsByName[spec.name] = existing.docs[0].id
      console.log(`  ~ tenant exists: ${spec.name}`)
      continue
    }
    const created = await payload.create({
      collection: 'tenants',
      data: {
        name: spec.name,
        slug: spec.slug,
        status: spec.status,
      },
      overrideAccess: true,
    })
    tenantIdsByName[spec.name] = created.id
    console.log(`  + tenant created: ${spec.name} (status=${spec.status})`)
  }
  return tenantIdsByName
}

async function linkOwnerships(
  payload: Payload,
  tenants: TenantSpec[],
  userIds: IdMap,
  tenantIds: IdMap,
): Promise<void> {
  for (const spec of tenants) {
    const userId = userIds[spec.ownerEmail]
    const tenantId = tenantIds[spec.name]
    if (!userId || !tenantId) {
      console.warn(`  ! skip link ${spec.ownerEmail} → ${spec.name} (missing id)`)
      continue
    }
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
    })
    const memberships = Array.isArray(user.tenants) ? user.tenants : []
    const alreadyLinked = memberships.some((m) => {
      const tRef = m?.tenant
      const tId = typeof tRef === 'object' && tRef ? (tRef as { id: string | number }).id : tRef
      return tId === tenantId
    })
    if (alreadyLinked) {
      console.log(`  ~ link exists: ${spec.ownerEmail} → ${spec.name}`)
      continue
    }
    await payload.update({
      collection: 'users',
      id: userId,
      data: {
        tenants: [
          ...memberships,
          { tenant: tenantId, role: spec.membershipRole },
        ],
      },
      overrideAccess: true,
    })
    console.log(`  + linked ${spec.ownerEmail} → ${spec.name} as ${spec.membershipRole}`)
  }
}

async function seedPlanSubscriptions(
  payload: Payload,
  tenants: TenantSpec[],
  tenantIds: IdMap,
): Promise<number> {
  let created = 0
  const now = new Date()
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  for (const spec of tenants) {
    const tid = tenantIds[spec.name]
    if (!tid) continue
    const existing = await payload.find({
      collection: 'plan-subscriptions',
      where: { tenant: { equals: tid } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length) continue
    // packCode = first segment of plan value (STARTER / STANDARD /
    // PROFESSIONAL). Mirrors what SSO webhook sends in the real flow so
    // enforcement-layer lookups behave the same way against seeded data.
    const packCode = spec.plan.split('_')[0]
    await payload.create({
      collection: 'plan-subscriptions',
      data: {
        tenant: tid as number,
        name: 'main',
        plan: spec.plan,
        status: 'active',
        startsAt: now.toISOString(),
        endsAt: oneYearLater.toISOString(),
        packCode,
      },
      overrideAccess: true,
    })
    created++
  }
  return created
}

async function seedTenantContent(
  payload: Payload,
  tenantId: string | number,
  tenantName: string,
): Promise<{ productsCreated: number; extraPagesCreated: number }> {
  // Site + home page: create if missing, otherwise reuse the existing one
  // so downstream product/page seeding still runs on re-runs.
  const existingSites = await payload.find({
    collection: 'sites',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    overrideAccess: true,
  })
  let siteId: string | number
  if (existingSites.docs.length) {
    siteId = existingSites.docs[0].id
    console.log(`  ~ site exists for ${tenantName}`)
  } else {
    const site = await payload.create({
      collection: 'sites',
      data: { name: `${tenantName} Site`, tenant: tenantId },
      overrideAccess: true,
    })
    siteId = site.id
    await payload.create({
      collection: 'pages',
      data: { title: 'Home', slug: 'home', site: siteId, tenant: tenantId },
      overrideAccess: true,
    })
    console.log(`  + site + home page created for ${tenantName}`)
  }

  const productsCreated = await seedTenantProducts(payload, tenantId, siteId, tenantName)
  const extraPagesCreated = await seedTenantExtraPages(payload, tenantId, siteId, tenantName)
  if (productsCreated) console.log(`  + ${productsCreated} products for ${tenantName}`)
  if (extraPagesCreated) console.log(`  + ${extraPagesCreated} extra pages for ${tenantName}`)
  return { productsCreated, extraPagesCreated }
}

async function main(): Promise<void> {
  assertQcEnv()
  const password = readSeedPassword()
  const merchantCount = readMerchantCount()
  const users = buildUsers(merchantCount)
  const tenants = buildTenants(merchantCount)

  const t0 = Date.now()
  const payload = await getPayload({ config })

  console.log(`🌱 Seeding QC test data (merchants=${merchantCount})...`)
  console.log('  Users:')
  const userIds = await seedUsers(payload, users, password)
  console.log('  Tenants:')
  const tenantIds = await seedTenants(payload, tenants)
  console.log('  Owner ↔ tenant memberships:')
  await linkOwnerships(payload, tenants, userIds, tenantIds)
  console.log('  Plan subscriptions (active):')
  const subscriptionsCreated = await seedPlanSubscriptions(payload, tenants, tenantIds)
  console.log(`    + ${subscriptionsCreated} active subscriptions created`)
  console.log('  Per-tenant content:')
  let totalProducts = 0
  let totalExtraPages = 0
  let idx = 0
  for (const spec of tenants) {
    idx++
    const tid = tenantIds[spec.name]
    if (!tid) continue
    const { productsCreated, extraPagesCreated } = await seedTenantContent(payload, tid, spec.name)
    totalProducts += productsCreated
    totalExtraPages += extraPagesCreated
    // Progress heartbeat every 10 tenants — critical at scale (300+)
    // so operators can tell the loop is alive vs stalled on Neon pool.
    if (idx % 10 === 0) {
      const elapsedSec = ((Date.now() - t0) / 1000).toFixed(0)
      console.log(`    [progress] ${idx}/${tenants.length} tenants (${elapsedSec}s elapsed)`)
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(
    `✅ Seed done in ${elapsed}s. Summary: ${Object.keys(userIds).length} users, ${Object.keys(tenantIds).length} tenants, ${subscriptionsCreated} subscriptions, ${totalProducts} products, ${totalExtraPages} extra pages.`,
  )
  console.log('   Password sourced from QC_SEED_PASSWORD. Order seed deferred — schema complexity.')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
