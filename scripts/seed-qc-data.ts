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
 *   - Dashboard-ready onboarding state for every seeded merchant owner
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
import {
  findMissingQcProducts,
  seedTenantProducts,
  seedTenantExtraPages,
} from './qc-seed-products'
import {
  buildQcSiteData,
  buildQcTenantData,
  buildQcUserData,
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
  // Batch lookup ALL emails in a single query — sequential per-email
  // pre-checks (300+ round-trips) exceeds Neon Free tier's idle timeout
  // and drops the connection mid-loop. One `in` query keeps us alive.
  const emails = users.map((u) => u.email)
  const existingResult = await payload.find({
    collection: 'users',
    where: { email: { in: emails } },
    limit: emails.length,
    overrideAccess: true,
  })
  const existingByEmail = new Map<string, typeof existingResult.docs[0]>()
  for (const doc of existingResult.docs) {
    existingByEmail.set(doc.email as string, doc)
  }
  console.log(`  ~ ${existingByEmail.size}/${users.length} users already exist, creating ${users.length - existingByEmail.size} new`)

  const idsByEmail: IdMap = {}
  const staleDashboardUserIds: Array<string | number> = []
  for (const spec of users) {
    const existing = existingByEmail.get(spec.email)
    if (existing !== undefined) {
      idsByEmail[spec.email] = existing.id
      if (spec.dashboardReady && existing.has_seen_ai_wizard !== true) {
        staleDashboardUserIds.push(existing.id)
      }
      continue
    }
    const created = await payload.create({
      collection: 'users',
      data: buildQcUserData(spec, password),
      overrideAccess: true,
    })
    idsByEmail[spec.email] = created.id
    console.log(`  + user created: ${spec.email} [${spec.roles.join(',')}]`)
  }
  if (staleDashboardUserIds.length) {
    await payload.update({
      collection: 'users',
      where: { id: { in: staleDashboardUserIds } },
      data: { has_seen_ai_wizard: true },
      overrideAccess: true,
    })
    console.log(`  ~ ${staleDashboardUserIds.length} existing dashboard users marked wizard-complete`)
  }
  return idsByEmail
}

async function seedTenants(payload: Payload, tenants: TenantSpec[]): Promise<IdMap> {
  // Batch pre-check via single `in` query — avoids Neon idle timeout
  // when scaling past ~150 tenants (same fix as seedUsers).
  const names = tenants.map((t) => t.name)
  const existingResult = await payload.find({
    collection: 'tenants',
    where: { name: { in: names } },
    limit: names.length,
    overrideAccess: true,
  })
  const existingByName = new Map<string, typeof existingResult.docs[0]>()
  for (const doc of existingResult.docs) {
    existingByName.set(doc.name as string, doc)
  }
  console.log(`  ~ ${existingByName.size}/${tenants.length} tenants already exist, creating ${tenants.length - existingByName.size} new`)

  const tenantIdsByName: IdMap = {}
  const staleDashboardTenantIds: Array<string | number> = []
  for (const spec of tenants) {
    const existing = existingByName.get(spec.name)
    if (existing !== undefined) {
      tenantIdsByName[spec.name] = existing.id
      if (spec.dashboardReady && existing.onboardingCompleted !== true) {
        staleDashboardTenantIds.push(existing.id)
      }
      continue
    }
    const created = await payload.create({
      collection: 'tenants',
      data: buildQcTenantData(spec),
      overrideAccess: true,
    })
    tenantIdsByName[spec.name] = created.id
    console.log(`  + tenant created: ${spec.name} (status=${spec.status})`)
  }
  if (staleDashboardTenantIds.length) {
    await payload.update({
      collection: 'tenants',
      where: { id: { in: staleDashboardTenantIds } },
      data: { onboardingCompleted: true },
      overrideAccess: true,
    })
    console.log(`  ~ ${staleDashboardTenantIds.length} existing tenants marked onboarding-complete`)
  }
  return tenantIdsByName
}

async function linkOwnerships(
  payload: Payload,
  tenants: TenantSpec[],
  userIds: IdMap,
  tenantIds: IdMap,
): Promise<void> {
  // Batch load all owner users once — avoids N sequential findByID
  // round-trips that trigger Neon idle timeout at scale.
  const ownerIds = tenants
    .map((t) => userIds[t.ownerEmail])
    .filter((id): id is string | number => id !== undefined)
  const usersResult = await payload.find({
    collection: 'users',
    where: { id: { in: ownerIds } },
    limit: ownerIds.length,
    overrideAccess: true,
  })
  const userById = new Map<string | number, typeof usersResult.docs[0]>()
  for (const doc of usersResult.docs) userById.set(doc.id, doc)

  let linked = 0
  let existing = 0
  for (const spec of tenants) {
    const userId = userIds[spec.ownerEmail]
    const tenantId = tenantIds[spec.name]
    if (!userId || !tenantId) {
      console.warn(`  ! skip link ${spec.ownerEmail} → ${spec.name} (missing id)`)
      continue
    }
    const user = userById.get(userId)
    if (!user) {
      console.warn(`  ! skip link ${spec.ownerEmail} (user not loaded)`)
      continue
    }
    const memberships = Array.isArray(user.tenants) ? user.tenants : []
    const alreadyLinked = memberships.some((m) => {
      const tRef = m?.tenant
      const tId = typeof tRef === 'object' && tRef ? (tRef as { id: string | number }).id : tRef
      return tId === tenantId
    })
    if (alreadyLinked) { existing++; continue }
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
    linked++
  }
  console.log(`  ~ ${existing} links already exist, +${linked} new links created`)
}

async function seedPlanSubscriptions(
  payload: Payload,
  tenants: TenantSpec[],
  tenantIds: IdMap,
): Promise<number> {
  // Batch load all existing subs — same anti-idle-timeout pattern.
  const allTenantIds = tenants.map((t) => tenantIds[t.name]).filter((x): x is string | number => !!x)
  const existingResult = await payload.find({
    collection: 'plan-subscriptions',
    where: { tenant: { in: allTenantIds } },
    limit: allTenantIds.length,
    overrideAccess: true,
  })
  const existingTenantIds = new Set<string | number>()
  for (const doc of existingResult.docs) {
    const tRef = (doc as { tenant?: unknown }).tenant
    const tId = typeof tRef === 'object' && tRef ? (tRef as { id: string | number }).id : tRef as string | number
    existingTenantIds.add(tId)
  }
  let created = 0
  const now = new Date()
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  for (const spec of tenants) {
    const tid = tenantIds[spec.name]
    if (!tid) continue
    if (existingTenantIds.has(tid)) continue
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
  tenantSlug: string,
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
    const existingSite = existingSites.docs[0]
    siteId = existingSite.id
    if (existingSite.generationStatus !== 'completed') {
      await payload.update({
        collection: 'sites',
        id: siteId,
        data: { generationStatus: 'completed' },
        overrideAccess: true,
      })
    }
    console.log(`  ~ site exists for ${tenantName}`)
  } else {
    const site = await payload.create({
      collection: 'sites',
      data: buildQcSiteData(tenantId, tenantName),
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

  const productsCreated = await seedTenantProducts(payload, tenantId, tenantSlug, siteId, tenantName)
  const extraPagesCreated = await seedTenantExtraPages(payload, tenantId, siteId, tenantName)
  if (productsCreated) console.log(`  + ${productsCreated} products for ${tenantName}`)
  if (extraPagesCreated) console.log(`  + ${extraPagesCreated} extra pages for ${tenantName}`)
  return { productsCreated, extraPagesCreated }
}

async function assertDashboardReadyFixtures(
  payload: Payload,
  users: UserSpec[],
  tenants: TenantSpec[],
  userIds: IdMap,
  tenantIds: IdMap,
): Promise<void> {
  const dashboardUserIds = users
    .filter((spec) => spec.dashboardReady)
    .map((spec) => userIds[spec.email])
    .filter((id): id is string | number => id !== undefined)
  const dashboardTenantIds = tenants
    .filter((spec) => spec.dashboardReady)
    .map((spec) => tenantIds[spec.name])
    .filter((id): id is string | number => id !== undefined)
  const loadTestTenants = tenants.flatMap((spec) => {
    const id = tenantIds[spec.name]
    return spec.loadTestEligible && id !== undefined ? [{ id, slug: spec.slug }] : []
  })
  const loadTestTenantIds = new Set(loadTestTenants.map((tenant) => String(tenant.id)))

  const [userResult, tenantResult, siteResult, productResult] = await Promise.all([
    payload.find({
      collection: 'users',
      where: { id: { in: dashboardUserIds } },
      limit: dashboardUserIds.length,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'tenants',
      where: { id: { in: dashboardTenantIds } },
      limit: dashboardTenantIds.length,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'sites',
      where: { tenant: { in: dashboardTenantIds } },
      limit: dashboardTenantIds.length,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'products',
      where: {
        and: [
          { tenant: { in: loadTestTenants.map((tenant) => tenant.id) } },
          { deletedAt: { exists: false } },
        ],
      },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const readyUserIds = new Set(
    userResult.docs.filter((user) => user.has_seen_ai_wizard === true).map((user) => String(user.id)),
  )
  const readyTenantIds = new Set(
    tenantResult.docs.filter((tenant) => tenant.onboardingCompleted === true).map((tenant) => String(tenant.id)),
  )
  const tenantsWithReadySites = new Set(
    siteResult.docs
      .filter((site) => site.generationStatus === 'completed')
      .map((site) => {
        const tenant = site.tenant
        return String(typeof tenant === 'object' && tenant !== null ? tenant.id : tenant)
      }),
  )

  const staleUsers = dashboardUserIds.filter((id) => !readyUserIds.has(String(id)))
  const staleTenants = dashboardTenantIds.filter((id) => !readyTenantIds.has(String(id)))
  const tenantsWithoutReadySites = dashboardTenantIds.filter((id) => !tenantsWithReadySites.has(String(id)))
  const suspendedLoadTestTenants = tenantResult.docs.filter(
    (tenant) => loadTestTenantIds.has(String(tenant.id)) && tenant.status === 'suspended',
  )
  const missingQcProducts = findMissingQcProducts(productResult.docs, loadTestTenants)
  if (
    staleUsers.length
    || staleTenants.length
    || tenantsWithoutReadySites.length
    || suspendedLoadTestTenants.length
    || missingQcProducts.length
  ) {
    throw new Error(
      `Dashboard-ready fixture invariant failed: users=${staleUsers.length}, tenants=${staleTenants.length}, sites=${tenantsWithoutReadySites.length}, suspendedLoadTestTenants=${suspendedLoadTestTenants.length}, missingQcProducts=${missingQcProducts.length}${missingQcProducts.length ? ` (${missingQcProducts.slice(0, 5).join(', ')})` : ''}`,
    )
  }
}

async function main(): Promise<void> {
  assertQcEnv()
  const password = readSeedPassword()
  const merchantCount = readMerchantCount()
  const users = buildUsers(merchantCount)
  const tenants = buildTenants(merchantCount)
  const loadTestOwnerCount = users.filter((user) => user.loadTestEligible).length

  const t0 = Date.now()
  const payload = await getPayload({ config })

  console.log(`🌱 Seeding QC test data (merchants=${merchantCount})...`)
  console.log(`  Load-test owner pool: ${loadTestOwnerCount} eligible (${merchantCount - loadTestOwnerCount} state-test owner excluded)`)
  console.log('  Users:')
  const userIds = await seedUsers(payload, users, password)
  console.log('  Tenants:')
  const tenantIds = await seedTenants(payload, tenants)
  console.log('  Owner ↔ tenant memberships:')
  await linkOwnerships(payload, tenants, userIds, tenantIds)
  console.log('  Plan subscriptions (active):')
  const subscriptionsCreated = await seedPlanSubscriptions(payload, tenants, tenantIds)
  console.log(`    + ${subscriptionsCreated} active subscriptions created`)
  // Content phase — batch-parallel to speed up 300-tenant runs. Sequential
  // baseline was ~0.5 tenants/min (12 write ops/tenant × Neon latency).
  // Concurrency=8 keeps well under Neon Free tier pool (~25 conn) and cuts
  // 300-tenant runs from ~6h to ~45min. Per-tenant ops still sequential
  // inside seedTenantContent — parallelism is BETWEEN tenants.
  const rawConcurrency = Number(process.env.QC_SEED_CONCURRENCY ?? 1)
  const contentConcurrency = Number.isFinite(rawConcurrency) && rawConcurrency >= 1
    ? Math.min(Math.floor(rawConcurrency), 20)
    : 1
  console.log(`  Per-tenant content (concurrency=${contentConcurrency}):`)
  let totalProducts = 0
  let totalExtraPages = 0
  for (let batchStart = 0; batchStart < tenants.length; batchStart += contentConcurrency) {
    const batch = tenants.slice(batchStart, batchStart + contentConcurrency)
    const batchResults = await Promise.all(
      batch.map((spec) => {
        const tid = tenantIds[spec.name]
        if (!tid || !spec.dashboardReady) {
          return Promise.resolve({ productsCreated: 0, extraPagesCreated: 0 })
        }
        return seedTenantContent(payload, tid, spec.slug, spec.name)
      }),
    )
    for (const r of batchResults) {
      totalProducts += r.productsCreated
      totalExtraPages += r.extraPagesCreated
    }
    const done = batchStart + batch.length
    if (done % 20 === 0 || done === tenants.length) {
      const elapsedSec = ((Date.now() - t0) / 1000).toFixed(0)
      console.log(`    [progress] ${done}/${tenants.length} tenants (${elapsedSec}s elapsed)`)
    }
  }

  console.log('  Dashboard-ready fixture validation:')
  await assertDashboardReadyFixtures(payload, users, tenants, userIds, tenantIds)
  console.log('    ✓ users, tenants, sites, and QC products are load-test ready')

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
