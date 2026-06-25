/**
 * Integration Tests — NavigationBlock variant backward compatibility (dual-read aliases)
 * TC-NAV-03, TC-NAV-11
 * Convention: docs/TEST_CONVENTION.md | QA: docs/qa/F-navigation.md
 *
 * Verifies that old DB variant names ('simple', 'mega-menu', 'pill') render
 * identically to their canonical replacements via VARIANT_ALIASES in NavigationBlock.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { I18nProvider } from '@/i18n'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('framer-motion', () => {
    const React = require('react')

    const createPrimitive = (tag: keyof JSX.IntrinsicElements) => {
        const Comp = React.forwardRef(
            ({ children, ...props }: React.HTMLAttributes<HTMLElement>, ref: React.Ref<HTMLElement>) =>
                React.createElement(tag, { ...props, ref }, children),
        )
        Comp.displayName = `Motion${tag}`
        return Comp
    }

    return {
        motion: {
            create: (Component) => React.forwardRef(({ children, ...rest }, ref) => React.createElement(Component, { ...rest, ref }, children)),
            nav: createPrimitive('nav'),
            div: createPrimitive('div'),
            a: createPrimitive('a'),
            button: createPrimitive('button'),
        },
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        useReducedMotion: () => false,
    }
})

import { NavigationBlock } from '@/blocks/navigation'

const site = { theme: {} }

function makeBlock(variant: string) {
    return {
        blockType: 'navigation',
        variant,
        logoText: 'Acme Corp',
        links: [
            { label: 'Home', url: '/' },
            { label: 'About', url: '/about' },
        ],
        ctaButton: { show: true, label: 'Get started', url: '/contact' },
    }
}

function renderNav(variant: string) {
    const { container } = render(
        <I18nProvider defaultLocale="en">
            <NavigationBlock block={makeBlock(variant)} theme={{}} site={site} page={{}} />
        </I18nProvider>,
    )
    return container.innerHTML
}

// ── TC-NAV-03: VARIANT_ALIASES dual-read mapping ──────────────────────────────
//
// innerHTML equality is stable here because:
// 1. framer-motion is fully mocked — no animation state, no dynamic attributes
// 2. NavigationBlock uses no useId() or random keys
// 3. Same block/theme/site data → deterministic render tree
// Any dynamic attribute added to NavigationBlock must be exempt from this comparison or this test should migrate to structural assertions.

describe('TC-NAV-03 — VARIANT_ALIASES: old variant names render identically to canonical names', () => {
    it('"simple" renders the same DOM as "default"', () => {
        // Arrange + Act
        const legacyHtml = renderNav('simple')
        const canonicalHtml = renderNav('default')

        // Assert
        expect(legacyHtml).toBe(canonicalHtml)
    })

    it('"mega-menu" renders the same DOM as "mega"', () => {
        // Arrange + Act
        const legacyHtml = renderNav('mega-menu')
        const canonicalHtml = renderNav('mega')

        // Assert
        expect(legacyHtml).toBe(canonicalHtml)
    })

    it('"pill" renders the same DOM as "floating"', () => {
        // Arrange + Act
        const legacyHtml = renderNav('pill')
        const canonicalHtml = renderNav('floating')

        // Assert
        expect(legacyHtml).toBe(canonicalHtml)
    })
})

// ── TC-NAV-11: Backward compat — 'simple' row renders as default variant ──────

describe('TC-NAV-11 — seed row with variant "simple" renders identical to variant "default"', () => {
    it('produces byte-identical HTML for simple vs default', () => {
        // Arrange — simulates a DB row that still has the old variant name
        const legacyRow = makeBlock('simple')
        const canonicalRow = makeBlock('default')

        // Act
        const { container: legacyContainer } = render(
            <I18nProvider defaultLocale="en">
                <NavigationBlock block={legacyRow} theme={{}} site={site} page={{}} />
            </I18nProvider>,
        )
        const { container: canonicalContainer } = render(
            <I18nProvider defaultLocale="en">
                <NavigationBlock block={canonicalRow} theme={{}} site={site} page={{}} />
            </I18nProvider>,
        )

        // Assert
        expect(legacyContainer.innerHTML).toBe(canonicalContainer.innerHTML)
    })
})
