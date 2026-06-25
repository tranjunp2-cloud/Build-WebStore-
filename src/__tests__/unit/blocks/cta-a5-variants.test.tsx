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
