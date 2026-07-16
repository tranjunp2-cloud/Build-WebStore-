/**
 * Unit Tests: CompactEditorLayout — nav/footer/breadcrumb mobile menu routing
 * TC-IDs: TC-GH1557-07-01, TC-GH1557-07-02, TC-GH1557-07-03, TC-GH1557-06-02
 * Convention: docs/TEST_CONVENTION.md
 *
 * GH-1557 Bug 7: tapping the navigation or footer block on mobile silently opened an
 * empty/broken sheet because `currentBlock` resolves to null for nav/footer/breadcrumb
 * (they aren't in `blocks` or `globalBlocks`, unlike cartWidget/whatsapp-button/social).
 * Fixed by deriving `navFooterMenuMode` from `settingsRequestedTab` alone so the sheet
 * still mounts and shows the Menu tab, without needing a non-null `currentBlock`.
 *
 * TC-GH1557-06-02 (phase 06 regression sweep): confirms phase 02's scroll-lock still
 * activates for phase 03's nav/footer sheet-opening path — the scroll-lock effect keys
 * on `isMobileSettingsOpen`/`toolsSheetOpen` alone, not on `currentBlock`/`navFooterMenuMode`,
 * so the two phases can't race, but this locks that in against future refactors.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('TC-GH1557-07-01: nav/footer/breadcrumb tap opens the Menu tab despite no currentBlock', () => {
    it('renders the sheet with SettingsPanel and a Footer label when settingsRequestedTab targets the footer section', () => {
        render(
            <CompactEditorLayout
                {...baseProps({
                    isMobileSettingsOpen: true,
                    currentBlock: null,
                    settingsRequestedTab: { tab: 'menu', key: 1, section: 'footer' },
                })}
            />
        )

        expect(screen.getByTestId('settings-panel')).toBeInTheDocument()
        expect(screen.getByText('Footer')).toBeInTheDocument()
    })

    it('shows a Navigation label when settingsRequestedTab has no section (nav has none)', () => {
        render(
            <CompactEditorLayout
                {...baseProps({
                    isMobileSettingsOpen: true,
                    currentBlock: null,
                    settingsRequestedTab: { tab: 'menu', key: 1 },
                })}
            />
        )

        expect(screen.getByTestId('settings-panel')).toBeInTheDocument()
        expect(screen.getByText('Navigation')).toBeInTheDocument()
    })

    it('hides the move up/down and delete controls in nav/footer menu mode (no real block to reorder/delete)', () => {
        render(
            <CompactEditorLayout
                {...baseProps({
                    isMobileSettingsOpen: true,
                    currentBlock: null,
                    settingsRequestedTab: { tab: 'menu', key: 1, section: 'breadcrumb' },
                })}
            />
        )

        expect(screen.queryByText('Move Up')).not.toBeInTheDocument()
        expect(screen.queryByText('Delete Block')).not.toBeInTheDocument()
    })
})

describe('TC-GH1557-07-02: regular block tap still opens the generic block-settings sheet (no regression)', () => {
    it('renders the sheet with the block label and move/delete controls for a normal page block', () => {
        render(
            <CompactEditorLayout
                {...baseProps({
                    isMobileSettingsOpen: true,
                    currentBlock: { blockType: 'hero', headline: 'Hero' } as never,
                    selectedBlock: 0,
                    settingsRequestedTab: null,
                })}
            />
        )

        expect(screen.getByTestId('settings-panel')).toBeInTheDocument()
        expect(screen.getByText('hero')).toBeInTheDocument()
        expect(screen.getByText('Delete Block')).toBeInTheDocument()
    })
})

describe('TC-GH1557-07-03: no block and no menu request keeps the sheet closed (baseline unaffected)', () => {
    it('does not render the sheet when currentBlock is null and settingsRequestedTab is null', () => {
        render(
            <CompactEditorLayout
                {...baseProps({
                    isMobileSettingsOpen: true,
                    currentBlock: null,
                    settingsRequestedTab: null,
                })}
            />
        )

        expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument()
    })
})

describe('TC-GH1557-06-02: scroll-lock (phase 02) still activates for the nav/footer menu sheet (phase 03)', () => {
    it('locks document.body.style.overflow when opening via navFooterMenuMode, restores on close', () => {
        const { rerender, unmount } = render(
            <CompactEditorLayout
                {...baseProps({ isMobileSettingsOpen: false, currentBlock: null, settingsRequestedTab: null })}
            />
        )
        expect(document.body.style.overflow).toBe('')

        rerender(
            <CompactEditorLayout
                {...baseProps({
                    isMobileSettingsOpen: true,
                    currentBlock: null,
                    settingsRequestedTab: { tab: 'menu', key: 1, section: 'footer' },
                })}
            />
        )
        expect(document.body.style.overflow).toBe('hidden')

        rerender(
            <CompactEditorLayout
                {...baseProps({ isMobileSettingsOpen: false, currentBlock: null, settingsRequestedTab: null })}
            />
        )
        expect(document.body.style.overflow).toBe('')

        unmount()
    })
})
