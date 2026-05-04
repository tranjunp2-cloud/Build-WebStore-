/**
 * Unit Tests: Newsletter + FAQ A5 expansion (3+3 new variants)
 * TC-IDs: TC-F01D-A5.N01 → N04 (newsletter), TC-F01D-A5.F01 → F04 (faq)
 * Plan: plans/260417-1345-wave2-visual-diversity/phase-04-A5-thin-block-expansion.md
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NewsletterBlock } from '@/blocks/newsletter'
import { FAQBlock } from '@/blocks/faq'
import { NewsletterConfigSchema, newsletterMeta, NEWSLETTER_VARIANTS } from '@/blocks/newsletter/config'
import { FAQConfigSchema, faqMeta, FAQ_VARIANTS } from '@/blocks/faq/config'

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
            form: createPrimitive('form'),
        },
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        useReducedMotion: () => false,
    }
})

const newsletterBlock = {
    blockType: 'newsletter' as const,
    headline: 'Join our newsletter',
    subheadline: 'Weekly tips;Early access;Exclusive offers',
    buttonLabel: 'Subscribe',
    placeholder: 'your@email.com',
}

const faqItems = [
    { question: 'How do I sign up?', answer: 'Click the signup button.' },
    { question: 'What is the price?', answer: 'Free to start.' },
    { question: 'Is there support?', answer: 'Yes, 24/7 via email.' },
]

describe('TC-F01D-A5.N01: Newsletter variant enum + meta sync', () => {
    it('exports 5 variants (popup temporarily disabled: Bug #791)', () => {
        expect(NEWSLETTER_VARIANTS).toHaveLength(5)
        expect(NEWSLETTER_VARIANTS).toEqual(
            expect.arrayContaining(['inline', 'banner', 'stacked-card', 'minimal', 'incentive-grid']),
        )
    })

    it('newsletterMeta.variants matches NEWSLETTER_VARIANTS', () => {
        expect(newsletterMeta.variants).toEqual(NEWSLETTER_VARIANTS)
    })

    it.each(NEWSLETTER_VARIANTS)('Zod accepts variant "%s"', (variant) => {
        expect(NewsletterConfigSchema.safeParse({ ...newsletterBlock, variant }).success).toBe(true)
    })
})

describe('TC-F01D-A5.N02: newsletter/stacked-card renders centered card + form', () => {
    it('renders headline + form input', () => {
        render(<NewsletterBlock block={{ ...newsletterBlock, variant: 'stacked-card' }} theme={{}} site={{}} page={{}} />)
        expect(screen.getByText(newsletterBlock.headline)).toBeInTheDocument()
        expect(screen.getByPlaceholderText(newsletterBlock.placeholder)).toBeInTheDocument()
    })
})

describe('TC-F01D-A5.N03: newsletter/minimal renders inline heading + form', () => {
    it('renders heading + form in a compact layout', () => {
        render(<NewsletterBlock block={{ ...newsletterBlock, variant: 'minimal' }} theme={{}} site={{}} page={{}} />)
        expect(screen.getByText(newsletterBlock.headline)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: newsletterBlock.buttonLabel })).toBeInTheDocument()
    })
})

describe('TC-F01D-A5.N04: newsletter/incentive-grid renders benefit bullets', () => {
    it('splits subheadline on semicolons into separate <li>', () => {
        const { container } = render(
            <NewsletterBlock block={{ ...newsletterBlock, variant: 'incentive-grid' }} theme={{}} site={{}} page={{}} />,
        )
        const listItems = container.querySelectorAll('ul li')
        expect(listItems.length).toBe(3)
        expect(screen.getByText('Weekly tips')).toBeInTheDocument()
        expect(screen.getByText('Early access')).toBeInTheDocument()
        expect(screen.getByText('Exclusive offers')).toBeInTheDocument()
    })

    it('falls back to 3 generic benefits when subheadline empty', () => {
        const { container } = render(
            <NewsletterBlock
                block={{ ...newsletterBlock, subheadline: undefined, variant: 'incentive-grid' }}
                theme={{}}
                site={{}}
                page={{}}
            />,
        )
        const listItems = container.querySelectorAll('ul li')
        expect(listItems.length).toBe(3)
    })
})

describe('TC-F01D-A5.F01: FAQ variant enum + meta sync', () => {
    it('exports 6 variants', () => {
        expect(FAQ_VARIANTS).toHaveLength(6)
        expect(FAQ_VARIANTS).toEqual(
            expect.arrayContaining(['accordion', 'grid', 'simple', 'two-column-accordion', 'chat-bubbles', 'numbered']),
        )
    })

    it('faqMeta.variants matches FAQ_VARIANTS', () => {
        expect(faqMeta.variants).toEqual(FAQ_VARIANTS)
    })

    it.each(FAQ_VARIANTS)('Zod accepts variant "%s"', (variant) => {
        expect(FAQConfigSchema.safeParse({ blockType: 'faq', variant, items: faqItems }).success).toBe(true)
    })
})

describe('TC-F01D-A5.F02: faq/two-column-accordion renders each Q in <details>', () => {
    it('renders items as <details> elements split across 2 columns', () => {
        const { container } = render(
            <FAQBlock
                block={{ blockType: 'faq', variant: 'two-column-accordion', items: faqItems }}
                theme={{}}
                site={{}}
                page={{}}
            />,
        )
        const details = container.querySelectorAll('details')
        expect(details.length).toBe(faqItems.length)
        for (const item of faqItems) {
            expect(screen.getByText(item.question)).toBeInTheDocument()
        }
    })
})

describe('TC-F01D-A5.F03: faq/chat-bubbles renders Q + A as bubbles', () => {
    it('renders question + answer for each item', () => {
        render(
            <FAQBlock
                block={{ blockType: 'faq', variant: 'chat-bubbles', items: faqItems }}
                theme={{}}
                site={{}}
                page={{}}
            />,
        )
        for (const item of faqItems) {
            expect(screen.getByText(item.question)).toBeInTheDocument()
            expect(screen.getByText(item.answer)).toBeInTheDocument()
        }
    })
})

describe('TC-F01D-A5.F04: faq/numbered prefixes each item with a numeral', () => {
    it('renders zero-padded index numerals (01, 02, 03)', () => {
        render(
            <FAQBlock
                block={{ blockType: 'faq', variant: 'numbered', items: faqItems }}
                theme={{}}
                site={{}}
                page={{}}
            />,
        )
        expect(screen.getByText('01')).toBeInTheDocument()
        expect(screen.getByText('02')).toBeInTheDocument()
        expect(screen.getByText('03')).toBeInTheDocument()
    })
})
