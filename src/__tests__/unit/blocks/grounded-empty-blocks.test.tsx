/**
 * TC-AIAUD-039 — renderers never show invented content when a block is empty (#2103 A1).
 * stats / team / faq / logo-cloud render nothing; the testimonials invitation card has no stars,
 * name or avatar.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { StatsBlock } from '@/blocks/stats/index'
import { TeamBlock } from '@/blocks/team/index'
import { FAQBlock } from '@/blocks/faq/index'
import { LogoCloudBlock } from '@/blocks/logo-cloud/index'
import { PricingBlock } from '@/blocks/pricing/index'
import { PricingTableBlock } from '@/blocks/pricing-table/index'
import { FeaturesBlock } from '@/blocks/features/index'
import { TestimonialsBlock } from '@/blocks/testimonials/index'
import { TESTIMONIAL_INVITE_TITLE } from '@/blocks/testimonials/config'

vi.mock('next/image', () => ({
    __esModule: true,
    default: ({ fill, priority, ...props }: any) => {
        void fill
        void priority
        return <img {...props} />
    },
}))

const theme = {} as never

describe('[TC-AIAUD-039] empty grounded blocks render nothing', () => {
    it('stats with no real numbers renders nothing (no "500+ Happy Customers")', () => {
        const { container } = render(<StatsBlock block={{ blockType: 'stats', stats: [] }} theme={theme} />)
        expect(container.textContent).toBe('')
    })

    it('team with no members renders nothing (no "Team Lead / Senior Specialist")', () => {
        const { container } = render(<TeamBlock block={{ blockType: 'team', members: [] }} theme={theme} />)
        expect(container.textContent).toBe('')
    })

    it('faq with no items renders nothing (no "Monday to Saturday, 9 AM to 6 PM")', () => {
        const { container } = render(<FAQBlock block={{ blockType: 'faq', items: [] }} />)
        expect(container.textContent).toBe('')
    })

    it('logo-cloud with no logos renders nothing', () => {
        const { container } = render(<LogoCloudBlock block={{ blockType: 'logo-cloud', headline: 'Payment methods', logos: [] }} theme={theme} />)
        expect(container.textContent).toBe('')
    })

    it('stats with real numbers still render them', () => {
        const { container } = render(
            <StatsBlock block={{ blockType: 'stats', stats: [{ value: 'Since 2015', label: 'Year started' }, { value: 'x', label: 'Products' }] }} theme={theme} />,
        )
        expect(container.textContent).toContain('Year started')
    })
})

describe('[TC-AIAUD-039] testimonials invitation card', () => {
    it('shows the invitation text only — no stars, no person name, no avatar', () => {
        const { container } = render(
            <TestimonialsBlock
                block={{
                    blockType: 'testimonials',
                    headline: 'What customers say about Acme',
                    testimonials: [{ quote: 'Be the first to review Acme', name: 'Acme', title: TESTIMONIAL_INVITE_TITLE }],
                }}
                theme={theme}
            />,
        )
        expect(container.textContent).toContain('Be the first to review Acme')
        expect(container.textContent).not.toContain(TESTIMONIAL_INVITE_TITLE)
        expect(container.querySelectorAll('svg').length).toBe(0)
        expect(container.querySelector('img')).toBeNull()
    })

    it('a real review (no marker) still renders its author', () => {
        const { container } = render(
            <TestimonialsBlock
                block={{ blockType: 'testimonials', testimonials: [{ quote: 'Lovely cake', name: 'Siti', rating: 5 }] }}
                theme={theme}
            />,
        )
        expect(container.textContent).toContain('Siti')
        expect(container.textContent).toContain('Lovely cake')
    })
})

describe('[TC-AIAUD-144] pricing / pricing-table / features render nothing without content (no invented plans or perks)', () => {
    it.each(['cards', 'horizontal', 'comparison', 'toggle'] as const)('pricing (%s) with no plans renders nothing - no "Starter RM 99"', (variant) => {
        const { container } = render(<PricingBlock block={{ blockType: 'pricing', headline: 'Pricing', variant, plans: [] } as never} theme={theme} />)
        expect(container.textContent).toBe('')
    })

    it('pricing with no plans key at all renders nothing', () => {
        const { container } = render(<PricingBlock block={{ blockType: 'pricing', headline: 'Pricing' } as never} theme={theme} />)
        expect(container.textContent).toBe('')
    })

    it.each(['columns', 'horizontal'] as const)('pricing-table (%s) with no plans renders nothing - not even the headline or toggle', (variant) => {
        const { container } = render(<PricingTableBlock block={{ blockType: 'pricing-table', headline: 'Pricing', variant, plans: [] } as never} theme={theme} />)
        expect(container.textContent).toBe('')
    })

    it('features with no items renders nothing - no "Years of consistent service excellence"', () => {
        const { container } = render(<FeaturesBlock block={{ blockType: 'features', headline: 'Why us', features: [] } as never} theme={theme} />)
        expect(container.textContent).toBe('')
    })

    it('[TC-AIAUD-149] pricing and features with real content still render it', () => {
        const pricing = render(
            <PricingBlock
                block={{ blockType: 'pricing', headline: 'Menu', plans: [{ name: 'Kek lapis', price: 'RM 65', features: [], ctaLabel: 'Learn more', ctaUrl: '/contact' }] } as never}
                theme={theme}
            />,
        )
        expect(pricing.container.textContent).toContain('Kek lapis')
        expect(pricing.container.textContent).toContain('RM 65')
        const features = render(
            <FeaturesBlock block={{ blockType: 'features', headline: 'Why us', features: [{ icon: 'Cake', title: 'Fresh daily', description: 'Baked every morning.' }] } as never} theme={theme} />,
        )
        expect(features.container.textContent).toContain('Fresh daily')
    })
})

describe('[TC-AIAUD-147] the invitation card never reads as a review once a real review exists', () => {
    const VARIANTS = ['cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote', 'avatar-row', 'video-text', 'grid', 'single'] as const
    const invite = { quote: 'Be the first to review Acme', name: 'Acme', title: TESTIMONIAL_INVITE_TITLE }
    const real = { quote: 'Lovely cake, arrived on time', name: 'Siti', rating: 5 }

    it.each(VARIANTS)('%s: invite is dropped, the real review shows', (variant) => {
        const { container } = render(
            <TestimonialsBlock
                block={{ blockType: 'testimonials', variant, headline: 'Reviews', testimonials: [invite, real] } as never}
                theme={theme}
            />,
        )
        expect(container.textContent).toContain('Lovely cake, arrived on time')
        expect(container.textContent).not.toContain('Be the first to review Acme')
        expect(container.textContent).not.toContain(TESTIMONIAL_INVITE_TITLE)
    })

    it.each(VARIANTS)('%s: invite alone is still shown (as the invitation, not as a review)', (variant) => {
        const { container } = render(
            <TestimonialsBlock
                block={{ blockType: 'testimonials', variant, headline: 'Reviews', testimonials: [invite] } as never}
                theme={theme}
            />,
        )
        expect(container.textContent).toContain('Be the first to review Acme')
    })

    it('the order does not matter: real review first, invite last', () => {
        const { container } = render(
            <TestimonialsBlock block={{ blockType: 'testimonials', variant: 'cards', testimonials: [real, invite] } as never} theme={theme} />,
        )
        expect(container.textContent).not.toContain('Be the first to review Acme')
    })
})
