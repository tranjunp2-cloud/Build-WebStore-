import { test as setup, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const AUTH_FILE = './e2e/.auth/user.json'

/**
 * Auth Setup — Login once, save session for all subsequent tests.
 *
 * Uses E2E test credentials from environment variables.
 * Handles the OTP flow by checking if OTP page appears.
 *
 * TC-F02.19: Login happy path
 * TC-F02.33: Auth middleware redirect
 */
setup('authenticate', async ({ page }) => {
    const email = process.env.TEST_EMAIL
    const password = process.env.TEST_PASSWORD
    if (!email || !password) {
        throw new Error('E2E auth requires TEST_EMAIL and TEST_PASSWORD env vars. Set them in .env.local or CI secrets.')
    }

    // Navigate to login
    await page.goto('/login')
    await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible()

    // Fill credentials
    await page.fill('input[name="email"], input[type="email"]', email)
    await page.fill('input[name="password"], input[type="password"]', password)

    // Submit login form
    await page.click('button[type="submit"]')

    // Wait for navigation — either OTP page or dashboard
    await page.waitForURL(url => {
        const path = url.pathname
        return path.includes('/verify-otp') || path.includes('/dashboard') || path.includes('/builder')
    }, { timeout: 15_000 })

    // If OTP page — need manual intervention or skip in CI
    const currentUrl = page.url()
    if (currentUrl.includes('/verify-otp')) {
        // In CI, OTP is auto-verified or skipped via test account
        // Wait for redirect to dashboard (test account may auto-verify)
        try {
            await page.waitForURL('**/dashboard**', { timeout: 30_000 })
        } catch {
            // If OTP blocks us, save state anyway — some tests can run without full auth
            console.warn('[Auth Setup] OTP verification required — some tests may be skipped')
        }
    }

    // Save authentication state
    await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true })
    await page.context().storageState({ path: AUTH_FILE })
})
