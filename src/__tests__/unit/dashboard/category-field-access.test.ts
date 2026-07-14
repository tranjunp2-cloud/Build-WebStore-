import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// ── Mocks at top (Rule: vi.mock() top-level, never inside describe/it) ──
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
    tenantIdForQuery: vi.fn(),
}))

import { saveCategoryAction, deleteCategoryAction } from '@/app/(dashboard)/products/categories/actions'
import { getPayload } from 'payload'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'

const mockCurrentUser = { id: 'user-123', tenants: [{ tenant: 'tenant-456' }] }

type MockPayload = { findByID: Mock; create: Mock; update: Mock; db: { drizzle: { execute: Mock } } }

// ── TC-F08-05-05/06/09: Field Access Control & Security Regression ────────
describe('Category Field Access Control (GH-1587 Security Fixes)', () => {
    let mockPayload: MockPayload
    let mockFindByID: Mock
    let mockFind: Mock
    let mockCreate: Mock
    let mockUpdate: Mock
    let mockExecute: Mock

    beforeEach(() => {
        vi.clearAllMocks()
        mockFindByID = vi.fn()
        mockFind = vi.fn()
        mockCreate = vi.fn()
        mockUpdate = vi.fn()
        mockExecute = vi.fn()

        mockPayload = {
            findByID: mockFindByID,
            find: mockFind,
            create: mockCreate,
            update: mockUpdate,
            db: {
                drizzle: {
                    execute: mockExecute,
                },
            },
        } as any

        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
        vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser as any)
        vi.mocked(tenantIdForQuery).mockImplementation((user) => user?.tenants?.[0]?.tenant)
    })

    describe('TC-F08-05-05: Field Access & Allowlist (GH-1587 M1)', () => {
        it('TC-F08-05-05: Tenant user cannot write dna field — allowlist strips it', async () => {
            // Arrange: attacker tries to smuggle `dna` field via client
            mockExecute.mockResolvedValue({ rows: [] }) // dedup check passes
            const dnaValue = 'attacker-dna-data'
            mockCreate.mockResolvedValue({
                id: 'cat-123',
                name: 'Shirts',
                dna: undefined, // dna should NOT appear in result
            })

            // Act: try to create with dna field
            await saveCategoryAction({
                name: 'Shirts',
                dna: dnaValue,
            } as any)

            // Assert: dna never reaches payload.create (allowlist strips it)
            const createCall = mockCreate.mock.calls[0][0]
            expect(createCall.data.dna).toBeUndefined()
            expect(createCall.data.name).toBe('Shirts')
        })

        it('TC-F08-05-05: Tenant user cannot write tenant field — allowlist forces caller tenant', async () => {
            // Arrange: attacker tries to set tenant to different value
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({
                id: 'cat-123',
                name: 'Shirts',
                tenant: 'tenant-456', // forced to caller's tenant
            })

            // Act: try to create with attacker-controlled tenant
            await saveCategoryAction({
                name: 'Shirts',
                tenant: 'attacker-tenant-999',
            } as any)

            // Assert: tenant forced to caller's real tenant, attacker value ignored
            const createCall = mockCreate.mock.calls[0][0]
            expect(createCall.data.tenant).toBe('tenant-456')
            expect(createCall.data.tenant).not.toBe('attacker-tenant-999')
        })

        it('TC-F08-05-05: Tenant user cannot write site field — allowlist strips it', async () => {
            // Arrange: attacker tries to set site field
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({
                id: 'cat-123',
                name: 'Shirts',
            })

            // Act
            await saveCategoryAction({
                name: 'Shirts',
                site: 'attacker-site-999',
            } as any)

            // Assert: site never reaches payload.create (not user-facing in this form)
            const createCall = mockCreate.mock.calls[0][0]
            expect(createCall.data.site).toBeUndefined()
        })

        it('TC-F08-05-05: Tenant user cannot write deletedAt field — allowlist strips it', async () => {
            // Arrange: attacker tries to soft-delete via create
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({
                id: 'cat-123',
                name: 'Shirts',
                deletedAt: undefined, // should not be set by client
            })

            // Act
            await saveCategoryAction({
                name: 'Shirts',
                deletedAt: '2026-07-01T00:00:00Z',
            } as any)

            // Assert: deletedAt never reaches payload.create
            const createCall = mockCreate.mock.calls[0][0]
            expect(createCall.data.deletedAt).toBeUndefined()
        })

        it('TC-F08-05-05: Tenant user CAN write legitimate fields (name/slug/parent/description)', async () => {
            // Arrange: valid payload with only legitimate fields
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({
                id: 'cat-123',
                name: 'Shirts',
                slug: 'shirts',
                parent: 'parent-456',
                description: 'Clothing category',
            })

            // Act
            const result = await saveCategoryAction({
                name: 'Shirts',
                slug: 'shirts',
                parent: 'parent-456',
                description: 'Clothing category',
            })

            // Assert: all legitimate fields reach payload.create
            const createCall = mockCreate.mock.calls[0][0]
            expect(createCall.data.name).toBe('Shirts')
            expect(createCall.data.slug).toBe('shirts')
            expect(createCall.data.parent).toBe('parent-456')
            expect(createCall.data.description).toBe('Clothing category')
            expect(result.id).toBe('cat-123')
        })
    })

    describe('TC-F08-05-06: Delete & Field Access (GH-1587 H1)', () => {
        it('TC-F08-05-06: deleteCategoryAction still sets deletedAt despite field-level access: false', async () => {
            // Arrange: collection has `deletedAt` with `access: { update: () => false }`,
            // but deleteCategoryAction uses overrideAccess: true for the internal write
            mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
            mockExecute.mockResolvedValue({ rows: [{ count: 0 }] })
            mockFind.mockResolvedValue({ docs: [] })
            mockUpdate.mockResolvedValue({ id: 'cat-123', deletedAt: expect.any(String) })

            // Act
            const result = await deleteCategoryAction('cat-123')

            // Assert: deletedAt was successfully set despite field-level access rule
            expect(mockUpdate).toHaveBeenCalled()
            const updateCall = mockUpdate.mock.calls[0][0]
            expect(updateCall.data.deletedAt).toBeDefined()
            expect(updateCall.data.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
            // Verify it was an internal write with overrideAccess:true
            expect(updateCall.overrideAccess).toBe(true)
            expect(result.deletedAt).toBeDefined()
        })

        it('TC-F08-05-06: Re-parent update sets parent despite field-level access rules', async () => {
            // Arrange: verifies re-parent can set parent field during delete operation
            mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
            mockExecute.mockResolvedValue({ rows: [{ count: 0 }] })
            mockFind.mockResolvedValue({ docs: [{ id: 'child-1', parent: 'cat-123' }] })
            mockUpdate.mockResolvedValue({ id: expect.any(String) })

            // Act
            await deleteCategoryAction('cat-123')

            // Assert: first update re-parents child with overrideAccess:true
            expect(mockUpdate).toHaveBeenCalledTimes(2)
            const reparentCall = mockUpdate.mock.calls[0][0]
            expect(reparentCall.data.parent).toBeNull()
            expect(reparentCall.overrideAccess).toBe(true)
        })
    })

    describe('TC-F08-05-09: Sentinel Error Emission (GH-1587 H2)', () => {
        it('TC-F08-05-09: Cycle detection throws CATEGORY_CYCLE_ERROR sentinel', async () => {
            // Arrange: hook will detect cycle via Categories.ts beforeValidate
            // We'll mock the hook directly since getCurrentUser and tenantIdForQuery setup
            // But for action-layer testing, we can't easily trigger hooks, so verify the
            // collection's error handling here — this is primarily a hook test covered by
            // categories-hooks.test.ts; this is a smoke test for the error propagation.
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }] },
                payload: { findByID: vi.fn() },
            }

            // Act & Assert: self-parent cycle throws sentinel code (not raw Vietnamese string)
            await expect(
                hook({
                    data: { parent: 'cat-A', tenant: 'tenant-456' },
                    operation: 'update',
                    originalDoc: { id: 'cat-A', tenant: 'tenant-456' },
                    req,
                } as any)
            ).rejects.toThrow('CATEGORY_CYCLE_ERROR')
        })

        it('TC-F08-05-09: Max depth detection throws CATEGORY_MAX_DEPTH_ERROR sentinel', async () => {
            // Arrange: mock ancestor chain that exceeds depth 3
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }] },
                payload: {
                    findByID: vi.fn()
                        .mockResolvedValueOnce({ id: 'Level3', parent: 'Level2', tenant: 'tenant-456' })
                        .mockResolvedValueOnce({ id: 'Level2', parent: 'Level1', tenant: 'tenant-456' })
                        .mockResolvedValueOnce({ id: 'Level1', parent: null, tenant: 'tenant-456' }),
                },
            }

            // Act & Assert: setting 4th-level child throws sentinel code
            await expect(
                hook({
                    data: { name: 'Level4', parent: 'Level3', tenant: 'tenant-456' },
                    operation: 'create',
                    req,
                } as any)
            ).rejects.toThrow('CATEGORY_MAX_DEPTH_ERROR')
        })
    })

    describe('TC-F08-05-09: Parent Cross-Tenant Nesting Block (GH-1587 H2)', () => {
        it('TC-F08-05-09: Tenant user cannot nest under different tenant parent — throws CATEGORY_PARENT_TENANT_MISMATCH', async () => {
            // Arrange: trying to nest under a parent from different tenant
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }], roles: [] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'parent-999',
                        parent: null,
                        tenant: 'different-tenant-789', // different tenant!
                    }),
                },
            }

            // Act & Assert: cannot nest under different tenant's category
            await expect(
                hook({
                    data: { name: 'Child', parent: 'parent-999', tenant: 'tenant-456' },
                    operation: 'create',
                    req,
                } as any)
            ).rejects.toThrow('CATEGORY_PARENT_TENANT_MISMATCH')
        })

        it('TC-F08-05-09: Super-admin CAN nest under different tenant parent (exempt from cross-tenant check)', async () => {
            // Arrange: super-admin bypasses tenant-mismatch check
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }], roles: ['super-admin'] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'parent-999',
                        parent: null,
                        tenant: 'different-tenant-789',
                    }),
                },
            }

            // Act: super-admin can nest under any parent, even cross-tenant
            const data = { name: 'Child', parent: 'parent-999', tenant: 'tenant-456' }
            const result = await hook({
                data,
                operation: 'create',
                req,
            } as any)

            // Assert: no error thrown; data returned unchanged
            expect(result).toBe(data)
        })

        it('TC-F08-05-09: Same-tenant nesting allowed — no CATEGORY_PARENT_TENANT_MISMATCH error', async () => {
            // Arrange: parent and child both in same tenant
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }], roles: [] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'parent-456',
                        parent: null,
                        tenant: 'tenant-456', // same tenant
                    }),
                },
            }

            // Act: nesting under same-tenant parent
            const data = { name: 'Child', parent: 'parent-456', tenant: 'tenant-456' }
            const result = await hook({
                data,
                operation: 'create',
                req,
            } as any)

            // Assert: no error; allowed
            expect(result).toBe(data)
        })
    })

    describe('TC-F08-05-10..13: C1 Regression — ownerTenantId from authoritative source, not data.tenant (GH-1587 C1)', () => {
        it('TC-F08-05-10: CREATE-path exploit blocked — forged tenant/site with different-tenant parent fails cross-tenant check', async () => {
            // Regression: Before fix, attacker could forge `data.tenant` to match victim parent's tenant,
            // making the cross-tenant check pass. Now: ownerTenantId is req.user.tenants[0] (authentic),
            // so even if attacker forges data.tenant=victim-tenant, the check uses user's real tenant.
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const victimTenant = 'victim-tenant-789'
            const attackerTenant = 'attacker-tenant-456'
            const victimParentId = 'parent-in-victim-tenant'

            const req = {
                user: { tenants: [{ tenant: attackerTenant }], roles: [] }, // attacker owns attacker-tenant-456
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: victimParentId,
                        parent: null,
                        tenant: victimTenant, // parent belongs to victim tenant
                    }),
                },
            }

            // Act & Assert: attacker tries to forge tenant to match victim, but ownerTenantId comes from req.user
            await expect(
                hook({
                    data: {
                        name: 'Exploit Child',
                        parent: victimParentId,
                        tenant: victimTenant, // attacker forges this to match parent's tenant
                        site: 'forged-site',
                    },
                    operation: 'create',
                    req,
                } as any)
            ).rejects.toThrow('CATEGORY_PARENT_TENANT_MISMATCH')
        })

        it('TC-F08-05-11: CREATE-path field-strip belt-and-suspenders — tenant/site fields have access.create: () => false', async () => {
            // Regression: Belt-and-suspenders enforcement: even if a hook mistakenly allowed forged
            // tenant/site to pass, the field-level access: { create: () => false } strips them before
            // persisting to DB. This verifies the field configuration is correct.
            const { Categories } = await import('@/collections/Categories')

            // Assert: tenant and site fields have access.create: () => false
            const tenantField = Categories.fields?.find((f: any) => f.name === 'tenant') as any
            const siteField = Categories.fields?.find((f: any) => f.name === 'site') as any

            expect(tenantField).toBeDefined()
            expect(tenantField.access).toBeDefined()
            expect(tenantField.access.create).toBeDefined()
            // Verify the access rule denies create
            expect(tenantField.access.create()).toBe(false)

            expect(siteField).toBeDefined()
            expect(siteField.access).toBeDefined()
            expect(siteField.access.create).toBeDefined()
            // Verify the access rule denies create
            expect(siteField.access.create()).toBe(false)
        })

        it('TC-F08-05-12: Legitimate CREATE still works — tenant/site auto-injected from req.user when omitted', async () => {
            // Regression: Ensure the fix doesn't break the happy path. Client omits tenant/site,
            // and beforeChange auto-injects them from req.user (same source access.create trusts).
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any
            const beforeChangeHook = Categories.hooks?.beforeChange?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }], roles: [] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'parent-456',
                        parent: null,
                        tenant: 'tenant-456',
                    }),
                    find: vi.fn().mockResolvedValueOnce({
                        docs: [{ id: 'site-456', tenant: 'tenant-456' }],
                    }),
                },
            }

            // Act: legitimate create with parent omitted, tenant/site omitted for auto-inject
            const data = {
                name: 'Legitimate Child',
                parent: 'parent-456',
                // tenant and site intentionally omitted — should be auto-injected
            }
            await hook({
                data,
                operation: 'create',
                req,
            } as any)

            const result = await beforeChangeHook({
                data,
                operation: 'create',
                req,
            } as any)

            // Assert: auto-injection worked
            expect(result.tenant).toBe('tenant-456')
            expect(result.site).toBe('site-456')
            expect(result.name).toBe('Legitimate Child')
            expect(result.parent).toBe('parent-456')
        })

        it('TC-F08-05-13: UPDATE-path uses originalDoc.tenant, not data.tenant — forged payload tenant ignored', async () => {
            // Regression: On update, ownerTenantId comes from originalDoc.tenant (persisted),
            // not client-supplied data.tenant. This prevents attacker from changing their "real"
            // tenant during a re-parent to pass the cross-tenant check.
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const originalTenant = 'tenant-456' // user's real tenant
            const victimTenant = 'victim-tenant-789'
            const victimParentId = 'parent-in-victim-tenant'

            const req = {
                user: { tenants: [{ tenant: originalTenant }], roles: [] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: victimParentId,
                        parent: null,
                        tenant: victimTenant,
                    }),
                },
            }

            // Act & Assert: on update, even if attacker forges data.tenant=victimTenant,
            // the check uses originalDoc.tenant (the real persisted value)
            await expect(
                hook({
                    data: {
                        name: 'Exploit Re-parent',
                        parent: victimParentId,
                        tenant: victimTenant, // attacker forges, but will be ignored
                    },
                    operation: 'update',
                    originalDoc: { id: 'cat-123', tenant: originalTenant }, // real persisted tenant
                    req,
                } as any)
            ).rejects.toThrow('CATEGORY_PARENT_TENANT_MISMATCH')
        })
    })
})
