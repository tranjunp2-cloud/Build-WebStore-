import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
    getCurrentTenantId: vi.fn(),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ findByID: mockFindByID, update: mockUpdate })),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getCurrentTenantId } from '@/lib/auth'
import { updateDashboardPreferences } from '@/app/(dashboard)/actions'

// ─── TC-F03: Dashboard preferences ───────────────────────────────────

describe('updateDashboardPreferences [TC-F03]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
    })

    it('merges preferences with existing tenant settings', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            settings: { theme: 'dark', dashboardPreferences: ['revenue'] },
        })
        mockUpdate.mockResolvedValue({})

        // Act
        const result = await updateDashboardPreferences(['orders', 'visitors'])

        // Assert
        expect(result.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    settings: {
                        theme: 'dark',
                        dashboardPreferences: ['orders', 'visitors'],
                    },
                },
            }),
        )
    })

    it('throws when not authenticated', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(null)

        await expect(updateDashboardPreferences(['x']))
            .rejects.toThrow('Unauthorized')
    })

    it('handles tenant with no existing settings', async () => {
        mockFindByID.mockResolvedValue({})
        mockUpdate.mockResolvedValue({})

        const result = await updateDashboardPreferences(['revenue'])

        expect(result.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    settings: { dashboardPreferences: ['revenue'] },
                },
            }),
        )
    })
})
