// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// ── Mocks — must be at TOP before any imports ─────────────────────────────

vi.mock('@/lib/utils', () => ({
    cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' '),
}))

// ── Source imports (AFTER mocks) ─────────────────────────────────────────

import { BuilderOnboardingShell } from '@/components/builder/onboarding/BuilderOnboardingShell'
import { BuilderStepHeader } from '@/components/builder/onboarding/BuilderStepHeader'
import { BuilderSitePreview, splitPreviewItems } from '@/components/builder/onboarding/BuilderSitePreview'

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

    it('applies gridClassName to grid container when provided', () => {
        // Arrange + Act
        const { container } = render(
            <BuilderOnboardingShell
                left={<div>Left</div>}
                gridClassName="custom-grid-override"
            />,
        )

        // Assert — grid container has the custom class merged in
        const grid = container.querySelector('.custom-grid-override')
        expect(grid).toBeInTheDocument()
    })

    it('preserves default lg:grid-cols-2 when gridClassName is omitted', () => {
        // Arrange + Act
        const { container } = render(
            <BuilderOnboardingShell
                left={<div>Left</div>}
            />,
        )

        // Assert — default grid class still present
        const grid = container.querySelector('.lg\\:grid-cols-2')
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
        expect(img).toHaveAttribute('src', '/assets/builder/builder-logo.png')
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

// ── TC-F01.04: BuilderSitePreview ─────────────────────────────────────────

const PREVIEW_LABELS = {
    caption: 'Preview · updates as you type',
    placeholderName: 'Your business',
    placeholderSlug: 'your-business',
    textNote: 'Headline and text are written when you create the site.',
    itemsTitle: 'Menu',
    nav: ['Home', 'Menu', 'Gallery', 'About', 'Contact', 'Blog'],
}

describe('[TC-F01.04] BuilderSitePreview — right-pane live preview', () => {
    it('TC-F01.04: shows the business name, address and one card per item from the form', () => {
        // Arrange + Act
        render(
            <BuilderSitePreview
                businessName="Kedai Kopi Pak Ali"
                domain="webstore.my"
                labels={PREVIEW_LABELS}
                products={'Kopi Tarik, Nasi Lemak\nRoti Bakar'}
                slug="kedai-kopi-pak-ali"
            />,
        )

        // Assert
        expect(screen.getByText('Kedai Kopi Pak Ali')).toBeInTheDocument()
        expect(screen.getByTestId('preview-address')).toHaveTextContent('kedai-kopi-pak-ali.webstore.my')
        const items = within(screen.getByRole('list')).getAllByRole('listitem')
        expect(items.map((item) => item.textContent)).toEqual(['Kopi Tarik', 'Nasi Lemak', 'Roti Bakar'])
        expect(screen.getByText(PREVIEW_LABELS.textNote)).toBeInTheDocument()
    })

    it('TC-F01.04: falls back to placeholders while the form is empty', () => {
        // Arrange + Act
        render(<BuilderSitePreview businessName="  " domain="webstore.my" labels={PREVIEW_LABELS} products="" slug="" />)

        // Assert
        expect(screen.getByText('Your business')).toBeInTheDocument()
        expect(screen.getByTestId('preview-address')).toHaveTextContent('your-business.webstore.my')
        expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3)
    })

    it('TC-F01.04: splits items on commas and new lines, drops blanks, caps at 6', () => {
        // Act
        const items = splitPreviewItems('a, b,, c\n\nd, e, f, g')

        // Assert
        expect(items).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    })
})
