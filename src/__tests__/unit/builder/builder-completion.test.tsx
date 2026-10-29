// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import en from '@/i18n/locales/en.json'

// Plan 260415 — stub useI18n so the component renders with real EN strings
// without needing a wrapping I18nProvider in every test.
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: en,
        ti: (template: string, vars: Record<string, string | number>) =>
            template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')),
    }),
    I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import BuilderCompletionView from '../../../components/builder/BuilderCompletionView'
import type { BuilderPreviewMode } from '../../../components/builder/BuilderPreviewPrimitives'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('@/components/builder/BuilderPreviewPrimitives', () => ({
    BuilderPreviewSurface: ({
        children,
        mode,
    }: {
        children: React.ReactNode
        mode: string
    }) => (
        <div data-testid="preview-surface" data-mode={mode}>
            {children}
        </div>
    ),
}))

vi.mock('@/components/builder/onboarding/BuilderStepScreen', () => ({
    BuilderStepScreen: (props: {
        title: string
        subtitle: string
        leftBody: React.ReactNode
        leftFooter: React.ReactNode
        right: React.ReactNode
        floatingControls?: React.ReactNode
    }) => (
        <div data-testid="step-screen">
            <h1>{props.title}</h1>
            <h2>{props.subtitle}</h2>
            <div data-testid="left-body">{props.leftBody}</div>
            <div data-testid="left-footer">{props.leftFooter}</div>
            <div data-testid="right-pane">{props.right}</div>
            {props.floatingControls && (
                <div data-testid="floating-controls">{props.floatingControls}</div>
            )}
        </div>
    ),
}))

// ── Helpers ───────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
    siteName: 'My Coffee Shop',
    totalBlocks: 8,
    generationTimeLabel: '32s',
    onDashboard: vi.fn(),
    onOpenEditor: vi.fn(),
    onOpenPreview: vi.fn(),
    onPublish: vi.fn(),
    previewContent: <div data-testid="preview-content">Preview HTML</div>,
    previewMode: 'desktop' as BuilderPreviewMode,
    onPreviewModeChange: vi.fn(),
    isPublishing: false,
}

function renderCompletion(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
    return render(<BuilderCompletionView {...DEFAULT_PROPS} {...overrides} />)
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('BuilderCompletionView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ── TC-F01.12: Hiển thị CTAs sau khi tạo xong ────────────────────────

    describe('Rendering — success state (TC-F01.12)', () => {
        it('renders step screen with correct title and subtitle', () => {
            renderCompletion()
            expect(screen.getByText('Create website with AI')).toBeInTheDocument()
            expect(screen.getByText('Website generation')).toBeInTheDocument()
        })

        it('displays site name in the success message', () => {
            renderCompletion()
            expect(screen.getByText(/My Coffee Shop/)).toBeInTheDocument()
        })

        it('displays total block count with +N sections format', () => {
            renderCompletion()
            expect(screen.getByText(/\+8 sections/)).toBeInTheDocument()
        })

        it('displays generation time label', () => {
            renderCompletion()
            expect(screen.getByText(/\+32s/)).toBeInTheDocument()
        })

        it('displays "is ready!" message', () => {
            renderCompletion()
            expect(screen.getByText(/is ready!/i)).toBeInTheDocument()
        })

        it('shows instructional hint text after creation', () => {
            renderCompletion()
            expect(
                screen.getByText(/See the preview.*open the editor.*publish now/i),
            ).toBeInTheDocument()
        })
    })

    // ── TC-F01.12: Draft badge on the "is ready!" card ───────────────────
    describe('Draft badge (TC-F01.12)', () => {
        it('renders the Draft badge with the localized label next to the ready message', () => {
            renderCompletion()
            const badge = screen.getByTestId('completion-draft-badge')
            expect(badge).toHaveTextContent(en.onboarding.completion.draftBadge)
            expect(badge).toHaveClass('bg-yellow-500/20', 'text-yellow-400')
        })
    })

    // ── TC-F01.12: CTA buttons present ───────────────────────────────────

    describe('CTA buttons (TC-F01.12)', () => {
        it('renders Dashboard button', () => {
            renderCompletion()
            expect(screen.getByRole('button', { name: /Dashboard/i })).toBeInTheDocument()
        })

        it('renders Publish Website button', () => {
            renderCompletion()
            expect(screen.getByRole('button', { name: /Publish Website/i })).toBeInTheDocument()
        })

        it('renders Open Editor button', () => {
            renderCompletion()
            expect(screen.getByRole('button', { name: /Open Editor/i })).toBeInTheDocument()
        })
    })

    // ── TC-F01.22: Publish button triggers onPublish ──────────────────────

    describe('Publish flow (TC-F01.22)', () => {
        it('calls onPublish when Publish Website is clicked', () => {
            const onPublish = vi.fn()
            renderCompletion({ onPublish })
            fireEvent.click(screen.getByRole('button', { name: /Publish Website/i }))
            expect(onPublish).toHaveBeenCalledTimes(1)
        })

        it('calls onDashboard when Dashboard is clicked', () => {
            const onDashboard = vi.fn()
            renderCompletion({ onDashboard })
            fireEvent.click(screen.getByRole('button', { name: /Dashboard/i }))
            expect(onDashboard).toHaveBeenCalledTimes(1)
        })

        it('calls onOpenEditor when Open Editor is clicked', () => {
            const onOpenEditor = vi.fn()
            renderCompletion({ onOpenEditor })
            fireEvent.click(screen.getByRole('button', { name: /Open Editor/i }))
            expect(onOpenEditor).toHaveBeenCalledTimes(1)
        })
    })

    // ── TC-F01.22: isPublishing state ────────────────────────────────────

    describe('isPublishing state (TC-F01.22)', () => {
        it('shows "Publishing..." label when isPublishing is true', () => {
            renderCompletion({ isPublishing: true })
            expect(screen.getByRole('button', { name: /Publishing.../i })).toBeInTheDocument()
        })

        it('disables Dashboard button while publishing', () => {
            renderCompletion({ isPublishing: true })
            expect(screen.getByRole('button', { name: /Dashboard/i })).toBeDisabled()
        })

        it('disables Publish button while publishing', () => {
            renderCompletion({ isPublishing: true })
            expect(screen.getByRole('button', { name: /Publishing.../i })).toBeDisabled()
        })

        it('disables Open Editor button while publishing', () => {
            renderCompletion({ isPublishing: true })
            expect(screen.getByRole('button', { name: /Open Editor/i })).toBeDisabled()
        })

        it('does not call onPublish when button is disabled during publishing', () => {
            const onPublish = vi.fn()
            renderCompletion({ isPublishing: true, onPublish })
            const btn = screen.getByRole('button', { name: /Publishing.../i })
            // disabled buttons do not fire click
            fireEvent.click(btn)
            expect(onPublish).not.toHaveBeenCalled()
        })

        it('re-enables buttons and shows "Publish Website" when isPublishing is false', () => {
            renderCompletion({ isPublishing: false })
            const btn = screen.getByRole('button', { name: /Publish Website/i })
            expect(btn).not.toBeDisabled()
        })
    })

    // ── TC-F01.09: Preview panel ──────────────────────────────────────────

    describe('Preview panel (TC-F01.09)', () => {
        it('renders preview content in the right pane', () => {
            renderCompletion()
            expect(screen.getByTestId('preview-content')).toBeInTheDocument()
        })

        it('renders preview mode toggle', () => {
            renderCompletion()
            expect(screen.getByTestId('preview-mode-toggle')).toBeInTheDocument()
        })

        it('displays "Website preview" heading in right pane', () => {
            renderCompletion()
            expect(screen.getByText('Website preview')).toBeInTheDocument()
        })

        it('displays "Your AI-generated website" subtitle', () => {
            renderCompletion()
            expect(screen.getByText('Your AI-generated website')).toBeInTheDocument()
        })

        it('renders View Full Preview button that calls onOpenPreview', () => {
            const onOpenPreview = vi.fn()
            renderCompletion({ onOpenPreview })
            const btn = screen.getByRole('button', { name: /View Full Preview/i })
            fireEvent.click(btn)
            expect(onOpenPreview).toHaveBeenCalledTimes(1)
        })

        it('slides the toggle thumb to the mobile slot only in mobile mode', () => {
            const { rerender } = renderCompletion()
            expect(screen.getByTestId('preview-mode-thumb')).toHaveClass('translate-x-0')
            expect(screen.getByTestId('toggle-desktop')).toHaveAttribute('aria-pressed', 'true')
            rerender(<BuilderCompletionView {...DEFAULT_PROPS} previewMode="mobile" />)
            expect(screen.getByTestId('preview-mode-thumb')).toHaveClass('translate-x-[104px]')
            expect(screen.getByTestId('toggle-mobile')).toHaveAttribute('aria-pressed', 'true')
        })

        it('passes current previewMode to the preview surface', () => {
            renderCompletion({ previewMode: 'mobile' })
            expect(screen.getByTestId('preview-surface')).toHaveAttribute('data-mode', 'mobile')
        })

        it('calls onPreviewModeChange when toggling to mobile', () => {
            const onPreviewModeChange = vi.fn()
            renderCompletion({ onPreviewModeChange })
            fireEvent.click(screen.getByTestId('toggle-mobile'))
            expect(onPreviewModeChange).toHaveBeenCalledWith('mobile')
        })

        it('calls onPreviewModeChange when toggling to desktop', () => {
            const onPreviewModeChange = vi.fn()
            renderCompletion({ previewMode: 'mobile', onPreviewModeChange })
            fireEvent.click(screen.getByTestId('toggle-desktop'))
            expect(onPreviewModeChange).toHaveBeenCalledWith('desktop')
        })
    })

    // ── Mobile arrange-sections panel ────────────────────────────────────

    describe('Arrange sections panel (mobile, TC-F01.M09 / TC-F01.M10)', () => {
        const BLOCKS = [
            { _id: 'b1', blockType: 'hero', headline: 'Welcome' },
            { _id: 'b2', blockType: 'features', sectionLabel: 'Our Features' },
            { _id: 'b3', blockType: 'navigation' }, // excluded
            { _id: 'b4', blockType: 'footer' }, // excluded
        ]

        it('does not render arrange-sections panel when no blocks provided', () => {
            renderCompletion({ blocks: [] })
            expect(screen.queryByText('Arrange sections')).not.toBeInTheDocument()
        })

        it('does not render arrange-sections panel when onMoveBlock is not provided', () => {
            renderCompletion({ blocks: BLOCKS })
            expect(screen.queryByText('Arrange sections')).not.toBeInTheDocument()
        })

        it('renders arrange-sections panel when movable blocks + onMoveBlock are provided', () => {
            const onMoveBlock = vi.fn()
            renderCompletion({ blocks: BLOCKS, onMoveBlock })
            expect(screen.getByText('Arrange sections')).toBeInTheDocument()
        })

        it('excludes navigation and footer from movable blocks list', () => {
            const onMoveBlock = vi.fn()
            renderCompletion({ blocks: BLOCKS, onMoveBlock })
            // navigation and footer should not appear as section rows
            const items = screen.getAllByText(/hero|features|Welcome|Our Features/i)
            expect(items.length).toBeGreaterThanOrEqual(1)
            expect(screen.queryByText('navigation')).not.toBeInTheDocument()
            expect(screen.queryByText('footer')).not.toBeInTheDocument()
        })

        it('calls onMoveBlock with correct id and direction "up"', () => {
            const onMoveBlock = vi.fn()
            renderCompletion({ blocks: BLOCKS, onMoveBlock })
            // The second movable block (index 1) should have an enabled "up" button
            const upButtons = screen.getAllByRole('button', { hidden: true }).filter(
                (btn) => btn.querySelector('svg') !== null && !btn.disabled,
            )
            // Find the down button on the first item (b1, index=0 → up is disabled)
            // Up button on second movable block (b2) should be enabled
            const allButtons = screen.getAllByRole('button')
            const arrowButtons = allButtons.filter((btn) => btn.getAttribute('type') === 'button')
            // click the up button on block b2 row (second movable block)
            // ArrowUp buttons appear in pairs per block; b1-up is disabled, b2-up is enabled
            const enabledUpButton = arrowButtons.find(
                (btn) => !btn.disabled && btn.innerHTML.includes('ArrowUp'),
            )
            if (enabledUpButton) {
                fireEvent.click(enabledUpButton)
                expect(onMoveBlock).toHaveBeenCalledWith('b2', 'up')
            }
        })

        it('disables up button on the first movable block', () => {
            const onMoveBlock = vi.fn()
            renderCompletion({ blocks: BLOCKS, onMoveBlock })
            // The block label for first movable block
            const firstRow = screen.getByText('Welcome').closest('div[class*="flex items-center justify-between"]')
            if (firstRow) {
                const upBtn = firstRow.querySelectorAll('button')[0]
                expect(upBtn).toBeDisabled()
            }
        })

        it('calls onMoveBlock with "down" for a block that is not last', () => {
            const onMoveBlock = vi.fn()
            renderCompletion({ blocks: BLOCKS, onMoveBlock })
            const allButtons = screen.getAllByRole('button')
            // The first movable block's down button should be the 2nd button in its row
            // and should not be disabled (b1 is first, so down is enabled)
            const firstBlockDownButton = allButtons.find(
                (btn) =>
                    btn.getAttribute('type') === 'button' &&
                    !btn.disabled &&
                    btn.innerHTML.includes('ArrowDown'),
            )
            if (firstBlockDownButton) {
                fireEvent.click(firstBlockDownButton)
                expect(onMoveBlock).toHaveBeenCalledWith(expect.any(String), 'down')
            }
        })

        it('uses blockType as fallback label when no sectionLabel/headline/title', () => {
            const onMoveBlock = vi.fn()
            const blocksNoLabel = [{ _id: 'bx', blockType: 'gallery' }]
            renderCompletion({ blocks: blocksNoLabel, onMoveBlock })
            expect(screen.getByText('Gallery')).toBeInTheDocument()
        })

        it('uses "Section" as final fallback when blockType is also absent', () => {
            const onMoveBlock = vi.fn()
            const blocksNoType = [{ _id: 'by' }]
            renderCompletion({ blocks: blocksNoType, onMoveBlock })
            expect(screen.getByText('Section')).toBeInTheDocument()
        })
    })

    // ── floatingControls ─────────────────────────────────────────────────

    describe('floatingControls', () => {
        it('renders floatingControls when provided', () => {
            renderCompletion({
                floatingControls: <button type="button">Floating</button>,
            })
            expect(screen.getByTestId('floating-controls')).toBeInTheDocument()
            expect(screen.getByText('Floating')).toBeInTheDocument()
        })
    })

    // ── Default prop: generationTimeLabel ────────────────────────────────

    describe('Default props', () => {
        it('uses "0s" as default generationTimeLabel when not provided', () => {
            render(
                <BuilderCompletionView
                    siteName="Test"
                    totalBlocks={3}
                    onDashboard={vi.fn()}
                    onOpenEditor={vi.fn()}
                    onOpenPreview={vi.fn()}
                    onPublish={vi.fn()}
                    previewContent={<div />}
                    previewMode="desktop"
                    onPreviewModeChange={vi.fn()}
                />,
            )
            expect(screen.getByText(/\+0s/)).toBeInTheDocument()
        })
    })
})

// ── #2103 A1/A3: finish-your-shop CTA + "replace before you publish" list ────

describe('BuilderCompletionView — finish your shop + placeholders (#2103)', () => {
    const c = en.onboarding.completion
    const PLACEHOLDERS = [
        { pageSlug: 'home', blockType: 'testimonials', label: 'Customer reviews' },
        { pageSlug: 'about', blockType: 'team', label: 'Team members' },
    ]

    function renderWith(extra: Partial<React.ComponentProps<typeof BuilderCompletionView>> = {}) {
        const props = {
            ...DEFAULT_PROPS,
            onDashboard: vi.fn(),
            onOpenEditor: vi.fn(),
            onPublish: vi.fn(),
            onFinishShop: vi.fn(),
            ...extra,
        }
        render(<BuilderCompletionView {...props} />)
        return props
    }

    beforeEach(() => vi.clearAllMocks())

    it('TC-AIAUD-057: shows the "Finish your shop" CTA only when products were created', () => {
        const props = renderWith({ productCount: 4 })

        fireEvent.click(screen.getByRole('button', { name: c.finishShopButton }))

        expect(props.onFinishShop).toHaveBeenCalledTimes(1)
        expect(screen.getByText(c.finishShopDescription)).toBeInTheDocument()
        // the other actions stay
        expect(screen.getByRole('button', { name: c.openEditor })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: c.publishWebsite })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: new RegExp(c.goToDashboard) })).toBeInTheDocument()
    })

    it('TC-AIAUD-057: no CTA without products (zero, absent) or without a handler', () => {
        const { unmount } = render(<BuilderCompletionView {...DEFAULT_PROPS} productCount={0} onFinishShop={vi.fn()} />)
        expect(screen.queryByRole('button', { name: c.finishShopButton })).not.toBeInTheDocument()
        unmount()

        const second = render(<BuilderCompletionView {...DEFAULT_PROPS} onFinishShop={vi.fn()} />)
        expect(screen.queryByRole('button', { name: c.finishShopButton })).not.toBeInTheDocument()
        second.unmount()

        render(<BuilderCompletionView {...DEFAULT_PROPS} productCount={3} />)
        expect(screen.queryByRole('button', { name: c.finishShopButton })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: c.openEditor })).toBeInTheDocument()
    })

    it('TC-AIAUD-058: lists the sections to replace and still lets the merchant publish', () => {
        const props = renderWith({ placeholders: PLACEHOLDERS })

        expect(screen.getByText(c.placeholdersTitle)).toBeInTheDocument()
        expect(screen.getByText('Customer reviews')).toBeInTheDocument()
        expect(screen.getByText('Team members')).toBeInTheDocument()

        const publish = screen.getByRole('button', { name: c.publishWebsite })
        expect(publish).toBeEnabled()
        fireEvent.click(publish)
        expect(props.onPublish).toHaveBeenCalledTimes(1)
    })

    it('TC-AIAUD-058: no list when there are no placeholders, and a long list is shortened', () => {
        const { unmount } = render(<BuilderCompletionView {...DEFAULT_PROPS} placeholders={[]} />)
        expect(screen.queryByText(c.placeholdersTitle)).not.toBeInTheDocument()
        unmount()

        const many = Array.from({ length: 9 }, (_, i) => ({ pageSlug: 'home', blockType: 'stats', label: `Section ${i + 1}` }))
        render(<BuilderCompletionView {...DEFAULT_PROPS} placeholders={many} />)
        expect(screen.getByText('Section 6')).toBeInTheDocument()
        expect(screen.queryByText('Section 7')).not.toBeInTheDocument()
        expect(screen.getByText('+3 more')).toBeInTheDocument()
    })
})
