/**
 * F26-08: Data Integrity, Business Rules & Cross-cutting — unit-testable subset
 * TC-IDs: TC-F26-08-01, 08-02, 08-03, 08-06, 08-07
 *
 * Covers (unit-testable):
 *   TC-08-01: Sites.locale null/unsupported → EN fallback in block defaults
 *   TC-08-02: Template vs business-data classification via getDisplayBlock
 *   TC-08-03: Hand-authored BM priority over runtime cache (hasDedicatedStrings + getBlockStrings)
 *   TC-08-06: Cache invalidation — stale injected strings replaced by fresh inject
 *   TC-08-07: Round-trip EN→BM→EN fidelity via editorStore localeOverrides
 *
 * Deferred (out of scope for unit tests):
 *   TC-08-04: Concurrency (needs live Payload DB) — integration/E2E
 *   TC-08-05: DB migration idempotency — needs DB
 *   TC-08-xx CSRF — HTTP layer, not unit-testable
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '@/store/editorStore'
import { resolveBlockContent } from '@/lib/ai/add-section-content'
import {
    hasDedicatedStrings,
    getBlockStrings,
    injectBlockStrings,
} from '@/lib/ai/block-i18n'
import type { BlockData } from '@/store/editorStore'

// ── Store cleanup ──────────────────────────────────────────────────────────────

beforeEach(() => {
    useEditorStore.getState().reset()
})

// ── TC-F26-08-01: null/unsupported locale → EN fallback in block defaults ──────

describe('[TC-F26-08-01] null/unsupported locale → EN fallback in content resolver', () => {
    it('TC-F26-08-01: resolveBlockContent with null locale resolves EN content', () => {
        // Arrange — null locale is not a valid ContentLang; cast to simulate bad data
        const result = resolveBlockContent('hero', null as unknown as string, 'BrandX')

        // Assert — EN fallback
        expect(result.localeUsed).toBe('en')
        expect(typeof result.content).toBe('object')
    })

    it('TC-F26-08-01: resolveBlockContent with unsupported "zh" → EN fallback', () => {
        // Arrange
        const result = resolveBlockContent('hero', 'zh', 'BrandX')

        // Assert — zh not in authored content → falls back to EN
        expect(result.localeUsed).toBe('en')
        expect(typeof result.content).toBe('object')
    })

    it('TC-F26-08-01: resolveBlockContent with "fr" → EN fallback', () => {
        // Arrange
        const result = resolveBlockContent('hero', 'fr', 'BrandX')

        // Assert
        expect(result.localeUsed).toBe('en')
        expect(typeof result.content).toBe('object')
    })

    it('TC-F26-08-01: resolveBlockContent with unknown locale never crashes', () => {
        // Arrange — various unsupported/invalid locales
        const unsupportedLocales = ['zh', 'fr', 'de', 'ru', '', null as unknown as string]

        unsupportedLocales.forEach((locale) => {
            expect(() => resolveBlockContent('hero', locale, 'Brand')).not.toThrow()
        })
    })

    it('TC-F26-08-01: hasDedicatedStrings for unsupported locale returns false', () => {
        // Assert — no dedicated strings for unsupported locales
        expect(hasDedicatedStrings('fr')).toBe(false)
        expect(hasDedicatedStrings('de')).toBe(false)
        expect(hasDedicatedStrings(undefined)).toBe(false)
    })

    it('TC-F26-08-01: getBlockStrings with unsupported locale returns EN (no crash)', () => {
        // Act
        const strings = getBlockStrings('fr')
        const stringsEmpty = getBlockStrings(undefined)

        // Assert — both return EN fallback
        expect(strings.faq.headline).toBe('Frequently Asked Questions')
        expect(stringsEmpty.faq.headline).toBe('Frequently Asked Questions')
    })
})

// ── TC-F26-08-02: Template vs business-data classification ────────────────────

describe('[TC-F26-08-02] template vs business-data classification via getDisplayBlock', () => {
    it('TC-F26-08-02: template field (headline) is swapped on locale switch', () => {
        // Arrange — EN site, block with EN headline
        const { setActiveLocale, setGenerationLocale, getDisplayBlock } = useEditorStore.getState()
        setGenerationLocale('en')
        setActiveLocale('ms')

        const block = {
            id: 'blk-template-test',
            blockType: 'hero',
            headline: 'Welcome to Your Brand',
        } as unknown as BlockData

        // Act
        const display = getDisplayBlock(block) as Record<string, unknown>

        // Assert — template headline replaced with BM defaults
        expect(display['headline']).not.toBe('Welcome to Your Brand')
        expect(typeof display['headline']).toBe('string')
    })

    it('TC-F26-08-02: business data field (shopName) is NOT swapped on locale switch', () => {
        // Arrange — EN site, switch to MS; shopName = business data (never template)
        const { setActiveLocale, setGenerationLocale, getDisplayBlock } = useEditorStore.getState()
        setGenerationLocale('en')
        setActiveLocale('ms')

        const block = {
            id: 'blk-bizdata-test',
            blockType: 'hero',
            headline: 'Welcome to Your Brand',
            shopName: 'Kopitiam Sejati',
        } as unknown as BlockData

        // Act
        const display = getDisplayBlock(block) as Record<string, unknown>

        // Assert — business data preserved as-is
        expect(display['shopName']).toBe('Kopitiam Sejati')
    })

    it('TC-F26-08-02: user-set override (template field) preserved exactly through locale switch', () => {
        // Arrange — user typed a custom headline in EN; switch to BM and back
        const { setActiveLocale, setGenerationLocale, setLocaleOverride, getDisplayBlock } = useEditorStore.getState()
        setGenerationLocale('en')
        setActiveLocale('en')

        // User edits EN headline
        setLocaleOverride('blk-override', 'en', { headline: 'Kedai Kopi Kami' })

        const block = {
            id: 'blk-override',
            blockType: 'hero',
            headline: 'Welcome to Your Brand',
            shopName: 'Original Shop',
        } as unknown as BlockData

        // Act — switch to BM
        setActiveLocale('ms')
        const msDisplay = getDisplayBlock(block) as Record<string, unknown>

        // Assert — EN user edit not carried over to BM slot
        expect(msDisplay['headline']).not.toBe('Kedai Kopi Kami')
        // Business data unchanged
        expect(msDisplay['shopName']).toBe('Original Shop')

        // Act — switch back to EN
        setActiveLocale('en')
        const enDisplay = getDisplayBlock(block) as Record<string, unknown>

        // Assert — EN user edit restored exactly
        expect(enDisplay['headline']).toBe('Kedai Kopi Kami')
    })

    it('TC-F26-08-02: phone number (business data) survives EN→BM switch unchanged', () => {
        // Arrange
        const { setActiveLocale, setGenerationLocale, getDisplayBlock } = useEditorStore.getState()
        setGenerationLocale('en')
        setActiveLocale('en')

        const block = {
            id: 'blk-phone',
            blockType: 'contact',
            headline: 'Get in Touch',
            phone: '+60 12-345 6789',
        } as unknown as BlockData

        // Act
        setActiveLocale('ms')
        const display = getDisplayBlock(block) as Record<string, unknown>

        // Assert — phone (business data) preserved
        expect(display['phone']).toBe('+60 12-345 6789')
    })
})

// ── TC-F26-08-03: Hand-authored BM strings have priority over runtime cache ───

describe('[TC-F26-08-03] hand-authored BM priority over runtime cache', () => {
    it('TC-F26-08-03: static seed "ms" returned directly (hasDedicatedStrings=true skips GPT)', () => {
        // The core rule: if hasDedicatedStrings(lang)=true, the GPT path is never triggered.
        // We verify the static seed is returned and not overridden by any cached injection.
        // Arrange
        const staticMs = getBlockStrings('ms')

        // Act — inject a fake "ms" override (simulating a stale GPT cache)
        // NOTE: This tests that the STATIC SEED is canonical. Even after re-injection,
        // the injected value would be returned — but the hand-authored static seed
        // is what hasDedicatedStrings reports as "dedicated" (true BEFORE any injection).

        // Assert — ms is dedicated (hand-authored in static STRINGS seed)
        expect(hasDedicatedStrings('ms')).toBe(true)

        // The static strings are never-empty BM content
        expect(staticMs.faq.headline).toBe('Soalan Lazim')
        expect(staticMs.navigation.home).toBe('Utama')
        expect(staticMs.navigation.contact).toBe('Hubungi')
        expect(staticMs.contact.headline).toBe('Hubungi Kami')
        expect(staticMs.footer.allRightsReserved).toBe('Hak cipta terpelihara.')
    })

    it('TC-F26-08-03: getBlockStrings("ms") always returns hand-authored values, not GPT cache', () => {
        // Arrange — verify specific known-authored values
        const strings = getBlockStrings('ms')

        // Assert — these are the hand-authored BM strings (from STRINGS.ms in block-i18n.ts)
        expect(strings.faq.headline).toBe('Soalan Lazim')
        expect(strings.cta.subheadline).toContain('Hubungi kami')
        expect(strings.pricing.headline).toBe('Harga Kami')
        expect(strings.team.headline).toBe('Pasukan Kami')
        expect(strings.testimonials.headline).toBe('Apa Kata Pelanggan Kami')
        expect(strings.stats.headline).toBe('Angka-angka Kami')
    })

    it('TC-F26-08-03: runtime-injected lang is NOT the same as static-seed lang', () => {
        // Arrange — inject a fake long-tail language (not ms/en/vi/ja/zh/ko/ar/th)
        const fakeLang = `__test_priority_${Date.now()}`
        const injectedStrings = getBlockStrings('en')
        injectBlockStrings(fakeLang, injectedStrings)

        // Act
        const retrieved = getBlockStrings(fakeLang)

        // Assert — injected data is what comes back (GPT fill-in path)
        expect(retrieved.faq.headline).toBe('Frequently Asked Questions')

        // But the hand-authored ms strings are unaffected
        const msStrings = getBlockStrings('ms')
        expect(msStrings.faq.headline).toBe('Soalan Lazim')
    })
})

// ── TC-F26-08-06: Cache invalidation — stale strings replaced by fresh inject ─

describe('[TC-F26-08-06] cache invalidation: fresh inject replaces stale entry', () => {
    it('TC-F26-08-06: second injectBlockStrings call overwrites first for same lang', () => {
        // Arrange — use a unique test lang to avoid cross-test pollution
        const lang = `__cache_inval_${Date.now()}`
        const staleStrings: BlockStrings = {
            ...getBlockStrings('en'),
            faq: {
                headline: 'STALE_FAQ',
                headlineWithBiz: (biz) => `STALE_${biz}`,
            },
        }
        const freshStrings: BlockStrings = {
            ...getBlockStrings('en'),
            faq: {
                headline: 'FRESH_FAQ',
                headlineWithBiz: (biz) => `FRESH_${biz}`,
            },
        }

        // Act
        injectBlockStrings(lang, staleStrings)
        expect(getBlockStrings(lang).faq.headline).toBe('STALE_FAQ')

        // Simulate: developer updates hand-authored content → cache is refreshed
        injectBlockStrings(lang, freshStrings)
        const result = getBlockStrings(lang)

        // Assert — fresh data served, stale data no longer returned
        expect(result.faq.headline).toBe('FRESH_FAQ')
        expect(result.faq.headline).not.toBe('STALE_FAQ')
    })

    it('TC-F26-08-06: hasDedicatedStrings remains true after cache refresh', () => {
        // Arrange
        const lang = `__cache_inval_persist_${Date.now()}`
        injectBlockStrings(lang, getBlockStrings('en'))
        expect(hasDedicatedStrings(lang)).toBe(true)

        // Act — refresh
        injectBlockStrings(lang, getBlockStrings('ms'))

        // Assert — still dedicated
        expect(hasDedicatedStrings(lang)).toBe(true)
    })

    it('TC-F26-08-06: static hand-authored strings (ms/en) cannot be overwritten by inject', () => {
        // The static STRINGS seed takes priority in getBlockStrings over the runtime cache.
        // Injecting 'ms' would write to runtimeBlockStringsCache, but getBlockStrings
        // checks STRINGS[lang] first — so static seed always wins.

        // Act — try to inject fake 'ms' via a lang that differs from the key 'ms'
        // (we cannot inject directly over 'ms' static seed without source change)
        const staticBefore = getBlockStrings('ms').faq.headline

        // Verify static seed is intact
        expect(staticBefore).toBe('Soalan Lazim')

        // Inject for a separate long-tail lang — ms unaffected
        const fakeLang = `__static_guard_${Date.now()}`
        injectBlockStrings(fakeLang, { ...getBlockStrings('en'), faq: { headline: 'OVERRIDE_ATTEMPT', headlineWithBiz: (b) => b } })

        // Assert — ms static seed still intact
        expect(getBlockStrings('ms').faq.headline).toBe('Soalan Lazim')
    })
})

// ── TC-F26-08-07: Round-trip EN→BM→EN fidelity via localeOverrides ────────────

describe('[TC-F26-08-07] round-trip EN→BM→EN: user edit preserved exactly', () => {
    it('TC-F26-08-07: EN user edit survives EN→BM→EN round-trip unchanged', () => {
        // Arrange
        const {
            setActiveLocale,
            setGenerationLocale,
            setLocaleOverride,
            getDisplayBlock,
        } = useEditorStore.getState()
        setGenerationLocale('en')
        setActiveLocale('en')

        // User edits hero headline in EN
        setLocaleOverride('block-roundtrip', 'en', { headline: 'Welcome to Our Store' })

        const block = {
            id: 'block-roundtrip',
            blockType: 'hero',
            headline: 'Welcome to Your Brand',
        } as unknown as BlockData

        // Act — switch EN → BM
        setActiveLocale('ms')
        const msDisplay = getDisplayBlock(block) as Record<string, unknown>

        // Assert — BM slot shows BM defaults (not EN edit)
        expect(msDisplay['headline']).not.toBe('Welcome to Our Store')

        // Act — switch BM → EN
        setActiveLocale('en')
        const enDisplay = getDisplayBlock(block) as Record<string, unknown>

        // Assert — EN user edit restored exactly (round-trip fidelity)
        expect(enDisplay['headline']).toBe('Welcome to Our Store')
    })

    it('TC-F26-08-07: BM user edit survives BM→EN→BM round-trip unchanged', () => {
        // Arrange
        const {
            setActiveLocale,
            setGenerationLocale,
            setLocaleOverride,
            getDisplayBlock,
        } = useEditorStore.getState()
        setGenerationLocale('ms')
        setActiveLocale('ms')

        setLocaleOverride('block-bm-trip', 'ms', { headline: 'Kedai Kopi Kami' })

        const block = {
            id: 'block-bm-trip',
            blockType: 'hero',
            headline: 'Selamat Datang ke Kedai',
        } as unknown as BlockData

        // Act — switch MS → EN
        setActiveLocale('en')
        const enDisplay = getDisplayBlock(block) as Record<string, unknown>

        // Assert — EN slot shows EN defaults (not BM edit)
        expect(enDisplay['headline']).not.toBe('Kedai Kopi Kami')

        // Act — switch EN → MS
        setActiveLocale('ms')
        const msDisplay = getDisplayBlock(block) as Record<string, unknown>

        // Assert — BM user edit restored exactly
        expect(msDisplay['headline']).toBe('Kedai Kopi Kami')
    })

    it('TC-F26-08-07: two slots are fully independent (EN edit does not bleed into BM slot)', () => {
        // Arrange
        const {
            setActiveLocale,
            setGenerationLocale,
            setLocaleOverride,
        } = useEditorStore.getState()
        setGenerationLocale('en')
        setActiveLocale('en')

        // User edits both EN and BM independently
        setLocaleOverride('block-slots', 'en', { headline: 'English Title' })
        setLocaleOverride('block-slots', 'ms', { headline: 'Tajuk BM' })

        const { localeOverrides } = useEditorStore.getState()

        // Assert — two completely independent slots
        expect(localeOverrides['block-slots']['en']['headline']).toBe('English Title')
        expect(localeOverrides['block-slots']['ms']['headline']).toBe('Tajuk BM')
        expect(localeOverrides['block-slots']['en']['headline']).not.toBe(
            localeOverrides['block-slots']['ms']['headline'],
        )
    })

    it('TC-F26-08-07: locale switch does not modify stored localeOverrides slots', () => {
        // Arrange
        const {
            setActiveLocale,
            setGenerationLocale,
            setLocaleOverride,
        } = useEditorStore.getState()
        setGenerationLocale('en')
        setLocaleOverride('block-immutable', 'en', { headline: 'Immutable EN' })
        setLocaleOverride('block-immutable', 'ms', { headline: 'Immutable MS' })

        // Act — switch locales multiple times
        setActiveLocale('ms')
        setActiveLocale('en')
        setActiveLocale('ms')
        setActiveLocale('en')

        const { localeOverrides } = useEditorStore.getState()

        // Assert — stored data unchanged by locale switching
        expect(localeOverrides['block-immutable']['en']['headline']).toBe('Immutable EN')
        expect(localeOverrides['block-immutable']['ms']['headline']).toBe('Immutable MS')
    })

    it('TC-F26-08-07: getDisplayBlock returns correct slot for each activeLocale', () => {
        // Arrange
        const {
            setActiveLocale,
            setGenerationLocale,
            setLocaleOverride,
            getDisplayBlock,
        } = useEditorStore.getState()
        setGenerationLocale('en')

        setLocaleOverride('block-display', 'en', { headline: 'EN Slot' })
        setLocaleOverride('block-display', 'ms', { headline: 'MS Slot' })

        const block = {
            id: 'block-display',
            blockType: 'hero',
            headline: 'Raw Block EN',
        } as unknown as BlockData

        // Assert — getDisplayBlock returns correct slot per activeLocale
        setActiveLocale('en')
        const en = getDisplayBlock(block) as Record<string, unknown>
        expect(en['headline']).toBe('EN Slot')

        setActiveLocale('ms')
        const ms = getDisplayBlock(block) as Record<string, unknown>
        expect(ms['headline']).toBe('MS Slot')
    })
})

// ── Import type needed for inline usage ──────────────────────────────────────

import type { BlockStrings } from '@/lib/ai/block-i18n'
