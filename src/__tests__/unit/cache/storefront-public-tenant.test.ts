/**
 * TC-PERF-061 — storefront page reads never hand a block the whole tenant row through `page.site.tenant`.
 * Payload applies `populate` to the first level of relations only, so a page read at depth 2-3 still carried the
 * tenant's payment / courier fields; withPublicSiteTenant keeps the public ones.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }))

import { withPublicSiteTenant, withPublicSiteTenants } from '@/lib/cache/tenant'

const fullTenant = {
    id: 1,
    name: 'Kedai',
    slug: 'kedai',
    customDomains: [],
    status: 'active',
    xenditSecretKey: 'xnd_secret',
    xenditCallbackToken: 'cb',
    easyParcelIntegration: { accessToken: 'ep' },
}

describe('withPublicSiteTenant [TC-PERF-061]', () => {
    it('keeps only the public tenant fields on a populated page.site.tenant', () => {
        // Arrange
        const page = { id: 9, title: 'Home', site: { id: 1, name: 'Site', tenant: fullTenant } }

        // Act
        const out = withPublicSiteTenant(page)

        // Assert
        expect(out.site.tenant).toEqual({ id: 1, name: 'Kedai', slug: 'kedai', customDomains: [], status: 'active' })
        expect(JSON.stringify(out)).not.toMatch(/xendit|easyParcel/i)
        expect(out.site.name).toBe('Site')
        expect(page.site.tenant).toBe(fullTenant)
    })

    it('leaves ids, missing sites and nulls as they are', () => {
        // Arrange
        const byId = { id: 2, site: { id: 1, tenant: 1 } }
        const noSite = { id: 3, site: 5 }

        // Act + Assert
        expect(withPublicSiteTenant(byId)).toBe(byId)
        expect(withPublicSiteTenant(noSite)).toBe(noSite)
        expect(withPublicSiteTenant(null)).toBeNull()
        expect(withPublicSiteTenants([byId, noSite])).toEqual([byId, noSite])
    })
})
