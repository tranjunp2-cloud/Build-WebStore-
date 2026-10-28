/**
 * TC-AIWB-71..75 — editor copilot parity gaps (audit-261021-staging-parity-chat):
 *   71  the pin tells the copilot which language is on the canvas
 *   72  compact: with the copilot off the FAB and the bottom bar do not mention AI
 *   73  compact: while a reply is written the bottom bar says so and Stop stops it
 *   74  compact: the chat stays mounted (hidden) when the sheet closes, so a running reply keeps going
 *   75  the run store the chat publishes to is cleared when the chat goes away
 * Real: CompactEditorLayout, EditorToolsSheet, editor-agent-context. Faked: i18n strings, heavy panels.
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContextPinSchema } from '@ech/agent-core'
import { CompactEditorLayout, type CompactEditorLayoutProps } from '@/components/editor/CompactEditorLayout'
import { EditorToolsSheet, type EditorToolsSheetProps } from '@/components/editor/EditorToolsSheet'
import { EditorAgentProvider, editorPin, useEditorAgentRun } from '@/components/editor/agent/editor-agent-context'

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            editor: {
                compactLayout: {
                    busy: 'Updating your design…',
                    openAIChat: 'Open AI Chat',
                    openChatAndTools: 'Open AI Chat & Tools',
                    openTools: 'Open Tools',
                    aiEditing: 'AI is editing…',
                    stopAI: 'Stop AI',
                    stopFailed: 'Could not stop the AI.',
                    moveUp: 'Move Up',
                    moveDown: 'Move Down',
                    deleteBlock: 'Delete Block',
                    deletedBlock: 'Deleted {type}',
                },
                sidebar: { aiChat: 'AI Chat', components: 'Components', pages: 'Pages', settings: 'Settings' },
                advisoryBanner: { title: 't', description: 'd', copyLink: 'c', dismiss: 'x' },
                aiChat: { undo: 'Undo' },
            },
        },
        ti: (key: string) => key,
        locale: 'en',
    }),
}))

vi.mock('@/store/editorStore', () => ({
    useEditorStore: Object.assign(
        vi.fn((fn: (s: unknown) => unknown) => fn({ blocks: [], headerBlock: null, footerBlock: null, canUndo: () => false, undo: vi.fn() })),
        { getState: () => ({ undo: vi.fn() }) },
    ),
}))
vi.mock('@/blocks/registry', () => ({ blockRegistry: { getBlockMeta: (type: string) => ({ name: type }) } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/editor/PreviewFrame', () => ({ PreviewFrame: () => <div data-testid="preview-frame" /> }))
vi.mock('@/components/editor/SettingsPanel', () => ({ SettingsPanel: () => <div data-testid="settings-panel" /> }))
vi.mock('@/components/editor/BlockLibraryPanel', () => ({ BlockLibraryPanel: () => <div data-testid="components-panel" /> }))
vi.mock('@/components/editor/PageManagerPanel', () => ({ PageManagerPanel: () => <div data-testid="pages-panel" /> }))
vi.mock('@/components/editor/agent/ChangeWalker', () => ({ ChangeWalker: () => null }))

const chatMounts = vi.hoisted(() => ({ count: 0 }))
vi.mock('@/components/editor/agent/EditorAiChatSlot', () => ({
    EditorAiChatSlot: () => {
        useEffect(() => {
            chatMounts.count += 1
        }, [])
        return <div data-testid="chat-slot" />
    },
}))

const noop = vi.fn()

function layoutProps(overrides: Partial<CompactEditorLayoutProps> = {}): CompactEditorLayoutProps {
    return {
        previewFrameProps: { blocks: [], headerBlock: null, footerBlock: null, currentPageSlug: 'home', theme: {} } as unknown as CompactEditorLayoutProps['previewFrameProps'],
        onBlockSelect: noop,
        totalBlocks: 0,
        onReorderBlock: noop,
        onDeleteBlockConfirmed: noop,
        isMobileSettingsOpen: false,
        onCloseMobileSettings: noop,
        currentBlock: null,
        selectedBlock: null,
        theme: {} as CompactEditorLayoutProps['theme'],
        site: null,
        siteName: 'Shop',
        isContactSavePending: false,
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
        busy: false,
        onCopyLink: noop,
        ...overrides,
    }
}

const layout = (agentOn: boolean, overrides?: Partial<CompactEditorLayoutProps>) => (
    <EditorAgentProvider enabled={agentOn}>
        <CompactEditorLayout {...layoutProps(overrides)} />
    </EditorAgentProvider>
)

beforeEach(() => {
    noop.mockClear()
    chatMounts.count = 0
    useEditorAgentRun.getState().set(false, undefined)
})
afterEach(() => useEditorAgentRun.getState().set(false, undefined))

describe('editorPin carries the language on the canvas [TC-AIWB-71]', () => {
    it('adds editingLanguage and still passes the pin schema', () => {
        const pin = editorPin({ siteId: '7', pageId: '42', language: 'ms' })

        expect(ContextPinSchema.safeParse(pin).success).toBe(true)
        expect(pin.filters).toEqual({ site: '7', editingLanguage: 'ms' })
    })

    it('leaves it out without a language', () => {
        expect(editorPin({ siteId: '7', pageId: '42' }).filters).toEqual({ site: '7' })
    })
})

describe('compact entry points with the copilot off [TC-AIWB-72]', () => {
    it('the empty-page button and the bottom bar say Tools, and the button opens Components', () => {
        render(layout(false))

        const fab = document.querySelector('button[aria-label="Open Tools"]') as HTMLElement
        expect(fab).not.toBeNull()
        expect(screen.getByTestId('editor-tools-trigger')).toHaveTextContent('Open Tools')
        expect(document.body.textContent).not.toMatch(/\bAI\b/)
        fireEvent.click(fab)
        expect(noop).toHaveBeenCalledWith('components')
    })

    it('keeps the AI wording and the chat tab when the copilot is on', () => {
        render(layout(true))

        expect(screen.getByTestId('editor-tools-trigger')).toHaveTextContent('Open AI Chat & Tools')
        fireEvent.click(screen.getByLabelText('Open AI Chat'))
        expect(noop).toHaveBeenCalledWith('chat')
    })
})

describe('compact bottom bar while the copilot writes a reply [TC-AIWB-73]', () => {
    it('shows "AI is editing" with a Stop that stops the run and does not open the sheet', async () => {
        const stop = vi.fn().mockResolvedValue(undefined)
        render(layout(true, { totalBlocks: 1 }))
        act(() => useEditorAgentRun.getState().set(true, stop))

        expect(screen.getByTestId('editor-tools-trigger')).toHaveTextContent('AI is editing…')
        expect(screen.getByTestId('editor-ai-editing')).toBeInTheDocument()
        await act(async () => {
            fireEvent.click(screen.getByTestId('editor-ai-stop'))
        })
        expect(stop).toHaveBeenCalledTimes(1)
        expect(noop).not.toHaveBeenCalled()
    })

    it('shows no Stop when the backend can not stop runs, and nothing when idle or off', () => {
        render(layout(true, { totalBlocks: 1 }))
        act(() => useEditorAgentRun.getState().set(true, undefined))
        expect(screen.queryByTestId('editor-ai-stop')).not.toBeInTheDocument()

        act(() => useEditorAgentRun.getState().set(false, undefined))
        expect(screen.queryByText('AI is editing…')).not.toBeInTheDocument()
    })

    it('ignores a run published while the copilot is off', () => {
        render(layout(false, { totalBlocks: 1 }))
        act(() => useEditorAgentRun.getState().set(true, vi.fn()))

        expect(screen.queryByTestId('editor-ai-stop')).not.toBeInTheDocument()
        expect(screen.getByTestId('editor-tools-trigger')).toHaveTextContent('Open Tools')
    })
})

describe('the chat outlives the sheet [TC-AIWB-74]', () => {
    const sheet = (agentOn: boolean, props: Partial<EditorToolsSheetProps>) => (
        <EditorAgentProvider enabled={agentOn}>
            <EditorToolsSheet open activeTab="chat" onTabChange={noop} onClose={noop} panelProps={{ chat: { siteId: '7' }, components: {}, pages: {}, settings: {} } as unknown as EditorToolsSheetProps['panelProps']} {...props} />
        </EditorAgentProvider>
    )

    it('keeps one chat instance mounted (hidden) across close and another tab', () => {
        const { rerender, container } = render(sheet(true, {}))
        expect(chatMounts.count).toBe(1)

        rerender(sheet(true, { open: false }))
        expect(screen.getByTestId('chat-slot')).toBeInTheDocument()
        expect(container.firstElementChild).toHaveClass('hidden')

        rerender(sheet(true, { open: true, activeTab: 'components' }))
        expect(screen.getByTestId('components-panel')).toBeInTheDocument()
        expect(screen.getByTestId('chat-slot').parentElement).toHaveClass('hidden')

        rerender(sheet(true, { open: true, activeTab: 'chat' }))
        expect(screen.getByTestId('chat-slot').parentElement).not.toHaveClass('hidden')
        expect(chatMounts.count).toBe(1)
    })

    it('renders nothing while closed if the chat was never opened or the copilot is off', () => {
        const never = render(sheet(true, { open: false }))
        expect(never.container).toBeEmptyDOMElement()
        never.unmount()

        const off = render(sheet(false, { open: false, activeTab: 'components' }))
        expect(off.container).toBeEmptyDOMElement()
    })
})

describe('the run store [TC-AIWB-75]', () => {
    it('publishes busy and stop, and a reset clears both', () => {
        const stop = vi.fn()
        useEditorAgentRun.getState().set(true, stop)
        expect(useEditorAgentRun.getState()).toMatchObject({ busy: true, stop })

        useEditorAgentRun.getState().set(false, undefined)
        expect(useEditorAgentRun.getState()).toMatchObject({ busy: false, stop: undefined })
    })
})
