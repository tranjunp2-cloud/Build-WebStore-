import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BlockActionBar } from '@/components/editor/BlockActionBar'

describe('[TC-EDIT-06..09] BlockActionBar — Light/Dark Theme & Drag (GH-1367)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // TC-EDIT-06: Toolbar is a consistent dark pill in both themes + remap opt-out marker
    it('TC-EDIT-06 (GH-1367): toolbar uses a consistent dark pill surface + opt-out marker', () => {
        // Arrange
        const mockHandlers = {
            onMoveUp: vi.fn(),
            onMoveDown: vi.fn(),
            onDuplicate: vi.fn(),
            onAIEdit: vi.fn(),
            onDelete: vi.fn(),
            onDragStart: vi.fn(),
        }

        // Act
        const { container } = render(
            <BlockActionBar
                blockIndex={0}
                blockType="hero"
                blockName="Hero Section"
                totalBlocks={5}
                isMobile={false}
                position={{ top: 100, left: 200, width: 400 }}
                {...mockHandlers}
            />
        )

        // Assert
        const toolbar = container.querySelector('.block-action-toolbar')
        expect(toolbar).toBeInTheDocument()
        // Single dark pill in both themes so it stays visible over any website background
        expect(toolbar?.className).toContain('bg-[#334155]/98')
        // Marker class is load-bearing: the globals.css `.block-action-toolbar` rules keep the
        // light-mode pill's icons light to match dark (GH-1367); jsdom can't see CSS.
        expect(toolbar?.className).toContain('block-action-toolbar')
    })

    // TC-EDIT-07: Icon base classes preserved (dark mode uses them directly; light mode is
    // recolored via the globals.css opt-out keyed off these same classes)
    it('TC-EDIT-07 (GH-1367): icon base classes preserved (teal-300 Ask AI, red-400 delete)', () => {
        // Arrange
        const mockHandlers = {
            onMoveUp: vi.fn(),
            onMoveDown: vi.fn(),
            onDuplicate: vi.fn(),
            onAIEdit: vi.fn(),
            onDelete: vi.fn(),
            onDragStart: vi.fn(),
        }

        // Act
        const { container } = render(
            <BlockActionBar
                blockIndex={1}
                blockType="features"
                blockName="Features"
                totalBlocks={5}
                isMobile={false}
                position={{ top: 150, left: 250, width: 400 }}
                {...mockHandlers}
            />
        )

        // Assert — single dark pill surface drives both modes (no theme-specific bg)
        const toolbar = container.querySelector('.block-action-toolbar')
        expect(toolbar?.className).toContain('bg-[#334155]/98')

        // Assert — Ask AI icon color: text-teal-300 (light mode keeps it via the toolbar opt-out)
        const aiButton = screen.getByTitle('Ask AI')
        expect(aiButton.querySelector('svg')).toHaveClass('text-teal-300')

        // Assert — Delete icon color: text-red-400
        // (delete button has no title attr — it uses a Tooltip — so query the icon by class)
        const deleteIcon = container.querySelector('svg.text-red-400')
        expect(deleteIcon).toBeInTheDocument()
    })

    // TC-AIWB-61: no assistant on this deployment → no Ask AI button on the section bar
    it('TC-AIWB-61: without onAIEdit (assistant off) the bar has no Ask AI button', () => {
        render(
            <BlockActionBar
                blockIndex={1}
                blockType="features"
                blockName="Features"
                totalBlocks={5}
                position={{ top: 150, left: 250, width: 400 }}
                onMoveUp={vi.fn()}
                onMoveDown={vi.fn()}
                onDuplicate={vi.fn()}
                onDelete={vi.fn()}
            />
        )

        expect(screen.queryByTitle('Ask AI')).toBeNull()
    })

    // TC-EDIT-08: Hover button class present (hover:bg-white/10)
    it('TC-EDIT-08 (GH-1367): action buttons include hover:bg-white/10 class', () => {
        // Arrange
        const mockHandlers = {
            onMoveUp: vi.fn(),
            onMoveDown: vi.fn(),
            onDuplicate: vi.fn(),
            onAIEdit: vi.fn(),
            onDelete: vi.fn(),
            onDragStart: vi.fn(),
        }

        // Act
        const { container } = render(
            <BlockActionBar
                blockIndex={2}
                blockType="pricing"
                blockName="Pricing"
                totalBlocks={5}
                isMobile={false}
                position={{ top: 200, left: 300, width: 400 }}
                {...mockHandlers}
            />
        )

        // Assert — ACTION_BTN const includes hover:bg-white/10
        const actionButtons = container.querySelectorAll(
            'button[class*="hover:bg-white/10"]'
        )
        expect(actionButtons.length).toBeGreaterThan(0)
    })

    // TC-EDIT-09: Drag grip button present + onDragStart fires on pointerDown
    it('TC-EDIT-09 (GH-1367): drag grip button renders + onDragStart fires on pointerDown', () => {
        // Arrange
        const mockDragStart = vi.fn()
        const mockHandlers = {
            onMoveUp: vi.fn(),
            onMoveDown: vi.fn(),
            onDuplicate: vi.fn(),
            onAIEdit: vi.fn(),
            onDelete: vi.fn(),
            onDragStart: mockDragStart,
        }

        // Act
        render(
            <BlockActionBar
                blockIndex={0}
                blockType="hero"
                blockName="Hero"
                totalBlocks={5}
                isMobile={false}
                position={{ top: 100, left: 200, width: 400 }}
                {...mockHandlers}
            />
        )

        // Assert — grip button is present
        const gripButton = screen.getByTitle('Drag to reorder')
        expect(gripButton).toBeInTheDocument()

        // Assert — onDragStart fires on pointerDown (fireEvent avoids jsdom's missing PointerEvent ctor)
        fireEvent.pointerDown(gripButton)
        expect(mockDragStart).toHaveBeenCalled()
    })

    // Additional: Verify grip button does NOT render on mobile
    it('TC-EDIT-09 variant: grip button hidden on mobile', () => {
        // Arrange
        const mockHandlers = {
            onMoveUp: vi.fn(),
            onMoveDown: vi.fn(),
            onDuplicate: vi.fn(),
            onAIEdit: vi.fn(),
            onDelete: vi.fn(),
            onDragStart: vi.fn(),
        }

        // Act
        render(
            <BlockActionBar
                blockIndex={0}
                blockType="hero"
                blockName="Hero"
                totalBlocks={5}
                isMobile={true}
                position={{ top: 100, left: 200, width: 400 }}
                {...mockHandlers}
            />
        )

        // Assert — grip button should NOT be present on mobile
        const gripButton = screen.queryByTitle('Drag to reorder')
        expect(gripButton).not.toBeInTheDocument()

        // Assert — move up/down buttons SHOULD be present on mobile
        expect(screen.getByTitle('Move up')).toBeInTheDocument()
        expect(screen.getByTitle('Move down')).toBeInTheDocument()
    })

    // Additional: Verify component returns null for navigation/footer blocks
    it('returns null for navigation and footer block types', () => {
        // Arrange
        const mockHandlers = {
            onMoveUp: vi.fn(),
            onMoveDown: vi.fn(),
            onDuplicate: vi.fn(),
            onAIEdit: vi.fn(),
            onDelete: vi.fn(),
            onDragStart: vi.fn(),
        }

        // Act — render navigation block
        const { container: navContainer } = render(
            <BlockActionBar
                blockIndex={0}
                blockType="navigation"
                blockName="Nav"
                totalBlocks={5}
                isMobile={false}
                position={{ top: 100, left: 200, width: 400 }}
                {...mockHandlers}
            />
        )

        // Assert — no toolbar rendered
        expect(navContainer.firstChild).toBeNull()

        // Act — render footer block
        const { container: footerContainer } = render(
            <BlockActionBar
                blockIndex={4}
                blockType="footer"
                blockName="Footer"
                totalBlocks={5}
                isMobile={false}
                position={{ top: 500, left: 200, width: 400 }}
                {...mockHandlers}
            />
        )

        // Assert — no toolbar rendered
        expect(footerContainer.firstChild).toBeNull()
    })
})
