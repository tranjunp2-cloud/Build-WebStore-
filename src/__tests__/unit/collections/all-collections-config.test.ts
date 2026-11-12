import { describe, it, expect, vi } from 'vitest'

// Mock external deps used by collections
vi.mock('@/lib/ai/seo-queue', () => ({ queueSEOAutoGeneration: vi.fn() }))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1',
        plan: 'PROFESSIONAL_TM_USER',
        status: 'active',
        startDate: '2026-01-01T00:00:00.000Z',
    }),
    isSubscriptionActive: vi.fn().mockReturnValue(true),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    reduceUsage: vi.fn().mockResolvedValue(undefined),
    getConsumed: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))

import { Users } from '@/collections/Users'
import { Pages } from '@/collections/Pages'
import { Sites } from '@/collections/Sites'
import { Tenants } from '@/collections/Tenants'
import { Categories } from '@/collections/Categories'
import { Blogs } from '@/collections/Blogs'
import { Templates, TEMPLATE_CATEGORY_OPTIONS } from '@/collections/Templates'
import { Subscriptions } from '@/collections/Subscriptions'
import { Analytics } from '@/collections/Analytics'
import { SEOMetaJobs } from '@/collections/SEOMetaJobs'
import { BlogCategories } from '@/collections/BlogCategories'
import { Media } from '@/collections/Media'
import { PushSubscriptions } from '@/collections/PushSubscriptions'

// ─── All Collections Config Validation ────────────────────────────────
// Tests structure, access control, and field presence for every collection.

function getFieldNames(collection: any): string[] {
    return collection.fields?.filter((f: any) => f.name).map((f: any) => f.name) ?? []
}

function testAccess(label: string, accessFn: any, scenarios: Array<{ desc: string; req: any; expected: any }>) {
    for (const { desc, req, expected } of scenarios) {
        it(`${label}: ${desc}`, async () => {
            const result = await Promise.resolve(accessFn({ req } as any))
            if (typeof expected === 'boolean') {
                expect(Boolean(result)).toBe(expected)
            } else {
                expect(result).toBeDefined()
            }
        })
    }
}

const noUser = { user: null }
const normalUser = { user: { id: 1, roles: ['tenant-owner'], tenants: [{ tenant: 'tenant-1' }] } }
const superAdmin = { user: { id: 1, roles: ['super-admin'], tenants: [] } }

// ─── Users ────────────────────────────────────────────────────────────
describe('Users collection [TC-F02]', () => {
    it('has slug "users"', () => expect(Users.slug).toBe('users'))
    it('uses "email" as admin title', () => expect(Users.admin?.useAsTitle).toBe('email'))
    it('has auth enabled', () => expect((Users as any).auth).toBeTruthy())

    it('has key fields', () => {
        const names = getFieldNames(Users)
        expect(names).toContain('firstName')
        expect(names).toContain('lastName')
        expect(names).toContain('roles')
        expect(names).toContain('tenants')
    })

    it('has hooks configured', () => {
        expect(Users.hooks).toBeDefined()
    })

    // TC-PERF-150: no self-registration over REST (SSO provision / staff invite / seeders use the Local API)
    testAccess('create', Users.access?.create, [
        { desc: 'denies anonymous (TC-PERF-150)', req: noUser, expected: false },
        { desc: 'denies a tenant owner (TC-PERF-150)', req: normalUser, expected: false },
        { desc: 'allows super-admin', req: superAdmin, expected: true },
    ])

    // TC-PERF-142: the Payload admin panel is for super-admins; a tenant user's password token gets nothing there
    testAccess('admin', (Users.access as any)?.admin, [
        { desc: 'denies anonymous', req: noUser, expected: false },
        { desc: 'denies a tenant owner', req: normalUser, expected: false },
        { desc: 'allows super-admin', req: superAdmin, expected: true },
    ])

    it('[TC-PERF-132] a request cannot pick its own roles: only a super-admin may set roles on create or update', () => {
        // Arrange
        const roles = (Users.fields as any[]).find((f) => f.name === 'roles')
        const tenants = (Users.fields as any[]).find((f) => f.name === 'tenants')

        // Act / Assert: public sign-up with roles: ["super-admin"] made a super-admin before
        for (const op of ['create', 'update'] as const) {
            expect(roles.access[op]({ req: noUser })).toBe(false)
            expect(roles.access[op]({ req: normalUser })).toBe(false)
            expect(roles.access[op]({ req: superAdmin })).toBe(true)
            expect(tenants.access[op]({ req: noUser })).toBe(false)
        }
    })

    testAccess('delete', Users.access?.delete, [
        { desc: 'denies normal user', req: normalUser, expected: false },
        { desc: 'allows super-admin', req: superAdmin, expected: true },
    ])

})

// ─── Pages ────────────────────────────────────────────────────────────
describe('Pages collection [TC-F04]', () => {
    it('has slug "pages"', () => expect(Pages.slug).toBe('pages'))
    it('uses "title" as admin title', () => expect(Pages.admin?.useAsTitle).toBe('title'))

    it('has key fields', () => {
        const names = getFieldNames(Pages)
        expect(names).toContain('title')
        expect(names).toContain('slug')
        expect(names).toContain('site')
        expect(names).toContain('layout')
        expect(names).toContain('seo')
    })

    // TC-PERF-133: no access block made every page and draft readable / writable by any logged-in account
    testAccess('read', Pages.access?.read, [
        { desc: 'denies public', req: noUser, expected: false },
        { desc: 'allows super-admin', req: superAdmin, expected: true },
    ])
    it('[TC-PERF-133] read and readVersions are scoped to the member tenants through the site', () => {
        expect(Pages.access!.read!({ req: normalUser } as any)).toEqual({ 'site.tenant': { in: ['tenant-1'] } })
        expect(Pages.access!.readVersions!({ req: normalUser } as any)).toEqual({ 'version.site.tenant': { in: ['tenant-1'] } })
        expect(Pages.access!.read!({ req: { user: { id: 2, roles: [], tenants: [] } } } as any)).toBe(false)
    })
    it('[TC-PERF-133] REST create / update / delete are super-admin only', () => {
        for (const op of ['create', 'update', 'delete'] as const) {
            expect(Pages.access![op]!({ req: normalUser } as any)).toBe(false)
            expect(Pages.access![op]!({ req: superAdmin } as any)).toBe(true)
        }
    })
})

// ─── Sites ────────────────────────────────────────────────────────────
describe('Sites collection [TC-F19]', () => {
    it('has slug "sites"', () => expect(Sites.slug).toBe('sites'))
    it('uses "name" as admin title', () => expect(Sites.admin?.useAsTitle).toBe('name'))

    it('has key fields', () => {
        const names = getFieldNames(Sites)
        expect(names).toContain('tenant')
        expect(names).toContain('name')
        expect(names).toContain('domain')
    })

    testAccess('create', Sites.access?.create, [
        { desc: 'denies unauthenticated', req: noUser, expected: false },
        { desc: 'allows authenticated', req: normalUser, expected: true },
    ])
})

// ─── Tenants ──────────────────────────────────────────────────────────
describe('Tenants collection', () => {
    it('has slug "tenants"', () => expect(Tenants.slug).toBe('tenants'))
    it('uses "name" as admin title', () => expect(Tenants.admin?.useAsTitle).toBe('name'))

    it('has key fields', () => {
        const names = getFieldNames(Tenants)
        expect(names).toContain('name')
        expect(names).toContain('slug')
    })
})

// ─── Categories ───────────────────────────────────────────────────────
describe('Categories collection [TC-F08]', () => {
    it('has slug "categories"', () => expect(Categories.slug).toBe('categories'))

    it('has tenant and site fields', () => {
        const names = getFieldNames(Categories)
        expect(names).toContain('tenant')
        expect(names).toContain('site')
    })

    testAccess('create', Categories.access?.create, [
        { desc: 'denies unauthenticated', req: noUser, expected: false },
        { desc: 'allows authenticated', req: normalUser, expected: true },
    ])
})

// ─── Blogs ────────────────────────────────────────────────────────────
describe('Blogs collection [TC-F17]', () => {
    it('has slug "blogs"', () => expect(Blogs.slug).toBe('blogs'))
    it('uses "title" as admin title', () => expect(Blogs.admin?.useAsTitle).toBe('title'))

    it('has key fields', () => {
        const names = getFieldNames(Blogs)
        expect(names).toContain('title')
        expect(names).toContain('slug')
        expect(names).toContain('status')
        expect(names).toContain('content')
    })

    testAccess('create', Blogs.access?.create, [
        { desc: 'denies unauthenticated', req: noUser, expected: false },
        { desc: 'allows authenticated', req: normalUser, expected: true },
    ])
})

// ─── Templates ────────────────────────────────────────────────────────
describe('Templates collection [TC-F07]', () => {
    it('has slug "templates"', () => expect(Templates.slug).toBe('templates'))
    it('uses "name" as admin title', () => expect(Templates.admin?.useAsTitle).toBe('name'))

    it('has key fields', () => {
        const names = getFieldNames(Templates)
        expect(names).toContain('name')
        expect(names).toContain('description')
        expect(names).toContain('category')
    })

    it('exports TEMPLATE_CATEGORY_OPTIONS', () => {
        expect(Array.isArray(TEMPLATE_CATEGORY_OPTIONS)).toBe(true)
        expect(TEMPLATE_CATEGORY_OPTIONS.length).toBeGreaterThan(0)
    })

    testAccess('delete', Templates.access?.delete, [
        { desc: 'denies normal user', req: normalUser, expected: false },
        { desc: 'allows super-admin', req: superAdmin, expected: true },
    ])
})

// ─── Subscriptions ────────────────────────────────────────────────────
describe('Subscriptions collection [TC-F13]', () => {
    it('has slug "subscriptions"', () => expect(Subscriptions.slug).toBe('subscriptions'))

    it('has key fields', () => {
        const names = getFieldNames(Subscriptions)
        expect(names).toContain('tenant')
        expect(names).toContain('plan')
        expect(names).toContain('status')
    })

    testAccess('delete', Subscriptions.access?.delete, [
        { desc: 'denies normal user', req: normalUser, expected: false },
        { desc: 'allows super-admin', req: superAdmin, expected: true },
    ])
})

// ─── Analytics ────────────────────────────────────────────────────────
describe('Analytics collection [TC-F22]', () => {
    it('has slug "analytics"', () => expect(Analytics.slug).toBe('analytics'))

    it('has key fields', () => {
        const names = getFieldNames(Analytics)
        expect(names).toContain('tenant')
        expect(names).toContain('site')
        expect(names).toContain('event')
        expect(names).toContain('pageUrl')
    })

    testAccess('create', Analytics.access?.create, [
        { desc: 'allows public (tracking pixel)', req: noUser, expected: true },
    ])
})

// ─── SEOMetaJobs ──────────────────────────────────────────────────────
describe('SEOMetaJobs collection', () => {
    it('[TC-PERF-133] queue is super-admin only over REST', () => {
        for (const op of ['read', 'update', 'delete'] as const) {
            expect((SEOMetaJobs.access as any)[op]({ req: normalUser })).toBe(false)
            expect((SEOMetaJobs.access as any)[op]({ req: superAdmin })).toBe(true)
        }
    })
    it('has slug "seo-meta-jobs"', () => expect(SEOMetaJobs.slug).toBe('seo-meta-jobs'))
    it('uses "targetId" as admin title', () => expect(SEOMetaJobs.admin?.useAsTitle).toBe('targetId'))

    it('has key fields', () => {
        const names = getFieldNames(SEOMetaJobs)
        expect(names).toContain('targetCollection')
        expect(names).toContain('targetId')
        expect(names).toContain('status')
    })
})

// ─── BlogCategories ──────────────────────────────────────────────────
describe('BlogCategories collection [TC-F17]', () => {
    it('has slug "blog_categories"', () => expect(BlogCategories.slug).toBe('blog_categories'))
    it('uses "name" as admin title', () => expect(BlogCategories.admin?.useAsTitle).toBe('name'))

    it('has key fields', () => {
        const names = getFieldNames(BlogCategories)
        expect(names).toContain('tenant')
        expect(names).toContain('name')
        expect(names).toContain('slug')
    })
})

// ─── Media ────────────────────────────────────────────────────────────
describe('Media collection', () => {
    it('has slug "media"', () => expect(Media.slug).toBe('media'))
    it('has upload config', () => expect((Media as any).upload).toBeTruthy())

    it('has alt field', () => {
        const names = getFieldNames(Media)
        expect(names).toContain('alt')
    })

    testAccess('delete', Media.access?.delete, [
        { desc: 'denies unauthenticated', req: noUser, expected: false },
        { desc: 'allows authenticated', req: normalUser, expected: true },
    ])
})

// ─── PushSubscriptions ────────────────────────────────────────────────
describe('PushSubscriptions owner fields [TC-PERF-134]', () => {
    it('a member cannot re-point user / tenant to receive another member\'s pushes', () => {
        for (const name of ['user', 'tenant']) {
            const field = (PushSubscriptions.fields as any[]).find((f) => f.name === name)
            expect(field.access.update({ req: normalUser })).toBe(false)
            expect(field.access.update({ req: superAdmin })).toBe(true)
        }
    })
})
