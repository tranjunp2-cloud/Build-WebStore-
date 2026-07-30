import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readWorkspaceFile = (path: string) =>
    readFileSync(resolve(process.cwd(), path), 'utf8')

// ── TC-F37-03-49: staging acceptance workflow wiring ────────────────────────

describe('[TC-F37-03-49] F37-03 staging acceptance workflow', () => {
    it('runs the public discovery spec with both stable fixture variables', () => {
        // Arrange
        const workflow = readWorkspaceFile('.github/workflows/e2e-staging.yml')

        // Act
        const publicSpecOccurrences = workflow.match(/tests\/f37-ai-discoverability\.spec\.ts/g) ?? []
        const publishedFixtureOccurrences = workflow.match(/vars\.E2E_F37_PUBLISHED_SITE_PATH/g) ?? []
        const unpublishedFixtureOccurrences = workflow.match(/vars\.E2E_F37_UNPUBLISHED_SITE_PATH/g) ?? []

        // Assert
        expect(publicSpecOccurrences).toHaveLength(1)
        expect(publishedFixtureOccurrences).toHaveLength(1)
        expect(unpublishedFixtureOccurrences).toHaveLength(1)
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
