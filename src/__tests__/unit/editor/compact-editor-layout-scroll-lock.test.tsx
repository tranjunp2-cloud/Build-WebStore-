/**
 * Unit Tests: CompactEditorLayout — background scroll lock while a mobile sheet is open
 * TC-IDs: TC-GH1557-04-01, TC-GH1557-04-02
 * Convention: docs/TEST_CONVENTION.md
 *
 * GH-1557 Bug 4: neither the block-settings sheet (isMobileSettingsOpen) nor the 4-tab
 * Tools sheet (toolsSheetOpen) locked background canvas scroll while open. Fixed with a
 * single effect keyed on (isMobileSettingsOpen || toolsSheetOpen) — not one effect per
 * sheet, since page.tsx already enforces the two are mutually exclusive (opening one
 * always closes the other) and two independent effects toggling the same
 * document.body.style.overflow could still race across an open-A→open-B transition.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { CompactEditorLayout, type CompactEditorLayoutProps } from '@/components/editor/CompactEditorLayout'

// ── Mocks (top-level, before imports) ──────────────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            editor: {
                compactLayout: {
                    moveUp: 'Move Up',
                    moveDown: 'Move Down',
                    deleteBlock: 'Delete Block',
                    deletedBlock: 'Deleted {type}',
                    aiEditing: 'AI is editing...',
                    openChatAndTools: 'Chat & Tools',
                    openAIChat: 'Open AI Chat',
                },
                advisoryBanner: {
                    title: 'Better on Desktop',
                    description: 'This editor works best on desktop.',
                    copyLink: 'Copy Link',
                    dismiss: 'Dismiss banner',
                },
                aiChat: { stopAI: 'Stop AI', undo: 'Undo' },
            },
        },
        ti: (key: string) => key,
        locale: 'en',
    }),
}))

vi.mock('@/store/editorStore', () => ({
    useEditorStore: vi.fn((fn) => {
        const state = {
            blocks: [{ blockType: 'hero', headline: 'Hero' }],
            headerBlock: null,
            footerBlock: null,
            canUndo: () => true,
            undo: vi.fn(),
            getDisplayBlocks: () => [],
            getDisplayBlock: (block: unknown) => block,
        }
        return typeof fn === 'function' ? fn(state) : state
    }),
}))

vi.mock('@/blocks/registry', () => ({
    blockRegistry: { getBlockMeta: (type: string) => ({ name: type }) },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

vi.mock('@/components/editor/PreviewFrame', () => ({
    PreviewFrame: () => <div data-testid="preview-frame">Preview</div>,
}))

vi.mock('@/components/editor/SettingsPanel', () => ({
    SettingsPanel: () => <div data-testid="settings-panel">Settings</div>,
}))

// EditorToolsSheet reads its own i18n slice (t.editor.sidebar.*) unrelated to this
// suite's scroll-lock assertion — stub it like PreviewFrame/SettingsPanel above.
vi.mock('@/components/editor/EditorToolsSheet', () => ({
    EditorToolsSheet: ({ open }: { open: boolean }) => (open ? <div data-testid="tools-sheet">Tools</div> : null),
}))

// ── Helpers ──────────────────────────────────────────────────────────────
const noop = vi.fn()

function baseProps(overrides: Partial<CompactEditorLayoutProps>): CompactEditorLayoutProps {
    return {
        previewFrameProps: {
            blocks: [],
            headerBlock: null,
            footerBlock: null,
            currentPageSlug: 'home',
            theme: { primaryColor: '#000000' },
        } as CompactEditorLayoutProps['previewFrameProps'],
        onBlockSelect: noop,
        totalBlocks: 1,
        onReorderBlock: noop,
        onDeleteBlockConfirmed: noop,
        isMobileSettingsOpen: false,
        onCloseMobileSettings: noop,
        currentBlock: null,
        selectedBlock: null,
        theme: { primaryColor: '#000000' } as CompactEditorLayoutProps['theme'],
        site: null,
        siteName: 'Test Site',
        headerBlock: null,
        footerBlock: null,
        pages: [],
        currentPageId: 'home',
        siteLocale: 'en' as CompactEditorLayoutProps['siteLocale'],
        primaryLocale: 'en',
        secondaryLocale: null,
        pendingLocale: null,
        settingsRequestedTab: null,
        onNavLanguageSwitcherChange: noop,
        onAddLanguage: noop,
        onRemoveLanguage: noop,
        onMakePrimary: noop,
        onThemeChange: noop,
        onBlockFieldChange: noop,
        onBlockUpdate: noop,
        onHeaderUpdate: noop,
        onFooterUpdate: noop,
        onSiteSettingsChange: noop,
        onPageUpdate: noop,
        toolsSheetOpen: false,
        toolsSheetTab: 'chat',
        onOpenTools: noop,
        onCloseTools: noop,
        onToolsTabChange: noop,
        toolsPanelProps: {} as CompactEditorLayoutProps['toolsPanelProps'],
        aiRunning: false,
        onStopAI: noop,
        onCopyLink: noop,
        ...overrides,
    }
}

describe('TC-GH1557-04-01: block-settings sheet locks and unlocks background scroll', () => {
    beforeEach(() => {
        document.body.style.overflow = ''
    })

    it('sets document.body.style.overflow to hidden while open, restores on close', () => {
        const { rerender, unmount } = render(
            <CompactEditorLayout {...baseProps({ isMobileSettingsOpen: false, currentBlock: null })} />
        )
        expect(document.body.style.overflow).toBe('')

        rerender(
            <CompactEditorLayout
                {...baseProps({ isMobileSettingsOpen: true, currentBlock: { blockType: 'hero', headline: 'Hero' } as never })}
            />
        )
        expect(document.body.style.overflow).toBe('hidden')

        rerender(
            <CompactEditorLayout {...baseProps({ isMobileSettingsOpen: false, currentBlock: null })} />
        )
        expect(document.body.style.overflow).toBe('')

        unmount()
    })
})

describe('TC-GH1557-04-02: Tools sheet locks background scroll independently of the block-settings sheet', () => {
    beforeEach(() => {
        document.body.style.overflow = ''
    })

    it('sets document.body.style.overflow to hidden while toolsSheetOpen is true, restores on close', () => {
        const { rerender, unmount } = render(
            <CompactEditorLayout {...baseProps({ toolsSheetOpen: false })} />
        )
        expect(document.body.style.overflow).toBe('')

        rerender(<CompactEditorLayout {...baseProps({ toolsSheetOpen: true })} />)
        expect(document.body.style.overflow).toBe('hidden')

        rerender(<CompactEditorLayout {...baseProps({ toolsSheetOpen: false })} />)
        expect(document.body.style.overflow).toBe('')

        unmount()
    })

    it('stays locked across an open-A→open-B transition (both sheets never truly overlap, per page.tsx XOR)', () => {
        const { rerender, unmount } = render(
            <CompactEditorLayout
                {...baseProps({ isMobileSettingsOpen: true, currentBlock: { blockType: 'hero', headline: 'Hero' } as never, toolsSheetOpen: false })}
            />
        )
        expect(document.body.style.overflow).toBe('hidden')

        // page.tsx's handlers always flip both flags together (open Tools → close block sheet)
        rerender(
            <CompactEditorLayout
                {...baseProps({ isMobileSettingsOpen: false, currentBlock: null, toolsSheetOpen: true })}
            />
        )
        expect(document.body.style.overflow).toBe('hidden')

        unmount()
    })
})
