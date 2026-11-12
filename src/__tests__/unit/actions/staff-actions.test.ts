import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeTenants } from '@/lib/normalize-tenants'
import type { TenantMembership } from '@/lib/normalize-tenants'

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

describe('normalizeTenants [TC-F19.28]', () => {
    it('extracts ID from populated tenant objects', () => {
        const populated: TenantMembership[] = [
            { tenant: { id: '1' }, role: 'admin', status: 'active', permissions: ['blog'] },
            { tenant: { id: '2' }, role: 'owner', status: 'active', permissions: [] },
        ]
        const result = normalizeTenants(populated)
        expect(result[0].tenant).toBe('1')
        expect(result[1].tenant).toBe('2')
    })

    it('preserves string tenant IDs as-is', () => {
        const plain = [
            { tenant: '10', role: 'custom', status: 'pending', permissions: ['settings'] },
        ]
        const result = normalizeTenants(plain)
        expect(result[0].tenant).toBe('10')
        expect(result[0].permissions).toEqual(['settings'])
    })

    it('defaults undefined permissions to empty array', () => {
        const noPerms = [
            { tenant: '5', role: 'admin', status: 'active' },
        ]
        const result = normalizeTenants(noPerms)
        expect(result[0].permissions).toEqual([])
    })

    it('filters null items within permissions array (GH-905 regression)', () => {
        const withNullPerms: TenantMembership[] = [
            { tenant: '1', role: 'custom', status: 'active', permissions: [null as unknown as string, 'products', null as unknown as string] },
        ]
        const result = normalizeTenants(withNullPerms)
        expect(result[0].permissions).toEqual(['products'])
    })

    it('deduplicates repeated permission values accumulated by missing FK cascade (GH-905)', () => {
        const withDupes: TenantMembership[] = [
            { tenant: '1', role: 'custom', status: 'active', permissions: ['blog', 'blog', 'blog', 'settings', 'settings', 'settings'] },
        ]
        const result = normalizeTenants(withDupes)
        expect(result[0].permissions).toEqual(['blog', 'settings'])
    })
})

describe('cross-tenant owner check [TC-F19.29]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getCurrentTenantId).mockResolvedValue('tenant-1')
        mockCookieGet.mockReturnValue({ value: 'jwt-token' })
    })

    it('blocks inviting a user who is active owner of another workspace', async () => {
        mockFetchResponse(false, { errors: [{ message: 'This user is an owner of another workspace and cannot be added as staff' }] })

        const result = await inviteStaffAction({
            email: 'owner-other-shop@test.com',
            name: 'Owner',
            role: 'admin',
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('This user is an owner of another workspace and cannot be added as staff')
    })

    it('allows inviting a user who is NOT an owner elsewhere', async () => {
        mockFetchResponse(true, {})

        const result = await inviteStaffAction({
            email: 'staff-other-shop@test.com',
            name: 'Staff',
            role: 'admin',
        })

        expect(result.success).toBe(true)
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

        const result = await updateStaff('user-1', 'admin', ['manage_products'])

        expect(result.success).toBe(true)
    })

    // GH-2383: saving permissions must not send a name to /update-staff
    it('does not send a name in the request body', async () => {
        mockFetchResponse(true, {})

        await updateStaff('user-1', 'admin', ['manage_products'])

        const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string)
        expect(body).not.toHaveProperty('name')
        expect(body).toMatchObject({ userId: 'user-1', role: 'admin' })
    })

    it('returns unauthorized when no token', async () => {
        mockCookieGet.mockReturnValue(undefined)

        const result = await updateStaff('user-1', 'viewer')

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
