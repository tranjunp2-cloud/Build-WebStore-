import { test, expect } from '@playwright/test'

test.describe('[TC-F36.201] EasyParcel OAuth start configuration', () => {
    test('does not return a 5xx response for an authenticated tenant', async ({ request }) => {
        // Arrange
        const meRes = await request.get('/api/users/me')
        expect(meRes.status()).toBe(200)
        const user = await meRes.json()
        expect(user).toBeDefined()

        const tenant = user.tenants?.[0]?.tenant
        const tenantId = tenant && typeof tenant === 'object' ? tenant.id : tenant
        expect(tenantId).toBeDefined()

        // Act — do not follow the configured-environment redirect to EasyParcel.
        const res = await request.get(`/api/tenant/${tenantId}/easyparcel-oauth-start`, { maxRedirects: 0 })

        // Assert — missing config is 400; configured environments redirect.
        expect([307, 400]).toContain(res.status())
        if (res.status() === 400) {
            const body = await res.json()
            expect(body).toEqual({
                success: false,
                error: {
                    code: 'CONFIG_ERROR',
                    message: 'EasyParcel OAuth not configured',
                },
            })
        }
    })
})
