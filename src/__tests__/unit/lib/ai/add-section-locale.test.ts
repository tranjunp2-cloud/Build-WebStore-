/**
 * Tests for locale-aware block defaults — F26-02
 * TC-IDs: TC-F26.02-01 through TC-F26.02-10
 */
import { describe, it, expect } from 'vitest'
import { createAddSectionBlock, normalizeAddSectionBlock } from '@/lib/ai/add-section'
import { resolveBlockContent, getLocaleCoverage, hasLocaleContent } from '@/lib/ai/add-section-content'

// ── resolveBlockContent [TC-F26.02-01 to TC-F26.02-03] ────────────────────

describe('resolveBlockContent — EN locale [TC-F26.02-01]', () => {
    it('returns EN content with needsTranslation=false for known block', () => {
        const result = resolveBlockContent('hero', 'en', 'TestBrand')
        expect(result.localeUsed).toBe('en')
        expect(result.needsTranslation).toBe(false)
        expect(typeof result.content).toBe('object')
    })

    it('interpolates {brand} token in string fields', () => {
        const result = resolveBlockContent('hero', 'en', 'AcmeCo')
        const content = result.content as { headline: string }
        expect(content.headline).toContain('AcmeCo')
        expect(content.headline).not.toContain('{brand}')
    })

    it('interpolates {brand} in nested array strings', () => {
        const result = resolveBlockContent('faq', 'en', 'BrandX')
        const content = result.content as { items: Array<{ question: string; answer: string }> }
        const hasToken = content.items.some(
            (item) => item.question.includes('{brand}') || item.answer.includes('{brand}'),
        )
        expect(hasToken).toBe(false)
        const hasBrand = content.items.some(
            (item) => item.question.includes('BrandX') || item.answer.includes('BrandX'),
        )
        expect(hasBrand).toBe(true)
    })
})

describe('resolveBlockContent — MS locale [TC-F26.02-02]', () => {
    it('returns MS content for hero block', () => {
        const result = resolveBlockContent('hero', 'ms', 'TestBrand')
        expect(result.localeUsed).toBe('ms')
        expect(result.needsTranslation).toBe(false)
        const content = result.content as { headline: string }
        expect(content.headline).toContain('TestBrand')
        // BM greeting
        expect(content.headline.toLowerCase()).toContain('selamat')
    })

    it('returns MS FAQ with BM headline [TC-F26.02-02]', () => {
        const result = resolveBlockContent('faq', 'ms', 'Brand')
        const content = result.content as { headline: string }
        expect(content.headline.toLowerCase()).toContain('soalan lazim')
    })

    it('interpolates {brand} in MS content', () => {
        const result = resolveBlockContent('faq', 'ms', 'TokoSaya')
        const content = result.content as { headline: string }
        expect(content.headline).toContain('TokoSaya')
        expect(content.headline).not.toContain('{brand}')
    })
})

describe('resolveBlockContent — MS fallback to EN [TC-F26.02-03]', () => {
    it('returns EN content + needsTranslation=true for unknown block in MS locale', () => {
        const result = resolveBlockContent('__nonexistent_block__', 'ms', 'Brand')
        expect(result.localeUsed).toBe('en')
        expect(result.needsTranslation).toBe(true)
    })

    it('returns empty content object (not throw) when block missing from both locales', () => {
        const result = resolveBlockContent('__totally_missing__', 'ms', 'Brand')
        expect(result).toBeDefined()
        expect(typeof result.content).toBe('object')
    })

    it('EN locale for unknown block returns needsTranslation=false', () => {
        const result = resolveBlockContent('__nonexistent_block__', 'en', 'Brand')
        expect(result.needsTranslation).toBe(false)
    })
})

// ── createAddSectionBlock — locale parameter [TC-F26.02-04, TC-F26.02-05] ──

describe('createAddSectionBlock — EN locale (no-regression) [TC-F26.02-04]', () => {
    it('hero: headline contains brand name in English', () => {
        const block = createAddSectionBlock({ instruction: 'add hero', siteName: 'AcmeCo', locale: 'en' }) as Record<string, unknown>
        expect(String(block?.headline)).toContain('AcmeCo')
        // EN greeting pattern
        expect(String(block?.headline).toLowerCase()).toContain('welcome')
    })

    it('faq: has 3 items, question fields in English', () => {
        const block = createAddSectionBlock({ instruction: 'add faq', siteName: 'BrandEN', locale: 'en' }) as Record<string, unknown>
        const faqs = block?.faqs as Array<{ question: string; answer: string }>
        expect(faqs).toHaveLength(3)
        expect(faqs[0].question).toContain('BrandEN')
    })

    it('features: headline contains brand, items array present', () => {
        const block = createAddSectionBlock({ instruction: 'add features', siteName: 'MyBrand', locale: 'en' }) as Record<string, unknown>
        expect(String(block?.headline)).toContain('MyBrand')
        expect(Array.isArray(block?.features)).toBe(true)
    })

    it('newsletter: buttonLabel is Subscribe for EN', () => {
        const block = createAddSectionBlock({ instruction: 'add newsletter', locale: 'en' }) as Record<string, unknown>
        expect(block?.buttonLabel).toBe('Subscribe')
    })

    it('stats: stat items have value+label fields', () => {
        const block = createAddSectionBlock({ instruction: 'add stats', locale: 'en' }) as Record<string, unknown>
        const stats = block?.stats as Array<{ value: string; label: string }>
        expect(Array.isArray(stats)).toBe(true)
        stats.forEach(s => {
            expect(s).toHaveProperty('value')
            expect(s).toHaveProperty('label')
        })
    })

    it('pricing: has 3 plans for EN', () => {
        const block = createAddSectionBlock({ instruction: 'add pricing', locale: 'en' }) as Record<string, unknown>
        expect((block?.plans as unknown[]).length).toBe(3)
    })
})

describe('createAddSectionBlock — MS locale injects BM defaults [TC-F26.02-05]', () => {
    it('hero: headline in BM (contains Selamat)', () => {
        const block = createAddSectionBlock({ instruction: 'add hero', siteName: 'TokoSaya', locale: 'ms' }) as Record<string, unknown>
        expect(String(block?.headline).toLowerCase()).toContain('selamat')
        expect(String(block?.headline)).toContain('TokoSaya')
    })

    it('faq: headline contains Soalan Lazim in BM', () => {
        const block = createAddSectionBlock({ instruction: 'add faq', siteName: 'WarungKita', locale: 'ms' }) as Record<string, unknown>
        expect(String(block?.headline).toLowerCase()).toContain('soalan lazim')
        expect(String(block?.headline)).toContain('WarungKita')
    })

    it('faq: still has 3 items for MS', () => {
        const block = createAddSectionBlock({ instruction: 'add faq', locale: 'ms' }) as Record<string, unknown>
        expect((block?.faqs as unknown[]).length).toBe(3)
    })

    it('features: BM subheadline for MS locale', () => {
        const block = createAddSectionBlock({ instruction: 'add features', locale: 'ms' }) as Record<string, unknown>
        // BM subheadline contains "tiga" or "sebab"
        expect(String(block?.subheadline).toLowerCase()).toMatch(/tiga|sebab/)
    })

    it('newsletter: buttonLabel is BM for MS locale', () => {
        const block = createAddSectionBlock({ instruction: 'add newsletter', locale: 'ms' }) as Record<string, unknown>
        expect(block?.buttonLabel).toBe('Langgan')
    })

    it('stats: labels in BM for MS locale', () => {
        const block = createAddSectionBlock({ instruction: 'add stats', locale: 'ms' }) as Record<string, unknown>
        const stats = block?.stats as Array<{ value: string; label: string }>
        expect(Array.isArray(stats)).toBe(true)
        // At least one label should be in BM
        const hasBMLabel = stats.some(s => /pelanggan|berpuas|negara/i.test(s.label))
        expect(hasBMLabel).toBe(true)
    })

    it('about: headline in BM (Kisah Kami)', () => {
        const block = createAddSectionBlock({ instruction: 'add about', locale: 'ms' }) as Record<string, unknown>
        expect(String(block?.headline)).toBe('Kisah Kami')
    })

    it('contact: headline in BM (Hubungi Kami)', () => {
        const block = createAddSectionBlock({ instruction: 'add contact', locale: 'ms' }) as Record<string, unknown>
        expect(String(block?.headline)).toBe('Hubungi Kami')
    })

    it('pricing: 3 plans with RM currency for MS locale', () => {
        const block = createAddSectionBlock({ instruction: 'add pricing', locale: 'ms' }) as Record<string, unknown>
        const plans = block?.plans as Array<{ price: string }>
        expect(plans.length).toBe(3)
        const hasRM = plans.some(p => String(p.price).includes('RM'))
        expect(hasRM).toBe(true)
    })

    it('cta: ctaLabel in BM', () => {
        // GH-1412 — CTA inserts as a real `cta` block using the `ctaLabel` field.
        const block = createAddSectionBlock({ instruction: 'add cta', locale: 'ms' }) as Record<string, unknown>
        expect(block?.blockType).toBe('cta')
        expect(block?.ctaLabel).toBe('Mulakan')
        expect(block?.ctaLabel).not.toBe('Get Started')
    })

    it('service-cards: headline in BM (Perkhidmatan Kami)', () => {
        // Use requestedType to bypass regex ambiguity (service-cards regex matches 'service' in features too)
        const block = createAddSectionBlock({ instruction: 'add service-cards', requestedType: 'service-cards', locale: 'ms' }) as Record<string, unknown>
        expect(String(block?.headline)).toBe('Perkhidmatan Kami')
    })
})

describe('createAddSectionBlock — locale defaults to EN when absent [TC-F26.02-04]', () => {
    it('no locale field → EN defaults', () => {
        const blockNoLocale = createAddSectionBlock({ instruction: 'add hero', siteName: 'Brand' }) as Record<string, unknown>
        const blockEN = createAddSectionBlock({ instruction: 'add hero', siteName: 'Brand', locale: 'en' }) as Record<string, unknown>
        expect(blockNoLocale?.headline).toBe(blockEN?.headline)
    })
})

// ── normalizeAddSectionBlock — locale pass-through [TC-F26.02-06] ──────────

describe('normalizeAddSectionBlock — locale pass-through [TC-F26.02-06]', () => {
    it('MS locale context → BM headline in hero block', () => {
        const result = normalizeAddSectionBlock(
            { instruction: 'add hero', siteName: 'KedaiKita', locale: 'ms' },
            null,
        ) as Record<string, unknown>
        expect(String(result?.headline).toLowerCase()).toContain('selamat')
    })

    it('EN locale context → EN headline in hero block', () => {
        const result = normalizeAddSectionBlock(
            { instruction: 'add hero', siteName: 'MyShop', locale: 'en' },
            null,
        ) as Record<string, unknown>
        expect(String(result?.headline).toLowerCase()).toContain('welcome')
    })

    it('attaches __localeInit with both en+ms slots', () => {
        const result = normalizeAddSectionBlock(
            { instruction: 'add faq', siteName: 'TestBrand', locale: 'ms' },
            null,
        ) as Record<string, unknown>
        const localeInit = result?.__localeInit as Record<string, unknown>
        expect(localeInit).toBeDefined()
        expect(localeInit).toHaveProperty('en')
        expect(localeInit).toHaveProperty('ms')
    })

    it('__localeInit.ms contains BM content for covered blocks', () => {
        const result = normalizeAddSectionBlock(
            { instruction: 'add faq', siteName: 'KedaiABC', locale: 'ms' },
            null,
        ) as Record<string, unknown>
        const localeInit = result?.__localeInit as Record<string, unknown>
        const msContent = localeInit?.ms as Record<string, unknown>
        expect(String(msContent?.headline).toLowerCase()).toContain('soalan lazim')
    })
})

// ── Coverage map [TC-F26.02-07] ───────────────────────────────────────────

describe('getLocaleCoverage [TC-F26.02-07]', () => {
    it('returns coverage for all authored blocks', () => {
        const coverage = getLocaleCoverage()
        expect(typeof coverage).toBe('object')
        expect(Object.keys(coverage).length).toBeGreaterThan(0)
    })

    it('hero has both en and ms coverage', () => {
        const coverage = getLocaleCoverage()
        expect(coverage.hero).toEqual({ en: true, ms: true })
    })

    it('faq has both en and ms coverage', () => {
        const coverage = getLocaleCoverage()
        expect(coverage.faq).toEqual({ en: true, ms: true })
    })

    it('features has both en and ms coverage', () => {
        const coverage = getLocaleCoverage()
        expect(coverage.features).toEqual({ en: true, ms: true })
    })
})

describe('hasLocaleContent [TC-F26.02-07]', () => {
    it('returns true for hero in both en and ms', () => {
        expect(hasLocaleContent('hero', 'en')).toBe(true)
        expect(hasLocaleContent('hero', 'ms')).toBe(true)
    })

    it('returns false for non-existent block', () => {
        expect(hasLocaleContent('__nonexistent__', 'en')).toBe(false)
        expect(hasLocaleContent('__nonexistent__', 'ms')).toBe(false)
    })
})
