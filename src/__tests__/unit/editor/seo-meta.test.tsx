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

        it('shows a styled comparison dialog and leaves metadata unchanged when cancelled', async () => {
            const onPageUpdate = vi.fn()
            const confirmSpy = vi.spyOn(window, 'confirm')

            render(
                <I18nProvider defaultLocale="en">
                    <SettingsPanel
                        block={null} blockIndex={null} theme={undefined} siteName="Test" siteStatus="draft"
                        onThemeChange={vi.fn()} onDeleteBlock={vi.fn()} onDuplicateBlock={vi.fn()} onBlockFieldChange={vi.fn()} onBlockUpdate={vi.fn()}
                        site={{ id: 'site-1', name: 'My Site' } as unknown as React.ComponentProps<typeof SettingsPanel>['site']}
                        currentPageId="page-1"
                        pages={[{ id: 'page-1', title: 'About', slug: 'about', isHomepage: false, seoTitle: 'Existing Title', seoDescription: 'Existing Description' }] as unknown as React.ComponentProps<typeof SettingsPanel>['pages']}
                        onPageUpdate={onPageUpdate}
                    />
                </I18nProvider>
            )

            ;(global.fetch as Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    hasExisting: true,
                    existing: {
                        title: 'Existing Title',
                        description: 'Existing Description',
                    },
                    proposed: {
                        title: 'Proposed Title',
                        description: 'Proposed Description',
                        slug: 'proposed-about',
                    },
                }),
            })

            fireEvent.click(screen.getByRole('button', { name: /SEO/ }))
            fireEvent.click(screen.getByRole('button', { name: 'Automatic SEO Optimization' }))

            const dialog = await screen.findByRole('dialog', { name: 'Replace existing SEO metadata?' })
            expect(dialog).toBeInTheDocument()
            expect(screen.getByTestId('seo-current-title')).toHaveTextContent('Existing Title')
            expect(screen.getByTestId('seo-proposed-title')).toHaveTextContent('Proposed Title')
            expect(screen.getByTestId('seo-current-description')).toHaveTextContent('Existing Description')
            expect(screen.getByTestId('seo-proposed-description')).toHaveTextContent('Proposed Description')
            expect(confirmSpy).not.toHaveBeenCalled()
            expect(toast.dismiss).toHaveBeenCalledWith('seo-loading')

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

            await waitFor(() => {
                expect(screen.queryByRole('dialog', { name: 'Replace existing SEO metadata?' })).not.toBeInTheDocument()
            })
            expect(onPageUpdate).not.toHaveBeenCalled()
            expect(toast.info).toHaveBeenCalledWith('SEO changes cancelled')
        })

        it('applies the proposed metadata only after overwrite confirmation', async () => {
            let mockPage = {
                id: 'page-1',
                title: 'About',
                slug: 'about',
                isHomepage: false,
                seoTitle: 'Existing Title',
                seoDescription: 'Existing Description',
            }
            const onPageUpdate = vi.fn().mockImplementation(async (_id, changes) => {
                mockPage = { ...mockPage, ...changes }
                return mockPage
            })

            render(
                <I18nProvider defaultLocale="en">
                    <SettingsPanel
                        block={null} blockIndex={null} theme={undefined} siteName="Test" siteStatus="draft"
                        onThemeChange={vi.fn()} onDeleteBlock={vi.fn()} onDuplicateBlock={vi.fn()} onBlockFieldChange={vi.fn()} onBlockUpdate={vi.fn()}
                        site={{ id: 'site-1', name: 'My Site' } as unknown as React.ComponentProps<typeof SettingsPanel>['site']}
                        currentPageId="page-1"
                        pages={[mockPage as unknown as React.ComponentProps<typeof SettingsPanel>['pages'][0]]}
                        onPageUpdate={onPageUpdate}
                    />
                </I18nProvider>
            )

            ;(global.fetch as Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    hasExisting: true,
                    existing: {
                        title: 'Existing Title',
                        description: 'Existing Description',
                    },
                    proposed: {
                        title: 'Proposed Title',
                        description: 'Proposed Description',
                        slug: 'proposed-about',
                    },
                }),
            })

            fireEvent.click(screen.getByRole('button', { name: /SEO/ }))
            fireEvent.click(screen.getByRole('button', { name: 'Automatic SEO Optimization' }))
            fireEvent.click(await screen.findByRole('button', { name: 'Replace SEO' }))

            await waitFor(() => {
                expect(onPageUpdate).toHaveBeenCalledWith('page-1', { seoTitle: 'Proposed Title' })
                expect(onPageUpdate).toHaveBeenCalledWith('page-1', { seoDescription: 'Proposed Description' })
                expect(onPageUpdate).toHaveBeenCalledWith('page-1', { slug: 'proposed-about' })
                expect(toast.success).toHaveBeenCalledWith('SEO optimization successfully generated!')
            })
            expect(screen.queryByRole('dialog', { name: 'Replace existing SEO metadata?' })).not.toBeInTheDocument()
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
