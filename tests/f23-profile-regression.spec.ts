import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

const VIEWPORTS = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
] as const

type ProvisionedUser = {
    email: string
    role: 'owner' | 'staff'
}

function requiredEnv(name: 'TEST_EMAIL' | 'TEST_PASSWORD' | 'E2E_TEST_OTP_CODE' | 'E2E_SETUP_SECRET'): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is required for F23 profile browser regression`)
    return value
}

async function provisionStaff(request: APIRequestContext): Promise<ProvisionedUser> {
    const response = await request.post('/api/e2e/ensure-test-user', {
        headers: {
            Authorization: `Bearer ${requiredEnv('E2E_SETUP_SECRET')}`,
        },
        data: {
            email: requiredEnv('TEST_EMAIL'),
            password: requiredEnv('TEST_PASSWORD'),
            role: 'staff',
        },
    })

    if (!response.ok()) {
        throw new Error(`Staff provisioning failed (${response.status()}): ${await response.text()}`)
    }
    return response.json() as Promise<ProvisionedUser>
}

async function loginWithOtp(page: Page, email: string): Promise<void> {
    await page.goto('/login')
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(requiredEnv('TEST_PASSWORD'))
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL(/\/verify-otp/)

    const otpCode = requiredEnv('E2E_TEST_OTP_CODE')
    const otpInputs = page.locator('input[inputmode="numeric"], input[data-otp="true"]')
    await expect(otpInputs).toHaveCount(otpCode.length)
    for (let index = 0; index < otpCode.length; index += 1) {
        await otpInputs.nth(index).fill(otpCode[index])
    }

    await page.getByRole('button', { name: /verify|confirm/i }).click()
    await page.waitForURL(url => !url.pathname.includes('/verify-otp'))
}

async function expectFullyInside(inner: Locator, outer: Locator): Promise<void> {
    await expect(inner).toBeVisible()
    await expect(inner).toBeInViewport({ ratio: 1 })

    const [innerBox, outerBox] = await Promise.all([
        inner.boundingBox(),
        outer.boundingBox(),
    ])
    expect(innerBox).not.toBeNull()
    expect(outerBox).not.toBeNull()

    expect(innerBox!.x).toBeGreaterThanOrEqual(outerBox!.x)
    expect(innerBox!.y).toBeGreaterThanOrEqual(outerBox!.y)
    expect(innerBox!.x + innerBox!.width).toBeLessThanOrEqual(outerBox!.x + outerBox!.width)
    expect(innerBox!.y + innerBox!.height).toBeLessThanOrEqual(outerBox!.y + outerBox!.height)
}

test.describe('F23 Account Profile — GH-1614 browser regression', () => {
    test('[TC-F23-03-04] Owner hides unverified 2FA status on desktop and mobile', async ({ context }) => {
        // Arrange
        const ownerEmail = requiredEnv('TEST_EMAIL')

        for (const viewport of VIEWPORTS) {
            const viewportPage = await context.newPage()

            // Act
            await viewportPage.setViewportSize({ width: viewport.width, height: viewport.height })
            await viewportPage.goto('/settings/profile')
            const ownerView = viewportPage.getByTestId('owner-profile-view')

            // Assert
            await expect(ownerView, `${viewport.name}: Owner profile should render`).toBeVisible()
            await expect(ownerView.getByText(ownerEmail, { exact: true })).toBeVisible()
            await expect(ownerView.getByText(/\b2FA\b|two[- ]factor/i)).toHaveCount(0)
            await expect(ownerView.locator('[data-testid="owner-two-factor-status"]')).toHaveCount(0)

            await viewportPage.close()
        }
    })

    test.describe('Staff session', () => {
        test.use({ storageState: { cookies: [], origins: [] } })

        test('[TC-F23-02-02] Staff email stays disabled and lock stays unclipped on desktop and mobile', async ({ page, request }) => {
            // Arrange
            const staff = await provisionStaff(request)
            expect(staff.role).toBe('staff')
            await loginWithOtp(page, staff.email)

            for (const viewport of VIEWPORTS) {
                const viewportPage = await page.context().newPage()

                // Act
                await viewportPage.setViewportSize({ width: viewport.width, height: viewport.height })
                await viewportPage.goto('/settings/profile')
                const staffCard = viewportPage.getByTestId('staff-general-info-card')
                const emailField = viewportPage.getByTestId('profile-email-field')
                const emailInput = emailField.locator('input[type="email"]')
                const lockIcon = viewportPage.getByTestId('profile-email-lock')

                // Assert
                await expect(staffCard, `${viewport.name}: Staff profile should render`).toBeVisible()
                await expect(emailInput).toHaveValue(staff.email)
                await expect(emailInput).toBeDisabled()
                await expectFullyInside(lockIcon, emailField)

                await viewportPage.close()
            }
        })
    })
})
