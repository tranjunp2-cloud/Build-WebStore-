import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/preview/site-1') }))
vi.mock('@/components/editor/RichTextBlockEditor', () => ({ default: () => null }))

import { CustomHtmlBlock } from '@/blocks/custom-html'

const block = { blockType: 'custom-html', variant: 'default', html: '' } as never

describe('[TC-F05-RT-02] CustomHtmlBlock empty block stays clickable in the editor', () => {
    const realParent = Object.getOwnPropertyDescriptor(window, 'parent')

    afterEach(() => {
        if (realParent) Object.defineProperty(window, 'parent', realParent)
        window.history.replaceState({}, '', '/')
    })

    describe('inside the editor iframe', () => {
        beforeEach(() => {
            Object.defineProperty(window, 'parent', { configurable: true, value: { postMessage: vi.fn() } })
            window.history.replaceState({}, '', '/?editor=1')
        })

        it('gives an empty block a click target with a minimum height', async () => {
            // Arrange / Act
            const { container } = render(<CustomHtmlBlock block={block} blockIndex={0} />)

            // Assert
            await waitFor(() => expect(container.querySelector('[data-editor-control="rich-text"]')).not.toBeNull())
            const target = container.querySelector('[data-editor-control="rich-text"] > div') as HTMLElement
            expect(target.style.minHeight).toBe('3rem')
        })
    })

    it('does not add a minimum height on the published page', () => {
        // Arrange / Act
        const { container } = render(<CustomHtmlBlock block={block} blockIndex={0} />)

        // Assert
        const target = container.querySelector('.relative > div') as HTMLElement
        expect(target.style.minHeight).toBe('')
    })
})
