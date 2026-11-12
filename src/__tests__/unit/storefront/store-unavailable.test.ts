// @vitest-environment node
/**
 * TC-F09.277–280, TC-F09.285 — store "temporarily unavailable" (#2179 item 6).
 * A banned store (tenant suspended) or one whose main subscription lapsed answers 503 + noindex, no reason, no name.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
    tenant: null as Record<string, unknown> | null,
    sub: null as Record<string, unknown> | null,
    site: null as Record<string, unknown> | null,
    siteById: null as Record<string, unknown> | null,
    tenantById: null as Record<string, unknown> | null,
    findByID: vi.fn(),
    revalidateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({ unstable_cache: (fn: (...args: unknown[]) => unknown) => fn, revalidateTag: h.revalidateTag }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        find: vi.fn(async ({ collection, where }: { collection: string; where?: { slug?: { equals?: unknown } } }) => {
            // a slug lookup only matches the tenant with that slug
            if (collection === 'tenants') {
                const match = h.tenant && (!where?.slug || where.slug.equals === h.tenant.slug)
                return { docs: match ? [h.tenant] : [] }
            }
            if (collection === 'plan-subscriptions') return { docs: h.sub ? [h.sub] : [] }
            if (collection === 'sites') return { docs: h.site ? [h.site] : [] }
            return { docs: [] }
        }),
        findByID: h.findByID,
    })),
}))

import { isSiteDocTenantUnavailable, isStoreUnavailable } from '@/lib/storefront/store-availability'
import { isCachedSiteUnavailable } from '@/lib/storefront/cached-store-availability'
import { storeUnavailableLocale } from '@/lib/storefront/store-unavailable'
import { buildStoreUnavailableHtml, STORE_UNAVAILABLE_HEADERS } from '@/lib/maintenance'
import { revalidatePlanSubscriptionAfterChange, revalidatePlanSubscriptionAfterDelete } from '@/lib/cache/revalidate-storefront'
import { GET as slugRedirect } from '@/app/api/slug/redirect/route'
import { GET as domainPrimary } from '@/app/api/domain-primary/route'
import { middleware } from '@/middleware'

const DAY = 24 * 60 * 60 * 1000
const future = () => new Date(Date.now() + 30 * DAY).toISOString()
const past = () => new Date(Date.now() - DAY).toISOString()
const activeSub = () => ({ status: 'active', endsAt: future() })

beforeEach(() => {
    h.tenant = null
    h.sub = null
    h.site = null
    h.siteById = null
    h.tenantById = null
    h.findByID.mockReset()
    h.findByID.mockImplementation(async ({ collection }: { collection: string }) => {
        if (collection === 'sites') {
            if (!h.siteById) throw new Error('Not Found')
            return h.siteById
        }
        return h.tenantById ?? h.tenant
    })
    h.revalidateTag.mockClear()
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('[TC-F09.277] isStoreUnavailable', () => {
    it('is unavailable when banned or the main subscription lapsed', () => {
        expect(isStoreUnavailable('suspended', activeSub())).toBe(true)
        expect(isStoreUnavailable('suspended', null)).toBe(true)
        expect(isStoreUnavailable('active', { status: 'active', endsAt: past() })).toBe(true)
        expect(isStoreUnavailable('active', { status: 'ended', endsAt: future() })).toBe(true)
        expect(isStoreUnavailable('active', { status: 'active', endsAt: future(), canceledAt: past(), canceledImmediately: true })).toBe(true)
    })

    it('stays available with an active subscription or none at all', () => {
        expect(isStoreUnavailable('active', activeSub())).toBe(false)
        expect(isStoreUnavailable('active', null)).toBe(false)
        for (const status of ['trialing', 'past_due', 'cancelled']) expect(isStoreUnavailable(status, activeSub())).toBe(false)
    })
})

describe('[TC-F09.278] unavailable page copy and HTML', () => {
    it('uses BM for a Malay primary language, EN otherwise', () => {
        for (const v of ['ms', 'ms-MY', 'ms_MY', ' MS ']) expect(storeUnavailableLocale(v)).toBe('ms')
        for (const v of ['en', 'vi', '', null, undefined, 'msa']) expect(storeUnavailableLocale(v)).toBe('en')
    })

    it('renders the BA copy, noindex, without any store name', () => {
        // Act
        const en = buildStoreUnavailableHtml('en')
        const ms = buildStoreUnavailableHtml('ms-MY')

        // Assert
        expect(en).toContain('<html lang="en">')
        expect(en).toContain('This store is temporarily unavailable.')
        expect(en).toContain('Please check back later.')
        expect(en).toContain('noindex,nofollow')
        expect(ms).toContain('<html lang="ms">')
        expect(ms).toContain('Kedai ini tidak tersedia buat sementara waktu.')
        expect(ms).toContain('Sila cuba lagi kemudian.')
        expect(STORE_UNAVAILABLE_HEADERS['X-Robots-Tag']).toBe('noindex, nofollow')
        expect(STORE_UNAVAILABLE_HEADERS['Cache-Control']).toBe('no-store')
    })
})

describe('[TC-F09.279] internal lookups report an unavailable store', () => {
    const slugReq = (slug: string) => new NextRequest(`http://localhost/api/slug/redirect?slug=${slug}`)
    const domainReq = (host: string) => new NextRequest(`http://localhost/api/domain-primary?host=${host}`)

    it('slug redirect: expired store → unavailable + site locale, before maintenance', async () => {
        // Arrange
        h.tenant = { id: 7, slug: 'kedai', status: 'active' }
        h.sub = { status: 'active', endsAt: past() }
        h.site = { id: 3, status: 'draft', publishedAt: past(), name: 'Kedai', headerBlock: { primaryLocale: 'ms' } }

        // Act
        const body = await (await slugRedirect(slugReq('kedai'))).json()

        // Assert
        expect(body).toEqual({ redirect: false, unavailable: true, locale: 'ms' })
    })

    it('slug redirect: banned store → unavailable even with an active subscription', async () => {
        h.tenant = { id: 7, slug: 'kedai', status: 'suspended' }
        h.sub = activeSub()

        const body = await (await slugRedirect(slugReq('kedai'))).json()

        expect(body).toEqual({ redirect: false, unavailable: true, locale: 'en' })
    })

    it('slug redirect: available store keeps the old shape', async () => {
        h.tenant = { id: 7, slug: 'kedai', status: 'active' }
        h.sub = activeSub()
        h.site = { id: 3, status: 'published', name: 'Kedai' }

        const body = await (await slugRedirect(slugReq('kedai'))).json()

        expect(body).not.toHaveProperty('unavailable')
        expect(body.redirect).toBe(false)
    })

    it('domain primary: adds unavailable + locale only when the store is unavailable', async () => {
        // Arrange
        const domains = [{ domain: 'shop.my', status: 'active', isPrimary: false }, { domain: 'www.shop.my', status: 'active', isPrimary: true }]
        h.tenant = { id: 7, status: 'suspended', customDomains: domains }

        // Act
        const banned = await (await domainPrimary(domainReq('shop.my'))).json()
        h.tenant = { id: 7, status: 'active', customDomains: domains }
        h.sub = activeSub()
        const live = await (await domainPrimary(domainReq('shop.my'))).json()

        // Assert
        expect(banned).toEqual({ isPrimary: false, primaryDomain: 'www.shop.my', unavailable: true, locale: 'en' })
        expect(live).toEqual({ isPrimary: false, primaryDomain: 'www.shop.my' })
    })
})

describe('[TC-F09.283] site-keyed availability for public APIs', () => {
    it('cached check: banned or expired store of a cached site is unavailable', async () => {
        // Arrange
        h.siteById = { id: 3, tenant: { id: 7, slug: 'kedai', status: 'active' } }

        // Act + Assert
        h.tenant = { id: 7, slug: 'kedai', status: 'suspended' }
        expect(await isCachedSiteUnavailable(3)).toBe(true)
        h.tenant = { id: 7, slug: 'kedai', status: 'active' }
        h.sub = { status: 'active', endsAt: past() }
        expect(await isCachedSiteUnavailable(3)).toBe(true)
        h.sub = activeSub()
        expect(await isCachedSiteUnavailable(3)).toBe(false)
        expect(h.findByID.mock.calls.every(([arg]) => arg.collection === 'sites')).toBe(true)
    })

    it('cached check takes the status from the tenant cache, which ban / unban bust (not the site entry)', async () => {
        // Arrange — the cached site still holds the status from before the change
        h.siteById = { id: 3, tenant: { id: 7, slug: 'kedai', status: 'active' } }
        h.sub = activeSub()

        // Act + Assert — just banned
        h.tenant = { id: 7, slug: 'kedai', status: 'suspended' }
        expect(await isCachedSiteUnavailable(3)).toBe(true)
        // just unbanned while the site entry still says suspended
        h.siteById = { id: 3, tenant: { id: 7, slug: 'kedai', status: 'suspended' } }
        h.tenant = { id: 7, slug: 'kedai', status: 'active' }
        expect(await isCachedSiteUnavailable(3)).toBe(false)
    })

    it('cached check after a slug change: reads this tenant by id when the cached slug misses or belongs to another tenant', async () => {
        // Arrange — the cached site still carries the old slug and the old status
        h.siteById = { id: 3, tenant: { id: 7, slug: 'old-kedai', status: 'active' } }
        h.sub = activeSub()
        h.tenantById = { id: 7, slug: 'kedai', status: 'suspended' }

        // Act + Assert — old slug finds nobody
        h.tenant = null
        expect(await isCachedSiteUnavailable(3)).toBe(true)
        // old slug now taken by another, open tenant
        h.tenant = { id: 9, slug: 'old-kedai', status: 'active' }
        expect(await isCachedSiteUnavailable(3)).toBe(true)
        expect(h.findByID).toHaveBeenLastCalledWith(expect.objectContaining({ collection: 'tenants', id: 7 }))
    })

    it('cached check: unknown site is left to the route (not unavailable)', async () => {
        expect(await isCachedSiteUnavailable(404)).toBe(false)
    })

    it('loaded site row: populated tenant is reused, an id ref reads the tenant once', async () => {
        // Arrange
        const { getPayload } = await import('payload')
        const payload = await getPayload({ config: {} as never })

        // Act
        const populated = await isSiteDocTenantUnavailable(payload, { tenant: { id: 7, status: 'suspended' } })
        const readsBefore = h.findByID.mock.calls.length
        h.tenant = { id: 7, status: 'suspended' }
        const byId = await isSiteDocTenantUnavailable(payload, { tenant: 7 })

        // Assert
        expect(populated).toBe(true)
        expect(readsBefore).toBe(0)
        expect(byId).toBe(true)
        expect(h.findByID).toHaveBeenCalledTimes(1)
        expect(await isSiteDocTenantUnavailable(payload, {})).toBe(false)
    })
})

describe('[TC-F09.280] middleware answers 503 for an unavailable store', () => {
    const platform = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'
    const stubLookup = (body: unknown) => vi.stubGlobal('fetch', vi.fn(async () => Response.json(body)))

    it('subdomain: 503 + noindex, ahead of maintenance', async () => {
        // Arrange
        stubLookup({ redirect: false, unavailable: true, locale: 'ms', maintenance: true, siteName: 'Kedai' })

        // Act
        const res = await middleware(new NextRequest(`https://kedai.${platform}/`, { headers: { host: `kedai.${platform}` } }))

        // Assert
        expect(res.status).toBe(503)
        expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
        expect(res.headers.get('retry-after')).toBe('3600')
        const html = await res.text()
        expect(html).toContain('Kedai ini tidak tersedia buat sementara waktu.')
        expect(html).not.toContain('Kedai is under maintenance')
    })

    it('custom domain: 503 instead of the primary-domain redirect', async () => {
        stubLookup({ isPrimary: false, primaryDomain: 'www.shop.my', unavailable: true, locale: 'en' })

        const res = await middleware(new NextRequest('https://shop.my/products', { headers: { host: 'shop.my' } }))

        expect(res.status).toBe(503)
        expect(await res.text()).toContain('This store is temporarily unavailable.')
    })

    it('fails open when the lookup is down', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))

        const res = await middleware(new NextRequest(`https://kedai.${platform}/`, { headers: { host: `kedai.${platform}` } }))

        expect(res.status).not.toBe(503)
    })
})

describe('[TC-F09.285] plan subscription writes reopen the store at once', () => {
    it('afterChange busts the tag of the new and previous tenant', () => {
        // Act
        revalidatePlanSubscriptionAfterChange({ doc: { tenant: { id: 7 } }, previousDoc: { tenant: 5 } } as never)

        // Assert
        expect(h.revalidateTag.mock.calls.map((c) => c[0])).toEqual(['plan-subscription:7', 'plan-subscription:5'])
    })

    it('afterDelete busts the tenant tag', () => {
        revalidatePlanSubscriptionAfterDelete({ doc: { tenant: 9 } } as never)

        expect(h.revalidateTag.mock.calls.map((c) => c[0])).toEqual(['plan-subscription:9'])
    })
})
