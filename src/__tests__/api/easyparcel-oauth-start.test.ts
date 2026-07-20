import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type RouteContext = { params: Promise<{ id: string }> }
type AuthenticatedHandler = (
    user: { roles: string[] },
    request: Request,
    context: RouteContext,
) => Promise<Response>

vi.mock('@/lib/auth', () => ({
    withAuth: (handler: unknown) => (request: Request, context: RouteContext) =>
        (handler as AuthenticatedHandler)({ roles: ['super-admin'] }, request, context),
}))

import { GET } from '@/app/api/tenant/[id]/easyparcel-oauth-start/route'

const originalClientId = process.env.EASYPARCEL_CLIENT_ID
const originalRedirectUri = process.env.EASYPARCEL_REDIRECT_URI

describe('[TC-F36.201] GET /api/tenant/[id]/easyparcel-oauth-start', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delete process.env.EASYPARCEL_CLIENT_ID
        delete process.env.EASYPARCEL_REDIRECT_URI
    })

    afterEach(() => {
        if (originalClientId === undefined) delete process.env.EASYPARCEL_CLIENT_ID
        else process.env.EASYPARCEL_CLIENT_ID = originalClientId

        if (originalRedirectUri === undefined) delete process.env.EASYPARCEL_REDIRECT_URI
        else process.env.EASYPARCEL_REDIRECT_URI = originalRedirectUri
    })

    it('returns 400 CONFIG_ERROR when EasyParcel OAuth is not configured', async () => {
        // Arrange
        const request = new Request('http://localhost/api/tenant/tenant-1/easyparcel-oauth-start')
        const context = { params: Promise.resolve({ id: 'tenant-1' }) }

        // Act
        const response = await GET(request, context)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(body).toEqual({
            success: false,
            error: {
                code: 'CONFIG_ERROR',
                message: 'EasyParcel OAuth not configured',
            },
        })
    })
})
