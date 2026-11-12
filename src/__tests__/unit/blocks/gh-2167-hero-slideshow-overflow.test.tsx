import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

vi.mock('@/components/site-renderer/OwnerContext', () => ({ useIsOwner: vi.fn(() => false) }))
vi.mock('@/components/site-renderer/BuilderPreviewContext', () => ({ useIsBuilderPreview: vi.fn(() => false) }))
vi.mock('@/components/site-renderer/BlockEditCallbackContext', () => ({ useBlockEditCallback: vi.fn(() => null) }))

import { SlideshowHero } from '@/blocks/hero/variants/slideshow'

describe('[TC-F09.292] slideshow hero content not clipped above frame (GH-2167)', () => {
    it('TC-F09.292: content is wrapped in my-auto and the scroll container has no justify-center', () => {
        // Arrange
        const block = {
            blockType: 'hero',
            variant: 'slideshow',
            headline: 'SIRAGA IEM',
            subheadline: 'Long description '.repeat(20),
            images: [{ url: '/a.jpg', alt: 'a' }],
        } as never

        // Act
        const { container, getByTestId } = render(<SlideshowHero block={block} site={{} as never} />)

        // Assert — justify-center on an overflow container clips the top (h1) and cannot be scrolled to
        const content = getByTestId('hero-slideshow-content')
        expect(content.className).toContain('my-auto')
        const scroller = content.parentElement as HTMLElement
        expect(scroller.className).toContain('overflow-y-auto')
        expect(scroller.className).not.toContain('justify-center')
        expect(container.querySelector('h1')?.textContent).toContain('SIRAGA IEM')
    })
})
