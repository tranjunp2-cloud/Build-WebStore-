import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import playwrightConfig from '../../../../playwright.config'

const readWorkspaceFile = (path: string) =>
    readFileSync(resolve(process.cwd(), path), 'utf8')

// ── TC-F37-03-49: isolated Playwright project wiring ─────────────────────────

describe('[TC-F37-03-49] F37-03 Playwright project', () => {
    it('keeps account-derived discovery in a dedicated project', () => {
        // Arrange
        const discoverySpec = readWorkspaceFile('tests/f37-ai-discoverability.spec.ts')
        const statusRoute = readWorkspaceFile('src/app/api/e2e/site-status/route.ts')
        const stagingWorkflow = readWorkspaceFile('.github/workflows/e2e-staging.yml')

        // Act
        const projects = playwrightConfig.projects ?? []
        const f37Projects = projects.filter(project => project.name === 'f37-regression')
        const f37Project = f37Projects[0]
        const storefrontProject = projects.find(project => project.name === 'storefront-regression')
        const redundantSpecVariables = discoverySpec.match(/process\.env\.E2E_F37_/g) ?? []

        // Assert
        expect(f37Projects).toHaveLength(1)
        expect(redundantSpecVariables).toHaveLength(0)
        expect(stagingWorkflow).toContain('--project=storefront-regression')
        expect(stagingWorkflow).not.toContain('--project=f37-regression')
        expect(stagingWorkflow).not.toContain('E2E_F37_')
        expect(storefrontProject?.dependencies).toEqual(['f37-regression'])
        expect(discoverySpec).toContain("await request.get('/api/users/me?include=site-status')")
        expect(discoverySpec).toContain("membership.status === 'active'")
        expect(discoverySpec).toContain('storageState: AUTH_STATE_PATH')
        expect(discoverySpec).not.toContain('/api/tenants/')
        expect(discoverySpec).not.toContain("request.get('/api/sites'")
        expect(discoverySpec).toContain('me.sites')
        expect(discoverySpec).not.toContain('fixture.hasSite && !fixture.hasPublishedSite')
        expect(discoverySpec).toContain('withTemporarySiteStatus')
        expect(discoverySpec).toContain('await setSitePublished(request, fixture.siteId, desiredPublished)')
        expect(discoverySpec).toContain('await setSitePublished(request, fixture.siteId, fixture.initiallyPublished)')
        expect(discoverySpec).toContain("request.patch('/api/e2e/site-status'")
        expect(discoverySpec).not.toContain('/api/sites/${encodeURIComponent(siteId)}/publish')
        expect(discoverySpec).toContain('restoreSitePublished')
        expect(discoverySpec).toContain('attempt <= 3')
        expect(discoverySpec).toContain('finally')
        expect(discoverySpec).not.toContain('E2E_SETUP_SECRET')
        expect(statusRoute).toContain('process.env.TEST_EMAIL')
        expect(statusRoute).toContain("user.email?.trim().toLowerCase() !== expectedEmail")
        expect(statusRoute).toContain("process.env.APP_ENV !== 'staging'")
        expect(statusRoute).toContain("membership.status === 'active'")
        expect(statusRoute).toContain("data: { status: parsed.data.status }")
        expect(discoverySpec).toContain('resolvePublicCustomDomainTarget')
        expect(discoverySpec).toContain('lookup(hostname')
        expect(discoverySpec).toContain('--host-resolver-rules=MAP')
        expect(discoverySpec).toContain("await context.route('**/*'")
        expect(discoverySpec).toContain('activeMemberships.length !== 1')
        expect(discoverySpec).toContain('ownedSites.length !== 1')
        expect(discoverySpec).toContain('findEligibleCustomDomainTargets(')
        expect(f37Project?.dependencies).toEqual(['setup'])
        expect(f37Project?.use?.storageState).toBeUndefined()
    })
})

// ── TC-F37-03-50: closeout documentation stays aligned ──────────────────────

describe('[TC-F37-03-50] F37-03 closeout documentation', () => {
    it('does not reintroduce the retired crawler-toggle implementation or deleted Tools component', () => {
        // Arrange
        const qaPlan = readWorkspaceFile('docs/qa/F37-local-seo.md')
        const dashboardArchitecture = readWorkspaceFile('docs/architecture/F03-dashboard.md')

        // Act
        const staleCrawlerBlocker = qaPlan.includes('Code currently persists and honors a seller crawler toggle')
        const staleAutoMetaClaim = qaPlan.includes('no crawler toggle, sitemap resubmit, auto-meta toggle, or SEO Action Tools section')
        const deletedToolsComponent = dashboardArchitecture.includes('SeoTools.tsx')

        // Assert
        expect(staleCrawlerBlocker).toBe(false)
        expect(staleAutoMetaClaim).toBe(false)
        expect(deletedToolsComponent).toBe(false)
    })
})

// ── TC-F37-03-51: issue/story ownership stays route-only ────────────────────

describe('[TC-F37-03-51] F37-03 and F37-04 ownership boundary', () => {
    it('keeps score attribution in #1312 instead of Story Sync issue #1311', () => {
        // Arrange
        const stories = readWorkspaceFile('docs/stories/F37-local-seo-stories.md')
        const story03 = stories.split('## US-F37-03:')[1]?.split('## US-F37-04:')[0] ?? ''

        // Act
        const awardsAllPoints = story03.includes('all 15 AI Discoverability points are earned')
        const awardsCrawlerPoints = story03.includes('platform crawler access still earns 9 points')
        const withholdsRoutePoints = story03.includes("only the unavailable route's points are withheld")

        // Assert
        expect(story03).toContain('Score ownership: #1312')
        expect(awardsAllPoints).toBe(false)
        expect(awardsCrawlerPoints).toBe(false)
        expect(withholdsRoutePoints).toBe(false)
    })
})
