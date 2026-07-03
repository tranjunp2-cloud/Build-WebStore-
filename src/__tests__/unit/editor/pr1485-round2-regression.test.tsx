/**
 * PR #1485 Round 2 — Regression Tests: Global Widget Block Deletion/Move Guards
 *
 * Coverage Map (QA Doc Traceability):
 *   TC-F05-15-01 → CompactEditorLayout: Global widget (negative selectedBlock) cannot be moved up
 *   TC-F05-15-02 → CompactEditorLayout: Global widget (negative selectedBlock) cannot be moved down
 *   TC-F05-15-03 → CompactEditorLayout: Normal blocks (positive index) can still be moved up/down
 *   TC-F05-15-04 → CompactEditorLayout: Global widget cannot be deleted (button hidden + guard in handler)
 *
 * N1 Root Cause (PR #1485 review fix):
 *   Floating global widgets (cartWidget/whatsapp-button/social) use negative indices
 *   (-1, -2, -3). The block-settings sheet's move/delete controls didn't guard against this:
 *   - canMoveDown was `true` for any negative index (since -1 < totalBlocks-1)
 *   - Tapping "Move Down" called `reorderBlocks(-1, 0)` → Array.splice(-1, 1) which removes
 *     the LAST real block (often the footer!) and reorders it to index 0, auto-saved to DB
 *   - "Delete Block" called `deleteBlock(-1)` which silently no-ops but still showed a fake
 *     "Deleted" success toast
 *
 * Fix Applied:
 *   1. `isGlobalWidget = selectedBlock !== null && selectedBlock < 0`
 *   2. Move-bar (up/down buttons) entirely hidden when `isGlobalWidget`
 *   3. Delete-bar entirely hidden when `isGlobalWidget`
 *   4. `canMoveDown` now requires `selectedBlock >= 0` (defense-in-depth)
 *   5. `handleConfirmDelete` guards `selectedBlock < 0` too (defense-in-depth)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { CompactEditorLayout, type CompactEditorLayoutProps } from '@/components/editor/CompactEditorLayout'

// ── Mock i18n ─────────────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            editor: {
                compactLayout: {
                    moveUp: 'Move Up',
                    moveDown: 'Move Down',
                    deleteBlock: 'Delete Block',
                    openChatAndTools: 'Open Chat & Tools',
                    openAIChat: 'Open AI Chat',
                    aiEditing: 'AI is editing…',
                    deletedBlock: 'Deleted {type}',
                },
                aiChat: {
                    undo: 'Undo',
                },
                advisoryBanner: {
                    title: 'Better on Desktop',
                    description: 'This editor works best on desktop',
                    copyLink: 'Copy Link',
                    dismiss: 'Dismiss',
                },
            },
        },
        ti: (key: string, vars?: Record<string, unknown>) => {
            if (key === 'editor.compactLayout.deletedBlock' && vars?.type) {
                return `Deleted ${vars.type}`
            }
            return key
        },
        locale: 'en',
    }),
}))

// ── Mock blocks registry ──────────────────────────────────────────────────────
vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getBlockMeta: (type: string) => ({
            name: type.replace(/-/g, ' '),
            icon: 'icon',
        }),
    },
}))

// ── Mock editorStore ──────────────────────────────────────────────────────────
vi.mock('@/store/editorStore', () => ({
    useEditorStore: {
        getState: () => ({
            undo: vi.fn(),
        }),
    },
}))

// ── Mock sonner toast ─────────────────────────────────────────────────────────
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
    },
}))

// ── Mock PreviewFrame ─────────────────────────────────────────────────────────
vi.mock('@/components/editor/PreviewFrame', () => ({
    PreviewFrame: () => <div data-testid="preview-frame">Preview</div>,
}))

// ── Mock SettingsPanel ────────────────────────────────────────────────────────
vi.mock('@/components/editor/SettingsPanel', () => ({
    SettingsPanel: () => <div data-testid="settings-panel">Settings</div>,
}))

// ── Mock DeleteBlockConfirm ───────────────────────────────────────────────────
vi.mock('@/components/editor/DeleteBlockConfirm', () => ({
    DeleteBlockConfirm: ({ open, onConfirm }: any) =>
        open ? (
            <div data-testid="delete-confirm">
                <button onClick={onConfirm} data-testid="confirm-delete">Confirm Delete</button>
            </div>
        ) : null,
}))

// ── Mock EditorAdvisoryBanner ─────────────────────────────────────────────────
vi.mock('@/components/editor/EditorAdvisoryBanner', () => ({
    EditorAdvisoryBanner: () => <div data-testid="advisory-banner">Advisory Banner</div>,
}))

// ── Mock EditorToolsSheet ─────────────────────────────────────────────────────
vi.mock('@/components/editor/EditorToolsSheet', () => ({
    EditorToolsSheet: () => <div data-testid="tools-sheet">Tools Sheet</div>,
}))

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: PR #1485 Round 2 — Global Widget Blocking
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-F05-15 — CompactEditorLayout: Global Widget Block Deletion/Move Guards (PR #1485 N1)', () => {
    let mockHandlers: Partial<CompactEditorLayoutProps>

    beforeEach(() => {
        vi.clearAllMocks()
        mockHandlers = {
            previewFrameProps: {
                blocks: [
                    { blockType: 'hero', id: 'block-0' },
                    { blockType: 'features', id: 'block-1' },
                    { blockType: 'footer', id: 'block-2' },
                ],
                onImageUpload: vi.fn(),
                onImageRemove: vi.fn(),
            },
            onBlockSelect: vi.fn(),
            totalBlocks: 3,
            onReorderBlock: vi.fn(),
            onDeleteBlockConfirmed: vi.fn(),
            isMobileSettingsOpen: true,
            onCloseMobileSettings: vi.fn(),
            currentBlock: { blockType: 'hero', id: 'block-0' } as any,
            selectedBlock: 0,
            theme: {} as any,
            site: null,
            siteName: 'Test Site',
            headerBlock: null,
            footerBlock: null,
            pages: [],
            currentPageId: null,
            siteLocale: 'en' as any,
            primaryLocale: 'en',
            secondaryLocale: null,
            pendingLocale: null,
            settingsRequestedTab: null,
            onNavLanguageSwitcherChange: vi.fn(),
            onAddLanguage: vi.fn(),
            onRemoveLanguage: vi.fn(),
            onMakePrimary: vi.fn(),
            onThemeChange: vi.fn(),
            onBlockFieldChange: vi.fn(),
            onBlockUpdate: vi.fn(),
            onHeaderUpdate: vi.fn(),
            onFooterUpdate: vi.fn(),
            onSiteSettingsChange: vi.fn(),
            onPageUpdate: vi.fn(),
            toolsSheetOpen: false,
            toolsSheetTab: 'components' as any,
            onOpenTools: vi.fn(),
            onCloseTools: vi.fn(),
            onToolsTabChange: vi.fn(),
            toolsPanelProps: {} as any,
            aiRunning: false,
            onStopAI: vi.fn(),
            onCopyLink: vi.fn(),
        }
    })

    // TC-F05-15-01: Global widget (selectedBlock = -1) → Move Up button hidden
    it('TC-F05-15-01: Global widget (selectedBlock < 0) → Move Up button is not rendered', () => {
        // Arrange
        const handlers = {
            ...mockHandlers,
            selectedBlock: -1,
            currentBlock: { blockType: 'cart-widget', id: 'global-cart' } as any,
        }

        // Act
        const { container } = render(<CompactEditorLayout {...(handlers as CompactEditorLayoutProps)} />)

        // Assert — Move Up/Down bar should NOT be rendered at all when selectedBlock < 0
        const moveBar = container.querySelector('[class*="mv-bar"]')
        // The move bar is wrapped in a conditional {!isGlobalWidget && ...}, so it won't appear
        // We can check that there are NO move buttons visible in the sheet
        const moveUpButton = screen.queryByText('Move Up')
        const moveDownButton = screen.queryByText('Move Down')

        expect(moveUpButton).not.toBeInTheDocument()
        expect(moveDownButton).not.toBeInTheDocument()
    })

    // TC-F05-15-02: Global widget (selectedBlock = -1) → Move Down button hidden
    it('TC-F05-15-02: Global widget (selectedBlock < 0) → Move Down button is not rendered', () => {
        // Arrange
        const handlers = {
            ...mockHandlers,
            selectedBlock: -2,
            currentBlock: { blockType: 'whatsapp-button', id: 'global-whatsapp' } as any,
        }

        // Act
        const { container } = render(<CompactEditorLayout {...(handlers as CompactEditorLayoutProps)} />)

        // Assert
        const moveUpButton = screen.queryByText('Move Up')
        const moveDownButton = screen.queryByText('Move Down')

        expect(moveUpButton).not.toBeInTheDocument()
        expect(moveDownButton).not.toBeInTheDocument()
    })

    // TC-F05-15-03: Normal block (selectedBlock = 0) → Move Up/Down buttons present + functional
    it('TC-F05-15-03: Normal block (selectedBlock >= 0) → Move Up/Down buttons are rendered and functional', () => {
        // Arrange
        const handlers = {
            ...mockHandlers,
            selectedBlock: 1, // Middle block — can move both ways
            totalBlocks: 3,
            currentBlock: { blockType: 'features', id: 'block-1' } as any,
        }

        // Act
        render(<CompactEditorLayout {...(handlers as CompactEditorLayoutProps)} />)

        // Assert — for a middle block, both Move Up and Move Down should be present and enabled
        const moveUpButton = screen.getByText('Move Up')
        const moveDownButton = screen.getByText('Move Down')

        expect(moveUpButton).toBeInTheDocument()
        expect(moveDownButton).toBeInTheDocument()
        expect(moveUpButton).not.toBeDisabled()
        expect(moveDownButton).not.toBeDisabled()

        // Act — click Move Down
        fireEvent.click(moveDownButton)

        // Assert — handler called with correct indices
        expect(handlers.onReorderBlock).toHaveBeenCalledWith(1, 2)
    })

    // TC-F05-15-04: Global widget (selectedBlock < 0) → Delete button hidden
    it('TC-F05-15-04: Global widget (selectedBlock < 0) → Delete Block button is not rendered', () => {
        // Arrange
        const handlers = {
            ...mockHandlers,
            selectedBlock: -1,
            currentBlock: { blockType: 'social-widget', id: 'global-social' } as any,
        }

        // Act
        render(<CompactEditorLayout {...(handlers as CompactEditorLayoutProps)} />)

        // Assert
        const deleteButton = screen.queryByText('Delete Block')
        expect(deleteButton).not.toBeInTheDocument()
    })

    // TC-F05-15-05: First block (index 0) → Move Up disabled, Move Down enabled
    it('TC-F05-15-05: First block (index 0) → Move Up disabled, Move Down enabled', () => {
        // Arrange
        const handlers = {
            ...mockHandlers,
            selectedBlock: 0,
            totalBlocks: 3,
            currentBlock: { blockType: 'hero', id: 'block-0' } as any,
        }

        // Act
        render(<CompactEditorLayout {...(handlers as CompactEditorLayoutProps)} />)

        // Assert
        const moveUpButton = screen.getByText('Move Up')
        const moveDownButton = screen.getByText('Move Down')

        expect(moveUpButton).toBeDisabled() // Cannot move up from index 0
        expect(moveDownButton).not.toBeDisabled() // Can move down
    })

    // TC-F05-15-06: Last block (index 2) → Move Up enabled, Move Down disabled
    it('TC-F05-15-06: Last block (totalBlocks-1) → Move Up enabled, Move Down disabled', () => {
        // Arrange
        const handlers = {
            ...mockHandlers,
            selectedBlock: 2,
            totalBlocks: 3,
            currentBlock: { blockType: 'footer', id: 'block-2' } as any,
        }

        // Act
        render(<CompactEditorLayout {...(handlers as CompactEditorLayoutProps)} />)

        // Assert
        const moveUpButton = screen.getByText('Move Up')
        const moveDownButton = screen.getByText('Move Down')

        expect(moveUpButton).not.toBeDisabled() // Can move up
        expect(moveDownButton).toBeDisabled() // Cannot move down from last index
    })

    // TC-F05-15-07: Delete button present for normal blocks
    it('TC-F05-15-07: Normal block → Delete Block button is rendered and clickable', () => {
        // Arrange
        const handlers = {
            ...mockHandlers,
            selectedBlock: 1,
            currentBlock: { blockType: 'features', id: 'block-1' } as any,
        }

        // Act
        render(<CompactEditorLayout {...(handlers as CompactEditorLayoutProps)} />)

        // Assert
        const deleteButton = screen.getByText('Delete Block')
        expect(deleteButton).toBeInTheDocument()
        expect(deleteButton).not.toBeDisabled()

        // Act — click delete button
        fireEvent.click(deleteButton)

        // Assert — confirm dialog should appear
        const confirmDeleteBtn = screen.getByTestId('confirm-delete')
        expect(confirmDeleteBtn).toBeInTheDocument()
    })

    // TC-F05-15-08: None selected (selectedBlock = null) → no move/delete buttons
    it('TC-F05-15-08: No block selected (selectedBlock = null) → no move/delete buttons', () => {
        // Arrange
        const handlers = {
            ...mockHandlers,
            selectedBlock: null,
            currentBlock: null,
            isMobileSettingsOpen: false,
        }

        // Act
        render(<CompactEditorLayout {...(handlers as CompactEditorLayoutProps)} />)

        // Assert — sheet closed when selectedBlock is null, so buttons don't render
        const moveUpButton = screen.queryByText('Move Up')
        const moveDownButton = screen.queryByText('Move Down')
        const deleteButton = screen.queryByText('Delete Block')

        expect(moveUpButton).not.toBeInTheDocument()
        expect(moveDownButton).not.toBeInTheDocument()
        expect(deleteButton).not.toBeInTheDocument()
    })
})
