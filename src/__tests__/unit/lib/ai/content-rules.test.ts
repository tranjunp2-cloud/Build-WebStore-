/**
 * Unit Tests: Content Rules (Phase 04)
 * TC-IDs: TC-F01D-04.01 → TC-F01D-04.15
 * Convention: docs/TEST_CONVENTION.md
 * PRD: docs/prd/F01-design-quality.md (FR-09 → FR-12, FR-16, FR-18)
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
    CONTENT_RULES,
    BLOCKED_CONTENT,
    BLOCKED_CTA_BY_LANG,
    SUGGESTED_CTA_BY_LANG,
    ORDERING_RULES,
    MIN_BLOCKS_PER_PAGE,
    normalizeLang,
    getContentArray,
    validateBlockContent,
    applyContentValidation,
    validateOrdering,
    checkPageBlockCount,
} from '@/lib/ai/content-rules'

afterEach(() => {
    vi.restoreAllMocks()
})

describe('normalizeLang', () => {
    it('returns valid language codes unchanged', () => {
        expect(normalizeLang('en')).toBe('en')
        expect(normalizeLang('vi')).toBe('vi')
        expect(normalizeLang('ms')).toBe('ms')
    })

    it('falls back to en for unknown / auto / undefined', () => {
        expect(normalizeLang('auto')).toBe('en')
        expect(normalizeLang('fr')).toBe('en')
        expect(normalizeLang(undefined)).toBe('en')
        expect(normalizeLang('')).toBe('en')
    })
})

describe('BLOCKED_CTA_BY_LANG coverage', () => {
    it('contains en/vi/ms with non-empty lists', () => {
        expect(BLOCKED_CTA_BY_LANG.en.length).toBeGreaterThan(5)
        expect(BLOCKED_CTA_BY_LANG.vi.length).toBeGreaterThan(3)
        expect(BLOCKED_CTA_BY_LANG.ms.length).toBeGreaterThan(3)
    })

    it('includes the classic CRO anti-patterns', () => {
        expect(BLOCKED_CTA_BY_LANG.en).toContain('submit')
        expect(BLOCKED_CTA_BY_LANG.en).toContain('click here')
        expect(BLOCKED_CTA_BY_LANG.vi).toContain('gửi')
        expect(BLOCKED_CTA_BY_LANG.ms).toContain('hantar')
    })

    it('each language has a suggested replacement list', () => {
        expect(SUGGESTED_CTA_BY_LANG.en.length).toBeGreaterThan(0)
        expect(SUGGESTED_CTA_BY_LANG.vi.length).toBeGreaterThan(0)
        expect(SUGGESTED_CTA_BY_LANG.ms.length).toBeGreaterThan(0)
    })
})

describe('getContentArray', () => {
    it('returns testimonials.items when present', () => {
        const result = getContentArray({ items: [{ quote: 'a' }, { quote: 'b' }] })
        expect(result?.field).toBe('items')
        expect(result?.items).toHaveLength(2)
    })

    it('returns null when no content array is found', () => {
        expect(getContentArray({ blockType: 'hero', headline: 'Hi' })).toBeNull()
    })

    it('prefers items over testimonials when both exist', () => {
        const result = getContentArray({ items: [1], testimonials: [2, 3] })
        expect(result?.field).toBe('items')
    })

    it('finds plans for pricing blocks', () => {
        const result = getContentArray({ plans: [{ name: 'Pro' }] })
        expect(result?.field).toBe('plans')
    })
})

describe('validateBlockContent — hero headlines', () => {
    it('flags headline over 10 words', () => {
        const block = {
            blockType: 'hero',
            headline: 'This is a very long headline that exceeds the maximum word count limit enforced by the rules',
        }
        const result = validateBlockContent(block, 'en')
        expect(result.valid).toBe(false)
        expect(result.warnings.some((w) => w.includes('exceeds max'))).toBe(true)
        // Auto-fix truncates to 10 words
        expect(typeof result.fixes.headline).toBe('string')
        expect((result.fixes.headline as string).split(/\s+/)).toHaveLength(10)
    })

    it('accepts headline exactly at 10 words', () => {
        const block = {
            blockType: 'hero',
            headline: 'One two three four five six seven eight nine ten',
        }
        const result = validateBlockContent(block, 'en')
        expect(result.valid).toBe(true)
        expect(result.fixes.headline).toBeUndefined()
    })

    it('warns on headline below min 3 words (no auto-fix)', () => {
        const block = { blockType: 'hero', headline: 'Hi' }
        const result = validateBlockContent(block, 'en')
        expect(result.valid).toBe(false)
        expect(result.warnings.some((w) => w.includes('below min'))).toBe(true)
        expect(result.fixes.headline).toBeUndefined()
    })

    it('flags generic filler copy "Welcome to our website"', () => {
        const block = {
            blockType: 'hero',
            headline: 'Welcome to our website today folks',
        }
        const result = validateBlockContent(block, 'en')
        expect(result.warnings.some((w) => w.includes('generic filler'))).toBe(true)
    })

    it('flags subheadline over 25 words with auto-fix', () => {
        const block = {
            blockType: 'hero',
            headline: 'Great Offer',
            subheadline: Array(30).fill('word').join(' '),
        }
        const result = validateBlockContent(block, 'en')
        expect(result.warnings.some((w) => w.includes('subheadline'))).toBe(true)
        expect((result.fixes.subheadline as string).split(/\s+/)).toHaveLength(25)
    })
})

describe('validateBlockContent — blocked CTAs', () => {
    it('flags "Submit" CTA in hero.ctaButtons (en)', () => {
        const block = {
            blockType: 'hero',
            headline: 'Good Headline',
            ctaButtons: [{ label: 'Submit', url: '/' }],
        }
        const result = validateBlockContent(block, 'en')
        expect(result.valid).toBe(false)
        expect(result.warnings.some((w) => w.includes('CTA'))).toBe(true)
        const fixedButtons = result.fixes.ctaButtons as Array<Record<string, unknown>>
        expect(fixedButtons[0]!.label).toBe('Get Started')
    })

    it('is case-insensitive: "submit" matches', () => {
        const block = {
            blockType: 'hero',
            headline: 'Great',
            ctaButtons: [{ label: 'submit', url: '/' }],
        }
        const result = validateBlockContent(block, 'en')
        expect(result.valid).toBe(false)
    })

    it('flags Vietnamese "Gửi" when lang=vi', () => {
        const block = {
            blockType: 'hero',
            headline: 'Nhà hàng xin chào',
            ctaButtons: [{ label: 'Gửi', url: '/' }],
        }
        const result = validateBlockContent(block, 'vi')
        expect(result.valid).toBe(false)
        const fixedButtons = result.fixes.ctaButtons as Array<Record<string, unknown>>
        expect(fixedButtons[0]!.label).toBe('Đăng ký ngay')
    })

    it('flags Malay "Hantar" when lang=ms', () => {
        const block = {
            blockType: 'hero',
            headline: 'Restoran kami',
            ctaButtons: [{ label: 'Hantar', url: '/' }],
        }
        const result = validateBlockContent(block, 'ms')
        expect(result.valid).toBe(false)
        const fixedButtons = result.fixes.ctaButtons as Array<Record<string, unknown>>
        expect(fixedButtons[0]!.label).toBe('Mula Sekarang')
    })

    it('does NOT flag Vietnamese "Gửi" when lang=en (lang-specific lookup)', () => {
        const block = {
            blockType: 'hero',
            headline: 'Great Title',
            ctaButtons: [{ label: 'Gửi', url: '/' }],
        }
        const result = validateBlockContent(block, 'en')
        // en list does not include 'Gửi' → passes
        expect(result.fixes.ctaButtons).toBeUndefined()
    })

    it('flags navigation.ctaButton blocked label', () => {
        const block = {
            blockType: 'navigation',
            ctaButton: { label: 'Click Here', url: '/', show: true },
        }
        const result = validateBlockContent(block, 'en')
        expect(result.valid).toBe(false)
        const fixedBtn = result.fixes.ctaButton as Record<string, unknown>
        expect(fixedBtn.label).toBe('Get Started')
    })

    it('passes valid CTA "Book Now"', () => {
        const block = {
            blockType: 'hero',
            headline: 'Great Headline',
            ctaButtons: [{ label: 'Book Now', url: '/' }],
        }
        const result = validateBlockContent(block, 'en')
        expect(result.fixes.ctaButtons).toBeUndefined()
    })
})

describe('validateBlockContent — feature descriptions', () => {
    it('warns on description over 150 chars (no auto-fix)', () => {
        const block = {
            blockType: 'features',
            items: [{ title: 'Fast', description: 'a'.repeat(200) }],
        }
        const result = validateBlockContent(block, 'en')
        expect(result.warnings.some((w) => w.includes('feature description'))).toBe(true)
    })

    it('accepts description exactly at 150 chars', () => {
        const block = {
            blockType: 'features',
            items: [{ title: 'Fast', description: 'a'.repeat(150) }],
        }
        const result = validateBlockContent(block, 'en')
        expect(result.valid).toBe(true)
    })

    it('handles grapheme counting correctly (emoji)', () => {
        // 4 emoji = 4 graphemes, not 8 code units
        const block = {
            blockType: 'features',
            items: [{ title: 'Fast', description: '⭐⭐⭐⭐ fast' }],
        }
        const result = validateBlockContent(block, 'en')
        expect(result.valid).toBe(true)
    })
})

describe('validateBlockContent — testimonial quotes', () => {
    it('warns on quote over 200 chars', () => {
        const block = {
            blockType: 'testimonials',
            items: [{ quote: 'a'.repeat(300), name: 'Alice' }],
        }
        const result = validateBlockContent(block, 'en')
        expect(result.warnings.some((w) => w.includes('testimonial'))).toBe(true)
    })
})

describe('applyContentValidation', () => {
    it('returns same object when no fixes', () => {
        const block = { blockType: 'hero', headline: 'Great Title Here' }
        const result = applyContentValidation(block, 'en')
        expect(result).toEqual(block)
    })

    it('merges fixes into a new object without mutating input', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const block = {
            blockType: 'hero',
            headline: 'Short',
            ctaButtons: [{ label: 'Submit', url: '/' }],
        }
        const result = applyContentValidation(block, 'en')
        expect((result.ctaButtons as Array<Record<string, unknown>>)[0]!.label).toBe('Get Started')
        // Input unchanged
        expect((block.ctaButtons as Array<Record<string, unknown>>)[0]!.label).toBe('Submit')
        expect(warnSpy).toHaveBeenCalled()
    })

    it('supports silent mode (no console output)', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const block = {
            blockType: 'hero',
            headline: 'Short',
            ctaButtons: [{ label: 'Submit', url: '/' }],
        }
        applyContentValidation(block, 'en', { silent: true })
        expect(warnSpy).not.toHaveBeenCalled()
    })
})

describe('validateOrdering', () => {
    it('passes when features come before stats', () => {
        const blocks = [
            { blockType: 'navigation' },
            { blockType: 'hero' },
            { blockType: 'features' },
            { blockType: 'stats' },
            { blockType: 'footer' },
        ]
        const result = validateOrdering(blocks)
        expect(result.valid).toBe(true)
    })

    it('warns when stats comes before features', () => {
        const blocks = [
            { blockType: 'navigation' },
            { blockType: 'hero' },
            { blockType: 'stats' },
            { blockType: 'features' },
            { blockType: 'footer' },
        ]
        const result = validateOrdering(blocks)
        expect(result.valid).toBe(false)
        expect(result.warnings.some((w) => w.includes('features') && w.includes('stats'))).toBe(true)
        expect(result.reorderHints.length).toBeGreaterThan(0)
    })

    it('skips rules for override categories (fundraising)', () => {
        const blocks = [
            { blockType: 'hero' },
            { blockType: 'stats' },
            { blockType: 'features' },
        ]
        const result = validateOrdering(blocks, 'fundraising')
        expect(result.valid).toBe(true)
    })

    it('tolerates missing blocks in a rule (only flags when both present)', () => {
        const blocks = [
            { blockType: 'hero' },
            { blockType: 'stats' },  // no features at all
        ]
        const result = validateOrdering(blocks)
        expect(result.valid).toBe(true)
    })
})

describe('checkPageBlockCount', () => {
    it('viable=true when >= 3 blocks present', () => {
        const result = checkPageBlockCount([
            { blockType: 'navigation' },
            { blockType: 'hero' },
            { blockType: 'footer' },
        ])
        expect(result.viable).toBe(true)
        expect(result.hasNav).toBe(true)
        expect(result.hasHero).toBe(true)
        expect(result.hasFooter).toBe(true)
    })

    it('viable=false when < 3 blocks', () => {
        const result = checkPageBlockCount([{ blockType: 'hero' }])
        expect(result.viable).toBe(false)
        expect(result.hasHero).toBe(true)
        expect(result.hasNav).toBe(false)
        expect(result.hasFooter).toBe(false)
    })

    it('MIN_BLOCKS_PER_PAGE is 3', () => {
        expect(MIN_BLOCKS_PER_PAGE).toBe(3)
    })
})

describe('CONTENT_RULES constants', () => {
    it('hero rules match PRD FR-09', () => {
        expect(CONTENT_RULES.hero.headlineMaxWords).toBe(10)
        expect(CONTENT_RULES.hero.headlineMinWords).toBe(3)
        expect(CONTENT_RULES.hero.subheadlineMaxWords).toBe(25)
    })

    it('BLOCKED_CONTENT contains classic anti-patterns', () => {
        expect(BLOCKED_CONTENT.some((p) => p.includes('welcome to our'))).toBe(true)
        expect(BLOCKED_CONTENT.some((p) => p.includes('lorem ipsum'))).toBe(true)
    })

    it('ORDERING_RULES enforces AIDA (features → stats/testimonials)', () => {
        const rules = ORDERING_RULES.map((r) => r.join('→'))
        expect(rules).toContain('features→stats')
        expect(rules).toContain('features→testimonials')
    })
})
