/**
 * TC-AICP-351 — creating a blog post de-duplicates its slug against trashed posts too: Blogs has `trash: true`, so a
 * post in the trash (e.g. an undone AI post) can be restored and must not come back with a twin slug.
 * Real: saveBlogForUser (lib/blog/save-blog). Faked: Payload (find honours `trash` like Payload: trashed docs only
 * with `trash: true`), the plan check.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn(), findByID: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find: mocks.find, create: mocks.create, findByID: mocks.findByID })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({ plan: 'PROFESSIONAL_TM_USER' }),
    canUse: vi.fn().mockResolvedValue(true),
}))

import { saveBlogForUser } from '@/lib/blog/save-blog'

type FindArgs = { collection: string; where?: { slug?: { equals?: string } }; trash?: boolean }
const user = { id: '1', email: 'owner@shop.test', tenants: [{ tenant: '7', role: 'owner', status: 'active' }] }

beforeEach(() => {
    vi.clearAllMocks()
    mocks.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new', ...data }))
    mocks.find.mockImplementation(async (args: FindArgs) => {
        if (args.collection === 'sites') return { docs: [{ id: 3 }], totalDocs: 1 }
        // 'spring-sale' belongs to a post in the trash: Payload returns it only with trash: true
        const trashed = args.collection === 'blogs' && args.where?.slug?.equals === 'spring-sale'
        return trashed && args.trash === true ? { docs: [{ id: 9, deletedAt: '2026-10-20T00:00:00Z' }], totalDocs: 1 } : { docs: [], totalDocs: 0 }
    })
})

describe('saveBlogForUser slug de-dup includes the trash [TC-AICP-351]', () => {
    it('[TC-AICP-351] suffixes a slug a trashed post still holds', async () => {
        // Act
        await saveBlogForUser(user, { title: 'Spring sale', slug: 'spring-sale', content: '<p>x</p>', status: 'draft' })

        // Assert
        expect(mocks.create).toHaveBeenCalledTimes(1)
        expect(mocks.create.mock.calls[0]![0].data.slug).toBe('spring-sale-1')
        const slugChecks = mocks.find.mock.calls.map(([args]) => args as FindArgs).filter((args) => args.collection === 'blogs')
        expect(slugChecks.every((args) => args.trash === true)).toBe(true)
    })

    it('[TC-AICP-351] keeps a free slug as it is', async () => {
        // Act
        await saveBlogForUser(user, { title: 'Autumn', slug: 'autumn', content: '<p>x</p>', status: 'draft' })

        // Assert
        expect(mocks.create.mock.calls[0]![0].data.slug).toBe('autumn')
    })
})
