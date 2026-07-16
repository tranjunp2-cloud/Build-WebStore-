import { test, expect } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'admin@primeweb.app'
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'Password123!'

test.describe('GH-1573 EasyParcel OAuth Start Config Check', () => {
    test('returns 400 when EasyParcel is not configured', async ({ request }) => {
        // 1. Log in to get session cookie & user info
        const loginRes = await request.post('/api/users/login', {
            data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        })
        expect(loginRes.status()).toBe(200)
        const loginBody = await loginRes.json()
        const user = loginBody.user
        expect(user).toBeDefined()

        // Extract tenant ID
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
