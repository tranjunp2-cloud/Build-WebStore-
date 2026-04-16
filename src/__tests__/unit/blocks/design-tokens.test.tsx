/**
 * Unit Tests: Design Tokens + SectionWrapper (Phase 01)
 * TC-IDs: TC-F01D-01.01 → TC-F01D-01.04
 * Convention: docs/TEST_CONVENTION.md
 * PRD: docs/prd/F01-design-quality.md (FR-01, FR-02)
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
    SPACING,
    RADIUS,
    SHADOW,
    ICON_SIZE,
    SECTION_PADDING,
    CONTAINER,
    CARD_PADDING,
    SECTION_BACKGROUND,
    TOUCH_TARGET,
    INNER_PADDING,
} from '@/lib/design-tokens'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'

describe('design-tokens.ts (Phase 01)', () => {
    describe('TC-F01D-01.01: SPACING token family', () => {
        it('exports 10 spacing steps following 8px grid', () => {
            const keys = Object.keys(SPACING)
            expect(keys).toEqual(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'])
        })

        it('values start at 4px (xs) and reach 120px (6xl)', () => {
            expect(SPACING.xs).toBe('4px')
            expect(SPACING.sm).toBe('8px')
            expect(SPACING.md).toBe('16px')
            expect(SPACING['6xl']).toBe('120px')
        })

        it('RADIUS, SHADOW, ICON_SIZE, CARD_PADDING, TOUCH_TARGET all defined', () => {
            expect(Object.keys(RADIUS)).toContain('full')
            expect(Object.keys(SHADOW)).toContain('dramatic')
            expect(Object.keys(ICON_SIZE)).toContain('xl')
            expect(Object.keys(CARD_PADDING)).toContain('lg')
            expect(Object.keys(TOUCH_TARGET)).toContain('min')
        })

        it('SHADOW values are Tailwind class strings (not raw CSS)', () => {
            Object.values(SHADOW).forEach((value) => {
                expect(value).toMatch(/^shadow/)
            })
        })

        it('INNER_PADDING is responsive (has md: and lg: breakpoints)', () => {
            expect(INNER_PADDING).toMatch(/md:px-/)
            expect(INNER_PADDING).toMatch(/lg:px-/)
        })
    })

    describe('TC-F01D-01.02: SectionWrapper default render', () => {
        it('renders <section> with default padding class py-16 md:py-24', () => {
            const { container } = render(
                <SectionWrapper>
                    <p>child</p>
                </SectionWrapper>
            )
            const section = container.querySelector('section')
            expect(section).not.toBeNull()
            expect(section?.className).toContain('py-16')
            expect(section?.className).toContain('md:py-24')
        })

        it('inner container uses max-w-6xl by default + responsive inner padding', () => {
            const { container } = render(
                <SectionWrapper>
                    <p>child</p>
                </SectionWrapper>
            )
            const inner = container.querySelector('section > div')
            expect(inner?.className).toContain('max-w-6xl')
            expect(inner?.className).toContain('mx-auto')
            expect(inner?.className).toContain('px-6')
            expect(inner?.className).toContain('md:px-8')
            expect(inner?.className).toContain('lg:px-12')
        })
    })

    describe('TC-F01D-01.03: SectionWrapper container variants', () => {
        it('renders max-w-3xl when container is narrow', () => {
            const { container } = render(
                <SectionWrapper container="narrow">
                    <p>child</p>
                </SectionWrapper>
            )
            const inner = container.querySelector('section > div')
            expect(inner?.className).toContain('max-w-3xl')
        })

        it('renders max-w-7xl when container is wide', () => {
            const { container } = render(
                <SectionWrapper container="wide">
                    <p>child</p>
                </SectionWrapper>
            )
            const inner = container.querySelector('section > div')
            expect(inner?.className).toContain('max-w-7xl')
        })

        it('renders max-w-full when container is full (edge-to-edge)', () => {
            const { container } = render(
                <SectionWrapper container="full">
                    <p>child</p>
                </SectionWrapper>
            )
            const inner = container.querySelector('section > div')
            expect(inner?.className).toContain('max-w-full')
        })
    })

    describe('TC-F01D-01.04: SectionWrapper background variants', () => {
        it('default background uses --surface-primary (semantic)', () => {
            const { container } = render(
                <SectionWrapper background="default">
                    <p>child</p>
                </SectionWrapper>
            )
            expect(container.querySelector('section')?.className).toContain('--surface-primary')
        })

        it('alternate background uses --surface-secondary (semantic)', () => {
            const { container } = render(
                <SectionWrapper background="alternate">
                    <p>child</p>
                </SectionWrapper>
            )
            expect(container.querySelector('section')?.className).toContain('--surface-secondary')
        })

        it('accent background uses --surface-card (semantic)', () => {
            const { container } = render(
                <SectionWrapper background="accent">
                    <p>child</p>
                </SectionWrapper>
            )
            expect(container.querySelector('section')?.className).toContain('--surface-card')
        })

        it('transparent background removes surface color', () => {
            const { container } = render(
                <SectionWrapper background="transparent">
                    <p>child</p>
                </SectionWrapper>
            )
            expect(container.querySelector('section')?.className).toContain('bg-transparent')
        })

        it('supports custom className and preserves token classes', () => {
            const { container } = render(
                <SectionWrapper className="custom-class">
                    <p>child</p>
                </SectionWrapper>
            )
            const section = container.querySelector('section')
            expect(section?.className).toContain('custom-class')
            expect(section?.className).toContain('py-16')
        })

        it('supports innerClassName for inner container overrides', () => {
            const { container } = render(
                <SectionWrapper innerClassName="relative z-10">
                    <p>child</p>
                </SectionWrapper>
            )
            const inner = container.querySelector('section > div')
            expect(inner?.className).toContain('relative')
            expect(inner?.className).toContain('z-10')
            // Token classes preserved
            expect(inner?.className).toContain('max-w-6xl')
        })

        it('supports padding="hero" for hero blocks', () => {
            const { container } = render(
                <SectionWrapper padding="hero">
                    <p>child</p>
                </SectionWrapper>
            )
            expect(container.querySelector('section')?.className).toContain('py-24')
            expect(container.querySelector('section')?.className).toContain('lg:py-40')
        })

        it('supports padding="compact" for tight sections', () => {
            const { container } = render(
                <SectionWrapper padding="compact">
                    <p>child</p>
                </SectionWrapper>
            )
            expect(container.querySelector('section')?.className).toContain('py-12')
            expect(container.querySelector('section')?.className).toContain('md:py-16')
        })

        it('supports as="header" for navigation blocks', () => {
            const { container } = render(
                <SectionWrapper as="header">
                    <p>child</p>
                </SectionWrapper>
            )
            expect(container.querySelector('header')).not.toBeNull()
            expect(container.querySelector('section')).toBeNull()
        })

        it('forwards id prop for anchor links', () => {
            const { container } = render(
                <SectionWrapper id="features">
                    <p>child</p>
                </SectionWrapper>
            )
            expect(container.querySelector('section')?.id).toBe('features')
        })
    })

    describe('Token shape invariants', () => {
        it('SECTION_PADDING tokens are responsive Tailwind classes (contain md:)', () => {
            Object.values(SECTION_PADDING).forEach((value) => {
                expect(value).toMatch(/md:/)
            })
        })

        it('CONTAINER tokens are max-w-* Tailwind classes', () => {
            Object.values(CONTAINER).forEach((value) => {
                expect(value).toMatch(/^max-w-/)
            })
        })

        it('SECTION_BACKGROUND tokens use CSS vars or bg-transparent', () => {
            Object.values(SECTION_BACKGROUND).forEach((value) => {
                expect(value).toMatch(/var\(--|bg-transparent/)
            })
        })

        it('ICON_SIZE tokens are Tailwind w-* h-* class pairs', () => {
            Object.values(ICON_SIZE).forEach((value) => {
                expect(value).toMatch(/^w-\d+ h-\d+$/)
            })
        })

        it('TOUCH_TARGET meets WCAG 2.5.5 minimum (>=44px)', () => {
            expect(TOUCH_TARGET.min).toContain('44px')
            expect(TOUCH_TARGET.comfortable).toContain('48px')
            expect(TOUCH_TARGET.large).toContain('56px')
        })
    })
})
