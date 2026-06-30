import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PreviewSiteRenderer } from '@/app/(preview)/preview/[siteId]/PreviewSiteRenderer'

/**
 * Soft-navigation regression: clicking a nav link inside the preview iframe changes
 * the ?pageId query and re-runs the server component, but PreviewSiteRenderer stays
 * mounted (same /preview/[siteId] route). It must re-seed its `page` state from the
 * new server prop, otherwise content stays stuck on the previously rendered page.
 */

// Mock the heavy SiteRenderer — capture the `page` prop it receives each render.
const renderedPageIds: unknown[] = []
vi.mock('@/components/site-renderer/SiteRenderer', () => ({
    SiteRenderer: ({ page }: { page: { id?: unknown } }) => {
        renderedPageIds.push(page?.id)
        return <div data-testid="page-id">{String(page?.id)}</div>
    },
}))

const site = { id: 1, name: 'Test', theme: {} } as never
const pages = [] as never

function makePage(id: number, headline: string) {
    return { id, layout: [{ blockType: 'hero', headline }] } as never
}

describe('PreviewSiteRenderer — page state syncs on soft navigation', () => {
    it('re-renders new page content when the server delivers a different pageId', () => {
        const { rerender, getByTestId } = render(
            <PreviewSiteRenderer site={site} page={makePage(10, 'Home')} pages={pages} isBuilderPreview />,
        )
        expect(getByTestId('page-id').textContent).toBe('10')

        // Simulate soft-nav: server re-runs with a different page id (About page).
        rerender(
            <PreviewSiteRenderer site={site} page={makePage(20, 'About')} pages={pages} isBuilderPreview />,
        )
        expect(getByTestId('page-id').textContent).toBe('20')
    })

    it('does NOT reset page when the same pageId prop object is re-created (preserves edits)', () => {
        const { rerender, getByTestId } = render(
            <PreviewSiteRenderer site={site} page={makePage(10, 'Home')} pages={pages} isBuilderPreview />,
        )
        expect(getByTestId('page-id').textContent).toBe('10')

        // Parent re-render with a NEW object but SAME id → effect must not refire.
        rerender(
            <PreviewSiteRenderer site={site} page={makePage(10, 'Home edited')} pages={pages} isBuilderPreview />,
        )
        expect(getByTestId('page-id').textContent).toBe('10')
    })
})
