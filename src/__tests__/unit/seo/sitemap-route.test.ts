import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const mockFind = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ find: mockFind })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { GET as getSitemap } from '@/app/sites/[slug]/sitemap.xml/route'

function request(hostname = ''): NextRequest {
    return {
        headers: { get: (name: string) => name === 'x-tenant-hostname' ? hostname : null },
    } as unknown as NextRequest
}

function publishedSite() {
    return { id: 'site-1', tenant: 'tenant-1', status: 'published', name: 'My Cafe' }
}

describe('[TC-F37-03] sitemap public route contract', () => {
    beforeEach(() => {
        mockFind.mockReset()
    })

    it('TC-F37-03-38: returns XML for current public content on a published site', async () => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 'tenant-1', slug: 'mycafe' }] })
            .mockResolvedValueOnce({ docs: [publishedSite()] })
            .mockResolvedValueOnce({ docs: [{ slug: 'about', updatedAt: '2026-07-01T00:00:00.000Z' }] })
            .mockResolvedValueOnce({ docs: [{ slug: 'coffee', updatedAt: '2026-07-02T00:00:00.000Z' }] })
            .mockResolvedValueOnce({ docs: [{ slug: 'news', updatedAt: '2026-07-03T00:00:00.000Z' }] })

        // Act
        const response = await getSitemap(request(), { params: Promise.resolve({ slug: 'mycafe' }) })
        const body = await response.text()

        // Assert
        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toBe('application/xml')
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(body).toContain('<loc>https://mycafe.primeweb.app/about</loc>')
        expect(body).toContain('<loc>https://mycafe.primeweb.app/products/coffee</loc>')
        expect(body).toContain('<loc>https://mycafe.primeweb.app/blog/news</loc>')
        expect(body).not.toContain('/checkout')
        expect(body).not.toContain('/orders')
        expect(body).not.toContain('/admin')
    })

    it('TC-F37-03-39: scopes public records and rejects or encodes unsafe slugs', async () => {
        // Arrange
        mockFind
            .mockResolvedValueOnce({ docs: [{ id: 'tenant-1', slug: 'mycafe' }] })
            .mockResolvedValueOnce({ docs: [publishedSite()] })
            .mockResolvedValueOnce({ docs: [{ slug: '../admin' }] })
            .mockResolvedValueOnce({ docs: [{ slug: 'summer sale' }] })
            .mockResolvedValueOnce({ docs: [{ slug: 'news#today' }, { slug: 'nested/news' }] })

        // Act
        const response = await getSitemap(request(), { params: Promise.resolve({ slug: 'mycafe' }) })
        const body = await response.text()

        // Assert
        const siteCall = mockFind.mock.calls[1][0]
        const pagesCall = mockFind.mock.calls[2][0]
        const productsCall = mockFind.mock.calls[3][0]
        const blogsCall = mockFind.mock.calls[4][0]
        expect(siteCall.sort).toBe('createdAt')
        expect(JSON.stringify(pagesCall.where)).toContain('"site":{"equals":"site-1"}')
        expect(JSON.stringify(pagesCall.where)).toContain('"seo.noIndex":{"not_equals":true}')
        expect(JSON.stringify(pagesCall.where)).toContain('"deletedAt":{"exists":false}')
        expect(JSON.stringify(productsCall.where)).toContain('"site":{"equals":"site-1"}')
        expect(JSON.stringify(productsCall.where)).toContain('"deletedAt":{"exists":false}')
        expect(JSON.stringify(blogsCall.where)).toContain('"site":{"equals":"site-1"}')
        expect(JSON.stringify(blogsCall.where)).not.toContain('"tenant":{"equals":"tenant-1"}')
        expect(body).not.toContain('/../admin')
        expect(body).toContain('/products/summer%20sale')
        expect(body).toContain('/blog/news%23today')
        expect(body).not.toContain('/blog/nested/news')
        expect(pagesCall).not.toHaveProperty('limit')
        expect(productsCall).not.toHaveProperty('limit')
        expect(blogsCall).not.toHaveProperty('limit')
        expect(pagesCall.pagination).toBe(false)
        expect(productsCall.pagination).toBe(false)
        expect(blogsCall.pagination).toBe(false)
        expect(pagesCall.select).toEqual({ slug: true, updatedAt: true, isHomepage: true })
        expect(productsCall.select).toEqual({ slug: true, updatedAt: true })
        expect(blogsCall.select).toEqual({ slug: true, updatedAt: true })
    })

    it('TC-F37-03-40: resolves custom-domain sitemap URLs from the same tenant', async () => {
        // Arrange
        const tenant = {
            id: 'tenant-1',
            slug: 'mycafe',
            customDomains: [{ domain: 'mycafe.example', status: 'active', isPrimary: true }],
        }
        mockFind
            .mockResolvedValueOnce({ docs: [tenant] })
            .mockResolvedValueOnce({ docs: [publishedSite()] })
            .mockResolvedValueOnce({ docs: [{ slug: 'about' }] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })

        // Act
        const response = await getSitemap(request('mycafe.example'), {
            params: Promise.resolve({ slug: 'custom' }),
        })
        const body = await response.text()

        // Assert
        expect(response.status).toBe(200)
        expect(mockFind.mock.calls[0][0].where).toEqual({
            'customDomains.domain': { equals: 'mycafe.example' },
        })
        expect(body).toContain('<loc>https://mycafe.example/about</loc>')
        expect(body).not.toContain('primeweb.app')
    })

    it.each([
        ['missing tenant', [{ docs: [] }]],
        ['unpublished or missing site', [{ docs: [{ id: 'tenant-1', slug: 'mycafe' }] }, { docs: [] }]],
    ])('TC-F37-03-41: returns 404 for %s', async (_label, results) => {
        // Arrange
        results.forEach(result => mockFind.mockResolvedValueOnce(result))

        // Act
        const response = await getSitemap(request(), { params: Promise.resolve({ slug: 'mycafe' }) })

        // Assert
        expect(response.status).toBe(404)
    })
})
