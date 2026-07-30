import {
    test,
    expect,
    type APIRequestContext,
    type Page,
} from '@playwright/test'
import { expectNoServerError, expectPageLoaded } from './helpers/assertions'
import { navigateTo } from './helpers/navigation'
import { provisionDashboardFixture } from './helpers/dashboard-fixture'

type FixtureOrderStatus =
    | 'pending'
    | 'new'
    | 'confirmed'
    | 'ready_to_ship'
    | 'shipped'
    | 'completed'
    | 'cancelled'
    | 'refunded'

async function updateOrderStatus(
    request: APIRequestContext,
    orderId: string,
    status: FixtureOrderStatus,
    trackingNumber?: string,
) {
    const response = await request.patch(`/api/orders/${orderId}`, {
        data: { status, ...(trackingNumber ? { trackingNumber } : {}) },
    })
    const responseBody = await response.text()
    expect(response.ok(), responseBody).toBe(true)
}

async function retireDashboardFixture(request: APIRequestContext, orderId: string) {
    const response = await request.get(`/api/orders/${orderId}?depth=0`)
    if (!response.ok()) return

    const body = await response.json() as { data?: { status?: FixtureOrderStatus } }
    let status = body.data?.status
    if (!status || status === 'cancelled' || status === 'refunded') return

    if (status === 'pending' || status === 'new' || status === 'confirmed') {
        await updateOrderStatus(request, orderId, 'cancelled')
        return
    }
    if (status === 'ready_to_ship') {
        await updateOrderStatus(request, orderId, 'shipped', 'E2E-TRACKING')
        status = 'shipped'
    }
    if (status === 'shipped') {
        await updateOrderStatus(request, orderId, 'completed')
        status = 'completed'
    }
    if (status === 'completed') {
        await updateOrderStatus(request, orderId, 'refunded')
    }
}

async function readRevenue(page: Page): Promise<number> {
    const revenueCard = page.locator('.stat-card').filter({
        has: page.locator('.stat-label').filter({ hasText: /^Revenue$/ }),
    })
    await expect(revenueCard).toHaveCount(1)
    const text = await revenueCard.locator('.stat-val').innerText()
    return Number(text.replace(/[^0-9.-]/g, ''))
}

/**
 * Dashboard E2E Tests — Verify dashboard loads and key elements render.
 *
 * TC-F03.01: Dashboard greeting + content
 * TC-F03.02: Site cards / empty state
 * TC-F18.30: Sidebar label renamed from "Store Config" to "Settings" (BUG-985)
 */

test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await navigateTo(page, '/dashboard')
    })

    test('[TC-F03.01] dashboard renders with user content', async ({ page }) => {
        await expectPageLoaded(page)

        // Should have main content area
        const mainContent = page.locator('main, [role="main"]')
        await expect(mainContent.first()).toBeVisible()

        // Should have sidebar navigation with key links
        const nav = page.locator('nav, [role="navigation"], aside')
        if (await nav.count() > 0) {
            const navLinks = await page.locator(
                'a[href*="/products"], a[href*="/orders"], a[href*="/blog"], a[href*="/settings"]'
            ).count()
            expect(navLinks).toBeGreaterThan(0)
        }
    })

    test('[TC-F03.02] dashboard KPI or empty state visible', async ({ page }) => {
        await expectPageLoaded(page)

        // Must render EITHER site cards, stats, OR an empty state CTA
        const siteCards = page.locator('[data-testid="site-card"], a[href*="/builder"], a[href*="/editor"]')
        const emptyState = page.locator('text=/create|get started|no site|build your/i')
        const stats = page.locator('[data-testid*="stat"], [data-testid*="kpi"]')

        const hasSites = await siteCards.count()
        const hasEmpty = await emptyState.count()
        const hasStats = await stats.count()

        // At least one of these must be present
        expect(hasSites + hasEmpty + hasStats).toBeGreaterThan(0)
    })

    test('[TC-F03.57] pending order approval refreshes the widget and Revenue', async ({ page }) => {
        test.setTimeout(210_000)

        let orderId: string | null = null

        try {
            // Arrange — every Playwright attempt gets a fresh isolated fixture so
            // retries never inherit the prior attempt's terminal order state.
            const fixture = await provisionDashboardFixture(page.request)
            orderId = fixture.orderId
            await navigateTo(page, '/dashboard?period=7d')
            const pendingOrder = page.locator(
                `a[href="/orders/${encodeURIComponent(fixture.orderId)}"]`,
            ).filter({ hasText: fixture.orderNumber })
            await expect(pendingOrder).toBeVisible()

            const href = await pendingOrder.getAttribute('href')
            expect(href).toMatch(/^\/orders\/[^/?#]+$/)
            expect(decodeURIComponent(href!.split('/').at(-1)!)).toBe(orderId)
            expect(href).toBe(`/orders/${encodeURIComponent(orderId)}`)
            const revenueBefore = await readRevenue(page)

            // Act — open the real detail page, approve through the UI, then use the
            // authenticated status API for the remaining fulfillment transitions.
            await pendingOrder.click()
            await expect(page).toHaveURL(new RegExp(`/orders/${encodeURIComponent(orderId)}$`))

            const confirmResponsePromise = page.waitForResponse(response => (
                response.request().method() === 'PATCH'
                && response.url().endsWith(`/api/orders/${orderId}`)
            ))
            await page.getByRole('button', { name: /^Confirm Order$/i }).click()
            const confirmResponse = await confirmResponsePromise
            const confirmBody = await confirmResponse.text()
            expect(confirmResponse.ok(), confirmBody).toBe(true)

            await updateOrderStatus(page.request, orderId, 'ready_to_ship')
            await updateOrderStatus(page.request, orderId, 'shipped', 'E2E-TRACKING')
            await updateOrderStatus(page.request, orderId, 'completed')

            await navigateTo(page, '/dashboard?period=7d')

            // Assert — pending list is refreshed and completed MYR revenue increases.
            await expect(pendingOrder).toHaveCount(0)
            const revenueAfter = await readRevenue(page)
            expect(revenueAfter).toBeCloseTo(
                revenueBefore + fixture.orderTotal,
                2,
            )
            await expectNoServerError(page)
        } finally {
            if (orderId) await retireDashboardFixture(page.request, orderId)
        }
    })

    test('[TC-F18.30] sidebar shows "Settings" label — not "Store Config" (regression BUG-985)', async ({ page }) => {
        await expectPageLoaded(page)

        // "Store Config" must be gone
        await expect(page.locator('text=Store Config')).toHaveCount(0)
        // "Settings" nav button must be present in sidebar
        await expect(page.getByRole('button', { name: /^Settings$/i }).first()).toBeVisible()
    })

    test('sidebar navigation links work', async ({ page }) => {
        const routes = [
            { path: '/products', name: 'products' },
            { path: '/orders', name: 'orders' },
            { path: '/dashboard/settings', name: 'settings' },
        ]

        for (const route of routes) {
            await page.goto(route.path)
            await page.waitForLoadState('networkidle')
            expect(page.url()).toContain(route.name)
            await expectNoServerError(page)
        }
    })
})
