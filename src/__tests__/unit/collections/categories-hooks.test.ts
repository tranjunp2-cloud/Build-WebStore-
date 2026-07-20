import { describe, it, expect, vi } from 'vitest'
import { Categories } from '../../../collections/Categories'
import { Blogs } from '../../../collections/Blogs'
import { BlogCategories } from '../../../collections/BlogCategories'

describe('Categories Collection Hooks (TC-F08-05)', () => {
    describe('beforeValidate hook — Cycle Prevention (TC-F08-05-09)', () => {
        const hook = Categories.hooks!.beforeValidate![0] as any

        it('TC-F08-05-09: Self-parent cycle — setting category as its own parent throws error', async () => {
            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }] },
                payload: {
                    findByID: vi.fn()
                }
            }

            // Update operation: trying to set cat-A's parent to itself
            await expect(hook({
                data: { name: 'Category A', parent: 'cat-A', tenant: 'tenant-456' },
                operation: 'update',
                originalDoc: { id: 'cat-A', tenant: 'tenant-456' },
                req
            } as any)).rejects.toThrow(/CATEGORY_CYCLE_ERROR/)
        })

        it('TC-F08-05-09: Descendant-as-parent cycle — setting descendant as parent throws error', async () => {
            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }] },
                payload: {
                    // Only one findByID call actually happens: fetching cat-B's own record shows
                    // its parent is cat-A (= selfId) — the hook's ancestor walk throws on THAT
                    // hop, before ever needing to fetch a second level up.
                    findByID: vi.fn()
                        .mockResolvedValueOnce({ id: 'cat-B', parent: 'cat-A', tenant: 'tenant-456' })
                }
            }

            // Editing cat-A to have parent cat-B (where B is descendant of A)
            await expect(hook({
                data: { name: 'Category A', parent: 'cat-B', tenant: 'tenant-456' },
                operation: 'update',
                originalDoc: { id: 'cat-A', tenant: 'tenant-456' },
                req
            } as any)).rejects.toThrow(/CATEGORY_CYCLE_ERROR/)
        })

        it('TC-F08-05-09: Valid parent with no cycle — accepts parent change', async () => {
            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }] },
                payload: {
                    findByID: vi.fn()
                        .mockResolvedValueOnce({ id: 'cat-B', parent: null, tenant: 'tenant-456' })
                }
            }

            const data = { name: 'Category A', parent: 'cat-B', tenant: 'tenant-456' }
            const result = await hook({
                data,
                operation: 'update',
                originalDoc: { id: 'cat-A', tenant: 'tenant-456' },
                req
            } as any)
            expect(result).toBe(data)
        })

        it('TC-F08-05-02: Depth limit — rejects 4th level category', async () => {
            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }] },
                payload: {
                    findByID: vi.fn()
                        .mockResolvedValueOnce({ id: 'Level3', parent: 'Level2', tenant: 'tenant-456' })
                        .mockResolvedValueOnce({ id: 'Level2', parent: 'Level1', tenant: 'tenant-456' })
                        .mockResolvedValueOnce({ id: 'Level1', parent: null, tenant: 'tenant-456' })
                }
            }

            await expect(hook({
                data: { name: 'Level4', parent: 'Level3', tenant: 'tenant-456' },
                operation: 'create',
                req
            } as any)).rejects.toThrow(/CATEGORY_MAX_DEPTH_ERROR/)
        })

        it('TC-F08-05-02: Depth limit — accepts 3rd level category', async () => {
            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }] },
                payload: {
                    findByID: vi.fn()
                        .mockResolvedValueOnce({ id: 'Level2', parent: 'Level1', tenant: 'tenant-456' })
                        .mockResolvedValueOnce({ id: 'Level1', parent: null, tenant: 'tenant-456' })
                }
            }

            const data = { name: 'Level3', parent: 'Level2', tenant: 'tenant-456' }
            const result = await hook({
                data,
                operation: 'create',
                req
            } as any)
            expect(result).toBe(data)
        })

        // GH-1587 Phase 01: Cross-tenant parent IDOR fix (TC-F08-05-14)
        describe('beforeValidate hook — Cross-tenant parent IDOR (TC-F08-05-14)', () => {
            it('TC-F08-05-14: Non-admin user setting parent to cross-tenant category rejects with CATEGORY_PARENT_TENANT_MISMATCH', async () => {
                const req = {
                    user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                    payload: {
                        findByID: vi.fn().mockResolvedValueOnce(undefined)
                    }
                }

                await expect(hook({
                    data: { name: 'Category', parent: 'victim-cat-id' },
                    operation: 'create',
                    req
                } as any)).rejects.toThrow(/CATEGORY_PARENT_TENANT_MISMATCH/)
            })

            it('TC-F08-05-14: Non-admin user setting parent to same-tenant category succeeds', async () => {
                const req = {
                    user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                    payload: {
                        findByID: vi.fn().mockResolvedValueOnce({ id: 'parent-cat', parent: null, tenant: 'tenant-A' })
                    }
                }

                const data = { name: 'Child', parent: 'parent-cat' }
                const result = await hook({
                    data,
                    operation: 'create',
                    req
                } as any)
                expect(result.name).toBe('Child')
                expect(req.payload.findByID).toHaveBeenCalledWith(
                    expect.objectContaining({
                        collection: 'categories',
                        id: 'parent-cat',
                        overrideAccess: true,
                        disableErrors: true,
                    })
                )
            })

            it('TC-F08-05-14: Non-admin user with no resolvable tenant throws fail-safe error before lookup', async () => {
                const req = {
                    user: { id: 'user-1', tenants: [] },
                    payload: {
                        findByID: vi.fn()
                    }
                }

                await expect(hook({
                    data: { name: 'Orphan', parent: 'some-cat' },
                    operation: 'create',
                    req
                } as any)).rejects.toThrow(/xác định thương hiệu/)

                expect(req.payload.findByID).not.toHaveBeenCalled()
            })

            it('TC-F08-05-14: Super-admin can set parent to any category when no tenant is being enforced', async () => {
                const req = {
                    user: { roles: ['super-admin'] },
                    payload: {
                        findByID: vi.fn().mockResolvedValueOnce({ id: 'any-tenant-cat', parent: null })
                    }
                }

                const data = { name: 'Admin Category', parent: 'any-tenant-cat' }
                const result = await hook({
                    data,
                    operation: 'create',
                    req
                } as any)
                expect(result.name).toBe('Admin Category')
                expect(req.payload.findByID).toHaveBeenCalledWith(
                    expect.objectContaining({
                        collection: 'categories',
                        id: 'any-tenant-cat',
                        overrideAccess: true,
                        disableErrors: true,
                    })
                )
            })
        })
    })
})

// GH-1587 Phase 01b: Tenant/site field spoof fix (TC-F08-05-16)
describe('Categories Collection Hooks — Tenant/Site Field Spoof (TC-F08-05-16)', () => {
    describe('beforeChange hook — force tenant to actor\'s own', () => {
        const hook = Categories.hooks!.beforeChange![0] as any

        it('TC-F08-05-16: Non-admin user attempting to spoof tenant via bare {tenant:<victim>} PATCH gets forced back to own tenant on update', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {
                    find: vi.fn().mockResolvedValueOnce({ docs: [] }) // Site validation
                }
            }
            const originalDoc = { id: 'cat-1', tenant: 'tenant-A', site: 'site-1', name: 'Existing', parent: null }

            const result = await hook({
                data: { tenant: 'victim-tenant-B' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            // Tenant forced back to original tenant-A, not spoofed to victim-tenant-B
            expect(result.tenant).toBe('tenant-A')
        })

        it('TC-F08-05-16: Non-admin user without spoof attempt preserves same tenant on update', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {
                    find: vi.fn()
                }
            }
            const originalDoc = { id: 'cat-1', tenant: 'tenant-A', site: 'site-1', name: 'Cat', parent: null }

            const result = await hook({
                data: { name: 'Updated Cat' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            expect(result.tenant).toBe('tenant-A')
        })

        it('TC-F08-05-16: Multi-site preservation — update without site change keeps originalDoc.site', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {
                    find: vi.fn()
                }
            }
            const originalDoc = { id: 'cat-1', tenant: 'tenant-A', site: 'site-2', name: 'Cat', parent: null }

            const result = await hook({
                data: { name: 'Updated', site: undefined },
                originalDoc,
                operation: 'update',
                req
            } as any)

            // Site should not be called since data.site is undefined
            expect(result.site).toBe('site-2')
        })

        it('TC-F08-05-16: Multi-site preservation — update with same site ID preserves it', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {
                    find: vi.fn()
                }
            }
            const originalDoc = { id: 'cat-1', tenant: 'tenant-A', site: 'site-2', name: 'Cat', parent: null }

            const result = await hook({
                data: { name: 'Updated', site: 'site-2' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            // Same site, should not trigger lookup
            expect(result.site).toBe('site-2')
            expect(req.payload.find).not.toHaveBeenCalled()
        })

        it('TC-F08-05-16: Multi-site validation — update with new site belonging to same tenant preserves it', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {
                    find: vi.fn().mockResolvedValueOnce({ docs: [{ id: 'site-3' }] }) // Validates site-3 belongs to tenant-A
                }
            }
            const originalDoc = { id: 'cat-1', tenant: 'tenant-A', site: 'site-2', name: 'Cat', parent: null }

            const result = await hook({
                data: { name: 'Updated', site: 'site-3' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            expect(result.site).toBe('site-3')
            expect(req.payload.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: { equals: 'site-3' }, tenant: { equals: 'tenant-A' } }
                })
            )
        })

        it('TC-F08-05-16: Multi-site validation — update with site NOT belonging to tenant reverts to original', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {
                    find: vi.fn().mockResolvedValueOnce({ docs: [] }) // Spoof site not found in tenant-A
                }
            }
            const originalDoc = { id: 'cat-1', tenant: 'tenant-A', site: 'site-2', name: 'Cat', parent: null }

            const result = await hook({
                data: { name: 'Updated', site: 'victim-site' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            // Rejected spoof, reverts to original site-2
            expect(result.site).toBe('site-2')
        })

        it('TC-F08-05-16: Super-admin passthrough — no forcing of tenant or site', async () => {
            const req = {
                user: { id: 'admin', roles: ['super-admin'], tenants: [] },
                payload: {
                    find: vi.fn()
                }
            }
            const originalDoc = { id: 'cat-1', tenant: 'tenant-A', site: 'site-1', name: 'Cat', parent: null }

            const result = await hook({
                data: { tenant: 'any-tenant', site: 'any-site' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            // Super-admin gets their data unchanged
            expect(result.tenant).toBe('any-tenant')
            expect(result.site).toBe('any-site')
        })
    })
})

// GH-1587 Phase 02: Anonymous read block for Categories (TC-F08-05-15)
describe('Categories anonymous read access block [TC-F08-05-15]', () => {
    it('TC-F08-05-15: Anonymous request (req.user = undefined) returns false', () => {
        const req = { user: undefined } as any
        const access = Categories.access!.read!({ req } as any)
        expect(access).toBe(false)
    })

    it('TC-F08-05-15: Anonymous request (req.user = null) returns false', () => {
        const req = { user: null } as any
        const access = Categories.access!.read!({ req } as any)
        expect(access).toBe(false)
    })

    it('TC-F08-05-15: Authenticated user gets tenant-scoped access', () => {
        const req = { user: { tenants: [{ tenant: 'tenant-1' }] } } as any
        const access = Categories.access!.read!({ req } as any)
        expect(access).toEqual({ and: [{ tenant: { in: ['tenant-1'] } }, { deletedAt: { exists: false } }] })
    })
})

// GH-1587 Phase 02: Anonymous read block for Blogs (TC-F17-SEC-01)
describe('Blogs anonymous read access block [TC-F17-SEC-01]', () => {
    it('TC-F17-SEC-01: Anonymous request (req.user = undefined) returns false', () => {
        const req = { user: undefined } as any
        const access = Blogs.access!.read!({ req } as any)
        expect(access).toBe(false)
    })

    it('TC-F17-SEC-01: Anonymous request (req.user = null) returns false', () => {
        const req = { user: null } as any
        const access = Blogs.access!.read!({ req } as any)
        expect(access).toBe(false)
    })

    it('TC-F17-SEC-01: Authenticated user gets tenant-scoped access', () => {
        const req = { user: { tenants: [{ tenant: 'tenant-1' }] } } as any
        const access = Blogs.access!.read!({ req } as any)
        expect(access).toEqual({ tenant: { in: ['tenant-1'] } })
    })
})

// GH-1587 Phase 02: Anonymous read block for BlogCategories (TC-F17-SEC-02)
describe('BlogCategories anonymous read access block [TC-F17-SEC-02]', () => {
    it('TC-F17-SEC-02: Anonymous request (req.user = undefined) returns false', () => {
        const req = { user: undefined } as any
        const access = BlogCategories.access!.read!({ req } as any)
        expect(access).toBe(false)
    })

    it('TC-F17-SEC-02: Anonymous request (req.user = null) returns false', () => {
        const req = { user: null } as any
        const access = BlogCategories.access!.read!({ req } as any)
        expect(access).toBe(false)
    })

    it('TC-F17-SEC-02: Authenticated user gets tenant-scoped access', () => {
        const req = { user: { tenants: [{ tenant: 'tenant-1' }] } } as any
        const access = BlogCategories.access!.read!({ req } as any)
        expect(access).toEqual({ tenant: { in: ['tenant-1'] } })
    })
})

describe('Blogs Collection Hooks — Tenant/Site Field Spoof (TC-F17-SEC-13)', () => {
    describe('beforeChange hook — force tenant/site to actor-owned values', () => {
        const hook = Blogs.hooks!.beforeChange![0] as any

        it('TC-F17-SEC-13: Non-admin create with spoofed tenant/site gets forced to actor tenant and actor site', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {
                    find: vi.fn()
                        .mockResolvedValueOnce({ docs: [] })
                        .mockResolvedValueOnce({ docs: [{ id: 'site-A' }] })
                }
            }

            const result = await hook({
                data: { tenant: 'victim-tenant-B', site: 'victim-site', title: 'Blog' },
                operation: 'create',
                req
            } as any)

            expect(result.tenant).toBe('tenant-A')
            expect(result.site).toBe('site-A')
            expect(req.payload.find).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    where: { id: { equals: 'victim-site' }, tenant: { equals: 'tenant-A' } }
                })
            )
        })

        it('TC-F17-SEC-13: Non-admin update with spoofed tenant/site reverts to original ownership', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {
                    find: vi.fn().mockResolvedValueOnce({ docs: [] })
                }
            }
            const originalDoc = { id: 'blog-1', tenant: 'tenant-A', site: 'site-A', title: 'Original' }

            const result = await hook({
                data: { tenant: 'victim-tenant-B', site: 'victim-site' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            expect(result.tenant).toBe('tenant-A')
            expect(result.site).toBe('site-A')
        })

        it('TC-F17-SEC-13: Non-admin update with another site in same tenant preserves the requested site', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {
                    find: vi.fn().mockResolvedValueOnce({ docs: [{ id: 'site-A-2' }] })
                }
            }
            const originalDoc = { id: 'blog-1', tenant: 'tenant-A', site: 'site-A', title: 'Original' }

            const result = await hook({
                data: { site: 'site-A-2' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            expect(result.tenant).toBe('tenant-A')
            expect(result.site).toBe('site-A-2')
        })

        it('TC-F17-SEC-13: Super-admin passthrough keeps caller-supplied tenant/site', async () => {
            const req = {
                user: { id: 'admin', roles: ['super-admin'], tenants: [] },
                payload: {
                    find: vi.fn()
                }
            }
            const originalDoc = { id: 'blog-1', tenant: 'tenant-A', site: 'site-A', title: 'Original' }

            const result = await hook({
                data: { tenant: 'tenant-B', site: 'site-B' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            expect(result.tenant).toBe('tenant-B')
            expect(result.site).toBe('site-B')
            expect(req.payload.find).not.toHaveBeenCalled()
        })
    })
})

describe('BlogCategories Collection Hooks — Tenant Field Spoof (TC-F17-SEC-14)', () => {
    describe('beforeChange hook — force tenant to actor-owned value', () => {
        const hook = BlogCategories.hooks!.beforeChange![0] as any

        it('TC-F17-SEC-14: Non-admin create with spoofed tenant gets forced to actor tenant', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {}
            }

            const result = await hook({
                data: { tenant: 'victim-tenant-B', name: 'News' },
                operation: 'create',
                req
            } as any)

            expect(result.tenant).toBe('tenant-A')
        })

        it('TC-F17-SEC-14: Non-admin update with spoofed tenant reverts to original tenant', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {}
            }
            const originalDoc = { id: 'cat-1', tenant: 'tenant-A', name: 'News' }

            const result = await hook({
                data: { tenant: 'victim-tenant-B', name: 'Updated News' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            expect(result.tenant).toBe('tenant-A')
        })

        it('TC-F17-SEC-14: Non-admin without resolvable tenant is rejected fail-closed', async () => {
            const req = {
                user: { id: 'user-1', tenants: [] },
                payload: {}
            }

            await expect(hook({
                data: { tenant: 'victim-tenant-B', name: 'News' },
                operation: 'create',
                req
            } as any)).rejects.toThrow(/Không thể xác định thương hiệu/)
        })

        it('TC-F17-SEC-14: Super-admin passthrough keeps caller-supplied tenant', async () => {
            const req = {
                user: { id: 'admin', roles: ['super-admin'], tenants: [] },
                payload: {}
            }

            const result = await hook({
                data: { tenant: 'tenant-B', name: 'Global News' },
                operation: 'create',
                req
            } as any)

            expect(result.tenant).toBe('tenant-B')
        })
    })
})
