import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notFound } from 'next/navigation'
import TenantSitePage from '@/app/sites/[slug]/[[...path]]/page'

// Mock next utilities
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
}))

vi.mock('next/headers', () => ({
    headers: vi.fn().mockResolvedValue(new Map()),
    cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}))

// unstable_cache needs Next's incrementalCache, absent in unit tests. Make it a
// passthrough so the cached storefront helpers run their real payload.find logic
// (which is mocked above); revalidateTag becomes a no-op.
vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
    revalidateTag: vi.fn(),
    revalidatePath: vi.fn(),
}))

// Mock Payload CMS
let mockSite: Record<string, unknown> | null = null
let mockTenant: Record<string, unknown> | null = null
let mockUser: Record<string, unknown> | null = null
let mockPage: Record<string, unknown> | null = null

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockImplementation(async () => mockUser)
}))

vi.mock('payload', () => {
    return {
        getPayload: vi.fn().mockResolvedValue({
            auth: vi.fn().mockImplementation(async () => {
                return { user: mockUser }
            }),
            find: vi.fn().mockImplementation(async ({ collection }) => {
                if (collection === 'tenants') {
                    return { docs: mockTenant ? [mockTenant] : [] }
                }
                if (collection === 'sites') {
                    return { docs: mockSite ? [mockSite] : [] }
                }
                if (collection === 'pages') {
                    return { docs: mockPage ? [mockPage] : [] }
                }
                return { docs: [] }
            }),
        })
    }
})

// Mock SiteRenderer so we don't need to render actual blocks
vi.mock('@/components/site-renderer/SiteRenderer', () => ({
    SiteRenderer: () => <div data-testid="site-renderer" />
}))

// ── TC-F01 Draft Site ──────────────────────────────────
describe('TenantSitePage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockTenant = { id: 'tenant-1' }
        mockSite = { id: 'site-1', status: 'published' }
        mockPage = { id: 'page-1', slug: '/' }
        mockUser = null
    })

    it('returns notFound when site is draft and user is not authenticated (Visitor)', async () => {
        mockSite = { id: 'site-1', status: 'draft' }
        mockUser = null // Unauthenticated visitor

        await expect(TenantSitePage({
            params: Promise.resolve({ slug: 'my-site' }),
            searchParams: Promise.resolve({})
        })).rejects.toThrow('NEXT_NOT_FOUND')

        expect(notFound).toHaveBeenCalled()
    })

    it('returns notFound when site is draft and user is authenticated but not tenant owner', async () => {
        mockSite = { id: 'site-1', status: 'draft' }
        // Authenticated but wrong tenant
        mockUser = { id: 'user-2', tenants: [{ tenant: 'tenant-999' }] }

        await expect(TenantSitePage({
            params: Promise.resolve({ slug: 'my-site' }),
            searchParams: Promise.resolve({})
        })).rejects.toThrow('NEXT_NOT_FOUND')

        expect(notFound).toHaveBeenCalled()
    })

    it('renders the site successfully when site is draft and user is tenant owner', async () => {
        mockSite = { id: 'site-1', status: 'draft' }
        // Authenticated and owns this tenant
        mockUser = { id: 'user-1', tenants: [{ tenant: 'tenant-1' }] }

        const result = await TenantSitePage({
            params: Promise.resolve({ slug: 'my-site' }),
            searchParams: Promise.resolve({})
        })

        // notFound should not be called, meaning the page renders
        expect(notFound).not.toHaveBeenCalled()

        // Assert the component returned is not null
        expect(result).toBeTruthy()
    })

    it('renders the site successfully when site is published (Visitor)', async () => {
        mockSite = { id: 'site-1', status: 'published' }
        mockUser = null

        const result = await TenantSitePage({
            params: Promise.resolve({ slug: 'my-site' }),
            searchParams: Promise.resolve({})
        })

        expect(notFound).not.toHaveBeenCalled()
        expect(result).toBeTruthy()
    })
})
