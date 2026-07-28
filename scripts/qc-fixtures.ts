/**
 * QC seed fixtures — data builders for scale seeding.
 *
 * Extracted from seed-qc-data.ts so the orchestrator stays lean while
 * scaling from the original 5-tenant baseline to N (default 5, up to
 * 300 for QA capacity tests).
 *
 * `QC_MERCHANT_COUNT` env var controls the size:
 *   - Unset / <=5  → 5 tenants with distinct statuses (backward compat)
 *   - N > 5        → 5 base tenants + (N-5) additional active tenants,
 *                     each with a Non-TM subscription plan rotating
 *                     Starter / Standard / Professional to exercise the
 *                     F34 enforcement layer under mixed limits.
 */

import type { PlanCode } from '../src/collections/PlanSubscriptions'

// Values must match src/collections/Users.ts field `roles`.
export type UserRole = 'super-admin' | 'tenant-owner' | 'editor' | 'viewer'

// Values must match Users.tenants[].role.
export type TenantRole = 'owner' | 'admin' | 'editor' | 'viewer'

// Values must match src/collections/Tenants.ts field `status`.
export type TenantStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'suspended'

export interface UserSpec {
  email: string
  firstName: string
  lastName: string
  roles: UserRole[]
  dashboardReady?: boolean
  loadTestEligible?: boolean
}

export interface TenantSpec {
  name: string
  slug: string
  status: TenantStatus
  ownerEmail: string
  membershipRole: TenantRole
  plan: PlanCode
  dashboardReady: boolean
  loadTestEligible?: boolean
}

// First 5 tenants keep the original status variety so functional tests
// that depend on non-active states still work when scaling up.
const BASE_TENANT_STATUSES: TenantStatus[] = [
  'active',
  'active',
  'trialing',
  'past_due',
  'suspended',
]

// Non-TM tier rotation (Starter → Standard → Professional). TM variants
// are reserved for tenants that hit the trademark filing flow in prod;
// leaving them out keeps scale seeding deterministic.
const SCALE_PLAN_CODES: PlanCode[] = [
  'STARTER_NON_TM_USER',
  'STANDARD_NON_TM_USER',
  'PROFESSIONAL_NON_TM_USER',
]

function tenantStatusForIndex(index: number): TenantStatus {
  return index < BASE_TENANT_STATUSES.length
    ? BASE_TENANT_STATUSES[index]
    : 'active'
}

const ADMIN_USERS: UserSpec[] = [
  { email: 'qc-admin-1@primeweb.local', firstName: 'QC', lastName: 'Admin1', roles: ['super-admin'] },
  { email: 'qc-admin-2@primeweb.local', firstName: 'QC', lastName: 'Admin2', roles: ['super-admin'] },
]

const STAFF_USERS: UserSpec[] = [
  // "Staff" concept maps to `editor` — closest existing role. No
  // `tenant-staff` role in current schema.
  { email: 'qc-staff-1@primeweb.local', firstName: 'QC', lastName: 'Editor1', roles: ['editor'] },
  { email: 'qc-staff-2@primeweb.local', firstName: 'QC', lastName: 'Editor2', roles: ['editor'] },
  { email: 'qc-staff-3@primeweb.local', firstName: 'QC', lastName: 'Viewer1', roles: ['viewer'] },
]

export function buildUsers(merchantCount: number): UserSpec[] {
  const owners: UserSpec[] = Array.from({ length: merchantCount }, (_, i) => ({
    email: `qc-owner-${i + 1}@primeweb.local`,
    firstName: 'QC',
    lastName: `Owner${i + 1}`,
    roles: ['tenant-owner'],
    dashboardReady: true,
    // Suspended tenants are retained for functional state tests, but their
    // owners must not enter the VU credential pool because login returns 403.
    loadTestEligible: tenantStatusForIndex(i) !== 'suspended',
  }))
  return [...ADMIN_USERS, ...owners, ...STAFF_USERS]
}

export function buildTenants(merchantCount: number): TenantSpec[] {
  return Array.from({ length: merchantCount }, (_, i) => {
    const idx = i + 1
    const status = tenantStatusForIndex(i)
    return {
      name: `QC Tenant ${idx}`,
      slug: `qc-shop-${idx}`,
      status,
      ownerEmail: `qc-owner-${idx}@primeweb.local`,
      membershipRole: 'owner',
      plan: SCALE_PLAN_CODES[i % SCALE_PLAN_CODES.length],
      dashboardReady: true,
      loadTestEligible: status !== 'suspended',
    }
  })
}

export function buildQcUserData(spec: UserSpec, password: string) {
  return {
    email: spec.email,
    password,
    firstName: spec.firstName,
    lastName: spec.lastName,
    roles: spec.roles,
    has_seen_ai_wizard: spec.dashboardReady === true,
  }
}

export function buildQcTenantData(spec: TenantSpec) {
  return {
    name: spec.name,
    slug: spec.slug,
    status: spec.status,
    onboardingCompleted: spec.dashboardReady,
  }
}

export function buildQcSiteData(tenantId: string | number, tenantName: string) {
  return {
    name: `${tenantName} Site`,
    tenant: tenantId,
    generationStatus: 'completed' as const,
  }
}

/**
 * Reads `QC_MERCHANT_COUNT` env var. Defaults to 5 (original baseline).
 * Clamps to [5, 1000] to keep runs bounded — the QC lane is Neon Free
 * tier and cannot sustain unbounded seed loops.
 */
export function readMerchantCount(): number {
  const raw = process.env.QC_MERCHANT_COUNT
  if (!raw) return 5
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 5) return 5
  if (n > 1000) return 1000
  return Math.floor(n)
}
