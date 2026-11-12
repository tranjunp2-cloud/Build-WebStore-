vi.mock('@/components/site-renderer/SiteRenderer', () => ({
    SiteRenderer: (props: SiteRendererProps) => {
        renderedSnapshots.push({ site: props.site, page: props.page })
        return <div data-testid="rendered-snapshot">{JSON.stringify({ site: props.site, page: props.page })}</div>
    },
}))

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteRendererProps } from '@/components/site-renderer/SiteRenderer'
import { PreviewSiteRenderer } from '@/app/(preview)/preview/[siteId]/PreviewSiteRenderer'

const renderedSnapshots: Array<Pick<SiteRendererProps, 'site' | 'page'>> = []
const initialSite = {
    theme: { primaryColor: '#111111' },
    headerBlock: { blockType: 'navigation', variant: 'old' },
    footerBlock: { blockType: 'footer', variant: 'old' },
    globalBlocks: { cartWidget: { enabled: true } },
}
const initialPage = { id: 10, layout: [{ blockType: 'hero', headline: 'My content', variant: 'old' }] }
const snapshot = {
    type: 'UPDATE_TEMPLATE_SNAPSHOT',
    bodyBlocks: [{ blockType: 'hero', headline: 'My content', variant: 'new' }],
    theme: { primaryColor: '#222222' },
    headerBlock: { blockType: 'navigation', variant: 'new' },
    footerBlock: { blockType: 'footer', variant: 'new' },
    globalBlocks: { cartWidget: { enabled: false } },
    templateSwapRevision: 'swap-1',
}

function sendSnapshot(data: unknown, origin = window.location.origin) {
    act(() => window.dispatchEvent(new MessageEvent('message', { origin, data })))
}

describe('[TC_F07_039, TC_F07_041] Complete template preview snapshots', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        renderedSnapshots.length = 0
    })
    afterEach(() => {
        cleanup()
        vi.useRealTimers()
    })

    it('renders body, theme, header, footer and globals together and publishes the rendered revision', () => {
        // Arrange
        const { container } = render(<PreviewSiteRenderer site={initialSite} page={initialPage} pages={[]} isEditorIframe />)
        renderedSnapshots.length = 0

        // Act
        sendSnapshot(snapshot)

        // Assert — no intermediate render combines new body with old canonical blocks.
        expect(renderedSnapshots).toHaveLength(1)
        expect(renderedSnapshots[0]).toEqual({
            page: { id: 10, layout: [{ ...snapshot.bodyBlocks[0], __editorBlockIndex: 0 }] },
            site: {
                theme: snapshot.theme,
                headerBlock: snapshot.headerBlock,
                footerBlock: snapshot.footerBlock,
                globalBlocks: snapshot.globalBlocks,
            },
        })
        expect(container.querySelector('[data-template-swap-revision="swap-1"]')).not.toBeNull()
    })

    it('clears canonical header, footer and globals when the rollback snapshot explicitly contains null', () => {
        // Arrange
        const { container } = render(<PreviewSiteRenderer site={initialSite} page={initialPage} pages={[]} isEditorIframe />)
        sendSnapshot(snapshot)

        // Act
        sendSnapshot({ ...snapshot, headerBlock: null, footerBlock: null, globalBlocks: null, templateSwapRevision: 'rollback-1' })

        // Assert
        expect(renderedSnapshots.at(-1)?.site).toMatchObject({ headerBlock: null, footerBlock: null, globalBlocks: null })
        expect(container.querySelector('[data-template-swap-revision="rollback-1"]')).not.toBeNull()
    })

    it('ignores snapshots from another origin without publishing their revision', () => {
        // Arrange
        const { container } = render(<PreviewSiteRenderer site={initialSite} page={initialPage} pages={[]} isEditorIframe />)
        renderedSnapshots.length = 0

        // Act
        sendSnapshot(snapshot, 'https://untrusted.example')

        // Assert
        expect(renderedSnapshots).toHaveLength(0)
        expect(container.querySelector('[data-template-swap-revision]')).toBeNull()
    })
})
