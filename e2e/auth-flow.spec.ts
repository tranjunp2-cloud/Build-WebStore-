import { test, expect } from '@playwright/test'
import { expectNoServerError } from './helpers/assertions'

/**
 * Auth Flow E2E Tests — Session & Guard verification.
 *
 * Note: The full login → OTP → dashboard flow is tested by auth.setup.ts
 * (runs before every test). These tests verify:
 * - Unauthenticated guard redirect
 * - Session persistence across pages
 * - Cookie existence after auth
 *
 * TC-F02.19: Session exists (auth.setup.ts succeeded)
 * TC-F02.20: Unauthenticated guard
 * TC-F02.21: Session persistence
 */

test.describe('Auth Flow', () => {
    test('[TC-F02.19] authenticated session has payload-token cookie', async ({ page, context }) => {
        // Storage state from auth.setup.ts should have payload-token
        const cookies = await context.cookies()
        const payloadToken = cookies.find(c => c.name === 'payload-token')

        // Cookie should exist and not be expired
        expect(payloadToken).toBeTruthy()
        if (payloadToken) {
            expect(payloadToken.value.length).toBeGreaterThan(10)
        }

        // And we can access protected route without re-auth
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')
        expect(page.url()).not.toContain('/login')
    })

    test('[TC-F02.20] unauthenticated access redirects to login', async ({ browser }) => {
        // Fresh context with NO storage state
        const context = await browser.newContext({ storageState: undefined })
        const page = await context.newPage()

        // Try accessing protected route
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle').catch(() => {})

        // Should redirect to login OR SSO (external)
        const url = page.url()
        const isLoginOrSso = url.includes('/login') || url.includes('sso.') || url.includes('/verify-otp')
        expect(isLoginOrSso).toBeTruthy()

        await context.close()
    })

    test('[TC-F02.21] session persists across pages', async ({ page }) => {
        // Uses stored auth state from setup project
        const protectedRoutes = ['/dashboard', '/products', '/orders']

        for (const route of protectedRoutes) {
            await page.goto(route)
            await page.waitForLoadState('networkidle')

            // Should NOT redirect to login
            expect(page.url()).not.toContain('/login')
            await expectNoServerError(page)
        }
    })
})
