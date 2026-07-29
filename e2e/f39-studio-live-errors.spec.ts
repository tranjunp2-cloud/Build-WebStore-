import { expect, test } from '@playwright/test'

const guidance = {
    category: 'http-500-503',
    investigationArea: 'Application route, dependency, or recent deployment',
    checks: [
        'Inspect the top application frame',
        'Compare the first occurrence with the latest deployment',
    ],
    escalationCondition:
        'Escalate when the application frame is unavailable or the deployment comparison is inconclusive',
    label: 'Suggested next checks',
}

const sentryError = {
    source: 'sentry',
    providerId: '9001',
    occurredAt: '2026-07-28T08:00:00.000Z',
    severity: 'high',
    message: 'Synthetic checkout failure',
    host: 'coffee.primeweb.app',
    tenantMatch: { id: '42', slug: 'coffee', name: 'Coffee' },
    route: '/api/orders',
    method: 'POST',
    statusCode: 500,
    release: 'release-1',
    deploymentId: null,
    requestId: 'req-shared',
    traceId: 'trace-shared',
    frames: [
        {
            function: 'POST',
            module: 'app.api.orders',
            filename: '/app/api/orders/route.ts',
            line: 42,
        },
    ],
    providerUrl: 'https://sentry.io/organizations/example/issues/9001/',
    guidance,
}

test.describe('[TC-F39-E2E] Studio Live Errors', () => {
    test('[TC-F39-E2E.01] isolates provider failure, retries, reviews detail, and promotes identity only', async ({ page }) => {
        // Arrange
        let vercelAttempts = 0
        let promotionBody: Record<string, unknown> | null = null

        await page.route('**/api/admin/issues/providers?**', async (route) => {
            const requestUrl = new URL(route.request().url())
            const source = requestUrl.searchParams.get('source')
            const providerId = requestUrl.searchParams.get('id')

            if (source === 'sentry') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: providerId ? sentryError : [sentryError],
                        fetchedAt: '2026-07-28T08:01:00.000Z',
                    }),
                })
                return
            }

            vercelAttempts += 1
            if (vercelAttempts === 1) {
                await route.fulfill({
                    status: 502,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'Provider unavailable',
                        source: 'vercel',
                        code: 'rate-limited',
                    }),
                })
                return
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: [],
                    fetchedAt: '2026-07-28T08:02:00.000Z',
                }),
            })
        })

        await page.route('**/api/admin/issues', async (route) => {
            if (route.request().method() !== 'POST') {
                await route.continue()
                return
            }
            promotionBody = route.request().postDataJSON() as Record<string, unknown>
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    created: true,
                    data: {
                        id: 77,
                        title: 'Sentry: Synthetic checkout failure',
                        description: 'Server-refetched safe evidence',
                        severity: 'high',
                        category: 'other',
                        status: 'open',
                        relatedType: 'runtime',
                        relatedId: 'sentry:9001',
                        assignedTo: null,
                        comments: [],
                        timeline: [],
                        createdAt: '2026-07-28T08:03:00.000Z',
                        updatedAt: '2026-07-28T08:03:00.000Z',
                    },
                }),
            })
        })

        // Act — open the approved existing Studio surface.
        await page.goto('/studio/issues')
        await page.getByRole('button', { name: 'Live errors' }).click()

        // Assert — Sentry stays usable while Vercel independently fails.
        await expect(page.getByRole('region', { name: 'Sentry status' })).toContainText('1 errors')
        const vercelStatus = page.getByRole('region', { name: 'Vercel status' })
        await expect(vercelStatus).toContainText('Unavailable')
        await expect(page.getByText('Synthetic checkout failure')).toBeVisible()

        // Act / Assert — retry only the failed provider and preserve the Sentry row.
        await vercelStatus.getByRole('button', { name: 'Retry' }).click()
        await expect(vercelStatus).toContainText('0 errors')
        await expect(page.getByText('Synthetic checkout failure')).toBeVisible()

        // Act — inspect server-refetched safe detail.
        await page.getByRole('button', { name: /Synthetic checkout failure/ }).click()
        const detailDialog = page.getByRole('dialog')
        await expect(detailDialog.getByText('Safe evidence')).toBeVisible()
        await expect(detailDialog.getByText('Coffee')).toBeVisible()
        await expect(detailDialog.getByText('Suggested next checks')).toBeVisible()
        await expect(detailDialog.getByText('Escalation condition')).toBeVisible()

        // Act — promote through the manual confirmation modal.
        await detailDialog.getByRole('button', { name: 'Create Tracked Issue' }).click()
        const promotionDialog = page.getByRole('dialog').last()
        await promotionDialog.getByRole('button', { name: 'Create tracked issue' }).click()

        // Assert — browser submits provider identity, not display evidence.
        await expect(page.getByRole('button', { name: 'Tracked issues' })).toHaveAttribute(
            'aria-pressed',
            'true',
        )
        await expect(page.getByText('Sentry: Synthetic checkout failure').first()).toBeVisible()
        expect(promotionBody).toEqual({
            relatedType: 'runtime',
            source: 'sentry',
            providerId: '9001',
            title: 'Sentry: Synthetic checkout failure',
            severity: 'high',
        })
    })
})
