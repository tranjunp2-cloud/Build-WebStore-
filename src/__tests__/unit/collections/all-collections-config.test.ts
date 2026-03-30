import { describe, it, expect, vi } from 'vitest'

// Mock external deps used by collections
vi.mock('@/lib/ai/seo-queue', () => ({ queueSEOAutoGeneration: vi.fn() }))

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

// ─── All Collections Config Validation ────────────────────────────────
// Tests structure, access control, and field presence for every collection.

function getFieldNames(collection: any): string[] {
    return collection.fields?.filter((f: any) => f.name).map((f: any) => f.name) ?? []
}

function testAccess(label: string, accessFn: any, scenarios: Array<{ desc: string; req: any; expected: any }>) {
    for (const { desc, req, expected } of scenarios) {
        it(`${label}: ${desc}`, () => {
            const result = accessFn({ req } as any)
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

    testAccess('create', Users.access?.create, [
        { desc: 'allows public (registration)', req: noUser, expected: true },
    ])

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
