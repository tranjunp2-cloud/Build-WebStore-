import { vi, describe, it, expect, beforeEach } from 'vitest'
import { revalidateTag } from 'next/cache'
import {
    revalidateBadgeCountsAfterChange,
    revalidateBadgeCountsAfterDelete,
} from '@/lib/dashboard/revalidate-badge-counts-hook'

// vi.mock hoisted to top per testing rules — replaces next/cache's revalidateTag with a spy.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

const mockRevalidateTag = vi.mocked(revalidateTag)

// Minimal Payload hook arg — the hooks only read `doc.tenant`.
type ChangeArg = Parameters<typeof revalidateBadgeCountsAfterChange>[0]
type DeleteArg = Parameters<typeof revalidateBadgeCountsAfterDelete>[0]
const changeArg = (tenant: unknown) => ({ doc: { tenant } }) as unknown as ChangeArg
const deleteArg = (tenant: unknown) => ({ doc: { tenant } }) as unknown as DeleteArg

/**
 * TC-F18-SB-REVALIDATE-01 — badge-counts cache busting on collection mutations.
 * Verifies the afterChange/afterDelete hooks revalidate the correct per-tenant tag and
 * resolve the tenant from both a scalar id and a populated relation object.
 */
describe('revalidateBadgeCounts hooks (TC-F18-SB-REVALIDATE-01)', () => {
    beforeEach(() => {
        mockRevalidateTag.mockReset()
    })

    it('afterChange busts the per-tenant tag for a scalar tenant id', () => {
        const doc = { tenant: 42 }
        const result = revalidateBadgeCountsAfterChange(changeArg(42))

        expect(mockRevalidateTag).toHaveBeenCalledTimes(1)
        expect(mockRevalidateTag).toHaveBeenCalledWith('sidebar-badge-counts:42')
        // Hook must return the doc unchanged (afterChange contract)
        expect(result).toEqual(doc)
    })

    it('afterChange resolves tenant from a populated relation object {id}', () => {
        revalidateBadgeCountsAfterChange(changeArg({ id: 7 }))

        expect(mockRevalidateTag).toHaveBeenCalledWith('sidebar-badge-counts:7')
    })

    it('afterDelete busts the per-tenant tag and returns the doc', () => {
        const result = revalidateBadgeCountsAfterDelete(deleteArg('t99'))

        expect(mockRevalidateTag).toHaveBeenCalledWith('sidebar-badge-counts:t99')
        expect(result).toEqual({ tenant: 't99' })
    })

    it('does NOT revalidate when tenant is null/undefined', () => {
        revalidateBadgeCountsAfterChange(changeArg(null))
        revalidateBadgeCountsAfterChange(changeArg(undefined))

        expect(mockRevalidateTag).not.toHaveBeenCalled()
    })

    it('swallows revalidateTag errors (out-of-request scope: seeds/migrations)', () => {
        mockRevalidateTag.mockImplementationOnce(() => {
            throw new Error('revalidateTag called outside request scope')
        })

        // Must not throw — the cache self-expires via its 60s TTL instead.
        expect(() => revalidateBadgeCountsAfterChange(changeArg(5))).not.toThrow()
    })
})
