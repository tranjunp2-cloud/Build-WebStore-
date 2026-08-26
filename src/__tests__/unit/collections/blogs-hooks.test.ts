import { describe, it, expect, vi } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'
import { Blogs, validateBlogSlug } from '../../../collections/Blogs'

describe('Blogs Collection Hooks — Category Tenant Isolation (TC-F17-SEC-13)', () => {
    const hook = Blogs.hooks!.beforeChange![0] as CollectionBeforeChangeHook

    it('TC-F17-SEC-13: Non-admin create rejects a blog category belonging to a different tenant', async () => {
        const req = {
            user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
            payload: {
                find: vi.fn().mockResolvedValueOnce({ docs: [{ id: 'site-A' }] }),
                findByID: vi.fn().mockResolvedValueOnce({ id: 'cat-B', tenant: 'tenant-B', status: 'active' }),
            },
        } as any

        await expect(hook({
            data: { title: 'Tenant A post', category: 'cat-B' },
            operation: 'create',
            req,
        } as any)).rejects.toThrow(/BLOG_CATEGORY_TENANT_MISMATCH/)

        expect(req.payload.findByID).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'blog_categories',
            id: 'cat-B',
            overrideAccess: true,
            disableErrors: true,
        }))
    })

    it('TC-F17-SEC-13b: Non-admin update accepts a same-tenant blog category and normalizes relation ids', async () => {
        const req = {
            user: { id: 'user-1', tenants: [{ tenant: { id: 'tenant-A' } }] },
            payload: {
                find: vi.fn(),
                findByID: vi.fn().mockResolvedValueOnce({ id: 'cat-A', tenant: { id: 'tenant-A' }, status: 'active' }),
            },
        } as any

        const result = await hook({
            data: { category: { id: 'cat-A' } },
            originalDoc: { id: 'blog-1', tenant: 'tenant-A', site: 'site-A' },
            operation: 'update',
            req,
        } as any)

        expect(result.tenant).toBe('tenant-A')
        expect(result.site).toBe('site-A')
        expect(result.category).toBe('cat-A')
    })

    it('TC-F17-SEC-13c: Non-admin update can clear category without lookup', async () => {
        const req = {
            user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
            payload: {
                find: vi.fn(),
                findByID: vi.fn(),
            },
        } as any

        const result = await hook({
            data: { category: null },
            originalDoc: { id: 'blog-1', tenant: 'tenant-A', site: 'site-A', category: 'cat-A' },
            operation: 'update',
            req,
        } as any)

        expect(result.category).toBeNull()
        expect(req.payload.findByID).not.toHaveBeenCalled()
    })

    it('TC-F17-SEC-13d: Local API create without req.user still rejects category from a different tenant', async () => {
        const req = {
            payload: {
                find: vi.fn(),
                findByID: vi.fn().mockResolvedValueOnce({ id: 'cat-B', tenant: 'tenant-B', status: 'active' }),
            },
        } as any

        await expect(hook({
            data: { title: 'Internal write', tenant: 'tenant-A', site: 'site-A', category: 'cat-B' },
            operation: 'create',
            req,
        } as any)).rejects.toThrow(/BLOG_CATEGORY_TENANT_MISMATCH/)
    })
})

describe('[TC-F37-03-48] Blog public slug validation', () => {
    it('rejects nested slugs that cannot resolve through the single-segment detail route', () => {
        // Arrange
        const nestedSlug = 'news/launch'

        // Act
        const result = validateBlogSlug(nestedSlug)

        // Assert
        expect(result).toBe('Blog slug must be a single URL segment')
        expect(validateBlogSlug('..')).toBe('Blog slug must be a single URL segment')
        expect(validateBlogSlug('news-launch')).toBe(true)
    })
})
