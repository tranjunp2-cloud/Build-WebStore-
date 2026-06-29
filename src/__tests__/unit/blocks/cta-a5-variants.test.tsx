/**
 * Unit Tests: CTA Block A5 expansion (4 new variants)
 * TC-IDs: TC-F01D-A5.C01 → TC-F01D-A5.C05
 * Plan: plans/260417-1345-wave2-visual-diversity/phase-04-A5-thin-block-expansion.md
 *
 * Verifies Zod enum expansion + render dispatch for image-bg, split-testimonial,
 * dark-card, mesh-gradient-hero. Cross-cutting check that meta.variants matches
 * the exported CTA_VARIANTS array.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CTABlock } from '@/blocks/cta'
import { CTAConfigSchema, ctaMeta, CTA_VARIANTS } from '@/blocks/cta/config'

// framer-motion stub — same shape as team test.
vi.mock('framer-motion', () => {
    const React = require('react')
    const createPrimitive = (tag: keyof JSX.IntrinsicElements) => {
        const Component = React.forwardRef(
            ({ children, ...props }: React.HTMLAttributes<HTMLElement>, ref: React.Ref<HTMLElement>) =>
                React.createElement(tag, { ...props, ref }, children),
        )
        Component.displayName = `Motion${tag}`
        return Component
    }
    return {
        motion: {
            create: (Component) => {
                const M = React.forwardRef(({ children, ...rest }, ref) => React.createElement(Component, { ...rest, ref }, children))
                M.displayName = 'MotionMock'
                return M
            },
            section: createPrimitive('section'),
            div: createPrimitive('div'),
            article: createPrimitive('article'),
            button: createPrimitive('button'),
            a: createPrimitive('a'),
            li: createPrimitive('li'),
        },
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        useReducedMotion: () => false,
    }
})

const baseBlock = {
    blockType: 'cta' as const,
    headline: 'Ready to ship?',
    subheadline: 'Join thousands of teams already shipping faster.',
    ctaLabel: 'Start free trial',
    ctaUrl: '/signup',
    ctaStyle: 'primary' as const,
}

describe('TC-F01D-A5.C01: CTA_VARIANTS enum + meta sync', () => {
    it('exports 8 variants including the 4 A5 additions', () => {
        expect(CTA_VARIANTS).toHaveLength(8)
        expect(CTA_VARIANTS).toEqual(
            expect.arrayContaining([
                'banner', 'inline', 'card', 'floating-sticky',
                'image-bg', 'split-testimonial', 'dark-card', 'mesh-gradient-hero',
            ]),
        )
    })

    it('ctaMeta.variants matches CTA_VARIANTS exactly', () => {
        expect(ctaMeta.variants).toEqual(CTA_VARIANTS)
    })

    it.each(CTA_VARIANTS)('Zod schema accepts variant "%s"', (variant) => {
        const result = CTAConfigSchema.safeParse({ ...baseBlock, variant })
        expect(result.success).toBe(true)
    })

    it('Zod schema rejects unknown variant', () => {
        const result = CTAConfigSchema.safeParse({ ...baseBlock, variant: 'made-up' })
        expect(result.success).toBe(false)
    })
})

describe('TC-F01D-A5.C02: image-bg variant', () => {
    it('renders headline + ctaLabel inside an inverse-bg banner', () => {
        render(<CTABlock block={{ ...baseBlock, variant: 'image-bg' }} theme={{}} site={{}} page={{}} />)
        expect(screen.getByText(baseBlock.headline)).toBeInTheDocument()
        expect(screen.getByText(baseBlock.ctaLabel)).toBeInTheDocument()
    })
})

describe('TC-F01D-A5.C03: split-testimonial variant', () => {
    it('renders the subheadline as the pulled quote', () => {
        render(<CTABlock block={{ ...baseBlock, variant: 'split-testimonial' }} theme={{}} site={{ name: 'Acme' }} page={{}} />)
        expect(screen.getByText(`“${baseBlock.subheadline}”`)).toBeInTheDocument()
        expect(screen.getByText(/Customer of Acme/)).toBeInTheDocument()
        expect(screen.getByText(baseBlock.ctaLabel)).toBeInTheDocument()
    })

    it('falls back to generic attribution when site name missing', () => {
        render(<CTABlock block={{ ...baseBlock, variant: 'split-testimonial' }} theme={{}} site={{}} page={{}} />)
        expect(screen.getByText(/A happy customer/)).toBeInTheDocument()
    })
})

describe('TC-F01D-A5.C04: dark-card variant', () => {
    it('renders headline + ctaLabel inside a dark card', () => {
        render(<CTABlock block={{ ...baseBlock, variant: 'dark-card' }} theme={{}} site={{}} page={{}} />)
        expect(screen.getByText(baseBlock.headline)).toBeInTheDocument()
        expect(screen.getByText(baseBlock.ctaLabel)).toBeInTheDocument()
    })
})

describe('TC-F01D-A5.C05: mesh-gradient-hero variant', () => {
    it('renders headline as h1 (oversized hero) + cta button', () => {
        render(<CTABlock block={{ ...baseBlock, variant: 'mesh-gradient-hero' }} theme={{}} site={{}} page={{}} />)
        const heading = screen.getByRole('heading', { name: baseBlock.headline })
        expect(heading.tagName).toBe('H1')
        expect(screen.getByText(baseBlock.ctaLabel)).toBeInTheDocument()
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F01D-A5.C06 — GH-1412 regression: floating-sticky shows when page not scrollable
// Editor preview iframes (pageHeight <= 0) must show CTA immediately
// without waiting for 30% scroll gate. Old bug: render null forever when page can't scroll.
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F01D-A5.C06] floating-sticky shows when page is not scrollable (editor iframe)', () => {
    beforeEach(() => {
        // Clear dismiss localStorage so we start fresh
        // Key format: 'cta-floating-dismissed-' + siteId (defaults to 'default')
        const storageKey = 'cta-floating-dismissed-default'
        try {
            localStorage.removeItem(storageKey)
        } catch {
            // Ignore storage errors in test env
        }
    })

    it('TC-F01D-A5.C06a: floating-sticky renders content in jsdom (pageHeight <= 0) — not null', () => {
        // Arrange
        // In jsdom, scrollHeight and innerHeight default to 0 → pageHeight = 0 - 0 = 0
        // Old behavior: would never setVisible(true) → render null
        // Fixed: when pageHeight <= 0, show immediately
        const { container } = render(
            <CTABlock
                block={{ ...baseBlock, variant: 'floating-sticky' }}
                theme={{}}
                site={{}}
                page={{}}
            />
        )

        // Assert — CTA should render content (headline/ctaLabel visible), not null
        // The component renders a fixed bottom div when not dismissed/visible
        expect(screen.getByText(baseBlock.headline)).toBeInTheDocument()
        expect(screen.getByText(baseBlock.ctaLabel)).toBeInTheDocument()

        // Assert — the fixed container exists (proof it rendered, not null)
        const fixedContainer = container.querySelector('.fixed.bottom-4')
        expect(fixedContainer).toBeInTheDocument()
    })

    it('TC-F01D-A5.C06b: floating-sticky does not render null even when document.documentElement.scrollHeight = 0', () => {
        // Arrange — verify the math: pageHeight = scrollHeight - innerHeight
        // In jsdom: both are 0 by default → pageHeight = 0 - 0 = 0 (NOT scrollable)
        // Old code: if (pageHeight > 0 && scrollTop / pageHeight > 0.3) setVisible(true)
        // → when pageHeight = 0, condition never true → render null
        // Fixed: if (pageHeight <= 0 || scrollTop / pageHeight > 0.3) setVisible(true)
        // → when pageHeight = 0, show immediately

        const { container } = render(
            <CTABlock
                block={{ ...baseBlock, variant: 'floating-sticky' }}
                theme={{}}
                site={{}}
                page={{}}
            />
        )

        // Assert — container should NOT be null/empty
        expect(container.firstChild).not.toBeNull()

        // Assert — must find content (not render null)
        const headline = screen.queryByText(baseBlock.headline)
        expect(headline).toBeInTheDocument()
    })

    it('TC-F01D-A5.C06c: floating-sticky respects dismiss localStorage even on non-scrollable page', () => {
        // Arrange — set dismiss flag using the correct storage key
        // Key format: 'cta-floating-dismissed-' + siteId (defaults to 'default')
        const storageKey = 'cta-floating-dismissed-default'
        localStorage.setItem(storageKey, String(Date.now()))

        // Act
        const { container } = render(
            <CTABlock
                block={{ ...baseBlock, variant: 'floating-sticky' }}
                theme={{}}
                site={{}}
                page={{}}
            />
        )

        // Assert — when dismissed, should render null (not show fixed container)
        expect(container.firstChild).toBeNull()

        // Clean up
        localStorage.removeItem(storageKey)
    })

    it('TC-F01D-A5.C06d: floating-sticky headline + ctaLabel are visible in fixed container', () => {
        // Arrange
        const { container } = render(
            <CTABlock
                block={{
                    ...baseBlock,
                    variant: 'floating-sticky',
                    headline: 'Special offer',
                    ctaLabel: 'Claim now',
                }}
                theme={{}}
                site={{}}
                page={{}}
            />
        )

        // Assert
        expect(screen.getByText('Special offer')).toBeInTheDocument()
        expect(screen.getByText('Claim now')).toBeInTheDocument()

        // Assert — content is inside the fixed container
        const fixedContainer = container.querySelector('.fixed.bottom-4')
        expect(fixedContainer).toBeInTheDocument()
        expect(fixedContainer).toHaveTextContent('Special offer')
        expect(fixedContainer).toHaveTextContent('Claim now')
    })
})
