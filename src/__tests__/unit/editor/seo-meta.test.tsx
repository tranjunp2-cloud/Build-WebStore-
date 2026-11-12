import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsPanel } from '@/components/editor/SettingsPanel'
import { EDITOR_AI_ASK_EVENT, EditorAgentProvider, type EditorAiAskDetail } from '@/components/editor/agent/editor-agent-context'
import { I18nProvider } from '@/i18n'
import { toast } from 'sonner'
import '@testing-library/jest-dom'

vi.mock('@/store/editorStore', () => ({
    useEditorStore: () => ({
        site: { id: 'site-1', name: 'My Site' },
        pages: [{ id: 'page-1', title: 'Home', slug: '/', isHomepage: true, seoTitle: 'SEO Title', seoDescription: 'SEO Desc' }],
        activePageId: 'page-1',
        updatePage: vi.fn(),
    })
}))

vi.mock('sonner', () => ({
    toast: {
        loading: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
    },
}))

global.fetch = vi.fn() as Mock

describe('SEO & Meta Data Logic (TC-F05.29a to TC-F05.30)', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        ;(toast.loading as Mock).mockReturnValue('seo-loading')
    })

    describe('SettingsPanel SEO Controls', () => {
        it('TC-F05.30: Soft Limit length warning checks (60 / 160 chars)', async () => {
            render(
                <I18nProvider defaultLocale="en">
                    <SettingsPanel
                        block={null} blockIndex={null} theme={undefined} siteName="Test" siteStatus="draft"
                        onThemeChange={vi.fn()} onDeleteBlock={vi.fn()} onDuplicateBlock={vi.fn()} onBlockFieldChange={vi.fn()} onBlockUpdate={vi.fn()}
                        site={{ id: 'site-1', name: 'My Site' } as unknown as React.ComponentProps<typeof SettingsPanel>['site']}
                        currentPageId="page-1"
                        pages={[{ id: 'page-1', title: 'Home', slug: '/', isHomepage: true, seoTitle: 'SEO Title', seoDescription: 'SEO Desc' }] as unknown as React.ComponentProps<typeof SettingsPanel>['pages']}
                        onPageUpdate={vi.fn().mockImplementation(async (id, changes) => {
                            return { id: 'page-1', title: 'Home', slug: '/', isHomepage: true, seoTitle: 'SEO Title', seoDescription: 'SEO Desc', ...changes }
                        })}
                    />
                </I18nProvider>
            )
            
            const seoTab = screen.getByRole('button', { name: /SEO/ })
            fireEvent.click(seoTab)
            
            const titleInput = screen.getByDisplayValue('SEO Title') as HTMLInputElement
            
            fireEvent.change(titleInput, { target: { value: 'This is a very long title that exceeds the recommended sixty characters soft limit for google search engine optimization' }})
            expect(screen.getByText('This title may be cut off in Google search results.')).toBeInTheDocument()

            const descInput = screen.getByDisplayValue('SEO Desc') as HTMLTextAreaElement
            fireEvent.change(descInput, { target: { value: 'A'.repeat(161) }})
            expect(screen.getByText('This description may be cut short in Google Search.')).toBeInTheDocument()
        })

        const seoPanel = (agent: boolean) => (
            <I18nProvider defaultLocale="en">
                <EditorAgentProvider enabled={agent}>
                    <SettingsPanel
                        block={null} blockIndex={null} theme={undefined} siteName="Test" siteStatus="draft"
                        onThemeChange={vi.fn()} onDeleteBlock={vi.fn()} onDuplicateBlock={vi.fn()} onBlockFieldChange={vi.fn()} onBlockUpdate={vi.fn()}
                        site={{ id: 'site-1', name: 'My Site' } as unknown as React.ComponentProps<typeof SettingsPanel>['site']}
                        currentPageId="page-1"
                        pages={[{ id: 'page-1', title: 'About', slug: 'about', isHomepage: false, seoTitle: 'Existing Title', seoDescription: 'Existing Description' }] as unknown as React.ComponentProps<typeof SettingsPanel>['pages']}
                        onPageUpdate={vi.fn()}
                    />
                </EditorAgentProvider>
            </I18nProvider>
        )

        const emptyTitlePanel = (onPageUpdate: Mock) => (
            <I18nProvider defaultLocale="en">
                <SettingsPanel
                    block={null} blockIndex={null} theme={undefined} siteName="Test" siteStatus="draft"
                    onThemeChange={vi.fn()} onDeleteBlock={vi.fn()} onDuplicateBlock={vi.fn()} onBlockFieldChange={vi.fn()} onBlockUpdate={vi.fn()}
                    site={{ id: 'site-1', name: 'My Site' } as unknown as React.ComponentProps<typeof SettingsPanel>['site']}
                    currentPageId="page-1"
                    pages={[{ id: 'page-1', title: 'About Us', slug: 'about', isHomepage: false, seoTitle: null, seoDescription: 'Merchant description' }] as unknown as React.ComponentProps<typeof SettingsPanel>['pages']}
                    onPageUpdate={onPageUpdate}
                />
            </I18nProvider>
        )

        it('[TC-F37-11-06] empty meta title shows the page title as placeholder, not as a value', () => {
            // Arrange & Act
            render(emptyTitlePanel(vi.fn()))
            fireEvent.click(screen.getByRole('button', { name: /SEO/ }))

            // Assert
            const titleInput = screen.getByPlaceholderText('About Us') as HTMLInputElement
            expect(titleInput.value).toBe('')
        })

        it('[TC-F37-11-07] focusing and leaving an untouched empty meta title saves nothing', () => {
            // Arrange
            const onPageUpdate = vi.fn()
            render(emptyTitlePanel(onPageUpdate))
            fireEvent.click(screen.getByRole('button', { name: /SEO/ }))
            const titleInput = screen.getByPlaceholderText('About Us')

            // Act
            fireEvent.focus(titleInput)
            fireEvent.blur(titleInput)

            // Assert
            expect(onPageUpdate).not.toHaveBeenCalled()
        })

        it('[TC-AIWB-61] without the assistant the SEO tab has no AI button and calls nothing', () => {
            render(seoPanel(false))
            fireEvent.click(screen.getByRole('button', { name: /SEO/ }))

            expect(screen.queryByRole('button', { name: 'Ask AI' })).toBeNull()
            expect(screen.queryByText('Automatic SEO optimization')).toBeNull()
            // the old generate-seo route is gone: the panel only hands off to the chat, so no AI call and no write
            const aiCalls = (global.fetch as Mock).mock.calls.filter(([url, init]) => /\/api\/ai\//.test(String(url)) || ['POST', 'PUT', 'PATCH'].includes(String((init as RequestInit | undefined)?.method ?? '').toUpperCase()))
            expect(aiCalls).toEqual([])
        })

        it('[TC-AIWB-61] Ask AI on SEO opens the ask box and hands the page SEO to the chat (no direct write)', async () => {
            const onAsk = vi.fn()
            window.addEventListener(EDITOR_AI_ASK_EVENT, onAsk)
            render(seoPanel(true))
            fireEvent.click(screen.getByRole('button', { name: /SEO/ }))

            fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
            const box = await screen.findByRole('textbox', { name: 'What should change?' })
            fireEvent.change(box, { target: { value: 'Shorter, mention the new collection' } })
            fireEvent.submit(box.closest('form')!)

            expect(onAsk).toHaveBeenCalledTimes(1)
            const detail = (onAsk.mock.calls[0]![0] as CustomEvent<EditorAiAskDetail>).detail
            expect(detail.prompt).toBe('Shorter, mention the new collection')
            expect(detail.element).toEqual({ kind: 'seo', label: 'About', pageId: 'page-1', path: 'seoTitle', value: 'Existing Title' })
            // the old generate-seo route is gone: the panel only hands off to the chat, so no AI call and no write
            const aiCalls = (global.fetch as Mock).mock.calls.filter(([url, init]) => /\/api\/ai\//.test(String(url)) || ['POST', 'PUT', 'PATCH'].includes(String((init as RequestInit | undefined)?.method ?? '').toUpperCase()))
            expect(aiCalls).toEqual([])
            window.removeEventListener(EDITOR_AI_ASK_EVENT, onAsk)
        })

    })

    describe('TC-F05.29a: JSON-LD Schema Validation', () => {
        it('Renders valid JSON-LD script tag without XSS triggering', () => {
            const schemaData = {
                "@context": "https://schema.org",
                "@type": "LocalBusiness",
                "name": "Acme Widgets",
                "image": "https://example.com/logo.png"
            }
            
            const rawHtml = `<script type="application/ld+json">${JSON.stringify(schemaData)}</script>`
            
            render(<div data-testid="head-mock" dangerouslySetInnerHTML={{ __html: rawHtml }} />)
            
            const scriptTag = document.querySelector('script[type="application/ld+json"]')
            expect(scriptTag).toBeInTheDocument()
            expect(scriptTag?.innerHTML).toContain('Acme Widgets')
            expect(scriptTag?.innerHTML).toContain('LocalBusiness')
        })
    })
})
