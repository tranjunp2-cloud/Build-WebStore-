import { describe, it, expect, vi } from 'vitest'
import { Categories } from '../../../collections/Categories'

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
    })
})
