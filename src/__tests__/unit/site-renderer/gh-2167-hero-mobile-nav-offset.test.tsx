import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

vi.mock('@/blocks/registry', () => ({ blockRegistry: { getComponent: vi.fn() } }))
vi.mock('@/blocks/ErrorBoundary', () => ({
    BlockErrorBoundary: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
}))
vi.mock('@/components/site-renderer/GoogleFontsLoader', () => ({ GoogleFontsLoader: () => null }))

import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { blockRegistry } from '@/blocks/registry'

const mockGetComponent = vi.mocked(blockRegistry.getComponent)
const site = (variant: string) => ({
    name: 'Test',
    theme: { primaryColor: '#f60', secondaryColor: '#00f', backgroundColor: '#fff', fontHeading: 'Roboto', fontBody: 'Open Sans', colorMode: 'light' as const },
    headerBlock: { blockType: 'navigation', variant },
})
const heroWrapper = (c: HTMLElement) =>
    (c.querySelector('[data-testid="block-hero"]') as HTMLElement).parentElement as HTMLElement

describe('[TC-F09.291] hero below overlay nav on mobile (GH-2167)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetComponent.mockImplementation((type: string) => {
            const Comp = () => React.createElement('div', { 'data-testid': `block-${type}` })
            return type === 'navigation' || type === 'hero' || type === 'text' ? Comp : null
        })
    })

    it.each(['transparent', 'floating'])('TC-F09.291: live + nav %s → first content block marked', variant => {
        const { container } = render(
            <SiteRenderer site={site(variant)} page={{ layout: [{ blockType: 'hero' }, { blockType: 'text' }] }} />,
        )
        expect(heroWrapper(container).getAttribute('data-mobile-nav-offset')).toBe(variant)
        expect(container.querySelectorAll('[data-mobile-nav-offset]')).toHaveLength(1)
    })

    it('TC-F09.291: nav default (in flow) → not marked', () => {
        const { container } = render(
            <SiteRenderer site={site('default')} page={{ layout: [{ blockType: 'hero' }] }} />,
        )
        expect(container.querySelector('[data-mobile-nav-offset]')).toBeNull()
    })

    it('TC-F09.291: user-set blockSpacing.paddingTop is respected → not marked', () => {
        const { container } = render(
            <SiteRenderer site={site('transparent')} page={{ layout: [{ blockType: 'hero', blockSpacing: { paddingTop: 10 } }] }} />,
        )
        expect(container.querySelector('[data-mobile-nav-offset]')).toBeNull()
        expect(heroWrapper(container).style.paddingTop).toBe('10px')
    })

    it('TC-F09.291: editor keeps inline offset and is not double-marked', () => {
        const { container } = render(
            <SiteRenderer site={site('transparent')} page={{ layout: [{ blockType: 'hero' }] }} isEditor />,
        )
        expect(container.querySelector('[data-mobile-nav-offset]')).toBeNull()
        expect(heroWrapper(container).style.paddingTop).toBe('var(--nav-height, 64px)')
    })
})
