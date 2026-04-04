import { describe, it, expect, vi } from 'vitest'
import { Categories } from '../../../collections/Categories'

describe('Categories Collection Hooks (TC-F08-05)', () => {
    describe('beforeValidate hook (TC-F08-05-09)', () => {
        const hook = Categories.hooks!.beforeValidate![0] as any

        it('TC-F08-05-09: Detects circular tree loop and prevents OOM by throwing depth error', async () => {
            const req = {
                payload: {
                    findByID: vi.fn()
                        .mockResolvedValueOnce({ id: 'cat-B', parent: 'cat-A' })
                        .mockResolvedValueOnce({ id: 'cat-A', parent: 'cat-B' })
                        .mockResolvedValueOnce({ id: 'cat-B', parent: 'cat-A' })
                }
            }
            
            // Editing cat-A to have parent cat-B (where B's parent is A)
            await expect(hook({ data: { name: 'Category A', parent: 'cat-B' }, req } as any)).rejects.toThrow(/tối đa 3 cấp độ/)
        })
        
        it('TC-F08-05-02: Throws error when attempting to add a 4th level category', async () => {
             const req = {
                payload: {
                    findByID: vi.fn()
                        .mockResolvedValueOnce({ id: 'Level3', parent: 'Level2' })
                        .mockResolvedValueOnce({ id: 'Level2', parent: 'Level1' })
                        .mockResolvedValueOnce({ id: 'Level1', parent: null })
                }
            }
            
            await expect(hook({ data: { name: 'Level4', parent: 'Level3' }, req } as any)).rejects.toThrow(/tối đa 3 cấp độ/)
        })
    })
})
