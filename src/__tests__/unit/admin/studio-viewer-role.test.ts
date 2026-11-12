/**
 * TC-F15.27..30 — the read-only `studio-viewer` seat: opens Studio and reads its APIs, never writes,
 * never sees AI settings (provider keys, routing, spend caps).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

const { getCurrentUser, redirect } = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    redirect: vi.fn((to: string) => {
        throw new Error(`REDIRECT:${to}`)
    }),
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser, authUnavailableResponse: vi.fn(), isAuthUnavailableError: () => false }))
vi.mock('next/navigation', () => ({ redirect }))

import { AI_SETTINGS_SUPER_ADMIN_ONLY, withSuperAdmin } from '@/lib/admin/api-utils'
import { requireStudioAccess, requireSuperAdmin } from '@/lib/admin/auth-guard'
import { canViewStudio, isStudioReadOnly, isSuperAdminOnlyStudioPath } from '@/lib/admin/studio-roles'
import { middleware } from '@/middleware'

const viewer = { id: 9, email: 'team@primecommerce.asia', roles: ['studio-viewer'] }
const admin = { id: 1, email: 'ben@primecommerce.asia', roles: ['super-admin'] }
const okHandler = () => vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
const apiRequest = (method: string) => new NextRequest('https://prime.test/api/admin/templates', { method })

async function studioRequest(path: string, roles: string[]) {
    const token = await new SignJWT({ id: 9, roles })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode('test-secret'))
    return new NextRequest(`https://primeweb.app${path}`, { headers: { cookie: `payload-token=${token}`, host: 'primeweb.app' } })
}

beforeEach(() => vi.clearAllMocks())

describe('[TC-F15.27] studio role helpers', () => {
    it('TC-F15.27: a studio-viewer may open Studio read-only; tenant roles may not open it', () => {
        expect(canViewStudio(['studio-viewer'])).toBe(true)
        expect(isStudioReadOnly(['studio-viewer'])).toBe(true)
        expect(isStudioReadOnly(['studio-viewer', 'super-admin'])).toBe(false)
        expect(canViewStudio(['tenant-owner', 'viewer'])).toBe(false)
        expect(isSuperAdminOnlyStudioPath('/studio/settings/ai/models')).toBe(true)
        expect(isSuperAdminOnlyStudioPath('/studio/settingsx')).toBe(false)
        expect(isSuperAdminOnlyStudioPath('/studio/performance')).toBe(false)
    })
})

describe('[TC-F15.28] Studio API: viewer reads, never writes', () => {
    it('TC-F15.28: forwards a viewer GET to the handler', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(viewer)
        const handler = okHandler()

        // Act
        const response = await withSuperAdmin(handler)(apiRequest('GET'))

        // Assert
        expect(response.status).toBe(200)
        expect(handler).toHaveBeenCalledOnce()
    })

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('TC-F15.28: refuses a viewer %s with 403 before the handler', async (method) => {
        // Arrange
        getCurrentUser.mockResolvedValue(viewer)
        const handler = okHandler()

        // Act
        const response = await withSuperAdmin(handler)(apiRequest(method))

        // Assert
        expect(response.status).toBe(403)
        expect(handler).not.toHaveBeenCalled()
    })

    it('TC-F15.28: keeps super-admin writes working', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(admin)
        const handler = okHandler()

        // Act
        const response = await withSuperAdmin(handler)(apiRequest('POST'))

        // Assert
        expect(response.status).toBe(200)
        expect(handler).toHaveBeenCalledOnce()
    })
})

describe('[TC-F15.29] AI settings stay super-admin only', () => {
    it('TC-F15.29: refuses a viewer GET on an AI settings route', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(viewer)
        const handler = okHandler()

        // Act
        const response = await withSuperAdmin(handler, AI_SETTINGS_SUPER_ADMIN_ONLY)(apiRequest('GET'))

        // Assert
        expect(response.status).toBe(403)
        expect(handler).not.toHaveBeenCalled()
    })

    it('TC-F15.29: sends a viewer away from /studio/settings to the Studio home', async () => {
        // Act
        const response = await middleware(await studioRequest('/studio/settings/ai', ['studio-viewer']))

        // Assert
        expect(response.status).toBe(307)
        expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/studio')
    })

    it('TC-F15.29: a viewer on a super-admin server page is redirected to /studio', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(viewer)

        // Act + Assert
        await expect(requireSuperAdmin()).rejects.toThrow('REDIRECT:/studio')
    })
})

describe('[TC-F15.30] Studio pages admit the viewer', () => {
    it('TC-F15.30: lets a viewer token through the Studio middleware', async () => {
        // Act
        const response = await middleware(await studioRequest('/studio/templates', ['studio-viewer']))

        // Assert
        expect(response.headers.get('location')).toBeNull()
    })

    it('TC-F15.30: keeps a tenant-owner out of Studio', async () => {
        // Act
        const response = await middleware(await studioRequest('/studio/templates', ['tenant-owner']))

        // Assert
        expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/admin')
    })

    it('TC-F15.30: requireStudioAccess returns the viewer flagged read-only', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(viewer)

        // Act
        const { user } = await requireStudioAccess()

        // Assert
        expect(user).toMatchObject({ email: viewer.email, readOnly: true })
    })

    it('TC-F15.30: an anonymous visitor is sent to the login', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(null)

        // Act + Assert
        await expect(requireStudioAccess()).rejects.toThrow('REDIRECT:/admin')
    })
})
