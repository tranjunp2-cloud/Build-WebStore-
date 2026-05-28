/**
 * F26-05: Language switcher + per-locale storage — unit tests
 * TC-IDs: F26-05-01 → F26-05-10
 *
 * Covers:
 *   AC-1: Switcher shows active locale
 *   AC-2: Switch EN↔BM; per-locale overrides preserved across switches
 *   AC-3: Business data (raw block fields not in localeOverrides) unchanged on switch
 *   Store: setLocaleOverride, getDisplayBlock, initLocaleFromBlock
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '@/store/editorStore'
import type { BlockData } from '@/store/editorStore'

// Reset store between tests
beforeEach(() => {
    useEditorStore.getState().reset()
})

// ── AC-1: Active locale tracking ──────────────────────────────────────────────

describe('TC-F26-05-01: activeLocale defaults to "en"', () => {
    it('store starts with activeLocale = "en"', () => {
        expect(useEditorStore.getState().activeLocale).toBe('en')
    })
})

describe('TC-F26-05-02: setActiveLocale changes activeLocale', () => {
    it('switches from en to ms', () => {
        useEditorStore.getState().setActiveLocale('ms')
        expect(useEditorStore.getState().activeLocale).toBe('ms')
    })

    it('switches back from ms to en', () => {
        useEditorStore.getState().setActiveLocale('ms')
        useEditorStore.getState().setActiveLocale('en')
        expect(useEditorStore.getState().activeLocale).toBe('en')
    })
})

// ── setLocaleOverride ─────────────────────────────────────────────────────────

describe('TC-F26-05-03: setLocaleOverride stores fields per-locale', () => {
    it('stores EN override independently from MS override', () => {
        const { setLocaleOverride } = useEditorStore.getState()
        setLocaleOverride('block-1', 'en', { headline: 'My Shop' })
        setLocaleOverride('block-1', 'ms', { headline: 'Kedai Saya' })

        const { localeOverrides } = useEditorStore.getState()
        expect(localeOverrides['block-1']['en']['headline']).toBe('My Shop')
        expect(localeOverrides['block-1']['ms']['headline']).toBe('Kedai Saya')
    })

    it('merges multiple calls for same locale (does not replace)', () => {
        const { setLocaleOverride } = useEditorStore.getState()
        setLocaleOverride('block-2', 'ms', { headline: 'Kedai' })
        setLocaleOverride('block-2', 'ms', { ctaLabel: 'Beli' })

        const override = useEditorStore.getState().localeOverrides['block-2']['ms']
        expect(override['headline']).toBe('Kedai')
        expect(override['ctaLabel']).toBe('Beli')
    })
})

// ── AC-2: getDisplayBlock — locale override wins ──────────────────────────────

describe('TC-F26-05-04: getDisplayBlock — EN locale returns raw block', () => {
    it('returns raw block when activeLocale = "en" and no override', () => {
        useEditorStore.getState().setActiveLocale('en')
        const block = { id: 'b1', blockType: 'hero', headline: 'Welcome' } as unknown as BlockData
        const display = useEditorStore.getState().getDisplayBlock(block)
        expect((display as unknown as Record<string, unknown>)['headline']).toBe('Welcome')
    })
})

describe('TC-F26-05-05: getDisplayBlock — ms locale merges locale override', () => {
    it('merges localeOverrides[blockId][ms] onto block', () => {
        useEditorStore.getState().setActiveLocale('ms')
        useEditorStore.getState().setLocaleOverride('b2', 'ms', { headline: 'Kedai Saya' })

        const block = { id: 'b2', blockType: 'hero', headline: 'Welcome', shopName: 'Ali Bakery' } as unknown as BlockData
        const display = useEditorStore.getState().getDisplayBlock(block) as unknown as Record<string, unknown>

        // Override wins for localizable field
        expect(display['headline']).toBe('Kedai Saya')
        // Business data field not in override → preserved as-is
        expect(display['shopName']).toBe('Ali Bakery')
    })
})

describe('TC-F26-05-06: getDisplayBlock — ms locale no override → BM defaults', () => {
    it('falls back to resolved BM defaults for known block types', () => {
        useEditorStore.getState().setActiveLocale('ms')

        const block = { id: 'b3', blockType: 'hero', headline: 'Welcome to Your Brand' } as unknown as BlockData
        const display = useEditorStore.getState().getDisplayBlock(block) as unknown as Record<string, unknown>

        // Should resolve BM defaults (Selamat Datang) since no user override
        expect(typeof display['headline']).toBe('string')
        // Should NOT show the original EN headline (BM defaults applied)
        expect(display['headline']).not.toBe('Welcome to Your Brand')
    })
})

// ── AC-2: Round-trip EN edit survives locale switch ───────────────────────────

describe('TC-F26-05-07: EN edit preserved after EN→BM→EN round-trip', () => {
    it('"My Shop" survives switch to BM and back to EN', () => {
        const { setLocaleOverride, setActiveLocale } = useEditorStore.getState()

        // User edits headline in EN
        setLocaleOverride('block-hero', 'en', { headline: 'My Shop' })
        setActiveLocale('en')

        // Switch to BM
        setActiveLocale('ms')
        const msOverride = useEditorStore.getState().localeOverrides['block-hero']?.['en']
        // EN slot unchanged
        expect(msOverride?.['headline']).toBe('My Shop')

        // Switch back to EN
        setActiveLocale('en')
        const enOverride = useEditorStore.getState().localeOverrides['block-hero']['en']
        expect(enOverride['headline']).toBe('My Shop')
    })
})

// ── AC-3: Business data unchanged ─────────────────────────────────────────────

describe('TC-F26-05-08: Business data not affected by locale switch', () => {
    it('shopName (business data) survives EN→BM switch unchanged', () => {
        useEditorStore.getState().setActiveLocale('en')
        const block = {
            id: 'b4',
            blockType: 'hero',
            headline: 'Welcome',
            shopName: 'Kedai Mak Cik',  // business data — not in localeOverrides
        } as unknown as BlockData

        // Switch to BM — no override for b4
        useEditorStore.getState().setActiveLocale('ms')
        const display = useEditorStore.getState().getDisplayBlock(block) as unknown as Record<string, unknown>

        // shopName is not a template field → preserved from raw block
        expect(display['shopName']).toBe('Kedai Mak Cik')
    })
})

// ── initLocaleFromBlock ───────────────────────────────────────────────────────

describe('TC-F26-05-09: initLocaleFromBlock — both en and ms populated', () => {
    it('populates both en and ms slots with defaults', () => {
        const { initLocaleFromBlock } = useEditorStore.getState()
        initLocaleFromBlock('block-faq', {
            en: { headline: 'FAQ' },
            ms: { headline: 'Soalan Lazim' },
        })

        const overrides = useEditorStore.getState().localeOverrides['block-faq']
        // EN slot is seeded with EN defaults so switching to EN on an ms site shows correct EN content
        expect(overrides['en']).toEqual({ headline: 'FAQ' })
        expect(overrides['ms']['headline']).toBe('Soalan Lazim')
    })

    it('does not overwrite existing user edits on re-init', () => {
        const { initLocaleFromBlock, setLocaleOverride } = useEditorStore.getState()
        // User already edited
        setLocaleOverride('block-hero', 'ms', { headline: 'Kedai Saya' })
        // Re-init should not overwrite
        initLocaleFromBlock('block-hero', {
            en: { headline: 'Welcome' },
            ms: { headline: 'Selamat Datang' },
        })
        const overrides = useEditorStore.getState().localeOverrides['block-hero']
        expect(overrides['ms']['headline']).toBe('Kedai Saya')
    })
})

// ── localeOverrides empty → getDisplayBlock safe ──────────────────────────────

describe('TC-F26-05-10: getDisplayBlock safe when localeOverrides empty', () => {
    it('does not throw for block with no entry in localeOverrides', () => {
        useEditorStore.getState().setActiveLocale('ms')
        const block = { id: 'unknown-block', blockType: 'faq', headline: 'FAQ' } as unknown as BlockData
        expect(() => useEditorStore.getState().getDisplayBlock(block)).not.toThrow()
    })
})

// ── EN setLocaleOverride edit wins over seeded EN defaults (H1 regression) ────

describe('TC-F26-05-11: EN user edit wins over initLocaleFromBlock seeded defaults', () => {
    it('setLocaleOverride EN edit wins over initLocaleFromBlock en slot', () => {
        const { setActiveLocale, initLocaleFromBlock, setLocaleOverride, getDisplayBlock } = useEditorStore.getState()
        setActiveLocale('en')
        // Simulate block drop: init seeds EN defaults
        initLocaleFromBlock('block-h1', {
            en: { headline: 'Welcome to Your Brand' },
            ms: { headline: 'Selamat Datang' },
        })
        // Simulate user typing in EN — EN edits now route through setLocaleOverride
        setLocaleOverride('block-h1', 'en', { headline: 'My Custom Title' })
        const flatBlock = { id: 'block-h1', blockType: 'hero', headline: 'Welcome to Your Brand' } as unknown as BlockData
        const display = getDisplayBlock(flatBlock) as Record<string, unknown>
        // User's setLocaleOverride edit must win over seeded defaults
        expect(display['headline']).toBe('My Custom Title')
    })

    it('initLocaleFromBlock populates en slot with EN defaults', () => {
        const { initLocaleFromBlock } = useEditorStore.getState()
        initLocaleFromBlock('block-h2', {
            en: { headline: 'Template EN' },
            ms: { headline: 'Template MS' },
        })
        const overrides = useEditorStore.getState().localeOverrides['block-h2']
        // EN slot is seeded — user EN edits via setLocaleOverride merge on top and win
        expect(overrides?.['en']).toEqual({ headline: 'Template EN' })
    })
})

// ── TC-F26-05-12: Reload after locale switch — generationLocale fix ───────────
// Regression: before fix, siteLocale was set from Sites.locale (user-changeable),
// causing flat blocks (stored in generation locale) to show as-is in wrong locale.

describe('TC-F26-05-12: reload after locale switch uses generationLocale as siteLocale', () => {
    it('getDisplayBlock returns EN defaults when siteLocale=ms, activeLocale=en, no override', () => {
        // Simulate reload after: gen BM → user switched to EN
        // editor sets siteLocale = generationLocale ('ms'), activeLocale = Sites.locale ('en')
        const { setSiteLocale, setActiveLocale, getDisplayBlock } = useEditorStore.getState()
        setSiteLocale('ms')
        setActiveLocale('en')

        // Flat block has BM content (as stored by AI generation)
        const flatBlock = { id: 'block-r1', blockType: 'hero', headline: 'Selamat datang' } as unknown as BlockData

        const display = getDisplayBlock(flatBlock) as Record<string, unknown>

        // Must NOT return BM flat content — activeLocale differs from siteLocale
        // so getDisplayBlock resolves EN locale defaults instead
        expect(display['headline']).not.toBe('Selamat datang')
    })

    it('getDisplayBlock returns flat BM block when siteLocale=ms, activeLocale=ms', () => {
        // Confirm: BM stays correct when user confirms BM (no switch)
        const { setSiteLocale, setActiveLocale, getDisplayBlock } = useEditorStore.getState()
        setSiteLocale('ms')
        setActiveLocale('ms')

        const flatBlock = { id: 'block-r2', blockType: 'hero', headline: 'Selamat datang' } as unknown as BlockData
        const display = getDisplayBlock(flatBlock) as Record<string, unknown>

        // activeLocale === siteLocale → flat block returned as-is
        expect(display['headline']).toBe('Selamat datang')
    })

    it('getDisplayBlock returns BM defaults when siteLocale=en, activeLocale=ms, no override', () => {
        // Simulate: gen EN → user switched to BM
        const { setSiteLocale, setActiveLocale, getDisplayBlock } = useEditorStore.getState()
        setSiteLocale('en')
        setActiveLocale('ms')

        const flatBlock = { id: 'block-r3', blockType: 'hero', headline: 'Welcome to Your Brand' } as unknown as BlockData
        const display = getDisplayBlock(flatBlock) as Record<string, unknown>

        // Must NOT return EN flat content
        expect(display['headline']).not.toBe('Welcome to Your Brand')
    })
})
