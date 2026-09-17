import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }))

vi.mock('@/lib/auth', () => ({ getCurrentUser }))

import { withSuperAdmin } from '@/lib/admin/api-utils'

describe('[TC-F41-01] withSuperAdmin', () => {
    beforeEach(() => vi.clearAllMocks())

    it('TC-F41-01: rejects an unauthenticated detail request before invoking its handler', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue(null)
        const handler = vi.fn()
        const request = new NextRequest('https://prime.test/api/admin/generations/41')

        // Act
        const response = await withSuperAdmin(handler)(request)

        // Assert
        expect(response.status).toBe(401)
        expect(await response.json()).toEqual({ error: 'Unauthorized' })
        expect(handler).not.toHaveBeenCalled()
    })

    it('TC-F41-01: rejects a non-super-admin detail request before invoking its handler', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue({ id: 7, roles: ['tenant-owner'] })
        const handler = vi.fn()
        const request = new NextRequest('https://prime.test/api/admin/generations/41')

        // Act
        const response = await withSuperAdmin(handler)(request)

        // Assert
        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'Forbidden' })
        expect(handler).not.toHaveBeenCalled()
    })

    it('TC-F41-01: forwards only a super-admin request to the protected handler', async () => {
        // Arrange
        getCurrentUser.mockResolvedValue({ id: 1, roles: ['super-admin'] })
        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
        const request = new NextRequest('https://prime.test/api/admin/generations/41')

        // Act
        const response = await withSuperAdmin(handler)(request)

        // Assert
        expect(response.status).toBe(200)
        expect(handler).toHaveBeenCalledOnce()
    })
})
