import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import { POST } from '@/app/api/e2e/ensure-test-user/route'

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

describe('POST /api/e2e/ensure-test-user', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.E2E_SETUP_SECRET = 'setup-secret'
        process.env.APP_ENV = 'staging'
    })

    it('provisions an active FREEMIUM subscription for an isolated benchmark tenant', async () => {
        const payload = {
            find: vi.fn().mockImplementation(async ({ collection }: { collection: string }) => {
                if (collection === 'tenants') return { docs: [{ id: 42 }] }
                if (collection === 'plan-subscriptions') return { docs: [] }
                if (collection === 'users') return { docs: [] }
                return { docs: [] }
            }),
            create: vi.fn().mockImplementation(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => ({
                id: collection === 'users' ? 84 : 21,
                ...data,
            })),
            update: vi.fn(),
        }
        vi.mocked(getPayload).mockResolvedValue(payload as never)

        const response = await POST(new NextRequest('http://localhost/api/e2e/ensure-test-user', {
            method: 'POST',
            headers: { Authorization: 'Bearer setup-secret', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'benchmark@example.com',
                password: 'password123',
                tenantSlug: 'e2e-generation-run',
            }),
        }))

        expect(response.status).toBe(200)
        expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'plan-subscriptions',
            overrideAccess: true,
            data: expect.objectContaining({
                tenant: 42,
                name: 'main',
                plan: 'FREEMIUM',
                status: 'active',
                packCode: 'FREEMIUM',
            }),
        }))
    })
})
