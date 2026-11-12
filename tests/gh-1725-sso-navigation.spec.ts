import { test, expect, type BrowserContext } from '@playwright/test'
import { assertAllowedAuthenticatedE2ETarget } from '../e2e/helpers/authenticated-target'

type LoginResponse = {
    token?: unknown
}

type SsoSessionResponse = {
    ok?: boolean
    redirectTo?: string
}

function getDedicatedSsoEmail(baseEmail: string): string {
    const separator = baseEmail.lastIndexOf('@')
    if (separator <= 0) {
        throw new Error('TEST_EMAIL must be a valid email address.')
    }
    return `${baseEmail.slice(0, separator)}+gh1725${baseEmail.slice(separator)}`
}

test.describe('[GH-1725] Generic SSO navigation', () => {
    test('[TC-1725-E2E-03] PWv2 generic callback lands on Dashboard', async ({
        browser,
        playwright,
    }, testInfo) => {
        // Arrange
        const baseURL = testInfo.project.use.baseURL
        assertAllowedAuthenticatedE2ETarget(baseURL)

        const email = process.env.TEST_EMAIL
        const password = process.env.TEST_PASSWORD
        const setupSecret = process.env.E2E_SETUP_SECRET
        if (!email || !password || !setupSecret) {
            throw new Error(
                'GH-1725 E2E requires TEST_EMAIL, TEST_PASSWORD, and E2E_SETUP_SECRET.',
            )
        }
        const ssoEmail = getDedicatedSsoEmail(email)

        const api = await playwright.request.newContext({ baseURL })
        let browserContext: BrowserContext | undefined

        try {
            const fixtureResponse = await api.post('/api/e2e/ensure-test-user', {
                headers: { Authorization: `Bearer ${setupSecret}` },
                data: {
                    email: ssoEmail,
                    password,
                    tenantSlug: 'e2e-gh-1725-sso-navigation',
                    ssoCompletedSteps: [1],
                },
            })
            if (!fixtureResponse.ok()) {
                throw new Error(
                    `GH-1725 fixture setup failed with status ${fixtureResponse.status()}.`,
                )
            }
            const fixtureBody = await fixtureResponse.json() as {
                ssoCompletedSteps?: unknown
                ssoLegacyGates?: unknown
            }
            expect(fixtureBody.ssoCompletedSteps).toEqual([1])
            expect(fixtureBody.ssoLegacyGates).toEqual({
                hasSeenAiWizard: true,
                onboardingCompleted: true,
            })

            // The SSO portal hands over Payload's own password-step token as v2_token; sso-session checks it
            // with payload.auth() and mints the OTP-equivalent session. An OTP token would not be one, so this
            // stays a password login (it opens no protected route by itself, TC-PERF-142).
            const loginResponse = await api.post('/api/users/login', {
                data: { email: ssoEmail, password },
            })
            if (!loginResponse.ok()) {
                throw new Error(
                    `GH-1725 Payload login failed with status ${loginResponse.status()}.`,
                )
            }
            const loginBody = await loginResponse.json() as LoginResponse
            if (typeof loginBody.token !== 'string' || loginBody.token.length === 0) {
                throw new Error('GH-1725 Payload login did not return a usable token.')
            }

            browserContext = await browser.newContext({ storageState: undefined })
            const page = await browserContext.newPage()
            const visitedPaths: string[] = []
            page.on('framenavigated', (frame) => {
                if (frame === page.mainFrame()) {
                    visitedPaths.push(new URL(frame.url()).pathname)
                }
            })
            await page.goto(new URL('/login', baseURL).toString())

            const sessionRequestPromise = page.waitForRequest((request) => (
                request.method() === 'POST'
                && new URL(request.url()).pathname === '/api/auth/sso-session'
            ))
            const sessionResponsePromise = page.waitForResponse((response) => (
                response.request().method() === 'POST'
                && new URL(response.url()).pathname === '/api/auth/sso-session'
            ))

            // Act
            try {
                await page.evaluate((token) => {
                    window.setTimeout(() => {
                        const callbackUrl = new URL('/sso/authorization', window.location.origin)
                        callbackUrl.searchParams.set('v2_token', token)
                        window.location.assign(callbackUrl)
                    }, 0)
                }, loginBody.token)
            } catch {
                throw new Error('GH-1725 authorization navigation failed.')
            }

            const sessionRequest = await sessionRequestPromise
            if (new URL(page.url()).pathname === '/sso/authorization') {
                await page.evaluate(() => {
                    window.history.replaceState(null, '', '/sso/authorization')
                })
            }
            const requestBody = sessionRequest.postDataJSON() as Record<string, unknown>
            expect(Object.prototype.hasOwnProperty.call(requestBody, 'redirect_url')).toBe(false)
            expect(typeof requestBody.v2_token).toBe('string')

            const sessionResponse = await sessionResponsePromise
            expect(sessionResponse.status()).toBe(200)
            const sessionBody = await sessionResponse.json() as SsoSessionResponse
            expect(sessionBody).toEqual({ ok: true, redirectTo: '/dashboard' })

            try {
                await page.waitForURL((url) => url.pathname === '/dashboard')
            } catch {
                throw new Error(
                    `GH-1725 callback did not reach Dashboard; current path: ${new URL(page.url()).pathname}`,
                )
            }

            // Assert
            expect(new URL(page.url()).pathname).toBe('/dashboard')
            expect(visitedPaths).not.toContain('/settings/shipping')
            expect(visitedPaths).not.toContain('/verify-otp')
            const cookies = await browserContext.cookies()
            const sessionCookie = cookies.find((cookie) => cookie.name === 'payload-token')
            expect(sessionCookie).toEqual(expect.objectContaining({
                httpOnly: true,
                sameSite: 'Lax',
                path: '/',
            }))
        } finally {
            await browserContext?.close()
            await api.dispose()
        }
    })
})
