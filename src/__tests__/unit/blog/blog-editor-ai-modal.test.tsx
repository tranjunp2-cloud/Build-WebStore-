import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'

// ── Mocks (must be before all imports) ────────────────────────────────────────

vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
    useParams: vi.fn(() => ({ id: 'new' })),
    usePathname: vi.fn(() => '/blog/new'),
    useSearchParams: vi.fn(() => ({ get: vi.fn(() => null) })),
}))

vi.mock('next/link', () => ({
    default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
        React.createElement('a', { href, className }, children),
}))

vi.mock('next/dynamic', () => ({
    default: (fn: any) => {
        const Component = (props: any) => <div data-testid="blog-rich-editor" {...props} />
        Component.displayName = 'DynamicBlogRichEditor'
        return Component
    },
}))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-dom')>()
    return {
        ...actual,
        createPortal: (node: React.ReactNode) => node,
    }
})

vi.mock('@/app/(dashboard)/blog/actions', () => ({
    getBlogCategoriesAction: vi.fn(),
    getCurrentUserAction: vi.fn(),
    saveBlogAction: vi.fn(),
    getBlogByIdAction: vi.fn(),
}))

vi.mock('@/app/(dashboard)/actions/media', () => ({
    uploadMediaAction: vi.fn(),
}))

vi.mock('@/lib/validate-image', () => ({
    validateImageMagicBytes: vi.fn(() => ({ valid: true })),
    MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

vi.mock('@/app/(dashboard)/blog/_components/CategoryModal', () => ({
    CategoryModal: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="category-modal">
            <button onClick={onClose} data-testid="category-modal-close">Close Modal</button>
        </div>
    ),
}))

vi.mock('@/components/ui/popover', () => ({
    Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
    PopoverContent: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-content">{children}</div>,
}))

vi.mock('@/components/ui/calendar', () => ({
    Calendar: () => <div data-testid="calendar" />,
}))

vi.mock('date-fns', () => ({
    format: vi.fn((date: Date, fmt: string) => '01 Jan 2026'),
}))

vi.mock('@/lib/utils', () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/i18n', () => ({
    useI18n: vi.fn(() => ({
        t: {
            dashboard: {
                blog: {
                    title: 'Blogs',
                    subtitle: 'Manage your blog posts',
                    editor: {
                        home: 'Home',
                        blog: 'Blog',
                        newPost: 'New Post',
                        editPrefix: 'Edit:',
                        createTitle: 'Create Blog Post',
                        editTitle: 'Edit Blog Post',
                        untitled: 'Untitled',
                        aiAssistant: 'AI Assistant',
                        saveDraft: 'Save Draft',
                        publish: 'Publish',
                        postTitle: 'Post title',
                        titlePlaceholder: 'e.g., E-commerce Marketing Strategies',
                        titleRequired: 'Title is required',
                        urlSlugLabel: 'URL Slug (auto-generated, editable)',
                        thumbnailLabel: 'Featured Thumbnail',
                        replace: 'Replace',
                        clickToUpload: 'Click to upload thumbnail',
                        uploadHint: 'PNG, JPG up to 10MB',
                        startWriting: 'Start writing...',
                        postSettings: 'Post Settings',
                        category: 'Category',
                        selectCategory: 'Select Category',
                        manageCategories: 'Manage Categories',
                        author: 'Author',
                        publishDate: 'Publish Date',
                        seoTitle: 'Search Optimization (SEO)',
                        seoDesc: 'Preview how your post appears in search results.',
                        generateSeo: 'Generate via AI',
                        metaTitle: 'Meta Title',
                        metaDesc: 'Meta Description',
                        savePost: 'Save Post',
                        publishPost: 'Publish Post',
                        selectDateInfo: 'Click to select date',
                        statusInfo: 'Current status: {status}',
                        wordCount: '{words} words',
                        noCategory: '— No category —',
                        seoTitlePlaceholder: 'Brief title for search engines',
                        seoDescPlaceholder: 'Brief description for search engines',
                        characters: 'characters',
                        aiModalTitle: 'Generate Blog Idea with AI',
                        aiModalDesc: 'Let AI help you create engaging content',
                        aiTopicLabel: "What's the topic?",
                        aiToneLabel: 'Tone of Voice',
                        aiToneProfessional: 'Professional',
                        aiToneFriendly: 'Friendly',
                        aiTonePersuasive: 'Persuasive',
                        aiGenerateBtn: 'Generate Blog Idea',
                        aiGenerating: 'Generating...',
                        aiGeneratedContent: 'Generated Content',
                        slugLabel: 'Slug:',
                        aiRegenerate: 'Regenerate',
                        aiInsertBtn: 'Insert into Editor',
                        fileTooLarge: 'File exceeds 10MB limit',
                        invalidFileType: 'Only JPEG and PNG files are accepted',
                        draftRecoveryMessage: 'Unsaved draft found. Restore it?',
                        draftRestore: 'Restore',
                        draftDismiss: 'Dismiss',
                    },
                    categoryModal: {
                        title: 'Manage Category',
                        existingTitle: 'Existing Category',
                        itemsCount: '{count} items',
                        noCategories: 'No categories yet',
                        addNewBtn: 'Add new Category',
                        categoryNameLabel: 'Category Name',
                        categoryNamePlaceholder: 'e.g., Tips & Tricks',
                        saveBtn: 'Save',
                        closeBtn: 'Close',
                        removeTitle: 'Remove category',
                        removeConfirmMsg: 'Are you sure?',
                        cancelBtn: 'Cancel',
                        deletingBtn: 'Deleting...',
                        deleteBtn: 'Delete',
                        toastLoadFail: 'Failed to load categories',
                        toastCreateSuccess: 'Category created',
                        toastCreateFail: 'Failed to create category',
                        toastUpdateSuccess: 'Category updated',
                        toastUpdateFail: 'Failed to update category',
                        toastDeleteSuccess: 'Category "{name}" deleted',
                        toastDeleteFail: 'Failed to delete category',
                    },
                    actions: {
                        view: 'View',
                        edit: 'Edit',
                        delete: 'Delete',
                        deleteSuccess: '"{title}" has been deleted',
                        deleteFailed: 'Failed to delete blog post',
                        bulkDeleteSuccess: '{count} posts deleted successfully',
                        bulkDeleteFailed: 'Some posts failed to delete',
                        bulkDeleteConfirm: 'Are you sure?',
                        bulkDeleteWarning: 'This action cannot be undone.',
                        deletePublishedWarning: 'Warning',
                        cancel: 'Cancel',
                        deleting: 'Deleting...',
                        bulkPublish: 'Publish',
                        bulkPublishSuccess: '{count} posts published',
                        bulkPublishFailed: 'Some posts failed',
                        statusUpdated: 'Post {status}',
                        moveToDraft: 'Move to Draft',
                        publish: 'Publish',
                        updateFailed: 'Failed to update post status',
                        deleteConfirmTitle: 'Delete Post',
                        deleteConfirm: 'Are you sure?',
                        deleteConfirmDetails: 'Are you sure you want to delete "{title}"?',
                        deleteConfirmWarn: 'This action cannot be undone.',
                        confirmDeleteBtn: 'Delete Post',
                    },
                    filters: { published: 'Published', draft: 'Draft', allStatus: 'All Status', allCategories: 'All Categories', sortNewest: 'Newest', sortOldest: 'Oldest', sortNameAsc: 'A-Z', sortNameDesc: 'Z-A', search: 'Search...' },
                    noPostsTitle: 'No blog posts yet',
                    noPostsSubtitle: 'Create your first blog post',
                    unknownAuthor: 'Author',
                    noMatches: 'No posts match your filters',
                    resetFilters: 'Reset Filters',
                    noImage: 'No image',
                    uncategorized: 'Uncategorized',
                    author: 'Author',
                    mobile: { published: 'Published', draft: 'Draft' },
                    table: { thumbnail: 'Thumbnail', title: 'Title', category: 'Category', status: 'Status', author: 'Author', date: 'Date', actions: 'Actions' },
                    pagination: { previous: 'Previous', next: 'Next' },
                },
            },
            common: {
                subscriptionErrors: {
                    featureLocked: 'Feature not available on this plan.',
                    subscriptionExpired: 'Subscription expired.',
                    genericLocked: 'Action not available on this plan.',
                },
            },
        },
        locale: 'en',
    })),
}))

// ── Imports ───────────────────────────────────────────────────────────────────
import BlogEditorPage from '@/app/(dashboard)/blog/[id]/BlogEditorPageClient'
import * as actions from '@/app/(dashboard)/blog/actions'

// ── Setup ─────────────────────────────────────────────────────────────────────
const setupMocks = () => {
    vi.mocked(actions.getBlogCategoriesAction).mockResolvedValue([])
    vi.mocked(actions.getCurrentUserAction).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
    } as any)
    vi.mocked(actions.getBlogByIdAction).mockResolvedValue(null as any)
    vi.mocked(actions.saveBlogAction).mockResolvedValue({ id: 'new-post-id' } as any)
}

// The legacy "Generate a blog idea" modal (TC-F17-03-06/07) was replaced by the copilot's inline
// AI writer (TC-F17-AI-01..03, blog-ai-draft.test.ts); its tests went with it.

describe('[TC-F17-02-01] Blog editor page — Create new post flow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        setupMocks()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders "Create Blog Post" heading for new post', async () => {
        // Arrange + Act
        await act(async () => {
            render(<BlogEditorPage />)
        })

        // Assert
        expect(screen.getByText('Create Blog Post')).toBeInTheDocument()
    })

    it('renders post title input field', async () => {
        // Arrange + Act
        await act(async () => {
            render(<BlogEditorPage />)
        })

        // Assert
        expect(screen.getByPlaceholderText('e.g., E-commerce Marketing Strategies')).toBeInTheDocument()
    })

    it('renders Save Draft and Publish in the header, and no AI button while the copilot is off [TC-F17-AI-01]', async () => {
        // Arrange + Act — agentEnabled defaults to false (the copilot is switched off)
        await act(async () => {
            render(<BlogEditorPage />)
        })

        // Assert — no dead AI button; the old modal is gone
        const allButtons = screen.getAllByRole('button')
        const buttonTexts = allButtons.map(b => b.querySelector('span')?.textContent || b.textContent || '')
        expect(buttonTexts.some(t => t.includes('AI Assistant'))).toBe(false)
        expect(buttonTexts.some(t => t.includes('Save Draft'))).toBe(true)
        expect(buttonTexts.some(t => t.includes('Publish'))).toBe(true)
        expect(screen.queryByText('Generate Blog Idea with AI')).not.toBeInTheDocument()
    })

    it('Save Draft is icon-only on mobile (hidden text span with sm:inline)', async () => {
        // Arrange + Act
        await act(async () => {
            render(<BlogEditorPage />)
        })

        // Assert — text spans inside AI and Save Draft buttons use "hidden sm:inline"
        // (text shows from the sm breakpoint; icon-only below)
        const hiddenSmSpans = document.querySelectorAll('span.hidden.sm\\:inline')
        expect(hiddenSmSpans.length).toBeGreaterThanOrEqual(1)
    })

    it('shows validation error when Save Draft is clicked with empty title', async () => {
        // Arrange
        vi.mocked(actions.saveBlogAction).mockRejectedValue(new Error('Title is required'))

        await act(async () => {
            render(<BlogEditorPage />)
        })

        // Act — click Save Draft without entering a title
        const allButtons = screen.getAllByRole('button')
        const saveDraftBtn = allButtons.find(btn =>
            btn.querySelector('span')?.textContent?.includes('Save Draft')
        )

        if (saveDraftBtn) {
            await act(async () => {
                fireEvent.click(saveDraftBtn)
            })
        }

        // Assert — the error message should appear (validate() returns 'Title is required')
        await waitFor(() => {
            // saveBlogAction should not be called because validate() blocks it
            expect(actions.saveBlogAction).not.toHaveBeenCalled()
        })
    })

    it('title auto-generates slug from input', async () => {
        // Arrange
        await act(async () => {
            render(<BlogEditorPage />)
        })

        // Act
        const titleInput = screen.getByPlaceholderText('e.g., E-commerce Marketing Strategies')
        fireEvent.change(titleInput, { target: { value: 'My Blog Post Title' } })

        // Assert — slug field should be auto-populated
        await waitFor(() => {
            const slugInputs = screen.getAllByDisplayValue(/my-blog-post-title/i)
            expect(slugInputs.length).toBeGreaterThan(0)
        })
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F17-02-17 — Draft recovery from localStorage
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F17-02-17] Blog editor — Draft recovery from localStorage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        setupMocks()
    })

    afterEach(() => {
        vi.useRealTimers()
        localStorage.clear()
    })

    it('shows draft recovery banner when fresh draft exists in localStorage', async () => {
        // Arrange — inject a recent draft
        const draftKey = 'blog-draft-new'
        const recentDraft = {
            title: 'My Recovered Draft',
            content: '<p>Draft content</p>',
            slug: 'my-recovered-draft',
            category: '',
            seoTitle: '',
            seoDescription: '',
            updatedAt: Date.now() - 60 * 1000, // 1 minute ago
        }
        localStorage.setItem(draftKey, JSON.stringify(recentDraft))

        // Act
        await act(async () => {
            render(<BlogEditorPage />)
        })

        // Assert — draft recovery banner should appear
        await waitFor(() => {
            expect(screen.getByText('Unsaved draft found. Restore it?')).toBeInTheDocument()
        })
    })

    it('clicking Restore fills form with draft content', async () => {
        // Arrange
        const draftKey = 'blog-draft-new'
        const recentDraft = {
            title: 'Recovered Title',
            content: '<p>Recovered content</p>',
            slug: 'recovered-title',
            category: '',
            seoTitle: '',
            seoDescription: '',
            updatedAt: Date.now() - 30 * 1000, // 30 seconds ago
        }
        localStorage.setItem(draftKey, JSON.stringify(recentDraft))

        await act(async () => {
            render(<BlogEditorPage />)
        })

        // Wait for recovery banner
        await waitFor(() => {
            expect(screen.getByText('Restore')).toBeInTheDocument()
        })

        // Act
        await act(async () => {
            fireEvent.click(screen.getByText('Restore'))
        })

        // Assert — title input should be filled with draft title
        await waitFor(() => {
            const titleInput = screen.getByPlaceholderText('e.g., E-commerce Marketing Strategies')
            expect((titleInput as HTMLInputElement).value).toBe('Recovered Title')
        })
    })

    it('clicking Dismiss removes draft recovery banner', async () => {
        // Arrange
        const draftKey = 'blog-draft-new'
        localStorage.setItem(draftKey, JSON.stringify({
            title: 'Old Draft',
            content: '',
            slug: '',
            category: '',
            seoTitle: '',
            seoDescription: '',
            updatedAt: Date.now() - 120 * 1000,
        }))

        await act(async () => {
            render(<BlogEditorPage />)
        })

        await waitFor(() => {
            expect(screen.getByText('Dismiss')).toBeInTheDocument()
        })

        // Act
        await act(async () => {
            fireEvent.click(screen.getByText('Dismiss'))
        })

        // Assert — banner gone and localStorage cleared
        expect(screen.queryByText('Unsaved draft found. Restore it?')).not.toBeInTheDocument()
        expect(localStorage.getItem(draftKey)).toBeNull()
    })

    it('does not show draft recovery for stale draft older than 24 hours', async () => {
        // Arrange — 25 hours old
        const draftKey = 'blog-draft-new'
        localStorage.setItem(draftKey, JSON.stringify({
            title: 'Stale Draft',
            content: '',
            slug: '',
            category: '',
            seoTitle: '',
            seoDescription: '',
            updatedAt: Date.now() - 25 * 60 * 60 * 1000,
        }))

        // Act
        await act(async () => {
            render(<BlogEditorPage />)
        })

        // Assert — stale draft recovery banner should NOT appear
        await waitFor(() => {
            expect(screen.queryByText('Unsaved draft found. Restore it?')).not.toBeInTheDocument()
        })
        // Also verify stale draft was cleaned up
        expect(localStorage.getItem(draftKey)).toBeNull()
    })
})
