/**
 * TC-PERF-138 — routes that load a site with access off check the caller belongs to its tenant. /api/seo/fix and
 * /api/seo/sitemap took any site id: a member of one shop rewrote another shop's page SEO and listed its pages.
 */
import { describe, expect, it } from 'vitest'
import { isMemberOfSiteTenant } from '@/lib/auth/site-tenant-access'

const member = { roles: ['tenant-owner'], tenants: [{ tenant: { id: 5 } }, { tenant: 7 }] }

describe('isMemberOfSiteTenant [TC-PERF-138]', () => {
    it('allows a member of the site tenant (populated or id)', () => {
        expect(isMemberOfSiteTenant(member, { tenant: 5 })).toBe(true)
        expect(isMemberOfSiteTenant(member, { tenant: { id: '7' } })).toBe(true)
    })

    it('refuses another tenant, a site without tenant, or no caller', () => {
        expect(isMemberOfSiteTenant(member, { tenant: 1 })).toBe(false)
        expect(isMemberOfSiteTenant(member, { tenant: null })).toBe(false)
        expect(isMemberOfSiteTenant(null, { tenant: 5 })).toBe(false)
    })

    it('allows a super-admin on any site', () => {
        expect(isMemberOfSiteTenant({ roles: ['super-admin'], tenants: [] }, { tenant: 1 })).toBe(true)
    })
})
