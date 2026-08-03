import { test as setup, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { assertAllowedAuthenticatedE2ETarget } from './helpers/authenticated-target'

const AUTH_FILE = './e2e/.auth/user.json'

/**
 * Auth Setup — Login once, save session for all subsequent tests.
 *
 * Uses E2E test credentials from environment variables.
 * Handles OTP 2FA via E2E_TEST_OTP_CODE bypass.
 *
 * TC-F02.19: Login happy path
 * TC-F02.23: OTP verification
 */
setup('authenticate', async ({ page }, testInfo) => {
    assertAllowedAuthenticatedE2ETarget(testInfo.project.use.baseURL)

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
        const p = url.pathname
        return p.includes('/verify-otp') || p.includes('/dashboard') || p.includes('/builder')
    }, { timeout: 15_000 })

    // Handle OTP verification
    const currentUrl = page.url()
    if (currentUrl.includes('/verify-otp')) {
        const otpCode = process.env.E2E_TEST_OTP_CODE
        if (!otpCode) {
            console.warn('[Auth Setup] OTP page reached but E2E_TEST_OTP_CODE not set — cannot auto-verify')
            await page.context().storageState({ path: AUTH_FILE })
            return
        }

        // Fill OTP digits — try individual inputs first, then single input
        const otpInputs = page.locator('input[inputmode="numeric"], input[data-otp="true"]')
        const inputCount = await otpInputs.count()

        if (inputCount >= 6) {
            // Individual digit inputs (common OTP UI pattern)
            for (let i = 0; i < 6; i++) {
                await otpInputs.nth(i).fill(otpCode[i])
            }
        } else {
            // Single input field
            const singleInput = page.locator('input[name="otp"], input[placeholder*="code" i], input[type="text"]').first()
            if (await singleInput.isVisible()) {
                await singleInput.fill(otpCode)
            }
        }

        // Submit OTP — click verify button or wait for auto-submit
        const verifyBtn = page.locator('button[type="submit"], button:has-text("Verify"), button:has-text("Submit")').first()
        if (await verifyBtn.isVisible()) {
            await verifyBtn.click()
        }

        // Wait for redirect to dashboard
        try {
            await page.waitForURL(url => {
                const p = url.pathname
                return p.includes('/dashboard') || p.includes('/builder') || p.includes('/onboarding')
            }, { timeout: 15_000 })
        } catch {
            console.warn('[Auth Setup] OTP submitted but did not redirect to dashboard')
        }
    }

    // Save authentication state
    await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true })
    await page.context().storageState({ path: AUTH_FILE })
})
