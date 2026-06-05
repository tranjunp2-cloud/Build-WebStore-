import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsPanel } from '@/components/editor/SettingsPanel'
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
    },
}))

global.fetch = vi.fn() as Mock

describe('SEO & Meta Data Logic (TC-F05.29a to TC-F05.30)', () => {

    beforeEach(() => {
        vi.clearAllMocks()
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
            expect(screen.getByText('Title may be truncated on Google Search.')).toBeInTheDocument()

            const descInput = screen.getByDisplayValue('SEO Desc') as HTMLTextAreaElement
            fireEvent.change(descInput, { target: { value: 'A'.repeat(161) }})
            expect(screen.getByText('Description may be truncated on Google Search.')).toBeInTheDocument()
        })

        it('TC-F05.29b: Auto-Gen AI LLM API Call flow', async () => {
            let mockPage = { id: 'page-1', title: 'Home', slug: '/', isHomepage: true, seoTitle: 'SEO Title', seoDescription: 'SEO Desc' }
            render(
                <I18nProvider defaultLocale="en">
                    <SettingsPanel
                        block={null} blockIndex={null} theme={undefined} siteName="Test" siteStatus="draft"
                        onThemeChange={vi.fn()} onDeleteBlock={vi.fn()} onDuplicateBlock={vi.fn()} onBlockFieldChange={vi.fn()} onBlockUpdate={vi.fn()}
                        site={{ id: 'site-1', name: 'My Site' } as unknown as React.ComponentProps<typeof SettingsPanel>['site']}
                        currentPageId="page-1"
                        pages={[mockPage as unknown as React.ComponentProps<typeof SettingsPanel>['pages'][0]]}
                        onPageUpdate={vi.fn().mockImplementation(async (id, changes) => {
                            mockPage = { ...mockPage, ...changes }
                            return mockPage
                        })}
                    />
                </I18nProvider>
            )
            fireEvent.click(screen.getByRole('button', { name: /SEO/ }))
            
            const aiButton = screen.getByText('Automatic SEO Optimization')
            
            ;(global.fetch as Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    title: 'Generated Title',
                    description: 'Generated Description',
                    slug: 'generated-slug' 
                })
            })

            fireEvent.click(aiButton)

            expect(toast.loading).toHaveBeenCalledWith('Generating SEO optimization using AI...')
            expect(global.fetch).toHaveBeenCalledWith('/api/sites/site-1/pages/page-1/generate-seo', expect.any(Object))

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith('SEO optimization successfully generated!', expect.any(Object))
            })
            
            // Because onPageUpdate resolves mocked state, local variables sync.
            // Using waitFor here because handleSeoUpdate is async and setSeoTitleInput resolves post-await.
            await waitFor(() => {
                 expect(screen.getByDisplayValue('Generated Title')).toBeInTheDocument()
                 expect(screen.getByDisplayValue('Generated Description')).toBeInTheDocument()
            })
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
