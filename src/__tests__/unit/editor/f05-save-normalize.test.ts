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
 *   TC-F05-save-19  → normalizeBlocksForPersistence: service-cards empty/null/missing titles → coerced to 'Service' (GH-731)
 *   TC-F05-save-19b → normalizeBlocksForPersistence: non-service-cards block services → NOT coerced
 *   TC-F05-save-20  → normalizeBlocksForPersistence: cta block with invalid ctaStyle → coerced to 'primary' (GH-1283)
 *   TC-F05-save-20b → normalizeBlocksForPersistence: cta block with valid ctaStyle → unchanged
 *   TC-F05-save-21  → normalizeBlocksForPersistence: contact block with email='' → coerced to null (GH-generate-site)
 *   TC-F05-save-21b → normalizeBlocksForPersistence: contact block with email missing TLD (e.g. 'info@brand') → coerced to null
 *   TC-F05-save-21c → normalizeBlocksForPersistence: contact block with email domain Cyrillic → coerced to null
 *   TC-F05-save-21d → normalizeBlocksForPersistence: contact block with valid email → unchanged
 *   TC-F05-save-21e → normalizeBlocksForPersistence: contact block with email whitespace → trimmed
 *   TC-F05-save-21f → normalizeBlocksForPersistence: non-contact block email → NOT sanitized (only contact applied)
 *   TC-F05-save-21g → PAYLOAD_EMAIL_RE unit test: valid/invalid emails + Payload-subset guards (hyphen-edge, IP literal, double-dot)
 *   TC-GH1381-04a → normalizeBlocksForPersistence: gallery images[].image {id,url,alt} → id extracted (GH-1381)
 *   TC-GH1381-04b → normalizeBlocksForPersistence: gallery mixed image types (object + int + null)
 *   TC-GH1381-04c → normalizeBlocksForPersistence: gallery image {url} without id → null
 *   TC-GH1381-04d → normalizeBlocksForPersistence: gallery with no images array → untouched
 *   TC-GH1381-04e → normalizeBlocksForPersistence: portfolio/team/other array images also normalized
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
    PAYLOAD_EMAIL_RE,
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

    // F26: block ID stability — keeping locale_content keys from orphaning across save+reload.
    // Regression for the round-trip locale bug (TC-F26-05-03 / TC-F26-08-07): stripping a valid id
    // forced Payload to regenerate it every save, orphaning per-locale overrides.
    it('TC-F26-block-id-01: Payload 24-char hex id is PRESERVED (not stripped)', () => {
        // Arrange — id format Payload assigns to block rows / AI-generated blocks
        const blocks = [{ id: '6a1d0bf37593a40039381abc', _id: 'mongo-legacy', blockType: 'hero', headline: 'Hi' }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — hex id kept (stable PK), only _id stripped
        expect(result[0].id).toBe('6a1d0bf37593a40039381abc')
        expect(result[0]).not.toHaveProperty('_id')
    })

    it('TC-F26-block-id-02: editor UUID id is PRESERVED', () => {
        // Arrange — id format crypto.randomUUID() assigns on block drop
        const blocks = [{ id: 'd6ebe0c5-15f6-4634-9be0-4229e6a2ba02', blockType: 'faq' }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — uuid kept
        expect(result[0].id).toBe('d6ebe0c5-15f6-4634-9be0-4229e6a2ba02')
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

    // TC-F05-save-19: GH-731 — service-cards with empty service titles fail Payload
    // required validation on publish. normalizeBlocksForPersistence must coerce to 'Service'.
    it('TC-F05-save-19: service-cards with empty service titles → coerced to "Service" fallback', () => {
        // Arrange — services with empty/null/missing title (simulate existing DB records)
        const blocks = [{
            blockType: 'service-cards',
            variant: 'grid',
            headline: 'Our Services',
            services: [
                { title: '', description: 'desc 1', icon: '🛠️' },
                { title: null, description: 'desc 2', icon: '⭐' },
                { description: 'desc 3', icon: '🔧' },
                { title: 'Valid Title', description: 'desc 4', icon: '✅' },
            ],
        }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)
        const services = result[0].services as Record<string, unknown>[]

        // Assert — empty/null/missing titles get fallback; valid title unchanged
        expect(services[0].title).toBe('Service')
        expect(services[1].title).toBe('Service')
        expect(services[2].title).toBe('Service')
        expect(services[3].title).toBe('Valid Title')
    })

    it('TC-F05-save-19b: non-service-cards blocks with services array → NOT coerced', () => {
        // Arrange — only service-cards should get title coercion
        const blocks = [{ blockType: 'hero', variant: 'split', services: [{ title: '' }] }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)
        const services = result[0].services as Record<string, unknown>[]

        // Assert — hero block services untouched
        expect(services[0].title).toBe('')
    })
})

// TC-F05-save-20: GH-1283 — CTA ctaStyle invalid values fail Payload validation on publish/save
describe('normalizeBlocksForPersistence — cta ctaStyle coercion (GH-1283)', () => {
    it('TC-F05-save-20: cta block with invalid ctaStyle → coerced to "primary"', () => {
        // Arrange — AI may generate 'ghost', 'secondary', etc. not in CTA Payload enum
        const blocks = [
            { blockType: 'cta', headline: 'Join us', ctaStyle: 'ghost' },
            { blockType: 'cta', headline: 'Sign up', ctaStyle: 'secondary' },
            { blockType: 'cta', headline: 'Learn more', ctaStyle: 'link' },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — all invalid values coerced to 'primary'
        expect(result[0].ctaStyle).toBe('primary')
        expect(result[1].ctaStyle).toBe('primary')
        expect(result[2].ctaStyle).toBe('primary')
    })

    it('TC-F05-save-20b: cta block with valid ctaStyle → unchanged', () => {
        // Arrange — valid values must not be touched
        const blocks = [
            { blockType: 'cta', headline: 'A', ctaStyle: 'primary' },
            { blockType: 'cta', headline: 'B', ctaStyle: 'outline' },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — valid values preserved
        expect(result[0].ctaStyle).toBe('primary')
        expect(result[1].ctaStyle).toBe('outline')
    })
})

// TC-F05-save-21: generate-site contact email='' fails Payload email-format validation
describe('normalizeBlocksForPersistence — contact email coercion (generate-site)', () => {
    beforeEach(() => {
        // Mock console.warn to avoid test noise from email validation warnings
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    it('TC-F05-save-21: contact block with email="" → coerced to null (prevents Payload email ValidationError on create)', () => {
        // Arrange — AI gen may produce email: '' on contact block
        const blocks = [{ blockType: 'contact', headline: 'Contact Us', email: '' }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — empty string stripped to null so Payload skips format check
        expect(result[0].email).toBeNull()
    })

    it('TC-F05-save-21b: contact block with email missing TLD (e.g. "info@brand") → coerced to null', () => {
        // Arrange — AI may generate incomplete email with no TLD (domain must have {2,} char TLD per Payload regex)
        const blocks = [{ blockType: 'contact', headline: 'Contact Us', email: 'info@brand' }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — invalid email format (no TLD) dropped to null
        expect(result[0].email).toBeNull()
    })

    it('TC-F05-save-21c: contact block with email domain Cyrillic characters → coerced to null', () => {
        // Arrange — PAYLOAD_EMAIL_RE only accepts ASCII domains, not Unicode/Cyrillic
        // Construct domain with Cyrillic characters: "sitinaskandan.my" → insert Cyrillic U+043A/U+0430/U+043D (к/а/н)
        const cyrillic = 'hello@situnasкандar.my' // sitуаскан (к=U+043A, а=U+0430, н=U+043D)
        const blocks = [{ blockType: 'contact', headline: 'Contact Us', email: cyrillic }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — non-ASCII domain fails PAYLOAD_EMAIL_RE, dropped to null
        expect(result[0].email).toBeNull()
    })

    it('TC-F05-save-21d: contact block with valid email → unchanged', () => {
        // Arrange — valid ASCII domain with proper TLD
        const blocks = [{ blockType: 'contact', headline: 'Contact Us', email: 'hello@restaurant.com' }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — valid email kept as-is
        expect(result[0].email).toBe('hello@restaurant.com')
    })

    it('TC-F05-save-21e: contact block with email whitespace (leading/trailing) → trimmed', () => {
        // Arrange — email with extra whitespace around valid address
        const blocks = [{ blockType: 'contact', headline: 'Contact Us', email: '  hi@brand.com  ' }]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — whitespace trimmed while preserving valid email
        expect(result[0].email).toBe('hi@brand.com')
    })

    it('TC-F05-save-21f: non-contact block with email field → NOT sanitized by contact guard', () => {
        // Arrange — footer or other block with email field; should NOT apply contact email sanitization
        const blocks = [
            { blockType: 'footer', variant: 'simple', email: '' },
            { blockType: 'hero', headline: 'Hello', email: 'invalid-email' }
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — non-contact blocks keep their email values untouched (not sanitized)
        expect(result[0].email).toBe('')          // footer empty string unchanged
        expect(result[1].email).toBe('invalid-email')  // hero invalid email unchanged
    })

    it('TC-F05-save-21g: PAYLOAD_EMAIL_RE regex validation unit test', () => {
        // Test the regex directly to document expected matching behavior

        // Valid emails — should match
        expect(PAYLOAD_EMAIL_RE.test('a@b.co')).toBe(true)
        expect(PAYLOAD_EMAIL_RE.test('hello@example.com')).toBe(true)
        expect(PAYLOAD_EMAIL_RE.test('user+tag@domain.co.uk')).toBe(true)
        expect(PAYLOAD_EMAIL_RE.test('info@restaurant.com')).toBe(true)
        expect(PAYLOAD_EMAIL_RE.test('test@a-b-c.com')).toBe(true)

        // Invalid emails — should NOT match
        expect(PAYLOAD_EMAIL_RE.test('a@b')).toBe(false)           // no TLD (single-char)
        expect(PAYLOAD_EMAIL_RE.test('info@brand')).toBe(false)    // no TLD
        expect(PAYLOAD_EMAIL_RE.test('a@b.c')).toBe(false)         // 1-char TLD
        expect(PAYLOAD_EMAIL_RE.test('')).toBe(false)              // empty
        expect(PAYLOAD_EMAIL_RE.test('no-at-sign.com')).toBe(false) // missing @
        // Non-ASCII domain with Cyrillic (U+043A к)
        expect(PAYLOAD_EMAIL_RE.test('hello@domainк.com')).toBe(false)

        // Subset-with-Payload guard: these are KEPT by the old classic regex but REJECTED by
        // Payload v3.79 — the regex must match Payload so we never persist an email it rejects.
        expect(PAYLOAD_EMAIL_RE.test('a@-bad.com')).toBe(false)    // label starts with hyphen
        expect(PAYLOAD_EMAIL_RE.test('a@bad-.com')).toBe(false)    // label ends with hyphen
        expect(PAYLOAD_EMAIL_RE.test('a@[127.0.0.1]')).toBe(false) // IP literal
        expect(PAYLOAD_EMAIL_RE.test('a..b@example.com')).toBe(false) // consecutive dots in local
    })
})

// GH-1381 — Gallery "Change Image" bug fix normalization
// Covers: PreviewFrame stores populated {id,url,alt} objects, normalizeUploadField extracts id
describe('normalizeBlocksForPersistence — gallery images normalization (GH-1381)', () => {
    it('TC-GH1381-04a: gallery block images[].image as {id,url,alt} object → id extracted', () => {
        // Arrange — PreviewFrame stores this after image upload to enable immediate render
        // (see PreviewFrame.tsx:960 image: { id: newMediaId, url: newUrl, alt: existingAlt })
        const blocks = [
            {
                blockType: 'gallery',
                headline: 'Product Gallery',
                images: [
                    {
                        image: {
                            id: 42,
                            url: 'https://cdn.example.com/product.jpg',
                            alt: 'Product launch',
                        },
                        caption: 'Launch event',
                    },
                    {
                        image: {
                            id: 99,
                            url: 'https://cdn.example.com/team.jpg',
                            alt: 'Team photo',
                        },
                        caption: 'Team',
                    },
                ],
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — image fields now contain only integer IDs (ready for Payload persistence)
        const images = result[0].images as Array<Record<string, unknown>>
        expect(images[0].image).toBe(42)
        expect(images[1].image).toBe(99)
        expect(typeof images[0].image).toBe('number')
        expect(typeof images[1].image).toBe('number')
        // Captions and other fields preserved
        expect(images[0].caption).toBe('Launch event')
        expect(images[1].caption).toBe('Team')
    })

    it('TC-GH1381-04b: gallery images[].image mixed types (bare int + object) → all normalized', () => {
        // Arrange — gallery with both legacy bare ints and new object format
        const blocks = [
            {
                blockType: 'gallery',
                headline: 'Mixed',
                images: [
                    // New format: object with id/url
                    {
                        image: { id: 100, url: 'https://example.com/new.jpg', alt: 'New' },
                        caption: 'New style',
                    },
                    // Legacy: bare integer
                    {
                        image: 200,
                        caption: 'Legacy style',
                    },
                    // Empty: null
                    {
                        image: null,
                        caption: 'Empty',
                    },
                ],
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert
        const images = result[0].images as Array<Record<string, unknown>>
        expect(images[0].image).toBe(100) // object → id extracted
        expect(images[1].image).toBe(200) // int → kept as-is
        expect(images[2].image).toBeNull() // null → null
    })

    it('TC-GH1381-04c: gallery images[].image object without id → null (invalid)', () => {
        // Arrange — malformed object (e.g., url-only from legacy AI)
        const blocks = [
            {
                blockType: 'gallery',
                headline: 'Malformed',
                images: [
                    {
                        image: {
                            url: 'https://example.com/orphan.jpg',
                            alt: 'Missing id',
                        },
                        caption: 'Bad format',
                    },
                ],
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — can't extract id → null
        const images = result[0].images as Array<Record<string, unknown>>
        expect(images[0].image).toBeNull()
        expect(images[0].caption).toBe('Bad format') // caption preserved
    })

    it('TC-GH1381-04d: gallery with no images array → block untouched', () => {
        // Arrange
        const blocks = [
            {
                blockType: 'gallery',
                headline: 'Empty gallery',
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert
        expect(result[0]).not.toHaveProperty('images')
        expect(result[0].headline).toBe('Empty gallery')
    })

    it('TC-GH1381-04e: non-gallery block with images array → each image normalized too', () => {
        // Arrange — portfolio-grid also has array images, should normalize
        const blocks = [
            {
                blockType: 'portfolio-grid',
                headline: 'Portfolio',
                projects: [
                    {
                        image: { id: 123, url: 'https://example.com/proj1.jpg', alt: 'Project 1' },
                        title: 'Project 1',
                    },
                    {
                        image: 456, // legacy int
                        title: 'Project 2',
                    },
                ],
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — portfolio-grid.projects[].image also normalized
        const projects = result[0].projects as Array<Record<string, unknown>>
        expect(projects[0].image).toBe(123)
        expect(projects[1].image).toBe(456)
    })

    // ──────── GH-1381 FOLLOW-UP: url-group fields (before-after, etc.) ────────
    // These are Payload group fields {url, alt, label} that should NOT be normalized
    // (NOT in UPLOAD_FIELDS). The upload overlay sets only .url subfield to preserve siblings.

    it('TC-GH1381-UO-020: before-after group field {url,alt,label} NOT normalized', () => {
        // Arrange — before-after block with url-group fields (NOT media relations)
        const blocks = [
            {
                blockType: 'before-after',
                variant: 'slider',
                beforeImage: {
                    url: 'https://cdn/before.jpg',
                    alt: 'Before state',
                    label: 'Before',
                },
                afterImage: {
                    url: 'https://cdn/after.jpg',
                    alt: 'After state',
                    label: 'After',
                },
            },
        ]

        // Act
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — url-group fields stay as objects (NOT extracted to id)
        const block = result[0] as Record<string, unknown>
        const beforeImage = block.beforeImage as Record<string, unknown>
        expect(beforeImage.url).toBe('https://cdn/before.jpg')
        expect(beforeImage.alt).toBe('Before state')
        expect(beforeImage.label).toBe('Before')
        const afterImage = block.afterImage as Record<string, unknown>
        expect(afterImage.url).toBe('https://cdn/after.jpg')
        expect(afterImage.alt).toBe('After state')
        expect(afterImage.label).toBe('After')
    })

    it('TC-GH1381-UO-021: before-after .url upload preserves alt/label siblings', () => {
        // Arrange — simulate the upload flow: overlay sets only .url, siblings preserved
        const blocks = [
            {
                blockType: 'before-after',
                variant: 'slider',
                beforeImage: {
                    url: 'https://old/before.jpg',
                    alt: 'Original before',
                    label: 'Baseline',
                },
                afterImage: {
                    url: 'https://old/after.jpg',
                    alt: 'Original after',
                    label: 'Result',
                },
            },
        ]

        // Act — simulates: callback.onFieldChange('beforeImage.url', 'https://new/before.jpg')
        blocks[0].beforeImage.url = 'https://new/before.jpg'
        const result = normalizeBlocksForPersistence(blocks)

        // Assert — url updated, but alt/label intact (NOT nulled by normalization)
        const beforeImage = result[0].beforeImage as Record<string, unknown>
        expect(beforeImage.url).toBe('https://new/before.jpg')
        expect(beforeImage.alt).toBe('Original before') // Preserved
        expect(beforeImage.label).toBe('Baseline') // Preserved
    })
})
