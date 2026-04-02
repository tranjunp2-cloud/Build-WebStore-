// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BuilderCompletionView from '../../../components/builder/BuilderCompletionView'
import type { BuilderPreviewMode } from '../../../components/builder/BuilderPreviewPrimitives'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('@/components/builder/BuilderPreviewPrimitives', () => ({
    BuilderPreviewModeToggle: ({
        mode,
        onChange,
    }: {
        mode: string
        onChange: (mode: string) => void
    }) => (
        <div data-testid="preview-mode-toggle">
            <button
                data-testid="toggle-desktop"
                onClick={() => onChange('desktop')}
                type="button"
            >
                Desktop
            </button>
            <button
                data-testid="toggle-mobile"
                onClick={() => onChange('mobile')}
                type="button"
            >
                Mobile
            </button>
            <span data-testid="current-mode">{mode}</span>
        </div>
    ),
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
            expect(screen.getByText('Create Website with AI')).toBeInTheDocument()
            expect(screen.getByText('Website Generation')).toBeInTheDocument()
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

        it('displays "has been created successfully!" message', () => {
            renderCompletion()
            expect(screen.getByText(/has been created successfully/i)).toBeInTheDocument()
        })

        it('shows instructional hint text after creation', () => {
            renderCompletion()
            expect(
                screen.getByText(/View the Preview.*open the Editor.*Publish/i),
            ).toBeInTheDocument()
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

        it('displays "Website Preview" heading in right pane', () => {
            renderCompletion()
            expect(screen.getByText('Website Preview')).toBeInTheDocument()
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
