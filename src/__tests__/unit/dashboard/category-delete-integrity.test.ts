import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

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

import { deleteCategoryAction } from '@/app/(dashboard)/products/categories/actions'
import { getPayload } from 'payload'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
type ActiveSubscription = NonNullable<Awaited<ReturnType<typeof getActivePlanSubscription>>>

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
        vi.mocked(getActivePlanSubscription).mockResolvedValue(
            { plan: 'PROFESSIONAL_TM_USER' } as unknown as ActiveSubscription,
        )
        vi.mocked(canUse).mockResolvedValue(true)
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


    it('TC-F08-05-06: blocks mutation when read access passes but product management is unavailable', async () => {
        mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion', parent: null })
        vi.mocked(canUse).mockResolvedValue(false)

        await expect(deleteCategoryAction('cat-123')).rejects.toThrow('Product management is not available on your current plan.')
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('TC-F08-05-06: preserves the collection access bypass for super-admin', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(
            { id: 'admin-1', roles: ['super-admin'], tenants: [] } as unknown as CurrentUser,
        )
        vi.mocked(tenantIdForQuery).mockReturnValue(null)
        mockFindByID.mockResolvedValue({ id: 'cat-123', name: 'Fashion', parent: null })
        mockExecute.mockResolvedValue({
            rows: [{
                direct_count: 0,
                name_conflict_count: 0,
                deleted: true,
                deleted_doc: { id: 'cat-123', deletedAt: '2026-07-16T00:00:00.000Z' },
            }],
        })

        await expect(deleteCategoryAction('cat-123')).resolves.toMatchObject({ id: 'cat-123' })
        expect(getActivePlanSubscription).not.toHaveBeenCalled()
        expect(canUse).not.toHaveBeenCalled()
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
        expect(sqlText).toContain('WITH RECURSIVE target AS')
    })


    it('TC-F08-05-06: rebuilds breadcrumbs for the entire descendant subtree', async () => {
        const fixture = {
            parent: { id: 'cat-123', name: 'Parent', breadcrumbs: 'Parent' },
            child: { id: 'cat-124', name: 'Child', breadcrumbs: 'Parent > Child' },
            grandchild: { id: 'cat-125', name: 'Grandchild', breadcrumbs: 'Parent > Child > Grandchild' },
        }
        mockFindByID.mockResolvedValue(fixture.parent)
        mockExecute.mockResolvedValue({ rows: [{ direct_count: 0, name_conflict_count: 0, deleted: true, deleted_doc: { id: 'cat-123', deletedAt: '2026-07-16T00:00:00.000Z' } }] })

        await deleteCategoryAction(fixture.parent.id)

        const sqlText = extractSqlText(mockExecute.mock.calls[0][0])
        const expectedAfterDelete = {
            child: fixture.child.name,
            grandchild: `${fixture.child.name} > ${fixture.grandchild.name}`,
        }
        expect(expectedAfterDelete).toEqual({ child: 'Child', grandchild: 'Child > Grandchild' })
        expect(sqlText).toContain('WITH RECURSIVE')
        expect(sqlText).toContain('new_breadcrumbs')
        expect(sqlText).toContain("s.new_breadcrumbs || ' > ' || c.name")
        expect(sqlText).toContain('parent_id = CASE WHEN c.parent_id = t.id THEN NULL ELSE c.parent_id END')
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
        expect(sqlText).not.toMatch(/getDescendantIds/i)
    })
})
