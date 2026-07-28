/**
 * TC-GH1432-QC-01 — Dashboard load-test fixtures must not enter onboarding.
 */
import { describe, expect, it } from 'vitest'
import {
  buildQcSiteData,
  buildQcTenantData,
  buildQcUserData,
  buildTenants,
  buildUsers,
  type TenantSpec,
  type UserSpec,
} from '../../../../scripts/qc-fixtures'

describe('[TC-GH1432-QC-01] QC dashboard-ready fixtures', () => {
  it('marks every merchant owner and tenant as onboarding-complete', () => {
    // Arrange
    const merchantCount = 5

    // Act
    const users = buildUsers(merchantCount)
    const tenants = buildTenants(merchantCount)
    const owners = users.filter((user) => user.roles.includes('tenant-owner'))

    // Assert
    expect(owners).toHaveLength(merchantCount)
    expect(owners.every((owner) => owner.dashboardReady === true)).toBe(true)
    expect(tenants.every((tenant) => tenant.dashboardReady === true)).toBe(true)
  })

  it('maps dashboard-ready specs to consistent persisted state', () => {
    // Arrange
    const userSpec: UserSpec = {
      email: 'qc-owner-1@primeweb.local',
      firstName: 'QC',
      lastName: 'Owner1',
      roles: ['tenant-owner'],
      dashboardReady: true,
    }
    const tenantSpec: TenantSpec = {
      name: 'QC Tenant 1',
      slug: 'qc-shop-1',
      status: 'active',
      ownerEmail: userSpec.email,
      membershipRole: 'owner',
      plan: 'STARTER_NON_TM_USER',
      dashboardReady: true,
      loadTestEligible: true,
    }

    // Act
    const userData = buildQcUserData(userSpec, 'test-password')
    const tenantData = buildQcTenantData(tenantSpec)
    const siteData = buildQcSiteData(1, tenantSpec.name)

    // Assert
    expect(userData.has_seen_ai_wizard).toBe(true)
    expect(tenantData.onboardingCompleted).toBe(true)
    expect(siteData.generationStatus).toBe('completed')
  })

  it('keeps an explicitly non-dashboard fixture eligible for onboarding', () => {
    // Arrange
    const userSpec: UserSpec = {
      email: 'qc-onboarding@primeweb.local',
      firstName: 'QC',
      lastName: 'Onboarding',
      roles: ['tenant-owner'],
      dashboardReady: false,
    }
    const tenantSpec: TenantSpec = {
      name: 'QC Onboarding Tenant',
      slug: 'qc-onboarding',
      status: 'active',
      ownerEmail: userSpec.email,
      membershipRole: 'owner',
      plan: 'STARTER_NON_TM_USER',
      dashboardReady: false,
      loadTestEligible: false,
    }

    // Act
    const userData = buildQcUserData(userSpec, 'test-password')
    const tenantData = buildQcTenantData(tenantSpec)

    // Assert
    expect(userData.has_seen_ai_wizard).toBe(false)
    expect(tenantData.onboardingCompleted).toBe(false)
  })

  it('keeps suspended state fixtures out of the VU credential pool', () => {
    // Arrange
    const users = buildUsers(5)
    const tenants = buildTenants(5)

    // Act
    const eligibleTenants = tenants.filter((tenant) => tenant.loadTestEligible)
    const suspendedTenant = tenants.find((tenant) => tenant.status === 'suspended')
    const suspendedOwner = users.find((user) => user.email === suspendedTenant?.ownerEmail)

    // Assert
    expect(eligibleTenants.every((tenant) => tenant.status !== 'suspended')).toBe(true)
    expect(suspendedTenant?.loadTestEligible).toBe(false)
    expect(suspendedOwner?.loadTestEligible).toBe(false)
  })
})
