import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { PageManagerPanel } from '@/components/editor/PageManagerPanel'
import { useEditorStore } from '@/store/editorStore'
import { I18nProvider } from '@/i18n'
import { toast } from 'sonner'
import '@testing-library/jest-dom'

// GH-2162: deleting a page (esp. the one being edited) must show the Undo toast right after the
// server accepts the delete, regardless of the navigation / refetch callbacks the editor runs next.

global.fetch = vi.fn()

vi.mock('sonner', () => {
    const toast = vi.fn() as any
    toast.success = vi.fn()
    toast.error = vi.fn()
    return { toast, Toaster: () => null }
})

const now = () => new Date().toISOString()
const HOME = { id: 'page-1', title: 'Trang chủ', slug: 'home', status: 'published', isHomepage: true, isVisible: true, updatedAt: now() }
const ABOUT = { id: 'page-2', title: 'About Us', slug: 'about', status: 'draft', isVisible: true, updatedAt: now() }
const CONTACT = { id: 'page-3', title: 'Contact', slug: 'contact', status: 'draft', isVisible: true, updatedAt: now() }

const getCard = (pageId: string) => document.querySelector<HTMLElement>(`[data-page-id="${pageId}"]`)!

/** Renders the panel with `page-2` as the page being edited and confirms its delete. */
function renderAndDeleteCurrentPage(callbacks: { onPageSelected: Mock; onPagesChanged: Mock }) {
    render(
        <I18nProvider defaultLocale="en">
            <PageManagerPanel
                siteId="site-123"
                currentPageId="page-2"
                onPageSelected={callbacks.onPageSelected}
                onPagesChanged={callbacks.onPagesChanged}
            />
        </I18nProvider>,
    )
    const card = within(getCard('page-2'))
    fireEvent.click(card.getByRole('button', { name: 'Delete page' }))
    fireEvent.click(card.getByRole('button', { name: 'Delete' }))
}

const deletedToastCall = () => (toast as unknown as Mock).mock.calls.find(([msg]) => String(msg).includes('deleted'))

describe('PageManagerPanel — delete current page shows Undo toast (GH-2162)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useEditorStore.getState().reset()
        useEditorStore.getState().init('site-123', [], {}, 'Test Site')
        useEditorStore.getState().setPages([HOME, ABOUT, CONTACT] as any)
    })

    it('TC-F05-02-10a: deleting the page being edited PATCHes deletedAt, switches to home and shows the Undo toast', async () => {
        // Arrange
        ;(global.fetch as Mock).mockResolvedValueOnce({ ok: true })
        const onPageSelected = vi.fn()
        const onPagesChanged = vi.fn()

        // Act
        renderAndDeleteCurrentPage({ onPageSelected, onPagesChanged })

        // Assert
        await waitFor(() => expect(toast).toHaveBeenCalled())
        expect(global.fetch).toHaveBeenCalledWith('/api/sites/site-123/pages/page-2', expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('deletedAt'),
        }))
        expect(toast).toHaveBeenCalledWith('Page “About Us” deleted', expect.objectContaining({
            duration: 5000,
            action: expect.objectContaining({ label: 'Undo' }),
        }))
        expect(onPageSelected).toHaveBeenCalledWith('page-1')
        expect(onPagesChanged).toHaveBeenCalledTimes(1)
        expect(useEditorStore.getState().pages.find(p => p.id === 'page-2')?.deletedAt).toBeTruthy()
    })

    it('TC-F05-02-10b: the toast does not wait for slow navigation / refetch callbacks', async () => {
        // Arrange: callbacks that never settle (e.g. a long save + refetch)
        ;(global.fetch as Mock).mockResolvedValueOnce({ ok: true })
        const onPageSelected = vi.fn(() => new Promise<void>(() => {}))
        const onPagesChanged = vi.fn(() => new Promise<void>(() => {}))

        // Act
        renderAndDeleteCurrentPage({ onPageSelected, onPagesChanged })

        // Assert
        await waitFor(() => expect(deletedToastCall()).toBeDefined())
    })

    it.each([
        ['throws synchronously', () => { throw new Error('boom') }],
        ['rejects asynchronously', () => Promise.reject(new Error('late boom'))],
    ])('TC-F05-02-10c: a callback that %s neither rolls the delete back nor hides the toast', async (_label, failure) => {
        // Arrange
        ;(global.fetch as Mock).mockResolvedValueOnce({ ok: true })
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const onPageSelected = vi.fn(failure as () => void)
        const onPagesChanged = vi.fn(failure as () => void)

        // Act
        renderAndDeleteCurrentPage({ onPageSelected, onPagesChanged })

        // Assert
        await waitFor(() => expect(deletedToastCall()).toBeDefined())
        await waitFor(() => expect(consoleError).toHaveBeenCalled())
        expect(toast.error).not.toHaveBeenCalled()
        expect(useEditorStore.getState().pages.find(p => p.id === 'page-2')?.deletedAt).toBeTruthy()
        consoleError.mockRestore()
    })

    it('TC-F05-02-10d: a failed PATCH rolls back and shows an error, with no "deleted" toast or navigation', async () => {
        // Arrange
        ;(global.fetch as Mock).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
        const onPageSelected = vi.fn()
        const onPagesChanged = vi.fn()

        // Act
        renderAndDeleteCurrentPage({ onPageSelected, onPagesChanged })

        // Assert
        await waitFor(() => expect(toast.error).toHaveBeenCalled())
        expect(deletedToastCall()).toBeUndefined()
        expect(onPageSelected).not.toHaveBeenCalled()
        expect(onPagesChanged).not.toHaveBeenCalled()
        expect(useEditorStore.getState().pages.find(p => p.id === 'page-2')?.deletedAt).toBeFalsy()
    })

    it('TC-F05-02-11a: Undo PATCHes deletedAt=null, refetches, and the page returns to its old position', async () => {
        // Arrange: delete PATCH ok → restore PATCH ok → GET /pages (server order = createdAt)
        ;(global.fetch as Mock)
            .mockResolvedValueOnce({ ok: true })
            .mockResolvedValueOnce({ ok: true })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ pages: [HOME, ABOUT, CONTACT] }) })
        renderAndDeleteCurrentPage({ onPageSelected: vi.fn(), onPagesChanged: vi.fn() })
        await waitFor(() => expect(deletedToastCall()).toBeDefined())
        expect(useEditorStore.getState().pages.find(p => p.id === 'page-2')?.deletedAt).toBeTruthy()
        const options = deletedToastCall()![1] as { action: { onClick: () => void } }

        // Act
        await act(async () => { options.action.onClick() })

        // Assert
        await waitFor(() => expect(toast).toHaveBeenCalledWith('Page “About Us” restored', expect.anything()))
        expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/sites/site-123/pages/page-2', expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ deletedAt: null }),
        }))
        expect(global.fetch).toHaveBeenNthCalledWith(3, '/api/sites/site-123/pages', expect.anything())
        const pages = useEditorStore.getState().pages
        expect(pages.map(p => p.id)).toEqual(['page-1', 'page-2', 'page-3'])
        expect(pages.find(p => p.id === 'page-2')?.deletedAt).toBeFalsy()
        expect(screen.getByText('About Us')).toBeInTheDocument()
    })

    it('TC-F05-02-11b: Undo still shows "restored" when onPagesChanged throws synchronously', async () => {
        // Arrange
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        ;(global.fetch as Mock)
            .mockResolvedValueOnce({ ok: true })
            .mockResolvedValueOnce({ ok: true })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ pages: [HOME, ABOUT, CONTACT] }) })
        const onPagesChanged = vi.fn(() => { throw new Error('boom') })
        renderAndDeleteCurrentPage({ onPageSelected: vi.fn(), onPagesChanged })
        await waitFor(() => expect(deletedToastCall()).toBeDefined())
        const options = deletedToastCall()![1] as { action: { onClick: () => void } }

        // Act
        await act(async () => { options.action.onClick() })

        // Assert
        await waitFor(() => expect(toast).toHaveBeenCalledWith('Page “About Us” restored', expect.anything()))
        expect(toast.error).not.toHaveBeenCalled()
        consoleError.mockRestore()
    })

    it('TC-F05-02-24b: hiding a page keeps the change and shows the toast when onPagesChanged throws synchronously', async () => {
        // Arrange
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        ;(global.fetch as Mock).mockResolvedValueOnce({ ok: true })
        render(
            <I18nProvider defaultLocale="en">
                <PageManagerPanel
                    siteId="site-123"
                    currentPageId="page-1"
                    onPageSelected={vi.fn()}
                    onPagesChanged={vi.fn(() => { throw new Error('boom') })}
                />
            </I18nProvider>,
        )

        // Act
        fireEvent.click(within(getCard('page-2')).getByRole('button', { name: 'Hide page' }))

        // Assert
        await waitFor(() => expect(toast).toHaveBeenCalledWith('About Us hidden from your website', expect.anything()))
        expect(toast.error).not.toHaveBeenCalled()
        expect(useEditorStore.getState().pages.find(p => p.id === 'page-2')?.isVisible).toBe(false)
        consoleError.mockRestore()
    })
})
