// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// ── Mocks — must be at TOP before any imports ─────────────────────────────

vi.mock('@/lib/utils', () => ({
    cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' '),
}))

// ── Source imports (AFTER mocks) ─────────────────────────────────────────

import { BuilderOnboardingShell } from '@/components/builder/onboarding/BuilderOnboardingShell'
import { BuilderStepList } from '@/components/builder/onboarding/BuilderStepList'
import { BuilderStepHeader } from '@/components/builder/onboarding/BuilderStepHeader'
import { BuilderPromoCard } from '@/components/builder/onboarding/BuilderPromoCard'

// ── Fixtures ─────────────────────────────────────────────────────────────

const THREE_STEPS = [
    { id: 1, label: 'Enter business information', active: true },
    { id: 2, label: 'AI creates content & design', active: false },
    { id: 3, label: 'Preview & Publish', active: false },
]

// ── TC-F01.04: BuilderOnboardingShell ────────────────────────────────────

describe('[TC-F01.04] BuilderOnboardingShell', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F01.04: renders left pane content', () => {
        // Arrange + Act
        render(
            <BuilderOnboardingShell
                left={<div data-testid="left-content">Left pane</div>}
            />,
        )

        // Assert
        expect(screen.getByTestId('left-content')).toBeInTheDocument()
        expect(screen.getByText('Left pane')).toBeInTheDocument()
    })

    it('TC-F01.04: renders right pane content when provided', () => {
        // Arrange + Act
        render(
            <BuilderOnboardingShell
                left={<div>Left</div>}
                right={<div data-testid="right-content">Right pane</div>}
            />,
        )

        // Assert
        expect(screen.getByTestId('right-content')).toBeInTheDocument()
    })

    it('TC-F01.04: renders without right pane (right prop is optional)', () => {
        // Arrange + Act — should not throw when right is undefined
        const { container } = render(
            <BuilderOnboardingShell
                left={<div>Left only</div>}
            />,
        )

        // Assert
        expect(container).toBeInTheDocument()
        expect(screen.getByText('Left only')).toBeInTheDocument()
    })

    it('applies custom className to root element', () => {
        // Arrange + Act
        const { container } = render(
            <BuilderOnboardingShell
                className="custom-class"
                left={<div>Left</div>}
            />,
        )

        // Assert
        expect(container.firstChild).toHaveClass('custom-class')
    })

    it('applies rightPaneClassName when provided', () => {
        // Arrange + Act
        const { container } = render(
            <BuilderOnboardingShell
                left={<div>Left</div>}
                right={<div>Right</div>}
                rightPaneClassName="right-pane-custom"
            />,
        )

        // Assert — right pane div has the custom class
        const rightPane = container.querySelector('.right-pane-custom')
        expect(rightPane).toBeInTheDocument()
    })

    it('renders grid layout container', () => {
        // Arrange + Act
        const { container } = render(
            <BuilderOnboardingShell
                left={<div>Left</div>}
            />,
        )

        // Assert — grid container exists inside root
        const grid = container.querySelector('.grid')
        expect(grid).toBeInTheDocument()
    })

    it('TC-F01.04: left pane is always visible (not hidden)', () => {
        // Arrange + Act
        render(
            <BuilderOnboardingShell
                left={<p data-testid="always-visible">visible content</p>}
            />,
        )

        // Assert — left pane is rendered and accessible
        expect(screen.getByTestId('always-visible')).toBeInTheDocument()
    })

    it('applies rightContentClassName to the inner content wrapper', () => {
        // Arrange + Act
        const { container } = render(
            <BuilderOnboardingShell
                left={<div>Left</div>}
                right={<div>Right</div>}
                rightContentClassName="content-wrapper-custom"
            />,
        )

        // Assert
        const contentWrapper = container.querySelector('.content-wrapper-custom')
        expect(contentWrapper).toBeInTheDocument()
    })
})

// ── TC-F01.04: BuilderStepList ────────────────────────────────────────────

describe('[TC-F01.04] BuilderStepList — 3-step sidebar', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F01.04: renders all 3 steps in the sidebar', () => {
        // Arrange + Act
        render(<BuilderStepList steps={THREE_STEPS} />)

        // Assert — all 3 step labels visible
        expect(screen.getByText('Enter business information')).toBeInTheDocument()
        expect(screen.getByText('AI creates content & design')).toBeInTheDocument()
        expect(screen.getByText('Preview & Publish')).toBeInTheDocument()
    })

    it('TC-F01.04: renders step numbers 1, 2, 3', () => {
        // Arrange + Act
        render(<BuilderStepList steps={THREE_STEPS} />)

        // Assert — each step shows its numeric ID
        expect(screen.getByText('1')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('TC-F01.04: active step indicator uses gradient background class', () => {
        // Arrange + Act
        const { container } = render(<BuilderStepList steps={THREE_STEPS} />)

        // Assert — the active step circle has gradient styling
        const stepCircles = container.querySelectorAll('.flex.size-10')
        // Step 1 is active
        expect(stepCircles[0]).toHaveClass('bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)]')
    })

    it('TC-F01.04: inactive steps do not have gradient background', () => {
        // Arrange + Act
        const { container } = render(<BuilderStepList steps={THREE_STEPS} />)

        // Assert — steps 2 and 3 (inactive) don't have the active gradient
        const stepCircles = container.querySelectorAll('.flex.size-10')
        expect(stepCircles[1]).not.toHaveClass('bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)]')
        expect(stepCircles[2]).not.toHaveClass('bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)]')
    })

    it('TC-F01.04: active step label uses bright text color', () => {
        // Arrange + Act
        const { container } = render(<BuilderStepList steps={THREE_STEPS} />)

        // Assert — active label has bright white color class
        const spans = container.querySelectorAll('span')
        const activeLabel = Array.from(spans).find(
            (el) => el.textContent === 'Enter business information',
        )
        expect(activeLabel).toHaveClass('text-[#f8fafc]')
    })

    it('TC-F01.04: inactive step labels use muted text color', () => {
        // Arrange + Act
        const { container } = render(<BuilderStepList steps={THREE_STEPS} />)

        // Assert — inactive labels have muted color
        const spans = container.querySelectorAll('span')
        const inactiveLabel = Array.from(spans).find(
            (el) => el.textContent === 'AI creates content & design',
        )
        expect(inactiveLabel).toHaveClass('text-[#94a3b8]')
    })

    it('renders correct number of step rows matching steps prop length', () => {
        // Arrange — custom 2 steps
        const twoSteps = [
            { id: 1, label: 'Step Alpha', active: true },
            { id: 2, label: 'Step Beta', active: false },
        ]

        // Act
        const { container } = render(<BuilderStepList steps={twoSteps} />)

        // Assert — 2 step rows rendered
        const rows = container.querySelectorAll('.flex.items-center.gap-4')
        expect(rows).toHaveLength(2)
    })

    it('renders empty list without crashing when steps array is empty', () => {
        // Arrange + Act
        const { container } = render(<BuilderStepList steps={[]} />)

        // Assert
        expect(container.firstChild).toBeInTheDocument()
        expect(screen.queryByText('1')).not.toBeInTheDocument()
    })

    it('all steps inactive when none have active=true', () => {
        // Arrange
        const allInactive = [
            { id: 1, label: 'Step One' },
            { id: 2, label: 'Step Two' },
        ]

        // Act
        const { container } = render(<BuilderStepList steps={allInactive} />)

        // Assert — no circle has gradient active class
        const stepCircles = container.querySelectorAll('.flex.size-10')
        stepCircles.forEach((circle) => {
            expect(circle).not.toHaveClass(
                'bg-[linear-gradient(135deg,#3b82f6_0%,#2dd4bf_100%)]',
            )
        })
    })
})

// ── TC-F01.04: BuilderStepHeader ─────────────────────────────────────────

describe('[TC-F01.04] BuilderStepHeader', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F01.04: renders title text', () => {
        // Arrange + Act
        render(
            <BuilderStepHeader
                description="desc"
                subtitle="AI-powered website builder"
                title="Create Website with AI"
            />,
        )

        // Assert
        expect(screen.getByText('Create Website with AI')).toBeInTheDocument()
    })

    it('TC-F01.04: renders subtitle text', () => {
        // Arrange + Act
        render(
            <BuilderStepHeader
                description=""
                subtitle="Business Information"
                title="Create Website with AI"
            />,
        )

        // Assert
        expect(screen.getByText('Business Information')).toBeInTheDocument()
    })

    it('TC-F01.04: renders description paragraph when provided', () => {
        // Arrange + Act
        render(
            <BuilderStepHeader
                description="Tell us about your business"
                subtitle="subtitle"
                title="title"
            />,
        )

        // Assert
        expect(screen.getByText('Tell us about your business')).toBeInTheDocument()
    })

    it('does not render description paragraph when description is empty string', () => {
        // Arrange + Act
        const { container } = render(
            <BuilderStepHeader
                description=""
                subtitle="subtitle"
                title="title"
            />,
        )

        // Assert — empty description is falsy, component's conditional renders null
        // Only the subtitle <p> should exist, not a second description <p>
        const paragraphs = container.querySelectorAll('p')
        // Only the subtitle paragraph (inside header)
        expect(paragraphs).toHaveLength(1)
        expect(paragraphs[0]).toHaveTextContent('subtitle')
    })

    it('renders logo image element', () => {
        // Arrange + Act
        const { container } = render(
            <BuilderStepHeader
                description=""
                subtitle="subtitle"
                title="title"
            />,
        )

        // Assert — img tag is rendered (alt="" makes it role="presentation", query by tag)
        const img = container.querySelector('img')
        expect(img).toBeInTheDocument()
        expect(img).toHaveAttribute('src', '/assets/builder/builder-brand-logo.png')
    })

    it('title uses h1 heading element', () => {
        // Arrange + Act
        render(
            <BuilderStepHeader
                description=""
                subtitle="sub"
                title="Main Heading"
            />,
        )

        // Assert
        const h1 = screen.getByRole('heading', { level: 1 })
        expect(h1).toHaveTextContent('Main Heading')
    })
})

// ── TC-F01.04: BuilderPromoCard ───────────────────────────────────────────

describe('[TC-F01.04] BuilderPromoCard — right-pane promo display', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F01.04: renders card title', () => {
        // Arrange + Act
        render(
            <BuilderPromoCard
                description="Let AI do the heavy lifting"
                steps={THREE_STEPS}
                title="How It Works"
            />,
        )

        // Assert
        expect(screen.getByText('How It Works')).toBeInTheDocument()
    })

    it('TC-F01.04: renders card description', () => {
        // Arrange + Act
        render(
            <BuilderPromoCard
                description="Let AI do the heavy lifting"
                steps={THREE_STEPS}
                title="How It Works"
            />,
        )

        // Assert
        expect(screen.getByText('Let AI do the heavy lifting')).toBeInTheDocument()
    })

    it('TC-F01.04: renders 3-step list inside card', () => {
        // Arrange + Act
        render(
            <BuilderPromoCard
                description="description"
                steps={THREE_STEPS}
                title="title"
            />,
        )

        // Assert — all 3 step labels from BuilderStepList are rendered
        expect(screen.getByText('Enter business information')).toBeInTheDocument()
        expect(screen.getByText('AI creates content & design')).toBeInTheDocument()
        expect(screen.getByText('Preview & Publish')).toBeInTheDocument()
    })

    it('TC-F01.04: step 1 is highlighted (active) in promo card', () => {
        // Arrange + Act
        const { container } = render(
            <BuilderPromoCard
                description="description"
                steps={THREE_STEPS}
                title="title"
            />,
        )

        // Assert — active step circle has gradient class
        const activeCircle = container.querySelector(
            '.bg-\\[linear-gradient\\(135deg\\,\\#3b82f6_0\\%\\,\\#2dd4bf_100\\%\\)\\]',
        )
        expect(activeCircle).toBeInTheDocument()
    })

    it('renders promo icon image', () => {
        // Arrange + Act
        const { container } = render(
            <BuilderPromoCard
                description="description"
                steps={THREE_STEPS}
                title="title"
            />,
        )

        // Assert — icon img rendered with correct src (alt="" makes it presentation role)
        const img = container.querySelector('img[src="/assets/builder/builder-promo-icon.svg"]')
        expect(img).toBeInTheDocument()
    })

    it('title uses h2 heading element', () => {
        // Arrange + Act
        render(
            <BuilderPromoCard
                description="desc"
                steps={THREE_STEPS}
                title="Section Title"
            />,
        )

        // Assert
        const h2 = screen.getByRole('heading', { level: 2 })
        expect(h2).toHaveTextContent('Section Title')
    })

    it('renders card within a centered container', () => {
        // Arrange + Act
        const { container } = render(
            <BuilderPromoCard
                description="desc"
                steps={THREE_STEPS}
                title="title"
            />,
        )

        // Assert — outer div has centering classes
        const outer = container.firstChild as HTMLElement
        expect(outer).toHaveClass('mx-auto')
        expect(outer).toHaveClass('flex')
    })
})
