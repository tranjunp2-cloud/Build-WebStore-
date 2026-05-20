/**
 * Unit Tests: About + Stats A5 expansion (4+3 new variants)
 * TC-IDs: TC-F01D-A5.A01 → TC-F01D-A5.A04 (about), TC-F01D-A5.S01 → TC-F01D-A5.S03 (stats)
 * Plan: plans/260417-1345-wave2-visual-diversity/phase-04-A5-thin-block-expansion.md
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AboutBlock } from '@/blocks/about'
import { StatsBlock } from '@/blocks/stats'
import { AboutConfigSchema, aboutMeta, ABOUT_VARIANTS } from '@/blocks/about/config'
import { StatsConfigSchema, statsMeta, STATS_VARIANTS } from '@/blocks/stats/config'

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
            section: createPrimitive('section'),
            div: createPrimitive('div'),
            article: createPrimitive('article'),
            li: createPrimitive('li'),
            button: createPrimitive('button'),
            a: createPrimitive('a'),
        },
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        useReducedMotion: () => false,
        useInView: () => true,
    }
})

const aboutBlock = {
    blockType: 'about' as const,
    headline: 'Built for teams that care',
    sectionLabel: 'Our story',
    body: 'We started in 2015 to make great software accessible. Today we serve thousands of customers worldwide.',
}

const statsBlock = {
    blockType: 'stats' as const,
    headline: 'By the numbers',
    stats: [
        { value: '500', label: 'Customers', suffix: '+' },
        { value: '99', label: 'Uptime', suffix: '%' },
        { value: '10', label: 'Years' },
    ],
}

describe('TC-F01D-A5.A01: About variant enum + meta sync', () => {
    it('exports 7 variants', () => {
        expect(ABOUT_VARIANTS).toHaveLength(7)
        expect(ABOUT_VARIANTS).toEqual(
            expect.arrayContaining(['simple', 'split', 'story', 'two-column', 'founder-quote', 'centered-large', 'image-overlay']),
        )
    })

    it('aboutMeta.variants matches ABOUT_VARIANTS', () => {
        expect(aboutMeta.variants).toEqual(ABOUT_VARIANTS)
    })

    it.each(ABOUT_VARIANTS)('Zod accepts variant "%s"', (variant) => {
        expect(AboutConfigSchema.safeParse({ ...aboutBlock, variant }).success).toBe(true)
    })
})

describe('TC-F01D-A5.A02: about/two-column renders body in CSS columns', () => {
    it('renders headline + body content', () => {
        render(<AboutBlock block={{ ...aboutBlock, variant: 'two-column' }} theme={{}} site={{}} page={{}} />)
        expect(screen.getByText(aboutBlock.headline)).toBeInTheDocument()
        expect(screen.getByText(/started in 2015/)).toBeInTheDocument()
    })
})

describe('TC-F01D-A5.A03: about/founder-quote renders body as blockquote', () => {
    it('renders body inside <blockquote> + sectionLabel as attribution', () => {
        const { container } = render(
            <AboutBlock block={{ ...aboutBlock, variant: 'founder-quote' }} theme={{}} site={{}} page={{}} />,
        )
        expect(container.querySelector('blockquote')).toBeInTheDocument()
        expect(screen.getByText(`— ${aboutBlock.sectionLabel}`)).toBeInTheDocument()
    })
})

describe('TC-F01D-A5.A04: about/centered-large + image-overlay', () => {
    it('centered-large renders headline as h1', () => {
        render(<AboutBlock block={{ ...aboutBlock, variant: 'centered-large' }} theme={{}} site={{}} page={{}} />)
        const heading = screen.getByRole('heading', { name: aboutBlock.headline })
        expect(heading.tagName).toBe('H1')
    })

    it('image-overlay falls back to centered-large when no image + no category resolution', () => {
        // No image, no site siteType — getAboutImage may still resolve a fallback;
        // this test confirms render does not throw and shows headline.
        render(<AboutBlock block={{ ...aboutBlock, variant: 'image-overlay' }} theme={{}} site={{}} page={{}} />)
        expect(screen.getByText(aboutBlock.headline)).toBeInTheDocument()
    })
})

describe('TC-F01D-A5.S01: Stats variant enum + meta sync', () => {
    it('exports 6 variants', () => {
        expect(STATS_VARIANTS).toHaveLength(6)
        expect(STATS_VARIANTS).toEqual(
            expect.arrayContaining(['row', 'grid', 'highlight', 'cards', 'inline-text', 'chart-bars']),
        )
    })

    it('statsMeta.variants matches STATS_VARIANTS', () => {
        expect(statsMeta.variants).toEqual(STATS_VARIANTS)
    })

    it.each(STATS_VARIANTS)('Zod accepts variant "%s"', (variant) => {
        expect(StatsConfigSchema.safeParse({ ...statsBlock, variant }).success).toBe(true)
    })
})

describe('TC-F01D-A5.S02: stats/cards renders one card per stat', () => {
    it('renders all stat labels', () => {
        render(<StatsBlock block={{ ...statsBlock, variant: 'cards' }} theme={{}} site={{}} page={{}} />)
        for (const s of statsBlock.stats) {
            expect(screen.getByText(s.label)).toBeInTheDocument()
        }
    })
})

describe('TC-F01D-A5.S03: stats/inline-text + chart-bars', () => {
    it('inline-text renders all stats inside a single sentence paragraph', () => {
        const { container } = render(
            <StatsBlock block={{ ...statsBlock, variant: 'inline-text' }} theme={{}} site={{}} page={{}} />,
        )
        const paragraphs = container.querySelectorAll('p')
        // Find the narrative paragraph (the one with all stat labels)
        const narrative = Array.from(paragraphs).find((p) =>
            statsBlock.stats.every((s) => p.textContent?.includes(s.label)),
        )
        expect(narrative).toBeDefined()
    })

    it('chart-bars renders one progressbar per stat', () => {
        render(<StatsBlock block={{ ...statsBlock, variant: 'chart-bars' }} theme={{}} site={{}} page={{}} />)
        const bars = screen.getAllByRole('progressbar')
        expect(bars.length).toBe(statsBlock.stats.length)
    })
})
