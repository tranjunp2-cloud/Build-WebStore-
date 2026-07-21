import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

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

type MockPayload = { findByID: Mock; db: { drizzle: { execute: Mock } } }

function extractSqlText(sqlObj: { queryChunks?: unknown[] }): string {
    return (sqlObj.queryChunks ?? [])
        .map(chunk =>
            chunk && typeof chunk === 'object' && Array.isArray((chunk as { value?: unknown[] }).value)
                ? (chunk as { value: string[] }).value.join('')
                : ''
        )
        .join('')
}

describe('deleteCategoryAction (TC-F08-05-06)', () => {
    let mockPayload: MockPayload
    let mockFindByID: Mock
    let mockExecute: Mock

    beforeEach(() => {
        vi.clearAllMocks()
        mockFindByID = vi.fn()
        mockExecute = vi.fn()

        mockPayload = {
            findByID: mockFindByID,
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

    it('TC-F08-05-06: authorizes category access before any raw SQL runs', async () => {
        mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion', parent: null })
        mockExecute.mockResolvedValue({
            rows: [{
                direct_count: 0,
                name_conflict_count: 0,
                deleted: true,
                deleted_doc: { id: 'cat-123', deletedAt: '2026-07-16T00:00:00.000Z' },
            }],
        })

        await deleteCategoryAction('cat-123')

        expect(mockFindByID).toHaveBeenCalledWith({
            collection: 'categories',
            id: 'cat-123',
            user: mockCurrentUser,
            overrideAccess: false,
        })
        expect(mockExecute).toHaveBeenCalledTimes(1)
    })

    it('TC-F08-05-06: aborts before raw SQL when access check fails', async () => {
        mockFindByID.mockRejectedValue(new Error('Category not found or access denied'))

        await expect(deleteCategoryAction('cat-999')).rejects.toThrow('Category not found or access denied')
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('TC-F08-05-06: throws CATEGORY_HAS_PRODUCTS:N when direct products still exist', async () => {
        mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
        mockExecute.mockResolvedValue({
            rows: [{
                direct_count: 5,
                name_conflict_count: 0,
                deleted: false,
                deleted_doc: null,
            }],
        })

        await expect(deleteCategoryAction('cat-123')).resolves.toEqual({ success: false, error: 'CATEGORY_HAS_PRODUCTS', count: 5 })
    })

    it('TC-F08-05-33: throws CATEGORY_REPARENT_NAME_CONFLICT:N before delete when moving children to root would duplicate names', async () => {
        mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
        mockExecute.mockResolvedValue({
            rows: [{
                direct_count: 0,
                name_conflict_count: 2,
                deleted: false,
                deleted_doc: null,
            }],
        })

        await expect(deleteCategoryAction('cat-123')).resolves.toEqual({ success: false, error: 'CATEGORY_REPARENT_NAME_CONFLICT', count: 2 })
    })

    it('TC-F08-05-06: returns deleted record from the atomic delete statement', async () => {
        mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion', parent: null })
        const deletedRecord = {
            id: 'cat-123',
            name: 'Fashion',
            parent: null,
            deletedAt: '2026-07-16T12:00:00.000Z',
        }
        mockExecute.mockResolvedValue({
            rows: [{
                direct_count: 0,
                name_conflict_count: 0,
                deleted: true,
                deleted_doc: deletedRecord,
            }],
        })

        await expect(deleteCategoryAction('cat-123')).resolves.toEqual(deletedRecord)
    })

    it('TC-F08-05-34: SQL scopes child re-parenting to the authorized tenant only', async () => {
        mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
        mockExecute.mockResolvedValue({
            rows: [{
                direct_count: 0,
                name_conflict_count: 0,
                deleted: true,
                deleted_doc: { id: 'cat-123', deletedAt: '2026-07-16T12:00:00.000Z' },
            }],
        })

        await deleteCategoryAction('cat-123')

        const sqlText = extractSqlText(mockExecute.mock.calls[0][0])
        expect(sqlText).toContain('c.parent_id = t.id')
        expect(sqlText).toContain('c.tenant_id = t.tenant_id')
    })

    it('TC-F08-05-35: SQL preflights duplicate root-name conflicts before re-parenting children', async () => {
        mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
        mockExecute.mockResolvedValue({
            rows: [{
                direct_count: 0,
                name_conflict_count: 0,
                deleted: true,
                deleted_doc: { id: 'cat-123', deletedAt: '2026-07-16T12:00:00.000Z' },
            }],
        })

        await deleteCategoryAction('cat-123')

        const sqlText = extractSqlText(mockExecute.mock.calls[0][0])
        expect(sqlText).toContain('root.parent_id IS NULL')
        expect(sqlText).toContain('root.id <> t.id')
        expect(sqlText).toContain('lower(trim(root.name)) = lower(trim(ch.name))')
        expect(sqlText).toContain('HAVING COUNT(*) > 1')
    })

    it('TC-F08-05-37: allows delete when a child shares the same name as the target root being deleted', async () => {
        mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Shoes', parent: null })
        const deletedRecord = {
            id: 'cat-123',
            name: 'Shoes',
            parent: null,
            deletedAt: '2026-07-16T12:00:00.000Z',
        }
        mockExecute.mockResolvedValue({
            rows: [{
                direct_count: 0,
                name_conflict_count: 0,
                deleted: true,
                deleted_doc: deletedRecord,
            }],
        })

        await expect(deleteCategoryAction('cat-123')).resolves.toEqual(deletedRecord)

        const sqlText = extractSqlText(mockExecute.mock.calls[0][0])
        expect(sqlText).toContain('JOIN target t ON TRUE')
        expect(sqlText).toContain('root.id <> t.id')
    })

    it('TC-F08-05-36: SQL locks the target category row before count/re-parent/delete to narrow the product-assignment race', async () => {
        mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
        mockExecute.mockResolvedValue({
            rows: [{
                direct_count: 0,
                name_conflict_count: 0,
                deleted: true,
                deleted_doc: { id: 'cat-123', deletedAt: '2026-07-16T12:00:00.000Z' },
            }],
        })

        await deleteCategoryAction('cat-123')

        const sqlText = extractSqlText(mockExecute.mock.calls[0][0])
        expect(sqlText).toContain('FROM categories c')
        expect(sqlText).toContain('FOR UPDATE')
        expect(sqlText).toContain('WITH target AS')
    })

    it('TC-F08-05-06: still counts direct products only, not descendants', async () => {
        mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion' })
        mockExecute.mockResolvedValue({
            rows: [{
                direct_count: 0,
                name_conflict_count: 0,
                deleted: true,
                deleted_doc: { id: 'cat-123', deletedAt: '2026-07-16T12:00:00.000Z' },
            }],
        })

        await deleteCategoryAction('cat-123')

        const sqlText = extractSqlText(mockExecute.mock.calls[0][0])
        expect(sqlText).toContain('products_rels')
        expect(sqlText).toContain('r.categories_id = t.id')
        expect(sqlText).toContain("r.path = 'category'")
        expect(sqlText).toContain('p.deleted_at IS NULL')
        expect(sqlText).not.toMatch(/WITH RECURSIVE|getDescendantIds/i)
    })
})
