import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mockFind = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET as getRobots } from '@/app/sites/[slug]/robots.txt/route'
import { GET as getSitemap } from '@/app/sites/[slug]/sitemap.xml/route'
import { GET as getLlmsTxt } from '@/app/sites/[slug]/llms.txt/route'

type DiscoveryRoute = typeof getRobots

const DISCOVERY_ROUTES = [
    {
        name: 'robots',
        route: getRobots,
        contentType: 'text/plain',
        bodyFragment: 'Sitemap: https://mycafe.example/sitemap.xml',
        cacheFragment: 's-maxage=600',
    },
    {
        name: 'sitemap',
        route: getSitemap,
        contentType: 'application/xml',
        bodyFragment: '<loc>https://mycafe.example',
        cacheFragment: 'no-store',
    },
    {
        name: 'llms',
        route: getLlmsTxt,
        contentType: 'text/plain; charset=utf-8',
        bodyFragment: '# My Cafe',
        cacheFragment: 'no-store',
    },
] as const

const tenant = {
    id: 'tenant-1',
    slug: 'mycafe',
    customDomains: [{ domain: 'mycafe.example', status: 'active', isPrimary: true }],
}
const site = { id: 'site-1', tenant: 'tenant-1', status: 'published', name: 'My Cafe' }

function request(hostname = ''): NextRequest {
    return {
        headers: { get: (name: string) => name === 'x-tenant-hostname' ? hostname : null },
    } as unknown as NextRequest
}

function queuePublished(route: 'robots' | 'sitemap' | 'llms') {
    mockFind.mockResolvedValueOnce({ docs: [tenant] })
    if (route === 'robots') return
    mockFind
        .mockResolvedValueOnce({ docs: [site] })
        .mockResolvedValueOnce({ docs: route === 'sitemap' ? [{ slug: 'about' }] : [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
}

async function invoke(route: DiscoveryRoute, hostname = 'mycafe.example') {
    return route(request(hostname), { params: Promise.resolve({ slug: 'custom' }) })
}

describe('[TC-F37-03] public discovery route matrix', () => {
    beforeEach(() => {
        mockFind.mockReset()
    })

    it.each(DISCOVERY_ROUTES)(
        'TC-F37-03-44: $name resolves the same published custom-domain storefront',
        async ({ name, route, contentType, bodyFragment, cacheFragment }) => {
            // Arrange
            queuePublished(name)

            // Act
            const response = await invoke(route)
            const body = await response.text()

            // Assert
            expect(response.status).toBe(200)
            expect(response.headers.get('Content-Type')).toBe(contentType)
            expect(response.headers.get('Cache-Control')).toContain(cacheFragment)
            expect(body).toContain(bodyFragment)
            expect(mockFind.mock.calls[0][0].where).toEqual({
                'customDomains.domain': { equals: 'mycafe.example' },
            })
        },
    )

    it.each(DISCOVERY_ROUTES)(
        'TC-F37-03-45: $name returns 404 when custom-domain context is missing',
        async ({ route }) => {
            // Act
            const response = await invoke(route, '')

            // Assert
            expect(response.status).toBe(404)
            expect(mockFind).not.toHaveBeenCalled()
        },
    )

    it.each(DISCOVERY_ROUTES)(
        'TC-F37-03-47: $name rejects a custom domain that is not active',
        async ({ route }) => {
            // Arrange
            mockFind.mockResolvedValueOnce({
                docs: [{
                    ...tenant,
                    customDomains: [{ domain: 'mycafe.example', status: 'pending', isPrimary: true }],
                }],
            })

            // Act
            const response = await invoke(route)

            // Assert
            expect(response.status).toBe(404)
            expect(mockFind).toHaveBeenCalledTimes(1)
        },
    )

    it('TC-F37-03-46: one discovery endpoint failure does not change the other endpoint facts', async () => {
        // Arrange — sitemap fails before tenant resolution completes.
        mockFind.mockRejectedValueOnce(new Error('sitemap database failure'))

        // Act
        const sitemapResponse = await invoke(getSitemap)
        mockFind.mockReset()
        queuePublished('llms')
        const llmsResponse = await invoke(getLlmsTxt)
        mockFind.mockReset()
        queuePublished('robots')
        const robotsResponse = await invoke(getRobots)

        // Assert
        expect(sitemapResponse.status).toBe(500)
        expect(llmsResponse.status).toBe(200)
        expect(robotsResponse.status).toBe(200)
    })
})
