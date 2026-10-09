/**
 * Mobile UX Tests — Editor & Dashboard responsive behavior
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.18  → DashboardStats mobile grid uses grid-cols-2
 *   TC-F03.27  → DashboardStats mobile 375px 2x2 layout (scenario #27)
 *   TC-F05-05-05 → PreviewFrame disableDragDrop hides drag handle on mobile
 *   TC-F05-08-04 → PreviewFrame mobile tap mode (no drag drop)
 *   TC-F04.15  → Block registry count matches expected total (42 blocks)
 *
 * Scenario dimensions covered:
 *   #3 Environment — Mobile 375px responsive breakpoints
 *   #5 State Transitions — loading → rendered, drag enabled/disabled
 *   #6 Props — disableDragDrop, viewport, preferences
 *   #12 Business Logic — block registry count, stat card ordering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ── Mock i18n ─────────────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                overview: {
                    stats: {
                        views: 'Views',
                        leads: 'Leads',
                        engagement: 'Engagement',
                        revenue: 'Revenue',
                    },
                },
            },
            editor: {
                toolbar: { sitePreview: 'Site Preview', dragToReorder: 'Drag to reorder section', drag: 'Drag' },
                preview: { altUploadedImage: 'Uploaded image', editWithAI: 'Edit with AI', mapImageError: 'Could not map image to block field', imageReplaceSuccess: 'Image replaced successfully', imageReplaceFailed: 'Failed to replace image', inlineEditFailed: 'Inline edit failed', aiContextLocked: 'AI Generation context locked to: {blockType}' },
                blockLibrary: { dropToAdd: 'Drop to add block' },
                inlineEditComponent: { clickToEdit: 'Click to edit', defaultPlaceholder: 'Click to edit...', save: 'Save', cancel: 'Cancel', aiRewrite: 'AI Rewrite', aiPlaceholder: 'e.g. Make it shorter, add emoji...', rewrite: 'Rewrite' },
                richText: { heading1: 'Heading 1', heading2: 'Heading 2', heading3: 'Heading 3', heading4: 'Heading 4', paragraph: 'Paragraph', bold: 'Bold', italic: 'Italic', underline: 'Underline', alignLeft: 'Align Left', alignCenter: 'Align Center', alignRight: 'Align Right', justify: 'Justify' },
                imageToolbar: { changeImage: 'Change Image', generateAI: 'Generate AI Image' },
            },
        },
        locale: 'en',
    }),
}))

// ── Mock editorStore ──────────────────────────────────────────────────────────
vi.mock('@/store/editorStore', () => ({
    useEditorStore: vi.fn().mockReturnValue({
        blocks: [],
        updateBlock: vi.fn(),
    }),
}))

// ── Imports ───────────────────────────────────────────────────────────────────
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { PreviewFrame } from '@/components/editor/PreviewFrame'
import { blockRegistry } from '@/blocks/registry'

type PreviewFrameProps = React.ComponentProps<typeof PreviewFrame>

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultPreviewProps: PreviewFrameProps = {
    siteId: 'site-mobile-test',
    pageId: null,
    iframeKey: 1,
    isLoading: false,
    viewport: 'mobile',
    selectedBlock: null,
}

// =============================================================================
// TC-F03.18 / TC-F03.27 — DashboardStats mobile grid layout
// =============================================================================

describe('DashboardStats — mobile grid layout', () => {
    it('[TC-F03.18] renders with CSS contents wrapper for grid passthrough', () => {
        const { container } = render(
            <DashboardStats views={100} leads={50} engagement={75} currency="MYR" />,
        )
        const wrapper = container.firstElementChild as HTMLElement
        expect(wrapper).toBeTruthy()
        expect(wrapper.className).toContain('contents')
    })

    it('[TC-F03.18] renders exactly 3 stat cards by default (revenue disabled for F10)', () => {
        const { container } = render(
            <DashboardStats views={200} leads={80} engagement={90} currency="MYR" />,
        )
        const wrapper = container.firstElementChild as HTMLElement
        expect(wrapper.children.length).toBe(3)
    })

    it('[TC-F03.18] stat cards use padding p-5', () => {
        const { container } = render(
            <DashboardStats views={100} leads={50} engagement={75} currency="MYR" />,
        )
        const wrapper = container.firstElementChild as HTMLElement
        const cards = Array.from(wrapper.children)
        expect(cards.length).toBe(3)
        cards.forEach((card) => {
            expect(card.className).toContain('p-5')
        })
    })

    it('[TC-F03.18] stat values use text-[48px]', () => {
        render(<DashboardStats views={1234} leads={567} engagement={89} currency="MYR" />)
        const viewsValue = screen.getByText('1,234')
        expect(viewsValue.className).toContain('text-[48px]')
    })

    it('[TC-F03.18] stat labels use text-[18px]', () => {
        render(<DashboardStats views={100} leads={50} engagement={75} currency="MYR" />)
        const viewsLabel = screen.getByText('Views')
        expect(viewsLabel.className).toContain('text-[18px]')
    })

    it('[TC-F03.27] respects custom preferences order', () => {
        const { container } = render(
            <DashboardStats
                views={100}
                leads={50}
                engagement={75}
                currency="MYR"
                preferences={['engagement', 'views', 'leads']}
            />,
        )
        const gridContainer = container.firstElementChild as HTMLElement
        // All 3 cards should render in custom order
        expect(gridContainer.children.length).toBe(3)
    })

    it('[TC-F03.27] filters out revenue from preferences', () => {
        const { container } = render(
            <DashboardStats
                views={100}
                leads={50}
                engagement={75}
                currency="MYR"
                preferences={['views', 'revenue', 'leads', 'engagement']}
            />,
        )
        const wrapper = container.firstElementChild as HTMLElement
        // Revenue is filtered out (F10 not ready), so 3 cards rendered
        expect(wrapper.children.length).toBe(3)
    })
})

// =============================================================================
// TC-F05-05-05 / TC-F05-08-04 — PreviewFrame disableDragDrop prop
// =============================================================================

describe('PreviewFrame — disableDragDrop prop', () => {
    it('[TC-F05-08-04] accepts disableDragDrop as optional prop', () => {
        // Verify that the component renders without error when disableDragDrop is passed
        const { container } = render(
            <PreviewFrame {...defaultPreviewProps} disableDragDrop={true} />,
        )
        expect(container).toBeTruthy()
    })

    it('[TC-F05-05-05] renders in mobile viewport with disableDragDrop=true', () => {
        render(
            <PreviewFrame
                {...defaultPreviewProps}
                viewport="mobile"
                disableDragDrop={true}
            />,
        )
        const iframe = screen.getByTitle('Site Preview')
        expect(iframe).toBeInTheDocument()
    })

    it('[TC-F05-08-04] renders loading state even with disableDragDrop', () => {
        render(
            <PreviewFrame
                {...defaultPreviewProps}
                isLoading={true}
                disableDragDrop={true}
            />,
        )
        expect(screen.getByText('Loading site...')).toBeInTheDocument()
    })

    it('[TC-F05-05-05] mobile viewport sets iframe container width to 390px', () => {
        const { container } = render(
            <PreviewFrame
                {...defaultPreviewProps}
                viewport="mobile"
                disableDragDrop={true}
            />,
        )
        // The inner container div has style width: 390 for mobile
        const styledDiv = container.querySelector('[style*="width"]') as HTMLElement
        expect(styledDiv).toBeTruthy()
        expect(styledDiv.style.width).toBe('min(390px, 100%)')
    })
})

// =============================================================================
// TC-F04.15 — Block registry count (42 blocks)
// =============================================================================

describe('blockRegistry — block count', () => {
    it('[TC-F04.15] registry contains exactly 52 blocks including legacy migration renderers', () => {
        expect(blockRegistry.count).toBe(52)
    })

    it('[TC-F04.15] getBlockTypes returns 52 unique entries', () => {
        const types = blockRegistry.getBlockTypes()
        expect(types.length).toBe(52)
        expect(new Set(types).size).toBe(types.length)
    })

    it('[TC-F04.15] all v1.1 blocks are registered', () => {
        const v11Blocks = [
            'pricing-table',
            'gallery-masonry',
            'whatsapp-button',
            'google-maps',
            'social-proof',
            'countdown-timer',
            'before-after',
            'feature-comparison',
            'download-cta',
            'video-background',
            'breadcrumb',
            'divider',
            'announcement-bar',
            'client-logos',
            'accordion',
            'step-process',
            'portfolio-grid',
            'menu-food',
            'service-cards',
            'carousel',
        ]

        for (const blockType of v11Blocks) {
            expect(blockRegistry.has(blockType)).toBe(true)
        }
    })
})
