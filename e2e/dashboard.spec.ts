import { test, expect } from '@playwright/test'
import { expectNoServerError, expectPageLoaded } from './helpers/assertions'
import { navigateTo } from './helpers/navigation'

/**
 * Dashboard E2E Tests — Verify dashboard loads and key elements render.
 *
 * TC-F03.01: Dashboard greeting + content
 * TC-F03.02: Site cards / empty state
 * TC-F03.03: Dashboard tab navigation
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

    test('[TC-F03.03] dashboard tab navigation works', async ({ page }) => {
        await expectPageLoaded(page)

        // Look for tab-like navigation (Overview, Analytics, SEO)
        const tabs = page.locator('[role="tab"], button:has-text("Analytics"), button:has-text("SEO"), [data-state]')
        const tabCount = await tabs.count()

        if (tabCount > 1) {
            // Click second tab
            await tabs.nth(1).click()
            await page.waitForLoadState('networkidle')
            await expectNoServerError(page)

            // Click back to first tab
            await tabs.first().click()
            await page.waitForLoadState('networkidle')
            await expectNoServerError(page)
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
