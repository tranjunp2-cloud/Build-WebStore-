/**
 * TC-F01-CR-DET-01..04 — Phase 04 detection primitives.
 * Plan: plans/260415-1745-ai-gen-flow-fix-v2/phase-04-post-ai-content-swap.md
 *
 * Covers `extractBlockText`, `hasUserDataReference`, `isGenericContent`
 * before they are wired into the post-AI swap dispatcher.
 */

import { describe, it, expect } from 'vitest'
import {
    extractBlockText,
    hasUserDataReference,
    isGenericContent,
    isBlockedCopy,
    GENERIC_PHRASE_BLACKLIST,
    BLOCKED_CONTENT,
} from '@/lib/ai/content-rules'

describe('Phase 04 — detection primitives', () => {
    describe('TC-F01-CR-DET-01: extractBlockText', () => {
        it('collects headline + subheadline + description', () => {
            const block = {
                blockType: 'hero',
                headline: 'Welcome',
                subheadline: 'We help businesses grow',
                description: 'A short about line',
            }
            const text = extractBlockText(block)
            expect(text).toContain('welcome')
            expect(text).toContain('businesses grow')
            expect(text).toContain('about line')
        })

        it('walks array items — features[].title + description', () => {
            const block = {
                blockType: 'features',
                headline: 'Why Choose Us',
                features: [
                    { title: 'Fast Delivery', description: 'Nationwide in 48 hours' },
                    { title: 'Great Support', description: 'Live chat 24/7' },
                ],
            }
            const text = extractBlockText(block)
            expect(text).toContain('fast delivery')
            expect(text).toContain('nationwide in 48 hours')
            expect(text).toContain('great support')
        })

        it('walks team.members[].name + role + bio', () => {
            const block = {
                blockType: 'team',
                members: [
                    { name: 'Dr. Tan Wei Ming', role: 'GP', bio: 'MBBS UM 15 years' },
                ],
            }
            const text = extractBlockText(block)
            expect(text).toContain('dr. tan wei ming')
            expect(text).toContain('mbbs um')
        })

        it('returns empty string for block with no text fields', () => {
            const block = { blockType: 'divider' }
            expect(extractBlockText(block)).toBe('')
        })
    })

    describe('TC-F01-CR-DET-02: hasUserDataReference', () => {
        const biz = {
            name: 'Klinik Dr. Tan',
            products: ['Family Medicine', 'Vaccinations'],
        }

        it('returns true when block headline mentions biz name', () => {
            const block = { blockType: 'hero', headline: 'Welcome to Klinik Dr. Tan' }
            expect(hasUserDataReference(block, biz)).toBe(true)
        })

        it('returns true when features title contains a product', () => {
            const block = {
                blockType: 'features',
                features: [
                    { title: 'Family Medicine Services', description: 'Full care for all ages' },
                ],
            }
            expect(hasUserDataReference(block, biz)).toBe(true)
        })

        it('returns false when block text has no overlap with biz', () => {
            const block = {
                blockType: 'features',
                features: [
                    { title: 'Great Support', description: 'Fast response team' },
                ],
            }
            expect(hasUserDataReference(block, biz)).toBe(false)
        })

        it('returns false when biz is undefined', () => {
            const block = { blockType: 'hero', headline: 'Anything' }
            expect(hasUserDataReference(block, undefined)).toBe(false)
        })

        it('ignores biz.name shorter than 3 chars', () => {
            const block = { blockType: 'hero', headline: 'A new day' }
            expect(hasUserDataReference(block, { name: 'Ab' })).toBe(false)
        })
    })

    describe('TC-F01-CR-DET-03: isGenericContent — strong signals', () => {
        it('flags block with BLOCKED_CONTENT phrase', () => {
            const block = {
                blockType: 'hero',
                headline: 'Welcome to our website',
                subheadline: 'We help you grow',
            }
            const result = isGenericContent(block)
            expect(result.generic).toBe(true)
            expect(result.reason).toBe('strong-blocked-phrase')
            expect(result.matchedPhrases).toContain('welcome to our website')
        })

        it('flags block with "your trusted partner"', () => {
            const block = {
                blockType: 'about',
                headline: 'About Us',
                body: 'Your trusted partner for all business needs.',
            }
            const result = isGenericContent(block)
            expect(result.generic).toBe(true)
            expect(result.reason).toBe('strong-blocked-phrase')
        })
    })

    describe('TC-F01-CR-DET-04: isGenericContent — weak signals', () => {
        it('requires ≥2 weak phrase matches to flag generic', () => {
            // 1 weak match → not generic
            const singleWeak = {
                blockType: 'features',
                features: [{ title: 'Quality Service', description: 'Detailed custom work' }],
            }
            expect(isGenericContent(singleWeak).generic).toBe(false)

            // 2 weak matches → generic
            const multiWeak = {
                blockType: 'features',
                features: [
                    { title: 'Quality Service', description: 'Exceptional quality in every interaction' },
                    { title: 'Fast Response', description: 'Dedicated team of professionals' },
                ],
            }
            const result = isGenericContent(multiWeak)
            expect(result.generic).toBe(true)
            expect(result.reason).toBe('multi-weak-phrase')
            expect(result.matchedPhrases.length).toBeGreaterThanOrEqual(2)
        })

        it('Malaysia-specific curated content passes', () => {
            const block = {
                blockType: 'features',
                features: [
                    {
                        title: 'Teeth Whitening',
                        description: 'ZOOM! technology, results in 1 hour, RM 1500 inclusive.',
                    },
                    {
                        title: 'Dental Implants',
                        description: 'MMC-certified surgeons, Straumann implants, financing available.',
                    },
                ],
            }
            const result = isGenericContent(block)
            expect(result.generic).toBe(false)
        })

        it('hand-written Malaysian hero passes', () => {
            const block = {
                blockType: 'hero',
                headline: 'Your Health is Our Priority',
                subheadline: 'Experienced medical professionals and modern equipment in Subang Jaya.',
            }
            expect(isGenericContent(block).generic).toBe(false)
        })
    })

    describe('isBlockedCopy is exported', () => {
        it('matches BLOCKED_CONTENT phrases', () => {
            expect(isBlockedCopy('Welcome to our website')).toBe(true)
            expect(isBlockedCopy('One-stop solution for everything')).toBe(true)
            expect(isBlockedCopy('Clean marketing copy')).toBe(false)
        })
    })

    describe('blacklist invariants', () => {
        it('GENERIC_PHRASE_BLACKLIST + BLOCKED_CONTENT do not overlap', () => {
            const strong = new Set(BLOCKED_CONTENT)
            for (const weak of GENERIC_PHRASE_BLACKLIST) {
                expect(strong.has(weak)).toBe(false)
            }
        })

        it('all phrases are already lowercased', () => {
            for (const p of [...BLOCKED_CONTENT, ...GENERIC_PHRASE_BLACKLIST]) {
                expect(p).toBe(p.toLowerCase())
            }
        })
    })
})
