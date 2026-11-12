import { randomBytes } from 'node:crypto'
import { expect, test, type BrowserContext } from '@playwright/test'
import { readSuperAdminCredentials } from '../e2e/helpers/super-admin-session'

// Dedicated fixture accounts only. No network mocking; links/cookies must never be retained in artifacts.
test.describe.serial('[TC-F15.38–45] merchant access browser and REST boundaries', () => {
    let admin: BrowserContext
    let tenantId: number
    let ownerId: number
    let siteId: number
    let pageId: number
    const userIds: number[] = []
    const suffix = randomBytes(6).toString('hex')
    const password = randomBytes(24).toString('hex')
    const email = (role: string) => `e2e-f15-${role}-${suffix}@example.test`

    test.beforeAll(async ({ browser, baseURL }) => {
        test.skip(!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Isolated local fixture suite uses development OTP bypass; never run against a deployed environment')
        const credentials = readSuperAdminCredentials()
        test.skip(!credentials, 'Requires ADMIN_EMAIL / ADMIN_PASSWORD for isolated fixture creation')
        admin = await browser.newContext({ storageState: { cookies: [], origins: [] } })
        const login = await admin.request.post('/api/users/login', { data: credentials })
        expect(login.status()).toBe(200)
        expect((await login.json()).user.roles).toContain('super-admin')
        const tenant = await admin.request.post('/api/tenants', {
            data: { name: `E2E F15 ${suffix}`, slug: `e2e-f15-${suffix}`, status: 'active', onboardingCompleted: true },
        })
        expect(tenant.status()).toBe(201)
        tenantId = (await tenant.json()).doc.id
        const site = await admin.request.post('/api/sites', { data: { tenant: tenantId, name: `E2E F15 ${suffix}`, status: 'draft', siteType: 'business' } })
        expect(site.status()).toBe(201)
        siteId = (await site.json()).doc.id
        const home = await admin.request.post('/api/pages', { data: { site: siteId, title: 'Home', slug: 'home', layout: [] } })
        expect(home.status()).toBe(201)
        pageId = (await home.json()).doc.id
        for (const role of ['tenant-owner', 'studio-viewer', 'support']) {
            const created = await admin.request.post('/api/users', { data: {
                email: email(role), password, firstName: 'E2E', roles: [role],
                ...(role === 'tenant-owner' ? { tenants: [{ tenant: tenantId, role: 'owner', status: 'active' }] } : {}),
            } })
            expect(created.status()).toBe(201)
            const id = (await created.json()).doc.id as number
            userIds.push(id)
            if (role === 'tenant-owner') ownerId = id
        }
    })

    test.afterAll(async () => {
        if (!admin) return
        try {
            if (pageId) expect((await admin.request.delete(`/api/pages/${pageId}`)).ok()).toBe(true)
            if (siteId) expect((await admin.request.delete(`/api/sites/${siteId}`)).ok()).toBe(true)
            for (const id of userIds) expect((await admin.request.delete(`/api/users/${id}`)).ok()).toBe(true)
            if (tenantId) expect((await admin.request.delete(`/api/tenants/${tenantId}`)).ok()).toBe(true)
        } finally {
            await admin.close()
        }
    })

    async function loginRole(context: BrowserContext, role: string) {
        const login = await context.request.post('/api/users/login', { data: { email: email(role), password } })
        expect(login.status()).toBe(200)
        const sent = await context.request.post('/api/users/send-otp', { data: { email: email(role) } })
        expect(sent.ok()).toBe(true)
        const verified = await context.request.post('/api/users/verify-otp', {
            data: { email: email(role), otp: process.env.E2E_TEST_OTP_CODE || '000000' },
        })
        expect(verified.status()).toBe(200)
    }

    async function createLink() {
        const response = await admin.request.post('/api/admin/merchant-access', { data: { userId: ownerId } })
        expect(response.status()).toBe(201)
        return (await response.json()).data.url as string
    }

    test('[TC-F15.41/44/45] password admin sees Studio menu, searches, copies link and sees recent access', async () => {
        // Arrange — password-only /admin session, no OTP.
        const page = await admin.newPage()
        await admin.grantPermissions(['clipboard-read', 'clipboard-write'])
        await page.goto('/admin')
        await expect(page).not.toHaveURL(/\/admin\/login/)
        await page.goto('/studio')
        // Act
        await page.getByRole('link', { name: 'Merchant CMS access', exact: true }).click()
        await expect(page).toHaveURL(/\/studio\/merchant-access$/)
        await expect(page.locator('aside')).toBeVisible()
        await expect(page.locator('header.studio-topbar')).toBeVisible()
        const search = page.getByRole('button', { name: 'Search', exact: true })
        // A controlled input filled before hydration can be reset. Wait for the real onChange to enable Search.
        await expect(async () => {
            await page.getByRole('textbox', { name: 'Merchant email or company name' }).fill(email('tenant-owner'))
            await expect(search).toBeEnabled()
        }).toPass({ timeout: 60_000 })
        await search.click()
        await page.getByRole('button', { name: 'Create login link', exact: true }).click()
        // Assert
        await expect(page.getByText('Link copied.', { exact: false })).toBeVisible()
        const link = await page.getByRole('textbox', { name: 'Login link', exact: true }).inputValue()
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link)
        const recent = page.getByRole('region', { name: 'Recent access' })
        await expect(recent.getByRole('cell', { name: email('tenant-owner'), exact: true }).first()).toBeVisible()
        expect(await recent.locator('tbody tr').count()).toBeLessThanOrEqual(20)
        await page.close()
        // Link creation refreshes the current page; verify the redirect in a new tab to avoid racing that refresh.
        const redirected = await admin.newPage()
        await redirected.goto('/support/merchant-access')
        await expect(redirected).toHaveURL(/\/studio\/merchant-access$/)
        await redirected.close()
    })

    test('[TC-F15.42/43] redeem in separate context, banner and Exit clear session and AI state', async ({ browser }) => {
        // Arrange
        const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
        try {
            const page = await context.newPage()
            await page.goto(await createLink())
            // Act / Assert
            await expect(page).toHaveURL(/\/dashboard/, { timeout: 90_000 })
            const banner = page.getByTestId('merchant-access-banner')
            await expect(banner).toContainText(email('tenant-owner'))
            await expect(banner).toContainText(readSuperAdminCredentials()!.email)
            await expect(banner).toContainText(/\d+h \d+m left/)
            await page.screenshot({ path: test.info().outputPath('dashboard.png') })
            for (const route of ['/builder/new', `/editor/${siteId}`]) {
                await page.goto(route)
                await expect(page.getByTestId('merchant-access-banner')).toContainText(/\d+h \d+m left/)
            }
            await page.goto('/dashboard')
            await expect(banner).toContainText(/\d+h \d+m left/)
            await page.evaluate(() => localStorage.setItem('editor-chat-f15', 'test history'))
            await banner.getByRole('button', { name: /exit/i }).click()
            await expect(page).toHaveURL(/\/login/)
            expect((await context.cookies()).find(c => c.name === 'payload-token')).toBeUndefined()
            expect(await page.evaluate(() => localStorage.getItem('editor-chat-f15'))).toBeNull()
            await page.goto('/dashboard')
            await expect(page).toHaveURL(/\/login/)
        } finally { await context.close() }
        const page = await admin.newPage()
        await page.goto('/studio/merchant-access')
        await expect(page.getByRole('region', { name: 'Recent access' }).getByRole('row').filter({ hasText: email('tenant-owner') }).filter({ hasText: 'Opened at' }).first()).toBeVisible()
        await page.close()
    })

    test('[TC-F15.41/44/45] viewer cannot see menu/open page/create link; support keeps separate page', async ({ browser }) => {
        for (const role of ['studio-viewer', 'support']) {
            // Arrange
            const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
            try {
                await loginRole(context, role)
                const page = await context.newPage()
                // Act / Assert
                await page.goto('/studio/merchant-access')
                if (role === 'studio-viewer') {
                    await expect(page).toHaveURL(/\/studio$/)
                    await expect(page.getByRole('link', { name: 'Merchant CMS access', exact: true })).toHaveCount(0)
                    expect((await context.request.post('/api/admin/merchant-access', { data: { userId: ownerId } })).status()).toBe(403)
                    expect((await context.request.get('/api/admin/merchant-access?q=merchant')).status()).toBe(403)
                } else {
                    await expect(page).not.toHaveURL(/\/studio/)
                    await page.goto('/support/merchant-access')
                    await expect(page).toHaveURL(/\/support\/merchant-access$/)
                    await expect(page.getByRole('heading', { name: 'Merchant CMS access', exact: true })).toBeVisible()
                }
                await expect(page.getByTestId('merchant-access-banner')).toHaveCount(0)
            } finally { await context.close() }
        }
        const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } })
        try {
            expect((await anonymous.request.get('/api/admin/merchant-access?q=merchant')).status()).toBe(401)
            expect((await anonymous.request.post('/api/admin/merchant-access', { data: { userId: ownerId } })).status()).toBe(401)
        } finally { await anonymous.close() }
    })

    test('[TC-PERF-142/F15.42] encoded pre-OTP cookie stays refused; normal owner has no banner', async ({ browser }) => {
        // Arrange
        const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
        try {
            const login = await context.request.post('/api/users/login', { data: { email: email('tenant-owner'), password } })
            expect(login.status()).toBe(200)
            const cookie = (await context.cookies()).find(c => c.name === 'payload-token')!
            // Act
            await context.addCookies([{ ...cookie, value: cookie.value.replaceAll('.', '%2E') }])
            // Assert
            expect((await context.request.get('/api/tenants')).status()).toBe(401)
            expect((await context.request.get('/api/tenants', { headers: { Cookie: `payload-token =${cookie.value.replaceAll('.', '%2E')}` } })).status()).toBe(401)
            await loginRole(context, 'tenant-owner')
            const page = await context.newPage()
            await page.goto('/dashboard')
            await expect(page).toHaveURL(/\/dashboard/)
            await expect(page.getByTestId('merchant-access-banner')).toHaveCount(0)
            for (const route of ['/builder/new', `/editor/${siteId}`]) {
                await page.goto(route)
                await expect(page.getByTestId('merchant-access-banner')).toHaveCount(0)
            }
        } finally { await context.close() }
    })

    test('[TC-F15.38/39/40] real encoded session cannot PATCH credentials/payout or obtain Firebase token', async ({ browser }) => {
        // Arrange — redeem a real one-time link, then encode the actual signed cookie.
        const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
        try {
            const page = await context.newPage()
            await page.goto(await createLink())
            await expect(page).toHaveURL(/\/dashboard/, { timeout: 90_000 })
            const cookie = (await context.cookies()).find(c => c.name === 'payload-token')!
            await context.addCookies([{ ...cookie, value: cookie.value.replaceAll('.', '%2E') }])
            const beforeUser = await (await admin.request.get(`/api/users/${ownerId}?depth=0`)).json()
            const beforeTenant = await (await admin.request.get(`/api/tenants/${tenantId}?depth=0`)).json()
            // Act / Assert — a real authenticated read proves auth accepted the encoded cookie.
            const current = await context.request.get('/api/users/me')
            expect(current.status()).toBe(200)
            expect((await current.json()).id).toBe(ownerId)
            const firebase = await context.request.get('/api/notifications/firebase-token')
            expect(firebase.status()).toBe(403)
            expect((await firebase.json()).error).toBe('impersonation_forbidden_action')
            for (const data of [{ email: email('changed') }, { roles: ['super-admin'] }]) {
                expect((await context.request.patch(`/api/users/${ownerId}`, { data })).status()).toBe(403)
            }
            expect((await context.request.patch(`/api/tenants/${tenantId}`, { data: { payments: { bank_name: 'Changed by E2E' } } })).status()).toBe(403)
            const afterUser = await (await admin.request.get(`/api/users/${ownerId}?depth=0`)).json()
            const afterTenant = await (await admin.request.get(`/api/tenants/${tenantId}?depth=0`)).json()
            expect(afterUser.email).toBe(beforeUser.email)
            expect(afterUser.roles).toEqual(beforeUser.roles)
            expect(afterTenant.payments).toEqual(beforeTenant.payments)
        } finally { await context.close() }
    })
})
