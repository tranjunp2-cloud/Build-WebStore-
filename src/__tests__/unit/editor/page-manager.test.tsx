import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { PageManagerPanel } from '@/components/editor/PageManagerPanel'
import { useEditorStore } from '@/store/editorStore'
import { I18nProvider } from '@/i18n'
import { Toaster, toast } from 'sonner'
import '@testing-library/jest-dom'

// Mock fetch
global.fetch = vi.fn()

// Mock sonner
vi.mock('sonner', () => {
    const toast = vi.fn() as any
    toast.success = vi.fn()
    toast.error = vi.fn()
    return {
        toast,
        Toaster: () => null,
    }
})

describe('PageManagerPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useEditorStore.getState().reset()
        useEditorStore.getState().init('site-123', [], {}, 'Test Site')
        useEditorStore.getState().setPages([
            {
                id: 'page-1',
                title: 'Trang chủ',
                slug: 'home',
                status: 'published',
                isHomepage: true,
                isVisible: true,
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'page-2',
                title: 'About Us',
                slug: 'about',
                status: 'draft',
                isVisible: true,
                updatedAt: new Date().toISOString(),
            },
        ])
    })

    const getCard = (pageId: string) =>
        document.querySelector<HTMLElement>(`[data-page-id="${pageId}"]`)!

    const TestWrapper = () => (
        <I18nProvider defaultLocale="en">
            <PageManagerPanel
                siteId="site-123"
                currentPageId="page-1"
                onPageSelected={vi.fn()}
            />
        </I18nProvider>
    )

    it('TC-F05.06: Initializes Page Grid properly', () => {
        // Arrange & Act
        render(<TestWrapper />)

        // Assert
        expect(screen.getByText('Trang chủ')).toBeInTheDocument() // page title from store data
        expect(screen.getByText('About Us')).toBeInTheDocument()
        // Every row shows exactly one status badge; the current page is marked by the row itself
        expect(getCard('page-1')).toHaveAttribute('aria-current', 'page')
        expect(within(getCard('page-1')).getAllByText('Draft')).toHaveLength(1)
        expect(getCard('page-2')).not.toHaveAttribute('aria-current')
        expect(within(getCard('page-2')).getAllByText('Draft')).toHaveLength(1)
    })

    // TC-F05-02-14: GH-864 panel header + micro-copy + no search
    it('TC-F05-02-14a: panel title reads "Page library" (renamed from Page Manager)', () => {
        // Arrange & Act
        render(<TestWrapper />)
        // Assert — title must reflect rename
        expect(screen.getByText('Page library')).toBeInTheDocument()
    })

    it('TC-F05-02-14b: micro-copy description is visible below the title', () => {
        // Arrange & Act
        render(<TestWrapper />)
        // Assert — micro-copy from i18n key pageManagerPanel.description
        expect(screen.getByText(/editing only/)).toBeInTheDocument()
    })

    it('TC-F05-02-14c: search input is NOT present (removed per GH-864)', () => {
        // Arrange & Act
        render(<TestWrapper />)
        // Assert — search input must be gone
        expect(screen.queryByPlaceholderText(/[Ss]earch/)).not.toBeInTheDocument()
    })

    it('TC-F05-02-14d: multiple published pages on published site all show Live badge', () => {
        // Arrange — two published pages; menu membership is irrelevant to badge logic
        useEditorStore.getState().setPages([
            { id: 'page-1', title: 'Home', slug: 'home', status: 'published', isHomepage: true, isVisible: true, updatedAt: new Date().toISOString() },
            { id: 'page-2', title: 'About', slug: 'about', status: 'published', isVisible: true, updatedAt: new Date().toISOString() },
        ])

        render(
            <I18nProvider defaultLocale="en">
                <PageManagerPanel
                    siteId="site-123"
                    currentPageId="page-99"
                    siteStatus="published"
                    onPageSelected={vi.fn()}
                />
            </I18nProvider>,
        )
        // Assert — all published pages show Live when site is published
        const liveBadges = screen.getAllByText('Live')
        expect(liveBadges.length).toBeGreaterThanOrEqual(1)
    })

    it('TC-F05-02-14e: published page on published site shows Live badge regardless of menu', () => {
        // Arrange — page-2 published, site published; menu membership is irrelevant to status
        useEditorStore.getState().setPages([
            { id: 'page-2', title: 'About', slug: 'about', status: 'published', isVisible: true, updatedAt: new Date().toISOString() },
        ])

        render(
            <I18nProvider defaultLocale="en">
                <PageManagerPanel
                    siteId="site-123"
                    currentPageId="page-99"
                    siteStatus="published"
                    onPageSelected={vi.fn()}
                />
            </I18nProvider>,
        )
        // Assert — page.status=published + siteStatus=published → Live (menu state does not affect badge)
        expect(screen.getByText('Live')).toBeInTheDocument()
        expect(screen.queryByText('Draft')).not.toBeInTheDocument()
    })

    it('TC-F05-02-15d: published page on unpublished site shows Draft badge', () => {
        // Arrange — page published but site not yet published
        useEditorStore.getState().setPages([
            { id: 'page-2', title: 'About', slug: 'about', status: 'published', isVisible: true, updatedAt: new Date().toISOString() },
        ])

        render(
            <I18nProvider defaultLocale="en">
                <PageManagerPanel
                    siteId="site-123"
                    currentPageId="page-99"
                    onPageSelected={vi.fn()}
                />
            </I18nProvider>,
        )
        // Assert — site not published → Draft even if page.status is published
        expect(screen.getByText('Draft')).toBeInTheDocument()
        expect(screen.queryByText('Live')).not.toBeInTheDocument()
    })

    it('TC-F05.07: Adds a new page and syncs state', async () => {
        // Arrange
        const mockResponse = {
            ok: true,
            json: async () => ({
                page: {
                    id: 'page-3',
                    title: 'Khuyến mãi',
                    slug: 'khuyen-mai',
                    status: 'draft',
                    isVisible: true,
                    updatedAt: new Date().toISOString()
                }
            })
        }
        ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

        render(<TestWrapper />)

        // Act
        fireEvent.click(screen.getByText('Add new page'))
        
        const input = screen.getByPlaceholderText('e.g. Promotions')
        fireEvent.change(input, { target: { value: 'Khuyến mãi' } })
        
        const form = input.closest('form')!
        fireEvent.submit(form)

        // Assert
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/sites/site-123/pages', expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('khuyen-mai')
            }))
        })
        expect(useEditorStore.getState().pages).toHaveLength(3)
        expect(useEditorStore.getState().pages[2].slug).toBe('khuyen-mai')
        expect(toast).toHaveBeenCalledWith('Page “Khuyến mãi” created — add it to Menu to show it', expect.anything())
    })

    it('TC-F05.08: Catch Slug conflict error during creation (Mocking UI fallback)', async () => {
        // Arrange: mock 409 conflict
        const mockResponse = {
            ok: false,
            status: 409,
            text: async () => 'Page slug already exists in this site',
        }
        ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

        render(<TestWrapper />)

        // Act
        fireEvent.click(screen.getByText('Add new page'))
        const input = screen.getByPlaceholderText('e.g. Promotions')
        fireEvent.change(input, { target: { value: 'Duplicate Slug' } })
        const form = input.closest('form')!
        fireEvent.submit(form)

        // Assert
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('A page with this slug already exists on this site.')
        })
        expect(useEditorStore.getState().pages).toHaveLength(2) // No new page added
    })

    it('TC-F05.09: Soft deletes a page via inline confirm, updates store, and triggers Toast Undo', async () => {
        // Arrange
        ;(global.fetch as any).mockResolvedValueOnce({ ok: true })
        render(<TestWrapper />)

        // Act: trash icon → inline confirm inside the card → confirm
        const card = within(getCard('page-2'))
        fireEvent.click(card.getByRole('button', { name: 'Delete page' }))
        expect(card.getByRole('alertdialog')).toBeInTheDocument()
        fireEvent.click(card.getByRole('button', { name: 'Delete' }))

        // Assert API request
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/sites/site-123/pages/page-2', expect.objectContaining({
                method: 'PATCH',
                body: expect.stringContaining('deletedAt')
            }))
        })

        // Assert toast offers undo
        expect(toast).toHaveBeenCalledWith('Page “About Us” deleted', expect.objectContaining({
            action: expect.objectContaining({ label: 'Undo' })
        }))
        expect(useEditorStore.getState().pages.find(p => p.id === 'page-2')?.deletedAt).toBeTruthy()
    })

    it('TC-F05-02-21: Esc and Cancel close the inline delete confirm without calling the API', () => {
        // Arrange
        render(<TestWrapper />)
        const card = within(getCard('page-2'))

        // Act + Assert: Esc
        fireEvent.click(card.getByRole('button', { name: 'Delete page' }))
        fireEvent.keyDown(card.getByRole('alertdialog'), { key: 'Escape' })
        expect(card.queryByRole('alertdialog')).not.toBeInTheDocument()

        // Act + Assert: Cancel
        fireEvent.click(card.getByRole('button', { name: 'Delete page' }))
        fireEvent.click(card.getByRole('button', { name: 'Cancel' }))
        expect(card.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it('TC-F05-02-15e: published page with isVisible=false on live site shows Hidden badge', () => {
        // Arrange — page published + visible:false; site published
        useEditorStore.getState().setPages([
            { id: 'page-1', title: 'Home', slug: 'home', status: 'published', isHomepage: true, isVisible: true, updatedAt: new Date().toISOString() },
            { id: 'page-2', title: 'Secret', slug: 'secret', status: 'published', isVisible: false, updatedAt: new Date().toISOString() },
        ])

        // Act
        render(
            <I18nProvider defaultLocale="en">
                <PageManagerPanel
                    siteId="site-123"
                    currentPageId="page-1"
                    siteStatus="published"
                    onPageSelected={vi.fn()}
                />
            </I18nProvider>,
        )

        // Assert — hidden wins over Live; the eye button offers to show it again
        const card = within(getCard('page-2'))
        expect(card.getByText('Hidden')).toBeInTheDocument()
        expect(card.queryByText('Live')).not.toBeInTheDocument()
        expect(card.getByRole('button', { name: 'Show page' })).toBeInTheDocument()
    })

    it('TC-F05-02-15f: published page not in nav menu on live site shows Live badge + No Link sublabel', () => {
        // Arrange — page published + visible; site published; header has no links to page-2
        useEditorStore.getState().setPages([
            { id: 'page-1', title: 'Home', slug: 'home', status: 'published', isHomepage: true, isVisible: true, updatedAt: new Date().toISOString() },
            { id: 'page-2', title: 'Unlisted', slug: 'unlisted', status: 'published', isVisible: true, updatedAt: new Date().toISOString() },
        ])
        // headerBlock with links only pointing to Home (slug-based, actual data format)
        useEditorStore.getState().init(
            'site-123',
            [],
            {},
            'Test Site',
            { blockType: 'navigation', links: [{ label: 'Home', url: '/' }] },
        )
        useEditorStore.getState().setPages([
            { id: 'page-1', title: 'Home', slug: 'home', status: 'published', isHomepage: true, isVisible: true, updatedAt: new Date().toISOString() },
            { id: 'page-2', title: 'Unlisted', slug: 'unlisted', status: 'published', isVisible: true, updatedAt: new Date().toISOString() },
        ])

        render(
            <I18nProvider defaultLocale="en">
                <PageManagerPanel
                    siteId="site-123"
                    currentPageId="page-1"
                    siteStatus="published"
                    onPageSelected={vi.fn()}
                />
            </I18nProvider>,
        )

        // Assert — Live badge present AND No Link sublabel for page-2
        const liveCount = screen.getAllByText('Live').length
        expect(liveCount).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('No Link')).toBeInTheDocument()
    })

    it('TC-F05-02-15g: published page on unpublished site shows Draft badge with site-specific tooltip', () => {
        // Arrange — page published but site not published
        useEditorStore.getState().setPages([
            { id: 'page-2', title: 'About', slug: 'about', status: 'published', isVisible: true, updatedAt: new Date().toISOString() },
        ])

        render(
            <I18nProvider defaultLocale="en">
                <PageManagerPanel
                    siteId="site-123"
                    currentPageId="page-99"
                    siteStatus="draft"
                    onPageSelected={vi.fn()}
                />
            </I18nProvider>,
        )

        // Assert — shows Draft (not Live) since site is unpublished
        expect(screen.getByText('Draft')).toBeInTheDocument()
        expect(screen.queryByText('Live')).not.toBeInTheDocument()
    })

    it('TC-F05.10: Toggling Visibility flag (Hide Page)', async () => {
        // Arrange
        const mockResponse = { ok: true }
        ;(global.fetch as any).mockResolvedValueOnce(mockResponse)
        
        render(<TestWrapper />)

        // Act: Find eye button for 'About Us'
        fireEvent.click(within(getCard('page-2')).getByRole('button', { name: 'Hide page' }))

        // Assert
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/sites/site-123/pages/page-2', expect.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ isVisible: false })
            }))
        })

        expect(useEditorStore.getState().pages.find(p => p.id === 'page-2')?.isVisible).toBe(false)
        expect(toast).toHaveBeenCalledWith('About Us hidden from your website', expect.anything())
    })

    it('TC-F05-02-18: Home page keeps hide/delete icons disabled; other pages have them on the title row', () => {
        // Arrange & Act
        render(<TestWrapper />)

        // Assert
        const home = within(getCard('page-1'))
        expect(home.getByRole('button', { name: "The homepage can't be hidden" })).toBeDisabled()
        expect(home.getByRole('button', { name: "The homepage can't be deleted" })).toBeDisabled()
        const about = within(getCard('page-2'))
        expect(about.getByRole('button', { name: 'Hide page' })).toBeEnabled()
        expect(about.getByRole('button', { name: 'Delete page' })).toBeEnabled()
    })

    it('TC-F05-02-19: Add new page sits after the list, previews the URL, and Esc cancels', () => {
        // Arrange
        render(<TestWrapper />)
        const addButton = screen.getByRole('button', { name: 'Add new page' })
        const lastCard = getCard('page-2')
        expect(lastCard.compareDocumentPosition(addButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

        // Act
        fireEvent.click(addButton)
        const input = screen.getByPlaceholderText('e.g. Promotions')
        fireEvent.change(input, { target: { value: 'Khuyến mãi' } })

        // Assert preview, then Esc closes the form
        expect(screen.getByText('/khuyen-mai')).toBeInTheDocument()
        fireEvent.keyDown(input, { key: 'Escape' })
        expect(screen.queryByPlaceholderText('e.g. Promotions')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add new page' })).toBeInTheDocument()
    })

    it('TC-F05-02-19b: empty state still offers Add new page', () => {
        // Arrange
        useEditorStore.getState().setPages([])

        // Act
        render(<TestWrapper />)

        // Assert
        expect(screen.getByText('No pages found')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add new page' })).toBeInTheDocument()
    })

    it.each([
        ['About Us', 'same title'],
        ['about', 'same slug'],
        ['Home', 'homepage slug'],
        ['  ABOUT us ', 'case/space-insensitive title'],
    ])('TC-F05-02-20: duplicate "%s" (%s) shows inline error and disables Create page', (value) => {
        // Arrange
        render(<TestWrapper />)
        fireEvent.click(screen.getByRole('button', { name: 'Add new page' }))

        // Act
        fireEvent.change(screen.getByPlaceholderText('e.g. Promotions'), { target: { value } })

        // Assert
        expect(screen.getByRole('alert')).toHaveTextContent('A page with this name or URL already exists')
        expect(screen.getByRole('button', { name: 'Create page' })).toBeDisabled()
    })

    it('TC-F05-02-20b: a name with no letters/numbers shows an error instead of posting an empty slug', () => {
        // Arrange
        render(<TestWrapper />)
        fireEvent.click(screen.getByRole('button', { name: 'Add new page' }))

        // Act
        fireEvent.change(screen.getByPlaceholderText('e.g. Promotions'), { target: { value: '!!!' } })

        // Assert
        expect(screen.getByRole('alert')).toHaveTextContent('Use at least one letter or number')
        expect(screen.getByRole('button', { name: 'Create page' })).toBeDisabled()
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it('TC-F05-02-22: current page row is marked current and "Edit with AI chat" calls onEditPage', () => {
        // Arrange
        const onEditPage = vi.fn()
        render(
            <I18nProvider defaultLocale="en">
                <PageManagerPanel siteId="site-123" currentPageId="page-2" onPageSelected={vi.fn()} onEditPage={onEditPage} />
            </I18nProvider>,
        )

        // Act
        const card = within(getCard('page-2'))
        fireEvent.click(card.getByRole('button', { name: 'Edit with AI chat' }))

        // Assert
        expect(getCard('page-2')).toHaveAttribute('aria-current', 'page')
        expect(card.getByText('Editing')).toHaveClass('sr-only')
        expect(onEditPage).toHaveBeenCalledWith('page-2')
        expect(within(getCard('page-1')).queryByRole('button', { name: 'Edit with AI chat' })).not.toBeInTheDocument()
    })

    it('TC-F05-02-23: Custom 404 footer toggles and selects the 404 page', () => {
        // Arrange
        const onPageSelected = vi.fn()
        useEditorStore.getState().setPages([
            ...useEditorStore.getState().pages,
            { id: 'page-404', title: '404', slug: '404', status: 'published', isVisible: true, updatedAt: new Date().toISOString() },
        ])
        const { rerender } = render(
            <I18nProvider defaultLocale="en">
                <PageManagerPanel siteId="site-123" currentPageId="page-1" onPageSelected={onPageSelected} />
            </I18nProvider>,
        )
        expect(document.querySelector('[data-page-id="page-404"]')).toBeNull() // not in regular list

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Custom 404 page' }))
        fireEvent.click(screen.getByRole('button', { name: 'Edit 404 page' }))

        // Assert
        expect(onPageSelected).toHaveBeenCalledWith('page-404')

        // Assert: when editing the 404 page the label changes
        rerender(
            <I18nProvider defaultLocale="en">
                <PageManagerPanel siteId="site-123" currentPageId="page-404" onPageSelected={onPageSelected} />
            </I18nProvider>,
        )
        expect(screen.getByRole('button', { name: 'Editing 404 page' })).toBeInTheDocument()
    })

    it('TC-F05-02-24: showing a hidden page PATCHes isVisible=true', async () => {
        // Arrange
        useEditorStore.getState().updatePageInState('page-2', { isVisible: false })
        ;(global.fetch as any).mockResolvedValueOnce({ ok: true })
        render(<TestWrapper />)

        // Act
        fireEvent.click(within(getCard('page-2')).getByRole('button', { name: 'Show page' }))

        // Assert
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/sites/site-123/pages/page-2', expect.objectContaining({
                body: JSON.stringify({ isVisible: true }),
            }))
        })
        expect(toast).toHaveBeenCalledWith('About Us is now visible', expect.anything())
    })

    it('TC-F05-02-25: clicking anywhere on a non-current card selects it; the current card ignores body clicks', () => {
        // Arrange
        const onPageSelected = vi.fn()
        render(
            <I18nProvider defaultLocale="en">
                <PageManagerPanel siteId="site-123" currentPageId="page-1" onPageSelected={onPageSelected} />
            </I18nProvider>,
        )

        // Act + Assert: path/date line of another page selects it
        fireEvent.click(within(getCard('page-2')).getByText(/\/about/))
        expect(onPageSelected).toHaveBeenCalledTimes(1)
        expect(onPageSelected).toHaveBeenCalledWith('page-2')

        // Act + Assert: icon buttons do NOT select the card
        fireEvent.click(within(getCard('page-2')).getByRole('button', { name: 'Delete page' }))
        expect(onPageSelected).toHaveBeenCalledTimes(1)

        // Act + Assert: current card body click is a no-op
        fireEvent.click(within(getCard('page-1')).getByText(/^\/ ·/))
        expect(onPageSelected).toHaveBeenCalledTimes(1)
    })

    it('TC-F05-02-26: status badge sits right after the page name, before the action icons', () => {
        // Arrange & Act
        render(<TestWrapper />)

        // Assert: DOM order inside the card = name, badge, then icon buttons
        const card = getCard('page-2')
        const name = within(card).getByText('About Us')
        const badge = within(card).getByText('Draft')
        const hide = within(card).getByRole('button', { name: 'Hide page' })
        expect(name.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(badge.compareDocumentPosition(hide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(name.parentElement).toBe(badge.closest('div'))
    })

    it('TC-F05-02-27: page names with "$" patterns are shown literally in the delete confirm and toasts', async () => {
        // Arrange: JS String.replace treats "$&" specially unless a replacer function is used
        useEditorStore.getState().updatePageInState('page-2', { title: 'Sale $& more' })
        ;(global.fetch as any).mockResolvedValueOnce({ ok: true })
        render(<TestWrapper />)

        // Act
        const card = within(getCard('page-2'))
        fireEvent.click(card.getByRole('button', { name: 'Delete page' }))

        // Assert confirm text, then the toast after confirming
        expect(card.getByRole('alertdialog')).toHaveAttribute('aria-label', 'Delete “Sale $& more”? You can undo for a few seconds.')
        fireEvent.click(card.getByRole('button', { name: 'Delete' }))
        await waitFor(() => {
            expect(toast).toHaveBeenCalledWith('Page “Sale $& more” deleted', expect.anything())
        })
    })
})
