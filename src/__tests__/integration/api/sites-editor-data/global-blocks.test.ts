/**
 * Integration Tests — GET /api/sites/[siteId]/editor-data → globalBlocks in response
 * Coverage Map:
 *   TC-F10-GBL-034 → GET after seeding globalBlocks → response.site has matching globalBlocks shape
 *
 * Strategy: mock getPayload + withAuth; seed site fixture with globalBlocks;
 * call GET() directly; assert response JSON shape.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Top-level mocks — vi.fn() created inside factory to avoid hoisting issues ──

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        findByID: vi.fn(),
        find: vi.fn(),
    }),
}))

vi.mock('@/lib/auth', () => {
    const MOCK_USER = {
        id: 'user-1',
        email: 'owner@example.com',
        tenants: [{ tenant: { id: 'tenant-1' }, role: 'owner' }],
    }
    return {
        getCurrentUser: vi.fn(),
        withAuth: vi.fn(
            (handler: (user: unknown, req: unknown, ctx: unknown) => unknown) =>
                (req: unknown, ctx: unknown) =>
                    handler(MOCK_USER, req, ctx),
        ),
    }
})

vi.mock('@/blocks/social-widget/config', () => ({
    normalizeSocialWidgetConfig: vi.fn((b: unknown) => b),
}))

import { GET } from '@/app/api/sites/[siteId]/editor-data/route'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

const GLOBAL_BLOCKS_FIXTURE = {
    cartWidget: { blockType: 'cartWidget', variant: 'floating', showCount: true },
    whatsappButton: { blockType: 'whatsapp-button', phoneNumber: '+60123456789' },
    socialWidget: null,
}

const MOCK_PAGE = {
    id: 1,
    title: 'Homepage',
    layout: [{ blockType: 'hero' }],
    _status: 'published',
    updatedAt: '2026-05-19T00:00:00.000Z',
    site: { id: 42 },
    isHomepage: true,
}

function makeGetRequest(siteId = '42'): NextRequest {
    return new NextRequest(`http://localhost/api/sites/${siteId}/editor-data`, {
        method: 'GET',
    })
}

describe('GET /api/sites/[siteId]/editor-data — globalBlocks', () => {
    let mockPayloadInstance: {
        findByID: ReturnType<typeof vi.fn>
        find: ReturnType<typeof vi.fn>
    }

    beforeEach(() => {
        vi.clearAllMocks()

        mockPayloadInstance = {
            findByID: vi.fn().mockResolvedValue({
                id: 42,
                name: 'Test Site',
                tenant: { id: 'tenant-1', slug: 'test-tenant', customDomains: [] },
                globalBlocks: GLOBAL_BLOCKS_FIXTURE,
                theme: {},
                status: 'published',
                siteType: 'business',
                locale: 'ms',
                contactInfo: {},
                socialLinks: {},
                branding: {},
                seo: {},
                headerBlock: null,
                footerBlock: null,
                shippingConfig: {},
                publishedAt: null,
                domain: null,
            }),
            find: vi.fn().mockResolvedValue({ docs: [MOCK_PAGE] }),
        }
        mockGetPayload.mockResolvedValue(mockPayloadInstance as never)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // ── TC-F10-GBL-034 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-034] GET editor-data returns globalBlocks matching seeded fixture shape', async () => {
        // Arrange
        const req = makeGetRequest('42')

        // Act
        const res = await GET(req, { params: Promise.resolve({ siteId: '42' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.site).toBeDefined()
        expect(body.site.globalBlocks).toBeDefined()
        expect(body.site.globalBlocks.cartWidget).toEqual(GLOBAL_BLOCKS_FIXTURE.cartWidget)
        expect(body.site.globalBlocks.whatsappButton).toEqual(GLOBAL_BLOCKS_FIXTURE.whatsappButton)
        expect(body.site.globalBlocks.socialWidget).toBeNull()
    })

    it('GET editor-data returns null for globalBlocks when site has none', async () => {
        // Arrange — no globalBlocks on site
        mockPayloadInstance.findByID.mockResolvedValue({
            id: 42,
            name: 'Test Site',
            tenant: { id: 'tenant-1', slug: 'test-tenant', customDomains: [] },
            globalBlocks: null,
            theme: {},
            status: 'published',
            siteType: 'business',
            locale: 'ms',
            contactInfo: {},
            socialLinks: {},
            branding: {},
            seo: {},
            headerBlock: null,
            footerBlock: null,
            shippingConfig: {},
            publishedAt: null,
            domain: null,
        })

        // Act
        const res = await GET(makeGetRequest('42'), { params: Promise.resolve({ siteId: '42' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.site.globalBlocks).toBeNull()
    })
})
