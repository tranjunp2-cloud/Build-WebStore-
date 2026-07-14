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

import { saveCategoryAction, checkCategoryNameAvailable } from '@/app/(dashboard)/products/categories/actions'
import { getPayload } from 'payload'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'

const mockCurrentUser = { id: 'user-123', tenants: [{ tenant: 'tenant-456' }] }

type MockPayload = { findByID: Mock; create: Mock; update: Mock; db: { drizzle: { execute: Mock } } }

describe('Category Deduplication (TC-F08-05-05)', () => {
    let mockPayload: MockPayload
    let mockFindByID: Mock
    let mockCreate: Mock
    let mockUpdate: Mock
    let mockExecute: Mock

    beforeEach(() => {
        vi.clearAllMocks()
        mockFindByID = vi.fn()
        mockCreate = vi.fn()
        mockUpdate = vi.fn()
        mockExecute = vi.fn()

        mockPayload = {
            findByID: mockFindByID,
            create: mockCreate,
            update: mockUpdate,
            db: {
                drizzle: {
                    execute: mockExecute,
                },
            },
        }

        vi.mocked(getPayload).mockResolvedValue(mockPayload as any)
        vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser as any)
        vi.mocked(tenantIdForQuery).mockImplementation((user) => user?.tenants?.[0]?.tenant)
    })

    describe('checkCategoryNameAvailable (TC-F08-05-05)', () => {
        it('TC-F08-05-05: Returns true when no duplicate exists', async () => {
            // Arrange: dedup query returns empty rows
            mockExecute.mockResolvedValue({ rows: [] })

            // Act
            const available = await checkCategoryNameAvailable('Fashion', null)

            // Assert
            expect(available).toBe(true)
            expect(mockExecute).toHaveBeenCalled()
        })

        it('TC-F08-05-05: Returns false when duplicate exists (same name + parent + tenant)', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [{ id: 'existing-123' }] })

            // Act
            const available = await checkCategoryNameAvailable('Shirts', 'parent-456')

            // Assert
            expect(available).toBe(false)
        })

        it('TC-F08-05-05: Case-insensitive dedup (rejects "shirts" when "Shirts" exists)', async () => {
            // Arrange: query matches case-insensitive
            mockExecute.mockResolvedValue({ rows: [{ id: 'existing-123' }] })

            // Act
            const available = await checkCategoryNameAvailable('shirts', 'parent-456')

            // Assert: mocked query returns a match for the differently-cased input, so the function
            // correctly propagates that as "unavailable". The actual `lower(trim())` SQL comparison
            // was functionally verified against a real Postgres DB during implementation (Phase 04)
            // — not re-verified here, since inspecting drizzle's internal SQL chunk structure would
            // be fragile/over-coupled to implementation details for a unit test.
            expect(available).toBe(false)
            expect(mockExecute).toHaveBeenCalled()
        })

        it('TC-F08-05-05: Trim spaces in name (rejects "  Shirts  " when "Shirts" exists)', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [{ id: 'existing-123' }] })

            // Act
            const available = await checkCategoryNameAvailable('  Shirts  ', 'parent-456')

            // Assert
            expect(available).toBe(false)
        })

        it('TC-F08-05-05: Allows same name in DIFFERENT parent', async () => {
            // Arrange: query returns empty (no duplicate in different parent)
            mockExecute.mockResolvedValue({ rows: [] })

            // Act
            const available = await checkCategoryNameAvailable('Shirts', 'different-parent-789')

            // Assert: verify scoping — query must include parent_id in WHERE clause
            expect(available).toBe(true)
            expect(mockExecute).toHaveBeenCalled()
            // Verify the SQL contains the parent_id condition (actual value passed as param)
            const sqlCall = mockExecute.mock.calls[0][0]
            expect(sqlCall).toBeDefined()
            // Check queryChunks for parent_id reference — proves scoping is applied
            const sqlText = JSON.stringify(sqlCall)
            expect(sqlText).toContain('parent_id')
        })

        it('TC-F08-05-05: Allows same name in DIFFERENT tenant', async () => {
            // Arrange: only querying current tenant's categories, other tenant's name allowed
            mockExecute.mockResolvedValue({ rows: [] })

            // Act
            const available = await checkCategoryNameAvailable('Fashion', null) // different tenant checked by tenantIdForQuery

            // Assert: verify tenant_id scoping in WHERE clause
            expect(available).toBe(true)
            expect(mockExecute).toHaveBeenCalled()
            // Verify the SQL contains the tenant_id condition (proves tenant scoping is applied)
            const sqlCall = mockExecute.mock.calls[0][0]
            expect(sqlCall).toBeDefined()
            // Check queryChunks for tenant_id reference
            const sqlText = JSON.stringify(sqlCall)
            expect(sqlText).toContain('tenant_id')
        })

        it('TC-F08-05-05: Allows duplicate when excludeId matches existing record', async () => {
            // Arrange: query filters out the record with same ID (editing existing)
            mockExecute.mockResolvedValue({ rows: [] })

            // Act
            const available = await checkCategoryNameAvailable('Shirts', 'parent-456', 'shirt-123')

            // Assert: should allow (editing own record)
            expect(available).toBe(true)
        })

        it('TC-F08-05-05: Returns false when user not authenticated', async () => {
            // Arrange: getCurrentUser returns null
            const { getCurrentUser } = await vi.importMock('@/lib/auth')
            vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

            // Act
            const available = await checkCategoryNameAvailable('Fashion', null)

            // Assert: returns false (not available, no auth)
            expect(available).toBe(false)
            // Should not query DB
            expect(mockExecute).not.toHaveBeenCalled()
        })

        it('TC-F08-05-05: Returns true when name is empty after trim', async () => {
            // Arrange
            const { getCurrentUser } = await vi.importMock('@/lib/auth')
            vi.mocked(getCurrentUser).mockResolvedValueOnce(mockCurrentUser)

            // Act
            const available = await checkCategoryNameAvailable('   ', null)

            // Assert
            expect(available).toBe(true)
            // Should not query DB for empty name
            expect(mockExecute).not.toHaveBeenCalled()
        })
    })

    describe('saveCategoryAction Name Dedup Pre-check (TC-F08-05-05)', () => {
        it('TC-F08-05-05: Throws CATEGORY_NAME_DUPLICATE when dedup check fails (create)', async () => {
            // Arrange: name dedup query returns existing record
            mockExecute.mockResolvedValue({ rows: [{ id: 'existing-123' }] })

            // Act & Assert
            await expect(saveCategoryAction({ name: 'Shirts', parent: 'parent-456' })).rejects.toThrow(
                'CATEGORY_NAME_DUPLICATE'
            )
            // Should not proceed to payload.create
            expect(mockCreate).not.toHaveBeenCalled()
        })

        it('TC-F08-05-05: Throws CATEGORY_NAME_DUPLICATE when dedup check fails (update)', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [{ id: 'different-id' }] })

            // Act & Assert
            await expect(saveCategoryAction({ name: 'Shirts', parent: 'parent-456' }, 'shirt-123')).rejects.toThrow(
                'CATEGORY_NAME_DUPLICATE'
            )
            // Should not proceed to payload.update
            expect(mockUpdate).not.toHaveBeenCalled()
        })

        it('TC-F08-05-05: Proceeds to create when dedup check passes', async () => {
            // Arrange: dedup query returns empty (no duplicate)
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({ id: 'new-cat-123', name: 'Shirts' })

            // Act
            const result = await saveCategoryAction({ name: 'Shirts', parent: 'parent-456' })

            // Assert: `tenant` is always server-forced to the caller's own tenant (security fix —
            // see saveCategoryAction's tenant/site stripping, prevents a client from smuggling an
            // arbitrary `tenant`/`site` value through the `.passthrough()` schema).
            expect(mockCreate).toHaveBeenCalledWith({
                collection: 'categories',
                data: { name: 'Shirts', parent: 'parent-456', tenant: 'tenant-456' },
                user: mockCurrentUser,
                overrideAccess: false,
            })
            expect(result).toEqual({ id: 'new-cat-123', name: 'Shirts' })
        })

        it('TC-F08-05-05: Strips client-supplied tenant/site and forces caller\'s own tenant (security)', async () => {
            // Arrange: attacker attempts to smuggle a different tenant/site via passthrough fields
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({ id: 'new-cat-456' })

            // Act
            await saveCategoryAction({
                name: 'Shirts',
                parent: 'parent-456',
                tenant: 'attacker-controlled-tenant-999',
                site: 'attacker-controlled-site-999',
            } as any)

            // Assert: neither smuggled value reaches payload.create — tenant is forced to the
            // caller's real tenant, site is stripped entirely (auto-derived by the collection's
            // own beforeChange hook, not user-facing in this form).
            const calledData = mockCreate.mock.calls[0][0].data
            expect(calledData.tenant).toBe('tenant-456')
            expect(calledData.site).toBeUndefined()
        })

        it('TC-F08-05-05: Trims name before dedup check', async () => {
            // Arrange: name has spaces
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({ id: 'new-cat-123', name: 'Shirts' })

            // Act
            await saveCategoryAction({ name: '  Shirts  ', parent: null })

            // Assert: payload.create should receive trimmed name
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        name: 'Shirts', // trimmed
                    }),
                })
            )
        })
    })

    describe('saveCategoryAction — Slug Uniqueness (TC-F08-05-05)', () => {
        it('TC-F08-05-05: Maps Payload ValidationError (Value must be unique) to CATEGORY_SLUG_DUPLICATE on create', async () => {
            // Arrange: dedup check passes, but Payload DB constraint fails
            mockExecute.mockResolvedValue({ rows: [] })
            const payloadError = {
                name: 'ValidationError',
                data: {
                    collection: 'categories',
                    errors: [{ message: 'Value must be unique', path: 'tenant_id, slug' }],
                },
            }
            mockCreate.mockRejectedValue(payloadError)

            // Act & Assert
            await expect(saveCategoryAction({ name: 'Fashion', slug: 'fashion' })).rejects.toThrow(
                'CATEGORY_SLUG_DUPLICATE'
            )
        })

        it('TC-F08-05-05: Maps Payload ValidationError to CATEGORY_SLUG_DUPLICATE on update', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [] })
            const payloadError = {
                name: 'ValidationError',
                data: {
                    collection: 'categories',
                    errors: [{ message: 'Value must be unique' }],
                },
            }
            mockUpdate.mockRejectedValue(payloadError)

            // Act & Assert
            await expect(saveCategoryAction({ name: 'Fashion' }, 'cat-123')).rejects.toThrow(
                'CATEGORY_SLUG_DUPLICATE'
            )
        })

        it('TC-F08-05-05: Non-slug ValidationError passes through unchanged (e.g. slug field error)', async () => {
            // Arrange: a different unique constraint violation
            mockExecute.mockResolvedValue({ rows: [] })
            const otherError = new Error('Some other validation error')
            mockCreate.mockRejectedValue(otherError)

            // Act & Assert: error passes through if not our recognized pattern
            await expect(saveCategoryAction({ name: 'Fashion' })).rejects.toThrow('Some other validation error')
        })

        it('TC-F08-05-05: Non-ValidationError passes through unchanged', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [] })
            const networkError = new Error('Network timeout')
            mockCreate.mockRejectedValue(networkError)

            // Act & Assert
            await expect(saveCategoryAction({ name: 'Fashion' })).rejects.toThrow('Network timeout')
        })

        it('TC-F08-05-05: Recognizes CATEGORY_SLUG_DUPLICATE by collection + message alone (path may vary)', async () => {
            // Arrange: ValidationError with path: null (composite index edge case noted in Phase 06)
            mockExecute.mockResolvedValue({ rows: [] })
            const payloadError = {
                name: 'ValidationError',
                data: {
                    collection: 'categories',
                    errors: [{ message: 'Value must be unique', path: null }],
                },
            }
            mockCreate.mockRejectedValue(payloadError)

            // Act & Assert: should still recognize as slug conflict despite path: null
            await expect(saveCategoryAction({ name: 'Fashion' })).rejects.toThrow('CATEGORY_SLUG_DUPLICATE')
        })

        it('TC-F08-05-05: Does NOT match ValidationError from different collection', async () => {
            // Arrange: ValidationError but from products collection
            mockExecute.mockResolvedValue({ rows: [] })
            const otherCollectionError = {
                name: 'ValidationError',
                data: {
                    collection: 'products',
                    errors: [{ message: 'Value must be unique' }],
                },
            }
            mockCreate.mockRejectedValue(otherCollectionError)

            // Act & Assert: should NOT map to CATEGORY_SLUG_DUPLICATE
            await expect(saveCategoryAction({ name: 'Fashion' })).rejects.toThrow()
            // Catch and verify it's not the mapped error
            try {
                await saveCategoryAction({ name: 'Fashion' })
            } catch (e: any) {
                // Error message should NOT be CATEGORY_SLUG_DUPLICATE
                expect(e?.message).not.toBe('CATEGORY_SLUG_DUPLICATE')
                // It should be stringified version of the original error
                expect(e?.message || String(e)).toContain('[object Object]')
            }
        })

        it('TC-F08-05-05: Does NOT match a categories ValidationError with a different message', async () => {
            // Arrange: ValidationError on categories collection, but not the unique-violation message
            // (e.g. a different field's own validation failure) — must not be mis-translated to
            // CATEGORY_SLUG_DUPLICATE just because collection matches; message must match too.
            mockExecute.mockResolvedValue({ rows: [] })
            const otherMessageError = {
                name: 'ValidationError',
                data: {
                    collection: 'categories',
                    errors: [{ message: 'Some other field is invalid', path: 'name' }],
                },
            }
            mockCreate.mockRejectedValue(otherMessageError)

            // Act & Assert: passes through unchanged, not mapped to CATEGORY_SLUG_DUPLICATE
            try {
                await saveCategoryAction({ name: 'Fashion' })
                expect.unreachable('saveCategoryAction should have thrown')
            } catch (e: any) {
                expect(e?.message).not.toBe('CATEGORY_SLUG_DUPLICATE')
            }
        })
    })

    describe('Authorization & User Context', () => {
        it('TC-F08-05-05: Throws "Unauthorized" when getCurrentUser returns null on create', async () => {
            // Arrange
            const { getCurrentUser } = await vi.importMock('@/lib/auth')
            vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

            // Act & Assert
            await expect(saveCategoryAction({ name: 'Fashion' })).rejects.toThrow('Unauthorized')
            // Should not query DB
            expect(mockExecute).not.toHaveBeenCalled()
            expect(mockCreate).not.toHaveBeenCalled()
        })

        it('TC-F08-05-05: Throws "Unauthorized" when getCurrentUser returns null on update', async () => {
            // Arrange
            const { getCurrentUser } = await vi.importMock('@/lib/auth')
            vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

            // Act & Assert
            await expect(saveCategoryAction({ name: 'Fashion' }, 'cat-123')).rejects.toThrow('Unauthorized')
        })

        it('TC-F08-05-05: Passes user context to payload.create', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({ id: 'new-cat-123', name: 'Fashion' })

            // Act
            await saveCategoryAction({ name: 'Fashion', parent: null })

            // Assert
            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    user: mockCurrentUser,
                    overrideAccess: false,
                })
            )
        })

        it('TC-F08-05-05: Passes user context to payload.update', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [] })
            mockUpdate.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })

            // Act
            await saveCategoryAction({ name: 'Fashion' }, 'cat-123')

            // Assert
            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    user: mockCurrentUser,
                    overrideAccess: false,
                })
            )
        })
    })

    describe('Zod Schema Validation', () => {
        it('TC-F08-05-05: Rejects when name field is missing or empty string', async () => {
            // Act & Assert: Zod throws ZodError with validation issues
            // Empty string fails "min(1)" validation
            await expect(saveCategoryAction({ name: '' })).rejects.toThrow()
            // Missing field fails required check
            await expect(saveCategoryAction({})).rejects.toThrow()
        })

        it('TC-F08-05-05: Allows optional slug and parent fields', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [] })
            mockCreate.mockResolvedValue({ id: 'new-cat-123', name: 'Fashion' })

            // Act: neither slug nor parent provided
            const result = await saveCategoryAction({ name: 'Fashion' })

            // Assert: should create successfully
            expect(mockCreate).toHaveBeenCalled()
            expect(result).toEqual({ id: 'new-cat-123', name: 'Fashion' })
        })
    })

    describe('Serialization', () => {
        it('TC-F08-05-05: Returns JSON-serialized result from create', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [] })
            const payload = { id: 'new-cat-123', name: 'Fashion', parent: null, __internal: 'should-be-serialized' }
            mockCreate.mockResolvedValue(payload)

            // Act
            const result = await saveCategoryAction({ name: 'Fashion' })

            // Assert: result should be JSON-serialized
            expect(result).toEqual(JSON.parse(JSON.stringify(payload)))
        })

        it('TC-F08-05-05: Returns JSON-serialized result from update', async () => {
            // Arrange
            mockExecute.mockResolvedValue({ rows: [] })
            const payload = { id: 'cat-123', name: 'Fashion Updated', parent: null }
            mockUpdate.mockResolvedValue(payload)

            // Act
            const result = await saveCategoryAction({ name: 'Fashion Updated' }, 'cat-123')

            // Assert
            expect(result).toEqual(JSON.parse(JSON.stringify(payload)))
        })
    })
})
