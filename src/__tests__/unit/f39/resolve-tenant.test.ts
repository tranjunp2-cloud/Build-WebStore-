import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    resolveTenant,
    type TenantLookup,
} from '@/lib/admin/live-errors/resolve-tenant'

const tenant = {
    id: 42,
    slug: 'coffee-shop',
    name: 'Coffee Shop',
    customDomains: [
        { domain: 'coffee.example', status: 'active' },
        { domain: 'pending.example', status: 'pending' },
    ],
}

const lookup: TenantLookup = {
    bySlug: vi.fn(async slug => slug === tenant.slug ? tenant : null),
    byDomain: vi.fn(async domain =>
        ['coffee.example', 'pending.example'].includes(domain) ? tenant : null,
    ),
}

afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
})

// ── TC-F39-AC06–08: Honest tenant attribution ──────────────────────────────
describe('[TC-F39-AC06–08] tenant resolution', () => {
    it('resolves a normalized platform subdomain by tenant slug', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_PLATFORM_DOMAIN', 'primeweb.app')

        // Act
        const result = await resolveTenant('Coffee-Shop.PrimeWeb.App.:443', lookup)

        // Assert
        expect(result).toEqual({ id: '42', slug: 'coffee-shop', name: 'Coffee Shop' })
        expect(lookup.bySlug).toHaveBeenCalledWith('coffee-shop')
        expect(lookup.byDomain).not.toHaveBeenCalled()
    })

    it('resolves only active custom domains', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_PLATFORM_DOMAIN', 'primeweb.app')

        // Act
        const active = await resolveTenant('coffee.example', lookup)
        const pending = await resolveTenant('pending.example', lookup)

        // Assert
        expect(active).toEqual({ id: '42', slug: 'coffee-shop', name: 'Coffee Shop' })
        expect(pending).toBeNull()
    })

    it('returns null instead of inferring a tenant for missing or unmatched hosts', async () => {
        // Arrange
        vi.stubEnv('NEXT_PUBLIC_PLATFORM_DOMAIN', 'primeweb.app')

        // Act
        const missing = await resolveTenant(null, lookup)
        const unmatched = await resolveTenant('unknown.example', lookup)
        const platformApex = await resolveTenant('primeweb.app', lookup)

        // Assert
        expect(missing).toBeNull()
        expect(unmatched).toBeNull()
        expect(platformApex).toBeNull()
    })
})
