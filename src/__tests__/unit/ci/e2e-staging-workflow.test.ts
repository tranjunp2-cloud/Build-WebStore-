import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('E2E staging workflow', () => {
    const workflow = readFileSync(
        resolve(process.cwd(), '.github/workflows/e2e-staging.yml'),
        'utf8',
    )
    const dashboardSpec = readFileSync(
        resolve(process.cwd(), 'e2e/dashboard.spec.ts'),
        'utf8',
    )

    it('waits for the dashboard fixture capability before Playwright starts', () => {
        expect(workflow).toContain('dashboard-fixture-v1')
        expect(workflow).toContain('.dashboardFixture.orderId')
        expect(workflow).toContain('startswith("E2E-DASHBOARD-PENDING-")')
        expect(workflow).not.toContain(
            'if [ "$STATUS" = "401" ] || [ "$STATUS" = "503" ]',
        )
    })

    it('fails instead of skipping when E2E setup credentials are absent', () => {
        expect(workflow).not.toContain('skipping user provisioning')
        expect(workflow).toContain('E2E_SETUP_SECRET is required')
    })

    it('reprovisions the dashboard fixture for every retry-safe test attempt', () => {
        const runE2EStep = workflow.slice(workflow.indexOf('- name: Run E2E tests'))

        expect(runE2EStep).toContain(
            'E2E_SETUP_SECRET: ${{ secrets.E2E_SETUP_SECRET }}',
        )
        expect(dashboardSpec).toContain('await provisionDashboardFixture()')
        expect(dashboardSpec).not.toContain('period=today')
        expect(dashboardSpec.match(/period=7d/g)).toHaveLength(2)
    })
})
