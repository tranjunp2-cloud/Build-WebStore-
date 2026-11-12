/**
 * TC-F09.283 / TC-F09.284 — public write APIs of an unavailable store (#2179 item 6), real availability gate.
 * subscribe / contact-submit answer like an unknown site; calculate-shipping refuses with 403 STORE_UNAVAILABLE.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
    site: null as Record<string, unknown> | null,
    sub: null as Record<string, unknown> | null,
    create: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 5, resetAt: Date.now() + 60_000 })) }))
vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({
        findByID: vi.fn(async () => h.site),
        find: vi.fn(async ({ collection }: { collection: string }) => collection === 'plan-subscriptions'
            ? { docs: h.sub ? [h.sub] : [] }
            : { docs: [] }),
        create: h.create,
        sendEmail: vi.fn(),
    })),
}))

import { POST as subscribe } from '@/app/api/subscribe/route'
import { POST as contactSubmit } from '@/app/api/contact-submit/route'
import { POST as calculateShipping } from '@/app/api/orders/calculate-shipping/route'

const json = (url: string, body: unknown) => new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-real-ip': '203.0.113.9' },
    body: JSON.stringify(body),
})
const banned = { id: 1, name: 'Kedai', tenant: { id: 7, status: 'suspended' }, shippingConfig: {} }
const expired = { id: 1, name: 'Kedai', tenant: { id: 7, status: 'active' }, shippingConfig: {} }

describe('[TC-F09.283] public write APIs of an unavailable store', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        h.sub = null
    })

    it('subscribe: banned store → 400 Invalid site, nothing stored', async () => {
        // Arrange
        h.site = banned

        // Act
        const res = await subscribe(json('http://localhost/api/subscribe', { email: 'a@b.my', siteId: '1' }))

        // Assert
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: 'Invalid site' })
        expect(h.create).not.toHaveBeenCalled()
    })

    it('contact-submit: expired main subscription → 400 Invalid site, nothing stored', async () => {
        // Arrange
        h.site = expired
        h.sub = { status: 'active', endsAt: '2020-01-01T00:00:00.000Z' }

        // Act
        const res = await contactSubmit(json('http://localhost/api/contact-submit', {
            name: 'John Doe', email: 'john@example.com', phone: '0123456789', subject: 'Hello', message: 'A message for the shop', siteId: '1', website: '',
        }))

        // Assert
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: 'Invalid site' })
        expect(h.create).not.toHaveBeenCalled()
    })
})

describe('[TC-F09.284] calculate-shipping of an unavailable store', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        h.sub = null
    })

    it('banned store → 403 STORE_UNAVAILABLE (no quote with its courier token)', async () => {
        h.site = banned

        const res = await calculateShipping(json('http://localhost/api/orders/calculate-shipping', { siteId: '1', state: 'Selangor', subtotalSen: 5000 }))

        expect(res.status).toBe(403)
        expect((await res.json()).error.code).toBe('STORE_UNAVAILABLE')
    })

    it('available store is quoted as before', async () => {
        h.site = { ...expired }
        h.sub = { status: 'active', endsAt: '2099-01-01T00:00:00.000Z' }

        const res = await calculateShipping(json('http://localhost/api/orders/calculate-shipping', { siteId: '1', state: 'Selangor', subtotalSen: 5000 }))

        expect(res.status).toBe(200)
    })
})
