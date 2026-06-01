/**
 * F26-07: Language Switcher block — header-lock via NavigationConfig (unit-testable subset)
 * TC-IDs: TC-F26-07-02, 07-03, 07-04, 07-09
 *
 * Covers:
 *   TC-07-02: updateHeaderBlock({ showLanguageSwitcher: true }) → flag set in headerBlock
 *   TC-07-03: Language Switcher NOT in page.blocks[] after flag is set
 *   TC-07-04: updateHeaderBlock({ showLanguageSwitcher: false }) → flag cleared
 *   TC-07-09: showLanguageSwitcher persists across store state reads
 *
 * Deferred:
 *   TC-07-01: Navigation category in BlockLibraryPanel — component render test
 *   TC-07-05/06: Desktop/mobile layout — Playwright E2E
 *   TC-07-07: No onClick on storefront placeholder — storefront E2E / component render
 *   TC-07-08: Error when no nav block — editor UX, E2E/integration
 *
 * Rationale: updateHeaderBlock is the canonical path for setting showLanguageSwitcher
 * in F26 (per navigation/config.ts NavigationConfig type). page.blocks[] is managed
 * independently — adding the language switcher via the nav flag must NOT push any
 * entry into page.blocks[].
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '@/store/editorStore'
import type { BlockData } from '@/store/editorStore'
import { NavigationConfigSchema } from '@/blocks/navigation/config'

// ── Store cleanup ──────────────────────────────────────────────────────────────

beforeEach(() => {
    useEditorStore.getState().reset()
})

// ── TC-F26-07-02: Add Language Switcher → showLanguageSwitcher = true ─────────

describe('[TC-F26-07-02] updateHeaderBlock sets showLanguageSwitcher = true', () => {
    it('TC-F26-07-02: headerBlock.showLanguageSwitcher becomes true after updateHeaderBlock', () => {
        // Arrange — initialise with a navigation header block
        const headerBlock: BlockData = {
            blockType: 'navigation',
            links: [],
            showLanguageSwitcher: false,
        }
        useEditorStore.getState().init(
            'site-1',
            [],                    // page blocks (empty)
            {},                    // theme
            'Test Site',
            headerBlock,           // header
            null,                  // footer
        )

        // Act — simulate "Add Language Switcher" via updateHeaderBlock
        useEditorStore.getState().updateHeaderBlock({ showLanguageSwitcher: true })

        // Assert
        const { headerBlock: updated } = useEditorStore.getState()
        expect((updated as Record<string, unknown>)?.showLanguageSwitcher).toBe(true)
    })

    it('TC-F26-07-02: headerBlock retains other fields when showLanguageSwitcher toggled', () => {
        // Arrange
        const headerBlock: BlockData = {
            blockType: 'navigation',
            logoText: 'My Brand',
            links: [{ label: 'Home', url: '/' }],
            showLanguageSwitcher: false,
        }
        useEditorStore.getState().init('site-2', [], {}, 'My Brand', headerBlock, null)

        // Act
        useEditorStore.getState().updateHeaderBlock({ showLanguageSwitcher: true })

        // Assert — other nav fields preserved
        const { headerBlock: updated } = useEditorStore.getState()
        const h = updated as Record<string, unknown>
        expect(h?.showLanguageSwitcher).toBe(true)
        expect(h?.logoText).toBe('My Brand')
        expect(Array.isArray(h?.links)).toBe(true)
    })

    it('TC-F26-07-02: showLanguageSwitcher starts as falsy when not set', () => {
        // Arrange
        const headerBlock: BlockData = {
            blockType: 'navigation',
            links: [],
        }
        useEditorStore.getState().init('site-3', [], {}, 'Brand', headerBlock, null)

        // Assert — not set → falsy
        const { headerBlock: h } = useEditorStore.getState()
        expect(!!(h as Record<string, unknown>)?.showLanguageSwitcher).toBe(false)
    })
})

// ── TC-F26-07-03: Language Switcher NOT in page.blocks[] ──────────────────────

describe('[TC-F26-07-03] showLanguageSwitcher flag does NOT add entry to page.blocks[]', () => {
    it('TC-F26-07-03: page.blocks[] unchanged after updateHeaderBlock showLanguageSwitcher=true', () => {
        // Arrange — init with 2 page blocks
        const initialBlocks: BlockData[] = [
            { blockType: 'hero', headline: 'Welcome' },
            { blockType: 'faq', headline: 'FAQ' },
        ]
        const headerBlock: BlockData = { blockType: 'navigation', links: [] }
        useEditorStore.getState().init('site-4', initialBlocks, {}, 'Brand', headerBlock, null)

        // Act — turn on Language Switcher via nav flag
        useEditorStore.getState().updateHeaderBlock({ showLanguageSwitcher: true })

        // Assert — page.blocks[] still has exactly 2 entries, none are 'language-switcher'
        const { blocks } = useEditorStore.getState()
        expect(blocks).toHaveLength(2)
        const langSwitcherInBlocks = blocks.some(b => b.blockType === 'language-switcher')
        expect(langSwitcherInBlocks).toBe(false)
    })

    it('TC-F26-07-03: page.blocks[] is empty and stays empty after enabling language switcher', () => {
        // Arrange
        const headerBlock: BlockData = { blockType: 'navigation', links: [] }
        useEditorStore.getState().init('site-5', [], {}, 'Brand', headerBlock, null)

        // Act
        useEditorStore.getState().updateHeaderBlock({ showLanguageSwitcher: true })

        // Assert
        const { blocks } = useEditorStore.getState()
        expect(blocks).toHaveLength(0)
    })

    it('TC-F26-07-03: Language Switcher lives only in headerBlock, not in blocks array', () => {
        // Arrange
        const headerBlock: BlockData = { blockType: 'navigation', links: [] }
        useEditorStore.getState().init('site-6', [{ blockType: 'hero' }], {}, 'Brand', headerBlock, null)

        // Act
        useEditorStore.getState().updateHeaderBlock({ showLanguageSwitcher: true })

        // Assert — headerBlock has flag, blocks array does NOT
        const state = useEditorStore.getState()
        expect((state.headerBlock as Record<string, unknown>)?.showLanguageSwitcher).toBe(true)
        const anyBlockHasFlag = state.blocks.some(
            b => (b as Record<string, unknown>).showLanguageSwitcher === true,
        )
        expect(anyBlockHasFlag).toBe(false)
    })
})

// ── TC-F26-07-04: Remove Language Switcher → showLanguageSwitcher = false ─────

describe('[TC-F26-07-04] updateHeaderBlock clears showLanguageSwitcher = false', () => {
    it('TC-F26-07-04: showLanguageSwitcher becomes false after removal', () => {
        // Arrange — Language Switcher is active
        const headerBlock: BlockData = {
            blockType: 'navigation',
            links: [],
            showLanguageSwitcher: true,
        }
        useEditorStore.getState().init('site-7', [], {}, 'Brand', headerBlock, null)

        // Verify initial state
        expect(
            (useEditorStore.getState().headerBlock as Record<string, unknown>)?.showLanguageSwitcher,
        ).toBe(true)

        // Act — simulate "Remove Language Switcher"
        useEditorStore.getState().updateHeaderBlock({ showLanguageSwitcher: false })

        // Assert
        const { headerBlock: updated } = useEditorStore.getState()
        expect((updated as Record<string, unknown>)?.showLanguageSwitcher).toBe(false)
    })

    it('TC-F26-07-04: page.blocks[] not affected by removal of language switcher flag', () => {
        // Arrange
        const headerBlock: BlockData = { blockType: 'navigation', links: [], showLanguageSwitcher: true }
        const blocks: BlockData[] = [{ blockType: 'hero' }, { blockType: 'contact' }]
        useEditorStore.getState().init('site-8', blocks, {}, 'Brand', headerBlock, null)

        // Act
        useEditorStore.getState().updateHeaderBlock({ showLanguageSwitcher: false })

        // Assert
        const { blocks: updatedBlocks } = useEditorStore.getState()
        expect(updatedBlocks).toHaveLength(2)
    })

    it('TC-F26-07-04: toggle on then off results in false', () => {
        // Arrange
        const headerBlock: BlockData = { blockType: 'navigation', links: [] }
        useEditorStore.getState().init('site-9', [], {}, 'Brand', headerBlock, null)

        // Act — on, then off
        useEditorStore.getState().updateHeaderBlock({ showLanguageSwitcher: true })
        useEditorStore.getState().updateHeaderBlock({ showLanguageSwitcher: false })

        // Assert
        const { headerBlock: final } = useEditorStore.getState()
        expect((final as Record<string, unknown>)?.showLanguageSwitcher).toBe(false)
    })
})

// ── TC-F26-07-09: showLanguageSwitcher persists in store state ─────────────────

describe('[TC-F26-07-09] showLanguageSwitcher persists across store reads', () => {
    it('TC-F26-07-09: flag is readable from store state after set', () => {
        // Arrange
        const headerBlock: BlockData = { blockType: 'navigation', links: [] }
        useEditorStore.getState().init('site-10', [], {}, 'Brand', headerBlock, null)
        useEditorStore.getState().updateHeaderBlock({ showLanguageSwitcher: true })

        // Act — read state multiple times (simulates F27 renderer reading the flag)
        const read1 = (useEditorStore.getState().headerBlock as Record<string, unknown>)?.showLanguageSwitcher
        const read2 = (useEditorStore.getState().headerBlock as Record<string, unknown>)?.showLanguageSwitcher
        const read3 = (useEditorStore.getState().headerBlock as Record<string, unknown>)?.showLanguageSwitcher

        // Assert — value stable across reads
        expect(read1).toBe(true)
        expect(read2).toBe(true)
        expect(read3).toBe(true)
    })

    it('TC-F26-07-09: showLanguageSwitcher survives other header field updates', () => {
        // Arrange — set flag then update a different field
        const headerBlock: BlockData = { blockType: 'navigation', links: [], logoText: 'Old' }
        useEditorStore.getState().init('site-11', [], {}, 'Brand', headerBlock, null)
        useEditorStore.getState().updateHeaderBlock({ showLanguageSwitcher: true })

        // Act — update an unrelated nav field
        useEditorStore.getState().updateHeaderBlock({ logoText: 'New Brand' })

        // Assert — language switcher flag NOT reset by unrelated update
        const { headerBlock: updated } = useEditorStore.getState()
        const h = updated as Record<string, unknown>
        expect(h?.showLanguageSwitcher).toBe(true)
        expect(h?.logoText).toBe('New Brand')
    })

    it('TC-F26-07-09: flag readable after locale switch (not affected by activeLocale)', () => {
        // Arrange
        const headerBlock: BlockData = { blockType: 'navigation', links: [], showLanguageSwitcher: true }
        useEditorStore.getState().init('site-12', [], {}, 'Brand', headerBlock, null)

        // Act — switch locale (simulates user switching language)
        useEditorStore.getState().setActiveLocale('ms')
        useEditorStore.getState().setActiveLocale('en')

        // Assert — flag unaffected by locale switching
        const { headerBlock: h } = useEditorStore.getState()
        expect((h as Record<string, unknown>)?.showLanguageSwitcher).toBe(true)
    })
})

// ── NavigationConfigSchema validation (structural) ────────────────────────────

describe('NavigationConfigSchema includes showLanguageSwitcher as optional boolean', () => {
    it('TC-F26-07-02: schema accepts showLanguageSwitcher=true', () => {
        // Arrange
        const config = {
            blockType: 'navigation' as const,
            links: [],
            showLanguageSwitcher: true,
        }

        // Act
        const result = NavigationConfigSchema.safeParse(config)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.showLanguageSwitcher).toBe(true)
        }
    })

    it('TC-F26-07-04: schema accepts showLanguageSwitcher=false', () => {
        // Arrange
        const config = {
            blockType: 'navigation' as const,
            links: [],
            showLanguageSwitcher: false,
        }

        // Act
        const result = NavigationConfigSchema.safeParse(config)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.showLanguageSwitcher).toBe(false)
        }
    })

    it('TC-F26-07-03: schema accepts navigation without showLanguageSwitcher (optional field)', () => {
        // Arrange — no showLanguageSwitcher field
        const config = {
            blockType: 'navigation' as const,
            links: [],
        }

        // Act
        const result = NavigationConfigSchema.safeParse(config)

        // Assert — optional field — schema still passes
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.showLanguageSwitcher).toBeUndefined()
        }
    })
})
