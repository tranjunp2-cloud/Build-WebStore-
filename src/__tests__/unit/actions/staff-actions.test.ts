import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-1'),
}))

const mockCookieGet = vi.fn()
vi.mock('next/headers', () => ({
    cookies: vi.fn(() => Promise.resolve({ get: mockCookieGet })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getCurrentTenantId } from '@/lib/auth'
import {
    inviteStaffAction,
    updateStaff,
    updateStaffStatus,
    resendInvite,
    removeStaff,
    bulkRemoveStaff,
} from '@/app/(dashboard)/settings/staff/actions'

// ─── TC-F19.20: Custom permission role enforcement ────────────────────
// ─── TC-F19.23: Duplicate email prevention ────────────────────────────

const mockFetchResponse = (ok: boolean, data: any = {}) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok,
        json: () => Promise.resolve(data),
    } as Response)
}

describe('inviteStaffAction [TC-F19.23]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockCookieGet.mockReturnValue({ value: 'jwt-token' })
    })

    it('invites staff with valid data', async () => {
        mockFetchResponse(true, {})

        const result = await inviteStaffAction({
            email: 'new@test.com',
            name: 'John',
            role: 'editor',
        })

        expect(result.success).toBe(true)
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/users/invite-staff'),
            expect.objectContaining({ method: 'POST' }),
        )
    })

    it('returns error when not authenticated', async () => {
        vi.mocked(getCurrentTenantId).mockResolvedValue(null)

        const result = await inviteStaffAction({
            email: 'test@test.com',
            name: 'Test',
            role: 'viewer',
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Unauthorized')
    })

    it('returns API error message on failure', async () => {
        mockFetchResponse(false, { errors: [{ message: 'Email already exists' }] })

        const result = await inviteStaffAction({
            email: 'dup@test.com',
            name: 'Dup',
            role: 'editor',
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Email already exists')
    })
})

describe('updateStaff [TC-F19.20]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockCookieGet.mockReturnValue({ value: 'jwt-token' })
    })

    it('updates staff role and permissions', async () => {
        mockFetchResponse(true, {})

        const result = await updateStaff('user-1', 'Updated Name', 'admin', ['manage_products'])

        expect(result.success).toBe(true)
    })

    it('returns unauthorized when no token', async () => {
        mockCookieGet.mockReturnValue(undefined)

        const result = await updateStaff('user-1', 'Name', 'viewer')

        expect(result.success).toBe(false)
        expect(result.error).toBe('Unauthorized')
    })
})

describe('updateStaffStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockCookieGet.mockReturnValue({ value: 'jwt-token' })
    })

    it('updates staff status', async () => {
        mockFetchResponse(true, {})
        const result = await updateStaffStatus('user-1', 'suspended')
        expect(result.success).toBe(true)
    })
})

describe('resendInvite', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockCookieGet.mockReturnValue({ value: 'jwt-token' })
    })

    it('resends invitation', async () => {
        mockFetchResponse(true, {})
        const result = await resendInvite('user-1')
        expect(result.success).toBe(true)
    })
})

describe('removeStaff', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockCookieGet.mockReturnValue({ value: 'jwt-token' })
    })

    it('removes staff member', async () => {
        mockFetchResponse(true, {})
        const result = await removeStaff('user-1')
        expect(result.success).toBe(true)
    })

    it('returns API error on failure', async () => {
        mockFetchResponse(false, { errors: [{ message: 'Cannot remove last owner' }] })
        const result = await removeStaff('user-1')
        expect(result.success).toBe(false)
        expect(result.error).toBe('Cannot remove last owner')
    })
})

describe('bulkRemoveStaff', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockCookieGet.mockReturnValue({ value: 'jwt-token' })
    })

    it('removes multiple staff members', async () => {
        mockFetchResponse(true, {})
        const result = await bulkRemoveStaff(['user-1', 'user-2'])
        expect(result.success).toBe(true)
    })
})
