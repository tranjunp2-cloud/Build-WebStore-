/**
 * Unit Tests: Team Block A5 expansion (4 new variants)
 * TC-IDs: TC-F01D-A5.T01 → TC-F01D-A5.T05
 * Plan: plans/260417-1345-wave2-visual-diversity/phase-04-A5-thin-block-expansion.md
 *
 * Verifies Zod enum, dispatch switch, and rendering for the 4 new team variants
 * + 1 cross-cutting check: every variant value is also exposed via teamMeta.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeamBlock } from '@/blocks/team'
import { TeamConfigSchema, teamMeta, TEAM_VARIANTS } from '@/blocks/team/config'

// framer-motion stub — same pattern as navigation-render.test.tsx
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
            button: createPrimitive('button'),
            a: createPrimitive('a'),
            li: createPrimitive('li'),
        },
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        useReducedMotion: () => false,
    }
})

// HTMLDialogElement.prototype.showModal/close are not in jsdom — stub them.
beforeAll(() => {
    if (typeof HTMLDialogElement !== 'undefined') {
        HTMLDialogElement.prototype.showModal = function () { this.open = true }
        HTMLDialogElement.prototype.close = function () { this.open = false }
    }
})

const sampleMembers = [
    { name: 'Alice Chen', role: 'CEO', bio: 'Founded the company 10 years ago.' },
    { name: 'Bob Lee', role: 'CTO', bio: 'Built the platform from scratch.' },
    { name: 'Carol Wong', role: 'CMO', bio: 'Leads marketing and brand.' },
]

describe('TC-F01D-A5.T01: TEAM_VARIANTS enum + meta sync', () => {
    it('TEAM_VARIANTS array contains all 6 variants', () => {
        expect(TEAM_VARIANTS).toHaveLength(6)
        expect(TEAM_VARIANTS).toEqual(
            expect.arrayContaining(['grid', 'list', 'cards-hover-reveal', 'horizontal-scroll', 'bio-modal', 'compact-row']),
        )
    })

    it('teamMeta.variants matches TEAM_VARIANTS exactly', () => {
        expect(teamMeta.variants).toEqual(TEAM_VARIANTS)
    })

    it.each(TEAM_VARIANTS)('Zod schema accepts variant "%s"', (variant) => {
        const result = TeamConfigSchema.safeParse({
            blockType: 'team',
            variant,
            members: sampleMembers,
        })
        expect(result.success).toBe(true)
    })

    it('Zod schema rejects invalid variant', () => {
        const result = TeamConfigSchema.safeParse({
            blockType: 'team',
            variant: 'nonexistent-variant',
            members: sampleMembers,
        })
        expect(result.success).toBe(false)
    })
})

describe('TC-F01D-A5.T02: cards-hover-reveal variant', () => {
    it('renders one article per member with name + role visible', () => {
        render(
            <TeamBlock
                block={{ blockType: 'team', variant: 'cards-hover-reveal', members: sampleMembers }}
                theme={{}}
                site={{}}
                page={{}}
            />,
        )
        // Each member name appears at least once (default + hover overlay both render in DOM)
        for (const m of sampleMembers) {
            expect(screen.getAllByText(m.name).length).toBeGreaterThan(0)
        }
        const articles = screen.getAllByRole('article')
        expect(articles.length).toBe(sampleMembers.length)
    })
})

describe('TC-F01D-A5.T03: horizontal-scroll variant', () => {
    it('renders a scroll region containing each member', () => {
        render(
            <TeamBlock
                block={{ blockType: 'team', variant: 'horizontal-scroll', members: sampleMembers }}
                theme={{}}
                site={{}}
                page={{}}
            />,
        )
        const region = screen.getByRole('region', { name: /team members carousel/i })
        expect(region).toBeInTheDocument()
        for (const m of sampleMembers) {
            expect(screen.getByText(m.name)).toBeInTheDocument()
        }
    })
})

describe('TC-F01D-A5.T04: bio-modal variant', () => {
    it('renders one button per member with aria-label "Open bio for {name}"', () => {
        render(
            <TeamBlock
                block={{ blockType: 'team', variant: 'bio-modal', members: sampleMembers }}
                theme={{}}
                site={{}}
                page={{}}
            />,
        )
        for (const m of sampleMembers) {
            expect(screen.getByLabelText(`Open bio for ${m.name}`)).toBeInTheDocument()
        }
    })
})

describe('TC-F01D-A5.T05: compact-row variant', () => {
    it('renders a list with one li per member', () => {
        const { container } = render(
            <TeamBlock
                block={{ blockType: 'team', variant: 'compact-row', members: sampleMembers }}
                theme={{}}
                site={{}}
                page={{}}
            />,
        )
        const listItems = container.querySelectorAll('li')
        expect(listItems.length).toBe(sampleMembers.length)
        for (const m of sampleMembers) {
            expect(screen.getByText(m.name)).toBeInTheDocument()
            expect(screen.getByText(m.role)).toBeInTheDocument()
        }
    })
})
