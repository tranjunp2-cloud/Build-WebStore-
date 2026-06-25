import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BlockActionBar } from '@/components/editor/BlockActionBar'

describe('[TC-EDIT-06..09] BlockActionBar — Light/Dark Theme & Drag (GH-1367)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // TC-EDIT-06: Light theme toolbar uses dark background (light=dark pill)
    it('TC-EDIT-06 (GH-1367): light-mode toolbar uses dark bg-slate-900/95', () => {
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
        const toolbar = container.querySelector(
            '[class*="bg-slate-900/95"]'
        )
        expect(toolbar).toBeInTheDocument()
        expect(toolbar?.className).toContain('bg-slate-900/95')
        // Marker class is load-bearing: the globals.css `.block-action-toolbar` rules opt this
        // dark pill out of the editor-shell light-mode remap so icons/dividers stay bright (GH-1367).
        expect(toolbar?.className).toContain('block-action-toolbar')
    })

    // TC-EDIT-07: Dark mode variant is present + icon colors correct
    it('TC-EDIT-07 (GH-1367): dark mode includes var(--editor-surface-elevated) + correct icon colors', () => {
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

        // Assert — dark mode class present
        const toolbar = container.querySelector(
            '[class*="dark:bg-[var(--editor-surface-elevated)]/95"]'
        )
        expect(toolbar).toBeInTheDocument()

        // Assert — AI icon color: text-amber-300
        const aiButton = screen.getByTitle('Edit with AI')
        expect(aiButton.querySelector('svg')).toHaveClass('text-amber-300')

        // Assert — Delete icon color: text-red-400
        // (delete button has no title attr — it uses a Tooltip — so query the icon by class)
        const deleteIcon = container.querySelector('svg.text-red-400')
        expect(deleteIcon).toBeInTheDocument()
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
