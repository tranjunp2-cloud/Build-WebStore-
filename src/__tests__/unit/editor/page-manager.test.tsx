import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
        // Check badges — current page shows "Editing", others show status
        expect(screen.getByText('Editing')).toBeInTheDocument() // Page 1 (current)
        expect(screen.getByText('Draft')).toBeInTheDocument() // Page 2
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
        fireEvent.click(screen.getByText('+ Add New Page'))
        
        const input = screen.getByPlaceholderText('Page name (e.g. Promotions)')
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
        fireEvent.click(screen.getByText('+ Add New Page'))
        const input = screen.getByPlaceholderText('Page name (e.g. Promotions)')
        fireEvent.change(input, { target: { value: 'Duplicate Slug' } })
        const form = input.closest('form')!
        fireEvent.submit(form)

        // Assert
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Page slug already exists in this site')
        })
        expect(useEditorStore.getState().pages).toHaveLength(2) // No new page added
    })

    it('TC-F05.09: Soft deletes a page, updates store, and triggers Toast Undo', async () => {
        // Arrange
        const mockResponse = { ok: true }
        ;(global.fetch as any).mockResolvedValueOnce(mockResponse)
        
        render(<TestWrapper />)

        // Act: Open delete confirmation for "About Us" (page-2)
        // Note: Target by Title to find correct buttons
        const aboutUsContainer = screen.getByText('About Us').closest('div[class*="rounded-xl"]')!
        const deleteButton = aboutUsContainer.querySelector('button[title="Delete page"]')!
        fireEvent.click(deleteButton)

        // Wait for modal and confirm
        // Modal has a delete button with Trash2 icon — find by the modal container
        const modal = screen.getByText('Delete this page?').closest('div[class*="max-w"]')!
        const confirmDeleteButton = modal.querySelectorAll('button')[1] // second button is confirm
        fireEvent.click(confirmDeleteButton)

        // Assert API Request
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/sites/site-123/pages/page-2', expect.objectContaining({
                method: 'PATCH',
                body: expect.stringContaining('deletedAt')
            }))
        })

        // Assert toast called with undo
        expect(toast).toHaveBeenCalledWith('Page deleted. Undo?', expect.objectContaining({
            action: expect.objectContaining({ label: 'Undo' })
        }))

        // Assert UI hides it - About us is gone from store view
        expect(useEditorStore.getState().pages.find(p => p.id === 'page-2')?.deletedAt).toBeTruthy()
    })

    it('TC-F05.10: Toggling Visibility flag (Hide Page)', async () => {
        // Arrange
        const mockResponse = { ok: true }
        ;(global.fetch as any).mockResolvedValueOnce(mockResponse)
        
        render(<TestWrapper />)

        // Act: Find eye button for 'About Us'
        const aboutUsContainer = screen.getByText('About Us').closest('div[class*="rounded-xl"]')!
        const hideButton = aboutUsContainer.querySelector('button[title="Hide page"]')!
        
        fireEvent.click(hideButton)

        // Assert
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/sites/site-123/pages/page-2', expect.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ isVisible: false })
            }))
        })

        expect(useEditorStore.getState().pages.find(p => p.id === 'page-2')?.isVisible).toBe(false)
    })
})
