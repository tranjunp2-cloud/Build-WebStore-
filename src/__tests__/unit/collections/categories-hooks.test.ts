import { describe, it, expect, vi } from 'vitest'
import { Categories } from '../../../collections/Categories'

describe('Categories Collection Hooks (TC-F08-05)', () => {
    describe('beforeValidate hook — Cycle Prevention (TC-F08-05-09)', () => {
        const hook = Categories.hooks!.beforeValidate![0] as any

        it('TC-F08-05-09: Self-parent cycle — setting category as its own parent throws error', async () => {
            const req = {
                payload: {
                    findByID: vi.fn()
                }
            }

            // Update operation: trying to set cat-A's parent to itself
            await expect(hook({
                data: { name: 'Category A', parent: 'cat-A' },
                operation: 'update',
                originalDoc: { id: 'cat-A' },
                req
            } as any)).rejects.toThrow(/Không thể đặt danh mục làm cha của chính nó/)
        })

        it('TC-F08-05-09: Descendant-as-parent cycle — setting descendant as parent throws error', async () => {
            const req = {
                payload: {
                    // Only one findByID call actually happens: fetching cat-B's own record shows
                    // its parent is cat-A (= selfId) — the hook's ancestor walk throws on THAT
                    // hop, before ever needing to fetch a second level up.
                    findByID: vi.fn()
                        .mockResolvedValueOnce({ id: 'cat-B', parent: 'cat-A' })
                }
            }

            // Editing cat-A to have parent cat-B (where B is descendant of A)
            await expect(hook({
                data: { name: 'Category A', parent: 'cat-B' },
                operation: 'update',
                originalDoc: { id: 'cat-A' },
                req
            } as any)).rejects.toThrow(/Không thể đặt danh mục làm cha của chính nó/)
        })

        it('TC-F08-05-09: Valid parent with no cycle — accepts parent change', async () => {
            const req = {
                payload: {
                    findByID: vi.fn()
                        .mockResolvedValueOnce({ id: 'cat-B', parent: null })
                }
            }

            const data = { name: 'Category A', parent: 'cat-B' }
            const result = await hook({
                data,
                operation: 'update',
                originalDoc: { id: 'cat-A' },
                req
            } as any)
            expect(result).toBe(data)
        })

        it('TC-F08-05-02: Depth limit — rejects 4th level category', async () => {
            const req = {
                payload: {
                    findByID: vi.fn()
                        .mockResolvedValueOnce({ id: 'Level3', parent: 'Level2' })
                        .mockResolvedValueOnce({ id: 'Level2', parent: 'Level1' })
                        .mockResolvedValueOnce({ id: 'Level1', parent: null })
                }
            }

            await expect(hook({
                data: { name: 'Level4', parent: 'Level3' },
                operation: 'create',
                req
            } as any)).rejects.toThrow(/tối đa 3 cấp độ/)
        })

        it('TC-F08-05-02: Depth limit — accepts 3rd level category', async () => {
            const req = {
                payload: {
                    findByID: vi.fn()
                        .mockResolvedValueOnce({ id: 'Level2', parent: 'Level1' })
                        .mockResolvedValueOnce({ id: 'Level1', parent: null })
                }
            }

            const data = { name: 'Level3', parent: 'Level2' }
            const result = await hook({
                data,
                operation: 'create',
                req
            } as any)
            expect(result).toBe(data)
        })
    })
})
