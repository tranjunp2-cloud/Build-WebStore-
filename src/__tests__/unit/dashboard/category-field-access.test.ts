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

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(),
    canUse: vi.fn(),
}))

vi.mock('@/lib/payload/category-row-lock', () => ({
    CATEGORY_LOCK_BUSY_ERROR: 'CATEGORY_BUSY_RETRY',
    isCategoryLockTimeoutError: vi.fn(() => false),
    withCategoryMutationGate: vi.fn(async (_payload, operation) => operation()),
}))

import { saveCategoryAction, deleteCategoryAction } from '@/app/(dashboard)/products/categories/actions'
import { getPayload } from 'payload'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'

const mockCurrentUser = { id: 'user-123', tenants: [{ tenant: 'tenant-456' }] }

type MockPayload = { findByID: Mock; create: Mock; update: Mock; db: { drizzle: { execute: Mock; transaction: Mock } } }

// ── TC-F08-05-05/06/09: Field Access Control & Security Regression ────────
describe('Category Field Access Control (GH-1587 Security Fixes)', () => {
    let mockPayload: MockPayload
    let mockFindByID: Mock
    let mockFind: Mock
    let mockCreate: Mock
    let mockUpdate: Mock
    let mockExecute: Mock
    let mockTransaction: Mock

    beforeEach(() => {
        vi.clearAllMocks()
        mockFindByID = vi.fn()
        mockFind = vi.fn().mockImplementation(async (args: { collection: string }) => {
            if (args.collection === 'plan-subscriptions') {
                return {
                    docs: [{
                        id: 'sub-123',
                        plan: 'PROFESSIONAL_TM_USER',
                        status: 'active',
                        endsAt: '2099-01-01T00:00:00.000Z',
                    }],
                }
            }
            if (args.collection === 'plan-features') {
                return { docs: [{ value: 'YES' }] }
            }
            return { docs: [] }
        })
        mockCreate = vi.fn()
        mockUpdate = vi.fn()
        mockExecute = vi.fn()
        mockTransaction = vi.fn(async operation => operation({ execute: mockExecute }))

        mockPayload = {
            findByID: mockFindByID,
            find: mockFind,
            create: mockCreate,
            update: mockUpdate,
            db: {
                drizzle: {
                    execute: mockExecute,
                    transaction: mockTransaction,
                },
            },
        } as any

        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
        vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser as any)
        vi.mocked(tenantIdForQuery).mockImplementation((user) => user?.tenants?.[0]?.tenant)
        vi.mocked(getActivePlanSubscription).mockResolvedValue({ plan: 'PROFESSIONAL_TM_USER' } as any)
        vi.mocked(canUse).mockResolvedValue(true)
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
                parent: 456,
                description: 'Clothing category',
            })

            // Act
            const result = await saveCategoryAction({
                name: 'Shirts',
                slug: 'shirts',
                parent: '456',
                description: 'Clothing category',
            })

            // Assert: all legitimate fields reach payload.create
            const createCall = mockCreate.mock.calls[0][0]
            expect(createCall.data.name).toBe('Shirts')
            expect(createCall.data.slug).toBe('shirts')
            expect(createCall.data.parent).toBe(456)
            expect(createCall.data.description).toBe('Clothing category')
            expect(result).toMatchObject({ id: 'cat-123' })
        })
    })

    describe('TC-F08-05-18: Category parent ID normalization', () => {
        it('TC-F08-05-18: converts a numeric parent string to a PostgreSQL int4 before create', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({ id: 101, name: 'Child', parent: 42 })

            // Act
            await saveCategoryAction({ name: 'Child', parent: '42' })

            // Assert
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ parent: 42 }) })
            )
            expect(mockCreate.mock.calls[0][0].data.parent).toBeTypeOf('number')
        })

        it('TC-F08-05-18: converts an object relationship ID to a PostgreSQL int4 before create', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({ id: 102, name: 'Object Child', parent: 43 })

            // Act
            await saveCategoryAction({ name: 'Object Child', parent: { id: '43' } })

            // Assert
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ parent: 43 }) })
            )
            expect(mockCreate.mock.calls[0][0].data.parent).toBeTypeOf('number')
        })

        it('TC-F08-05-18: converts a numeric parent string to a PostgreSQL int4 before update', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [] })
            mockUpdate.mockResolvedValue({ id: 104, name: 'Updated Child', parent: 44 })

            // Act
            await saveCategoryAction({ name: 'Updated Child', parent: '44' }, 104)

            // Assert
            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 104,
                    data: expect.objectContaining({ parent: 44 }),
                })
            )
            expect(mockUpdate.mock.calls[0][0].data.parent).toBeTypeOf('number')
        })

        it('TC-F08-05-18: preserves an explicit null parent for a root category', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({ id: 103, name: 'Root', parent: null })

            // Act
            await saveCategoryAction({ name: 'Root', parent: null })

            // Assert
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ parent: null }) })
            )
        })

        it('TC-F08-05-18: rejects a malformed parent ID before any database lookup or write', async () => {
            // Arrange
            const invalidParent = 'parent-456'

            // Act
            const action = saveCategoryAction({ name: 'Invalid Child', parent: invalidParent })

            // Assert
            await expect(action).resolves.toEqual({ success: false, error: 'CATEGORY_PARENT_ID_INVALID' })
            expect(getPayload).not.toHaveBeenCalled()
            expect(mockExecute).not.toHaveBeenCalled()
            expect(mockCreate).not.toHaveBeenCalled()
            expect(mockUpdate).not.toHaveBeenCalled()
        })

        it('TC-F08-05-18: rejects an int4-overflow parent ID before any database lookup or write', async () => {
            // Arrange
            const overflowParent = '2147483648'

            // Act
            const action = saveCategoryAction({ name: 'Overflow Child', parent: overflowParent })

            // Assert
            await expect(action).resolves.toEqual({ success: false, error: 'CATEGORY_PARENT_ID_INVALID' })
            expect(getPayload).not.toHaveBeenCalled()
            expect(mockExecute).not.toHaveBeenCalled()
            expect(mockCreate).not.toHaveBeenCalled()
            expect(mockUpdate).not.toHaveBeenCalled()
        })
        it.each([
            { label: 'zero', parent: '0' },
            { label: 'negative', parent: '-1' },
            { label: 'decimal', parent: '1.5' },
        ])('TC-F08-05-18: rejects a $label parent ID before any create or update', async ({ parent }) => {
            // Arrange
            const invalidParent = parent

            // Act
            const action = saveCategoryAction(
                { name: `Invalid ${parent} Child`, parent: invalidParent },
                'existing-category',
            )

            // Assert
            await expect(action).resolves.toEqual({ success: false, error: 'CATEGORY_PARENT_ID_INVALID' })
            expect(getPayload).not.toHaveBeenCalled()
            expect(mockExecute).not.toHaveBeenCalled()
            expect(mockCreate).not.toHaveBeenCalled()
            expect(mockUpdate).not.toHaveBeenCalled()
        })

    })

    describe('TC-F08-05-06: Delete & Field Access (GH-1587 H1)', () => {
        it('TC-F08-05-06: deleteCategoryAction still sets deletedAt despite field-level access: false', async () => {
            // Arrange: the delete path now uses one raw SQL statement instead of 2 payload.update
            // calls, so the regression proof is the returned deletedAt + the SQL soft-delete branch.
            mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion', tenant: 'tenant-456' })
            mockExecute.mockResolvedValue({
                rows: [{
                    direct_count: 0,
                    name_conflict_count: 0,
                    deleted: true,
                    deleted_doc: { deleted_at: '2026-07-16T00:00:00.000Z' },
                }],
            })

            const result = await deleteCategoryAction('cat-123')

            expect(result.deletedAt).toBe('2026-07-16T00:00:00.000Z')
            const sqlCall = mockExecute.mock.calls[2][0]
            expect(JSON.stringify(sqlCall)).toContain('deleted_at')
        })

        it('TC-F08-05-06: deleteCategoryAction no longer relies on payload.update to re-parent children', async () => {
            mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion', tenant: 'tenant-456' })
            mockExecute.mockResolvedValue({
                rows: [{
                    direct_count: 0,
                    name_conflict_count: 0,
                    deleted: true,
                    deleted_doc: { deleted_at: '2026-07-16T00:00:00.000Z' },
                }],
            })

            await deleteCategoryAction('cat-123')

            expect(mockUpdate).not.toHaveBeenCalled()
            const sqlCall = mockExecute.mock.calls[2][0]
            expect(JSON.stringify(sqlCall)).toContain('parent_id')
            expect(JSON.stringify(sqlCall)).toContain('breadcrumbs')
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

        it('TC-F08-05-09: Super-admin CANNOT nest under different tenant parent (not exempt from cross-tenant check)', async () => {
            // Arrange: super-admin is also subject to tenant-mismatch check
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

            // Act & Assert: super-admin CANNOT nest under different tenant's category
            const data = { name: 'Child', parent: 'parent-999', tenant: 'tenant-456' }
            await expect(
                hook({
                    data,
                    operation: 'create',
                    req,
                } as any)
            ).rejects.toThrow('CATEGORY_PARENT_TENANT_MISMATCH')
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

        it('TC-F08-05-11: CREATE-path field-strip belt-and-suspenders — tenant/site fields deny create for tenant users, exempt super-admin', async () => {
            // Regression: Belt-and-suspenders enforcement: even if a hook mistakenly allowed forged
            // tenant/site to pass, the field-level access.create strips them before persisting to DB
            // for tenant users. Super-admin is exempt (GH-1587 M5) so they can pick a tenant in the
            // admin sidebar — this grants no new privilege since super-admin already bypasses
            // collection-level access checks.
            const { Categories } = await import('@/collections/Categories')

            const tenantField = Categories.fields?.find((f: any) => f.name === 'tenant') as any
            const siteField = Categories.fields?.find((f: any) => f.name === 'site') as any

            expect(tenantField).toBeDefined()
            expect(tenantField.access).toBeDefined()
            expect(tenantField.access.create).toBeDefined()
            // Tenant user (no super-admin role): denied
            expect(tenantField.access.create({ req: { user: { roles: [] } } })).toBe(false)
            // Super-admin: exempt
            expect(tenantField.access.create({ req: { user: { roles: ['super-admin'] } } })).toBe(true)

            expect(siteField).toBeDefined()
            expect(siteField.access).toBeDefined()
            expect(siteField.access.create).toBeDefined()
            expect(siteField.access.create({ req: { user: { roles: [] } } })).toBe(false)
            expect(siteField.access.create({ req: { user: { roles: ['super-admin'] } } })).toBe(true)
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

    describe('TC-F08-05-14/15: Site/Tenant Consistency Guard (GH-1587 M5 adversarial follow-up)', () => {
        it('TC-F08-05-14: Super-admin supplying mismatched tenant+site — throws CATEGORY_SITE_TENANT_MISMATCH', async () => {
            // Regression: M5 exempted super-admin from the tenant/site field-level create lock,
            // making it newly possible for both to arrive in the same create payload (e.g. an
            // admin-panel sidebar mis-pick). Nothing previously checked that `site` actually
            // belongs to `tenant` — this guard closes that gap.
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: { tenants: [], roles: ['super-admin'] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'site-999',
                        tenant: 'tenant-OTHER', // site actually belongs to a different tenant
                    }),
                },
            }

            await expect(
                hook({
                    data: { name: 'Mismatched', tenant: 'tenant-456', site: 'site-999' },
                    operation: 'create',
                    req,
                } as any)
            ).rejects.toThrow('CATEGORY_SITE_TENANT_MISMATCH')
        })

        it('TC-F08-05-15: Super-admin supplying consistent tenant+site — no error thrown', async () => {
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: { tenants: [], roles: ['super-admin'] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'site-456',
                        tenant: 'tenant-456', // matches data.tenant
                    }),
                },
            }

            const data = { name: 'Consistent', tenant: 'tenant-456', site: 'site-456' }
            await expect(
                hook({ data, operation: 'create', req } as any)
            ).resolves.not.toThrow()

            // Assert: internal site lookup uses overrideAccess:true, not user-scoped access
            // (GH-1587 M6 — a `user: req.user, overrideAccess: false` lookup would 403 for
            // system/Local-API writes where req.user is undefined, since Sites' own read access
            // denies anonymous).
            expect(req.payload.findByID).toHaveBeenCalledWith(
                expect.objectContaining({ collection: 'sites', id: 'site-456', overrideAccess: true })
            )
        })

        it('TC-F08-05-16: System write (no req.user) with tenant+site — does not throw despite no user', async () => {
            // Regression (GH-1587 M6): seed.ts / AI generate-site call payload.create with
            // tenant+site but no `user`. Before the fix, the internal site lookup used
            // `user: req.user, overrideAccess: false` — with req.user undefined, Sites' own
            // `access.read` (`!req.user → false`) made findByID throw Forbidden, breaking both
            // paths. overrideAccess:true bypasses that entirely.
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: undefined,
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'site-456',
                        tenant: 'tenant-456',
                    }),
                },
            }

            const data = { name: 'Seed Category', tenant: 'tenant-456', site: 'site-456' }
            await expect(
                hook({ data, operation: 'create', req } as any)
            ).resolves.not.toThrow()
        })

        it('TC-F08-05-17: System write (no req.user) nesting under a parent — skips cross-tenant check instead of throwing', async () => {
            // Regression (GH-1587 M7): seed.ts creates nested categories (parent chains) with no
            // `user`. Before the fix, `ownerTenantId` derived from `req.user?.tenants` was always
            // `undefined` when req.user is absent, so the mismatch check fired unconditionally —
            // breaking `npm run seed`. No req.user means no client tenant identity to protect,
            // so the check should no-op rather than throw.
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: undefined,
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'parent-456',
                        parent: null,
                        tenant: 'tenant-456',
                    }),
                },
            }

            await expect(
                hook({
                    // `site` intentionally omitted — isolates this test to the parent-tenant
                    // guard; TC-F08-05-16 covers the separate site-tenant guard.
                    data: { name: 'Nested Seed Category', parent: 'parent-456', tenant: 'tenant-456' },
                    operation: 'create',
                    req,
                } as any)
            ).resolves.not.toThrow()
        })

        it('TC-F08-05-18: System write (no req.user) re-parenting on UPDATE — skips cross-tenant check instead of throwing', async () => {
            // Regression (GH-1587 M7, update-path coverage): the `!isSuperAdmin && req.user`
            // guard condition applies on both create and update. No current caller re-parents
            // without a user today, but nothing prevents one — this locks in the same no-throw
            // behavior for the update branch so a future system write doesn't regress silently.
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: undefined,
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'parent-789',
                        parent: null,
                        tenant: 'tenant-OTHER', // deliberately a different tenant than originalDoc
                    }),
                },
            }

            await expect(
                hook({
                    data: { parent: 'parent-789' },
                    operation: 'update',
                    originalDoc: { id: 'cat-123', tenant: 'tenant-456' },
                    req,
                } as any)
            ).resolves.not.toThrow()
        })
    })

    describe('TC-F08-05-19/20: Breadcrumb Effective-Parent Fix (full-PR review — partial update)', () => {
        it('TC-F08-05-19: Partial update omitting `parent` (e.g. DNA-only PATCH) preserves the existing breadcrumb prefix', async () => {
            // Regression: the DNA route (`dna/route.ts`) calls payload.update with only
            // `{ data: { dna: ... } }` — no `parent` key at all. Before the fix, the breadcrumb
            // hook gated on `if (data.parent)`, so an ABSENT key (not just an explicit null) fell
            // through to `data.breadcrumbs = name` — silently stripping the ancestor prefix from
            // every DNA edit on a nested category. The fix uses the effective parent
            // (data.parent !== undefined ? data.parent : originalDoc?.parent) instead.
            const { Categories } = await import('@/collections/Categories')
            const beforeChangeHook = Categories.hooks?.beforeChange?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }], roles: [] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'parent-456',
                        breadcrumbs: 'Parent Category',
                    }),
                },
            }

            const result = await beforeChangeHook({
                data: { dna: { signatureBlocks: ['hero'] } }, // `parent` intentionally omitted
                operation: 'update',
                originalDoc: {
                    id: 'cat-123',
                    name: 'Child Category',
                    parent: 'parent-456',
                    breadcrumbs: 'Parent Category > Child Category',
                },
                req,
            } as any)

            expect(result.breadcrumbs).toBe('Parent Category > Child Category')
            expect(req.payload.findByID).toHaveBeenCalledWith(
                expect.objectContaining({ collection: 'categories', id: 'parent-456' })
            )
        })

        it('TC-F08-05-20: Explicit `parent: null` (real re-parent-to-top-level) still produces a bare-name breadcrumb', async () => {
            // Regression guard: the fix must not treat an explicit `{ parent: null }` re-parent
            // payload the same as an omitted key — null still means "no parent."
            const { Categories } = await import('@/collections/Categories')
            const beforeChangeHook = Categories.hooks?.beforeChange?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }], roles: [] },
                payload: { findByID: vi.fn() },
            }

            const result = await beforeChangeHook({
                data: { parent: null },
                operation: 'update',
                originalDoc: {
                    id: 'cat-123',
                    name: 'Child Category',
                    parent: 'parent-456',
                    breadcrumbs: 'Parent Category > Child Category',
                },
                req,
            } as any)

            expect(result.breadcrumbs).toBe('Child Category')
            expect(req.payload.findByID).not.toHaveBeenCalled()
        })
    })

    describe('TC-F08-05-21/22: Soft-Deleted Categories Excluded From Parent Selection (full-PR review)', () => {
        it('TC-F08-05-21: Tenant user read access excludes soft-deleted categories', async () => {
            // Regression: without this, a soft-deleted category was still resolvable by any
            // tenant user (ancestor-walk findByID, or the native admin panel's relationship
            // picker), letting a new category get nested under an invisible parent and silently
            // vanish from the dashboard tree.
            const { Categories } = await import('@/collections/Categories')
            const readAccess = Categories.access?.read as any

            const result = readAccess({ req: { user: { tenants: [{ tenant: 'tenant-456' }], roles: [] } } })

            expect(result).toEqual({
                and: [{ tenant: { in: ['tenant-456'] } }, { deletedAt: { exists: false } }],
            })
        })

        it('TC-F08-05-21: Super-admin read access stays unrestricted (still `true`)', async () => {
            const { Categories } = await import('@/collections/Categories')
            const readAccess = Categories.access?.read as any

            const result = readAccess({ req: { user: { roles: ['super-admin'] } } })

            expect(result).toBe(true)
        })

        it('TC-F08-05-22: `parent` field filterOptions excludes soft-deleted categories', async () => {
            const { Categories } = await import('@/collections/Categories')
            const parentField = Categories.fields?.find((f: any) => f.name === 'parent') as any

            const resultNoId = parentField.filterOptions({ id: undefined })
            expect(resultNoId).toEqual({ deletedAt: { exists: false } })

            const resultWithId = parentField.filterOptions({ id: 'cat-123' })
            expect(resultWithId).toEqual({
                and: [{ deletedAt: { exists: false } }, { id: { not_equals: 'cat-123' } }],
            })
        })
    })

    describe('TC-F08-05-23: Null-Safe Relationship Unwrap (full-PR review)', () => {
        it('TC-F08-05-23: A relationship that resolves to null does not throw — cross-tenant guard still fires safely', async () => {
            // Regression: `typeof x === 'object'` is `true` for `null` in JS. Before the fix,
            // `candidateDoc.tenant === null` (e.g. Payload resolving a broken/orphaned relation)
            // would throw `TypeError: Cannot read properties of null` on `.id` instead of falling
            // through to the fail-closed CATEGORY_PARENT_TENANT_MISMATCH throw.
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }], roles: [] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'parent-456',
                        parent: null,
                        tenant: null, // relationship resolved to null, not an id or populated object
                    }),
                },
            }

            await expect(
                hook({
                    data: { name: 'Child', parent: 'parent-456', tenant: 'tenant-456' },
                    operation: 'create',
                    req,
                } as any)
            ).rejects.toThrow('CATEGORY_PARENT_TENANT_MISMATCH')
        })
    })

    describe('TC-F08-05-29/30: disableErrors on parent/breadcrumb lookups (full-PR review)', () => {
        it('TC-F08-05-29: Ancestor-walk findByID is called with disableErrors:true', async () => {
            // Regression: Payload's findByID THROWS (Forbidden/NotFound) by default when
            // access.read's Where-filter excludes the target doc — verified empirically against
            // a real Payload instance, not just assumed. Without disableErrors:true, a
            // cross-tenant or soft-deleted parent would throw a raw error instead of resolving
            // undefined, aborting the write before CATEGORY_PARENT_TENANT_MISMATCH could fire.
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }], roles: [] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({ id: 'parent-456', parent: null, tenant: 'tenant-456' }),
                },
            }

            await hook({
                data: { name: 'Child', parent: 'parent-456', tenant: 'tenant-456' },
                operation: 'create',
                req,
            } as any)

            expect(req.payload.findByID).toHaveBeenCalledWith(
                expect.objectContaining({ collection: 'categories', id: 'parent-456', disableErrors: true })
            )
        })

        it('TC-F08-05-29: Breadcrumb findByID is called with disableErrors:true', async () => {
            const { Categories } = await import('@/collections/Categories')
            const beforeChangeHook = Categories.hooks?.beforeChange?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }], roles: [] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({ id: 'parent-456', breadcrumbs: 'Parent' }),
                },
            }

            await beforeChangeHook({
                data: { name: 'Child', parent: 'parent-456' },
                operation: 'update',
                originalDoc: { id: 'cat-123', name: 'Child' },
                req,
            } as any)

            expect(req.payload.findByID).toHaveBeenCalledWith(
                expect.objectContaining({ collection: 'categories', id: 'parent-456', disableErrors: true })
            )
        })

        it('TC-F08-05-29: Inaccessible parent (findByID resolves undefined via disableErrors) throws CATEGORY_PARENT_TENANT_MISMATCH for a tenant user, not a raw error', async () => {
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }], roles: [] },
                payload: {
                    // Simulates disableErrors:true resolving undefined for an inaccessible parent
                    findByID: vi.fn().mockResolvedValueOnce(undefined),
                },
            }

            await expect(
                hook({
                    data: { name: 'Child', parent: 'parent-999', tenant: 'tenant-456' },
                    operation: 'create',
                    req,
                } as any)
            ).rejects.toThrow('CATEGORY_PARENT_TENANT_MISMATCH')
        })

        it('TC-F08-05-30: Nesting under a soft-deleted parent throws CATEGORY_PARENT_SOFT_DELETED — even for super-admin', async () => {
            // Regression: access.read's deletedAt exclusion only blocks this implicitly for
            // tenant users (their read is filtered, findByID resolves undefined). Super-admin's
            // read access is unrestricted (`true`), so candidateDoc WOULD still resolve a
            // soft-deleted doc without this explicit check — contradicting the stated invariant
            // that nesting under a deleted parent is "structurally wrong for everyone."
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: { roles: ['super-admin'] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'parent-456',
                        parent: null,
                        tenant: 'tenant-456',
                        deletedAt: '2026-01-01T00:00:00.000Z',
                    }),
                },
            }

            await expect(
                hook({
                    data: { name: 'Child', parent: 'parent-456', tenant: 'tenant-456' },
                    operation: 'create',
                    req,
                } as any)
            ).rejects.toThrow('CATEGORY_PARENT_SOFT_DELETED')
        })

        it('TC-F08-05-30: Nesting under a non-deleted parent does not throw CATEGORY_PARENT_SOFT_DELETED', async () => {
            const { Categories } = await import('@/collections/Categories')
            const hook = Categories.hooks?.beforeValidate?.[0] as any

            const req = {
                user: { tenants: [{ tenant: 'tenant-456' }], roles: [] },
                payload: {
                    findByID: vi.fn().mockResolvedValueOnce({
                        id: 'parent-456',
                        parent: null,
                        tenant: 'tenant-456',
                        // no deletedAt
                    }),
                },
            }

            await expect(
                hook({
                    data: { name: 'Child', parent: 'parent-456', tenant: 'tenant-456' },
                    operation: 'create',
                    req,
                } as any)
            ).resolves.not.toThrow()
        })
    })

    describe('Action Layer Security (saveCategoryAction)', () => {
        it('TC-F08-05-31: saveCategoryAction does NOT bypass collection-level access.create/update (overrideAccess: false)', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({ id: 'cat-123' })
            mockUpdate.mockResolvedValue({ id: 'cat-123' })
            
            // Act
            await saveCategoryAction({ name: 'New Cat' } as any)
            await saveCategoryAction({ name: 'Updated Cat' } as any, 'cat-123')

            // Assert: overrideAccess must be false so Payload's collection access.create/update runs 
            // (which enforces the product_management plan check).
            expect(mockCreate).toHaveBeenCalled()
            expect(mockCreate.mock.calls[0][0].overrideAccess).toBe(false)
            
            expect(mockUpdate).toHaveBeenCalled()
            expect(mockUpdate.mock.calls[0][0].overrideAccess).toBe(false)
        })

        it('TC-F08-05-32: saveCategoryAction cannot update a foreign-tenant category by known id', async () => {
            // Arrange: emulate Payload Local API enforcing Categories.access.update against
            // the target doc. This should reject if the action tries to update tenant B's
            // category while authenticated as tenant A.
            mockExecute.mockResolvedValue({ rows: [] })
            mockFind.mockImplementation(async (args: { collection: string }) => {
                if (args.collection === 'plan-subscriptions') {
                    return {
                        docs: [{ id: 'sub-123', plan: 'PROFESSIONAL_TM_USER', status: 'active', endsAt: '2099-01-01T00:00:00.000Z' }],
                    }
                }
                if (args.collection === 'plan-features') {
                    return { docs: [{ value: 'YES' }] }
                }
                throw new Error('Unexpected collection: ' + args.collection)
            })

            const { Categories } = await import('@/collections/Categories')
            const updateAccess = Categories.access?.update as NonNullable<typeof Categories.access>['update']
            expect(updateAccess).toBeTypeOf('function')

            mockUpdate.mockImplementation(async (args: {
                id: string
                user?: typeof mockCurrentUser
                overrideAccess?: boolean
            }) => {
                if (args.overrideAccess !== false || !args.user) {
                    throw new Error('TEST_SETUP_BROKEN')
                }

                const accessResult = await updateAccess({ req: { user: args.user, payload: mockPayload } } as any)
                if (accessResult === false) {
                    throw new Error('Forbidden')
                }
                if (
                    typeof accessResult === 'object' &&
                    'tenant' in accessResult &&
                    args.id === 'cat-tenant-b'
                ) {
                    const allowedTenantIds = Array.isArray((accessResult as any).tenant?.in)
                        ? (accessResult as any).tenant.in.map(String)
                        : []
                    const targetTenantId = 'tenant-b'
                    if (!allowedTenantIds.includes(targetTenantId)) {
                        throw new Error('Forbidden')
                    }
                }

                return { id: args.id }
            })

            // Act + Assert: tenant A must not be able to update tenant B's category, even
            // if they know its id, because the action leaves access enforcement on.
            await expect(
                saveCategoryAction({ name: 'Hijack Attempt' } as any, 'cat-tenant-b')
            ).rejects.toThrow('Forbidden')

            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'cat-tenant-b',
                    user: mockCurrentUser,
                    overrideAccess: false,
                })
            )
        })
    })
})
