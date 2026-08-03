/**
 * @fileoverview API regression for the persisted US-F37-01 Business Data score.
 * TC-IDs: TC-F37-01-10, TC-F37-04-01, TC-F37-04-02
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    findByID: vi.fn(),
    find: vi.fn(),
    getCurrentUser: vi.fn(),
    checkRateLimit: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        findByID: mocks.findByID,
        find: mocks.find,
    }),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: mocks.checkRateLimit,
}))

import { GET } from '@/app/api/sites/[siteId]/local-seo-score/route'

const ownedSite = {
    id: 42,
    tenant: 'tenant-1',
    name: 'Kedai Kopi Prime',
    domain: 'kedai.example.com',
    status: 'published',
    contactInfo: {
        phone: '+60 12-345 6789',
    },
    localBusiness: {
        streetAddress: '12 Jalan Ampang',
        city: 'Kuala Lumpur',
        postcode: '50450',
        country: 'MY',
        businessCategory: 'foodEstablishment',
        openingHours: [{
            dayOfWeek: 'Mo',
            opens: '09:00',
            closes: '17:00',
            isClosed: false,
        }],
    },
    seo: { metaDescription: 'Fresh coffee in Kuala Lumpur.' },
}

function makeRequest(): NextRequest {
    return new NextRequest('http://localhost/api/sites/42/local-seo-score')
}

describe('[TC-F37-01-10] GET /api/sites/[siteId]/local-seo-score — persisted Business Data', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getCurrentUser.mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: 'tenant-1' }],
        })
        mocks.checkRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 29,
            resetAt: Date.now() + 60_000,
        })
        mocks.findByID.mockResolvedValue(ownedSite)
        mocks.find.mockResolvedValue({ docs: [] })
    })

    it('returns exact 7/8/5 points from complete persisted fields without changing the legacy total', async () => {
        // Arrange
        const req = makeRequest()

        // Act
        const response = await GET(req, { params: Promise.resolve({ siteId: '42' }) })
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.minimalBusinessData).toEqual({
            score: 20,
            maxScore: 20,
            breakdown: { name: 7, address: 8, phone: 5 },
        })
        expect(body.score).toBe(80)
        expect(body.breakdown.businessData).toBe(35)
    })

    it('returns 12 when persisted name and phone exist but the structured address is incomplete', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue({
            ...ownedSite,
            localBusiness: {
                ...ownedSite.localBusiness,
                postcode: null,
            },
        })

        // Act
        const response = await GET(makeRequest(), { params: Promise.resolve({ siteId: '42' }) })
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.minimalBusinessData).toEqual({
            score: 12,
            maxScore: 20,
            breakdown: { name: 7, address: 0, phone: 5 },
        })
    })

    it('[TC-F37-04-01] rejects unauthenticated requests before reading a site', async () => {
        // Arrange
        mocks.getCurrentUser.mockResolvedValue(null)

        // Act
        const response = await GET(makeRequest(), { params: Promise.resolve({ siteId: '42' }) })

        // Assert
        expect(response.status).toBe(401)
        expect(mocks.findByID).not.toHaveBeenCalled()
    })

    it('[TC-F37-04-02] rejects a site outside the current user tenant', async () => {
        // Arrange
        mocks.findByID.mockResolvedValue({
            ...ownedSite,
            tenant: 'tenant-2',
        })

        // Act
        const response = await GET(makeRequest(), { params: Promise.resolve({ siteId: '42' }) })

        // Assert
        expect(response.status).toBe(403)
        expect(mocks.find).not.toHaveBeenCalled()
    })
})
