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

import { deleteCategoryAction } from '@/app/(dashboard)/products/categories/actions'
import { getPayload } from 'payload'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'

const mockCurrentUser = { id: 'user-123', tenants: [{ tenant: 'tenant-456' }] }

type MockPayload = { findByID: Mock; find: Mock; update: Mock; db: { drizzle: { execute: Mock } } }

describe('deleteCategoryAction (TC-F08-05-06)', () => {
    let mockPayload: MockPayload
    let mockFindByID: Mock
    let mockFind: Mock
    let mockUpdate: Mock
    let mockExecute: Mock

    beforeEach(() => {
        vi.clearAllMocks()
        mockFindByID = vi.fn()
        mockFind = vi.fn()
        mockUpdate = vi.fn()
        mockExecute = vi.fn()

        mockPayload = {
            findByID: mockFindByID,
            find: mockFind,
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

    describe('Access Control', () => {
        it('TC-F08-05-06: Calls findByID BEFORE raw-SQL count query (security check first)', async () => {
            // Arrange: findByID succeeds, count query returns 0
            mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion', parent: null })
            mockExecute.mockResolvedValue({ rows: [{ count: 0 }] })
            mockFind.mockResolvedValue({ docs: [] }) // No children
            mockUpdate.mockResolvedValue({ id: 'cat-123', deletedAt: expect.any(String) })

            // Act
            await deleteCategoryAction('cat-123')

            // Assert: findByID called (access control check)
            expect(mockFindByID).toHaveBeenCalledWith({
                collection: 'categories',
                id: 'cat-123',
                user: mockCurrentUser,
                overrideAccess: false,
            })
            // SQL count query should also be called
            expect(mockExecute).toHaveBeenCalled()
        })

        it('TC-F08-05-06: Throws if findByID denies access (no count query after)', async () => {
            // Arrange: findByID rejects (user not authorized for this tenant's category)
            const accessError = new Error('Product not found or access denied')
            mockFindByID.mockRejectedValue(accessError)

            // Act & Assert
            await expect(deleteCategoryAction('cat-999')).rejects.toThrow('Product not found or access denied')
            // Raw SQL query should NOT run
            expect(mockExecute).not.toHaveBeenCalled()
        })
    })

    describe('Hard-block: Direct Product Count', () => {
        it('TC-F08-05-06: Throws CATEGORY_HAS_PRODUCTS:N when direct product count > 0', async () => {
            // Arrange
            mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
            mockExecute.mockResolvedValue({ rows: [{ count: 5 }] })

            // Act & Assert
            await expect(deleteCategoryAction('cat-123')).rejects.toThrow('CATEGORY_HAS_PRODUCTS:5')
            // No subsequent updates should happen
            expect(mockFind).not.toHaveBeenCalled()
            expect(mockUpdate).not.toHaveBeenCalled()
        })

        it('TC-F08-05-06: Error message includes exact product count for UX display', async () => {
            // Arrange
            mockFindByID.mockResolvedValue({ id: 'cat-123' })
            mockExecute.mockResolvedValue({ rows: [{ count: 17 }] })

            // Act & Assert
            await expect(deleteCategoryAction('cat-123')).rejects.toThrow('CATEGORY_HAS_PRODUCTS:17')
        })

        it('TC-F08-05-06: Returns 0 count gracefully (no count in result)', async () => {
            // Arrange: row is missing or count field undefined
            mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
            mockExecute.mockResolvedValue({ rows: [{}] })
            mockFind.mockResolvedValue({ docs: [] })
            mockUpdate.mockResolvedValue({ id: 'cat-123', deletedAt: expect.any(String) })

            // Act
            await deleteCategoryAction('cat-123')

            // Assert: should complete without error (count treated as 0)
            expect(mockFind).toHaveBeenCalledWith({
                collection: 'categories',
                where: { parent: { equals: 'cat-123' }, deletedAt: { exists: false } },
                limit: 1000,
                user: mockCurrentUser,
                overrideAccess: false,
            })
        })
    })

    describe('Re-parent Direct Children', () => {
        it('TC-F08-05-06: Re-parents direct children to parent: null when count is 0', async () => {
            // Arrange
            mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
            mockExecute.mockResolvedValue({ rows: [{ count: 0 }] })
            mockFind.mockResolvedValue({
                docs: [
                    { id: 'child-1', name: 'Men', parent: 'cat-123' },
                    { id: 'child-2', name: 'Women', parent: 'cat-123' },
                ],
            })
            mockUpdate.mockResolvedValue({ id: expect.any(String) })

            // Act
            await deleteCategoryAction('cat-123')

            // Assert: mockUpdate called 3 times (2x re-parent children, 1x soft-delete self)
            expect(mockUpdate).toHaveBeenCalledTimes(3)
            // First two updates: re-parent children to null
            // overrideAccess:true — access already gated by findByID check above (GH-1587 H1)
            expect(mockUpdate).toHaveBeenNthCalledWith(1, {
                collection: 'categories',
                id: 'child-1',
                data: { parent: null },
                user: mockCurrentUser,
                overrideAccess: true,
            })
            expect(mockUpdate).toHaveBeenNthCalledWith(2, {
                collection: 'categories',
                id: 'child-2',
                data: { parent: null },
                user: mockCurrentUser,
                overrideAccess: true,
            })
        })

        it('TC-F08-05-06: Soft-deletes parent category after children are re-parented', async () => {
            // Arrange
            mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
            mockExecute.mockResolvedValue({ rows: [{ count: 0 }] })
            mockFind.mockResolvedValue({ docs: [{ id: 'child-1', parent: 'cat-123' }] })
            mockUpdate.mockResolvedValue({ id: expect.any(String) })

            // Act
            await deleteCategoryAction('cat-123')

            // Assert: second update call deletes the parent category
            // overrideAccess:true — `deletedAt` now carries `access: { update: () => false }`
            // Access already verified by findByID check (GH-1587 H1)
            expect(mockUpdate).toHaveBeenNthCalledWith(2, {
                collection: 'categories',
                id: 'cat-123',
                data: {
                    deletedAt: expect.any(String),
                },
                user: mockCurrentUser,
                overrideAccess: true,
            })
            // Verify deletedAt is an ISO timestamp
            const lastCall = mockUpdate.mock.calls[1][0]
            expect(lastCall.data.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        })

        it('TC-F08-05-06: No children to re-parent when category has no direct children', async () => {
            // Arrange
            mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
            mockExecute.mockResolvedValue({ rows: [{ count: 0 }] })
            mockFind.mockResolvedValue({ docs: [] }) // No children

            mockUpdate.mockResolvedValue({ id: expect.any(String) })

            // Act
            await deleteCategoryAction('cat-123')

            // Assert: only one update call (soft-delete, no re-parent)
            // overrideAccess:true — access already verified by findByID, `deletedAt` field access denied (GH-1587 H1)
            expect(mockUpdate).toHaveBeenCalledTimes(1)
            expect(mockUpdate).toHaveBeenCalledWith({
                collection: 'categories',
                id: 'cat-123',
                data: {
                    deletedAt: expect.any(String),
                },
                user: mockCurrentUser,
                overrideAccess: true,
            })
        })
    })

    describe('Return Value', () => {
        it('TC-F08-05-06: Returns serialized category record after deletion', async () => {
            // Arrange
            mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
            mockExecute.mockResolvedValue({ rows: [{ count: 0 }] })
            mockFind.mockResolvedValue({ docs: [] })
            const deletedRecord = {
                id: 'cat-123',
                name: 'Fashion',
                parent: null,
                deletedAt: '2026-07-13T12:00:00Z',
            }
            mockUpdate.mockResolvedValue(deletedRecord)

            // Act
            const result = await deleteCategoryAction('cat-123')

            // Assert: returns JSON-serialized record
            expect(result).toEqual(deletedRecord)
        })
    })

    describe('SQL Query Accuracy', () => {
        // Extracts the raw SQL text from a drizzle `sql` tagged-template object, skipping
        // interpolated param values — drizzle's SQL object exposes its literal text segments as
        // `{value: [text]}` chunks in `.queryChunks`, interleaved with raw param values.
        function extractSqlText(sqlObj: { queryChunks?: unknown[] }): string {
            return (sqlObj.queryChunks ?? [])
                .map(chunk =>
                    chunk && typeof chunk === 'object' && Array.isArray((chunk as { value?: unknown[] }).value)
                        ? (chunk as { value: string[] }).value.join('')
                        : ''
                )
                .join('')
        }

        it('TC-F08-05-06: Counts DIRECT products only (not descendants) — verifies actual SQL text', async () => {
            // Arrange
            mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
            mockExecute.mockResolvedValue({ rows: [{ count: 0 }] })
            mockFind.mockResolvedValue({ docs: [] })
            mockUpdate.mockResolvedValue({ id: 'cat-123' })

            // Act
            await deleteCategoryAction('cat-123')

            // Assert: real SQL text (not just "was called with something") joins products_rels
            // directly on this category's id — no recursive/descendant traversal, matching the
            // "direct-only" hard-block decision (confirmed by user 2026-07-10).
            expect(mockExecute).toHaveBeenCalled()
            const sqlText = extractSqlText(mockExecute.mock.calls[0][0])
            expect(sqlText).toContain('products_rels')
            expect(sqlText).toContain('r.categories_id')
            expect(sqlText).toContain("r.path = 'category'")
            expect(sqlText).toContain('p.deleted_at IS NULL')
            // No recursive CTE / descendant join — this must be a flat single-table-join count.
            expect(sqlText).not.toMatch(/WITH RECURSIVE|getDescendantIds/i)
        })
    })
})
