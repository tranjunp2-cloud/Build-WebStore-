// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { Categories } from '@/collections/Categories'
import { migrationContext } from '@/lib/migration/pw1-json/runtime'

describe('[TC-F42-IMP-CATEGORY-BREADCRUMBS] Category parent reads', () => {
  it.each([['private', true], ['ordinary', false], ['forged', false]] as const)('%s context retains the correct access boundary', async (mode, allowed) => {
    // Arrange: the real hook receives an anonymous import or ordinary request.
    const context = mode === 'private' ? migrationContext() : mode === 'forged' ? { migrationProfile: 'pw1-json-v1' } : {}
    const findByID = vi.fn(async ({ overrideAccess }: { overrideAccess: boolean }) => overrideAccess ? { breadcrumbs: 'Computer & Accessories' } : null)
    const req = { context, payload: { findByID } }
    const data = { name: 'Mobile phone', slug: 'mobile-phone', parent: 102 }
    // Act
    const result = await Categories.hooks!.beforeChange![0]({ data, req, operation: 'create' } as never)
    // Assert: no forgeable string marker bypasses application access.
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ id: 102, req, overrideAccess: allowed }))
    expect(result.breadcrumbs).toBe(allowed ? 'Computer & Accessories > Mobile phone' : 'Mobile phone')
  })
})
