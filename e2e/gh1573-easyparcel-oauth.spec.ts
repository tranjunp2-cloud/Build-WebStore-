import { test, expect } from '@playwright/test'

test.describe('GH-1573 EasyParcel OAuth Start Config Check', () => {
    test('returns 400 when EasyParcel is not configured', async ({ request }) => {
        // 1. Get logged-in user profile to extract tenant ID
        const meRes = await request.get('/api/users/me')
        expect(meRes.status()).toBe(200)
        const user = await meRes.json()
        expect(user).toBeDefined()

        // Extract tenant ID from authenticated session
        const tenant = user.tenants?.[0]?.tenant
        const tenantId = tenant && typeof tenant === 'object' ? tenant.id : tenant
        expect(tenantId).toBeDefined()

        // 2. Request easyparcel-oauth-start with the valid tenantId
        const res = await request.get(`/api/tenant/${tenantId}/easyparcel-oauth-start`)
        
        // Assert it returns 400 Bad Request instead of 500 Internal Server Error
        expect(res.status()).toBe(400)
        const body = await res.json()
        expect(body.success).toBe(false)
        expect(body.error.code).toBe('CONFIG_ERROR')
        expect(body.error.message).toBe('EasyParcel OAuth not configured')
    })
})
