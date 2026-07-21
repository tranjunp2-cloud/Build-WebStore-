import { test, expect } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_EMAIL || 'phuong.ltweb@gmail.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Aa123456@'

test.describe('Staging Smoke Tests', () => {
    test('health endpoint responds 200', async ({ request }) => {
        const res = await request.get('/api/health')
        expect(res.status()).toBe(200)
    })

    test('login page renders form', async ({ page }) => {
        await page.goto('/login')
        await expect(page.locator('#email')).toBeVisible()
        await expect(page.locator('#password')).toBeVisible()
        await expect(page.locator('#password')).toHaveAttribute('placeholder', 'Enter your password')
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    })

    test('[TC-F02.20] failed login does not clear password, focuses and selects it', async ({ page }) => {
        await page.goto('/login')
        await page.fill('input[type="email"], input[name="email"]', 'invalid-user@primeweb.app')
        await page.fill('#password', 'wrongpassword')
        await page.click('button[type="submit"]')

        const passwordInput = page.locator('#password')
        
        // Wait for input to be focused after error
        await expect(passwordInput).toBeFocused()

        // Verify password input value is still 'wrongpassword' (not cleared)
        const passwordValue = await passwordInput.inputValue()
        expect(passwordValue).toBe('wrongpassword')

        // Verify password selection is fully highlighted
        const selectionRange = await passwordInput.evaluate((el: HTMLInputElement) => {
            return { start: el.selectionStart, end: el.selectionEnd }
        })
        expect(selectionRange.start).toBe(0)
        expect(selectionRange.end).toBe('wrongpassword'.length)
    })


    test('login with valid credentials proceeds to next step', async ({ page }) => {
        await page.goto('/login')
        await page.fill('#email', TEST_EMAIL)
        await page.fill('#password', TEST_PASSWORD)
        await page.getByRole('button', { name: /sign in/i }).click()

        // Login should redirect to dashboard, onboarding, admin, OR verify-otp (if 2FA enabled)
        await page.waitForURL(/dashboard|onboarding|admin|verify-otp/, { timeout: 15000 })
        expect(page.url()).toMatch(/dashboard|onboarding|admin|verify-otp/)
    })

    test('login API responds correctly', async ({ request }) => {
        const res = await request.post('/api/users/login', {
            data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        })
        // Payload login returns 200 on success
        expect(res.status()).toBe(200)
        const body = await res.json()
        expect(body.user).toBeDefined()
        expect(body.user.email).toBe(TEST_EMAIL)
    })

    test('unauthenticated access redirects to login', async ({ page }) => {
        await page.goto('/dashboard')
        await page.waitForURL(/login/, { timeout: 10000 })
        expect(page.url()).toContain('/login')
    })
})
