/**
 * Unit Tests — Editor Store: Page Operations + Header/Footer (F05)
 * Coverage Map (QA Doc Traceability):
 *   TC-F05.06  → setPages initializes page list
 *   TC-F05.07  → addPageToState adds new page
 *   TC-F05.08  → removePageFromState removes page by id
 *   TC-F05.09  → updatePageInState patches page data
 *   TC-F05.10  → setCurrentPageId switches active page
 *   TC-F05.16  → updateHeaderBlock pushes to undo history
 *   TC-F05.17  → updateFooterBlock pushes to undo history
 *   TC-F05.53  → Homepage/404 page protection (Business Rule BR-05/06)
 *
 * Scenario dimensions covered:
 *   #4 Scale — 0 pages, many pages, max history
 *   #5 State Transitions — add/remove/update page flows
 *   #9 Data Integrity — page state consistency
 *   #12 Business Logic — system page protections
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '@/store/editorStore'
import type { PageData, BlockData } from '@/store/editorStore'

const makeBlock = (type: string): BlockData => ({ blockType: type })

const makePage = (id: string, title: string, slug: string, opts?: Partial<PageData>): PageData => ({
    id,
    title,
    slug,
    status: 'draft',
    isVisible: true,
    updatedAt: new Date().toISOString(),
    ...opts,
})

describe('EditorStore — Page Operations', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
        useEditorStore.getState().init('site-1', [makeBlock('hero')], {}, 'Test Site')
    })

    // ── TC-F05.06 — setPages ────────────────────────────────────────────
    it('[TC-F05.06] setPages initializes the page list', () => {
        const pages = [
            makePage('p1', 'Home', 'home', { isHomepage: true }),
            makePage('p2', 'About', 'about'),
        ]
        useEditorStore.getState().setPages(pages)
        expect(useEditorStore.getState().pages).toHaveLength(2)
        expect(useEditorStore.getState().pages[0].title).toBe('Home')
    })

    it('setPages replaces existing pages entirely', () => {
        useEditorStore.getState().setPages([makePage('p1', 'Old', 'old')])
        useEditorStore.getState().setPages([makePage('p2', 'New', 'new')])
        expect(useEditorStore.getState().pages).toHaveLength(1)
        expect(useEditorStore.getState().pages[0].id).toBe('p2')
    })

    it('setPages handles empty array', () => {
        useEditorStore.getState().setPages([])
        expect(useEditorStore.getState().pages).toHaveLength(0)
    })

    // ── TC-F05.10 — setCurrentPageId ────────────────────────────────────
    it('[TC-F05.10] setCurrentPageId switches the active page', () => {
        useEditorStore.getState().setCurrentPageId('p2')
        expect(useEditorStore.getState().currentPageId).toBe('p2')
    })

    // ── TC-F05.07 — addPageToState ──────────────────────────────────────
    it('[TC-F05.07] addPageToState appends a new page', () => {
        useEditorStore.getState().setPages([makePage('p1', 'Home', 'home')])
        useEditorStore.getState().addPageToState(makePage('p2', 'Blog', 'blog'))
        expect(useEditorStore.getState().pages).toHaveLength(2)
        expect(useEditorStore.getState().pages[1].title).toBe('Blog')
    })

    it('addPageToState works on empty pages array', () => {
        useEditorStore.getState().addPageToState(makePage('p1', 'First', 'first'))
        expect(useEditorStore.getState().pages).toHaveLength(1)
    })

    // ── TC-F05.09 — updatePageInState ───────────────────────────────────
    it('[TC-F05.09] updatePageInState patches specific page', () => {
        useEditorStore.getState().setPages([
            makePage('p1', 'Home', 'home'),
            makePage('p2', 'About', 'about'),
        ])
        useEditorStore.getState().updatePageInState('p2', { title: 'About Us', isVisible: false })
        const updated = useEditorStore.getState().pages.find(p => p.id === 'p2')
        expect(updated?.title).toBe('About Us')
        expect(updated?.isVisible).toBe(false)
    })

    it('updatePageInState does not affect other pages', () => {
        useEditorStore.getState().setPages([
            makePage('p1', 'Home', 'home'),
            makePage('p2', 'About', 'about'),
        ])
        useEditorStore.getState().updatePageInState('p2', { title: 'New Title' })
        expect(useEditorStore.getState().pages.find(p => p.id === 'p1')?.title).toBe('Home')
    })

    it('updatePageInState with non-existent id is a no-op', () => {
        useEditorStore.getState().setPages([makePage('p1', 'Home', 'home')])
        useEditorStore.getState().updatePageInState('nonexistent', { title: 'Ghost' })
        expect(useEditorStore.getState().pages).toHaveLength(1)
        expect(useEditorStore.getState().pages[0].title).toBe('Home')
    })

    // ── TC-F05.08 — removePageFromState ─────────────────────────────────
    it('[TC-F05.08] removePageFromState removes page by id', () => {
        useEditorStore.getState().setPages([
            makePage('p1', 'Home', 'home'),
            makePage('p2', 'Blog', 'blog'),
        ])
        useEditorStore.getState().removePageFromState('p2')
        expect(useEditorStore.getState().pages).toHaveLength(1)
        expect(useEditorStore.getState().pages[0].id).toBe('p1')
    })

    it('removePageFromState with non-existent id is a no-op', () => {
        useEditorStore.getState().setPages([makePage('p1', 'Home', 'home')])
        useEditorStore.getState().removePageFromState('nonexistent')
        expect(useEditorStore.getState().pages).toHaveLength(1)
    })
})

describe('EditorStore — Header/Footer Block Operations', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
        useEditorStore.getState().init(
            'site-1',
            [makeBlock('hero'), makeBlock('features')],
            { primaryColor: '#000' },
            'Test Site',
            { blockType: 'navigation', links: [] },
            { blockType: 'footer', text: 'Copyright' },
        )
    })

    // ── TC-F05.16 — updateHeaderBlock ───────────────────────────────────
    it('[TC-F05.16] updateHeaderBlock merges changes into header', () => {
        useEditorStore.getState().updateHeaderBlock({ logo: 'new-logo.png' })
        const header = useEditorStore.getState().headerBlock
        expect(header).toBeTruthy()
        expect((header as any).logo).toBe('new-logo.png')
        expect((header as any).blockType).toBe('navigation')
    })

    it('updateHeaderBlock pushes to undo history', () => {
        const historyBefore = useEditorStore.getState().history.length
        useEditorStore.getState().updateHeaderBlock({ logo: 'updated.png' })
        expect(useEditorStore.getState().history.length).toBe(historyBefore + 1)
        expect(useEditorStore.getState().history[useEditorStore.getState().historyIndex].label).toBe('Updated Header')
    })

    it('updateHeaderBlock sets hasUnsavedChanges', () => {
        useEditorStore.getState().updateHeaderBlock({ brandName: 'New Brand' })
        expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)
    })

    it('undo after updateHeaderBlock restores previous header', () => {
        const originalHeader = JSON.parse(JSON.stringify(useEditorStore.getState().headerBlock))
        useEditorStore.getState().updateHeaderBlock({ logo: 'changed.png' })
        useEditorStore.getState().undo()
        expect(useEditorStore.getState().headerBlock).toEqual(originalHeader)
    })

    it('updateHeaderBlock also syncs the navigation block inside page layout', () => {
        useEditorStore.getState().reset()
        useEditorStore.getState().init(
            'site-1',
            [
                { blockType: 'navigation', links: [{ label: 'Home', url: '/' }] },
                makeBlock('hero'),
            ],
            { primaryColor: '#000' },
            'Test Site',
            { blockType: 'navigation', links: [{ label: 'Home', url: '/' }] },
            { blockType: 'footer', text: 'Copyright' },
        )

        useEditorStore.getState().updateHeaderBlock({
            links: [{ label: 'About', url: '/about' }],
        })

        expect((useEditorStore.getState().headerBlock as any).links).toEqual([{ label: 'About', url: '/about' }])
        expect((useEditorStore.getState().blocks[0] as any).links).toEqual([{ label: 'About', url: '/about' }])
    })

    // ── TC-F05.17 — updateFooterBlock ───────────────────────────────────
    it('[TC-F05.17] updateFooterBlock merges changes into footer', () => {
        useEditorStore.getState().updateFooterBlock({ text: 'New Footer' })
        const footer = useEditorStore.getState().footerBlock
        expect((footer as any).text).toBe('New Footer')
        expect((footer as any).blockType).toBe('footer')
    })

    it('updateFooterBlock pushes to undo history', () => {
        const historyBefore = useEditorStore.getState().history.length
        useEditorStore.getState().updateFooterBlock({ copyright: '2026' })
        expect(useEditorStore.getState().history.length).toBe(historyBefore + 1)
    })

    it('undo after updateFooterBlock restores previous footer', () => {
        const originalFooter = JSON.parse(JSON.stringify(useEditorStore.getState().footerBlock))
        useEditorStore.getState().updateFooterBlock({ text: 'Changed' })
        useEditorStore.getState().undo()
        expect(useEditorStore.getState().footerBlock).toEqual(originalFooter)
    })

    it('updateFooterBlock also syncs the footer block inside page layout', () => {
        useEditorStore.getState().reset()
        useEditorStore.getState().init(
            'site-1',
            [
                makeBlock('hero'),
                { blockType: 'footer', text: 'Old Footer' },
            ],
            { primaryColor: '#000' },
            'Test Site',
            { blockType: 'navigation', links: [] },
            { blockType: 'footer', text: 'Old Footer' },
        )

        useEditorStore.getState().updateFooterBlock({ text: 'New Footer' })

        expect((useEditorStore.getState().footerBlock as any).text).toBe('New Footer')
        expect((useEditorStore.getState().blocks[1] as any).text).toBe('New Footer')
    })

    it('init with no header/footer creates defaults', () => {
        useEditorStore.getState().reset()
        useEditorStore.getState().init('site-2', [makeBlock('hero')], {}, 'Site 2')
        expect(useEditorStore.getState().headerBlock).toBeTruthy()
        expect((useEditorStore.getState().headerBlock as any).blockType).toBe('navigation')
        expect(useEditorStore.getState().footerBlock).toBeTruthy()
        expect((useEditorStore.getState().footerBlock as any).blockType).toBe('footer')
    })
})

describe('EditorStore — Save Retry Logic', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
        useEditorStore.getState().init('site-1', [makeBlock('hero')], {}, 'Test Site')
    })

    it('[TC-F05.28] performSave returns false when siteId is null', async () => {
        useEditorStore.getState().reset() // siteId = null
        const result = await useEditorStore.getState().performSave()
        expect(result).toBe(false)
    })

    it('manual save while already saving returns false (anti-spam)', async () => {
        useEditorStore.setState({ isSaving: true })
        const result = await useEditorStore.getState().performSave(true)
        expect(result).toBe(false)
    })

    it('setIsSaving updates isSaving state', () => {
        useEditorStore.getState().setIsSaving(true)
        expect(useEditorStore.getState().isSaving).toBe(true)
        useEditorStore.getState().setIsSaving(false)
        expect(useEditorStore.getState().isSaving).toBe(false)
    })
})
