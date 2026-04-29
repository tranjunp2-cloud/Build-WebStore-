/**
 * Unit Tests — F05 AI Editor: Save Route Block Normalization
 *
 * Coverage Map (QA Doc Traceability):
 *   TC-F05-save-01  → normalizeUploadField: full media object {id,url,alt} → extract integer id
 *   TC-F05-save-02  → normalizeBlocksForPersistence: block with _id from builder store → stripped
 *   TC-F05-save-03  → normalizeBlocksForPersistence: block headline=undefined → set to ''
 *   TC-F05-save-04  → normalizeBlocksForPersistence: navigation link missing label → fallback 'Link'
 *   TC-F05-save-05  → normalizeUploadField: external URL string → returns null
 *   TC-F05-save-06  → stripNestedIds: ctaButtons with id/_id → stripped
 *   TC-F05-save-07  → normalizeUploadField: image already integer → kept as-is
 *   TC-F05-save-08  → normalizeUploadField: image is null → kept as null
 *   TC-F05-save-09  → normalizeBlocksForPersistence: footer column links null → no crash
 *   TC-F05-save-10  → normalizeBlocksForPersistence: socialWidget block → normalizeSocialWidgetConfig called
 *   TC-F05-save-11  → sanitizeBlockVariant: invalid variant for known block → coerced to defaultVariant
 *   TC-F05-save-12  → sanitizeBlockVariant: valid variant / missing block / empty variant → unchanged
 *   TC-F05-save-13  → normalizeBlocksForPersistence: blog-list with legacy "editorial" variant → coerced to "cards"
 *
 * Source:
 *   src/lib/block-normalization.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    normalizeUploadField,
    stripNestedIds,
    normalizeBlocksForPersistence,
    sanitizeBlockVariant,
} from '@/lib/block-normalization'

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — normalizeUploadField
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeUploadField', () => {

    beforeEach(() => {
        // No global state to reset for pure functions
    })

    // TC-F05-save-01
    it('TC-F05-save-01: full media object {id,url,alt} → extracts integer id', () => {
        // Arrange
        const mediaObject = { id: 42, url: 'https://cdn.example.com/photo.jpg', alt: 'Hero image' }

        // Act
        const result = normalizeUploadField(mediaObject)

        // Assert — only the numeric id is returned, not the whole object
        expect(result).toBe(42)
        expect(typeof result).toBe('number')
    })

    // TC-F05-save-05
    it('TC-F05-save-05: external URL string → returns null (cannot save as media ref)', () => {
        // Arrange
        const externalUrl = 'https://images.unsplash.com/photo-abc123.jpg'

        // Act
        const result = normalizeUploadField(externalUrl)

        // Assert — URL strings cannot be referenced as Payload media, must be null
        expect(result).toBeNull()
    })

    // TC-F05-save-07
    it('TC-F05-save-07: image already an integer → kept as-is', () => {
        // Arrange
        const existingId = 99

        // Act
        const result = normalizeUploadField(existingId)

        // Assert
        expect(result).toBe(99)
    })

    // TC-F05-save-08
    it('TC-F05-save-08: image is null → kept as null', () => {
        // Arrange
        const emptyImage = null

        // Act
        const result = normalizeUploadField(emptyImage)

        // Assert
        expect(result).toBeNull()
    })

    it('TC-F05-save-07b: string of digits → converted to Number', () => {
        // Arrange
        const stringId = '123'

        // Act
        const result = normalizeUploadField(stringId)

        // Assert
        expect(result).toBe(123)
        expect(typeof result).toBe('number')
    })

    it('TC-F05-save-05b: object without id field → returns null', () => {
        // Arrange — malformed media object with no id
        const objectWithoutId = { url: 'https://example.com/img.png', filename: 'img.png' }

        // Act
        const result = normalizeUploadField(objectWithoutId)

        // Assert
        expect(result).toBeNull()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — stripNestedIds
// ─────────────────────────────────────────────────────────────────────────────

describe('stripNestedIds', () => {

    // TC-F05-save-06
    it('TC-F05-save-06: ctaButtons with id/_id → both stripped, other fields preserved', () => {
        // Arrange
        const ctaButtons = [
            { id: 'uuid-abc', _id: 'mongo-abc', label: 'Get Started', url: '/start' },
            { id: 'uuid-def', _id: 'mongo-def', label: 'Learn More', url: '/about' },
        ]

        // Act
        const result = stripNestedIds(ctaButtons)

        // Assert — id and _id removed, other fields intact
        const first = result[0] as Record<string, unknown>
        expect(first).not.toHaveProperty('id')
        expect(first).not.toHaveProperty('_id')
        expect(first.label).toBe('Get Started')
        expect(first.url).toBe('/start')

        const second = result[1] as Record<string, unknown>
        expect(second).not.toHaveProperty('id')
        expect(second).not.toHaveProperty('_id')
        expect(second.label).toBe('Learn More')
    })

    it('TC-F05-save-06b: deeply nested arrays → id/_id stripped at every level', () => {
        // Arrange — simulate sections → items nesting
        const sections = [
            {
                id: 'section-1',
                _id: 'mongo-s1',
                title: 'Features',
                items: [
                    { id: 'item-1', _id: 'mongo-i1', text: 'Fast delivery' },
                    { id: 'item-2', _id: 'mongo-i2', text: 'Free returns' },
                ],
            },
        ]

        // Act
        const result = stripNestedIds(sections)

        // Assert top level
        const section = result[0] as Record<string, unknown>
        expect(section).not.toHaveProperty('id')
        expect(section).not.toHaveProperty('_id')
        expect(section.title).toBe('Features')

        // Assert nested items
        const items = section.items as Record<string, unknown>[]
        expect(items[0]).not.toHaveProperty('id')
        expect(items[0]).not.toHaveProperty('_id')
        expect(items[0].text).toBe('Fast delivery')
        expect(items[1]).not.toHaveProperty('id')
        expect(items[1].text).toBe('Free returns')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — normalizeBlocksForPersistence
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeBlocksForPersistence', () => {

    // TC-F05-save-02
    it('TC-F05-save-02: block with _id from builder store → stripped, only blockType remains', () => {
        // Arrange — builder store attaches _id to every block in memory
        const blocks = [
            {
                _id: 'builder-store-id-xyz',
                blockType: 'hero',
                headline: 'Welcome to our store',
                subheadline: 'Best products online',
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — _id gone, blockType and content preserved
        expect(result[0]).not.toHaveProperty('_id')
        expect(result[0].blockType).toBe('hero')
        expect(result[0].headline).toBe('Welcome to our store')
        expect(result[0].subheadline).toBe('Best products online')
    })

    it('TC-F05-save-02b: block with both id and _id → both stripped', () => {
        // Arrange
        const blocks = [
            {
                id: 'payload-uuid-123',
                _id: 'builder-store-abc',
                blockType: 'features',
                headline: 'Why choose us',
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert
        expect(result[0]).not.toHaveProperty('id')
        expect(result[0]).not.toHaveProperty('_id')
        expect(result[0].blockType).toBe('features')
    })

    // TC-F05-save-03
    it('TC-F05-save-03: block with headline=undefined → normalized to empty string', () => {
        // Arrange — AI builder sometimes omits headline for optional blocks
        const blocks = [
            {
                blockType: 'hero',
                headline: undefined,
                subheadline: 'Great deals await',
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks as Record<string, unknown>[])

        // Assert — Payload rejects undefined for required text fields; must be ''
        expect(result[0].headline).toBe('')
    })

    it('TC-F05-save-03b: block with headline=null → normalized to empty string', () => {
        // Arrange
        const blocks = [{ blockType: 'hero', headline: null }]

        // Act
        const result = normalizeBlocksForPersistence(blocks as Record<string, unknown>[])

        // Assert
        expect(result[0].headline).toBe('')
    })

    it('TC-F05-save-03c: block without headline field → field untouched (not added)', () => {
        // Arrange — non-headline block (e.g. socialWidget has no headline requirement)
        const blocks = [{ blockType: 'footer', text: 'Copyright 2026' }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — headline not injected when it never existed
        expect(result[0]).not.toHaveProperty('headline')
        expect(result[0].text).toBe('Copyright 2026')
    })

    // TC-F05-save-04
    it('TC-F05-save-04: navigation link missing label → fallback to "Link"', () => {
        // Arrange — legacy draft from old builder might lack label
        const blocks = [
            {
                blockType: 'navigation',
                logoText: 'Acme',
                links: [
                    { url: '/about' },                          // no label at all
                    { url: '/contact', text: 'Contact Us' },   // uses .text instead of .label
                    { url: '/products', title: 'Products' },   // uses .title instead
                ],
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)
        const links = result[0].links as Record<string, unknown>[]

        // Assert — fallback chain: label → text → title → name → 'Link'
        expect(links[0].label).toBe('Link')         // no label/text/title → 'Link'
        expect(links[1].label).toBe('Contact Us')   // .text used as fallback
        expect(links[2].label).toBe('Products')     // .title used as fallback
    })

    it('TC-F05-save-04b: navigation link missing url → fallback to "#"', () => {
        // Arrange
        const blocks = [
            {
                blockType: 'navigation',
                links: [
                    { label: 'Home' },                     // no url at all
                    { label: 'Shop', href: '/shop' },      // uses .href
                    { label: 'Blog', link: '/blog' },      // uses .link
                ],
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)
        const links = result[0].links as Record<string, unknown>[]

        // Assert — fallback chain: url → href → link → '#'
        expect(links[0].url).toBe('#')
        expect(links[1].url).toBe('/shop')
        expect(links[2].url).toBe('/blog')
    })

    // TC-F05-save-01 (via normalizeBlocksForPersistence)
    it('TC-F05-save-01: block image as full media object → normalizeUploadField extracts integer id', () => {
        // Arrange — Payload populates relationships as objects on fetch; save must re-extract id
        const blocks = [
            {
                blockType: 'hero',
                image: { id: 15, url: 'https://cdn.example.com/hero.jpg', alt: 'Hero' },
                headline: 'Welcome',
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — image field contains only the integer id
        expect(result[0].image).toBe(15)
    })

    // TC-F05-save-09
    it('TC-F05-save-09: footer block with column links=null → no crash, links kept as null', () => {
        // Arrange — malformed footer data where links is not an array
        const blocks = [
            {
                blockType: 'footer',
                columns: [
                    { title: 'Company', links: null },
                    { title: 'Support', links: undefined },
                ],
            },
        ]

        // Act
        let result: ReturnType<typeof normalizeBlocksForPersistence> | undefined
        expect(() => {
            result = normalizeBlocksForPersistence(blocks as Record<string, unknown>[])
        }).not.toThrow()

        // Assert — columns preserved, links not converted
        const columns = result![0].columns as Record<string, unknown>[]
        expect(columns[0].title).toBe('Company')
        // null/undefined links are passed through untouched (not mapped)
        expect(columns[0].links).toBeNull()
    })

    // TC-F05-save-10
    it('TC-F05-save-10: socialWidget block → normalizeSocialWidgetConfig is applied', () => {
        // Arrange — socialWidget with empty links should get default links
        const blocks = [
            {
                blockType: 'socialWidget',
                variant: 'floating',
                links: [],
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)
        const links = result[0].links as unknown[]

        // Assert — empty links array → default links populated by normalizeSocialWidgetConfig
        expect(links.length).toBeGreaterThan(0)

        const firstLink = links[0] as Record<string, unknown>
        expect(firstLink).toHaveProperty('platform')
        expect(firstLink).toHaveProperty('url')
        expect(firstLink).toHaveProperty('enabled')
    })

    // TC-F05-save-13
    it('TC-F05-save-13: blog-list with legacy "editorial" variant → coerced to "cards" (defaultVariant)', () => {
        // Arrange — preset layer produced variants not in the Payload enum.
        // Real staging 500 payloads: blog-list=grid|editorial|featured-hero,
        // hero=overlay, social-proof=masonry (all invalid).
        const blocks = [
            { blockType: 'blog-list', variant: 'editorial', headline: 'Latest' },
            { blockType: 'hero', variant: 'overlay', headline: 'Welcome' },
            { blockType: 'social-proof', variant: 'masonry', headline: 'Love' },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — every invalid variant collapsed to block's defaultVariant
        expect(result[0]!.variant).toBe('cards')     // blog-list default
        expect(result[1]!.variant).toBe('centered')  // hero default
        expect(result[2]!.variant).toBe('cards')     // social-proof default
    })

    it('TC-F05-save-10b: socialWidget block with invalid platform → coerced to "facebook"', () => {
        // Arrange — unknown platform from old data
        const blocks = [
            {
                blockType: 'socialWidget',
                variant: 'inline',
                links: [
                    { platform: 'tiktok', url: 'https://tiktok.com/@brand', enabled: true },
                    { platform: 'facebook', url: 'https://facebook.com/brand', enabled: true },
                ],
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)
        const links = result[0].links as Record<string, unknown>[]

        // Assert — invalid 'tiktok' platform → coerced to 'facebook' (SocialPlatformSchema fallback)
        expect(links[0].platform).toBe('facebook')
        // valid 'facebook' platform kept as-is
        expect(links[1].platform).toBe('facebook')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — sanitizeBlockVariant (direct unit tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('sanitizeBlockVariant', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    // TC-F05-save-11
    it('TC-F05-save-11: invalid variant for known block → coerced to defaultVariant', () => {
        // Arrange — "editorial" is not in blog-list's enum [cards, list]
        const block = { blockType: 'blog-list', variant: 'editorial', headline: 'News' }

        // Act
        const result = sanitizeBlockVariant(block)

        // Assert
        expect(result.variant).toBe('cards')
        expect(result.headline).toBe('News')
    })

    it('TC-F05-save-11b: invalid hero variant → coerced to centered', () => {
        // Arrange
        const block = { blockType: 'hero', variant: 'overlay' }

        // Act
        const result = sanitizeBlockVariant(block)

        // Assert
        expect(result.variant).toBe('centered')
    })

    // TC-F05-save-12
    it('TC-F05-save-12: valid variant → unchanged (same reference)', () => {
        // Arrange
        const block = { blockType: 'hero', variant: 'minimal', headline: 'Hi' }

        // Act
        const result = sanitizeBlockVariant(block)

        // Assert — short-circuit returns input
        expect(result).toBe(block)
        expect(result.variant).toBe('minimal')
    })

    it('TC-F05-save-12b: unknown block type → unchanged', () => {
        // Arrange
        const block = { blockType: 'not-a-real-block', variant: 'whatever' }

        // Act
        const result = sanitizeBlockVariant(block)

        // Assert — no meta, leave alone
        expect(result).toBe(block)
    })

    it('TC-F05-save-12c: missing/empty variant → unchanged (Zod default applies downstream)', () => {
        // Arrange
        const a = { blockType: 'hero', headline: 'Hi' }
        const b = { blockType: 'hero', variant: '', headline: 'Hi' }
        const c = { blockType: 'hero', variant: undefined, headline: 'Hi' }

        // Act + Assert
        expect(sanitizeBlockVariant(a)).toBe(a)
        expect(sanitizeBlockVariant(b)).toBe(b)
        expect(sanitizeBlockVariant(c)).toBe(c)
    })

    it('TC-F05-save-12d: non-string blockType → unchanged', () => {
        // Arrange
        const block = { blockType: 42, variant: 'anything' } as unknown as Record<string, unknown>

        // Act
        const result = sanitizeBlockVariant(block)

        // Assert
        expect(result).toBe(block)
    })
})

describe('normalizeBlocksForPersistence — footer variant aliases (PR #757 backward-compat)', () => {
    it('TC-F05-save-14: footer with variant="expanded" → aliased to "simple"', () => {
        // Arrange — old DB record with removed variant
        const blocks = [{ blockType: 'footer', variant: 'expanded', columns: [] }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — Payload select no longer includes "expanded"
        expect(result[0].variant).toBe('simple')
    })

    it('TC-F05-save-15: footer with variant="mega-footer" → aliased to "dark-gradient"', () => {
        // Arrange — old DB record with removed variant
        const blocks = [{ blockType: 'footer', variant: 'mega-footer', columns: [] }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — Payload select no longer includes "mega-footer"
        expect(result[0].variant).toBe('dark-gradient')
    })

    it('TC-F05-save-16: footer with valid variant → unchanged', () => {
        // Arrange
        const blocks = [{ blockType: 'footer', variant: 'minimal', columns: [] }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — valid variants must not be aliased
        expect(result[0].variant).toBe('minimal')
    })

    it('TC-F05-save-17: non-footer block with "expanded" variant is NOT aliased by footer guard', () => {
        // Arrange — 'expanded' on a hero block should NOT be aliased as footer logic
        // (sanitizeBlockVariant handles coercion for non-footer blocks separately)
        const blocks = [{ blockType: 'hero', variant: 'expanded', columns: [] }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — footer alias guard skips non-footer blocks; sanitizeBlockVariant
        // then coerces 'expanded' (invalid for hero) to hero's default 'centered'.
        expect(result[0].variant).toBe('centered')
    })

    // TC-F05-save-18 — contact block email empty string → null
    // Payload email-type field validates format even without required:true,
    // so empty string '' causes ValidationError on publish. Must be coerced to null.
    it('TC-F05-save-18: contact block with email="" → coerced to null (prevents Payload email ValidationError on publish)', () => {
        // Arrange
        const blocks = [{ blockType: 'contact', variant: 'form', email: '', phone: '+601111', headline: 'Contact Us' }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — empty email stripped to null so Payload skips format validation
        expect(result[0].email).toBeNull()
        // Other fields must be untouched
        expect(result[0].phone).toBe('+601111')
        expect(result[0].headline).toBe('Contact Us')
    })

    it('TC-F05-save-18b: contact block with valid email → untouched', () => {
        // Arrange — valid email must not be stripped
        const blocks = [{ blockType: 'contact', variant: 'form', email: 'info@cafe.com', headline: 'Contact Us' }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — valid email preserved
        expect(result[0].email).toBe('info@cafe.com')
    })

    it('TC-F05-save-18c: non-contact block with email="" → NOT stripped (only applies to contact)', () => {
        // Arrange — footer has no email field normally, but if it did, we don't strip it
        const blocks = [{ blockType: 'footer', variant: 'simple', email: '' }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — only contact block gets email coercion
        expect(result[0].email).toBe('')
    })
})
