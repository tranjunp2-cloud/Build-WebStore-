import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetCurrentUser = vi.fn()
vi.mock('@/lib/auth', () => ({ getCurrentUser: () => mockGetCurrentUser() }))

const mockRedirect = vi.fn((url: string): never => { throw new Error(`REDIRECT:${url}`) })
vi.mock('next/navigation', () => ({ redirect: (url: string) => mockRedirect(url) }))

import { requirePermission } from '@/lib/permission-guard'

function expectRedirect(url: string) {
    expect(mockRedirect).toHaveBeenCalledWith(url)
}

beforeEach(() => {
    vi.clearAllMocks()
})

// ─── TC-F19.67: Unauthenticated user ──────────────────────────────────────
describe('requirePermission — unauthenticated', () => {
    it('[TC-F19.67] redirects to /login when no session', async () => {
        mockGetCurrentUser.mockResolvedValue(null)
        await expect(requirePermission('products')).rejects.toThrow('REDIRECT:/login')
        expectRedirect('/login')
    })
})

// ─── TC-F19.68: Tenantless user bypass (C-1 security fix) ─────────────────
describe('requirePermission — tenantless user', () => {
    it('[TC-F19.68] redirects to /forbidden when tenants array is empty', async () => {
        mockGetCurrentUser.mockResolvedValue({ roles: ['tenant-owner'], tenants: [] })
        await expect(requirePermission('products')).rejects.toThrow('REDIRECT:/forbidden')
        expectRedirect('/forbidden')
    })

    it('[TC-F19.69] redirects to /forbidden when tenants is undefined', async () => {
        mockGetCurrentUser.mockResolvedValue({ roles: ['tenant-owner'] })
        await expect(requirePermission('products')).rejects.toThrow('REDIRECT:/forbidden')
        expectRedirect('/forbidden')
    })
})

// ─── TC-F19.70: Pending status ────────────────────────────────────────────
describe('requirePermission — pending staff', () => {
    it('[TC-F19.70] redirects to /forbidden when invite not accepted yet', async () => {
        mockGetCurrentUser.mockResolvedValue({
            roles: [],
            tenants: [{ role: 'admin', status: 'pending' }],
        })
        await expect(requirePermission('products')).rejects.toThrow('REDIRECT:/forbidden')
        expectRedirect('/forbidden')
    })
})

// ─── TC-F19.71: Super-admin bypass ───────────────────────────────────────
describe('requirePermission — super-admin', () => {
    it('[TC-F19.71] allows access regardless of permission or tenant', async () => {
        mockGetCurrentUser.mockResolvedValue({ roles: ['super-admin'], tenants: [] })
        await expect(requirePermission('products')).resolves.toBeUndefined()
        expect(mockRedirect).not.toHaveBeenCalled()
    })
})

// ─── TC-F19.72: FULL_ACCESS_ROLES ────────────────────────────────────────
describe('requirePermission — full access roles', () => {
    for (const role of ['owner', 'admin', 'editor', 'viewer']) {
        it(`[TC-F19.72] allows ${role} unconditionally`, async () => {
            mockGetCurrentUser.mockResolvedValue({
                roles: [],
                tenants: [{ role, status: 'active' }],
            })
            await expect(requirePermission('products')).resolves.toBeUndefined()
            expect(mockRedirect).not.toHaveBeenCalled()
        })
    }
})

// ─── TC-F19.73: Custom role ───────────────────────────────────────────────
describe('requirePermission — custom role', () => {
    it('[TC-F19.73] allows when custom role has matching permission', async () => {
        mockGetCurrentUser.mockResolvedValue({
            roles: [],
            tenants: [{ role: 'custom', status: 'active', permissions: ['products', 'orders'] }],
        })
        await expect(requirePermission('products')).resolves.toBeUndefined()
        expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('[TC-F19.74] redirects to /forbidden when custom role lacks permission', async () => {
        mockGetCurrentUser.mockResolvedValue({
            roles: [],
            tenants: [{ role: 'custom', status: 'active', permissions: ['orders'] }],
        })
        await expect(requirePermission('products')).rejects.toThrow('REDIRECT:/forbidden')
        expectRedirect('/forbidden')
    })

    it('[TC-F19.75] redirects to /forbidden when custom role has empty permissions', async () => {
        mockGetCurrentUser.mockResolvedValue({
            roles: [],
            tenants: [{ role: 'custom', status: 'active', permissions: [] }],
        })
        await expect(requirePermission('blog')).rejects.toThrow('REDIRECT:/forbidden')
        expectRedirect('/forbidden')
    })
})

// ─── TC-F19.76: Unknown role ─────────────────────────────────────────────
describe('requirePermission — unknown role', () => {
    it('[TC-F19.76] redirects to /forbidden for unrecognized role string', async () => {
        mockGetCurrentUser.mockResolvedValue({
            roles: [],
            tenants: [{ role: 'unknown-role', status: 'active' }],
        })
        await expect(requirePermission('products')).rejects.toThrow('REDIRECT:/forbidden')
        expectRedirect('/forbidden')
    })
})
