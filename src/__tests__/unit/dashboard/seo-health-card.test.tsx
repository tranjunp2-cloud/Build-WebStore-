import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { SeoHealthCard } from '@/components/dashboard/revamp/seo-health-card'
import {
    createSeoHealthBucketViewModel,
    SEO_HEALTH_GOOD_THRESHOLD,
} from '@/lib/dashboard/seo-health-view-model'
import type {
    SeoHealthCardLoadState,
    SeoHealthIssueAction,
    SeoHealthIssueViewModel,
} from '@/lib/dashboard/dashboard-types'

const issues: readonly SeoHealthIssueViewModel[] = [
    {
        id: 'meta-title',
        code: 'meta-title',
        count: 2,
        action: { kind: 'fix-meta-title' },
    },
    {
        id: 'address',
        code: 'business-address',
        count: 1,
        action: { kind: 'edit-business-address', siteId: 'site-1' },
    },
    {
        id: 'domain',
        code: 'primary-domain',
        count: 1,
        action: { kind: 'setup-primary-domain' },
    },
    {
        id: 'publish',
        code: 'store-unpublished',
        count: 1,
        action: { kind: 'publish-store', siteId: 'site-1' },
    },
    {
        id: 'image-alt',
        code: 'image-alt',
        count: 3,
        action: { kind: 'edit-image-alt', productId: 'product-1' },
    },
    {
        id: 'verification',
        code: 'search-verification',
        count: 1,
        action: { kind: 'setup-search-verification', siteId: 'site-1' },
    },
    {
        id: 'meta-description',
        code: 'meta-description',
        count: 2,
        action: { kind: 'fix-meta-description' },
    },
]

const partialState: Extract<SeoHealthCardLoadState, { state: 'ready' }> = {
    state: 'ready',
    score: 67,
    aiFixableItemCount: 3,
    buckets: {
        business: createSeoHealthBucketViewModel(75),
        schema: createSeoHealthBucketViewModel(60),
        aiDiscoverability: createSeoHealthBucketViewModel(100),
        technical: createSeoHealthBucketViewModel(50),
    },
    issues,
}

function renderCard(
    data: SeoHealthCardLoadState,
    overrides: Partial<{
        onIssueAction: (action: SeoHealthIssueAction) => void
        onFixAllMetadata: () => void
        onRetry: () => void
    }> = {},
) {
    const handlers = {
        onIssueAction: vi.fn(),
        onFixAllMetadata: vi.fn(),
        onRetry: vi.fn(),
        ...overrides,
    }

    render(
        <I18nProvider defaultLocale="en">
            <SeoHealthCard data={data} {...handlers} />
        </I18nProvider>,
    )

    return handlers
}

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
})

// ── TC-F37-04-10: Unified KISS layout and score-state contract ───────────────
describe('[TC-F37-04-10] Unified SEO Health layout', () => {
    it('owns the sole qualitative threshold and clamps invalid progress', () => {
        // Arrange
        const belowThreshold = SEO_HEALTH_GOOD_THRESHOLD - 0.01

        // Act
        const below = createSeoHealthBucketViewModel(belowThreshold)
        const at = createSeoHealthBucketViewModel(SEO_HEALTH_GOOD_THRESHOLD)
        const aboveMaximum = createSeoHealthBucketViewModel(120)
        const invalid = createSeoHealthBucketViewModel(Number.NaN)

        // Assert
        expect(below).toEqual({ progress: belowThreshold, status: 'needsWork' })
        expect(at).toEqual({
            progress: SEO_HEALTH_GOOD_THRESHOLD,
            status: 'good',
        })
        expect(aboveMaximum).toEqual({ progress: 100, status: 'good' })
        expect(invalid).toEqual({ progress: 0, status: 'needsWork' })
    })

    it('renders loading and error without a gauge or invented score', () => {
        // Arrange
        const onRetry = vi.fn()
        const { rerender } = render(
            <I18nProvider defaultLocale="en">
                <SeoHealthCard
                    data={{ state: 'loading' }}
                    onIssueAction={vi.fn()}
                    onFixAllMetadata={vi.fn()}
                    onRetry={onRetry}
                />
            </I18nProvider>,
        )

        // Act
        const loading = screen.getByRole('status')

        // Assert
        expect(loading).toHaveTextContent('Loading SEO health')
        expect(screen.queryByText('/ 100')).not.toBeInTheDocument()
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

        // Arrange
        rerender(
            <I18nProvider defaultLocale="en">
                <SeoHealthCard
                    data={{ state: 'error' }}
                    onIssueAction={vi.fn()}
                    onFixAllMetadata={vi.fn()}
                    onRetry={onRetry}
                />
            </I18nProvider>,
        )

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

        // Assert
        expect(screen.getByRole('alert')).toHaveTextContent('SEO health is unavailable')
        expect(screen.queryByText('/ 100')).not.toBeInTheDocument()
        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('renders one gauge and four qualitative bucket bars without Score History', () => {
        // Arrange
        renderCard(partialState)

        // Act
        const progressBars = screen.getAllByRole('progressbar')

        // Assert
        expect(screen.getByText('67')).toBeInTheDocument()
        expect(screen.getByText('/ 100')).toBeInTheDocument()
        expect(progressBars).toHaveLength(4)
        expect(screen.getByText('Business Data')).toBeInTheDocument()
        expect(screen.getByText('Schema')).toBeInTheDocument()
        expect(screen.getByText('AI Discoverability')).toBeInTheDocument()
        expect(screen.getByText('Technical Health')).toBeInTheDocument()
        expect(screen.queryByText(/Score History/i)).not.toBeInTheDocument()
    })
})

// ── TC-F37-04-11/12: Platform isolation and every seller action ──────────────
describe('[TC-F37-04-11 / TC-F37-04-12] Issue ownership and actions', () => {
    it('renders all seven supplied root causes with no three-row truncation', () => {
        // Arrange
        const onIssueAction = vi.fn()
        renderCard(partialState, { onIssueAction })

        // Act
        const issueActions = screen
            .getAllByRole('button')
            .filter((button) => button.classList.contains('seo-target-issue-action'))
        issueActions.forEach((button) => fireEvent.click(button))

        // Assert
        expect(screen.getByText('7 open')).toBeInTheDocument()
        expect(issueActions).toHaveLength(7)
        expect(onIssueAction).toHaveBeenCalledTimes(7)
        expect(onIssueAction.mock.calls.map(([action]) => action)).toEqual(
            issues.map((issue) => issue.action),
        )
        expect(screen.queryByText(/crawler|organization|indexability/i)).not.toBeInTheDocument()
    })

    it('reveals issue guidance when the info button is clicked', () => {
        // Arrange
        renderCard(partialState)

        // Act
        fireEvent.click(screen.getByRole('button', { name: /Business address incomplete:/i }))

        // Assert
        expect(screen.getAllByText('Complete the address, city, postcode, and country in Local Business Info.').length).toBeGreaterThan(0)
    })

    it('opens guidance on the first touch tap', () => {
        // Arrange
        renderCard(partialState)
        const infoButton = screen.getByRole('button', { name: /Business address incomplete:/i })

        // Act
        fireEvent.touchStart(infoButton)
        fireEvent.click(infoButton)

        // Assert
        expect(screen.getAllByText('Complete the address, city, postcode, and country in Local Business Info.').length).toBeGreaterThan(0)
    })

    it('shows the approved AI and You actor labels and distinct accessible CTA names', () => {
        // Arrange
        renderCard(partialState)

        // Act
        const aiBadges = screen.getAllByText('AI')
        const youBadges = screen.getAllByText('You')

        // Assert
        expect(aiBadges).toHaveLength(2)
        expect(youBadges).toHaveLength(5)
        expect(screen.getAllByRole('button', { name: /^Fix: / })).toHaveLength(2)
        expect(screen.getAllByRole('button', { name: /^Edit: / })).toHaveLength(2)
        expect(screen.getAllByRole('button', { name: /^Set up: / })).toHaveLength(2)
        expect(
            screen.getByRole('button', { name: 'Publish: Store is unpublished' }),
        ).toBeInTheDocument()
        const titleFix = screen.getByRole('button', {
            name: 'Fix: 2 items missing meta titles',
        })
        const descriptionFix = screen.getByRole('button', {
            name: 'Fix: 2 pages missing meta descriptions',
        })
        expect(titleFix).not.toBe(descriptionFix)
    })
})

// ── TC-F37-04-16: Conditional metadata-only AI Fix strip ─────────────────────
describe('[TC-F37-04-16] Conditional metadata AI Fix strip', () => {
    it('uses the aggregate AI-fixable count and requests details on Fix All', () => {
        // Arrange
        const onFixAllMetadata = vi.fn()
        renderCard(partialState, { onFixAllMetadata })

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'AI Fix Issues' }))

        // Assert
        const aiFixCopy = screen.getByText(/Most critical issue: 2 items missing meta titles/)
        expect(aiFixCopy).toBeInTheDocument()
        expect(aiFixCopy.closest('.seo-footer')).not.toBeNull()
        expect(aiFixCopy.closest('.seo-target-ai-strip')).toBeNull()
        expect(onFixAllMetadata).toHaveBeenCalledTimes(1)
    })

    it('uses a metadata issue for AI copy when a seller issue is listed first', () => {
        const sellerFirstState = {
            ...partialState,
            issues: [issues[1], issues[0], issues[6]],
        }

        renderCard(sellerFirstState)

        expect(screen.getByText(/Most critical issue: 2 items missing meta titles/)).toBeInTheDocument()
        expect(screen.queryByText(/Business address incomplete/)).toBeInTheDocument()
    })

    it('labels a backlog over 100 as the next bounded batch and keeps the callback', () => {
        // Arrange
        const onFixAllMetadata = vi.fn()
        renderCard(
            {
                ...partialState,
                aiFixableItemCount: 101,
            },
            { onFixAllMetadata },
        )

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Fix next 100 with AI' }))

        // Assert
        expect(screen.getByText(/Most critical issue: 2 items missing meta titles/) ).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'AI Fix Issues' })).not.toBeInTheDocument()
        expect(onFixAllMetadata).toHaveBeenCalledTimes(1)
    })

    it('hides AI Fix while a seller-owned issue still remains', () => {
        // Arrange
        const sellerOnlyState: Extract<SeoHealthCardLoadState, { state: 'ready' }> = {
            ...partialState,
            aiFixableItemCount: 0,
            issues: [issues[1]],
        }

        // Act
        renderCard(sellerOnlyState)

        // Assert
        expect(screen.getByText('Business address incomplete')).toBeInTheDocument()
        expect(screen.getByText('1 open')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'AI Fix Issues' })).not.toBeInTheDocument()
    })

    it('hides AI Fix when no metadata issue remains and shows All clear at 100', () => {
        // Arrange
        const completeState: Extract<SeoHealthCardLoadState, { state: 'ready' }> = {
            state: 'ready',
            score: 100,
            aiFixableItemCount: 0,
            buckets: {
                business: createSeoHealthBucketViewModel(100),
                schema: createSeoHealthBucketViewModel(100),
                aiDiscoverability: createSeoHealthBucketViewModel(100),
                technical: createSeoHealthBucketViewModel(100),
            },
            issues: [],
        }

        // Act
        renderCard(completeState)

        // Assert
        expect(screen.getByText('All clear')).toBeInTheDocument()
        expect(screen.getByText('All issues resolved')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'AI Fix Issues' })).not.toBeInTheDocument()
        expect(screen.queryByText(/\bopen\b/i)).not.toBeInTheDocument()
    })

    it("explains platform-managed deductions without rendering a seller action", () => {
        const platformOnlyState: Extract<SeoHealthCardLoadState, { state: "ready" }> = {
            state: "ready",
            score: 94,
            aiFixableItemCount: 0,
            buckets: {
                business: createSeoHealthBucketViewModel(100),
                schema: createSeoHealthBucketViewModel(100),
                aiDiscoverability: createSeoHealthBucketViewModel(60),
                technical: createSeoHealthBucketViewModel(100),
            },
            issues: [],
        }

        renderCard(platformOnlyState)

        expect(screen.getByText("0 open")).toBeInTheDocument()
        expect(screen.getByText("No seller action needed")).toBeInTheDocument()
        expect(
            screen.getByText(
                "The remaining score signals are managed automatically by the platform.",
            ),
        ).toBeInTheDocument()
        expect(screen.queryByText("All clear")).not.toBeInTheDocument()
        expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })
})
