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

// Role values MUST match `src/collections/Users.ts` field `roles` options.
// Values: super-admin | tenant-owner | editor | viewer.
type UserRole = 'super-admin' | 'tenant-owner' | 'editor' | 'viewer'

// Membership role MUST match Users.tenants[].role field values.
// Values: owner | admin | editor | viewer | custom.
type TenantRole = 'owner' | 'admin' | 'editor' | 'viewer'

// Tenant status MUST match `src/collections/Tenants.ts` field `status`.
type TenantStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'suspended'

interface UserSpec {
  email: string
  firstName: string
  lastName: string
  roles: UserRole[]
}

interface TenantSpec {
  name: string
  slug: string
  status: TenantStatus
  ownerEmail: string
  membershipRole: TenantRole
}

const USERS: UserSpec[] = [
  { email: 'qc-admin-1@primeweb.local', firstName: 'QC', lastName: 'Admin1', roles: ['super-admin'] },
  { email: 'qc-admin-2@primeweb.local', firstName: 'QC', lastName: 'Admin2', roles: ['super-admin'] },
  { email: 'qc-owner-1@primeweb.local', firstName: 'QC', lastName: 'Owner1', roles: ['tenant-owner'] },
  { email: 'qc-owner-2@primeweb.local', firstName: 'QC', lastName: 'Owner2', roles: ['tenant-owner'] },
  { email: 'qc-owner-3@primeweb.local', firstName: 'QC', lastName: 'Owner3', roles: ['tenant-owner'] },
  { email: 'qc-owner-4@primeweb.local', firstName: 'QC', lastName: 'Owner4', roles: ['tenant-owner'] },
  { email: 'qc-owner-5@primeweb.local', firstName: 'QC', lastName: 'Owner5', roles: ['tenant-owner'] },
  // "Staff" concept mapped to `editor` — closest existing role. There is
  // no `tenant-staff` role in the current schema.
  { email: 'qc-staff-1@primeweb.local', firstName: 'QC', lastName: 'Editor1', roles: ['editor'] },
  { email: 'qc-staff-2@primeweb.local', firstName: 'QC', lastName: 'Editor2', roles: ['editor'] },
  { email: 'qc-staff-3@primeweb.local', firstName: 'QC', lastName: 'Viewer1', roles: ['viewer'] },
]

const TENANTS: TenantSpec[] = [
  { name: 'QC Tenant 1', slug: 'qc-shop-1', status: 'active', ownerEmail: 'qc-owner-1@primeweb.local', membershipRole: 'owner' },
  { name: 'QC Tenant 2', slug: 'qc-shop-2', status: 'active', ownerEmail: 'qc-owner-2@primeweb.local', membershipRole: 'owner' },
  { name: 'QC Tenant 3', slug: 'qc-shop-3', status: 'trialing', ownerEmail: 'qc-owner-3@primeweb.local', membershipRole: 'owner' },
  { name: 'QC Tenant 4', slug: 'qc-shop-4', status: 'past_due', ownerEmail: 'qc-owner-4@primeweb.local', membershipRole: 'owner' },
  { name: 'QC Tenant 5', slug: 'qc-shop-5', status: 'suspended', ownerEmail: 'qc-owner-5@primeweb.local', membershipRole: 'owner' },
]

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

async function seedUsers(payload: Payload, password: string): Promise<IdMap> {
  const idsByEmail: IdMap = {}
  for (const spec of USERS) {
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

async function seedTenants(payload: Payload): Promise<IdMap> {
  const tenantIdsByName: IdMap = {}
  for (const spec of TENANTS) {
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
  userIds: IdMap,
  tenantIds: IdMap,
): Promise<void> {
  for (const spec of TENANTS) {
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
  const t0 = Date.now()
  const payload = await getPayload({ config })

  console.log('🌱 Seeding QC test data...')
  console.log('  Users:')
  const userIds = await seedUsers(payload, password)
  console.log('  Tenants:')
  const tenantIds = await seedTenants(payload)
  console.log('  Owner ↔ tenant memberships:')
  await linkOwnerships(payload, userIds, tenantIds)
  console.log('  Per-tenant content:')
  let totalProducts = 0
  let totalExtraPages = 0
  for (const spec of TENANTS) {
    const tid = tenantIds[spec.name]
    if (!tid) continue
    const { productsCreated, extraPagesCreated } = await seedTenantContent(payload, tid, spec.name)
    totalProducts += productsCreated
    totalExtraPages += extraPagesCreated
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(
    `✅ Seed done in ${elapsed}s. Summary: ${Object.keys(userIds).length} users, ${Object.keys(tenantIds).length} tenants, ${totalProducts} products, ${totalExtraPages} extra pages.`,
  )
  console.log('   Password sourced from QC_SEED_PASSWORD. Order seed deferred — schema complexity.')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
