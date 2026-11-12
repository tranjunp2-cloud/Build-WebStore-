/**
 * Storefront identity cache — TC-PERF-061, TC-PERF-065, TC-PERF-066.
 *   061  site / page loaders populate tenants with public fields only (no payment / courier secrets), no COUNT
 *   065  a site write busts that site + its shop's site entry, a tenant write that shop's slug / domains / site;
 *        the all-shops `tenants` tag is never busted by a write; the old-slug index only when slugs changed
 *   066  /api/slug/redirect (middleware, every storefront request) answers from the cached lookups
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
    find: vi.fn(),
    revalidateTag: vi.fn(),
    cacheCalls: [] as Array<{ keys: unknown; options: { tags?: string[] } }>,
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find: h.find })) }))
vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...args: unknown[]) => unknown, keys: unknown, options: { tags?: string[] }) => {
        h.cacheCalls.push({ keys, options })
        return fn
    },
    revalidateTag: h.revalidateTag,
}))

import {
    STOREFRONT_POPULATE,
    getCachedNavigationPages,
    getCachedSiteByTenant,
    getCachedTenantBySlug,
    getCachedTenantByDomain,
    getCachedVisitorPage,
} from '@/lib/cache/tenant'
import {
    revalidatePageAfterChange,
    revalidateSiteAfterChange,
    revalidateSiteStorefront,
    revalidateTenantAfterChange,
    tenantStorefrontTags,
} from '@/lib/cache/revalidate-storefront'
import { GET as slugRedirect } from '@/app/api/slug/redirect/route'
import { NextRequest } from 'next/server'

const busted = () => h.revalidateTag.mock.calls.map(([tag]) => tag).sort()

beforeEach(() => {
    vi.clearAllMocks()
    h.find.mockReset()
    h.cacheCalls.length = 0
})

describe('storefront loaders [TC-PERF-061]', () => {
    it('populate tenants with public fields only and never run a COUNT', async () => {
        // Arrange
        h.find.mockResolvedValue({ docs: [{ id: 1 }] })

        // Act
        await getCachedSiteByTenant('7')
        await getCachedVisitorPage('3', '/')
        await getCachedNavigationPages('3')
        await getCachedTenantBySlug('kedai')
        await getCachedTenantByDomain('kedai.my')

        // Assert
        const calls = h.find.mock.calls.map(([args]) => args)
        for (const args of calls) expect(args.pagination).toBe(false)
        for (const args of calls.slice(0, 3)) expect(args.populate).toBe(STOREFRONT_POPULATE)
        expect(Object.keys(STOREFRONT_POPULATE.tenants).sort()).toEqual(['customDomains', 'name', 'slug', 'status'])
        expect(JSON.stringify(STOREFRONT_POPULATE)).not.toMatch(/xendit|token|secret|easyParcel/i)
        expect(STOREFRONT_POPULATE.users).toEqual({ firstName: true, lastName: true })
    })

    it('tags each identity lookup with its own shop key (+ the manual all-shops tag)', async () => {
        // Arrange
        h.find.mockResolvedValue({ docs: [] })

        // Act
        await getCachedTenantBySlug('kedai')
        await getCachedTenantByDomain('kedai.my')
        await getCachedSiteByTenant('7')

        // Assert
        expect(h.cacheCalls.map((c) => c.options.tags)).toEqual([
            ['tenants', 'tenant-slug:kedai'],
            ['tenants', 'tenant-domain:kedai.my'],
            ['tenants', 'site-by-tenant-7'],
        ])
    })
})

describe('write-time busting [TC-PERF-065]', () => {
    it('a site write busts that site and its shop only', () => {
        // Act
        revalidateSiteAfterChange({ doc: { id: 3, tenant: { id: 7 } }, previousDoc: { id: 3, tenant: 7 } } as never)

        // Assert
        expect(busted()).toEqual(['site-3', 'site-by-tenant-7'])
    })

    it('a site moved to another tenant busts both shops\' site entries', () => {
        // Act
        revalidateSiteAfterChange({ doc: { id: 3, tenant: 8 }, previousDoc: { id: 3, tenant: 7 } } as never)

        // Assert
        expect(busted()).toEqual(['site-3', 'site-by-tenant-7', 'site-by-tenant-8'])
    })

    it('an unknown tenant falls back to the all-shops tag rather than a stale site', () => {
        // Act
        revalidateSiteStorefront(3, null)

        // Assert
        expect(busted()).toEqual(['site-3', 'tenants'])
    })

    it('a page write busts only its site', () => {
        // Act
        revalidatePageAfterChange({ doc: { id: 1, site: { id: 3 } } } as never)

        // Assert
        expect(busted()).toEqual(['site-3'])
    })

    it('a tenant settings write busts its slug, domains and site entry — not the old-slug index, not every shop', () => {
        // Arrange
        const doc = { id: 7, slug: 'kedai', customDomains: [{ domain: 'kedai.my' }], previousSlugs: [] }

        // Act
        revalidateTenantAfterChange({ doc, previousDoc: { ...doc } } as never)

        // Assert
        expect(busted()).toEqual(['site-by-tenant-7', 'tenant-domain:kedai.my', 'tenant-slug:kedai'])
    })

    it('a slug change also busts the old slug and the old-slug index', () => {
        // Act
        const tags = tenantStorefrontTags(
            { id: 7, slug: 'kedai-baru', customDomains: [], previousSlugs: [{ slug: 'kedai' }] },
            { id: 7, slug: 'kedai', customDomains: [{ domain: 'old.my' }], previousSlugs: [] },
        )

        // Assert
        expect(tags.sort()).toEqual(['site-by-tenant-7', 'tenant-domain:old.my', 'tenant-previous-slugs', 'tenant-slug:kedai', 'tenant-slug:kedai-baru'])
    })
})

describe('GET /api/slug/redirect [TC-PERF-066]', () => {
    const call = (slug: string) => slugRedirect(new NextRequest(`http://localhost/api/slug/redirect?slug=${slug}`))

    it('answers a live shop from the cached tenant + site lookups (maintenance when unpublished after a publish)', async () => {
        // Arrange
        h.find.mockImplementation(async ({ collection }: { collection: string }) => collection === 'tenants'
            ? { docs: [{ id: 7, slug: 'kedai' }] }
            : collection === 'plan-subscriptions'
                ? { docs: [] }
                : { docs: [{ id: 3, status: 'draft', publishedAt: '2026-10-01T00:00:00.000Z', name: 'Kedai' }] })

        // Act
        const body = await (await call('kedai')).json()

        // Assert
        expect(body).toEqual({ redirect: false, maintenance: true, siteName: 'Kedai' })
        // #2179: the availability gate reads the cached main subscription too (no subscription → available)
        expect(h.cacheCalls.map((c) => c.keys)).toEqual([['tenant-by-slug', 'kedai'], ['main-subscription-by-tenant', '7'], ['site-by-tenant-7']])
    })

    it('redirects an old slug to the current one while it has not expired', async () => {
        // Arrange
        h.find.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => 'previousSlugs.slug' in where
            ? { docs: [{ id: 7, slug: 'kedai-baru', previousSlugs: [{ slug: 'kedai', expiresAt: '2999-01-01T00:00:00.000Z' }] }] }
            : { docs: [] })

        // Act
        const body = await (await call('kedai')).json()

        // Assert
        expect(body).toEqual({ redirect: true, newSlug: 'kedai-baru' })
        const previous = h.find.mock.calls.map(([args]) => args).find((args) => 'previousSlugs.slug' in args.where)
        expect(previous).toMatchObject({ pagination: false, depth: 0, select: { slug: true, previousSlugs: true } })
    })
})
