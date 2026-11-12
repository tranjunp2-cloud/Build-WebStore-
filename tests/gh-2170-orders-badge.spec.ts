import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import {
    assertAllowedAuthenticatedE2ETarget,
    LOCAL_E2E_ORIGIN,
    LOCAL_E2E_WORKTREE_ORIGIN,
} from '../e2e/helpers/authenticated-target'

test.describe('[TC-GH2170-03] Orders badge and Pending list', () => {
    test('shows the same primary-workspace Pending count in sidebar, card and filtered list', async ({ page }, testInfo) => {
        test.setTimeout(120_000)
        // Arrange — read the existing workspace only; staging data must never be changed by this test.
        assertAllowedAuthenticatedE2ETarget(testInfo.project.use.baseURL)
        await page.addInitScript(() => localStorage.setItem('sidebar_collapsed', 'false'))
        const metricsResponsePromise = page.waitForResponse(
            response => new URL(response.url()).pathname === '/api/orders/metrics'
                && response.request().method() === 'GET',
            { timeout: 45_000 },
        )

        // Act — read the server-rendered sidebar and client-rendered Orders data.
        await page.goto('/orders')
        await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible()
        const metricsResponse = await metricsResponsePromise
        expect(metricsResponse.ok(), await metricsResponse.text()).toBe(true)
        const metrics = (await metricsResponse.json()) as { data: { pending: number } }

        // Assert — zero hides the badge; positive counts include the Pending tooltip.
        const badge = page.locator('#dashboard-sidebar a[href="/orders"] > span').nth(1)
        const badgeState = await badge.evaluateAll(elements => elements.map(element => ({
            count: element.firstChild?.textContent?.trim(),
            title: element.getAttribute('title'),
        })))
        expect(badgeState).toEqual(metrics.data.pending > 0
            ? [{ count: metrics.data.pending > 999 ? '999+' : String(metrics.data.pending), title: 'Pending orders' }]
            : [])
        await expect(page.getByTestId('orders-metric-pending').locator('span').first())
            .toHaveText(String(metrics.data.pending))

        // Act — use the actual status filter, then read the response used by the table.
        const introDialog = page.getByRole('dialog').filter({ hasText: 'Your store has moved to Web Store' })
        if (await introDialog.isVisible()) {
            await introDialog.getByRole('button', { name: 'Close' }).click()
        }
        const filteredResponsePromise = page.waitForResponse(
            response => new URL(response.url()).pathname === '/api/orders'
                && new URL(response.url()).searchParams.get('status') === 'pending'
                && response.request().method() === 'GET',
            { timeout: 45_000 },
        )
        await page.getByRole('button', { name: /Status\s*:\s*All status/i }).click()
        await page.getByRole('button', { name: 'Pending', exact: true }).click()
        const filteredResponse = await filteredResponsePromise
        expect(filteredResponse.ok(), await filteredResponse.text()).toBe(true)
        const filtered = (await filteredResponse.json()) as { totalDocs: number }

        // Assert — page requests do not change the Pending total or badge.
        expect(filtered.totalDocs).toBe(metrics.data.pending)
        for (const pageNumber of [1, 2]) {
            const response = await page.request.get(`/api/orders?status=pending&limit=1&page=${pageNumber}`)
            expect(response.ok(), await response.text()).toBe(true)
            const result = (await response.json()) as { totalDocs: number }
            expect(result.totalDocs).toBe(metrics.data.pending)
        }
        expect(await badge.evaluateAll(elements => elements.map(element => element.firstChild?.textContent?.trim())))
            .toEqual(badgeState.map(item => item.count))
    })

    test('requires a positive Pending badge on an isolated local tenant', async ({ page }, testInfo) => {
        test.setTimeout(180_000)
        const baseURL = testInfo.project.use.baseURL
        assertAllowedAuthenticatedE2ETarget(baseURL)
        test.skip(
            ![LOCAL_E2E_ORIGIN, LOCAL_E2E_WORKTREE_ORIGIN].includes(new URL(baseURL).origin),
            'Positive-order fixture is only seeded in an isolated local database',
        )

        // Arrange — seed only an explicitly isolated local database; never write to staging.
        const databaseURI = process.env.DATABASE_URI
        expect(databaseURI, 'Set DATABASE_URI to the isolated local PostgreSQL fixture').toBeTruthy()
        expect(['localhost', '127.0.0.1']).toContain(new URL(databaseURI!).hostname)
        expect(process.env.APP_ENV).toBe('qc-test')
        const beforeResponse = await page.request.get('/api/orders/metrics')
        expect(beforeResponse.ok()).toBe(true)
        const before = (await beforeResponse.json()) as { data: { pending: number } }
        const output = execFileSync('npx', ['tsx', '--require', './scripts/seed-preload.cjs',
            'scripts/seed-test-orders.ts', '--slug=qc-shop-1'], {
            cwd: process.cwd(),
            env: { ...process.env, DATABASE_URI: databaseURI!, MAIL_HOST: '', DATABASE_URI_READ_REPLICA: '' },
            encoding: 'utf8',
            timeout: 90_000,
        })
        expect(output.match(/^✓/gm)).toHaveLength(4)
        const afterResponse = await page.request.get('/api/orders/metrics')
        expect(afterResponse.ok()).toBe(true)
        const after = (await afterResponse.json()) as { data: { pending: number } }
        expect(after.data.pending).toBe(before.data.pending + 3)
        await page.addInitScript(() => localStorage.setItem('sidebar_collapsed', 'false'))
        const metricsResponsePromise = page.waitForResponse(
            response => new URL(response.url()).pathname === '/api/orders/metrics'
                && response.request().method() === 'GET',
            { timeout: 45_000 },
        )

        // Act
        await page.goto('/orders')
        const metrics = (await (await metricsResponsePromise).json()) as { data: { pending: number } }

        // Assert — the new fixture appears in the sidebar, card and filtered list.
        expect(metrics.data.pending).toBe(after.data.pending)
        const badge = page.locator('#dashboard-sidebar a[href="/orders"] > span').nth(1)
        await expect.poll(async () => {
            await page.reload()
            return (await badge.textContent())?.trim()
        }, { timeout: 75_000, intervals: [1_000, 5_000] })
            .toBe(`${metrics.data.pending > 999 ? '999+' : metrics.data.pending} Pending orders`)
        await expect(badge).toHaveAttribute('title', 'Pending orders')
        await expect(page.getByTestId('orders-metric-pending').locator('span').first())
            .toHaveText(String(metrics.data.pending))
        const filteredResponse = await page.request.get('/api/orders?status=pending&limit=1&page=2')
        expect(filteredResponse.ok()).toBe(true)
        const filtered = (await filteredResponse.json()) as { totalDocs: number }
        expect(filtered.totalDocs).toBe(metrics.data.pending)
    })
})
