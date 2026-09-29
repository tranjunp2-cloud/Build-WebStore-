import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatSlug } from '@/collections/Products'

describe('[TC-F42-055] tenant scoped product slug allocation', () => {
    afterEach(() => vi.restoreAllMocks())

    it.each([
        { data: { tenant: 9 }, originalDoc: undefined, user: undefined, expected: 9 },
        { data: { tenant: 9 }, originalDoc: undefined, user: { roles: [], tenants: [{ tenant: { id: 2 } }] }, expected: 2 },
        { data: { tenant: 9 }, originalDoc: { id: 7, tenant: { id: 3 } }, user: { roles: [], tenants: [{ tenant: 2 }] }, expected: 3 },
        { data: {}, originalDoc: { id: 7, tenant: 3 }, user: { roles: ['super-admin'] }, expected: 3 },
    ])('queries only effective tenant $expected', async ({ data, originalDoc, user, expected }) => {
        // Arrange
        const find = vi.fn().mockResolvedValue({ docs: [] })
        // Act
        const result = await formatSlug('name')({ value: 'Shared slug', data, originalDoc, req: { user, payload: { find } } } as never)
        // Assert
        expect(result).toBe('shared-slug')
        expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenant: { equals: expected } }) }))
    })

    it('uses super-admin fallback tenant on create just like the ownership hook', async () => {
        // Arrange
        const find = vi.fn().mockResolvedValueOnce({ docs: [{ id: 8 }] }).mockResolvedValueOnce({ docs: [] })
        const user = { roles: ['super-admin'], tenants: [{ tenant: { id: 4 } }] }
        // Act
        const result = await formatSlug('name')({ value: 'same', operation: 'create', data: {}, req: { user, payload: { find } } } as never)
        // Assert
        expect(result).toBe('same-1')
        expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenant: { equals: 4 } }) }))
    })

    it('excludes current product while suffixing collisions in its tenant', async () => {
        // Arrange
        const find = vi.fn().mockResolvedValueOnce({ docs: [{ id: 8 }] }).mockResolvedValueOnce({ docs: [] })
        // Act
        const result = await formatSlug('name')({ value: 'same', data: {}, originalDoc: { id: 7, tenant: 3 }, req: { payload: { find } } } as never)
        // Assert
        expect(result).toBe('same-1')
        expect(find).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { slug: { equals: 'same' }, tenant: { equals: 3 }, id: { not_equals: 7 } } }))
        expect(find).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: expect.objectContaining({ slug: { equals: 'same-1' }, tenant: { equals: 3 } }) }))
    })
})
